/* ============================================================
   confessions.js
   --------------------------------------------------------------
   Anonymous (or signed) love-letter confessions, tag-a-classmate
   autocomplete, stationery/wax-seal theming, reply + "reveal
   yourself" flows, and a canvas-drawn PNG keepsake download.
   ============================================================ */

import { S, CONF_THEMES, CONF_SEALS, PRXE } from './state.js';
import { db, ref, push, set, get, update, query, orderByChild, limitToLast, onValue, serverTimestamp } from './firebase-init.js';
import { esc, toast, mkAv } from './utils.js';
import { findUidByNick } from './social.js';

/* ---------- Stationery / wax seal pickers ---------- */
function buildThemeSwatches() {
  const tw = document.getElementById('conf-theme-sw'), sw = document.getElementById('conf-seal-sw');
  if (tw) tw.innerHTML = CONF_THEMES.map(t => `<div class="theme-sw${S.confTheme === t.id ? ' on' : ''}" style="background:${t.bg}" title="${esc(t.name)}" onclick="pickConfTheme(${t.id})"></div>`).join('');
  if (sw) sw.innerHTML = CONF_SEALS.map(s => `<div class="seal-sw${S.confSeal === s.id ? ' on' : ''}" style="background:radial-gradient(circle at 35% 30%,#e8829c,#c23a63)" title="Wax seal" onclick="pickConfSeal(${s.id})">${s.emoji}</div>`).join('');
}
window.pickConfTheme = id => { S.confTheme = id; buildThemeSwatches(); window.prevConf(); };
window.pickConfSeal = id => { S.confSeal = id; buildThemeSwatches(); };

/* ---------- Subscribe / stats ---------- */
export function subConf() {
  if (!S.user) return;
  S.unsubConf = onValue(query(ref(db, 'confessions'), orderByChild('ts'), limitToLast(60)), snap => {
    const confs = []; snap.forEach(c => confs.unshift({ id: c.key, ...c.val() }));
    S.confAll = confs; renderConfs(); updateConfStats();
    buildThemeSwatches();
  }, e => console.error('confessions sub failed', e));
}
function updateConfStats() {
  const tEl = document.getElementById('conf-stat-total'), mEl = document.getElementById('conf-stat-mine'), hEl = document.getElementById('conf-stat-hearts');
  if (!tEl) return;
  const mine = S.confAll.filter(c => S.user && c.uid === S.user.uid).length;
  let hearts = 0;
  S.confAll.forEach(c => {
    if (S.user && c.toUid === S.user.uid) {
      const rx = c.rx || {};
      Object.values(rx).forEach(uids => { if (Array.isArray(uids)) hearts += uids.length; });
    }
  });
  tEl.textContent = S.confAll.length; mEl.textContent = mine; hEl.textContent = hearts;
}
window.setConfTab = tab => {
  S.confTab = tab;
  document.querySelectorAll('.conf-tab').forEach(b => b.classList.remove('on'));
  document.getElementById(`conf-tab-${tab === 'all' ? 'all' : tab === 'sent' ? 'sent' : 'recv'}`)?.classList.add('on');
  renderConfs();
};
window.surpriseConf = () => {
  const visible = S.confAll.filter(confMatchesFilter);
  if (!visible.length) { toast('No letters to surprise you with yet 🤍', 'a'); return; }
  const pick = visible[Math.floor(Math.random() * visible.length)];
  window.openLetter(pick.id);
};

/* ---------- Tag someone ---------- */
window.confTagSearch = async q => {
  const box = document.getElementById('conf-tag-suggest'); if (!box) return;
  S.confToUid = null; S.confToNick = null;
  if (!q || !q.trim()) { box.classList.remove('on'); box.innerHTML = ''; return; }
  try {
    const snap = await get(ref(db, 'users')); const res = [];
    snap.forEach(c => { if (!S.user || c.key === S.user.uid) return; const d = c.val(); if ((d.nick || '').toLowerCase().includes(q.toLowerCase())) res.push({ uid: c.key, ...d }); });
    if (!res.length) { box.classList.remove('on'); box.innerHTML = ''; return; }
    box.innerHTML = ''; box.classList.add('on');
    res.slice(0, 8).forEach(u => {
      const opt = document.createElement('div'); opt.className = 'tag-opt';
      opt.innerHTML = `${mkAv(u.nick || '?', u.av ?? 0, u.pfp, 26, 'ures-av')}<span class="tag-opt-nm">${esc(u.nick || '?')}</span>`;
      opt.onclick = () => window.selectConfTag(u.uid, u.nick || '?');
      box.appendChild(opt);
    });
  } catch (e) { console.error(e); }
};
window.selectConfTag = (uid, nick) => {
  S.confToUid = uid; S.confToNick = nick;
  document.getElementById('conf-to').value = nick;
  document.getElementById('conf-tag-suggest').classList.remove('on');
  document.getElementById('conf-tag-chip').innerHTML = `<span class="tag-chip">💕 Tagged: ${esc(nick)} <button type="button" onclick="clearConfTag()">✕</button></span>`;
  window.prevConf();
};
window.clearConfTag = () => {
  S.confToUid = null; S.confToNick = null;
  document.getElementById('conf-to').value = '';
  document.getElementById('conf-tag-chip').innerHTML = '';
};
document.addEventListener('click', e => {
  const wrap = document.getElementById('conf-tag-suggest');
  if (wrap && !e.target.closest('.tag-wrap')) wrap.classList.remove('on');
});

/* ---------- Letter text building (single source of truth) ---------- */
function fmtLetterDate(ts) { const d = ts ? new Date(ts) : new Date(); return d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
function letterBodyText(to, msg, from) { return `Dear ${to},\n\n${msg}\n\nWith all my heart,\n${from}`; }

window.prevConf = () => {
  const from = (document.getElementById('conf-from').value.trim() || 'Anonymous');
  const to = document.getElementById('conf-to').value.trim() || 'Someone Special';
  const msg = document.getElementById('conf-msg').value.trim();
  const prev = document.getElementById('conf-preview'), letter = document.getElementById('conf-letter');
  if (!msg) { prev.classList.remove('show'); return; }
  letter.textContent = `${fmtLetterDate()}\n\n${letterBodyText(to, msg, from)}`;
  prev.classList.add('show');
};

window.submitConf = async () => {
  if (!S.user) { toast('Please sign in again.', 'r'); return; }
  const from = (document.getElementById('conf-from').value.trim() || 'Anonymous');
  const to = document.getElementById('conf-to').value.trim() || 'Someone Special';
  const msg = document.getElementById('conf-msg').value.trim();
  if (!msg) { toast('Write your message first!', 'a'); return; }
  let toUid = S.confToUid || null;
  if (!toUid && document.getElementById('conf-to').value.trim()) {
    toUid = await findUidByNick(document.getElementById('conf-to').value.trim());
    if (!toUid) { toast(`Couldn't find "${to}" — pick their name from the suggestions so it reaches them 💌`, 'a'); return; }
  }
  try {
    const newRef = push(ref(db, 'confessions'));
    await set(newRef, { from, to, toUid: toUid || null, message: msg, theme: S.confTheme || 0, seal: S.confSeal || 0, uid: S.user.uid, nick: S.nick, ts: serverTimestamp(), rx: null, reply: null, revealReq: false, revealed: false, revealedNick: null });
    if (toUid) await push(ref(db, `notifications/${toUid}`), { type: 'confession', icon: '💌', text: 'You received a new anonymous confession letter! Someone out there is thinking of you 💕', ts: serverTimestamp(), read: false, confId: newRef.key });
    document.getElementById('conf-from').value = ''; document.getElementById('conf-to').value = '';
    document.getElementById('conf-msg').value = ''; document.getElementById('conf-preview').classList.remove('show');
    document.getElementById('conf-tag-chip').innerHTML = ''; S.confToUid = null; S.confToNick = null;
    toast('Confession sent! 💌', 'g');
  } catch (e) { console.error(e); toast('Failed to send — check your connection', 'r'); }
};

function confMatchesFilter(c) {
  if (S.confTab === 'sent' && !(S.user && c.uid === S.user.uid)) return false;
  if (S.confTab === 'recv' && !(S.user && c.toUid === S.user.uid)) return false;
  const q = (document.getElementById('conf-search')?.value || '').trim().toLowerCase();
  if (q && !((c.to || '').toLowerCase().includes(q) || (c.from || '').toLowerCase().includes(q))) return false;
  return true;
}

export function renderConfs() {
  const el = document.getElementById('conf-list'); if (!el) return;
  const confs = S.confAll.filter(confMatchesFilter);
  if (!S.confAll.length) { el.innerHTML = '<div class="es"><div class="es-ico">💌</div><div class="es-ttl">No confessions yet</div></div>'; return; }
  if (!confs.length) { el.innerHTML = '<div class="conf-empty-filter">No letters match here yet 🤍</div>'; return; }
  el.innerHTML = '';
  confs.forEach(c => {
    S.confLetters[c.id] = c;
    const card = document.createElement('div'); card.className = 'conf-card';
    const rx = c.rx || {};
    const rxH = PRXE.map(e => {
      const uids = rx[e] || []; const mine = S.user && uids.includes(S.user.uid); const cnt = uids.length;
      return `<button class="rc${mine ? ' mine' : ''}" style="font-size:12.5px" type="button" onclick="event.stopPropagation();doRx('${c.id}','${e}','conf:${c.id}')">${e}${cnt > 0 ? `<span class="rcn">${cnt}</span>` : ''}</button>`;
    }).join('');
    const isMine = S.user && c.uid === S.user.uid, isToMe = S.user && c.toUid === S.user.uid;
    const badges = (isMine ? '<span class="conf-mine-badge">You sent</span>' : '') +
      (isToMe ? '<span class="conf-tome-badge">To you</span>' : '') +
      (c.revealed ? '<span class="conf-reveal-tag">Revealed</span>' : (isToMe && c.revealReq ? '<span class="conf-reveal-tag">Reveal asked</span>' : ''));
    const snippet = (c.message || '').slice(0, 120);
    card.innerHTML = `${isMine ? `<button class="conf-del-mini" type="button" onclick="event.stopPropagation();delConf('${c.id}')" title="Delete">✕</button>` : ''}<div class="conf-card-hd"><span class="conf-badge">💌 Confession</span><span class="conf-ts">${c.ts ? fd(new Date(c.ts)) : ''}</span></div><div class="conf-card-txt">${esc(snippet)}${(c.message || '').length > 120 ? '…' : ''}</div><div class="conf-footer"><span class="conf-fts">To: ${esc(c.to || '?')} ${badges}</span><div class="conf-rxrow">${rxH}</div></div>`;
    card.onclick = () => window.openLetter(c.id);
    el.appendChild(card);
  });
}
window.renderConfs = renderConfs;
window.delConf = async id => {
  const c = S.confLetters[id]; if (!c || !S.user || c.uid !== S.user.uid) return;
  if (!confirm('Delete this confession letter? This cannot be undone.')) return;
  try { await remove(ref(db, `confessions/${id}`)); toast('Letter deleted', 'a'); window.closeLetter(); }
  catch (e) { console.error(e); toast('Failed to delete', 'r'); }
};

/* ---------- Letter modal ---------- */
window.openLetter = id => {
  const c = S.confLetters[id]; if (!c) return;
  const theme = CONF_THEMES[c.theme || 0] || CONF_THEMES[0];
  const seal = CONF_SEALS[c.seal || 0] || CONF_SEALS[0];
  const env = document.getElementById('letter-envelope');
  const body = letterBodyText(c.to || 'Someone Special', c.message || '', c.from || 'Anonymous');
  const isMine = S.user && c.uid === S.user.uid, isToMe = S.user && c.toUid === S.user.uid;
  let acts = `<button class="letter-abtn" type="button" onclick="downloadLetterImg('${id}')">⬇️ Save Image</button><button class="letter-abtn" type="button" onclick="copyLetterText('${id}')">📋 Copy Text</button>`;
  if (isToMe && !c.reply) acts += `<button class="letter-abtn pink" type="button" onclick="toggleReplyBox('${id}')">💬 Reply</button>`;
  if (isToMe && !c.revealed && !c.revealReq) acts += `<button class="letter-abtn" type="button" onclick="askReveal('${id}')">💫 Ask to Reveal</button>`;
  if (isMine && c.revealReq && !c.revealed) acts += `<button class="letter-abtn pink" type="button" onclick="revealSelf('${id}')">🎭 Reveal Yourself</button>`;
  if (isMine) acts += `<button class="letter-abtn danger" type="button" onclick="delConf('${id}')">🗑️ Delete</button>`;
  let replyHtml = '';
  if (c.reply && (isMine || isToMe)) replyHtml = `<div class="letter-reply-existing"><div class="lre-lbl">💌 Reply</div><div class="lre-txt">${esc(c.reply.text || '')}</div></div>`;
  let revealHtml = '';
  if (c.revealed && c.revealedNick) revealHtml = `<div class="letter-reveal-box">🎭 ${esc(c.revealedNick)} chose to reveal themselves as the sender!</div>`;
  env.innerHTML = `<div class="letter-paper ${theme.cls}"><div class="letter-seal ${seal.cls}">${seal.emoji}</div><button class="letter-close" onclick="closeLetter()">✕</button><div class="letter-hd">A Letter For You</div><div class="letter-to">To: ${esc(c.to || 'Someone Special')} · From: ${esc(c.from || 'Anonymous')}</div><div class="letter-body">${esc(body)}</div><div class="letter-hearts">💕 ✨ 💌 ✨ 💕</div>${revealHtml}${replyHtml}<div class="letter-actbar">${acts}</div><div id="letter-reply-slot-${id}"></div></div>`;
  document.getElementById('letter-modal').classList.add('on');
  playChime();
};
window.closeLetter = () => { document.getElementById('letter-modal').classList.remove('on'); };
window.toggleReplyBox = id => {
  const slot = document.getElementById(`letter-reply-slot-${id}`); if (!slot) return;
  if (slot.innerHTML) { slot.innerHTML = ''; return; }
  slot.innerHTML = `<div class="letter-reply-box"><textarea class="letter-reply-ta" id="reply-ta-${id}" placeholder="Write a short reply back…" maxlength="500"></textarea><button class="letter-abtn pink" type="button" onclick="sendReply('${id}')">Send Reply 💌</button></div>`;
};
window.sendReply = async id => {
  const ta = document.getElementById(`reply-ta-${id}`); const text = ta?.value.trim(); if (!text) return;
  const c = S.confLetters[id]; if (!c) return;
  try {
    await update(ref(db, `confessions/${id}`), { reply: { text, ts: Date.now() } });
    if (c.uid) await push(ref(db, `notifications/${c.uid}`), { type: 'confession_reply', icon: '💬', text: 'Someone replied to your confession letter!', ts: serverTimestamp(), read: false, confId: id });
    toast('Reply sent 💌', 'g'); window.openLetter(id);
  } catch (e) { console.error(e); toast('Failed to send reply', 'r'); }
};
window.askReveal = async id => {
  const c = S.confLetters[id]; if (!c) return;
  try {
    await update(ref(db, `confessions/${id}`), { revealReq: true });
    if (c.uid) await push(ref(db, `notifications/${c.uid}`), { type: 'confession_reveal_request', icon: '💫', text: "Someone is curious who sent them a confession letter — they'd love to know it's you!", ts: serverTimestamp(), read: false, confId: id });
    toast('Request sent! They may choose to reveal themselves 💫', 'g'); window.openLetter(id);
  } catch (e) { console.error(e); toast('Failed to send request', 'r'); }
};
window.revealSelf = async id => {
  const c = S.confLetters[id]; if (!c || !S.user) return;
  if (!confirm(`Reveal yourself as ${S.nick} to the recipient of this letter?`)) return;
  try {
    await update(ref(db, `confessions/${id}`), { revealed: true, revealedNick: S.nick });
    if (c.toUid) await push(ref(db, `notifications/${c.toUid}`), { type: 'confession_revealed', icon: '🎭', text: `${S.nick} revealed themselves as the sender of your confession letter!`, ts: serverTimestamp(), read: false, confId: id });
    toast('You revealed yourself 🎭', 'g'); window.openLetter(id);
  } catch (e) { console.error(e); toast('Failed to reveal', 'r'); }
};
window.copyLetterText = id => {
  const c = S.confLetters[id]; if (!c) return;
  const txt = `${fmtLetterDate(c.ts)}\n\n${letterBodyText(c.to || 'Someone Special', c.message || '', c.from || 'Anonymous')}`;
  navigator.clipboard?.writeText(txt).then(() => toast('Letter copied to clipboard 📋', 'g')).catch(() => toast('Could not copy', 'r'));
};

/** Renders the letter onto a canvas and triggers a PNG download. */
window.downloadLetterImg = id => {
  const c = S.confLetters[id]; if (!c) return;
  const theme = CONF_THEMES[c.theme || 0] || CONF_THEMES[0];
  const dark = theme.id === 4;
  const W = 640, pad = 52; const cvs = document.createElement('canvas'); cvs.width = W;
  const ctx = cvs.getContext('2d');
  ctx.font = 'italic 20px Georgia, serif';
  const msg = c.message || '';
  const words = msg.split(/\s+/); const lines = []; let line = '';
  words.forEach(w => { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > W - pad * 2) { lines.push(line); line = w; } else line = test; });
  if (line) lines.push(line);
  const lineH = 32; const H = pad * 2 + 150 + lines.length * lineH + 70;
  cvs.height = H;
  const g = ctx.createLinearGradient(0, 0, W, H);
  if (dark) { g.addColorStop(0, '#2b2320'); g.addColorStop(1, '#1c1613'); } else { g.addColorStop(0, '#fdf6ec'); g.addColorStop(1, '#f2e2ce'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = dark ? '#e8b4c4' : '#a8365a'; ctx.font = '30px Georgia, serif';
  ctx.fillText('A Letter For You', W / 2, pad + 18);
  ctx.fillStyle = dark ? '#c9b8a8' : '#8a6a52'; ctx.font = '14px Georgia, serif';
  ctx.fillText(`To: ${c.to || 'Someone Special'}  ·  From: ${c.from || 'Anonymous'}`, W / 2, pad + 46);
  ctx.textAlign = 'left'; ctx.font = 'italic 18px Georgia, serif'; ctx.fillStyle = dark ? '#e6dcd2' : '#3d2e22';
  let y = pad + 95;
  ctx.fillText(`Dear ${c.to || 'Someone Special'},`, pad, y); y += lineH;
  lines.forEach(l => { ctx.fillText(l, pad, y); y += lineH; });
  y += 6; ctx.fillText('With all my heart,', pad, y); y += lineH;
  ctx.fillText(c.from || 'Anonymous', pad, y);
  ctx.textAlign = 'center'; ctx.font = '16px Arial'; ctx.fillText('💕 ✨ 💌 ✨ 💕', W / 2, H - 30);
  const a = document.createElement('a'); a.download = 'confession-letter.png'; a.href = cvs.toDataURL('image/png'); a.click();
  toast('Letter image downloaded ⬇️', 'g');
};
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [659.25, 783.99, 987.77];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.start(t); o.stop(t + 0.55);
    });
  } catch (e) {}
}
