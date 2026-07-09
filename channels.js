/* ============================================================
   channels.js
   --------------------------------------------------------------
   The #general/#random/#memories/#introductions chat panel:
   subscribing to messages, rendering the feed, typing indicators,
   the emoji picker, and sending text/media. Every avatar/name in
   the feed is clickable via mkAv(...,uid) → opens the profile
   viewer (profile.js).
   ============================================================ */

import { S, EMJ, CMeta } from './state.js';
import { db, ref, push, query, orderByChild, limitToLast, onChildAdded, onChildChanged, onValue, set, remove, ODC, serverTimestamp, off } from './firebase-init.js';
import { esc, lfy, ft, mkAv, mkDSep, avOf, toast } from './utils.js';
import { mkRx, updateME } from './reactions.js';
import { upFile } from './media.js';
import { closeSb } from './ui.js';

/* ---------- Channel switching ---------- */
window.swCh = ch => {
  if (S.unsubMsg) { S.unsubMsg(); S.unsubMsg = null; }
  offTyp(); stopTyping(); S.ch = ch;
  document.querySelectorAll('#ch-list .sbi').forEach(e => e.classList.remove('on'));
  document.getElementById(`sch-${ch}`)?.classList.add('on');
  document.getElementById('tb-title').textContent = `💬 ${ch}`;
  document.getElementById('tb-desc').textContent = CMeta[ch]?.desc || '';
  document.getElementById('msgin').placeholder = `Message #${ch}`;
  clearFeed(); S.buf[ch] = new Map(); S.lastSnd[ch] = null;
  S.unread[ch] = 0; rdUnread(ch);
  if (window.innerWidth <= 768) closeSb();
  subMsg(ch); subTyp(ch);
};

function subMsg(ch) {
  if (!S.buf[ch]) S.buf[ch] = new Map();
  const q = query(ref(db, `channels/${ch}/msgs`), orderByChild('ts'), limitToLast(300));
  const aH = onChildAdded(q, snap => {
    const d = { id: snap.key, ...snap.val() };
    if (!S.buf[ch].has(snap.key)) { S.buf[ch].set(snap.key, d); appendMsg(ch, d); }
  }, e => console.error(e));
  const cH = onChildChanged(q, snap => {
    const d = { id: snap.key, ...snap.val() };
    S.buf[ch].set(snap.key, d); updateME(snap.key, d, 'ch');
  }, e => console.error(e));
  S.unsubMsg = () => { off(q, 'child_added', aH); off(q, 'child_changed', cH); };
}

function appendMsg(ch, d) {
  if (ch !== S.ch) { S.unread[ch] = (S.unread[ch] || 0) + 1; rdUnread(ch); return; }
  const feed = document.getElementById('chat-feed');
  if (!feed) return;
  const empty = document.getElementById('chat-empty'); if (empty) empty.style.display = 'none';
  const uid = d.uid || '', nick = d.nick || 'Unknown', text = d.text || '';
  const ts = d.ts ? new Date(d.ts) : new Date(), av = d.av ?? avOf(nick), pfp = d.pfp || null;
  const own = uid === S.user?.uid, id = d.id, rx = d.rx || {};
  const prev = feed.querySelectorAll('[data-id]');
  if (!prev.length) feed.appendChild(mkDSep(ts));
  const last = S.lastSnd[ch]; const cont = last && last.uid === uid && (ts.getTime() - last.ts) < 300000;
  S.lastSnd[ch] = { uid, ts: ts.getTime() };
  const el = document.createElement('div'); el.setAttribute('data-id', id);
  const rxH = mkRx(rx, id, 'ch'); const mH = mkMed(d);
  if (cont) {
    el.className = 'mc' + (own ? ' own' : '');
    el.innerHTML = `<div class="cts">${ft(ts)}</div><div class="mtxt" id="mt${id}">${lfy(esc(text))}</div>${mH}${rxH}<div class="macts"><button class="mab" type="button" onclick="togMEp('${id}','ch')">😊</button></div><div class="ep-pop" id="ep${id}"></div>`;
  } else {
    el.className = 'mg' + (own ? ' own' : '');
    el.innerHTML = `${mkAv(nick, av, pfp, 32, 'mav', '', uid)}
    <div class="mb"><div class="mhdr"><span class="mnm${own ? ' own' : ''} clickable-nm" onclick="vProf('${uid}')">${esc(nick)}</span><span class="mts">${ft(ts)}</span></div>
    <div class="mtxt" id="mt${id}">${lfy(esc(text))}</div>${mH}${rxH}</div>
    <div class="macts"><button class="mab" type="button" onclick="togMEp('${id}','ch')">😊</button></div><div class="ep-pop" id="ep${id}"></div>`;
  }
  feed.appendChild(el); autoSc('chat-wrap', 'sfab');
}

function mkMed(d) {
  if (!d.imgUrl) return '';
  if (d.mediaType === 'video') return `<video class="mvid" src="${esc(d.imgUrl)}" controls playsinline></video>`;
  return `<img class="mimg" src="${esc(d.imgUrl)}" loading="lazy" onclick="openLb('img','${esc(d.imgUrl)}')" alt=""/>`;
}

/* ---------- Sending ---------- */
window.sendMsg = async () => {
  const inp = document.getElementById('msgin'); const text = inp.value.trim();
  if (!text && !S.pendFile) return; if (!S.user) return;
  inp.value = ''; rsz(inp); updS(); updCC(); stopTyping();
  const data = { text: text || '', nick: S.nick, uid: S.user.uid, av: S.av, pfp: S.pfp || null, ts: serverTimestamp(), rx: null };
  if (S.pendFile) { data.imgUrl = S.pendFile.url; data.mediaType = S.pendFile.type; S.pendFile = null; }
  try { await push(ref(db, `channels/${S.ch}/msgs`), data); } catch (e) { console.error(e); toast('Failed to send', 'r'); }
};

window.sendFile = async (input, ctx) => {
  const file = input.files[0]; if (!file) return;
  input.value = ''; toast('Uploading…', 'b');
  try {
    const url = await upFile(file, `media/${S.user.uid}/${Date.now()}_${file.name}`);
    const isV = file.type.startsWith('video');
    if (ctx === 'chat') { S.pendFile = { url, type: isV ? 'video' : 'image' }; await sendMsg(); }
    else if (ctx === 'dm') { await window.sendDMfile(url, isV ? 'video' : 'image'); }
  } catch (e) { console.error(e); toast('Upload failed. Enable Firebase Storage.', 'r'); }
};

/* ---------- Typing indicators ---------- */
function subTyp(ch) {
  offTyp();
  const r = ref(db, `typing/${ch}`);
  const h = onValue(r, snap => {
    const d = snap.val() || {};
    const nks = Object.entries(d).filter(([u]) => u !== S.user?.uid).map(([, v]) => v.nick || '').filter(Boolean);
    renderTyp(nks);
  });
  S.unsubTyp = () => off(r, 'value', h);
}
function offTyp() { if (S.unsubTyp) { S.unsubTyp(); S.unsubTyp = null; } }
function renderTyp(nks) {
  const el = document.getElementById('tybar'); if (!el) return;
  if (!nks.length) { el.innerHTML = ''; return; }
  const lbl = nks.length === 1 ? `${esc(nks[0])} is typing` : nks.length === 2 ? `${esc(nks[0])} and ${esc(nks[1])} are typing` : `${nks.length} people are typing`;
  el.innerHTML = `<div class="tydots"><div class="tyd"></div><div class="tyd"></div><div class="tyd"></div></div><span class="ty-txt">${lbl}…</span>`;
}
function startTyping() {
  if (!S.user || !S.ch) return;
  const r = ref(db, `typing/${S.ch}/${S.user.uid}`);
  set(r, { nick: S.nick, ts: serverTimestamp() }).catch(() => {});
  ODC(r).remove().catch(() => {});
  S.typing = true;
}
function stopTyping() {
  if (!S.user || !S.ch) return;
  remove(ref(db, `typing/${S.ch}/${S.user.uid}`)).catch(() => {});
  clearTimeout(S.typTmr); S.typTmr = null; S.typing = false;
}
export { stopTyping };

window.onMI = () => {
  const inp = document.getElementById('msgin'); rsz(inp); updS(); updCC();
  if (inp.value.trim()) { if (!S.typing) startTyping(); clearTimeout(S.typTmr); S.typTmr = setTimeout(stopTyping, 3500); }
  else stopTyping();
};
window.onMK = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendMsg(); } };
function rsz(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 100) + 'px'; }
function updS() { document.getElementById('send-btn').disabled = !document.getElementById('msgin').value.trim() && !S.pendFile; }
function updCC() {
  const l = document.getElementById('msgin').value.length;
  const el = document.getElementById('char-c'); if (!el) return;
  if (l > 1800) { el.textContent = `${l}/2000`; el.style.color = l >= 2000 ? '#ef4444' : '#f59e0b'; }
  else { el.textContent = ''; el.style.color = ''; }
}

/* ---------- Emoji picker ---------- */
window.togEp = () => document.getElementById('epin').classList.toggle('on');
export function buildEpg() {
  const g = document.getElementById('epg'); if (!g) return;
  g.innerHTML = EMJ.map(e => `<div class="epge" onclick="insEmj('${e}')">${e}</div>`).join('');
}
window.insEmj = e => {
  const inp = document.getElementById('msgin');
  const s = inp.selectionStart, en = inp.selectionEnd;
  inp.value = inp.value.slice(0, s) + e + inp.value.slice(en);
  inp.selectionStart = inp.selectionEnd = s + e.length;
  inp.focus(); document.getElementById('epin').classList.remove('on'); updS();
};
document.addEventListener('click', e => {
  const ep = document.getElementById('epin');
  if (ep && !e.target.closest('#epin') && !e.target.closest('.intl')) ep.classList.remove('on');
});

/* ---------- Scroll handling ---------- */
function autoSc(wId, fabId) {
  const f = document.getElementById(wId); if (!f) return;
  const near = f.scrollHeight - f.scrollTop - f.clientHeight < 80;
  if (near) { f.scrollTop = f.scrollHeight; document.getElementById(fabId)?.classList.remove('on'); }
  else document.getElementById(fabId)?.classList.add('on');
}
window.scrollBot = sm => {
  const f = document.getElementById('chat-wrap');
  f.scrollTo({ top: f.scrollHeight, behavior: sm ? 'smooth' : 'instant' });
  document.getElementById('sfab')?.classList.remove('on');
};
document.getElementById('chat-wrap')?.addEventListener('scroll', () => {
  const f = document.getElementById('chat-wrap');
  document.getElementById('sfab')?.classList.toggle('on', f.scrollHeight - f.scrollTop - f.clientHeight > 100);
});

/* ---------- Unread badges ---------- */
function rdUnread(ch) {
  const el = document.getElementById(`sch-${ch}`); if (!el) return;
  let b = el.querySelector('.sbdg'); const c = S.unread[ch] || 0;
  if (c > 0) { if (!b) { b = document.createElement('span'); b.className = 'sbdg'; el.appendChild(b); } b.textContent = c > 99 ? '99+' : c; }
  else b?.remove();
}
function clearFeed() {
  document.getElementById('chat-feed').innerHTML = `<div class="es" id="chat-empty"><div class="es-ico">💬</div><div class="es-ttl">No messages yet</div><div style="font-size:12px">Say something in #${esc(S.ch)}!</div></div>`;
}
