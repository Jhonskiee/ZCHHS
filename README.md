# ZCHHS — Chong Hua People Class Space

A realtime class-space web app: chat channels, DMs, "My Day" posts/stories,
anonymous confessions, notes, and profiles — built on Firebase Realtime
Database so everything updates live for everyone signed in at once.

## What changed in this upgrade

**1. Everyone can now "see" everyone — not just presence, real profiles.**
Previously, clicking a classmate's name in chat just popped up a tiny toast
with their bio. Now it opens a full **Profile Viewer** (`js/profile.js`):
cover photo, avatar, live online/offline status, bio, post/follower/following
counts, their recent photo/video posts, and Follow/Message buttons — opened
from chat, DMs, comments, "My Day" posts, the Following list, and the online
sidebar. Every avatar in the app also now shows a live green/grey presence
dot (`mkAv(...)` in `js/utils.js`).

**2. Notes are no longer private-only.**
The Notes page now has two realtime tabs: **My Notes** (private, unchanged)
and a new **Community Board** (`js/notes.js`) — post a note there and it
appears instantly for every signed-in classmate, with your name/avatar
attached and a delete button only you can see.

**3. DMs show a live "online now" status** in the conversation header, so a
direct message thread isn't just history — you can see if the other person
is actually there right now.

**4. Every other realtime feature from the original app is preserved**:
channel chat with typing indicators and reactions, "My Day" posts with
comments, 24h stories, anonymous confession letters (with reveal/reply
flows and a downloadable keepsake image), following/followers, and live
notifications.

## Structure

The single 1,900-line `index.html` has been split into a proper,
professional multi-file project:

```
index.html          — markup only
css/style.css        — full stylesheet (original + new profile/notes/presence styles)
js/
  firebase-init.js    — Firebase app/config, single source of truth
  state.js            — shared app state + constants
  utils.js            — escaping, formatting, avatar rendering, toasts
  media.js            — image compression / upload helper
  reactions.js         — shared emoji-reaction system (chat/DM/posts/confessions)
  ui.js               — page router, modals, lightbox, sidebar, shortcuts
  presence.js         — online users, presence dots
  social.js           — follow/unfollow, classmate search
  profile.js          — own profile page + the new Profile Viewer modal
  channels.js         — channel chat (#general etc.)
  dm.js               — direct messages + read/online status
  posts.js            — "My Day" posts + comments
  stories.js           — 24h stories rail + viewer
  confessions.js       — anonymous letters, themes, reveal/reply
  notes.js            — private notes + new Community Board
  notifications.js    — live notification bell
  music.js            — ambient music player
  auth.js             — login/register/forgot/nickname, enterApp/teardown
  main.js             — entry point
```

Each file is an ES module (`type="module"`), so it needs to be served over
HTTP — it won't work opening `index.html` directly via `file://`.

## Deploying to GitHub

```bash
git init
git add .
git commit -m "Upgrade: realtime profiles, community notes, modular structure"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then enable **GitHub Pages** (Settings → Pages → Deploy from branch → `main`
→ `/root`), or deploy to Firebase Hosting / Netlify / Vercel — any static
host works since there's no build step.

## Firebase rules note

The Community Board writes to a new `communityNotes` path and the Profile
Viewer reads from `users`, `posts`, `followers`, and `following`. If your
Realtime Database rules currently restrict reads/writes to per-uid paths
only, add a rule allowing authenticated reads/writes on `communityNotes`
(mirroring how `posts` and `confessions` are already configured).
