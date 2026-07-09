/* ============================================================
   main.js
   --------------------------------------------------------------
   Entry point loaded by index.html as <script type="module">.
   Importing auth.js pulls in every other feature module through
   its own imports (profile, channels, presence, social, posts,
   stories, dm, confessions, notes, notifications, music) so the
   whole realtime app wires itself up from this single import.
   ============================================================ */

import './ui.js';
import './auth.js';

console.info('%cZCHHS', 'color:#6d5efc;font-weight:800;font-size:14px', '— realtime class space loaded');
