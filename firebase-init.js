/* ============================================================
   firebase-init.js
   --------------------------------------------------------------
   Boots the Firebase app once and re-exports every SDK function
   the rest of the codebase needs. Keeping this in one place means
   the config lives in exactly one file, and every feature module
   just does `import {db, ref, push, ...} from './firebase-init.js'`.
   ============================================================ */

import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  getDatabase,
  ref,
  set,
  get,
  push,
  remove,
  update,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  serverTimestamp,
  off,
  query,
  orderByChild,
  limitToLast,
  onDisconnect as ODC
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

import {
  getStorage,
  ref as sRef,
  uploadBytesResumable,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

/* ---------- Project configuration ---------- */
const firebaseConfig = {
  apiKey: 'AIzaSyBpxlYUntT6flNCjCXUd4fYa6hmSmX2kpA',
  authDomain: 'memecha-c10e2.firebaseapp.com',
  databaseURL: 'https://memecha-c10e2-default-rtdb.firebaseio.com',
  projectId: 'memecha-c10e2',
  storageBucket: 'memecha-c10e2.firebasestorage.app',
  messagingSenderId: '682910602156',
  appId: '1:682910602156:web:9b7fd6beda2aa3e36ae009'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

/* ---------- Re-exported SDK functions ---------- */
export {
  // auth
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  // database
  ref,
  set,
  get,
  push,
  remove,
  update,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  serverTimestamp,
  off,
  query,
  orderByChild,
  limitToLast,
  ODC,
  // storage
  sRef,
  uploadBytesResumable,
  getDownloadURL
};
