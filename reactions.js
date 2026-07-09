/* ============================================================
   reactions.js
   --------------------------------------------------------------
   One reaction system reused everywhere a 👍/❤️/😂 chip shows up:
   chat messages, DM messages, "My Day" posts, and confessions.
   ctx tells doRx() which database path to toggle the reaction on:
     'ch'        -> channels/{S.ch}/msgs/{id}/rx/{emoji}
     'dm'        -> dms/{S.curDMid}/msgs/{id}/rx/{emoji}
     'post:{id}' -> posts/{id}/rx/{emoji}
     'conf:{id}' -> confessions/{id}/rx/{emoji}
   ============================================================ */

import { S, EMJ } from './state.js';
import { db, ref, get, set } from './firebase-init.js';
import { esc, lfy } from './utils.js';

export function mkRx(rx, id, ctx) {
  if (!rx || !Object.keys(rx).length) return `<div class="rrow" data-rx="${id}"></div>`;
  const chips = Object.entries(rx).map(([em, uids]) => {
    if (!uids || !uids.length) return '';
    const mine = S.user && uids.includes(S.user.uid);
    return `<button class="rc${mine ? ' mine' : ''}" type="button" onclick="doRx('${id}','${em}','${ctx}')">${em}<span class="rcn">${uids.length}</span></button>`;
  }).join('');
  return `<div class="rrow" data-rx="${id}">${chips}</div>`;
}

window.doRx = async (msgId, emoji, ctx) => {
  if (!S.user) return;
  let path;
  if (ctx === 'ch') path = `channels/${S.ch}/msgs/${msgId}/rx/${emoji}`;
  else if (ctx === 'dm') path = `dms/${S.curDMid}/msgs/${msgId}/rx/${emoji}`;
  else if (ctx.startsWith('post:')) path = `posts/${ctx.slice(5)}/rx/${emoji}`;
  else if (ctx.startsWith('conf:')) path = `confessions/${ctx.slice(5)}/rx/${emoji}`;
  else return;
  const r = ref(db, path);
  try {
    const snap = await get(r);
    const uids = snap.exists() ? (snap.val() || []) : [];
    const i = uids.indexOf(S.user.uid);
    if (i > -1) uids.splice(i, 1); else uids.push(S.user.uid);
    await set(r, uids.length > 0 ? uids : null);
  } catch (e) { console.error(e); }
};

window.togMEp = (id, ctx) => {
  document.querySelectorAll('.ep-pop.on').forEach(e => e.classList.remove('on'));
  if (S.openEp === id) { S.openEp = null; return; }
  S.openEp = id;
  const ep = document.getElementById(`ep${id}`);
  if (!ep) return;
  ep.innerHTML = EMJ.map(e => `<div class="ep-e" onclick="doRx('${id}','${e}','${ctx}');document.getElementById('ep${id}').classList.remove('on');__clearOpenEp()">${e}</div>`).join('');
  ep.classList.add('on');
};
window.__clearOpenEp = () => { S.openEp = null; };

document.addEventListener('click', e => {
  if (!e.target.closest('.mab') && !e.target.closest('.ep-pop')) {
    document.querySelectorAll('.ep-pop.on').forEach(p => p.classList.remove('on'));
    S.openEp = null;
  }
});

/** Patches a reaction row / text bubble in place after a child_changed event. */
export function updateME(id, d, ctx) {
  const rEl = document.querySelector(`[data-rx="${id}"]`);
  if (rEl) {
    const tmp = document.createElement('div');
    tmp.innerHTML = mkRx(d.rx || {}, id, ctx);
    if (tmp.firstElementChild) rEl.replaceWith(tmp.firstElementChild);
  }
  const tEl = document.getElementById(`mt${id}`);
  if (tEl && d.text) tEl.innerHTML = lfy(esc(d.text));
}
