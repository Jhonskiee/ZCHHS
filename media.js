/* ============================================================
   media.js
   --------------------------------------------------------------
   Images are compressed in the browser and stored as base64
   directly in the Realtime Database (same place as everything
   else). This avoids needing Firebase Storage to be enabled or
   configured with CORS+rules — the #1 cause of "upload succeeds
   but the photo never shows up". Video still goes through
   Firebase Storage since it can't be safely inlined as base64.
   ============================================================ */

import { storage, sRef, uploadBytesResumable, getDownloadURL } from './firebase-init.js';

export async function upFile(file, path) {
  return new Promise((res, rej) => {
    if (!file || !file.type || !file.type.startsWith('image')) {
      if (!storage) { rej(new Error('Only images are supported without Firebase Storage enabled.')); return; }
      const r = sRef(storage, path);
      const task = uploadBytesResumable(r, file);
      task.on('state_changed', null, rej, async () => {
        try { res(await getDownloadURL(task.snapshot.ref)); } catch (e) { rej(e); }
      });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => rej(reader.error);
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => rej(new Error('Could not read image'));
      img.onload = () => {
        const MAX = 1000;
        let { width, height } = img;
        if (width > height && width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        else if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        res(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
