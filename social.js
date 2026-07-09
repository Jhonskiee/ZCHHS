/* ============================================================
   social.js
   --------------------------------------------------------------
   Follow / unfollow, the classmate directory search used by the
   "Find People" and "New Message" modals, and the reusable
   uid<->nickname lookup used by confessions' tag search.
   ============================================================ */

import { S } from './state.js';
import { db, ref, set, get, remove, push, onValue, serverTimestamp } from './firebase-init.js';
import { mkAv, esc, toast } from './utils.js';

export function subFol() {
  if (!S.user) return;
  S.unsubFol = onValue(ref(db, `following/${S.user.uid}`), snap => {
    S.following = {};
    if (snap.exists()) S.following = snap.val() || {};
    renderFol();
    const el = document.getElementById('prof-following');
    if (el) el.textContent = Object.keys(S.following).length;
  });
  onValue(ref(db, `followers/${S.user.uid}`), snap => {
    const el = document.getElementById('prof-followers');
    if (el) el.textContent = snap.exists() ? Object.keys(snap.val() || {}).length : 0;
  });
}

export function renderFol() {
  const el = document.getElementById('friends-list');
  if (!el) return;
  const entries = Object.entries(S.following);
  if (!entries.length) {
    el.innerHTML = '<div class="es"><div class="es-ico">👥</div><div class="es-ttl">Not following anyone yet</div><div style="font-size:12px">Find classmates to follow!</div></div>';
    return;
  }
  el.innerHTML = '';
  entries.forEach(([uid, d]) => {
    const item = document.createElement('div');
    item.className = 'friend-item';
    item.innerHTML = `${mkAv(d.nick || '?', d.av ?? 0, d.pfp, 34, 'friend-av', '', uid)}
      <div class="friend-info"><div class="friend-nm clickable-nm" onclick="vProf('${uid}')">${esc(d.nick || '?')}</div><div class="friend-sub">Following</div></div>
      <div class="friend-acts">
        <button class="fact fact-msg" type="button" onclick="openDMwith('${uid}','${esc(d.nick || '')}',${d.av ?? 0},'${esc(d.pfp || '')}')">💬</button>
        <button class="fact fact-unf" type="button" onclick="doUnfol('${uid}','${esc(d.nick || '')}')">Unfollow</button>
      </div>`;
    el.appendChild(item);
  });
}
window.renderFol = renderFol;

window.doFollow = async (uid, nick, av, pfp) => {
  if (!S.user || uid === S.user.uid) return;
  await set(ref(db, `following/${S.user.uid}/${uid}`), { nick, av, pfp: pfp || null, since: serverTimestamp() });
  await set(ref(db, `followers/${uid}/${S.user.uid}`), { nick: S.nick, av: S.av, pfp: S.pfp || null, since: serverTimestamp() });
  await push(ref(db, `notifications/${uid}`), { type: 'follow', icon: '💕', text: `${S.nick} started following you!`, fromUid: S.user.uid, fromNick: S.nick, ts: serverTimestamp(), read: false });
  toast(`Now following ${nick}! ✨`, 'g');
};

window.doUnfol = async (uid, nick) => {
  if (!confirm(`Unfollow ${nick}?`)) return;
  await remove(ref(db, `following/${S.user.uid}/${uid}`)).catch(console.error);
  await remove(ref(db, `followers/${uid}/${S.user.uid}`)).catch(console.error);
  toast(`Unfollowed ${nick}`, 'a');
};

window.searchUsers = async q => {
  const el = document.getElementById('find-res');
  if (!el) return;
  el.innerHTML = '<div style="padding:7px;color:rgba(255,255,255,.36);font-size:12px">Loading classmates…</div>';
  try {
    const snap = await get(ref(db, 'users'));
    const res = [];
    snap.forEach(c => {
      if (!S.user || c.key === S.user.uid) return;
      const d = c.val();
      if (!q || !q.trim() || (d.nick || '').toLowerCase().includes(q.toLowerCase())) res.push({ uid: c.key, ...d });
    });
    res.sort((a, b) => (a.nick || '').localeCompare(b.nick || ''));
    if (!res.length) {
      el.innerHTML = '<div style="padding:7px;color:rgba(255,255,255,.32);font-size:12px">No classmates found yet.</div>';
      return;
    }
    el.innerHTML = '';
    res.slice(0, 50).forEach(u => {
      const isF = !!S.following[u.uid];
      const div = document.createElement('div');
      div.className = 'ures';
      div.innerHTML = `${mkAv(u.nick || '?', u.av ?? 0, u.pfp, 32, 'ures-av', '', u.uid)}<span class="ures-nm clickable-nm" onclick="vProf('${u.uid}')">${esc(u.nick || '?')}</span>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `fact ${isF ? 'fact-unf' : 'fact-fol'}`;
      btn.textContent = isF ? 'Unfollow' : 'Follow';
      btn.onclick = () => {
        if (isF) doUnfol(u.uid, u.nick || ''); else doFollow(u.uid, u.nick || '', u.av ?? 0, u.pfp || null);
        setTimeout(() => searchUsers(document.getElementById('find-q').value), 500);
      };
      div.appendChild(btn);
      el.appendChild(div);
    });
  } catch (e) {
    console.error(e);
    el.innerHTML = '<div style="color:#fca5a5;font-size:12px;padding:7px">Couldn\'t load the list — check Firebase Database rules allow reading /users.</div>';
  }
};

/** Look up a user's uid by exact (case-insensitive) nickname match. */
export async function findUidByNick(nick) {
  if (!nick) return null;
  try {
    const snap = await get(ref(db, 'users'));
    let found = null;
    snap.forEach(c => { if ((c.val()?.nick || '').trim().toLowerCase() === nick.trim().toLowerCase()) found = c.key; });
    return found;
  } catch (e) { console.error(e); return null; }
}
