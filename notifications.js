/* ============================================================
   notifications.js
   --------------------------------------------------------------
   The bell icon dropdown. Every notification (new follower,
   confession received, confession reply/reveal, etc.) is written
   by other modules via push(ref(db,`notifications/${uid}`), ...)
   and shown here the instant it arrives, live, for everyone.
   ============================================================ */

import { S } from './state.js';
import { db, ref, get, update, query, orderByChild, limitToLast, onValue } from './firebase-init.js';
import { esc, ft } from './utils.js';

export function subNotifs() {
  if (!S.user) return;
  S.unsubNotifs = onValue(query(ref(db, `notifications/${S.user.uid}`), orderByChild('ts'), limitToLast(50)), snap => {
    const notifs = []; snap.forEach(c => notifs.unshift({ id: c.key, ...c.val() }));
    renderNotifs(notifs);
  });
}

function renderNotifs(notifs) {
  const list = document.getElementById('notif-list');
  const bdg = document.getElementById('notif-bdg');
  const unread = notifs.filter(n => !n.read).length;
  if (bdg) {
    bdg.textContent = unread > 9 ? '9+' : unread;
    bdg.classList.toggle('hide', unread === 0);
  }
  if (!list) return;
  if (!notifs.length) { list.innerHTML = '<div class="es" style="padding:24px 12px"><div class="es-ico">🔔</div><div class="es-ttl">No notifications yet</div></div>'; return; }
  list.innerHTML = '';
  notifs.forEach(n => {
    const item = document.createElement('div');
    item.className = 'notif-item' + (n.read ? '' : ' unread');
    item.innerHTML = `<div class="notif-ico">${n.icon || '🔔'}</div><div class="notif-body"><div class="notif-txt">${esc(n.text || '')}</div><div class="notif-ts">${n.ts ? ft(new Date(n.ts)) : ''}</div></div>`;
    item.onclick = () => {
      window.markNotifRead(n.id);
      if (n.type === 'follow' && n.fromUid) window.vProf(n.fromUid);
      else if (n.confId) { window.swP('confessions'); setTimeout(() => window.openLetter(n.confId), 250); }
    };
    list.appendChild(item);
  });
}

window.markNotifRead = async id => {
  await update(ref(db, `notifications/${S.user.uid}/${id}`), { read: true }).catch(() => {});
};
window.markAllNotifsRead = async () => {
  document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
  document.getElementById('notif-bdg')?.classList.add('hide');
  try {
    const snap = await get(ref(db, `notifications/${S.user.uid}`));
    const updates = {};
    snap.forEach(c => { if (!c.val().read) updates[`${c.key}/read`] = true; });
    if (Object.keys(updates).length) await update(ref(db, `notifications/${S.user.uid}`), updates);
  } catch (e) { console.error(e); }
};
window.toggleNotifPanel = () => {
  document.getElementById('notif-panel')?.classList.toggle('on');
};
document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  if (panel && panel.classList.contains('on') && !e.target.closest('#notif-panel') && !e.target.closest('#notif-bell')) {
    panel.classList.remove('on');
  }
});
