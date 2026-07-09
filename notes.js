/* ============================================================
   notes.js
   --------------------------------------------------------------
   Two boards, one panel:
   - "My Notes" — private sticky notes, only the author sees them
     (unchanged behavior from the original app).
   - "Community Board" (NEW) — a shared realtime board. The
     instant anyone posts here it appears live for every signed-in
     classmate, with author name + avatar (clickable into their
     profile) and a delete button shown only to the note's owner.
   ============================================================ */

import { S, NCS } from './state.js';
import { db, ref, push, remove, query, orderByChild, limitToLast, onValue, serverTimestamp } from './firebase-init.js';
import { esc, fd, mkAv, toast } from './utils.js';

export function subNotes() {
  if (!S.user) return;
  S.unsubNotes = onValue(ref(db, `notes/${S.user.uid}`), snap => {
    const notes = []; snap.forEach(c => notes.unshift({ id: c.key, ...c.val() }));
    renderNotes(notes);
  });
  // NEW: realtime shared board, visible to everyone signed in.
  S.unsubCommunityNotes = onValue(query(ref(db, 'communityNotes'), orderByChild('ts'), limitToLast(150)), snap => {
    const notes = []; snap.forEach(c => notes.unshift({ id: c.key, ...c.val() }));
    S.communityNotes = notes;
    renderCommunityNotes(notes);
    const badge = document.getElementById('notes-community-count');
    if (badge) badge.textContent = notes.length;
  });
}

function renderNotes(notes) {
  const grid = document.getElementById('notes-grid'); if (!grid) return;
  if (!notes.length) { grid.innerHTML = '<div class="es" style="grid-column:1/-1"><div class="es-ico">📝</div><div class="es-ttl">No notes yet</div></div>'; return; }
  grid.innerHTML = '';
  notes.forEach(n => {
    const col = NCS[n.color ?? 0];
    const card = document.createElement('div'); card.className = 'note-card'; card.style.background = col;
    card.innerHTML = `<div class="note-card-txt">${esc(n.text || '')}</div><div class="note-card-foot"><span class="note-card-ts">${n.ts ? fd(new Date(n.ts)) : ''}</span><button class="note-del" type="button" onclick="delNote('${n.id}')" title="Delete">✕</button></div>`;
    grid.appendChild(card);
  });
}

function renderCommunityNotes(notes) {
  const grid = document.getElementById('notes-grid-community'); if (!grid) return;
  if (!notes.length) { grid.innerHTML = '<div class="es" style="grid-column:1/-1"><div class="es-ico">🌍</div><div class="es-ttl">No community notes yet</div><div style="font-size:12px">Be the first to share one — everyone will see it live!</div></div>'; return; }
  grid.innerHTML = '';
  notes.forEach(n => {
    const own = S.user && n.uid === S.user.uid;
    const col = NCS[n.color ?? 0];
    const card = document.createElement('div'); card.className = 'note-card community'; card.style.background = col;
    card.innerHTML = `
      <div class="note-card-author">${mkAv(n.nick || '?', n.av ?? 0, n.pfp, 18, 'note-auth-av', '', n.uid)}<span class="clickable-nm" onclick="vProf('${n.uid}')">${esc(n.nick || '?')}</span></div>
      <div class="note-card-txt">${esc(n.text || '')}</div>
      <div class="note-card-foot"><span class="note-card-ts">${n.ts ? fd(new Date(n.ts)) : ''}</span>${own ? `<button class="note-del" type="button" onclick="delCommunityNote('${n.id}')" title="Remove">✕</button>` : ''}</div>`;
    grid.appendChild(card);
  });
}

/* ---------- Tabs ---------- */
window.setNotesTab = tab => {
  S.notesTab = tab;
  document.getElementById('notes-tab-mine')?.classList.toggle('on', tab === 'mine');
  document.getElementById('notes-tab-community')?.classList.toggle('on', tab === 'community');
  document.getElementById('notes-grid').style.display = tab === 'mine' ? 'grid' : 'none';
  document.getElementById('notes-grid-community').style.display = tab === 'community' ? 'grid' : 'none';
  document.getElementById('note-share-row').style.display = tab === 'community' ? 'flex' : 'none';
  document.getElementById('note-compose').classList.remove('show');
};

/* ---------- Compose ---------- */
window.togNoteC = () => document.getElementById('note-compose').classList.toggle('show');
window.selNC = c => {
  S.noteClr = c;
  document.querySelectorAll('.nc').forEach(el => el.classList.toggle('on', parseInt(el.dataset.c) === c));
};
window.toggleNoteShare = chk => { S.noteShare = !!chk.checked; };

window.saveNote = async () => {
  if (!S.user) { toast('Please wait, still signing you in…', 'a'); return; }
  const text = document.getElementById('note-ta').value.trim();
  if (!text) return;
  try {
    if (S.notesTab === 'community') {
      await push(ref(db, 'communityNotes'), { text, color: S.noteClr, uid: S.user.uid, nick: S.nick, av: S.av, pfp: S.pfp || null, ts: serverTimestamp() });
      toast('Shared to the Community Board! 🌍 Everyone can see it now.', 'g');
    } else {
      await push(ref(db, `notes/${S.user.uid}`), { text, color: S.noteClr, ts: Date.now() });
      toast('Note saved! 📝', 'g');
    }
    document.getElementById('note-ta').value = '';
    document.getElementById('note-compose').classList.remove('show');
  } catch (e) { console.error(e); toast('Failed to save note — check Firebase Database rules', 'r'); }
};

window.delNote = async id => {
  await remove(ref(db, `notes/${S.user.uid}/${id}`)).catch(console.error);
  toast('Note deleted', 'a');
};
window.delCommunityNote = async id => {
  if (!confirm('Remove this from the Community Board?')) return;
  await remove(ref(db, `communityNotes/${id}`)).catch(console.error);
  toast('Removed from the board', 'a');
};
