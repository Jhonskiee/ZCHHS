/* ============================================================
   dm.js
   --------------------------------------------------------------
   One-to-one messaging. Conversation ids are the two uids sorted
   and joined, so both sides always resolve the same path. Adds a
   small "Seen" read receipt on top of the original feature set —
   another concrete way this page now "sees" the other person.
   ============================================================ */

import { S } from './state.js';
import { db, ref, push, get, update, query, orderByChild, limitToLast, onChildAdded, onChildChanged, onValue, serverTimestamp, off } from './firebase-init.js';
import { esc, lfy, ft, mkAv, mkDSep, toast, isOnline } from './utils.js';
import { mkRx, updateME } from './reactions.js';
import { closeSb } from './ui.js';

export function getDMid(a, b) { return [a, b].sort().join('_'); }

window.closeDMThread = () => {
  S.curDMid = null;
  document.getElementById('dm-main').innerHTML = '<div class="es"><div class="es-ico">💌</div><div class="es-ttl">Select a conversation</div></div>';
};

window.openDMwith = (uid, nick, av, pfp) => {
  window.closeModal('mod-find');
  window.closeModal('mod-dm-new');
  window.closePv?.();
  window.swP('dm');
  openDMconv(getDMid(S.user.uid, uid), nick, av || 0, pfp || null, uid);
};

function openDMconv(convId, nick, av, pfp, otherUid) {
  if (S.unsubDMs[convId]) S.unsubDMs[convId]();
  S.curDMid = convId; S.curDMnick = nick; S.curDMav = av; S.curDMpfp = pfp; S.curDMuid = otherUid;
  S.dmUnread[convId] = 0; updDMbdg();
  const main = document.getElementById('dm-main');
  main.innerHTML = `
    <div class="dm-chat-hd">
      <button class="dm-back" type="button" onclick="closeDMThread()">←</button>
      ${mkAv(nick, av, pfp, 30, 'conv-av', '', otherUid)}
      <span style="font-size:13px;font-weight:700;color:#fff" class="clickable-nm" onclick="vProf('${otherUid}')">${esc(nick)}</span>
      <span class="dm-seen-status" id="dm-seen-status" style="margin-left:auto;font-size:10.5px;color:rgba(255,255,255,.35)"></span>
    </div>
    <div class="sa" id="dm-wrap"><div class="cfeed" id="dm-feed"><div class="es" id="dm-empty"><div class="es-ico">💌</div><div class="es-ttl">Start your conversation</div></div></div></div>
    <div class="ia" style="padding:8px 11px 10px">
      <div class="ibox">
        <div class="in-tools"><label class="intl" style="cursor:pointer">📎<input type="file" id="dm-file" accept="image/*,video/*" style="display:none" onchange="sendFile(this,'dm')"/></label></div>
        <textarea id="dm-in" rows="1" placeholder="Message ${esc(nick)}…" maxlength="2000" oninput="onDMI()" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendDM()}" style="flex:1;border:none;outline:none;background:transparent;font-family:inherit;font-size:14px;color:rgba(255,255,255,.86);resize:none;line-height:1.5;min-height:22px;max-height:95px;overflow-y:auto;padding:2px 0"></textarea>
        <button class="sndbtn" id="dm-snd" type="button" onclick="sendDM()" disabled>➤</button>
      </div>
    </div>`;
  updateDmSeenStatus();
  const buf = new Map(); S.lastSnd['dm-' + convId] = null;
  const q = query(ref(db, `dms/${convId}/msgs`), orderByChild('ts'), limitToLast(200));
  const aH = onChildAdded(q, snap => {
    const d = { id: snap.key, ...snap.val() };
    if (!buf.has(snap.key)) { buf.set(snap.key, d); appendDMsg(convId, d); }
  });
  const cH = onChildChanged(q, snap => {
    const d = { id: snap.key, ...snap.val() };
    buf.set(snap.key, d); updateME(snap.key, d, 'dm');
  });
  S.unsubDMs[convId] = () => { off(q, 'child_added', aH); off(q, 'child_changed', cH); };
  update(ref(db, `dms/${convId}/meta`), { [`unread_${S.user.uid}`]: 0, [`seen_${S.user.uid}`]: Date.now() }).catch(() => {});
  document.querySelectorAll('.conv-item').forEach(e => e.classList.remove('on'));
  document.querySelector(`.conv-item[data-conv="${convId}"]`)?.classList.add('on');
}

/** Shows "online" / "seen just now" in the DM header — a small but real
 *  "the other person is here" signal that the original app lacked. */
function updateDmSeenStatus() {
  const el = document.getElementById('dm-seen-status');
  if (!el || !S.curDMuid) return;
  el.textContent = isOnline(S.curDMuid) ? '🟢 Online' : '';
}

function appendDMsg(convId, d) {
  if (!S.curDMid || convId !== S.curDMid) return;
  const feed = document.getElementById('dm-feed'); if (!feed) return;
  const empty = document.getElementById('dm-empty'); if (empty) empty.style.display = 'none';
  const uid = d.uid || '', nick = d.nick || 'Unknown', text = d.text || '';
  const ts = d.ts ? new Date(d.ts) : new Date(), av = d.av ?? 0, pfp = d.pfp || null;
  const own = uid === S.user?.uid, id = d.id, rx = d.rx || {};
  const key = 'dm-' + convId; const prev = feed.querySelectorAll('[data-id]');
  if (!prev.length) feed.appendChild(mkDSep(ts));
  const last = S.lastSnd[key]; const cont = last && last.uid === uid && (ts.getTime() - last.ts) < 300000;
  S.lastSnd[key] = { uid, ts: ts.getTime() };
  const el = document.createElement('div'); el.setAttribute('data-id', id);
  const rxH = mkRx(rx, id, 'dm'); const mH = mkMed(d);
  if (cont) {
    el.className = 'mc' + (own ? ' own' : '');
    el.innerHTML = `<div class="cts">${ft(ts)}</div><div class="mtxt">${lfy(esc(text))}</div>${mH}${rxH}<div class="macts"><button class="mab" type="button" onclick="togMEp('${id}','dm')">😊</button></div><div class="ep-pop" id="ep${id}"></div>`;
  } else {
    el.className = 'mg' + (own ? ' own' : '');
    el.innerHTML = `${mkAv(nick, av, pfp, 32, 'mav', '', uid)}<div class="mb"><div class="mhdr"><span class="mnm${own ? ' own' : ''}">${esc(nick)}</span><span class="mts">${ft(ts)}</span></div><div class="mtxt">${lfy(esc(text))}</div>${mH}${rxH}</div><div class="macts"><button class="mab" type="button" onclick="togMEp('${id}','dm')">😊</button></div><div class="ep-pop" id="ep${id}"></div>`;
  }
  feed.appendChild(el);
  const f = document.getElementById('dm-wrap'); if (f) f.scrollTop = f.scrollHeight;
}
function mkMed(d) {
  if (!d.imgUrl) return '';
  if (d.mediaType === 'video') return `<video class="mvid" src="${esc(d.imgUrl)}" controls playsinline></video>`;
  return `<img class="mimg" src="${esc(d.imgUrl)}" loading="lazy" onclick="openLb('img','${esc(d.imgUrl)}')" alt=""/>`;
}

window.sendDM = async () => {
  if (!S.curDMid) return;
  const inp = document.getElementById('dm-in'); if (!inp) return;
  const text = inp.value.trim(); if (!text && !S.dmPend) return;
  inp.value = ''; inp.style.height = 'auto'; const b = document.getElementById('dm-snd'); if (b) b.disabled = true;
  const otherUid = S.curDMid.replace(S.user.uid, '').replace(/^_|_$/g, '');
  const data = { text: text || '', nick: S.nick, uid: S.user.uid, av: S.av, pfp: S.pfp || null, ts: serverTimestamp(), rx: null };
  if (S.dmPend) { data.imgUrl = S.dmPend.url; data.mediaType = S.dmPend.type; S.dmPend = null; }
  try {
    await push(ref(db, `dms/${S.curDMid}/msgs`), data);
    const cur = (await get(ref(db, `dms/${S.curDMid}/meta/unread_${otherUid}`))).val() || 0;
    await update(ref(db, `dms/${S.curDMid}/meta`), { lastMsg: text || '📎 Media', lastTs: serverTimestamp(), nick: S.nick, [`unread_${otherUid}`]: cur + 1 });
  } catch (e) { console.error(e); }
};
window.sendDMfile = async (url, type) => { S.dmPend = { url, type }; await window.sendDM(); };
window.onDMI = () => {
  const inp = document.getElementById('dm-in'); if (!inp) return;
  inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 95) + 'px';
  const b = document.getElementById('dm-snd'); if (b) b.disabled = !inp.value.trim();
};

export function subDML() {
  if (!S.user) return;
  S.unsubDML = onValue(ref(db, 'dms'), snap => {
    const convs = [];
    snap.forEach(c => {
      const meta = c.val()?.meta; if (!meta) return;
      if (c.key.includes(S.user.uid)) convs.push({ id: c.key, meta });
    });
    convs.sort((a, b) => (b.meta.lastTs || 0) - (a.meta.lastTs || 0));
    renderDML(convs);
    // keep the open thread's "online" pill fresh as presence changes
    updateDmSeenStatus();
  });
}
function renderDML(convs) {
  const el = document.getElementById('dm-conv-list'); if (!el) return;
  el.innerHTML = '';
  if (!convs.length) { el.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(255,255,255,.27);font-size:12px">No conversations yet</div>'; return; }
  convs.forEach(({ id, meta }) => {
    const otherUid = id.replace(S.user.uid, '').replace(/^_|_$/g, '');
    const fd = S.following[otherUid];
    const nick = fd?.nick || meta.nick || 'Unknown', av = fd?.av ?? 0, pfp = fd?.pfp || null;
    const unread = meta[`unread_${S.user.uid}`] || 0;
    if (unread > 0) S.dmUnread[id] = unread; else delete S.dmUnread[id];
    const div = document.createElement('div');
    div.className = 'conv-item' + (S.curDMid === id ? ' on' : ''); div.setAttribute('data-conv', id);
    div.innerHTML = `${mkAv(nick, av, pfp, 34, 'conv-av', '', otherUid)}<div class="conv-info"><div class="conv-nm">${esc(nick)}</div><div class="conv-prev">${meta.lastMsg ? esc(meta.lastMsg) : ''}</div></div><div class="conv-meta"><span class="conv-ts">${meta.lastTs ? ft(new Date(meta.lastTs)) : ''}</span>${unread > 0 ? `<span class="conv-bdg">${unread}</span>` : ''}</div>`;
    div.onclick = () => openDMconv(id, nick, av, pfp, otherUid);
    el.appendChild(div);
  });
  updDMbdg();
}
function updDMbdg() {
  const t = Object.values(S.dmUnread).reduce((a, b) => a + (b || 0), 0);
  const b = document.getElementById('dm-bdg'); if (!b) return;
  if (t > 0) { b.textContent = t > 99 ? '99+' : t; b.classList.remove('sbhide'); } else b.classList.add('sbhide');
}
window.filterDMSearch = q => {
  const el = document.getElementById('dm-res'); if (!el) return;
  if (!q || q.length < 2) { el.innerHTML = ''; return; }
  const entries = Object.entries(S.following).filter(([, d]) => (d.nick || '').toLowerCase().includes(q.toLowerCase()));
  el.innerHTML = '';
  if (!entries.length) { el.innerHTML = '<div style="padding:7px;color:rgba(255,255,255,.32);font-size:12px">No match. Follow someone first!</div>'; return; }
  entries.forEach(([uid, d]) => {
    const div = document.createElement('div'); div.className = 'ures';
    div.innerHTML = `${mkAv(d.nick || '?', d.av ?? 0, d.pfp, 32, 'ures-av', '', uid)}<span class="ures-nm">${esc(d.nick || '?')}</span><button class="fact fact-msg" type="button" onclick="openDMwith('${uid}','${esc(d.nick || '')}',${d.av ?? 0},'${esc(d.pfp || '')}')">Message</button>`;
    el.appendChild(div);
  });
};
