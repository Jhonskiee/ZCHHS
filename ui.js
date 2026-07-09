/* ============================================================
   ui.js
   --------------------------------------------------------------
   The generic "chrome" of the app that isn't tied to any single
   feature: which full-page <div class="page"> is visible, the
   rotating background photography on the auth screens, modal /
   lightbox / sidebar open-close, and global keyboard shortcuts.
   ============================================================ */

import { runtime, BG_COUNT, S, CMeta } from './state.js';
import { clearAlerts, rstBtns } from './utils.js';

/* ---------- Rotating background ---------- */
export function showBg(i) {
  document.querySelectorAll('.bg-layer').forEach((b, j) => b.classList.toggle('active', j === i));
  document.getElementById('chat-overlay').classList.remove('active');
}
export function showChatBg() {
  document.querySelectorAll('.bg-layer').forEach(b => b.classList.remove('active'));
  document.getElementById('chat-overlay').classList.add('active');
}
export function nextBg() {
  runtime.bgIdx = (runtime.bgIdx + 1) % BG_COUNT;
  showBg(runtime.bgIdx);
}
showBg(0);
runtime.bgTmr = setInterval(nextBg, 8000);

/* ---------- Page router ---------- */
window.go = id => {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  clearAlerts(); rstBtns();
  if (id === 'pg-app') {
    showChatBg();
    clearInterval(runtime.bgTmr);
  } else {
    if (!runtime.bgTmr) runtime.bgTmr = setInterval(nextBg, 8000);
    showBg(runtime.bgIdx);
  }
};

/* ---------- Modals ---------- */
window.openModal = id => document.getElementById(id)?.classList.add('on');
window.closeModal = id => document.getElementById(id)?.classList.remove('on');

/* ---------- Lightbox (full-screen image/video viewer) ---------- */
window.openLb = (type, url) => {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lb-img'), vid = document.getElementById('lb-vid');
  img.style.display = 'none'; vid.style.display = 'none'; vid.pause?.();
  if (type === 'video') { vid.src = url; vid.style.display = 'block'; }
  else { img.src = url; img.style.display = 'block'; }
  lb.classList.add('on');
};
window.closeLb = () => {
  document.getElementById('lightbox').classList.remove('on');
  document.getElementById('lb-vid').pause?.();
};
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeLb();
});

/* ---------- Sidebar (mobile) ---------- */
window.openSb = () => {
  document.getElementById('sb').classList.add('open');
  document.getElementById('sb-ov').classList.add('on');
};
window.closeSb = () => {
  document.getElementById('sb').classList.remove('open');
  document.getElementById('sb-ov').classList.remove('on');
};

/* ---------- Chat search (client-side filter of the visible feed) ---------- */
window.doSearch = q => {
  document.querySelectorAll('#chat-feed [data-id]').forEach(el => {
    const txt = el.querySelector('.mtxt')?.textContent?.toLowerCase() || '';
    el.style.display = (!q || txt.includes(q.toLowerCase())) ? '' : 'none';
  });
};

/* ---------- Password field helpers ---------- */
window.tpw = (id, btn) => {
  const i = document.getElementById(id); if (!i) return;
  i.type = i.type === 'password' ? 'text' : 'password';
  btn.textContent = i.type === 'password' ? '👁' : '🙈';
};
window.pwStr = pw => {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const cls = ['', 'w', 'f', 'g', 's'], lbs = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  for (let i = 1; i <= 4; i++) {
    const seg = document.getElementById(`ps${i}`); if (!seg) continue;
    seg.className = 'pws';
    if (i <= s) seg.classList.add(cls[s]);
  }
  const lb = document.getElementById('pwlbl');
  if (lb) lb.textContent = pw.length > 0 ? lbs[s] : '';
};

/* ---------- Panel switching (chat / My Day / DMs / following / confessions / notes / profile) ---------- */
window.swP = p => {
  S.panel = p;
  document.querySelectorAll('.panel').forEach(x => x.classList.remove('on'));
  document.querySelectorAll('.sbi').forEach(x => x.classList.remove('on'));
  document.getElementById(`panel-${p}`)?.classList.add('on');
  document.getElementById(`nav-${p}`)?.classList.add('on');
  const chSec = document.getElementById('ch-sec'), chList = document.getElementById('ch-list');
  if (p === 'chat') { chSec && (chSec.style.display = ''); chList && (chList.style.display = ''); }
  else { chSec && (chSec.style.display = 'none'); chList && (chList.style.display = 'none'); }
  const titles = { chat: '💬 Channels', myday: '🌅 My Day', dm: '✉️ Messages', friends: '👥 Following', confession: '💌 Confessions', notes: '📝 Notes', profile: '👤 Profile' };
  document.getElementById('tb-title').textContent = titles[p] || p;
  document.getElementById('tb-desc').textContent = p === 'chat' ? (CMeta[S.ch]?.desc || '') : '';
  if (window.innerWidth <= 768) closeSb();
  if (p === 'friends') window.renderFol?.();
  if (p === 'profile') window.setProfPage?.();
};

/* ---------- Global keyboard shortcuts ---------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('epin')?.classList.remove('on');
    document.querySelectorAll('.ep-pop.on').forEach(p => p.classList.remove('on'));
    closeSb();
    window.closeStory?.();
    document.getElementById('lightbox').classList.remove('on');
    document.querySelectorAll('.modal-bg').forEach(m => m.classList.remove('on'));
    document.querySelectorAll('.pv-bg').forEach(m => m.classList.remove('on'));
  }
});

export const kb = (id, k, fn) => document.getElementById(id)?.addEventListener('keydown', e => {
  if (e.key === k) { e.preventDefault(); fn(); }
});
