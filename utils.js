/* ============================================================
   utils.js
   --------------------------------------------------------------
   Small stateless (or nearly stateless) helpers used everywhere:
   escaping, date/time formatting, avatar markup, toasts, simple
   form helpers. mkAv() now accepts an optional uid so avatars can
   show a live online/offline presence dot, and an optional
   "clickable" flag so avatars/names can open the profile viewer.
   ============================================================ */

import { S, AVC } from './state.js';

export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function lfy(t) {
  return t.replace(/https?:\/\/[^\s<>"]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}

export function isEm(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function ft(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function fd(d) {
  const t = new Date(), y = new Date(t);
  y.setDate(t.getDate() - 1);
  if (sameDay(d, t)) return 'Today';
  if (sameDay(d, y)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function avOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % AVC.length;
}

export function fmtT(s) {
  s = Math.floor(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Is this uid currently present in the realtime presence map? */
export function isOnline(uid) {
  return !!(uid && S.online && S.online[uid]);
}

/**
 * Build avatar markup. Options:
 *  - size: pixel size (square)
 *  - cls: CSS class for the avatar circle itself
 *  - extra: raw extra attributes string appended to the element
 *  - uid: if given, wraps the avatar with a presence dot + makes
 *    it clickable to open that user's profile viewer
 */
export function mkAv(nick, av, pfp, size, cls, extra, uid) {
  const col = AVC[av % AVC.length];
  const ini = (nick || '?').charAt(0).toUpperCase();
  const st = `width:${size}px;height:${size}px;font-size:${Math.floor(size * .36)}px;background:${col}`;
  const ex = extra || '';
  const inner = pfp
    ? `<div class="${cls || 'oav'}${uid ? ' clickable-av' : ''}" style="${st}" ${ex}><img src="${esc(pfp)}" loading="lazy"/></div>`
    : `<div class="${cls || 'oav'}${uid ? ' clickable-av' : ''}" style="${st}" ${ex}>${esc(ini)}</div>`;
  if (!uid) return inner;
  const dot = `<div class="pdot${isOnline(uid) ? ' on' : ''}"></div>`;
  return `<div class="avwrap" onclick="vProf('${uid}')">${inner}${dot}</div>`;
}

export function setAvEl(el, nick, av, pfp) {
  if (!el) return;
  el.style.background = AVC[av % AVC.length];
  if (pfp) {
    el.innerHTML = `<img src="${esc(pfp)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
  } else {
    el.textContent = (nick || '?').charAt(0).toUpperCase();
  }
}

export function gv(id) {
  return (document.getElementById(id)?.value || '').trim();
}

export function sh(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.am').textContent = msg;
  el.classList.add('show');
}

export function clr(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  const m = el.querySelector('.am');
  if (m) m.textContent = '';
}

export function clearAlerts() {
  document.querySelectorAll('.alrt:not(.ai)').forEach(a => {
    a.classList.remove('show');
    const m = a.querySelector('.am');
    if (m) m.textContent = '';
  });
}

export function setL(id, on) {
  const b = document.getElementById(id);
  if (!b) return;
  b.classList.toggle('ld', on);
  b.disabled = on;
}

export function rstBtns() {
  ['lb', 'rb', 'fb', 'nb'].forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.remove('ld');
    b.disabled = false;
  });
}

export function ferr(c) {
  const m = {
    'auth/email-already-in-use': 'Email already registered.',
    'auth/invalid-email': 'Enter a valid email.',
    'auth/weak-password': 'Password must be 6+ characters.',
    'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment.',
    'auth/network-request-failed': 'Network error.',
    'auth/user-disabled': 'Account disabled.'
  };
  return m[c] || 'Something went wrong. Try again.';
}

export function mkDSep(d) {
  const el = document.createElement('div');
  el.className = 'dsep';
  el.innerHTML = `<div class="dsep-t">${fd(d)}</div>`;
  return el;
}

window.toast = (msg, t) => {
  const w = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="tdot t${t || 'g'}"></div><span>${esc(msg)}</span>`;
  w.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  }, 3800);
};
export const toast = window.toast;
