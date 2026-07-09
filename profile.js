/* ============================================================
   profile.js
   --------------------------------------------------------------
   Two things live here:
   1. "My Profile" panel — the signed-in user's own editable page
      (avatar, cover, bio, stats, post grid).
   2. The Profile Viewer modal — opened by calling vProf(uid) from
      ANYWHERE avatars/names appear (chat, DMs, comments, posts,
      following list, online list). This is the centerpiece of
      "make all the pages see others": every name in the app is
      now a door into a real profile card instead of a dead end.
   ============================================================ */

import { S, AVC } from './state.js';
import { db, ref, get, update } from './firebase-init.js';
import { esc, fd, mkAv, setAvEl, toast, isOnline } from './utils.js';
import { upFile } from './media.js';

/* ---------- My Profile (self) ---------- */
export function setProfPage() {
  const avEl = document.getElementById('prof-av');
  if (S.pfp) {
    avEl.innerHTML = `<img src="${esc(S.pfp)}" alt=""/><div class="prof-av-h">📷</div>`;
  } else {
    avEl.style.background = AVC[S.av % AVC.length];
    avEl.innerHTML = `<span style="font-size:24px;font-weight:800">${esc((S.nick || '?').charAt(0).toUpperCase())}</span><div class="prof-av-h">📷</div>`;
  }
  if (S.coverUrl) {
    const ci = document.getElementById('prof-cover-img');
    ci.src = S.coverUrl; ci.style.display = 'block';
  }
  document.getElementById('prof-name').textContent = S.nick || '';
  document.getElementById('prof-email').textContent = S.user?.email || '';
  document.getElementById('prof-bio').value = S.bio || '';
}
window.setProfPage = setProfPage;

window.saveBio = async () => {
  S.bio = document.getElementById('prof-bio').value.trim();
  await update(ref(db, `users/${S.user.uid}`), { bio: S.bio }).catch(console.error);
  toast('Profile saved! ✅', 'g');
};

window.trigAV = () => document.getElementById('av-in').click();
window.trigCV = () => document.getElementById('cv-in').click();

window.uploadAV = async inp => {
  const f = inp.files[0]; if (!f) return;
  inp.value = ''; toast('Uploading…', 'b');
  try {
    const url = await upFile(f, `avatars/${S.user.uid}/${Date.now()}`);
    S.pfp = url;
    await update(ref(db, `users/${S.user.uid}`), { pfp: url });
    setProfPage();
    setAvEl(document.getElementById('me-av'), S.nick, S.av, url);
    setAvEl(document.getElementById('cmp-av'), S.nick, S.av, url);
    if (S.user) update(ref(db, `presence/${S.user.uid}`), { pfp: url }).catch(() => {});
    toast('Profile picture updated! 🎉', 'g');
  } catch (e) { console.error(e); toast('Upload failed. Enable Firebase Storage.', 'r'); }
};

window.uploadCover = async inp => {
  const f = inp.files[0]; if (!f) return;
  inp.value = ''; toast('Uploading…', 'b');
  try {
    const url = await upFile(f, `covers/${S.user.uid}/${Date.now()}`);
    S.coverUrl = url;
    await update(ref(db, `users/${S.user.uid}`), { coverUrl: url });
    const ci = document.getElementById('prof-cover-img');
    ci.src = url; ci.style.display = 'block';
    toast('Cover updated!', 'g');
  } catch (e) { toast('Upload failed', 'r'); }
};

export function renderProfGrid(mp) {
  const grid = document.getElementById('prof-grid');
  if (!grid) return;
  grid.innerHTML = '';
  mp.filter(p => p.imgUrl).forEach(p => {
    const item = document.createElement('div');
    item.className = 'pg-item';
    item.innerHTML = `${p.mediaType === 'video' ? `<video src="${esc(p.imgUrl)}" muted></video>` : `<img src="${esc(p.imgUrl)}" loading="lazy"/>`}<div class="pg-hover">👁</div>`;
    item.onclick = () => window.openLb('img', p.imgUrl);
    grid.appendChild(item);
  });
}

/* ---------- Profile Viewer modal ("see others") ---------- */
window.vProf = async uid => {
  if (!uid) return;
  if (uid === S.user?.uid) { window.swP('profile'); return; }

  const modal = document.getElementById('pv-body');
  document.getElementById('pv-bg').classList.add('on');
  modal.innerHTML = '<div class="pv-loading">Loading profile…</div>';
  document.getElementById('pv-cover').style.backgroundImage = '';

  try {
    const [uSnap, postsSnap, folSnap, ingSnap] = await Promise.all([
      get(ref(db, `users/${uid}`)),
      get(ref(db, 'posts')),
      get(ref(db, `followers/${uid}`)),
      get(ref(db, `following/${uid}`))
    ]);
    if (!uSnap.exists()) { modal.innerHTML = '<div class="pv-empty">This classmate could not be found.</div>'; return; }

    const d = uSnap.val();
    const nick = d.nick || '?', av = d.av ?? 0, pfp = d.pfp || null, bio = d.bio || '', cover = d.coverUrl || null;
    const online = isOnline(uid);
    const followerCount = folSnap.exists() ? Object.keys(folSnap.val() || {}).length : 0;
    const followingCount = ingSnap.exists() ? Object.keys(ingSnap.val() || {}).length : 0;

    const posts = [];
    postsSnap.forEach(c => { const v = c.val(); if (v.uid === uid) posts.unshift({ id: c.key, ...v }); });
    const withMedia = posts.filter(p => p.imgUrl).slice(0, 9);

    const coverEl = document.getElementById('pv-cover');
    coverEl.style.backgroundImage = cover ? `url('${cover}')` : '';

    const isFollowing = !!S.following[uid];

    modal.innerHTML = `
      <div class="pv-avwrap" style="${pfp ? '' : `background:${AVC[av % AVC.length]}`}">
        ${pfp ? `<img src="${esc(pfp)}" alt=""/>` : esc(nick.charAt(0).toUpperCase())}
        <div class="pdot${online ? ' on' : ''}"></div>
      </div>
      <div class="pv-name">${esc(nick)}</div>
      <div class="pv-status${online ? ' on' : ''}">${online ? '🟢 Online now' : 'Offline'}</div>
      ${bio ? `<div class="pv-bio">${esc(bio)}</div>` : '<div class="pv-bio" style="opacity:.5">No bio yet.</div>'}
      <div class="pv-stats">
        <div class="pv-stat"><b>${posts.length}</b><span>Posts</span></div>
        <div class="pv-stat"><b>${followerCount}</b><span>Followers</span></div>
        <div class="pv-stat"><b>${followingCount}</b><span>Following</span></div>
      </div>
      <div class="pv-acts">
        <button class="btn btn-primary" type="button" onclick="openDMwith('${uid}','${esc(nick)}',${av},'${esc(pfp || '')}')">💬 Message</button>
        <button class="btn ${isFollowing ? 'btn-ghost' : 'btn-pink'}" type="button" id="pv-fol-btn" onclick="pvToggleFollow('${uid}','${esc(nick)}',${av},'${esc(pfp || '')}')">${isFollowing ? 'Unfollow' : '➕ Follow'}</button>
      </div>
      <div class="pv-grid-lbl">Recent Posts</div>
      ${withMedia.length
        ? `<div class="pv-grid">${withMedia.map(p => `<div class="pv-grid-item" onclick="openLb('${p.mediaType === 'video' ? 'video' : 'img'}','${esc(p.imgUrl)}')">${p.mediaType === 'video' ? `<video src="${esc(p.imgUrl)}" muted></video>` : `<img src="${esc(p.imgUrl)}" loading="lazy"/>`}</div>`).join('')}</div>`
        : '<div class="pv-empty">No photo/video posts yet.</div>'}
    `;
  } catch (e) {
    console.error(e);
    modal.innerHTML = '<div class="pv-empty">Could not load this profile — check your connection.</div>';
  }
};

window.pvToggleFollow = (uid, nick, av, pfp) => {
  if (S.following[uid]) { window.doUnfol(uid, nick); }
  else { window.doFollow(uid, nick, av, pfp); }
  setTimeout(() => window.vProf(uid), 400);
};

window.closePv = () => document.getElementById('pv-bg').classList.remove('on');
document.getElementById('pv-bg')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) window.closePv();
});
