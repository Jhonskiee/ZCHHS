/* ============================================================
   stories.js
   --------------------------------------------------------------
   Ephemeral 24-hour story rail shown at the top of "My Day",
   plus the full-screen story viewer with animated progress bars.
   ============================================================ */

import { S, AVC } from './state.js';
import { db, ref, push, onValue } from './firebase-init.js';
import { esc, toast, setL } from './utils.js';
import { upFile } from './media.js';

export function subStories() {
  if (!S.user) return;
  const cutoff = Date.now() - 86400000;
  S.unsubStories = onValue(ref(db, 'stories'), snap => {
    const groups = {};
    snap.forEach(uSnap => {
      uSnap.forEach(sSnap => {
        const d = { id: sSnap.key, ...sSnap.val() };
        if (d.ts && d.ts > cutoff) {
          if (!groups[uSnap.key]) groups[uSnap.key] = { uid: uSnap.key, nick: d.nick, av: d.av ?? 0, pfp: d.pfp || null, stories: [] };
          groups[uSnap.key].stories.push(d);
        }
      });
    });
    S.storyGroups = Object.values(groups);
    renderStories();
  });
}

function renderStories() {
  const el = document.getElementById('srow'); if (!el) return;
  el.innerHTML = '';
  const add = document.createElement('div'); add.className = 'sc sc-add';
  add.innerHTML = '<div class="sc-add-ico">➕</div><div class="sc-add-txt">Add to<br/>My Day</div>';
  add.onclick = () => window.openModal('mod-story');
  el.appendChild(add);
  S.storyGroups.forEach((g, gi) => {
    const first = g.stories[0];
    const card = document.createElement('div'); card.className = 'sc';
    card.innerHTML = `${first.imgUrl ? (first.mediaType === 'video' ? `<video src="${esc(first.imgUrl)}" muted playsinline style="width:100%;height:100%;object-fit:cover"></video>` : `<img src="${esc(first.imgUrl)}" style="width:100%;height:100%;object-fit:cover" loading="lazy"/>`) : `<div style="width:100%;height:100%;background:linear-gradient(135deg,${AVC[g.av % AVC.length]},#312e81);display:flex;align-items:center;justify-content:center;font-size:24px">${esc((g.nick || '?').charAt(0).toUpperCase())}</div>`}
      <div class="sc-ovr"><div class="sc-uav">${g.pfp ? `<img src="${esc(g.pfp)}" loading="lazy"/>` : `<span style="font-size:9px;font-weight:800;background:${AVC[g.av % AVC.length]};width:100%;height:100%;display:flex;align-items:center;justify-content:center">${esc((g.nick || '?').charAt(0).toUpperCase())}</span>`}</div><div class="sc-nm">${esc(g.nick || '?')}</div></div>`;
    card.onclick = () => window.openStory(gi);
    el.appendChild(card);
  });
}

window.openStory = idx => {
  S.svIdx = idx; S.svSlide = 0; renderSV();
  document.getElementById('sv').classList.add('on');
};
window.closeStory = () => {
  document.getElementById('sv').classList.remove('on');
  document.getElementById('sv-vid').pause?.();
};
function renderSV() {
  const g = S.storyGroups[S.svIdx]; if (!g) return;
  const s = g.stories[S.svSlide]; if (!s) return;
  const img = document.getElementById('sv-img'), vid = document.getElementById('sv-vid');
  img.style.display = 'none'; vid.style.display = 'none'; vid.pause?.();
  if (s.imgUrl) {
    if (s.mediaType === 'video') { vid.src = s.imgUrl; vid.style.display = 'block'; vid.play?.(); }
    else { img.src = s.imgUrl; img.style.display = 'block'; }
  }
  document.getElementById('sv-av-img').src = g.pfp || '';
  document.getElementById('sv-nm').textContent = g.nick || '?';
  document.getElementById('sv-cap').textContent = s.caption || '';
  const bars = document.getElementById('sv-bars'); bars.innerHTML = '';
  g.stories.forEach((_, i) => {
    const bar = document.createElement('div'); bar.className = 'sv-bar';
    if (i < S.svSlide) bar.innerHTML = '<div class="sv-fill" style="width:100%"></div>';
    else if (i === S.svSlide) bar.innerHTML = '<div class="sv-fill" id="sv-cur-fill"></div>';
    else bar.innerHTML = '<div class="sv-fill" style="width:0%"></div>';
    bars.appendChild(bar);
  });
  const dur = 5000; let start = null; const fill = document.getElementById('sv-cur-fill');
  function animSV(ts) {
    if (!start) start = ts;
    const pct = Math.min(100, (ts - start) / dur * 100);
    if (fill) fill.style.width = pct + '%';
    if (pct < 100 && document.getElementById('sv').classList.contains('on')) requestAnimationFrame(animSV);
    else if (document.getElementById('sv').classList.contains('on')) window.svNext();
  }
  requestAnimationFrame(animSV);
}
window.svNext = () => {
  const g = S.storyGroups[S.svIdx];
  if (S.svSlide < (g?.stories.length || 0) - 1) { S.svSlide++; renderSV(); }
  else if (S.svIdx < S.storyGroups.length - 1) { S.svIdx++; S.svSlide = 0; renderSV(); }
  else window.closeStory();
};
window.svPrev = () => {
  if (S.svSlide > 0) { S.svSlide--; renderSV(); }
  else if (S.svIdx > 0) { S.svIdx--; S.svSlide = 0; renderSV(); }
};
window.previewStory = inp => {
  const f = inp.files[0]; if (!f) return;
  S.storyFile = f;
  const prev = document.getElementById('story-preview');
  if (f.type.startsWith('video')) prev.innerHTML = `<video src="${URL.createObjectURL(f)}" controls style="max-width:100%;border-radius:8px;max-height:140px"></video>`;
  else prev.innerHTML = `<img src="${URL.createObjectURL(f)}" style="max-width:100%;border-radius:8px;max-height:140px;object-fit:cover" alt=""/>`;
};
window.submitStory = async () => {
  if (!S.user) { toast('Please wait, still signing you in…', 'a'); return; }
  const cap = document.getElementById('story-cap').value.trim();
  if (!S.storyFile && !cap) { toast('Add a photo or caption!', 'a'); return; }
  window.setL?.('story-btn', true);
  const data = { nick: S.nick, uid: S.user.uid, av: S.av, pfp: S.pfp || null, caption: cap, ts: Date.now(), imgUrl: null, mediaType: null };
  if (S.storyFile) {
    try {
      const url = await upFile(S.storyFile, `stories/${S.user.uid}/${Date.now()}_${S.storyFile.name}`);
      data.imgUrl = url; data.mediaType = S.storyFile.type.startsWith('video') ? 'video' : 'image';
    } catch (e) { toast('Upload failed', 'r'); window.setL?.('story-btn', false); return; }
  }
  try {
    await push(ref(db, `stories/${S.user.uid}`), data);
    window.closeModal('mod-story');
    S.storyFile = null;
    document.getElementById('story-cap').value = '';
    document.getElementById('story-preview').innerHTML = '';
    toast('Story added! 🌅', 'g');
  } catch (e) { console.error(e); toast('Failed to post story', 'r'); }
  window.setL?.('story-btn', false);
};
