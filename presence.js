/* ============================================================
   presence.js
   --------------------------------------------------------------
   Publishes our own presence row and listens to everyone else's,
   powering: the "N online" pill, the Online sidebar list, and the
   presence dot shown on every avatar app-wide (see utils.mkAv).
   The online list is clickable — tapping a classmate opens their
   profile viewer (profile.js) so "who's here" always leads
   somewhere real.
   ============================================================ */

import { S } from './state.js';
import { db, ref, set, onValue, ODC } from './firebase-init.js';
import { mkAv, esc } from './utils.js';

export function subPres() {
  if (!S.user) return;
  const mr = ref(db, `presence/${S.user.uid}`);
  set(mr, { nick: S.nick, av: S.av, pfp: S.pfp || null, uid: S.user.uid, ts: Date.now() }).catch(console.error);
  ODC(mr).remove().catch(console.error);
  S.unsubPres = onValue(ref(db, 'presence'), snap => {
    S.online = {};
    snap.forEach(c => { S.online[c.key] = c.val(); });
    renderOnline();
  });
}

function renderOnline() {
  const list = document.getElementById('online-list');
  const pill = document.getElementById('tb-online');
  if (pill) pill.textContent = `${Object.keys(S.online).length} online`;
  if (!list) return;
  list.innerHTML = '';
  Object.entries(S.online).forEach(([uid, d]) => {
    const isMe = uid === S.user?.uid;
    const el = document.createElement('div');
    el.className = 'oitem';
    el.innerHTML = `${mkAv(d.nick || '?', d.av ?? 0, d.pfp, 22, 'oav')}<span>${esc(d.nick || '?')}${isMe ? ' (you)' : ''}</span>`;
    if (!isMe) el.onclick = () => window.vProf(uid);
    list.appendChild(el);
  });
}
