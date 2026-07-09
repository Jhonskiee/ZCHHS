/* ============================================================
   music.js
   --------------------------------------------------------------
   The mini music bar shown at the bottom of the chat screen:
   track list, play/pause, prev/next, seek, and volume. Purely
   local playback state — not part of the realtime data model.
   ============================================================ */

import { runtime } from './state.js';
import { fmtT } from './utils.js';

const MUSICLIST = [
  { title: 'Nocturne Op. 9 No. 2', artist: 'Chopin — romantic piano for study nights', src: 'https://archive.org/download/FredericChopinNocturneNo.2InEFlatMajorOp.9No.2FromBlueLagoon/Frederic%20Chopin%20-%20Nocturne%20No.%202%20In%20E%20Flat%20Major%20Op.9%20No.2%20%28From%20Blue%20Lagoon%29.ogg' },
  { title: 'Soft Focus', artist: 'gentle piano for studying together', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: 'Quiet Moments', artist: 'warm ambience for late-night thoughts', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3' },
  { title: 'Sweetheart Lo-fi', artist: 'cozy beats for you two', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' }
];

const aud = new Audio();

function loadTrack(i, autoplay) {
  runtime.mIdx = (i + MUSICLIST.length) % MUSICLIST.length;
  const t = MUSICLIST[runtime.mIdx];
  aud.src = t.src;
  document.getElementById('m-title').textContent = t.title;
  document.getElementById('m-artist').textContent = t.artist;
  if (autoplay) aud.play().catch(() => {});
}

export function startMusic() {
  document.getElementById('mbar').classList.remove('hide');
  aud.volume = 0.5;
  loadTrack(runtime.mIdx, false);
  aud.play().then(() => {
    runtime.musPlaying = true;
    document.getElementById('mbar').classList.add('playing');
    document.getElementById('play-btn').textContent = '⏸';
  }).catch(() => {});
  aud.addEventListener('timeupdate', updMP);
  aud.addEventListener('loadedmetadata', () => { document.getElementById('m-dur').textContent = fmtT(aud.duration); });
  aud.addEventListener('ended', () => window.nextTrack());
}
export function stopMusic() {
  aud.pause(); runtime.musPlaying = false;
  document.getElementById('mbar')?.classList.remove('playing');
}
function updMP() {
  if (!aud.duration) return;
  document.getElementById('mpfill').style.width = (aud.currentTime / aud.duration * 100) + '%';
  document.getElementById('m-curr').textContent = fmtT(aud.currentTime);
}

window.toggleMusic = () => {
  if (runtime.musPlaying) {
    aud.pause(); runtime.musPlaying = false;
    document.getElementById('mbar').classList.remove('playing');
    document.getElementById('play-btn').textContent = '▶';
  } else {
    aud.play().then(() => {
      runtime.musPlaying = true;
      document.getElementById('mbar').classList.add('playing');
      document.getElementById('play-btn').textContent = '⏸';
    }).catch(() => window.toast('Click play to start music 🎵', 'a'));
  }
};
window.seekM = e => {
  if (!aud.duration) return;
  const r = e.currentTarget.getBoundingClientRect();
  aud.currentTime = (e.clientX - r.left) / r.width * aud.duration;
};
window.prevTrack = () => {
  loadTrack(runtime.mIdx - 1, runtime.musPlaying);
  if (runtime.musPlaying) { document.getElementById('mbar').classList.add('playing'); document.getElementById('play-btn').textContent = '⏸'; }
};
window.nextTrack = () => {
  loadTrack(runtime.mIdx + 1, runtime.musPlaying);
  if (runtime.musPlaying) { document.getElementById('mbar').classList.add('playing'); document.getElementById('play-btn').textContent = '⏸'; }
};
window.setVol = e => {
  const r = e.currentTarget.getBoundingClientRect();
  const v = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  aud.volume = v;
  document.getElementById('mvfill').style.width = (v * 100) + '%';
};
