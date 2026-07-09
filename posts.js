/* ============================================================
   posts.js
   --------------------------------------------------------------
   The "My Day" feed: text/photo/video posts visible to the whole
   class, with comments and quick reactions. Author name/avatar on
   every post and comment opens the profile viewer (vProf).
   ============================================================ */

import { S, PRXE } from './state.js';
import { db, ref, push, remove, query, orderByChild, limitToLast, onValue, serverTimestamp } from './firebase-init.js';
import { esc, lfy, fd, mkAv, toast } from './utils.js';
import { mkRx } from './reactions.js';
import { upFile } from './media.js';
import { renderProfGrid } from './profile.js';

export function subPosts() {
  if (!S.user) return;
  S.unsubPosts = onValue(query(ref(db, 'posts'), orderByChild('ts'), limitToLast(50)), snap => {
    const posts = []; snap.forEach(c => posts.unshift({ id: c.key, ...c.val() }));
    renderPosts(posts);
  });
}

function renderPosts(posts) {
  const el = document.getElementById('posts-list'); if (!el) return;
  if (!posts.length) { el.innerHTML = '<div class="es"><div class="es-ico">🌅</div><div class="es-ttl">No posts yet</div></div>'; return; }
  el.innerHTML = ''; posts.forEach(p => el.appendChild(buildPost(p)));
  const pEl = document.getElementById('prof-posts');
  if (pEl) pEl.textContent = posts.filter(p => p.uid === S.user.uid).length;
  renderProfGrid(posts.filter(p => p.uid === S.user.uid));
}

function buildPost(p) {
  const own = p.uid === S.user.uid;
  const div = document.createElement('div'); div.className = 'post-card'; div.id = `post-${p.id}`;
  const rx = p.rx || {};
  const rxH = PRXE.map(e => {
    const uids = rx[e] || []; const mine = S.user && uids.includes(S.user.uid); const cnt = uids.length;
    return `<button class="prc${mine ? ' mine' : ''}" type="button" onclick="doRx('${p.id}','${e}','post:${p.id}')">${e}${cnt > 0 ? `<span style="font-size:10px;margin-left:2px;color:rgba(255,255,255,.42)">${cnt}</span>` : ''}</button>`;
  }).join('');
  const cmtId = 'cmt-' + p.id;
  div.innerHTML = `
    <div class="post-head">${mkAv(p.nick || '?', p.av ?? 0, p.pfp, 34, 'post-av', '', p.uid)}
      <div class="post-meta"><div class="post-author clickable-nm" onclick="vProf('${p.uid}')">${esc(p.nick || '?')}</div><div class="post-time">${p.ts ? fd(new Date(p.ts)) : ''}</div></div>
      ${own ? `<button class="post-del" type="button" onclick="delPost('${p.id}')" title="Delete">🗑</button>` : ''}
    </div>
    <div class="post-body">
      ${p.text ? `<div class="post-txt">${lfy(esc(p.text))}</div>` : ''}
      ${p.imgUrl ? `<div class="post-mwrap">${p.mediaType === 'video' ? `<video src="${esc(p.imgUrl)}" controls playsinline></video>` : `<img src="${esc(p.imgUrl)}" loading="lazy" onclick="openLb('img','${esc(p.imgUrl)}')" alt=""/>`}</div>` : ''}
    </div>
    <div class="post-rxbar">${rxH}</div>
    <div class="cmt-sec">
      <div class="cmt-lbl">Comments</div>
      <div id="${cmtId}"></div>
      <div class="cmt-input-row">
        <input class="cmt-input" id="ci-${p.id}" placeholder="Add a comment…" onkeydown="if(event.key==='Enter'){event.preventDefault();subCmt('${p.id}')}"/>
        <button class="cmt-send" type="button" onclick="subCmt('${p.id}')">Send</button>
      </div>
    </div>`;
  subCmts(p.id, cmtId);
  return div;
}

function subCmts(postId, cId) {
  onValue(query(ref(db, `comments/${postId}`), orderByChild('ts'), limitToLast(30)), snap => {
    const el = document.getElementById(cId); if (!el) return;
    el.innerHTML = '';
    snap.forEach(c => {
      const d = c.val();
      const item = document.createElement('div'); item.className = 'cmt-item';
      item.innerHTML = `${mkAv(d.nick || '?', d.av ?? 0, d.pfp, 24, 'cmt-av', '', d.uid)}<div class="cmt-bub"><div class="cmt-author clickable-nm" onclick="vProf('${d.uid}')">${esc(d.nick || '?')}</div><div class="cmt-txt">${lfy(esc(d.text || ''))}</div></div>`;
      el.appendChild(item);
    });
  });
}
window.subCmt = async postId => {
  const inp = document.getElementById(`ci-${postId}`); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  inp.value = '';
  try { await push(ref(db, `comments/${postId}`), { text, nick: S.nick, uid: S.user.uid, av: S.av, pfp: S.pfp || null, ts: serverTimestamp() }); }
  catch (e) { console.error(e); }
};

window.submitPost = async () => {
  if (!S.user) { toast('Please wait, still signing you in…', 'a'); return; }
  const text = document.getElementById('post-ta').value.trim();
  if (!text && !S.postFile) { toast('Write something or add a photo!', 'a'); return; }
  toast('Posting…', 'b');
  const data = { text: text || '', nick: S.nick, uid: S.user.uid, av: S.av, pfp: S.pfp || null, ts: serverTimestamp(), rx: null };
  if (S.postFile) {
    try {
      const url = await upFile(S.postFile, `posts/${S.user.uid}/${Date.now()}_${S.postFile.name}`);
      data.imgUrl = url; data.mediaType = S.postFile.type.startsWith('video') ? 'video' : 'image';
    } catch (e) { console.error(e); toast('Photo upload failed — check Firebase Storage rules', 'r'); return; }
  }
  try {
    await push(ref(db, 'posts'), data);
    document.getElementById('post-ta').value = '';
    document.getElementById('post-file-lbl').textContent = '';
    S.postFile = null;
    toast('Posted! 🎉', 'g');
  } catch (e) { console.error(e); toast('Post failed — check Firebase Database rules for /posts', 'r'); }
};
window.prevPost = inp => {
  const f = inp.files[0]; if (!f) return;
  S.postFile = f;
  document.getElementById('post-file-lbl').textContent = `📎 ${f.name.slice(0, 16)}`;
};
window.delPost = async id => {
  if (!confirm('Delete this post?')) return;
  await remove(ref(db, `posts/${id}`)).catch(console.error);
  toast('Post deleted', 'a');
};
