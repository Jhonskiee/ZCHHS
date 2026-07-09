/* ============================================================
   auth.js
   --------------------------------------------------------------
   Login/register/forgot-password/nickname screens, the Firebase
   auth-state listener, and enterApp()/teardown() — the two
   functions that turn every other module's realtime subscription
   on and off together. This is the file that makes "all the
   pages see others": the moment enterApp() runs, presence, chat,
   DMs, posts, stories, confessions, notes, and notifications are
   ALL subscribed live at once.
   ============================================================ */

import { S } from './state.js';
import {
  auth, db, ref, set, get, remove, serverTimestamp,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  signOut, onAuthStateChanged, browserLocalPersistence, browserSessionPersistence, setPersistence
} from './firebase-init.js';
import { gv, sh, clr, isEm, setL, ferr, avOf, setAvEl, toast } from './utils.js';
import { setProfPage } from './profile.js';
import { buildEpg, stopTyping } from './channels.js';
import { subPres } from './presence.js';
import { subFol } from './social.js';
import { subPosts } from './posts.js';
import { subStories } from './stories.js';
import { subDML } from './dm.js';
import { subConf } from './confessions.js';
import { subNotes } from './notes.js';
import { subNotifs } from './notifications.js';
import { startMusic, stopMusic } from './music.js';

/* ---------- Auth-state listener ---------- */
onAuthStateChanged(auth, async user => {
  if (user) {
    S.user = user;
    try {
      const snap = await get(ref(db, `users/${user.uid}`));
      if (snap.exists()) {
        const d = snap.val();
        S.nick = d.nick || ''; S.av = d.av ?? avOf(S.nick); S.pfp = d.pfp || null; S.bio = d.bio || ''; S.coverUrl = d.coverUrl || null;
        if (S.nick.length >= 2) { enterApp(); return; }
      }
    } catch (e) { console.error(e); }
    window.go('pg-nick');
  } else {
    S.user = null; S.nick = null; teardown(); window.go('pg-login');
  }
});

/* ---------- Register / Login / Forgot / Nickname / Logout ---------- */
window.doReg = async () => {
  const em = gv('rem2'), pw = gv('rpw'), pw2 = gv('rpw2');
  clr('re'); clr('rs');
  if (!em) return sh('re', 'Email required.');
  if (!isEm(em)) return sh('re', 'Enter a valid email.');
  if (!pw || pw.length < 6) return sh('re', 'Password must be 6+ characters.');
  if (pw !== pw2) return sh('re', 'Passwords do not match.');
  setL('rb', true);
  try { await createUserWithEmailAndPassword(auth, em, pw); sh('rs', 'Account created!'); }
  catch (e) { sh('re', ferr(e.code)); setL('rb', false); }
};
window.doLogin = async () => {
  const em = gv('lem'), pw = gv('lpw');
  const rem = document.getElementById('rem').checked;
  clr('le'); clr('ls');
  if (!em) return sh('le', 'Enter your email.');
  if (!pw) return sh('le', 'Enter your password.');
  setL('lb', true);
  try {
    await setPersistence(auth, rem ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, em, pw);
    sh('ls', 'Welcome back!');
  } catch (e) { sh('le', ferr(e.code)); setL('lb', false); }
};
window.doForgot = async () => {
  const em = gv('fem'); clr('fe'); clr('fs');
  if (!em || !isEm(em)) return sh('fe', 'Enter a valid email.');
  setL('fb', true);
  try {
    await sendPasswordResetEmail(auth, em);
    sh('fs', `Reset link sent to ${em}!`);
    toast('Reset email sent! 📧', 'g');
    document.querySelector('#fb .blbl').textContent = 'Resend';
  } catch (e) { sh('fe', ferr(e.code)); }
  setL('fb', false);
};
window.doNick = async () => {
  const nick = (document.getElementById('nin').value || '').trim();
  clr('ne');
  if (!nick || nick.length < 2) return sh('ne', 'At least 2 characters.');
  if (nick.length > 24) return sh('ne', 'Max 24 characters.');
  setL('nb', true);
  const av = avOf(nick);
  try {
    await set(ref(db, `users/${S.user.uid}`), { nick, av, email: S.user.email || '', pfp: null, bio: '', coverUrl: null, joinedAt: serverTimestamp() });
    S.nick = nick; S.av = av; S.pfp = null; S.bio = ''; S.coverUrl = null;
    enterApp();
  } catch (e) { console.error(e); sh('ne', 'Could not save. Check internet.'); setL('nb', false); }
};
window.doLogout = async () => {
  teardown();
  try { await signOut(auth); } catch (e) {}
  toast('Signed out 👋', 'a');
};

/* ---------- enterApp / teardown: the realtime "everyone sees everyone" switch ---------- */
function enterApp() {
  setAvEl(document.getElementById('me-av'), S.nick, S.av, S.pfp);
  document.getElementById('me-nm').textContent = S.nick;
  setAvEl(document.getElementById('cmp-av'), S.nick, S.av, S.pfp);
  setProfPage();
  window.go('pg-app');
  buildEpg();
  startMusic();
  window.setNotesTab?.('mine');
  subPres();      // who else is online, everywhere, live
  subFol();       // following / followers graph
  window.swCh(S.ch);  // channel chat
  subPosts();     // My Day feed (global)
  subStories();   // 24h stories (global)
  subDML();       // DM conversation list
  subConf();      // confessions (global)
  subNotes();     // private notes + community board (global)
  subNotifs();    // live notifications
}

function teardown() {
  [S.unsubMsg, S.unsubTyp, S.unsubPres, S.unsubPosts, S.unsubStories, S.unsubDML, S.unsubFol, S.unsubConf, S.unsubNotes, S.unsubCommunityNotes, S.unsubNotifs]
    .forEach(fn => typeof fn === 'function' && fn());
  Object.values(S.unsubDMs).forEach(fn => typeof fn === 'function' && fn());
  S.unsubDMs = {};
  stopTyping();
  if (S.user) {
    remove(ref(db, `presence/${S.user.uid}`)).catch(() => {});
    remove(ref(db, `typing/${S.ch}/${S.user.uid}`)).catch(() => {});
  }
  stopMusic();
}
