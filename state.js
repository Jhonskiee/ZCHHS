/* ============================================================
   state.js
   --------------------------------------------------------------
   One shared, mutable state object (S) plus the constant lookup
   tables (avatar colors, emoji palettes, confession themes, etc).
   Every module imports `S` by reference and mutates its
   properties directly — there is exactly one instance app-wide.
   ============================================================ */

export const S = {
  // session / identity
  user: null,
  nick: null,
  av: 0,
  pfp: null,
  bio: '',
  coverUrl: null,

  // chat
  ch: 'general',
  typing: false,
  typTmr: null,
  unsubMsg: null,
  unsubTyp: null,
  buf: {},
  lastSnd: {},
  unread: { general: 0, random: 0, memories: 0, introductions: 0 },
  openEp: null,
  pendFile: null,

  // presence
  unsubPres: null,
  online: {},

  // following / social graph
  following: {},
  unsubFol: null,

  // direct messages
  unsubDMs: {},
  unsubDML: null,
  curDMid: null,
  curDMnick: null,
  curDMav: 0,
  curDMpfp: null,
  curDMuid: null,
  dmUnread: {},
  dmPend: null,

  // posts / "My Day"
  unsubPosts: null,
  postFile: null,

  // stories
  unsubStories: null,
  storyGroups: [],
  svIdx: 0,
  svSlide: 0,
  storyFile: null,

  // confessions
  unsubConf: null,
  confToUid: null,
  confToNick: null,
  confTheme: 0,
  confSeal: 0,
  confTab: 'all',
  confAll: [],
  confLetters: {},

  // notes
  unsubNotes: null,
  unsubCommunityNotes: null,
  noteClr: 0,
  noteShare: false,
  notesTab: 'mine',
  communityNotes: [],

  // notifications
  unsubNotifs: null,

  // navigation
  panel: 'chat',

  // profile viewer (the "see others" modal)
  pvUid: null
};

/* ---------- Constants ---------- */
export const AVC = ['#1d4ed8', '#dc2626', '#16a34a', '#7c3aed', '#b45309', '#0891b2', '#be185d', '#0f766e', '#92400e', '#1e40af'];
export const NCS = ['#fef08a', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74', '#d8b4fe'];
export const EMJ = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '💯', '✅', '👏', '🙌', '😍', '🤔', '💪', '🎊', '😎', '🤣', '🥳', '💬', '🫶', '✨', '🥰', '😭', '🤩', '🙏', '💀', '👀', '🫂', '🎶'];
export const PRXE = ['👍', '❤️', '😂', '😮', '🎉', '🔥'];
export const CMeta = {
  general: { desc: 'General discussion — say hello! 👋' },
  random: { desc: 'Off-topic, memes, anything 🎲' },
  memories: { desc: 'Share favorite class moments 📸' },
  introductions: { desc: "New here? Introduce yourself! 🙌" }
};
export const BG_COUNT = 12;
export const CONF_THEMES = [
  { id: 0, cls: '', name: 'Classic Cream', bg: 'linear-gradient(160deg,#fdf6ec,#f7e9d7)' },
  { id: 1, cls: 't1', name: 'Sage', bg: 'linear-gradient(160deg,#eef6f0,#e2eee2)' },
  { id: 2, cls: 't2', name: 'Sky', bg: 'linear-gradient(160deg,#eef2fb,#e2e9f7)' },
  { id: 3, cls: 't3', name: 'Blush', bg: 'linear-gradient(160deg,#fbeef2,#f7e2ec)' },
  { id: 4, cls: 't4', name: 'Midnight', bg: 'linear-gradient(160deg,#2b2320,#1c1613)' }
];
export const CONF_SEALS = [
  { id: 0, cls: '', emoji: '💗' },
  { id: 1, cls: 'seal-blue', emoji: '💙' },
  { id: 2, cls: 'seal-green', emoji: '💚' },
  { id: 3, cls: 'seal-gold', emoji: '⭐' },
  { id: 4, cls: 'seal-purple', emoji: '💜' }
];

/* Non-Firebase runtime state that doesn't need to be shared via S */
export const runtime = {
  bgIdx: 0,
  bgTmr: null,
  musPlaying: false,
  mIdx: 0
};
