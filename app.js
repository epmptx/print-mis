
// ── LOGIN & ACCESS CONTROL ────────────────────────────────────────────────────
// USERS: { username: { password, role, name, dept[] } }
// dept: 'all' = full access | array of dept names restricts views
// roles: 'admin' | 'manager' | 'operator'

const USERS = {
  // ── ADMIN ────────────────────────────────────────────────────
  'admin':    { password:'epmp2026', role:'admin',      name:'Charles',  dept:'all' },

  // ── MANAGERS (shared dept login, full access) ─────────────────
  'manager':  { password:'epmp2026', role:'manager',    name:'Manager',  dept:'all' },

  // ── PRODUCTION (shared dept logins) ──────────────────────────
  'prepress': { password:'epmp2026', role:'production', name:'Prepress', dept:'Prepress' },
  'press':    { password:'epmp2026', role:'production', name:'Press',    dept:'Press' },
  'bindery':  { password:'epmp2026', role:'production', name:'Bindery',  dept:'Bindery' },
  'mailing':  { password:'epmp2026', role:'production', name:'Mailing',  dept:'Mailing' },
};

// Dept rules — which opType maps to which dept key
const DEPT_MAP = {
  press:    'Printing',
  folding:  'Folding',
  bindery:  'Binding',
  prepress: 'Prepress'
};

let currentUser = null;

function togglePasswordView() {
  const input = document.getElementById('login_pass');
  const btn   = document.getElementById('pw_toggle');
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  if (btn) btn.textContent = show ? 'HIDE' : 'SHOW';
}

function doLogin() {
  const username = (document.getElementById('login_user').value || '').trim().toLowerCase();
  const password = (document.getElementById('login_pass').value || '');
  const err      = document.getElementById('login_error');
  const user     = USERS[username];

  if (user && user.password === password) {
    // Set current user in memory first — works even if sessionStorage is blocked
    currentUser = { username, ...user };

    // Hide login overlay immediately
    document.getElementById('login_overlay').style.display = 'none';
    err.style.display = 'none';

    // Try to persist session (may fail in Safari with strict privacy settings)
    try {
      sessionStorage.setItem('mis_user', username);
      sessionStorage.setItem('mis_role', user.role);
      sessionStorage.setItem('mis_dept', JSON.stringify(user.dept));
      sessionStorage.setItem('mis_name', user.name);
    } catch(e) {
      // sessionStorage blocked — currentUser is already set in memory above, continue
    }

    applyAccessControl();
    renderActiveJobs();
    toast('Welcome, ' + user.name + ' ✓');
  } else {
    err.style.display = 'block';
    document.getElementById('login_pass').value = '';
    document.getElementById('login_pass').focus();
  }
}

// ── OPERATOR LISTS PER LOGIN ──────────────────────────────────
const LOGIN_OPERATORS = {
  'admin':    null,  // null = show all
  'manager':  null,
  'prepress': ['Aaron G.','Emma M.','Humberto E.','Nate R.'],
  'press':    ['Jose R.','Victor G.','Tony H.',
               'Ismael G.','Carlos V.','Aaron G.','Humberto E.','Nate R.'],
  'bindery':  ['Becky B.','Danny T.','David C.','Gabriela P.','Hector M.',
               'Jonhyel G.','Leo R.','Miriam A.','Patrick E.','Paul A.','Rosa D.','Ruben T.',
               'Carlos V.','Frank A.'],
  'mailing':  ['Becky B.','Danny T.','David C.','Gabriela P.','Hector M.',
               'Jonhyel G.','Leo R.','Miriam A.','Patrick E.','Paul A.','Rosa D.','Ruben T.',
               'Carlos V.','Frank A.'],
};
// Defines exactly which Active Jobs sections each login can see
const DEPT_VISIBILITY = {
  'prepress': ['dept_sched_section','dept_prepress_section','dept_outsource_section'],
  'press':    ['dept_sched_section','dept_prepress_section','dept_press_section'],
  'bindery':  ['dept_press_section','dept_fold_section','dept_bind_section',
               'dept_finish_section','dept_mail_section','dept_fulfill_section','dept_ship_section'],
  'mailing':  ['dept_press_section','dept_fold_section','dept_bind_section',
               'dept_finish_section','dept_mail_section','dept_fulfill_section','dept_ship_section'],
};

const ALL_DEPT_SECTIONS = [
  'dept_sched_section','dept_prepress_section','dept_press_section',
  'dept_fold_section','dept_bind_section','dept_finish_section',
  'dept_outsource_section','dept_mail_section','dept_fulfill_section','dept_ship_section'
];

function applyAccessControl() {
  if (!currentUser) return;
  const dept = currentUser.dept;
  const role = currentUser.role;
  const uname = currentUser.username;

  // Show logged-in user in header
  const userTag = document.getElementById('user_tag');
  if (userTag) userTag.textContent = currentUser.name + ' (' + role + ')';

  // Admin and Manager — see everything, no restrictions
  if (role === 'admin' || role === 'manager') return;

  // ── PRODUCTION LOGIN RESTRICTIONS ────────────────────────────

  // Hide admin-only buttons (Delete, Hard Reset, etc.)
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');

  // Hide nav tabs production users don't need
  document.querySelectorAll('.ntab').forEach(btn => {
    const txt = btn.textContent;
    if (txt.includes('New Job'))   btn.style.display = 'none';
    if (txt.includes('Dashboard')) btn.style.display = 'none';
    if (txt.includes('Archive'))   btn.style.display = 'none';
    if (txt.includes('Reports'))   btn.style.display = 'none';
    if (txt.includes('Job Queue')) btn.style.display = 'none';
  });

  // Show only the dept sections for this login
  const visible = DEPT_VISIBILITY[uname] || [];

  ALL_DEPT_SECTIONS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = visible.includes(id) ? '' : 'none';
  });

  // Filter operator dropdowns to this login's people only
  filterOperatorDropdowns(uname);
}

// Filter both operator dropdowns to show only the current login's operators
function filterOperatorDropdowns(uname) {
  const allowed = LOGIN_OPERATORS[uname]; // null = show all
  ['f_operator','next_op_operator'].forEach(selectId => {
    const sel = document.getElementById(selectId);
    if (!sel) return;

    if (!allowed) {
      // Admin/manager — show all options and groups
      sel.querySelectorAll('option, optgroup').forEach(el => el.style.display = '');
      return;
    }

    // Show only options whose text is in the allowed list
    let hasVisible = false;
    sel.querySelectorAll('option').forEach(opt => {
      if (!opt.value && opt.value === '') return; // keep placeholder
      const show = allowed.includes(opt.textContent.trim());
      opt.style.display = show ? '' : 'none';
      if (show) hasVisible = true;
    });

    // Hide optgroup labels that have no visible children
    sel.querySelectorAll('optgroup').forEach(grp => {
      const anyVisible = [...grp.querySelectorAll('option')].some(o => o.style.display !== 'none');
      grp.style.display = anyVisible ? '' : 'none';
    });
  });
}

function doLogout() {
  if (confirm('Sign out of Print MIS?')) {
    try { sessionStorage.clear(); } catch(e) {}
    currentUser = null;

    // Reset any hidden elements
    document.querySelectorAll('.ntab').forEach(btn => btn.style.display = '');
    ['dept_sched_section','dept_prepress_section','dept_press_section',
     'dept_fold_section','dept_bind_section','dept_finish_section',
     'dept_outsource_section','dept_mail_section','dept_fulfill_section','dept_ship_section'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });

    // Reset operator dropdowns
    ['f_operator','next_op_operator'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) sel.querySelectorAll('option, optgroup').forEach(el => el.style.display = '');
    });
    document.getElementById('login_pass').value = '';
    document.getElementById('login_error').style.display = 'none';
    document.getElementById('login_overlay').style.display = 'flex';
  }
}

function checkLogin() {
  // Already logged in
  if (currentUser) {
    document.getElementById('login_overlay').style.display = 'none';
    applyAccessControl();
    renderActiveJobs();
    return;
  }

  // Find username from any source
  var username = window._misUser || null;
  if (!username) { try { username = sessionStorage.getItem('mis_user'); } catch(e) {} }
  if (!username) { try { username = localStorage.getItem('mis_user_temp'); } catch(e) {} }

  if (username && USERS[username]) {
    currentUser = { username: username, ...USERS[username] };
    document.getElementById('login_overlay').style.display = 'none';

    const userTag = document.getElementById('user_tag');
    if (userTag) userTag.textContent = currentUser.name + ' (' + currentUser.role + ')';

    applyAccessControl();
    renderActiveJobs();
    toast('Welcome, ' + currentUser.name + ' ✓');
  }
}


let cameraStream    = null;
let scanAnimFrame   = null;
let scanTargetField = null;

// Detect mobile (iOS / Android) — use file capture; desktop uses live scanner
const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function openScanner(fieldId, fieldLabel) {
  scanTargetField = fieldId;
  if (isMobileDevice) {
    openMobileScanner(fieldId, fieldLabel);
  } else {
    openLiveScanner(fieldId, fieldLabel);
  }
}

// ── MOBILE: live getUserMedia with autofocus (works iOS 14.3+ over HTTPS) ────
function openMobileScanner(fieldId, fieldLabel) {
  // Try live scanner first — better UX and autofocus
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    openLiveScanner(fieldId, fieldLabel);
  } else {
    // Hard fallback for very old browsers — file input
    openFileInputScanner(fieldId, fieldLabel);
  }
}

// File input fallback (old browsers only)
function openFileInputScanner(fieldId, fieldLabel) {
  const inp = document.getElementById('ios_qr_input');
  inp.value = '';
  inp.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast('Processing barcode…');
    processWithDecoders(file);
  };
  inp.click();
}

function processWithDecoders(file) {
  // Method 1 — BarcodeDetector (iOS 17+ / Android Chrome native)
  if ('BarcodeDetector' in window) {
    const detector = new BarcodeDetector({
      formats: ['qr_code','code_39','code_128','ean_13','ean_8','data_matrix','pdf417']
    });
    createImageBitmap(file).then(bitmap => {
      detector.detect(bitmap).then(barcodes => {
        if (barcodes.length > 0) { onQRDetected(barcodes[0].rawValue); return; }
        processWithLibraries(file); // fall through
      }).catch(() => processWithLibraries(file));
    }).catch(() => processWithLibraries(file));
    return;
  }
  processWithLibraries(file);
}

function processWithLibraries(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // Scale down large images for reliable decoding
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        const scale = MAX / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // --- Try QR code first with jsQR ---
      if (typeof jsQR === 'function') {
        const imageData = ctx.getImageData(0, 0, w, h);
        let code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
        if (!code) code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
        if (code && code.data) { onQRDetected(code.data); return; }
      }

      // --- Try Code 39 + other 1D barcodes with ZXing ---
      if (typeof ZXing !== 'undefined') {
        const hints = new Map();
        // Support Code39, Code128, EAN, DataMatrix and more
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.QR_CODE,
          ZXing.BarcodeFormat.DATA_MATRIX
        ]);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

        const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
        const binarizer       = new ZXing.HybridBinarizer(luminanceSource);
        const bitmapImage     = new ZXing.BinaryBitmap(binarizer);
        const reader          = new ZXing.MultiFormatReader();
        reader.setHints(hints);
        try {
          const result = reader.decode(bitmapImage);
          if (result && result.getText()) {
            onQRDetected(result.getText()); return;
          }
        } catch (e) { /* no barcode found */ }
      }

      toast('Barcode not found. Hold steady, ensure good lighting, fill the frame.');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ── LIVE SCANNER: getUserMedia with autofocus ────────────────────────────────
function openLiveScanner(fieldId, fieldLabel) {
  scanTargetField = fieldId;
  document.getElementById('scan_field_label').textContent = fieldLabel;
  document.getElementById('scan_overlay').classList.remove('hidden');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera not available on this browser.'); closeScanner(); return;
  }

  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },  // rear camera
      width:      { ideal: 1920 },
      height:     { ideal: 1080 },
      focusMode:  { ideal: 'continuous' },   // continuous autofocus
      zoom:       { ideal: 1 }
    }
  })
  .then(stream => {
    cameraStream = stream;
    const video = document.getElementById('scan_video');
    video.srcObject = stream;

    // Enable continuous autofocus on the camera track if supported
    const track = stream.getVideoTracks()[0];
    if (track && track.getCapabilities) {
      const caps = track.getCapabilities();
      const constraints = {};
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        constraints.advanced = [{ focusMode: 'continuous' }];
      }
      if (caps.zoom) {
        constraints.advanced = constraints.advanced || [];
        constraints.advanced.push({ zoom: 1.0 });
      }
      if (constraints.advanced) {
        track.applyConstraints(constraints).catch(() => {});
      }
    }

    video.play().then(() => startScanLoop());
  })
  .catch(err => {
    let msg = 'Could not access camera.';
    if (err.name === 'NotAllowedError')   msg = 'Camera permission denied.\nGo to Settings → Safari → Camera and set to Allow.';
    if (err.name === 'NotFoundError')     msg = 'No camera found.';
    if (err.name === 'NotSupportedError') msg = 'Camera requires HTTPS. Open via Google Sites link, not a local file.';
    alert(msg);
    closeScanner();
  });
}

function startScanLoop() {
  const video  = document.getElementById('scan_video');
  const canvas = document.getElementById('scan_canvas');
  const ctx    = canvas.getContext('2d');
  function tick() {
    if (!cameraStream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Try jsQR for QR codes
      if (typeof jsQR === 'function') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) { onQRDetected(code.data); return; }
      }

      // Try ZXing for Code 39 and other 1D barcodes
      if (typeof ZXing !== 'undefined') {
        try {
          const hints = new Map();
          hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
            ZXing.BarcodeFormat.CODE_39, ZXing.BarcodeFormat.CODE_128,
            ZXing.BarcodeFormat.QR_CODE, ZXing.BarcodeFormat.EAN_13
          ]);
          hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
          const lum    = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
          const bin    = new ZXing.HybridBinarizer(lum);
          const bitmap = new ZXing.BinaryBitmap(bin);
          const zxReader = new ZXing.MultiFormatReader();
          zxReader.setHints(hints);
          const result = zxReader.decode(bitmap);
          if (result && result.getText()) { onQRDetected(result.getText()); return; }
        } catch(e) { /* no barcode found this frame */ }
      }
    }
    scanAnimFrame = requestAnimationFrame(tick);
  }
  scanAnimFrame = requestAnimationFrame(tick);
}

// ── SHARED: result handler ───────────────────────────────────────────────────
function onQRDetected(value) {
  const field = document.getElementById(scanTargetField);
  if (field) {
    field.value = value;
    field.dispatchEvent(new Event('input',  { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
  const flash = document.createElement('div');
  flash.className = 'scan-success-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 600);
  closeScanner();
  toast('✓ Scanned → ' + value.slice(0, 32) + (value.length > 32 ? '…' : ''));
}

function closeScanner() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  if (scanAnimFrame) { cancelAnimationFrame(scanAnimFrame); scanAnimFrame = null; }
  const video = document.getElementById('scan_video');
  if (video) video.srcObject = null;
  document.getElementById('scan_overlay').classList.add('hidden');
  scanTargetField = null;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbx_UJYE99POTtl0kP7GOqTgLpyPphFqueZowlxoyfQubhKPB78LIkrwPpLG3gmt-a5e0A/exec';

// Returns current local time as datetime-local string (fixes timezone offset bug)
function localNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}

const MACHINES = {
  'Scheduling':          ['Job Intake & Scheduling'],
  'Prepress':            ['Artwork Prep & Proof Approval','Imposition & Plate Making','Database Management'],
  'Press':               ['Heidelberg Press 1','Heidelberg Press 2','Heidelberg Press 3','Shinohara Press 4','Fuji Digital Color','Ricoh 9100','Ricoh 9200','Ricoh 8000','Digital Envelope Printer','Printmaster'],
  'Folding':             ['F1-MBO-B26-1','F2-MBO-B26-2','F3-MBO-B30','F4-STAHL-STA1','F5-STAHL-STA2','F6-STAHL-B14','F7-BAUM-2020','F8-STAHL-B14'],
  'Bindery':             ['Cutting','Die-Cutting','Scoring & Creasing','Collating','Binding','Stitching'],
  'Finishing':           ['Kitting','Shrink-Wrapping','Laminating','UV Coating'],
  'Outsourcing':         [],  // vendor name entered as free text by user
  'Mailing':             ['Inkjet Addressing','Inserting','Sealing & Tabbing'],
  'Fulfillment':         ['Fulfillment Services'],
  'Shipping/Inventory':  ['Out for Delivery','Hold for Inventory']
};

// Departments that use "In Progress" flow (no unit logging, just elapsed time + Complete)
const SIMPLE_DEPTS = ['Prepress', 'Outsourcing', 'Fulfillment', 'Shipping/Inventory'];

// Valid next departments from each handoff dept
const ALL_DEPTS = ['Prepress','Press','Folding','Bindery','Finishing','Outsourcing','Mailing','Fulfillment','Shipping/Inventory'];
const NEXT_OP_DEPTS = {
  'Scheduling':        ALL_DEPTS,
  'Prepress':          ALL_DEPTS,
  'Press':             ALL_DEPTS,
  'Folding':           ALL_DEPTS,
  'Bindery':           ALL_DEPTS,
  'Finishing':         ALL_DEPTS,
  'Outsourcing':       ALL_DEPTS,
  'Mailing':           ALL_DEPTS,
  'Fulfillment':       ['Shipping/Inventory'],
  'Shipping/Inventory': []  // end of line
};

let chartUph = null, chartUnits = null;

// Sets a datetime-local input to current local time
function setNow(id, callback) {
  document.getElementById(id).value = localNow();
  if (callback) callback();
}

// ══════════════════════════════════════════════════════════════
//  DATA LAYER — Google Sheets as shared database
//  Optimistic UI: update in-memory immediately, sync in background
// ══════════════════════════════════════════════════════════════

let _db          = null;   // in-memory job array (null = not yet loaded)
let _memStore    = null;   // localStorage fallback
let _syncQueue   = {};     // jobId → job, pending push to Sheets
let _deleteQueue = new Set(); // job IDs pending delete in Sheets
let _lastSync    = null;   // Date of last successful pull from Sheets
let _syncTimer   = null;

// Read from memory → localStorage fallback
function getData() {
  if (_db !== null) return [..._db];
  try { const r = localStorage.getItem('mis_jobs'); _memStore = JSON.parse(r||'[]'); return [..._memStore]; }
  catch(e) { return _memStore || []; }
}

// Write in-memory + localStorage (does NOT push to Sheets — call saveJob for that)
function _setLocal(jobs) {
  _db = jobs;
  _memStore = jobs;
  try { localStorage.setItem('mis_jobs', JSON.stringify(jobs)); } catch(e) {}
}

// Full setData — local write + queue ALL jobs for sync
function setData(jobs) {
  _setLocal(jobs);
  jobs.forEach(j => { _syncQueue[j.id] = j; });
  _scheduleSyncPush();
}

// Save / update a single job — local + immediate Sheets push
function getJob(id)  { return getData().find(j => j.id === id); }
function saveJob(job) {
  job.lastUpdated = localNow();
  const all = getData();
  const idx = all.findIndex(j => j.id === job.id);
  if (idx >= 0) all[idx] = job; else all.push(job);
  _setLocal(all);
  // Push to Sheets immediately (fire and forget)
  _pushJobToSheets(job);
}

// Push a single job to Sheets
// text/plain avoids CORS preflight (Apps Script can still parse JSON body)
function _pushJobToSheets(job) {
  return fetch(SHEET_URL, {
    method: 'POST',
    body: JSON.stringify({ action:'upsertJob', job }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  }).catch(() => {
    _syncQueue[job.id] = job;
    _scheduleSyncPush();
  });
}

// Debounced batch push for setData calls
function _scheduleSyncPush() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(_flushSyncQueue, 2000);
}

function _flushSyncQueue() {
  const jobs = Object.values(_syncQueue);
  if (!jobs.length) return Promise.resolve();
  _syncQueue = {};
  if (jobs.length === 1) {
    return _pushJobToSheets(jobs[0]);
  }
  return fetch(SHEET_URL, {
    method: 'POST',
    body: JSON.stringify({ action:'batchSave', jobs }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  }).catch(() => {
    // Put back in queue on failure
    jobs.forEach(j => { _syncQueue[j.id] = j; });
  });
}

// ── PULL FROM SHEETS with merge (local newer wins) ────────────
async function loadJobsFromSheets(silent) {
  if (!silent) updateSyncStatus('syncing');

  // Always flush pending writes BEFORE pulling so Sheets is up-to-date
  await _flushSyncQueue();

  try {
    const res  = await fetch(SHEET_URL + '?action=getJobs&ts=' + Date.now());
    const data = await res.json();
    if (data.status === 'ok') {
      const sheetsJobs = data.jobs || [];
      const merged     = _mergeJobs(sheetsJobs);
      _setLocal(merged);
      _lastSync = new Date();
      updateSyncStatus('ok', merged.length);
      // Re-push any local-only jobs that weren't in Sheets
      _scheduleSyncPush();
      return true;
    }
    updateSyncStatus('error');
  } catch(e) {
    updateSyncStatus('offline');
  }
  return false;
}

// Merge Sheets data with local in-memory data
// - Sheets job missing locally → add it (created on another device)
// - Local job missing from Sheets → only keep/re-push if created within last 60s
//   (older jobs not in Sheets = intentionally deleted/cleared, don't resurrect)
const SYNC_GRACE_MS = 60000; // 60 second window for pending uploads

function _mergeJobs(sheetsJobs) {
  const sheetsMap = {};
  sheetsJobs.forEach(j => { sheetsMap[j.id] = j; });

  const localJobs = _db || _memStore || [];
  const localMap  = {};
  localJobs.forEach(j => { localMap[j.id] = j; });

  // Start with Sheets as the base
  const merged = Object.assign({}, sheetsMap);

  Object.values(localMap).forEach(local => {
    if (local.status === 'archived') return;

    const sheets = merged[local.id];

    if (!sheets) {
      // Local job not in Sheets — only keep if created recently
      const created = local.createdAt || local.lastUpdated || 0;
      const ageMs   = Date.now() - new Date(created).getTime();

      if (ageMs < SYNC_GRACE_MS) {
        // Recent enough — probably a pending upload, keep and re-push
        merged[local.id]      = local;
        _syncQueue[local.id]  = local;
      }
      // Else: old job not in Sheets = cleared intentionally, do NOT resurrect

    } else {
      // Both exist — keep whichever has newer lastUpdated
      const lt = new Date(local.lastUpdated  || 0).getTime();
      const st = new Date(sheets.lastUpdated || 0).getTime();
      if (lt > st) merged[local.id] = local;
    }
  });

  return Object.values(merged).filter(j => j.status !== 'archived');
}

// Auto-refresh every 30 seconds
function startAutoSync() {
  setInterval(async () => {
    // First flush any pending writes
    await _flushSyncQueue();
    // Then pull fresh data from Sheets
    const ok = await loadJobsFromSheets(true);
    if (ok) renderActiveJobs();
  }, 30000);
}

// Sync status bar update
function updateSyncStatus(state, count) {
  const el = document.getElementById('sync_status');
  if (!el) return;
  const ts = _lastSync ? _lastSync.toLocaleTimeString() : '—';
  const states = {
    syncing: { color:'#f0a500', icon:'⟳', text:'Syncing…' },
    ok:      { color:'#27ae60', icon:'✓', text:`Synced ${count!=null?count+' jobs':''} · ${ts}` },
    offline: { color:'#e67e22', icon:'⚡', text:`Offline — showing cached data (${ts})` },
    error:   { color:'#e74c3c', icon:'⚠', text:'Sync error — check connection' }
  };
  const s = states[state] || states.offline;
  el.innerHTML = `<span style="color:${s.color};font-weight:700;">${s.icon} ${s.text}</span>`;
}




// ── VIEWS ─────────────────────────────────────────────────────────────────────
function showView(v, el) {
  try {
    document.querySelectorAll('.ntab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    ['active','new','queue','dash','archive','report','help'].forEach(function(n) {
      var elem = document.getElementById('view_'+n);
      if (elem) elem.classList.toggle('hidden', n!==v);
    });
    if (v === 'active')  { try { renderActiveJobs(); } catch(e){ console.error(e); } }
    if (v === 'dash')    { try { renderDashboard();  } catch(e){ console.error(e); } }
    if (v === 'archive') { try { renderArchive();    } catch(e){ console.error(e); } }
    if (v === 'queue')   { try { fetchJobQueue();    } catch(e){ console.error(e); } }
    if (v === 'report')  { try { showReport('job_lookup', document.querySelector('.rpt-tab')); } catch(e){ console.error(e); } }
    if (v === 'help')    { try { showHelp('workflow', document.querySelector('#view_help .rpt-tab')); } catch(e){ console.error(e); } }
  } catch(e) {
    console.error('showView error:', e);
  }
}

// ── FORM ──────────────────────────────────────────────────────────────────────
function onOpChange() {
  const op  = document.getElementById('f_optype').value;
  const sel = document.getElementById('f_machine');
  sel.innerHTML = '<option value="">— Select Operation —</option>';
  if (op && MACHINES[op]) {
    MACHINES[op].forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m; sel.appendChild(o);
    });
  }

  // Show Colors only for Press
  document.getElementById('field_colors').classList.toggle('hidden', op !== 'Press');
  // Show Fold Type only for Folding
  document.getElementById('field_fold').classList.toggle('hidden', op !== 'Folding');
  // Show Scheduling panel only for Scheduling
  document.getElementById('sched_panel').classList.toggle('hidden', op !== 'Scheduling');
  // Show Fulfillment notes only for Fulfillment
  document.getElementById('field_fulfillment_notes').classList.toggle('hidden', op !== 'Fulfillment');
  // Show Shipping function only for Shipping/Inventory
  document.getElementById('field_shipping_func').classList.toggle('hidden', op !== 'Shipping/Inventory');
  // Hide MR start time for Scheduling (uses SCHEDULED button instead)
  document.getElementById('mr_start_panel').classList.toggle('hidden', op === 'Scheduling');
  // Change submit button text for Scheduling
  const btn = document.getElementById('btn_create_job');
  if (op === 'Scheduling') {
    btn.textContent = '📅 Schedule This Job';
    btn.onclick = () => createScheduledJob();
  } else {
    btn.textContent = '✓ Create Job & Start Make Ready';
    btn.onclick = () => createJob();
  }
}

// ── AUTO-FILL FROM EPMP JOB STATUS SHEET ─────────────────────
let _jobLookupTimer = null;

function scheduleJobLookup(val) {
  clearTimeout(_jobLookupTimer);
  const status = document.getElementById('job_lookup_status');
  if (!val || val.trim().length < 3) { if(status) status.textContent = ''; return; }
  if (status) status.textContent = '⏳ Looking up job...';
  _jobLookupTimer = setTimeout(() => lookupJobFromSheet(val.trim()), 800);
}

function lookupJobFromSheet(jobNum) {
  const status = document.getElementById('job_lookup_status');
  fetch(SHEET_URL + '?action=getJob&jobNumber=' + encodeURIComponent(jobNum))
    .then(r => r.json())
    .then(data => {
      if (data.found) {
        autoFillJobForm(data);
        if (status) status.innerHTML = '<span style="color:var(--green);">✓ Auto-filled from EPMP Job Status Sheet</span>';
      } else {
        if (status) status.innerHTML = '<span style="color:var(--muted);">Job not found in sheet — enter details manually</span>';
      }
    })
    .catch(() => {
      if (status) status.innerHTML = '<span style="color:var(--muted);">Sheet unavailable — enter details manually</span>';
    });
}

function autoFillJobForm(data) {
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  set('f_po',           data.poNumber);
  set('f_qty',          data.qty);
  set('f_customer',     data.customer);
  set('f_order_date',   data.entryDate);  // Column F — Order In Date
  set('f_due_date',     data.dueDate);    // Column D — Due Date
  set('f_product_type', data.jobName);
  // Recalculate lead time now that both dates are filled
  calcLeadTimeDisplay();
  toast('✓ Job data loaded from EPMP Job Status Sheet');
}


// ── JOB QUEUE ─────────────────────────────────────────────────
let _queueJobs = []; // cached sheet jobs

function fetchJobQueue() {
  const content = document.getElementById('queue_content');
  const status  = document.getElementById('queue_status');
  content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">⏳ Fetching from Google Sheets...</div>';

  fetch(SHEET_URL + '?action=getAllJobs')
    .then(r => r.json())
    .then(data => {
      if (data.status === 'error') {
        content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red);">⚠ ${data.message}</div>`;
        return;
      }
      _queueJobs = data.jobs || [];
      renderJobQueue(_queueJobs);
      status.innerHTML = `<strong>${_queueJobs.length} jobs</strong> loaded from Job Status Sheet.
        Click <strong>→ Schedule</strong> to open the New Job form pre-filled for that job.`;
    })
    .catch(() => {
      content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Cannot reach Google Sheets — are you on the live site?</div>';
    });
}

function renderJobQueue(jobs) {
  const content = document.getElementById('queue_content');
  const existing = new Set(getData().map(j => (j.jobNumber||'').toLowerCase()));

  if (!jobs.length) {
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">No jobs found in the sheet.</div>';
    return;
  }

  // Search/filter
  const search = (document.getElementById('queue_search_val') || {value:''}).value.toLowerCase();
  // Sort by Order In Date earliest first
  const sorted = [...jobs].sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const filtered = search
    ? sorted.filter(j => [j.jobNumber,j.customer,j.poNumber,j.jobDesc].join(' ').toLowerCase().includes(search))
    : sorted;

  let html = `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
      <input type="text" id="queue_search" placeholder="Filter by client, job #, description..."
        style="flex:1;max-width:380px;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:.82rem;"
        oninput="document.getElementById('queue_search_val') || (function(){var i=document.getElementById('queue_search');i.id='queue_search_val';})(); renderJobQueue(_queueJobs)">
      <span style="font-size:.78rem;color:var(--muted);">${filtered.length} of ${jobs.length} jobs</span>
    </div>
    <div class="rpt-section">
      <table class="rpt-table" style="font-size:.78rem;">
        <thead>
          <tr>
            <th>Order In</th>
            <th>Ticket #</th>
            <th>Client</th>
            <th>PO #</th>
            <th>Due Date</th>
            <th>Lead Time</th>
            <th>Job Name / Part Number</th>
            <th style="text-align:right;">QTY</th>
            <th></th>
          </tr>
        </thead>
        <tbody>`;

  filtered.forEach((j, idx) => {
    const inMIS    = existing.has((j.jobNumber||'').toLowerCase());
    const overdue  = j.dueDate && j.dueDate < localToday();
    const lt       = calcLeadTime(j.date, j.dueDate);
    const ltDays   = j.date && j.dueDate ? Math.round((new Date(j.dueDate)-new Date(j.date))/86400000) : null;
    const ltColor  = ltDays === null ? '' : ltDays <= 1 ? 'color:#e65100;font-weight:700;' : ltDays <= 3 ? 'color:#f57f17;font-weight:700;' : 'color:#1a6e45;';
    html += `<tr style="${inMIS?'opacity:.45;background:#f9f9f9;':''}">
      <td style="font-size:.72rem;white-space:nowrap;">${j.date||'—'}</td>
      <td style="font-weight:700;white-space:nowrap;">${j.jobNumber}</td>
      <td>${j.customer||'—'}</td>
      <td style="font-size:.72rem;">${j.poNumber||'—'}</td>
      <td style="white-space:nowrap;${overdue&&!inMIS?'color:var(--red);font-weight:700;':''};">${j.dueDate||'—'}</td>
      <td style="white-space:nowrap;${ltColor}">${lt||'—'}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${j.jobDesc||''}">${j.jobDesc||'—'}</td>
      <td style="text-align:right;font-family:monospace;">${(j.qty||0).toLocaleString()}</td>
      <td style="white-space:nowrap;">
        ${inMIS
          ? '<span style="font-size:.7rem;color:var(--muted);font-weight:700;">✓ In MIS</span>'
          : `<button class="btn btn-primary btn-sm" onclick="scheduleFromQueue(${idx})" style="padding:5px 12px;font-size:.7rem;">→ Schedule</button>`
        }
      </td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  content.innerHTML = html;

  // Re-attach search input value preservation
  const si = document.getElementById('queue_search');
  if (si && search) si.value = search;
}

function scheduleFromQueue(idx) {
  const search = (document.getElementById('queue_search') || {value:''}).value.toLowerCase();
  const source = search
    ? _queueJobs.filter(j => [j.jobNumber,j.customer,j.poNumber,j.jobDesc].join(' ').toLowerCase().includes(search))
    : _queueJobs;
  const job = source[idx];
  if (!job) return;

  // Check if already in MIS
  const existing = getData().find(j => (j.jobNumber||'').toLowerCase() === (job.jobNumber||'').toLowerCase());
  if (existing) {
    alert('Job ' + job.jobNumber + ' is already in the MIS.\n\nStatus: ' + existing.status + ' — ' + existing.opType);
    return;
  }

  // Switch to New Job tab
  const newTab = document.getElementById('nav_new');
  showView('new', newTab);

  // Pre-fill form fields
  setTimeout(() => {
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('f_job',          job.jobNumber);
    set('f_po',           job.poNumber);
    set('f_customer',     job.customer);
    set('f_order_date',   job.date);
    set('f_due_date',     job.dueDate);
    set('f_product_type', job.jobDesc);
    set('f_qty',          job.qty || '');
    calcLeadTimeDisplay();

    // Scroll to top of form
    document.getElementById('view_new').scrollTo(0, 0);
    // Focus on operator field so admin can complete the form
    const opEl = document.getElementById('f_operator');
    if (opEl) opEl.focus();

    toast('✓ Job ' + job.jobNumber + ' loaded — select Operator, Department and Machine to schedule');
  }, 100);
}


function openEditModal(jobId) {
  const job = getData().find(j => j.id === jobId);
  if (!job) return;

  document.getElementById('edit_job_info').innerHTML =
    `<strong>Job ${job.jobNumber}</strong> &nbsp;·&nbsp; ${job.customer||''} &nbsp;·&nbsp; ${job.opType}`;

  const deptSel = document.getElementById('edit_dept');
  deptSel.value = job.opType || '';
  onEditDeptChange();

  // Set current values after machines are populated
  setTimeout(() => {
    document.getElementById('edit_machine').value  = job.machine  || '';
    document.getElementById('edit_operator').value = job.operator || '';
  }, 10);

  document.getElementById('edit_due_date').value = job.dueDate || '';

  // Store job id on modal for save
  document.getElementById('edit_job_modal').dataset.jobId = jobId;
  document.getElementById('edit_job_modal').classList.remove('hidden');
}

function onEditDeptChange() {
  const dept = document.getElementById('edit_dept').value;
  const sel  = document.getElementById('edit_machine');
  sel.innerHTML = '<option value="">— Select Operation —</option>';
  if (dept && MACHINES[dept]) {
    MACHINES[dept].forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m; sel.appendChild(o);
    });
  }
}

function saveEditJob() {
  const jobId    = document.getElementById('edit_job_modal').dataset.jobId;
  const dept     = document.getElementById('edit_dept').value;
  const machine  = document.getElementById('edit_machine').value;
  const operator = document.getElementById('edit_operator').value;
  const dueDate  = document.getElementById('edit_due_date').value;

  if (!dept || !machine || !operator) {
    alert('Please select Department, Machine and Operator.'); return;
  }

  const all = getData();
  const job = all.find(j => j.id === jobId);
  if (!job) return;

  job.opType   = dept;
  job.machine  = machine;
  job.operator = operator;
  if (dueDate) job.dueDate = dueDate;

  setData(all);
  closeModal();
  renderActiveJobs();
  toast('✓ Job ' + job.jobNumber + ' updated — ' + machine + ' · ' + operator);
}


function markJobComplete(jobId) {
  if (!confirm('Mark this job as complete?\n\nThe job will remain in Shipping/Inventory until the nightly archive at 11:59 PM.')) return;

  const all = getData();
  const job = all.find(j => j.id === jobId);
  if (!job) return;

  job.status      = 'complete';
  job.completedAt = new Date().toISOString();
  job.lastUpdated = new Date().toISOString();

  saveJob(job);
  renderActiveJobs();
  toast('✓ Job ' + job.jobNumber + ' marked complete — archives tonight at 11:59 PM');
}

// ── REOPEN COMPLETED JOB ─────────────────────────────────────
function reopenJob(jobId) {
  const all = getData();
  const job = all.find(j => j.id === jobId);
  if (!job) return;
  if (!confirm('Reopen Job ' + job.jobNumber + '?\n\nThis will move it back into active production in ' + job.opType + '.')) return;

  if (job.prodStart && !job.prodStop) {
    job.status = 'production';
  } else if (job.mrStart) {
    job.status = 'makeready';
    job.mrStop = '';
  } else {
    job.status = 'scheduled';
  }
  job.invoicedAt = null;
  setData(all);
  renderActiveJobs();
  toast('↩ Job ' + job.jobNumber + ' reopened in ' + job.opType);
}




function deleteJob(jobId) {
  const all = getData();
  const job = all.find(j => j.id === jobId);
  if (!job) return;

  const hasHistory = job.operations && job.operations.length > 0;
  const msg = hasHistory
    ? 'Delete Job ' + job.jobNumber + '?\n\nThis job has ' + job.operations.length + ' completed operation(s).\nThey will be saved to the Production Log before deletion.\n\nThis cannot be undone.'
    : 'Delete Job ' + job.jobNumber + '?\n\nNo completed operations to save. This cannot be undone.';

  if (!confirm(msg)) return;

  // Save completed operations to Google Sheets before deleting
  if (hasHistory) {
    job.operations.forEach(op => {
      fetch(SHEET_URL, {
        method: 'POST',
        body: JSON.stringify({
          date: job.date, jobNumber: job.jobNumber, poNumber: job.poNumber||'',
          operator: op.operator||job.operator, opType: op.dept||job.opType,
          machine: op.op||job.machine, qty: job.qty||0,
          mrStart: op.mrStart||'', mrStop: op.mrStop||'',
          mrHrs: (op.mrHrs||0).toFixed(2),
          prodStart: op.prodStart||'', prodStop: op.prodStop||'',
          netProdHrs: (op.netProdHrs||0).toFixed(2),
          totalUnits: op.totalUnits||0, uph: op.uph||0,
          totalDowntimeHrs: (op.totalDT||0).toFixed(2),
          downtimeReasons: op.downtimeReasons||'',
          note: 'Job deleted from MIS'
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }).catch(() => {});
    });
  }

  // Save current in-progress operation if it has meaningful time
  if (job.mrStart && (job.status === 'makeready' || job.status === 'production')) {
    const start = parseLocalTime(job.mrStart);
    const hrs   = start ? Math.max(0, (new Date() - start) / 3600000) : 0;
    if (hrs > 0.05) {
      fetch(SHEET_URL, {
        method: 'POST',
        body: JSON.stringify({
          date: job.date, jobNumber: job.jobNumber, poNumber: job.poNumber||'',
          operator: job.operator, opType: job.opType, machine: job.machine,
          qty: job.qty||0, mrStart: job.mrStart, mrStop: localNow(),
          mrHrs: hrs.toFixed(2), prodStart: job.prodStart||'', prodStop:'',
          netProdHrs: (job.netProdHrs||0).toFixed(2),
          totalUnits: job.totalUnits||0, uph: job.uph||0,
          totalDowntimeHrs: (job.totalDT||0).toFixed(2),
          downtimeReasons: '', note: 'Job deleted mid-operation'
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }).catch(() => {});
    }
  }

  // Mark archived locally FIRST — prevents Sheets sync from resurrecting it
  job.status = 'archived';
  job.lastUpdated = new Date().toISOString();
  _setLocal(all.map(j => j.id === jobId ? job : j));

  // Tell Sheets to mark it archived too
  fetch(SHEET_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'deleteJob', id: jobId }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  }).catch(() => {
    // Even if Sheets POST fails, the local archived status prevents resurrection
    // on next sync because _mergeJobs ignores archived local jobs
  });

  renderActiveJobs();
  toast('\uD83D\uDDD1 Job ' + job.jobNumber + ' deleted' + (hasHistory ? ' \u2014 operations saved to log' : ''));
}


function completeSimpleOp(jobId) {
  const all = getData();
  const job = all.find(j => j.id === jobId);
  if (!job) return;

  const now   = localNow();
  const start = parseLocalTime(job.mrStart);
  const opHrs = start ? Math.max(0, (new Date() - start) / 3600000) : 0;

  if (!job.operations) job.operations = [];
  job.operations.push({
    dept: job.opType, op: job.machine, operator: job.operator,
    mrStart: job.mrStart||'', mrStop: now, mrHrs: opHrs,
    netProdHrs:0, totalUnits:0, totalDT: job.totalDT||0, completedAt: now
  });

  job.mrStop = now; job.mrHrs = opHrs; job.status = 'awaiting_next';
  setData(all);

  fetch(SHEET_URL, {
    method: 'POST',
    body: JSON.stringify({
      date: job.date, jobNumber: job.jobNumber, poNumber: job.poNumber,
      operator: job.operator, opType: job.opType, machine: job.machine,
      qty: job.qty, mrStart: job.mrStart, mrStop: now,
      mrHrs: opHrs.toFixed(2), prodStart:'', prodStop:'', prodHrs:0,
      netProdHrs:0, totalUnits:0, uph:0,
      totalDowntimeHrs: job.totalDT||0, downtimeReasons:''
    }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  }).catch(() => {});

  renderActiveJobs();
  toast('\u2713 ' + job.opType + ' completed for Job ' + job.jobNumber);
  if (NEXT_OP_DEPTS[job.opType] && NEXT_OP_DEPTS[job.opType].length > 0) {
    setTimeout(() => beginNextOperation(job.id, job.opType), 300);
  }
}



let _nextOpMasterJobId = null;
let _nextOpFromDept    = 'Scheduling';

// Press counts press sheets; all other depts count ordered quantity
function getTargetQty(job) {
  return job.opType === 'Press'
    ? (job.pressSheets || job.qty || 0)
    : (job.qty || 0);
}

// ── ACTIVE JOB LOOKUP ─────────────────────────────────────────
function activeJobLookup(val) {
  val = (val || '').trim();
  if (!val || val.length < 3) return;

  const jobNum = formatJobNumber(val);
  const all    = getData();
  const job    = all.find(j =>
    (j.jobNumber || '').toLowerCase() === jobNum.toLowerCase() &&
    j.status !== 'archived'
  );

  const resultEl = document.getElementById('active_lookup_result');
  const clearEl  = document.getElementById('active_lookup_clear');

  if (!job) {
    resultEl.className = '';
    resultEl.innerHTML = `
      <div style="background:#fff5f5;padding:16px 20px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.4rem;">🔍</span>
        <div>
          <div style="font-weight:700;color:var(--red);">Job ${jobNum} not found in Active Jobs</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px;">Check the job number or look in the Archive tab</div>
        </div>
      </div>`;
    clearEl.style.display = '';
    return;
  }

  const deptColors = {
    'Scheduling':'#2ecc71','Prepress':'#9b59b6','Press':'#e74c3c',
    'Folding':'#f0a500','Bindery':'#00c2a8','Finishing':'#1abc9c',
    'Outsourcing':'#8e44ad','Mailing':'#3498db','Fulfillment':'#e67e22',
    'Shipping/Inventory':'#95a5a6'
  };
  const deptColor = deptColors[job.opType] || '#888';
  const statusLabels = {
    scheduled:'📅 Scheduled', makeready:'⏱ Make Ready',
    production:'📦 In Production', awaiting_next:'✓ Complete — Awaiting Next',
    complete:'✓ Complete'
  };

  resultEl.className = '';
  resultEl.innerHTML = `
    <div style="background:#1a1a2e;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:12px;height:12px;border-radius:50%;background:${deptColor};flex-shrink:0;"></div>
        <div>
          <div style="font-size:1rem;font-weight:800;color:#fff;letter-spacing:.04em;">Job ${job.jobNumber}</div>
          <div style="font-size:.75rem;color:rgba(255,255,255,.55);">${job.customer||''}${job.poNumber?' · PO '+job.poNumber:''}</div>
        </div>
      </div>
      <button onclick="clearActiveJobLookup()" style="background:none;border:none;color:rgba(255,255,255,.4);font-size:1.1rem;cursor:pointer;padding:0 4px;">✕</button>
    </div>
    <div style="background:#fff;padding:14px 20px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
      <div>
        <div style="font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">Department</div>
        <div style="font-size:.95rem;font-weight:700;color:${deptColor};">${job.opType}</div>
      </div>
      <div>
        <div style="font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">Operator</div>
        <div style="font-size:.95rem;font-weight:700;color:var(--text);">${job.operator||'—'}</div>
      </div>
      <div>
        <div style="font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">Machine / Operation</div>
        <div style="font-size:.88rem;color:var(--text);">${job.machine||'—'}</div>
      </div>
      <div>
        <div style="font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">Status</div>
        <div style="font-size:.88rem;font-weight:600;color:var(--text);">${statusLabels[job.status]||job.status}</div>
      </div>
      <div>
        <div style="font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">Due</div>
        <div style="font-size:.88rem;color:${job.dueDate<localToday()?'var(--red)':'var(--text)'};">${job.dueDate||'—'}</div>
      </div>
      <div style="margin-left:auto;">
        <button class="btn btn-primary" onclick="goToJobCard('${job.id}')" style="white-space:nowrap;">
          ➜ Go to Job Card
        </button>
      </div>
    </div>`;

  clearEl.style.display = '';
}

function goToJobCard(jobId) {
  // Find the card element
  const card = document.getElementById('card_' + jobId);
  if (!card) { toast('Card not visible — check department section is not collapsed'); return; }

  // Scroll card into view smoothly
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Expand the card if collapsed
  if (!card.classList.contains('expanded')) {
    card.classList.add('expanded');
  }

  // Flash highlight to draw attention
  card.style.transition = 'box-shadow .2s';
  card.style.boxShadow  = '0 0 0 3px var(--accent)';
  setTimeout(() => { card.style.boxShadow = ''; }, 2000);
}

function clearActiveJobLookup() {
  document.getElementById('active_job_search').value = '';
  const r = document.getElementById('active_lookup_result');
  r.innerHTML = ''; r.className = 'hidden';
  document.getElementById('active_lookup_clear').style.display = 'none';
}


// Always formats as YY-NNNN (e.g. 261234 → 26-1234, 26-1234 stays)
function formatJobNumber(val) {
  if (!val) return val;
  var digits = val.replace(/-/g, '');
  // Only auto-format once we have at least 3 digits (to avoid interfering while typing)
  if (/^\d{3,}$/.test(digits) && digits.length >= 3) {
    return digits.slice(0,2) + '-' + digits.slice(2);
  }
  return val;
}

// ── PRINT PROCESS CHANGE ─────────────────────────────────────
function onPrintProcessChange(radio) {
  const wrap = document.getElementById('vendor_name_wrap');
  if (wrap) wrap.style.display = radio.value === 'Outsource' ? '' : 'none';
  if (radio.value !== 'Outsource') {
    ['f_vendor_name','f_vendor_contact','f_vendor_info'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  }
}

function beginNextOperation(masterJobId, fromDept) {
  _nextOpMasterJobId = masterJobId;
  _nextOpFromDept    = fromDept || 'Scheduling';

  const job = getData().find(j => j.id === masterJobId);
  if (!job) return;

  document.getElementById('next_op_job_info').innerHTML =
    `<strong>Job ${job.jobNumber}</strong> &nbsp;·&nbsp; ${job.customer||''}
     &nbsp;·&nbsp; Qty: ${(job.qty||0).toLocaleString()}
     &nbsp;·&nbsp; Due: ${job.dueDate||'—'}`;

  // Filter available departments based on where we're coming from
  const availableDepts = NEXT_OP_DEPTS[_nextOpFromDept] ||
    ['Prepress','Press','Folding','Bindery','Finishing','Mailing','Fulfillment','Shipping/Inventory'];

  const deptSel = document.getElementById('next_op_dept');
  deptSel.innerHTML = '<option value="">— Select Department —</option>';
  availableDepts.forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d; deptSel.appendChild(o);
  });

  document.getElementById('next_op_operation').innerHTML = '<option value="">— Select Department First —</option>';
  document.getElementById('next_op_operator').value = '';
  document.getElementById('next_op_modal').classList.remove('hidden');
}

function onNextOpDeptChange() {
  const dept   = document.getElementById('next_op_dept').value;
  const sel    = document.getElementById('next_op_operation');
  const vendor = document.getElementById('next_op_vendor');
  const isOutsource = dept === 'Outsourcing';

  // Toggle between dropdown and free-text input
  sel.style.display    = isOutsource ? 'none' : '';
  vendor.style.display = isOutsource ? '' : 'none';
  sel.value = '';

  if (isOutsource) {
    sel.innerHTML = '<option value="">— Enter vendor name above —</option>';

    // Auto-fill vendor name from job record if available
    const job = getData().find(j => j.id === _nextOpMasterJobId);
    if (job && job.vendorName) {
      vendor.value = job.vendorName;
      // Update hidden select so confirmBeginNextOp reads it
      document.getElementById('next_op_operation').value = job.vendorName;
    } else {
      vendor.value = '';
    }

    vendor.focus();
    return;
  }

  vendor.value = '';
  sel.innerHTML = '<option value="">— Select Operation —</option>';
  if (dept && MACHINES[dept]) {
    MACHINES[dept].forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m; sel.appendChild(o);
    });
  }
}

function confirmBeginNextOp() {
  const dept     = document.getElementById('next_op_dept').value;
  const isOutsource = dept === 'Outsourcing';
  const operation = isOutsource
    ? (document.getElementById('next_op_vendor').value || '').trim()
    : document.getElementById('next_op_operation').value;
  const operator  = document.getElementById('next_op_operator').value;

  if (!dept || !operation || !operator) {
    toast(isOutsource
      ? 'Please enter a Vendor name and select an Operator'
      : 'Please select Department, Operation and Operator');
    return;
  }

  const all = getData();
  const job = all.find(j => j.id === _nextOpMasterJobId);
  if (!job) return;

  const now = localNow();

  // Archive current operation into history before moving on
  if (!job.operations) job.operations = [];
  if (job.opType && job.opType !== 'Scheduling') {
    job.operations.push({
      dept      : job.opType,
      op        : job.machine,
      operator  : job.operator,
      mrStart   : job.mrStart   || '',
      mrStop    : job.mrStop    || now,
      mrHrs     : job.mrHrs     || 0,
      prodStart : job.prodStart || '',
      prodStop  : job.prodStop  || '',
      netProdHrs: job.netProdHrs|| job.prodHrs || 0,
      totalUnits: job.totalUnits|| 0,
      uph       : job.uph       || 0,
      totalDT   : job.totalDT   || 0,
      completedAt: now
    });
  }

  // Move job to new department — reset operation tracking fields
  job.opType      = dept;
  job.machine     = operation;
  job.operator    = operator;
  job.status      = 'makeready';
  job.mrStart     = now;
  job.mrStop      = '';
  job.mrHrs       = 0;
  job.prodStart   = '';
  job.prodStop    = '';
  job.prodHrs     = 0;
  job.netProdHrs  = 0;
  job.totalUnits  = 0;
  job.totalDT     = 0;
  job.uph         = 0;
  job.prodLogs    = [];
  job.downtime    = [];
  // Clear any linked job concept
  delete job.masterJobId;

  setData(all);
  // Also clean up any orphaned linked records for this job
  const cleaned = getData().filter(j =>
    !(j.masterJobId === _nextOpMasterJobId)
  );
  setData(cleaned);

  document.getElementById('next_op_modal').classList.add('hidden');
  _nextOpMasterJobId = null;
  renderActiveJobs();
  toast('✓ ' + dept + ' started for Job ' + job.jobNumber + ' — assigned to ' + operator);
}

// ── PAPER TYPE OTHER TOGGLE ───────────────────────────────────
function onPaperTypeChange() {
  const sel   = document.getElementById('f_paper_type_sel');
  const wrap  = document.getElementById('f_paper_type_other_wrap');
  const other = document.getElementById('f_paper_type_other');
  const isOther = sel.value === 'Other';
  wrap.classList.toggle('hidden', !isOther);
  if (isOther) other.focus();
}


// ── PRESS SHEET CALCULATOR ────────────────────────────────────
function calcPressSheets() {
  const qty      = parseInt(document.getElementById('f_qty').value) || 0;
  const upPress  = parseInt(document.getElementById('f_up_on_press').value) || 1;
  const wastePct = parseFloat(document.getElementById('f_waste_pct').value) || 0;
  if (!qty) { toast('Enter Quantity first'); return; }
  const base  = Math.ceil(qty / upPress);
  const waste = Math.ceil(base * (wastePct / 100));
  const total = base + waste;
  document.getElementById('f_calc_press_sheets').value = total;
  document.getElementById('f_press_sheets').value      = total;
  toast('Press sheets: ' + total.toLocaleString() + ' (' + base.toLocaleString() + ' base + ' + waste.toLocaleString() + ' waste)');
}

// ── CREATE SCHEDULED JOB (Scheduling dept) ────────────────────
function createScheduledJob() {
  const operator    = document.getElementById('f_operator').value;
  const jobNumber   = document.getElementById('f_job').value.trim();
  const poNumber    = document.getElementById('f_po').value.trim();
  const customer    = document.getElementById('f_customer').value.trim();
  const orderDate   = document.getElementById('f_order_date').value;
  const dueDate     = document.getElementById('f_due_date').value;
  const jobDesc     = document.getElementById('f_product_type').value.trim();
  const finishedSize= document.getElementById('f_finished_size').value.trim();
  const qty         = parseInt(document.getElementById('f_qty').value) || 0;

  // Material Requisition fields
  const mrProductType = document.getElementById('f_mr_product_type').value;
  const paperTypeSel  = document.getElementById('f_paper_type_sel').value;
  const paperWeight   = paperTypeSel === 'Other'
    ? document.getElementById('f_paper_type_other').value.trim()
    : paperTypeSel;
  const parentSize    = document.getElementById('f_parent_size').value.trim();
  const parentSheets  = parseInt(document.getElementById('f_parent_sheets').value) || 0;
  const pressSize     = document.getElementById('f_press_size').value.trim();
  const pressSheets   = parseInt(document.getElementById('f_press_sheets').value) || 0;
  const pages         = parseInt(document.getElementById('f_pages').value) || 0;
  const sigs          = parseInt(document.getElementById('f_sched_sigs').value) || 0;
  const forms         = parseInt(document.getElementById('f_sched_forms').value) || 0;
  const upOnPress     = parseInt(document.getElementById('f_up_on_press').value) || 0;
  const wastePct      = parseFloat(document.getElementById('f_waste_pct').value) || 0;
  const calcSheets    = parseInt(document.getElementById('f_calc_press_sheets').value) || 0;
  const printProcess  = document.querySelector('input[name="print_process"]:checked')?.value || '';
  const vendorName    = printProcess === 'Outsource' ? (document.getElementById('f_vendor_name')?.value || '').trim() : '';
  const vendorContact = printProcess === 'Outsource' ? (document.getElementById('f_vendor_contact')?.value || '').trim() : '';
  const vendorInfo    = printProcess === 'Outsource' ? (document.getElementById('f_vendor_info')?.value || '').trim() : '';
  const notes         = document.getElementById('f_sched_notes').value.trim();

  if (!operator || !jobNumber) { alert('Operator and Job Number are required.'); return; }

  // Prevent duplicate job numbers
  const existing = getData().find(j => (j.jobNumber || '').toLowerCase() === jobNumber.toLowerCase());
  if (existing) {
    alert('Job ' + jobNumber + ' is already in the MIS system.\n\nCurrent status: ' + existing.status + ' — ' + existing.opType + '\n\nUse the Edit button on the existing card to make changes.');
    return;
  }

  const now      = localNow();
  const leadTime = calcLeadTime(orderDate, dueDate);

  const job = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    date: now.slice(0,10),
    status: 'scheduled',
    scheduledAt: now,
    operator, jobNumber, poNumber, customer,
    orderDate, dueDate, leadTime,
    opType: 'Scheduling',
    machine: 'Job Intake & Scheduling',
    jobDesc, finishedSize, qty,
    mrProductType, paperWeight, parentSize, parentSheets,
    pressSize, pressSheets: calcSheets || pressSheets,
    pages, sigs, forms, upOnPress, wastePct,
    printProcess, vendorName, vendorContact, vendorInfo, notes,
    totalUnits: 0, totalDT: 0, prodLogs: [], downtime: []
  };

  const all = getData();
  all.push(job);
  setData(all);
  resetNewForm();
  showView('active', document.getElementById('nav_active'));
  renderActiveJobs();
  toast('✓ Job ' + jobNumber + ' scheduled' + (leadTime ? ' — ' + leadTime + ' lead time' : '') + '!');
}
// ── MATERIAL REQUISITION ──────────────────────────────────────
function openMR(jobId) {
  const job = getData().find(j => j.id === jobId);
  if (!job) return;
  const today = localToday();
  document.getElementById('mr_preview').innerHTML = `
    <div style="font-family:Arial,sans-serif;">
      <div style="text-align:center;border-bottom:2px solid #1a1a2e;padding-bottom:10px;margin-bottom:14px;">
        <div style="font-size:1.3rem;font-weight:900;color:#1a1a2e;">EPMP</div>
        <div style="font-size:1rem;font-weight:700;letter-spacing:.1em;">MATERIAL REQUISITION</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:.85rem;">
        <tr><td style="padding:6px;font-weight:700;width:45%;border-bottom:1px solid #eee;">Job Number:</td><td style="padding:6px;border-bottom:1px solid #eee;">${job.jobNumber}</td></tr>
        <tr><td style="padding:6px;font-weight:700;border-bottom:1px solid #eee;">Customer:</td><td style="padding:6px;border-bottom:1px solid #eee;">${job.customer||'—'}</td></tr>
        <tr><td style="padding:6px;font-weight:700;border-bottom:1px solid #eee;">Date of Request:</td><td style="padding:6px;border-bottom:1px solid #eee;">${today}</td></tr>
        <tr><td style="padding:6px;font-weight:700;border-bottom:1px solid #eee;">Due Date:</td><td style="padding:6px;border-bottom:1px solid #eee;">${job.dueDate||'—'}</td></tr>
        <tr><td style="padding:6px;font-weight:700;border-bottom:1px solid #eee;">Quantity:</td><td style="padding:6px;border-bottom:1px solid #eee;">${(job.qty||0).toLocaleString()}</td></tr>
        <tr><td style="padding:6px;font-weight:700;border-bottom:1px solid #eee;">Press Sheets Required:</td><td style="padding:6px;border-bottom:1px solid #eee;font-weight:700;color:#e74c3c;">${(job.pressSheets||0).toLocaleString()}</td></tr>
        <tr><td style="padding:6px;font-weight:700;border-bottom:1px solid #eee;">Paper Weight:</td><td style="padding:6px;border-bottom:1px solid #eee;">${job.paperWeight||'—'}</td></tr>
        <tr><td style="padding:6px;font-weight:700;border-bottom:1px solid #eee;">Parent Sheet Size:</td><td style="padding:6px;border-bottom:1px solid #eee;">${job.parentSize||'—'}</td></tr>
        <tr><td style="padding:6px;font-weight:700;border-bottom:1px solid #eee;">Press Sheet Size:</td><td style="padding:6px;border-bottom:1px solid #eee;">${job.pressSize||'—'}</td></tr>
        <tr><td style="padding:6px;font-weight:700;border-bottom:1px solid #eee;">Up on Press:</td><td style="padding:6px;border-bottom:1px solid #eee;">${job.upOnPress||'—'}</td></tr>
        <tr><td style="padding:6px;font-weight:700;border-bottom:1px solid #eee;">Print Process:</td><td style="padding:6px;border-bottom:1px solid #eee;">${job.printProcess||'—'}</td></tr>
        <tr><td style="padding:6px;font-weight:700;">Requested By:</td><td style="padding:6px;">${job.operator}</td></tr>
      </table>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid #eee;font-size:.75rem;color:#888;">
        Warehouse Manager: Please pull material and confirm availability before production begins.
      </div>
    </div>`;
  document.getElementById('mr_modal').classList.remove('hidden');
  document.getElementById('mr_modal').dataset.jobId = jobId;
}

function printMR() {
  const preview = document.getElementById('mr_preview').innerHTML;
  const win = window.open('', '_blank');
  win.document.write('<html><head><title>Material Requisition</title><style>body{font-family:Arial,sans-serif;padding:20px;} @media print{body{padding:0;}}</style></head><body>' + preview + '</body></html>');
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

function saveMRtoDrive() {
  const jobId = document.getElementById('mr_modal').dataset.jobId;
  const job   = getData().find(j => j.id === jobId);
  if (!job) return;

  const btn = event.target;
  btn.textContent = '⏳ Saving...';
  btn.disabled = true;

  fetch(SHEET_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'saveMR', job }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  })
  .then(r => r.json())
  .then(data => {
    if (data.status === 'ok' && data.fileUrl) {
      btn.textContent = '✓ Saved to Drive';
      btn.style.background = '#27ae60';
      // Show link inside the modal
      const preview = document.getElementById('mr_preview');
      const linkDiv = document.createElement('div');
      linkDiv.style.cssText = 'margin-top:12px;padding:10px;background:#e8f8f0;border-radius:6px;font-size:.8rem;';
      linkDiv.innerHTML = '✓ Saved to Drive &nbsp;·&nbsp; <a href="' + data.fileUrl + '" target="_blank" style="color:#1a6e45;font-weight:700;">View PDF ↗</a>';
      preview.appendChild(linkDiv);
    } else {
      btn.textContent = '⚠ Save Failed';
      btn.style.background = '#c0392b';
      toast('Drive save failed: ' + (data.message || 'Unknown error'));
    }
  })
  .catch(() => {
    btn.textContent = '⚠ Unavailable';
    btn.style.background = '#c0392b';
    toast('Could not reach Google Sheets — check your connection');
  });
}

// ── JOB REPORT (pulls from Google Sheets) ─────────────────────
// ── HELP TAB NAV ──────────────────────────────────────────────
function showHelp(type, btn) {
  document.querySelectorAll('#view_help .rpt-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('#view_help .rpt-tab').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('help_' + type);
  if (panel) panel.classList.remove('hidden');
  if (btn) btn.classList.add('active');
}

// ── REPORTS TAB NAV ───────────────────────────────────────────
function showReport(type, btn) {
  document.querySelectorAll('.rpt-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.rpt-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('rpt_' + type).classList.remove('hidden');
  if (btn) btn.classList.add('active');

  // Render appropriate report
  if (type === 'due_today')    renderDueReport('today');
  if (type === 'due_week')     renderDueReport('week');
  if (type === 'by_customer')  renderByCustomer();
  if (type === 'long_mr')      renderLongMR();
  if (type === 'idle_jobs')    renderIdleJobs();
}

// ── JOB LOOKUP ────────────────────────────────────────────────

function loadJobReport() {
  const jobNum = (document.getElementById('report_job_input').value || '').trim();
  if (!jobNum || jobNum.length < 3) return;
  const el = document.getElementById('report_content');

  const all     = getData();
  const matches = all.filter(j =>
    (j.jobNumber || '').toLowerCase() === jobNum.toLowerCase()
  );

  if (!matches.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
      <div style="font-size:1.5rem;">🔍</div>
      <div style="margin-top:8px;">No local data found for <strong>${jobNum}</strong></div>
      <div style="margin-top:12px;">
        <button class="btn btn-secondary btn-sm" onclick="fetchSheetReport('${jobNum}')">Fetch from Google Sheets</button>
      </div>
    </div>`;
    return;
  }

  renderJobReport(jobNum, { rows: matches, source: 'local', job: matches[0] });
}

function fetchSheetReport(jobNum) {
  const el = document.getElementById('report_content');
  el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);">⏳ Fetching from Google Sheets...</div>';
  fetch(SHEET_URL + '?action=jobReport&jobNumber=' + encodeURIComponent(jobNum))
    .then(r => r.json())
    .then(data => {
      if (data.rows && data.rows.length) renderJobReport(jobNum, data);
      else el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted);">No data found in Google Sheets for <strong>${jobNum}</strong></div>`;
    })
    .catch(() => {
      el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--red);">Could not reach Google Sheets — check connection</div>';
    });
}

function renderJobReport(jobNum, data) {
  const el   = document.getElementById('report_content');
  const rows = data.rows || [];
  const job  = data.job || rows[0] || {};

  const deptColors = {
    'Scheduling':'#2ecc71','Prepress':'#9b59b6','Press':'#e74c3c',
    'Folding':'#f0a500','Bindery':'#00c2a8','Finishing':'#1abc9c',
    'Mailing':'#3498db','Fulfillment':'#e67e22','Shipping/Inventory':'#95a5a6'
  };

  // Build operations list — from job.operations[] + current status
  const ops = job.operations || [];
  const currentOp = (job.status && job.status !== 'scheduled')
    ? { dept: job.opType, op: job.machine, operator: job.operator,
        mrHrs: job.mrHrs||0, netProdHrs: job.netProdHrs||0,
        totalUnits: job.totalUnits||0, uph: job.uph||0,
        status: job.status }
    : null;

  const allOps = [...ops, ...(currentOp && job.opType !== 'Scheduling' ? [currentOp] : [])];

  const totalMRHrs   = allOps.reduce((s,o)=>s+(o.mrHrs||0),0);
  const totalProdHrs = allOps.reduce((s,o)=>s+(o.netProdHrs||0),0);
  const totalUnits   = allOps.reduce((s,o)=>s+(o.totalUnits||0),0);

  const schedDate  = job.scheduledAt ? parseLocalTime(job.scheduledAt) : null;
  const elapsed    = schedDate ? Math.floor((new Date()-schedDate)/86400000) : '—';

  let html = `
    <div class="rpt-section" style="margin-bottom:16px;">
      <div style="background:#1a1a2e;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="color:#fff;font-size:1rem;font-weight:800;letter-spacing:.06em;">JOB ${jobNum}</div>
          <div style="color:rgba(255,255,255,.6);font-size:.72rem;">${job.customer||''} ${job.poNumber?'· PO '+job.poNumber:''}</div>
        </div>
        <div style="text-align:right;font-size:.75rem;color:rgba(255,255,255,.7);">
          <div>Due: ${job.dueDate||'—'}</div>
          <div>Days Active: ${elapsed}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid var(--border);">
        <div style="padding:10px 14px;border-right:1px solid var(--border);">
          <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;">Qty Ordered</div>
          <div style="font-weight:700;">${(job.qty||0).toLocaleString()}</div>
        </div>
        <div style="padding:10px 14px;border-right:1px solid var(--border);">
          <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;">Press Sheets</div>
          <div style="font-weight:700;">${(job.pressSheets||0).toLocaleString()}</div>
        </div>
        <div style="padding:10px 14px;border-right:1px solid var(--border);">
          <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;">Total MR Hrs</div>
          <div style="font-weight:700;">${totalMRHrs.toFixed(2)}</div>
        </div>
        <div style="padding:10px 14px;">
          <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;">Total Prod Hrs</div>
          <div style="font-weight:700;">${totalProdHrs.toFixed(2)}</div>
        </div>
      </div>
    </div>

    <div class="rpt-section">
      <div class="rpt-section-title">Operations History</div>
      <table class="rpt-table">
        <thead><tr>
          <th>Department</th><th>Operation</th><th>Operator</th>
          <th>MR Hrs</th><th>Prod Hrs</th><th>Units</th><th>U/hr</th><th>Status</th>
        </tr></thead>
        <tbody>`;

  // Scheduling row
  html += `<tr>
    <td><span style="color:#2ecc71;font-weight:700;">●</span> Scheduling</td>
    <td>Job Intake</td>
    <td>${job.operator||'—'}</td>
    <td>—</td><td>—</td><td>—</td><td>—</td>
    <td><span style="color:#2ecc71;font-size:.72rem;font-weight:700;">✓ Done</span></td>
  </tr>`;

  allOps.forEach(op => {
    const color  = deptColors[op.dept]||'#888';
    const isLive = op.status && op.status !== 'complete' && op.status !== 'awaiting_next';
    html += `<tr>
      <td><span style="color:${color};font-weight:700;">●</span> ${op.dept||'—'}</td>
      <td style="font-size:.75rem;">${op.op||op.machine||'—'}</td>
      <td>${op.operator||'—'}</td>
      <td class="mono">${(op.mrHrs||0).toFixed(2)}</td>
      <td class="mono">${(op.netProdHrs||0).toFixed(2)}</td>
      <td class="mono">${(op.totalUnits||0).toLocaleString()}</td>
      <td class="mono">${op.uph||'—'}</td>
      <td><span style="color:${isLive?'var(--accent)':'#2ecc71'};font-size:.72rem;font-weight:700;">${isLive?'🔵 Active':'✓ Done'}</span></td>
    </tr>`;
  });

  if (!allOps.length) {
    html += `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">No operations started yet</td></tr>`;
  }

  html += `</tbody>
    <tfoot>
      <tr style="background:#f5f5f5;font-weight:700;">
        <td colspan="3">TOTALS</td>
        <td class="mono">${totalMRHrs.toFixed(2)}</td>
        <td class="mono">${totalProdHrs.toFixed(2)}</td>
        <td class="mono">${totalUnits.toLocaleString()}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
    </table></div>

    ${data.source === 'local' ? `<div style="margin-top:12px;text-align:center;">
      <button class="btn btn-secondary btn-sm" onclick="fetchSheetReport('${jobNum}')">
        🔄 Also fetch completed operations from Google Sheets
      </button>
    </div>` : ''}`;

  el.innerHTML = html;
}

// ── DUE TODAY / THIS WEEK ─────────────────────────────────────
function renderDueReport(range) {
  const id  = range === 'today' ? 'rpt_due_today_content' : 'rpt_due_week_content';
  const el  = document.getElementById(id);
  const all = getData().filter(j => j.dueDate && j.status !== 'archived');
  const today   = localToday();
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekStr = weekEnd.toISOString().slice(0,10);

  const filtered = all.filter(j => {
    if (range === 'today') return j.dueDate === today;
    return j.dueDate >= today && j.dueDate <= weekStr;
  }).sort((a,b) => a.dueDate.localeCompare(b.dueDate));

  if (!filtered.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">No jobs due ${range === 'today' ? 'today' : 'this week'}</div>`;
    return;
  }

  const overdue = filtered.filter(j => j.dueDate < today);
  const onTime  = filtered.filter(j => j.dueDate >= today);

  let html = '';
  if (overdue.length) {
    html += `<div class="rpt-section"><div class="rpt-section-title" style="background:var(--red);">⚠ Overdue (${overdue.length})</div>
      <table class="rpt-table"><thead><tr><th>Job #</th><th>Customer</th><th>Due Date</th><th>Lead Time</th><th>Description</th><th>Current Dept</th><th>Status</th></tr></thead><tbody>`;
    overdue.forEach(j => {
      const lt = calcLeadTime(j.orderDate, j.dueDate);
      html += `<tr style="background:#fff5f5;">
        <td style="font-weight:700;color:var(--red);">${j.jobNumber}</td>
        <td>${j.customer||'—'}</td>
        <td style="color:var(--red);font-weight:700;">${j.dueDate}</td>
        <td style="font-size:.75rem;color:var(--muted);">${lt||'—'}</td>
        <td style="font-size:.75rem;">${j.jobDesc||j.mrProductType||'—'}</td>
        <td>${j.opType||'—'}</td>
        <td>${j.status}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }

  html += `<div class="rpt-section"><div class="rpt-section-title">Jobs Due ${range==='today'?'Today':'This Week'} (${onTime.length})</div>
    <table class="rpt-table"><thead><tr><th>Job #</th><th>Customer</th><th>Due Date</th><th>Lead Time</th><th>Order In</th><th>Description</th><th>Qty</th><th>Current Dept</th><th>Status</th></tr></thead><tbody>`;
  onTime.forEach(j => {
    const isToday = j.dueDate === today;
    const lt      = calcLeadTime(j.orderDate, j.dueDate);
    const ltDays  = j.orderDate && j.dueDate ? Math.round((new Date(j.dueDate)-new Date(j.orderDate))/86400000) : null;
    const ltColor = ltDays !== null && ltDays <= 1 ? 'color:#e65100;font-weight:700;' : ltDays !== null && ltDays <= 3 ? 'color:#f57f17;font-weight:700;' : '';
    html += `<tr>
      <td style="font-weight:700;">${j.jobNumber}</td>
      <td>${j.customer||'—'}</td>
      <td style="${isToday?'color:var(--accent);font-weight:700;':''};">${j.dueDate}${isToday?' ← TODAY':''}</td>
      <td style="font-size:.75rem;${ltColor}">${lt||'—'}</td>
      <td style="font-size:.72rem;color:var(--muted);">${j.orderDate||'—'}</td>
      <td style="font-size:.75rem;">${j.jobDesc||j.mrProductType||'—'}</td>
      <td class="mono">${(j.qty||0).toLocaleString()}</td>
      <td>${j.opType||'—'}</td>
      <td>${j.status}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

// ── BY CUSTOMER ───────────────────────────────────────────────
function renderByCustomer() {
  const el  = document.getElementById('rpt_by_customer_content');
  const all = getData().filter(j => j.customer && j.status !== 'archived');

  const byCustomer = {};
  all.forEach(j => {
    const c = j.customer || 'Unknown';
    if (!byCustomer[c]) byCustomer[c] = [];
    byCustomer[c].push(j);
  });

  const sorted = Object.entries(byCustomer).sort((a,b) => a[0].localeCompare(b[0]));

  if (!sorted.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">No customer data available</div>`;
    return;
  }

  let html = '';
  sorted.forEach(([customer, jobs]) => {
    html += `<div class="rpt-section">
      <div class="rpt-section-title" style="display:flex;justify-content:space-between;">
        <span>${customer}</span>
        <span>${jobs.length} job${jobs.length!==1?'s':''}</span>
      </div>
      <table class="rpt-table"><thead><tr>
        <th>Job #</th><th>PO #</th><th>Description</th><th>Qty</th><th>Due</th><th>Dept</th><th>Status</th>
      </tr></thead><tbody>`;
    jobs.sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||'')).forEach(j => {
      const overdue = j.dueDate && j.dueDate < localToday();
      html += `<tr>
        <td style="font-weight:700;">${j.jobNumber}</td>
        <td style="font-size:.75rem;">${j.poNumber||'—'}</td>
        <td style="font-size:.75rem;">${j.jobDesc||j.mrProductType||'—'}</td>
        <td class="mono">${(j.qty||0).toLocaleString()}</td>
        <td style="${overdue?'color:var(--red);font-weight:700;':''};">${j.dueDate||'—'}</td>
        <td>${j.opType||'—'}</td>
        <td>${j.status}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  });
  el.innerHTML = html;
}

// ── LONGEST MAKE READIES ──────────────────────────────────────
function renderLongMR() {
  const el  = document.getElementById('rpt_long_mr_content');
  const all = getData();

  // Collect all MR records — from operations history + completed jobs
  const mrList = [];
  all.forEach(j => {
    (j.operations||[]).forEach(op => {
      if (op.mrHrs > 0) mrList.push({
        jobNumber : j.jobNumber,
        customer  : j.customer||'—',
        dept      : op.dept,
        op        : op.op,
        operator  : op.operator,
        mrHrs     : op.mrHrs,
        date      : (op.mrStart||j.date||'').slice(0,10)
      });
    });
    // Current in-progress MR
    if (j.status === 'makeready' && j.mrStart) {
      const hrs = Math.max(0,(new Date()-parseLocalTime(j.mrStart))/3600000);
      mrList.push({
        jobNumber: j.jobNumber, customer: j.customer||'—',
        dept: j.opType, op: j.machine, operator: j.operator,
        mrHrs: hrs, date: j.date, live: true
      });
    }
  });

  if (!mrList.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">No make ready data available yet</div>`;
    return;
  }

  mrList.sort((a,b) => b.mrHrs - a.mrHrs);
  const top = mrList.slice(0, 20);

  let html = `<div class="rpt-section">
    <div class="rpt-section-title">Top ${top.length} Longest Make Readies (troubleshooting)</div>
    <table class="rpt-table"><thead><tr>
      <th>#</th><th>Job #</th><th>Customer</th><th>Dept</th><th>Operation</th><th>Operator</th><th>MR Hours</th><th>Date</th>
    </tr></thead><tbody>`;

  top.forEach((r,i) => {
    const flag = r.mrHrs > 2 ? 'color:var(--red);font-weight:700;' :
                 r.mrHrs > 1 ? 'color:var(--accent);font-weight:700;' : '';
    html += `<tr>
      <td style="color:var(--muted);">${i+1}</td>
      <td style="font-weight:700;">${r.jobNumber}</td>
      <td>${r.customer}</td>
      <td>${r.dept}</td>
      <td style="font-size:.75rem;">${r.op||'—'}</td>
      <td>${r.operator||'—'}</td>
      <td class="mono" style="${flag}">${r.mrHrs.toFixed(2)} hrs${r.live?' 🔴 Live':''}</td>
      <td style="font-size:.75rem;">${r.date}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

// ── IDLE JOBS > 48 HOURS ──────────────────────────────────────
function renderIdleJobs() {
  const el    = document.getElementById('rpt_idle_jobs_content');
  const all   = getData();
  const now   = new Date();
  const limit = 48 * 3600000; // 48 hours in ms
  const idle  = [];

  all.forEach(j => {
    if (j.status === 'archived' || j.opType === 'Scheduling') return;

    // Find last activity timestamp
    let lastActivity = null;
    const ops = j.operations || [];
    if (ops.length) {
      const lastOp = ops[ops.length-1];
      lastActivity = parseLocalTime(lastOp.completedAt || lastOp.mrStop);
    }
    if (!lastActivity && j.mrStart) lastActivity = parseLocalTime(j.mrStart);
    if (!lastActivity && j.scheduledAt) lastActivity = parseLocalTime(j.scheduledAt);
    if (!lastActivity) return;

    const idleHrs = (now - lastActivity) / 3600000;
    if (idleHrs >= 48 && (j.status === 'awaiting_next' || j.status === 'makeready' || j.status === 'production')) {
      idle.push({ ...j, idleHrs });
    }
  });

  if (!idle.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--green);">
      <div style="font-size:2rem;">✓</div>
      <div style="margin-top:8px;font-size:.85rem;font-weight:600;">No jobs idle for more than 48 hours</div>
    </div>`;
    return;
  }

  idle.sort((a,b) => b.idleHrs - a.idleHrs);

  let html = `<div class="rpt-section">
    <div class="rpt-section-title" style="background:var(--red);">⚠ Jobs Idle ${'>'}48 Hours (${idle.length})</div>
    <table class="rpt-table"><thead><tr>
      <th>Job #</th><th>Customer</th><th>Current Dept</th><th>Status</th><th>Idle Time</th><th>Due Date</th><th>Action</th>
    </tr></thead><tbody>`;

  idle.forEach(j => {
    const days = (j.idleHrs / 24).toFixed(1);
    const flag = j.idleHrs > 96 ? 'color:var(--red);font-weight:700;' : 'color:var(--accent);font-weight:700;';
    const overdue = j.dueDate && j.dueDate < localToday();
    html += `<tr>
      <td style="font-weight:700;">${j.jobNumber}</td>
      <td>${j.customer||'—'}</td>
      <td>${j.opType||'—'}</td>
      <td>${j.status}</td>
      <td class="mono" style="${flag}">${days} days</td>
      <td style="${overdue?'color:var(--red);font-weight:700;':''};">${j.dueDate||'—'}${overdue?' ⚠':''}</td>
      <td><button class="btn btn-primary btn-sm" onclick="beginNextOperation('${j.id}','${j.opType}')">➕ Assign Next Op</button></td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}



function createJob() {
  const operator  = document.getElementById('f_operator').value;
  const jobNumber = document.getElementById('f_job').value.trim();
  const poNumber  = document.getElementById('f_po').value.trim();
  const opType    = document.getElementById('f_optype').value;
  const machine   = document.getElementById('f_machine').value;
  if (!operator||!jobNumber||!opType||!machine) { alert('Please fill in Operator, Job Number, Department and Operation.'); return; }

  const mrStartInput = document.getElementById('f_mr_start_time').value;
  const now = mrStartInput || localNow();
  const job = {
    id: Date.now().toString(),
    date: now.slice(0,10),
    status: 'makeready',
    operator, jobNumber, poNumber, opType, machine,
    qty:         parseInt(document.getElementById('f_qty').value)||0,
    pressSheets: parseInt(document.getElementById('f_press_sheets').value)||0,
    pages:       parseInt(document.getElementById('f_pages').value)||0,
    forms:       parseInt(document.getElementById('f_forms').value)||0,
    sigs:        parseInt(document.getElementById('f_sigs').value)||0,
    paperSize: document.getElementById('f_papersize').value.trim(),
    paperType: document.getElementById('f_papertype').value,
    colors:    document.getElementById('f_colors').value,
    foldType:  document.getElementById('f_fold').value,
    mrStart: now, mrStop: '', mrHrs: 0,
    prodStart: '', prodStop: '', prodHrs: 0,
    prodLogs: [], totalUnits: 0, uph: 0,
    downtime: [], totalDT: 0
  };

  saveJob(job);
  toast('Job created — Make Ready started ✓');
  resetNewForm();
  showView('active', document.getElementById('nav_active'));
}

function resetNewForm() {
  ['f_operator','f_job','f_po','f_optype','f_machine',
   'f_customer','f_order_date','f_due_date','f_product_type','f_finished_size','f_qty',
   'f_vendor_name','f_vendor_contact','f_vendor_info',
   'f_mr_product_type','f_paper_type_sel','f_paper_type_other',
   'f_parent_size','f_parent_sheets','f_press_size','f_press_sheets',
   'f_pages','f_sched_sigs','f_sched_forms','f_up_on_press',
   'f_waste_pct','f_calc_press_sheets','f_sched_notes',
   'f_colors','f_fold','f_mr_start_time',
   'f_fulfillment_notes','f_shipping_notes'
  ].forEach(id => {
    const el = document.getElementById(id); if (el) el.value='';
  });
  document.getElementById('field_colors').classList.add('hidden');
  document.getElementById('field_fold').classList.add('hidden');
  const vendorWrap = document.getElementById('vendor_name_wrap');
  if (vendorWrap) vendorWrap.style.display = 'none';
  document.querySelectorAll('input[name="print_process"]').forEach(r => r.checked = false);
}

// ── ACTIVE JOBS ───────────────────────────────────────────────────────────────
function renderActiveJobs() {
  const all   = getData();
  const today = localToday();

  // Show all non-archived jobs — active, awaiting, and complete so they hold in dept
  // Show active + awaiting + complete jobs (complete only stays in Shipping/Inventory)
  const visible = all.filter(j => j.status !== 'archived');

  // Group jobs by department — each job lives in exactly ONE dept (its opType)
  const depts = [
    { key:'sched',   opType:'Scheduling' },
    { key:'prepress',opType:'Prepress' },
    { key:'press',   opType:'Press' },
    { key:'fold',    opType:'Folding' },
    { key:'bind',    opType:'Bindery' },
    { key:'finish',     opType:'Finishing' },
    { key:'outsource',  opType:'Outsourcing' },
    { key:'mail',       opType:'Mailing' },
    { key:'fulfill', opType:'Fulfillment' },
    { key:'ship',    opType:'Shipping/Inventory' }
  ];

  depts.forEach(dept => {
    let deptJobs = visible.filter(j => j.opType === dept.opType);

    // Scheduling: only show jobs still waiting for first dept assignment
    // Once opType changes away from Scheduling, job is no longer here
    if (dept.key === 'sched') {
      deptJobs = deptJobs.filter(j => j.status === 'scheduled');
    }
    const countEl  = document.getElementById('dept_' + dept.key + '_count');
    const listEl   = document.getElementById('dept_' + dept.key + '_list');
    if (!countEl || !listEl) return;

    const activeCount  = deptJobs.filter(j => j.status === 'makeready' || j.status === 'production' || j.status === 'scheduled').length;
    const waitingCount = deptJobs.filter(j => j.status === 'awaiting_next' || j.status === 'complete').length;
    countEl.textContent = activeCount
      ? activeCount + ' active' + (waitingCount ? ', ' + waitingCount + ' awaiting' : '')
      : waitingCount
      ? waitingCount + ' awaiting next dept'
      : 'No jobs';

    listEl.innerHTML = deptJobs.length
      ? deptJobs.map(j => {
          try { return renderJobCard(j); }
          catch(e) { return `<div class="job-card" style="padding:12px;color:red;font-size:.75rem;">⚠ Card error for job ${j.jobNumber}: ${e.message}</div>`; }
        }).join('')
      : `<div style="width:100%;padding:16px 0 8px;font-size:.78rem;color:var(--muted);">No active jobs in this department.</div>`;
  });
}

function renderJobCard(j) {
  const stageLabel = { scheduled:'📅 Scheduled', setup:'Setup', makeready:'Make Ready', production:'In Production', awaiting_next:'✓ Complete', complete:'✓ Complete' };
  const now = new Date();

  // Detect active (open) downtime
  const activeDT  = j.downtime && j.downtime.find(dt => dt.start && !dt.stop);
  const dtElapsed = activeDT ? Math.max(0,(now - new Date(activeDT.start+':00'))/3600000).toFixed(2) : null;

  // Timer flags
  const { mrOvertime, logDue } = getTimerFlags(j, activeDT, now);

  const dtBanner = activeDT ? `
    <div class="dt-banner">
      <div class="dt-banner-top">
        <div class="dt-banner-label"><span class="dt-flash"></span>Downtime Active</div>
        <span class="dt-banner-elapsed">${dtElapsed} hrs</span>
      </div>
      <div class="dt-banner-reason">${activeDT.reason||'Reason not specified'}</div>
    </div>` : '';

  let metaRows = '', actions = '', progressBar = '', badgeLbl = '';

  // ── SCHEDULED (Scheduling dept — master job card) ────────────
  if (j.status === 'scheduled') {
    const schedDate   = parseLocalTime(j.scheduledAt);
    const elapsedDays = schedDate ? Math.floor((now - schedDate) / 86400000) : 0;

    // Aggregate all linked records for this job number
    const allRecords  = getData().filter(r => r.jobNumber === j.jobNumber && r.id !== j.id);
    const totalMRHrs  = allRecords.reduce((s,r) => s + (r.mrHrs||0), 0);
    const totalProdHrs= allRecords.reduce((s,r) => s + (r.netProdHrs||r.prodHrs||0), 0);
    const totalUnitsA = allRecords.reduce((s,r) => s + (r.totalUnits||0), 0);
    const totalDTHrs  = allRecords.reduce((s,r) => s + (r.totalDT||0), 0);
    const activeRecs  = allRecords.filter(r => r.status !== 'complete');

    // Build operations history — group multiple ops per dept
    const deptOrder = ['Prepress','Press','Folding','Bindery','Finishing','Mailing','Fulfillment','Shipping/Inventory'];
    const completedDepts = allRecords.filter(r => r.status === 'complete').map(r => r.opType);
    const activeDepts    = allRecords.filter(r => r.status !== 'complete').map(r => r.opType);

    let historyRows = `
      <div style="margin:8px 0 4px;font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">Production Status</div>
      <div style="font-size:.75rem;">
        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:var(--green);">✓</span>
          <span style="flex:1;font-weight:600;">Scheduling</span>
          <span style="color:var(--muted);">${j.operator}</span>
          <span style="color:var(--muted);font-size:.68rem;">${j.date}</span>
        </div>`;

    deptOrder.forEach(dept => {
      const recs = allRecords.filter(r => r.opType === dept);
      if (!recs.length) {
        historyRows += `
          <div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #f0f0f0;color:#ccc;">
            <span>○</span><span style="flex:1;">${dept}</span><span style="font-size:.68rem;">Pending</span>
          </div>`;
      } else {
        // Show each operation individually (multiple allowed for Prepress)
        const deptTotalHrs = recs.reduce((s,r) => s + (r.mrHrs||0) + (r.netProdHrs||r.prodHrs||0), 0);
        recs.forEach((r, idx) => {
          const isActive = r.status !== 'complete';
          const icon  = isActive ? '🔵' : '✓';
          const color = isActive ? 'var(--accent)' : 'var(--green)';
          const opHrs = ((r.mrHrs||0) + (r.netProdHrs||r.prodHrs||0)).toFixed(1);
          historyRows += `
            <div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #f0f0f0;">
              <span style="color:${color};">${icon}</span>
              <span style="flex:1;font-weight:600;color:${color};">
                ${dept}${recs.length > 1 ? ' <span style="font-size:.65rem;color:var(--muted);">#'+(idx+1)+'</span>' : ''}
              </span>
              <span style="color:var(--muted);font-size:.72rem;">${r.machine||''}</span>
              <span style="color:var(--muted);font-size:.68rem;">${isActive ? 'Active' : opHrs+'h'}</span>
            </div>`;
        });
        // Show dept subtotal if multiple ops
        if (recs.length > 1) {
          historyRows += `
            <div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 16px;border-bottom:1px solid #f0f0f0;background:#fafafa;">
              <span style="flex:1;font-size:.65rem;color:var(--muted);">Prepress total</span>
              <span style="font-size:.68rem;font-weight:700;color:var(--muted);">${deptTotalHrs.toFixed(1)}h across ${recs.length} operations</span>
            </div>`;
        }
      }
    });
    historyRows += '</div>';

    metaRows = `
      <div class="jc-meta-item"><div class="jcm-lbl">Customer</div><div class="jcm-val">${j.customer||'—'}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Due Date</div><div class="jcm-val" style="${j.dueDate && j.dueDate < localToday() ? 'color:var(--red);font-weight:700;':''}">${j.dueDate||'—'}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Process</div><div class="jcm-val">${j.printProcess||'—'}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Qty</div><div class="jcm-val mono">${(j.qty||0).toLocaleString()}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Press Sheets</div><div class="jcm-val mono">${(j.pressSheets||0).toLocaleString()}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Days Active</div><div class="jcm-val mono" style="${elapsedDays>5?'color:var(--red);font-weight:900;':''}">${elapsedDays} day${elapsedDays!==1?'s':''}</div></div>
      ${totalProdHrs > 0 || totalMRHrs > 0 ? `
      <div class="jc-meta-item"><div class="jcm-lbl">Total MR Hrs</div><div class="jcm-val mono">${totalMRHrs.toFixed(2)}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Total Prod Hrs</div><div class="jcm-val mono">${totalProdHrs.toFixed(2)}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Operations Run</div><div class="jcm-val mono">${allRecords.length}</div></div>
      ${totalUnitsA > 0 ? `<div class="jc-meta-item"><div class="jcm-lbl">Total Units</div><div class="jcm-val mono">${totalUnitsA.toLocaleString()}</div></div>` : ''}
      ${totalDTHrs > 0 ? `<div class="jc-meta-item"><div class="jcm-lbl">Total Downtime</div><div class="jcm-val mono" style="color:var(--red);">${totalDTHrs.toFixed(2)} hrs</div></div>` : ''}
      ` : ''}`;

    // Append history below meta rows
    metaRows += `<div style="margin-top:8px;">${historyRows}</div>`;

    const hasActive = activeRecs.length > 0;
    actions = `
      <button class="btn btn-secondary btn-sm" onclick="openMR('${j.id}')">📋 Material Req</button>
      <button class="btn btn-primary btn-sm" onclick="beginNextOperation('${j.id}','Scheduling')"
        style="flex:1;">➕ Begin Next Operation</button>`;
  } else

  if (j.status === 'makeready') {
    const mrStartDate = parseLocalTime(j.mrStart);
    const elapsedMins = mrStartDate ? Math.floor((now - mrStartDate) / 60000) : 0;
    const elapsedDisp = elapsedMins >= 60
      ? (elapsedMins/60).toFixed(1) + ' hrs'
      : elapsedMins + ' min';
    const elapsedColor = elapsedMins >= 30 ? 'color:var(--yellow);font-weight:900;' : '';
    const isSimple = SIMPLE_DEPTS.includes(j.opType);

    metaRows = `
      <div class="jc-meta-item"><div class="jcm-lbl">Operation</div><div class="jcm-val">${j.machine}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Operator</div><div class="jcm-val">${j.operator}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Started</div><div class="jcm-val">${j.mrStart ? j.mrStart.replace('T',' ') : '—'}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Elapsed</div><div class="jcm-val mono" style="${elapsedColor}">${elapsedDisp}</div></div>`;

    if (isSimple) {
      // Simple depts: In Progress → Complete → Begin Next Operation
      if (mrOvertime) badgeLbl = '⚠ Overtime';
      else badgeLbl = 'In Progress';
      actions = activeDT
        ? `<button class="btn btn-danger btn-sm" onclick="openModal('stopDowntime','${j.id}')">⏹ Stop Downtime</button>`
        : `<button class="btn btn-success btn-sm" onclick="completeSimpleOp('${j.id}')">✓ Complete</button>
           <button class="btn btn-danger btn-sm" onclick="openModal('startDowntime','${j.id}')">⚠ Downtime</button>`;
    } else {
      // Standard depts: Make Ready → Stop MR → Start Production
      actions = activeDT
        ? `<button class="btn btn-danger btn-sm" onclick="openModal('stopDowntime','${j.id}')">⏹ Stop Downtime</button>`
        : `<button class="btn btn-primary btn-sm" onclick="openModal('stopMR','${j.id}')">⏹ Stop Make Ready</button>
           <button class="btn btn-danger btn-sm" onclick="openModal('startDowntime','${j.id}')">⚠ Report Downtime</button>`;
    }

  } else if (j.status === 'production') {
    const startDate  = parseLocalTime(j.prodStart || j.mrStart);
    const elapsedMin = startDate ? Math.floor((now - startDate) / 60000) : 0;
    const elapsedDisp= elapsedMin >= 60 ? (elapsedMin/60).toFixed(1)+' hrs' : elapsedMin+' min';

    if (SIMPLE_DEPTS.includes(j.opType)) {
      // Prepress / Fulfillment / Shipping — elapsed time only, no unit logging
      badgeLbl = 'In Progress';
      metaRows = `
        <div class="jc-meta-item"><div class="jcm-lbl">Operation</div><div class="jcm-val">${j.machine}</div></div>
        <div class="jc-meta-item"><div class="jcm-lbl">Operator</div><div class="jcm-val">${j.operator}</div></div>
        <div class="jc-meta-item"><div class="jcm-lbl">Started</div><div class="jcm-val">${(j.mrStart||'').replace('T',' ')}</div></div>
        <div class="jc-meta-item"><div class="jcm-lbl">Elapsed</div><div class="jcm-val mono" style="${elapsedMin>=30?'color:var(--yellow);font-weight:700;':''}">${elapsedDisp}</div></div>`;
      actions = activeDT
        ? `<button class="btn btn-danger btn-sm" onclick="openModal('stopDowntime','${j.id}')">⏹ Stop Downtime</button>`
        : `<button class="btn btn-success btn-sm" onclick="completeSimpleOp('${j.id}')">✓ Complete</button>
           <button class="btn btn-danger btn-sm" onclick="openModal('startDowntime','${j.id}')">⚠ Downtime</button>`;
    } else {
      // Standard depts — full unit logging
      const logs      = j.prodLogs || [];
      const refStr    = logs.length > 0 ? logs[logs.length-1].time : j.prodStart;
      const refDate   = parseLocalTime(refStr);
      const sinceLog  = refDate ? Math.floor((now - refDate) / 60000) : 0;
      const sinceDisp = sinceLog >= 60 ? (sinceLog/60).toFixed(1)+' hrs' : sinceLog+' min';
      const sinceColor= sinceLog >= 30 ? 'color:var(--yellow);font-weight:900;' : '';
      const elapsedHrs= startDate ? Math.max(0,(now - startDate) / 3600000) : 0;
      const netRun    = Math.max(0, elapsedHrs - (j.totalDT||0)).toFixed(2);
      const liveUph   = (elapsedHrs > 0 && j.totalUnits > 0)
        ? Math.round(j.totalUnits / Math.max(0.01, elapsedHrs - (j.totalDT||0))) : '—';
      metaRows = `
        <div class="jc-meta-item"><div class="jcm-lbl">Machine</div><div class="jcm-val">${j.machine}</div></div>
        <div class="jc-meta-item"><div class="jcm-lbl">Operator</div><div class="jcm-val">${j.operator}</div></div>
        <div class="jc-meta-item"><div class="jcm-lbl">Units Logged</div><div class="jcm-val mono">${(j.totalUnits||0).toLocaleString()}</div></div>
        <div class="jc-meta-item"><div class="jcm-lbl">${j.opType==='Press'?'Press Sheets Target':'Ordered Qty Target'}</div><div class="jcm-val mono">${getTargetQty(j).toLocaleString()}</div></div>
        <div class="jc-meta-item"><div class="jcm-lbl">Net Run Time</div><div class="jcm-val mono">${netRun} hrs</div></div>
        <div class="jc-meta-item"><div class="jcm-lbl">Live U/hr</div><div class="jcm-val mono" style="color:var(--green)">${liveUph}</div></div>
        <div class="jc-meta-item"><div class="jcm-lbl">Since Last Log</div><div class="jcm-val mono" style="${sinceColor}">${sinceDisp}</div></div>`;
      progressBar = (getTargetQty(j) > 0) ? buildProgressBar(j.totalUnits, getTargetQty(j)) : '';
      actions = activeDT
        ? `<button class="btn btn-danger btn-sm" onclick="openModal('stopDowntime','${j.id}')">⏹ Stop Downtime</button>`
        : logDue
        ? `<button class="btn-log-alert" onclick="openModal('logUnits','${j.id}')"><span class="blink-dot"></span>⚠ Log Units Now</button>
           <button class="btn btn-primary btn-sm" onclick="openModal('stopProd','${j.id}')">⏹ Stop Production</button>
           <button class="btn btn-danger btn-sm" onclick="openModal('startDowntime','${j.id}')">⚠ Report Downtime</button>`
        : `<button class="btn btn-success btn-sm" onclick="openModal('logUnits','${j.id}')">+ Log Units</button>
           <button class="btn btn-primary btn-sm" onclick="openModal('stopProd','${j.id}')">⏹ Stop Production</button>
           <button class="btn btn-danger btn-sm" onclick="openModal('startDowntime','${j.id}')">⚠ Report Downtime</button>`;
    }

  } else if (j.status === 'awaiting_next') {
    badgeLbl = '✓ Complete';
    const allOps        = j.operations || [];
    const totalOpHrs    = allOps.reduce((s,o) => s+(o.mrHrs||0)+(o.netProdHrs||0), 0);
    const lastOp        = allOps.length ? allOps[allOps.length-1] : null;

    // Build production status history
    const deptOrder = ['Prepress','Press','Folding','Bindery','Finishing','Mailing','Fulfillment','Shipping/Inventory'];
    const deptColors = {
      'Scheduling':'#2ecc71','Prepress':'#9b59b6','Press':'#e74c3c',
      'Folding':'#f0a500','Bindery':'#00c2a8','Finishing':'#1abc9c',
      'Mailing':'#3498db','Fulfillment':'#e67e22','Shipping/Inventory':'#95a5a6'
    };

    let histRows = `<div style="margin:10px 0 4px;font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">Production Status</div>
      <div style="font-size:.74rem;border:1px solid var(--border);border-radius:6px;overflow:hidden;">`;

    // Scheduling row (always first)
    histRows += `<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:#f8f8f8;border-bottom:1px solid #f0f0f0;">
        <span style="color:#2ecc71;font-weight:700;">✓</span>
        <span style="flex:1;font-weight:600;">Scheduling</span>
        <span style="color:var(--muted);font-size:.68rem;">${j.date||''}</span>
      </div>`;

    // Completed operations from history
    allOps.forEach((op, idx) => {
      const hrs   = ((op.mrHrs||0)+(op.netProdHrs||0)).toFixed(1);
      const color = deptColors[op.dept] || '#888';
      histRows += `<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid #f0f0f0;">
          <span style="color:${color};font-weight:700;">✓</span>
          <span style="flex:1;font-weight:600;color:${color};">${op.dept}${allOps.filter(o=>o.dept===op.dept).length>1?' <span style="font-size:.62rem;color:var(--muted);">#'+(allOps.filter((o,i)=>o.dept===op.dept&&i<=idx).length)+'</span>':''}</span>
          <span style="color:var(--muted);font-size:.7rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${op.op||''}</span>
          <span style="color:var(--muted);font-size:.68rem;flex-shrink:0;">${hrs}h</span>
        </div>`;
    });

    // Current dept — complete, awaiting next
    const curColor = deptColors[j.opType] || '#888';
    histRows += `<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:rgba(240,165,0,.07);border-bottom:1px solid #f0f0f0;">
        <span style="color:${curColor};font-weight:700;">✓</span>
        <span style="flex:1;font-weight:700;color:${curColor};">${j.opType}</span>
        <span style="font-size:.68rem;color:var(--accent);font-weight:700;">Awaiting next →</span>
      </div>`;

    // Remaining departments — pending
    const visitedDepts = new Set([...(allOps.map(o=>o.dept)), j.opType]);
    deptOrder.filter(d => !visitedDepts.has(d)).forEach(dept => {
      histRows += `<div style="display:flex;align-items:center;gap:8px;padding:4px 10px;border-bottom:1px solid #f0f0f0;opacity:.4;">
          <span>○</span><span style="flex:1;">${dept}</span><span style="font-size:.68rem;">Pending</span>
        </div>`;
    });

    histRows += '</div>';

    metaRows = `
      <div class="jc-meta-item"><div class="jcm-lbl">Operation</div><div class="jcm-val">${j.machine||'—'}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Operator</div><div class="jcm-val">${j.operator||'—'}</div></div>
      ${lastOp ? `<div class="jc-meta-item"><div class="jcm-lbl">Last Op Time</div><div class="jcm-val mono">${((lastOp.mrHrs||0)+(lastOp.netProdHrs||0)).toFixed(2)} hrs</div></div>` : ''}
      ${allOps.length > 0 ? `<div class="jc-meta-item"><div class="jcm-lbl">Total Ops Time</div><div class="jcm-val mono">${totalOpHrs.toFixed(2)} hrs · ${allOps.length} op${allOps.length!==1?'s':''}</div></div>` : ''}
      <div style="margin-top:4px;">${histRows}</div>`;

    const canHandoff = NEXT_OP_DEPTS[j.opType] && NEXT_OP_DEPTS[j.opType].length > 0;
    actions = `
      <button class="btn btn-secondary btn-sm" onclick="reopenJob('${j.id}')">↩ Reopen</button>
      ${canHandoff
        ? `<button class="btn btn-primary btn-sm" onclick="beginNextOperation('${j.id}','${j.opType}')" style="flex:1;">➕ Begin Next Operation</button>`
        : `<button class="btn btn-success btn-sm" onclick="markJobComplete('${j.id}')" style="flex:1;">✓ Mark Job Complete</button>`}`;

  } else if (j.status === 'complete') {
    metaRows = `
      <div class="jc-meta-item"><div class="jcm-lbl">Operation</div><div class="jcm-val">${j.machine||'—'}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Operator</div><div class="jcm-val">${j.operator||'—'}</div></div>
      <div class="jc-meta-item"><div class="jcm-lbl">Completed</div><div class="jcm-val">${(j.mrStop||j.prodStop||'').replace('T',' ')}</div></div>
      ${j.totalUnits ? `<div class="jc-meta-item"><div class="jcm-lbl">Units</div><div class="jcm-val mono">${j.totalUnits.toLocaleString()}</div></div>` : ''}`;
    const canHandoff = NEXT_OP_DEPTS[j.opType] && NEXT_OP_DEPTS[j.opType].length > 0;
    actions = `
      <button class="btn btn-secondary btn-sm" onclick="reopenJob('${j.id}')">↩ Reopen</button>
      ${canHandoff
        ? `<button class="btn btn-primary btn-sm" onclick="beginNextOperation('${j.id}','${j.opType}')" style="flex:1;">➕ Begin Next Operation</button>`
        : `<button class="btn btn-success btn-sm" onclick="markJobComplete('${j.id}')" style="flex:1;">✓ Mark Job Complete</button>`}`;
  }

  const barClass   = activeDT ? 'down-active' : j.status;
  const cardClass  = mrOvertime ? 'mr-overtime' : '';
  const badgeCls   = activeDT ? 'down' : j.status;
        badgeLbl   = badgeLbl || (activeDT ? '⚠ Downtime' : mrOvertime ? '⚠ MR Overtime' : stageLabel[j.status]);
  const badgeExtra = mrOvertime ? 'mr-overtime-badge' : '';
  // Edit + Delete buttons always shown on active cards
  actions += `
    <button class="btn btn-sm" onclick="openEditModal('${j.id}')"
      style="background:#2980b9;color:#fff;border:1px solid #2471a3;"
      title="Edit machine, operator or department">✏ Edit</button>
    <button class="btn btn-sm" onclick="deleteJob('${j.id}')"
      style="background:#c0392b;color:#fff;border:1px solid #a93226;margin-left:auto;"
      title="Delete this job permanently">🗑 Delete</button>`;

  // Status dot color per dept
  const deptDotColor = {
    'Scheduling':'#2ecc71','Prepress':'#9b59b6','Press':'#e74c3c',
    'Folding':'#f0a500','Bindery':'#00c2a8','Finishing':'#1abc9c',
    'Mailing':'#3498db','Fulfillment':'#e67e22','Shipping/Inventory':'#95a5a6'
  }[j.opType] || '#888';

  const statusDot = activeDT ? '#e74c3c' :
    j.status === 'production' ? '#2ecc71' :
    j.status === 'makeready'  ? '#f0a500' :
    j.status === 'scheduled'  ? '#2ecc71' : '#95a5a6';

  return `<div class="job-card ${cardClass}" id="card_${j.id}">
    <div class="jc-bar ${barClass}"></div>
    <!-- Collapsed header — always visible, click to expand -->
    <div class="jc-header" onclick="toggleCard('${j.id}')">
      <div style="width:8px;height:8px;border-radius:50%;background:${statusDot};flex-shrink:0;box-shadow:0 0 5px ${statusDot};"></div>
      <div style="font-weight:500;font-size:.88rem;color:var(--text);letter-spacing:.04em;">${j.jobNumber}</div>
      ${j.customer ? `<div style="font-size:.72rem;color:var(--muted);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${j.customer}</div>` : `<div style="flex:1;"></div>`}
      <span class="jc-pill" style="color:${deptDotColor};border-color:${deptDotColor};">${j.opType}</span>
      <span class="stage-badge ${badgeCls} ${badgeExtra}" style="font-size:.6rem;padding:2px 7px;">${badgeLbl}</span>
      <span class="jc-toggle" title="Click to expand">▼</span>
    </div>
    <!-- Expanded body — hidden by default -->
    <div class="jc-body">
      ${dtBanner}
      <div class="jc-meta" style="margin-top:10px;">${metaRows}</div>
      ${progressBar}
      <hr class="jc-divider">
      <div class="jc-actions">${actions}</div>
    </div>
  </div>`;
}

function toggleCard(id) {
  const card = document.getElementById('card_' + id);
  if (card) card.classList.toggle('expanded');
}


// ── MODALS ────────────────────────────────────────────────────────────────────
function openModal(type, jobId) {
  const job = getJob(jobId);
  if (!job) return;
  const now = localNow();
  let html = '';

  if (type === 'stopMR') {
    html = `<div class="modal-header"><span class="modal-title">Stop Make Ready — ${job.jobNumber}</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.82rem;color:var(--muted);margin-bottom:14px;">MR Started: <strong>${job.mrStart.replace('T',' ')}</strong></p>
      <label>Make Ready Stop Time</label>
      <div class="time-row">
        <input type="datetime-local" id="m_mr_stop" value="${now}" oninput="calcModalMR()">
        <button class="btn-now" onclick="setNow('m_mr_stop', calcModalMR)">⚡ Now</button>
      </div>
      <div class="auto-row" style="margin-top:10px;">
        <div class="auto-field"><div class="af-lbl">MR Duration</div><div class="af-val" id="m_mr_dur">—</div></div>
        <div class="auto-field"><div class="af-lbl">Status</div><div class="af-val" id="m_mr_status">—</div></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doStopMR('${job.id}')">✓ Confirm — Begin Production</button>
    </div>`;
    setTimeout(calcModalMR, 50);

  } else if (type === 'logUnits') {
    const logs = job.prodLogs || [];
    const logsHtml = logs.length ? logs.slice(-3).map(l =>
      `<div class="prod-log-row">
        <span>${l.time.replace('T',' ')}</span>
        <span style="font-family:'Share Tech Mono',monospace;color:var(--accent);">+${l.units.toLocaleString()} units</span>
       </div>`
    ).join('') : '<div style="font-size:.78rem;color:var(--muted);padding:8px 0;">No logs yet — this will be the first entry.</div>';

    const targetQty  = getTargetQty(job);
    const targetLabel= job.opType === 'Press' ? 'press sheets' : 'ordered pieces';
    const progHtml   = targetQty > 0 ? buildProgressBar(job.totalUnits, targetQty) : '';

    html = `<div class="modal-header"><span class="modal-title">Log Units — ${job.jobNumber}</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.8rem;color:var(--muted);margin-bottom:12px;">
        Enter <strong>${targetLabel}</strong> produced this period — added to running total.<br>
        Target: <strong>${targetQty.toLocaleString()} ${targetLabel}</strong>
      </p>
      <label>Units Produced This Period</label>
      <input type="number" id="m_log_units" placeholder="e.g. 5,000" min="0" oninput="calcModalUPH('${job.id}')">
      <label style="margin-top:14px;">Time of Log</label>
      <div class="time-row">
        <input type="datetime-local" id="m_log_time" value="${now}">
        <button class="btn-now" onclick="setNow('m_log_time')">⚡ Now</button>
      </div>
      <div class="auto-field" style="margin-top:10px;">
        <div class="af-lbl">Cumulative Total after this entry</div>
        <div class="af-val" id="m_running_total">${job.totalUnits.toLocaleString()} ${targetLabel} so far</div>
      </div>
      ${progHtml}
      <div style="margin-top:14px;"><div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;">Recent Logs</div>${logsHtml}</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" onclick="doLogUnits('${job.id}')">+ Add to Total</button>
    </div>`;

  } else if (type === 'stopProd') {
    html = `<div class="modal-header"><span class="modal-title">Stop Production — ${job.jobNumber}</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.82rem;color:var(--muted);margin-bottom:14px;">Production Started: <strong>${job.prodStart.replace('T',' ')}</strong><br>Units logged: <strong>${job.totalUnits.toLocaleString()}</strong></p>
      <label>Production Stop Time</label>
      <div class="time-row">
        <input type="datetime-local" id="m_prod_stop" value="${now}" oninput="calcModalProd('${job.id}')">
        <button class="btn-now" onclick="setNow('m_prod_stop', ()=>calcModalProd('${job.id}'))">⚡ Now</button>
      </div>
      <div class="auto-row" style="margin-top:10px;">
        <div class="auto-field"><div class="af-lbl">Run Duration</div><div class="af-val" id="m_prod_dur">—</div></div>
        <div class="auto-field"><div class="af-lbl">Avg Units/hr</div><div class="af-val" id="m_prod_uph">—</div></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doStopProd('${jobId}')">✓ Complete Job</button>
    </div>`;
    setTimeout(() => calcModalProd(job.id), 50);

  } else if (type === 'downtime') {
    html = `<div class="modal-header"><span class="modal-title">Log Downtime — ${job.jobNumber}</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="row-2">
        <div>
          <label>Start</label>
          <div class="time-row">
            <input type="datetime-local" id="m_dt_start" value="${now}">
            <button class="btn-now" onclick="setNow('m_dt_start')">⚡</button>
          </div>
        </div>
        <div>
          <label>Stop</label>
          <div class="time-row">
            <input type="datetime-local" id="m_dt_stop">
            <button class="btn-now" onclick="setNow('m_dt_stop')">⚡</button>
          </div>
        </div>
      </div>
      <label>Reason</label>
      <select id="m_dt_reason">
        <option value="">— Select —</option>
        <option>Mechanical breakdown</option>
        <option>Waiting for materials</option>
        <option>Plate/setup issues</option>
        <option>Operator break</option>
        <option>Power issue</option>
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="doDowntime('${job.id}')">Save Downtime</button>
    </div>`;

  } else if (type === 'startDowntime') {
    html = `<div class="modal-header" style="background:var(--red);"><span class="modal-title">⚠ Report Downtime — ${job.jobNumber}</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.82rem;color:var(--muted);margin-bottom:14px;">Machine: <strong>${job.machine}</strong> &nbsp;|&nbsp; Stage: <strong>${job.status==='makeready'?'Make Ready':'Production'}</strong></p>
      <label>Downtime Start</label>
      <div class="time-row">
        <input type="datetime-local" id="m_dt_start2" value="${now}">
        <button class="btn-now" onclick="setNow('m_dt_start2')">⚡ Now</button>
      </div>
      <label>Reason</label>
      <select id="m_dt_reason2">
        <option value="">— Select Reason —</option>
        <option>Mechanical breakdown</option>
        <option>Waiting for materials</option>
        <option>Plate/setup issues</option>
        <option>Operator break</option>
        <option>Power issue</option>
        <option>Other</option>
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="doStartDowntime('${job.id}')">⚠ Start Downtime</button>
    </div>`;

  } else if (type === 'stopDowntime') {
    const activeDT = job.downtime.find(dt => dt.start && !dt.stop);
    const elapsed  = activeDT ? Math.max(0,(new Date()-new Date(activeDT.start+':00'))/3600000).toFixed(2) : '—';
    html = `<div class="modal-header" style="background:var(--red);"><span class="modal-title">⏹ Stop Downtime — ${job.jobNumber}</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.82rem;color:var(--muted);margin-bottom:6px;">Reason: <strong>${activeDT?activeDT.reason:'—'}</strong></p>
      <p style="font-size:.82rem;color:var(--muted);margin-bottom:14px;">Started: <strong>${activeDT?activeDT.start.replace('T',' '):'—'}</strong> &nbsp;|&nbsp; Elapsed: <strong style="color:var(--red)">${elapsed} hrs</strong></p>
      <label>Downtime Stop Time</label>
      <div class="time-row">
        <input type="datetime-local" id="m_dt_stop2" value="${now}">
        <button class="btn-now" onclick="setNow('m_dt_stop2')">⚡ Now</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" onclick="doStopDowntime('${job.id}')">✓ Resume Operations</button>
    </div>`;

  } else if (type === 'summary') {
    const dt = job.downtime.map(d => `<tr><td>Downtime</td><td>${d.reason||'—'} (${d.hrs}hrs)</td></tr>`).join('');
    html = `<div class="modal-header"><span class="modal-title">Job Summary — ${job.jobNumber}</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <table class="sum-table">
        <tr><td>Job Number</td><td>${job.jobNumber}</td></tr>
        <tr><td>PO Number</td><td>${job.poNumber||'—'}</td></tr>
        <tr><td>Machine</td><td>${job.machine}</td></tr>
        <tr><td>Operator</td><td>${job.operator}</td></tr>
        <tr><td>Operation</td><td>${job.opType}</td></tr>
        <tr><td>Quantity</td><td>${job.qty.toLocaleString()}</td></tr>
        <tr><td>Paper Type</td><td>${job.paperType||'—'}</td></tr>
        <tr><td>MR Duration</td><td>${job.mrHrs} hrs</td></tr>
        <tr><td>Total Run Time</td><td>${job.prodHrs} hrs</td></tr>
        <tr><td>Net Productive Time</td><td>${job.netProdHrs || job.prodHrs} hrs</td></tr>
        <tr><td>Total Units</td><td>${job.totalUnits.toLocaleString()}</td></tr>
        <tr><td>Avg Units/hr</td><td>${job.uph}</td></tr>
        <tr><td>Total Downtime</td><td>${job.totalDT} hrs</td></tr>
        ${dt}
      </table>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Close</button></div>`;
  }

  document.getElementById('modal_content').innerHTML = html;
  document.getElementById('modal_overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal_overlay').classList.add('hidden');
  document.getElementById('edit_job_modal').classList.add('hidden');
}
function closeModalOutside(e) { if (e.target.id === 'modal_overlay') closeModal(); }

// ── MODAL CALCULATIONS ────────────────────────────────────────────────────────
function calcModalMR() {
  const s = document.getElementById('m_mr_stop')?.value;
  if (!s) return;
  const job = getData().find(j => j.status === 'makeready');
  if (!job) return;
  const h = (new Date(s) - new Date(job.mrStart)) / 3600000;
  if (h <= 0) { document.getElementById('m_mr_dur').textContent = 'Invalid'; return; }
  document.getElementById('m_mr_dur').textContent = h.toFixed(2) + ' hrs';
  document.getElementById('m_mr_status').textContent = h <= 0.5 ? '✓ Good' : h <= 1 ? '⚠ Moderate' : '✕ Long';
}

function calcModalUPH(jobId) {
  const job = getJob(jobId);
  const u   = parseInt(document.getElementById('m_log_units')?.value) || 0;
  const el  = document.getElementById('m_running_total');
  if (el) {
    const newTotal = job.totalUnits + u;
    el.textContent = newTotal.toLocaleString() + ' units total';
  }
}

function calcModalProd(jobId) {
  const job = getJob(jobId);
  const s   = document.getElementById('m_prod_stop')?.value;
  if (!s || !job.prodStart) return;
  const h    = (new Date(s) - new Date(job.prodStart)) / 3600000;
  if (h <= 0) return;
  const netH = Math.max(0.01, h - (job.totalDT || 0));
  document.getElementById('m_prod_dur').textContent  = h.toFixed(2) + ' hrs total';
  document.getElementById('m_prod_uph').textContent  =
    job.totalUnits > 0 ? Math.round(job.totalUnits / netH) + ' (net ' + netH.toFixed(2) + ' hrs)' : '—';
}

// ── STAGE ACTIONS ─────────────────────────────────────────────────────────────
function doStopMR(jobId) {
  const job  = getJob(jobId);
  const stop = document.getElementById('m_mr_stop').value;
  if (!stop) { alert('Please enter a stop time.'); return; }
  const h = (new Date(stop) - new Date(job.mrStart)) / 3600000;
  if (h <= 0) { alert('Stop time must be after start time.'); return; }
  job.mrStop    = stop;
  job.mrHrs     = +h.toFixed(2);
  job.prodStart = stop;
  job.status    = 'production';
  saveJob(job);
  closeModal();
  toast('Make Ready complete — Production started ✓');
  renderActiveJobs();
}

function doLogUnits(jobId) {
  const job   = getJob(jobId);
  const time  = document.getElementById('m_log_time').value;
  const units = parseInt(document.getElementById('m_log_units').value) || 0;
  if (!units) { alert('Please enter units produced.'); return; }
  job.prodLogs.push({ time, units });
  job.totalUnits += units;
  saveJob(job);
  closeModal();
  toast(units + ' units logged ✓');
  renderActiveJobs();
}

function doStopProd(jobId) {
  const job  = getJob(jobId);
  const stop = document.getElementById('m_prod_stop').value;
  if (!stop) { alert('Please enter a stop time.'); return; }
  const h    = (new Date(stop) - new Date(job.prodStart)) / 3600000;
  if (h <= 0) { alert('Stop time must be after start.'); return; }
  const netH = Math.max(0.01, h - (job.totalDT || 0));

  job.prodStop   = stop;
  job.prodHrs    = +h.toFixed(2);
  job.netProdHrs = +netH.toFixed(2);
  job.uph        = job.totalUnits > 0 ? Math.round(job.totalUnits / netH) : 0;

  // Archive this operation into job history
  if (!job.operations) job.operations = [];
  job.operations.push({
    dept       : job.opType,
    op         : job.machine,
    operator   : job.operator,
    mrStart    : job.mrStart  || '',
    mrStop     : job.mrStop   || '',
    mrHrs      : job.mrHrs    || 0,
    prodStart  : job.prodStart,
    prodStop   : stop,
    netProdHrs : +netH.toFixed(2),
    totalUnits : job.totalUnits || 0,
    uph        : job.uph || 0,
    totalDT    : job.totalDT || 0,
    completedAt: stop
  });

  // Stay in dept as awaiting_next so operator can assign next department
  job.status = 'awaiting_next';
  saveJob(job);

  // Send to Google Sheets
  fetch(SHEET_URL, {
    method:'POST', mode:'no-cors',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({
      date:job.date, operator:job.operator, jobNumber:job.jobNumber, poNumber:job.poNumber,
      opType:job.opType, machine:job.machine, qty:job.qty, pages:job.pages, sigs:job.sigs,
      paperSize:job.paperSize, paperType:job.paperType, colors:job.colors, foldType:job.foldType,
      mrStart:(job.mrStart||'').replace('T',' '), mrStop:(job.mrStop||'').replace('T',' '), mrHrs:job.mrHrs,
      prodStart:job.prodStart.replace('T',' '), prodStop:stop.replace('T',' '),
      prodHrs:job.prodHrs, netProdHrs:job.netProdHrs, totalUnits:job.totalUnits, uph:job.uph,
      totalDowntimeHrs:job.totalDT,
      downtimeReasons:(job.downtime||[]).map(d=>d.reason).filter(Boolean).join('; ')
    })
  }).catch(()=>{});

  closeModal();
  toast('✓ Production complete — select next department');
  renderActiveJobs();
}

function doStartDowntime(jobId) {
  const job    = getJob(jobId);
  const start  = document.getElementById('m_dt_start2').value;
  const reason = document.getElementById('m_dt_reason2').value;
  if (!start) { alert('Please enter a start time.'); return; }
  if (!reason) { alert('Please select a reason.'); return; }
  job.downtime.push({ start, stop: '', reason, hrs: 0 });
  saveJob(job);
  closeModal();
  toast('Downtime started — machine flagged as Down');
  renderActiveJobs();
}

function doStopDowntime(jobId) {
  const job  = getJob(jobId);
  const stop = document.getElementById('m_dt_stop2').value;
  if (!stop) { alert('Please enter a stop time.'); return; }
  const idx = job.downtime.findIndex(dt => dt.start && !dt.stop);
  if (idx < 0) return;
  const hrs = Math.max(0, (new Date(stop+':00') - new Date(job.downtime[idx].start+':00')) / 3600000);
  job.downtime[idx].stop = stop;
  job.downtime[idx].hrs  = +hrs.toFixed(2);
  job.totalDT = +(job.downtime.reduce((s,d) => s+d.hrs, 0)).toFixed(2);
  saveJob(job);
  closeModal();
  toast('Downtime ended — operations resumed ✓');
  renderActiveJobs();
}

function doDowntime(jobId) {
  const job    = getJob(jobId);
  const start  = document.getElementById('m_dt_start').value;
  const stop   = document.getElementById('m_dt_stop').value;
  const reason = document.getElementById('m_dt_reason').value;
  const hrs    = (start && stop) ? +((new Date(stop)-new Date(start))/3600000).toFixed(2) : 0;
  job.downtime.push({ start, stop, reason, hrs });
  job.totalDT = +(job.downtime.reduce((s,d) => s+d.hrs, 0)).toFixed(2);
  saveJob(job);
  closeModal();
  toast('Downtime logged ✓');
  renderActiveJobs();
}

// Returns today's date in local timezone (fixes UTC date mismatch bug)
function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,10);
}

// ── LEAD TIME HELPERS ─────────────────────────────────────────
function calcLeadTime(orderDate, dueDate) {
  if (!orderDate || !dueDate) return null;
  const days = Math.round((new Date(dueDate) - new Date(orderDate)) / 86400000);
  if (days < 0)   return 'Past Due at Order';
  if (days === 0) return 'Same Day';
  if (days === 1) return 'Next Day';
  if (days <= 3)  return days + '-Day Rush';
  if (days <= 7)  return days + ' Days';
  if (days <= 14) return '2 Weeks';
  if (days <= 21) return '3 Weeks';
  return Math.round(days/7) + ' Weeks';
}

function calcLeadTimeDisplay() {
  const orderDate = (document.getElementById('f_order_date')||{}).value;
  const dueDate   = (document.getElementById('f_due_date')||{}).value;
  const div = document.getElementById('lead_time_display');
  const val = document.getElementById('lead_time_val');
  if (!div) return;
  if (!orderDate || !dueDate) { div.style.display = 'none'; return; }
  const days = Math.round((new Date(dueDate) - new Date(orderDate)) / 86400000);
  const lt   = calcLeadTime(orderDate, dueDate);
  div.style.display     = 'block';
  div.style.background  = days <= 1 ? '#fff3e0' : days <= 3 ? '#fff8e1' : '#f0f7ff';
  div.style.borderColor = days <= 1 ? '#ffcc80' : days <= 3 ? '#ffe082' : '#c8e6c9';
  div.style.color       = days <= 1 ? '#e65100' : days <= 3 ? '#f57f17' : '#1a6e45';
  val.textContent = lt + (days >= 0 ? ' (' + days + ' days)' : '');
}


function renderDashboard() {
  const all     = getData();
  const today   = localToday();
  const todayAll   = all.filter(d => d.date === today);
  const complete   = todayAll.filter(d => d.status === 'complete');
  const activeJobs = all.filter(d => d.status === 'production' || d.status === 'makeready' || d.status === 'scheduled');
  const totalUnits = todayAll.reduce((s,d) => s + (d.totalUnits||0), 0);
  const avgUph     = complete.length ? Math.round(complete.reduce((s,d)=>s+(d.uph||0),0)/complete.length) : 0;
  const totalDT    = todayAll.reduce((s,d) => s + (d.totalDT||0), 0);

  // Active jobs, makeready count, downtime count
  const makereadyCount = all.filter(d => d.status === 'makeready').length;
  const downtimeCount  = all.filter(d =>
    d.downtime && d.downtime.some(dt => dt.start && !dt.stop)
  ).length;

  let summaryHtml = `
    <div class="sc"><div class="sc-val" style="color:var(--green)">${activeJobs.length}</div><div class="sc-lbl">Active Jobs</div></div>
    <div class="sc"><div class="sc-val" style="color:var(--fold)">${makereadyCount}</div><div class="sc-lbl">In Make Ready</div></div>
    <div class="sc"><div class="sc-val" style="${downtimeCount>0?'color:var(--red)':'color:var(--muted)'}">${downtimeCount}</div><div class="sc-lbl">Machines Down</div></div>`;
  document.getElementById('dash_summary').innerHTML = summaryHtml;

  // ── Departmental Report (managers/admins only) ───────────────
  const role = currentUser ? currentUser.role : null;
  const deptReportEl = document.getElementById('dept_report');
  if (!deptReportEl) { renderDeptSections(all, today, todayAll); return; }

  if (role === 'admin' || role === 'manager') {
    const depts = [
      { key:'Scheduling',        color:'#2ecc71' },
      { key:'Prepress',          color:'#9b59b6' },
      { key:'Press',             color:'#e74c3c' },
      { key:'Folding',           color:'#f0a500' },
      { key:'Bindery',           color:'#00c2a8' },
      { key:'Finishing',         color:'#1abc9c' },
      { key:'Mailing',           color:'#3498db' },
      { key:'Fulfillment',       color:'#e67e22' },
      { key:'Shipping/Inventory',color:'#95a5a6' }
    ];

    let reportHtml = `
      <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:24px;">
        <div style="background:#1a1a2e;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;">
          <div style="color:#fff;font-weight:800;font-size:.85rem;letter-spacing:.08em;text-transform:uppercase;">📊 Departmental Summary — ${today}</div>
          <div style="color:rgba(255,255,255,.5);font-size:.7rem;">${all.filter(d=>d.date===today).length} total entries today</div>
        </div>
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:.78rem;">
          <thead>
            <tr style="background:#f5f5f5;border-bottom:2px solid var(--border);">
              <th style="padding:9px 14px;text-align:left;font-size:.68rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">Department</th>
              <th style="padding:9px 10px;text-align:center;font-size:.68rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">Jobs Today</th>
              <th style="padding:9px 10px;text-align:center;font-size:.68rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">Active</th>
              <th style="padding:9px 10px;text-align:center;font-size:.68rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">Complete</th>
              <th style="padding:9px 10px;text-align:center;font-size:.68rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">MR Hrs</th>
              <th style="padding:9px 10px;text-align:center;font-size:.68rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">Prod Hrs</th>
              <th style="padding:9px 10px;text-align:right;font-size:.68rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">Units</th>
              <th style="padding:9px 10px;text-align:center;font-size:.68rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">Avg U/hr</th>
              <th style="padding:9px 10px;text-align:center;font-size:.68rem;letter-spacing:.08em;color:var(--red);text-transform:uppercase;">Downtime</th>
              <th style="padding:9px 14px;text-align:left;font-size:.68rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">Operators</th>
            </tr>
          </thead>
          <tbody>`;

    depts.forEach(dept => {
      const dRows    = todayAll.filter(d => d.opType === dept.key);
      const active   = all.filter(d => d.opType === dept.key && (d.status==='production'||d.status==='makeready'||d.status==='scheduled'));
      const done     = dRows.filter(d => d.status === 'complete');
      const mrHrs    = dRows.reduce((s,d)=>s+(d.mrHrs||0),0);
      const prodHrs  = dRows.reduce((s,d)=>s+(d.netProdHrs||d.prodHrs||0),0);
      const units    = dRows.reduce((s,d)=>s+(d.totalUnits||0),0);
      const dtHrs    = dRows.reduce((s,d)=>s+(d.totalDT||0),0);
      const uphVals  = done.filter(d=>(d.uph||0)>0);
      const avgU     = uphVals.length ? Math.round(uphVals.reduce((s,d)=>s+(d.uph||0),0)/uphVals.length) : 0;
      const ops      = [...new Set(dRows.map(d=>d.operator).filter(Boolean))];
      const hasActive = active.length > 0;

      reportHtml += `
        <tr style="border-bottom:1px solid var(--border);${hasActive?'background:rgba(240,165,0,.04)':''}">
          <td style="padding:9px 14px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:8px;height:8px;border-radius:50%;background:${dept.color};flex-shrink:0;${hasActive?'box-shadow:0 0 6px '+dept.color:''}"></div>
              <span style="font-weight:700;color:var(--text);">${dept.key}</span>
            </div>
          </td>
          <td style="padding:9px 10px;text-align:center;">${dRows.length||'—'}</td>
          <td style="padding:9px 10px;text-align:center;">${active.length ? '<span style="font-weight:700;color:'+dept.color+'">'+active.length+'</span>' : '—'}</td>
          <td style="padding:9px 10px;text-align:center;">${done.length||'—'}</td>
          <td style="padding:9px 10px;text-align:center;font-family:monospace;">${mrHrs ? mrHrs.toFixed(2) : '—'}</td>
          <td style="padding:9px 10px;text-align:center;font-family:monospace;">${prodHrs ? prodHrs.toFixed(2) : '—'}</td>
          <td style="padding:9px 10px;text-align:right;font-weight:700;">${units ? units.toLocaleString() : '—'}</td>
          <td style="padding:9px 10px;text-align:center;font-family:monospace;">${avgU||'—'}</td>
          <td style="padding:9px 10px;text-align:center;font-family:monospace;${dtHrs>0?'color:var(--red);font-weight:700;':'color:var(--muted);'}">${dtHrs ? dtHrs.toFixed(2) : '—'}</td>
          <td style="padding:9px 14px;font-size:.72rem;color:var(--muted);">${ops.join(', ')||'—'}</td>
        </tr>`;

      // Operator breakdown rows (expandable detail)
      if (dRows.length) {
        const byOp = {};
        dRows.forEach(r => { if (!byOp[r.operator]) byOp[r.operator]=[]; byOp[r.operator].push(r); });
        Object.entries(byOp).forEach(([op, rows]) => {
          const opUnits = rows.reduce((s,d)=>s+(d.totalUnits||0),0);
          const opProd  = rows.reduce((s,d)=>s+(d.netProdHrs||d.prodHrs||0),0);
          const opDT    = rows.reduce((s,d)=>s+(d.totalDT||0),0);
          const opOps   = [...new Set(rows.map(r=>r.machine).filter(Boolean))];
          reportHtml += `
            <tr style="background:#fafafa;border-bottom:1px solid #f0f0f0;">
              <td style="padding:5px 14px 5px 34px;color:var(--muted);font-size:.72rem;" colspan="1">↳ ${op}</td>
              <td style="padding:5px 10px;text-align:center;font-size:.72rem;color:var(--muted);">${rows.length}</td>
              <td colspan="2" style="padding:5px 10px;font-size:.7rem;color:var(--muted);text-align:center;">${rows.filter(r=>r.status!=='complete').length} active</td>
              <td style="padding:5px 10px;text-align:center;font-family:monospace;font-size:.72rem;color:var(--muted);">${rows.reduce((s,d)=>s+(d.mrHrs||0),0).toFixed(2)}</td>
              <td style="padding:5px 10px;text-align:center;font-family:monospace;font-size:.72rem;color:var(--muted);">${opProd.toFixed(2)}</td>
              <td style="padding:5px 10px;text-align:right;font-size:.72rem;">${opUnits.toLocaleString()}</td>
              <td colspan="1" style="padding:5px 10px;font-size:.7rem;color:var(--muted);text-align:center;">${opDT>0?'<span style="color:var(--red);">'+opDT.toFixed(2)+' DT</span>':'—'}</td>
              <td style="padding:5px 10px;font-size:.7rem;color:var(--muted);" colspan="2">${opOps.join(' · ')||'—'}</td>
            </tr>`;
        });
      }
    });

    // Totals row
    const totalMR   = todayAll.reduce((s,d)=>s+(d.mrHrs||0),0);
    const totalProd = todayAll.reduce((s,d)=>s+(d.netProdHrs||d.prodHrs||0),0);
    reportHtml += `
          <tr style="background:#1a1a2e;color:#fff;font-weight:700;">
            <td style="padding:10px 14px;font-size:.8rem;letter-spacing:.06em;">TOTALS</td>
            <td style="padding:10px;text-align:center;">${todayAll.length}</td>
            <td style="padding:10px;text-align:center;">${activeJobs.length}</td>
            <td style="padding:10px;text-align:center;">${complete.length}</td>
            <td style="padding:10px;text-align:center;font-family:monospace;">${totalMR.toFixed(2)}</td>
            <td style="padding:10px;text-align:center;font-family:monospace;">${totalProd.toFixed(2)}</td>
            <td style="padding:10px;text-align:right;">${totalUnits.toLocaleString()}</td>
            <td style="padding:10px;text-align:center;">${avgUph||'—'}</td>
            <td style="padding:10px;text-align:center;font-family:monospace;${totalDT>0?'color:#ff8080;':''}">${totalDT.toFixed(2)}</td>
            <td style="padding:10px 14px;"></td>
          </tr>
        </tbody></table></div>
      </div>`;

    deptReportEl.innerHTML = reportHtml;
  } else {
    deptReportEl.innerHTML = '';
  }

  renderDeptSections(all, today, todayAll);
}

function renderDeptSections(all, today, todayAll) {
  renderDeptCards('Scheduling', 'sched',   all, today);
  renderDeptCards('Prepress',   'prepress',all, today);
  renderDeptCards('Press',      'press',   all, today);
  renderDeptCards('Folding',    'fold',    all, today);
  renderDeptCards('Bindery',    'bind',    all, today);
  renderDeptCards('Finishing',  'finish',  all, today);
  renderDeptCards('Mailing',    'mail',    all, today);
  document.getElementById('refresh_lbl').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
}

function getMachineStatus(machine, all, today) {
  // Check active (non-complete) jobs first — they are live right now
  const activeJob = all.find(d => d.machine === machine && d.status !== 'complete');
  if (activeJob) {
    if (activeJob.downtime && activeJob.downtime.some(dt => dt.start && !dt.stop)) return 'down';
    if (activeJob.status === 'makeready')  return 'mr';
    if (activeJob.status === 'production') return 'run';
  }
  // Fall back to today's completed jobs
  const rows = all.filter(d => d.machine === machine && d.date === today);
  if (!rows.length) return 'idle';
  return 'idle';
}

function getTrend(machine, all, today) {
  const rows = all.filter(d => d.machine===machine && d.date===today && d.status==='complete' && d.uph > 0);
  if (rows.length < 2) return 'flat';
  const half   = Math.floor(rows.length / 2);
  const early  = rows.slice(0, half).reduce((s,d)=>s+d.uph,0) / half;
  const recent = rows.slice(half).reduce((s,d)=>s+d.uph,0) / (rows.length - half);
  const pct    = ((recent - early) / early) * 100;
  if (pct < -8) return 'down';
  if (pct >  8) return 'up';
  return 'flat';
}

function renderDeptCards(opType, cls, all, today) {
  const machines   = MACHINES[opType] || [];
  const isPrepress = opType === 'Prepress';
  const now        = new Date();

  // Count active
  const activeCount = machines.filter(m =>
    all.some(d => d.machine === m && d.status !== 'complete')
  ).length;
  const cntEl = document.getElementById('cnt_' + cls);
  if (cntEl) cntEl.textContent = activeCount + ' of ' + machines.length + ' active';

  const container = document.getElementById('cards_' + cls);
  if (!container) return;

  const S = {
    run:  { cls:'s-run',  lbl:'Running',    dot:'#2ecc71' },
    mr:   { cls:'s-mr',   lbl:'Make Ready', dot:'#f0a500' },
    down: { cls:'s-down', lbl:'Down',       dot:'#e74c3c' },
    idle: { cls:'s-idle', lbl:'Idle',       dot:'#aaaaaa' }
  };

  container.innerHTML = machines.map((m, idx) => {
    const allRows  = all.filter(d => d.machine === m && (d.date === today || d.status !== 'complete'));
    const activeJob= all.find(d => d.machine === m && d.status !== 'complete');
    const s        = S[getMachineStatus(m, all, today)];
    const cardId   = 'mcard_' + cls + '_' + idx;

    if (isPrepress) {
      // ── Prepress: simplified — job number, operator, elapsed time only ──
      const activeJobs = allRows.filter(d => d.status !== 'complete');
      const jobList = activeJobs.length
        ? activeJobs.map(j => {
            const start   = j.mrStart ? parseLocalTime(j.mrStart) : null;
            const elapsed = start ? Math.floor((now - start) / 60000) : 0;
            const dispEl  = elapsed >= 60
              ? (elapsed/60).toFixed(1) + ' hrs'
              : elapsed + ' min';
            return `<div style="display:flex;justify-content:space-between;align-items:center;
              padding:5px 0;border-bottom:1px solid #f0f0f0;font-size:.75rem;">
              <span style="font-weight:700;">${j.jobNumber}</span>
              <span style="color:var(--muted);">${j.operator||'—'}</span>
              <span style="font-family:monospace;color:var(--accent);">${dispEl}</span>
            </div>`;
          }).join('')
        : `<div style="font-size:.72rem;color:var(--muted);padding:8px 0;text-align:center;">No active jobs</div>`;

      return `<div class="mcard ${cls}" id="${cardId}">
        <div class="mcard-header" onclick="toggleMCard('${cardId}')">
          <span style="width:8px;height:8px;border-radius:50%;background:${s.dot};flex-shrink:0;display:inline-block;"></span>
          <span class="mcard-name" style="margin:0;font-size:.78rem;">${m}</span>
          ${activeJobs.length ? `<span style="background:var(--green);color:#fff;font-size:.6rem;font-weight:700;padding:1px 6px;border-radius:10px;">${activeJobs.length}</span>` : ''}
          <span class="mcard-toggle">▼</span>
        </div>
        <div class="mcard-body" style="padding:6px 12px 10px;">
          ${jobList}
        </div>
      </div>`;
    }

    // ── Standard dept card ──
    const tot   = allRows.reduce((s,d) => s + (d.totalUnits||0), 0);
    const last  = activeJob || (allRows.length ? allRows[allRows.length-1] : null);
    const validComp = allRows.filter(d => d.status==='complete' && d.uph>0);
    const avg   = validComp.length
      ? Math.round(validComp.reduce((s,d)=>s+d.uph,0)/validComp.length)
      : null;

    let liveUph = null;
    if (activeJob && activeJob.status==='production' && activeJob.prodStart && activeJob.totalUnits>0) {
      const logs = activeJob.prodLogs || [];
      const endTime   = logs.length > 0 ? new Date(logs[logs.length-1].time) : new Date();
      const elapsedHrs = (endTime - new Date(activeJob.prodStart)) / 3600000;
      if (elapsedHrs > 0) liveUph = Math.round(activeJob.totalUnits / Math.max(0.01, elapsedHrs - (activeJob.totalDT||0)));
    }

    const displayUph = liveUph !== null ? liveUph : avg;
    const uphColor   = liveUph !== null ? 'color:var(--green)' : '';
    const dashProg   = (activeJob && activeJob.status==='production' && activeJob.qty>0)
      ? buildProgressBar(activeJob.totalUnits, getTargetQty(activeJob)) : '';

    return `<div class="mcard ${cls}" id="${cardId}">
      <div class="mcard-header" onclick="toggleMCard('${cardId}')">
        <span style="width:8px;height:8px;border-radius:50%;background:${s.dot};flex-shrink:0;display:inline-block;${s.cls==='s-run'?'box-shadow:0 0 5px '+s.dot+';':''}"></span>
        <span class="mcard-name" style="margin:0;font-size:.76rem;flex:1;">${m}</span>
        <span class="mcard-status ${s.cls}" style="font-size:.6rem;padding:2px 7px;">${s.lbl}</span>
        <span class="mcard-toggle">▼</span>
      </div>
      <div class="mcard-body">
        ${displayUph !== null
          ? `<div style="display:flex;align-items:baseline;gap:4px;margin:8px 0 2px;">
               <div class="mcard-uph" style="${uphColor};font-size:1.3rem;">${displayUph}</div>
               <div style="font-size:.65rem;color:var(--muted);">${liveUph!==null?'live u/hr':'avg u/hr'}</div>
             </div>`
          : `<div style="color:var(--muted);font-size:.78rem;padding:8px 0;">${activeJob?'Logging…':'No data today'}</div>`}
        ${dashProg}
        <hr class="mcard-divider">
        <div class="mcard-row"><span class="mrl">Job #</span><span class="mrv">${last?last.jobNumber:'—'}</span></div>
        <div class="mcard-row"><span class="mrl">Operator</span><span class="mrv">${last?last.operator:'—'}</span></div>
        <div class="mcard-row"><span class="mrl">Jobs Today</span><span class="mrv">${allRows.length}</span></div>
        <div class="mcard-row"><span class="mrl">Units Today</span><span class="mrv">${tot.toLocaleString()}</span></div>
      </div>
    </div>`;
  }).join('');
}

function toggleMCard(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('mc-expanded');
}


// Mark job as invoiced (stops elapsed days clock for Scheduling)
function markInvoiced(jobId) {
  if (!confirm('Mark this job as Invoiced? This will record the invoice date and stop the elapsed days counter.')) return;
  const all = getData();
  const job = all.find(j => j.id === jobId);
  if (!job) return;
  job.invoicedAt = localNow();
  // Keep status as 'complete' — job stays in Archive
  if (job.status === 'scheduled') job.status = 'complete';
  setData(all);
  renderArchive();
  toast('✓ Job ' + job.jobNumber + ' marked as Invoiced');
}


let previewTimers = false;
function togglePreviewTimers(btn) {
  previewTimers = !previewTimers;
  btn.textContent = previewTimers ? '✕ Close Preview' : '⚡ Preview Timer Alerts';
  btn.style.background = previewTimers ? 'rgba(230,126,34,.15)' : '';
  btn.style.borderColor = previewTimers ? 'var(--yellow)' : '';
  btn.style.color = previewTimers ? 'var(--yellow)' : '';
  const strip = document.getElementById('timer_preview_strip');
  strip.style.display = previewTimers ? 'flex' : 'none';
  renderActiveJobs();
}



// Safely parse a datetime-local string "YYYY-MM-DDTHH:MM" as LOCAL time
// Avoids browser inconsistencies with new Date(string) UTC vs local parsing
function parseLocalTime(str) {
  if (!str) return null;
  const clean = str.trim();
  const [datePart, timePart] = clean.split('T');
  if (!datePart || !timePart) return null;
  const [yr, mo, dy] = datePart.split('-').map(Number);
  const [hr, mn]     = timePart.split(':').map(Number);
  if (isNaN(yr) || isNaN(mo) || isNaN(dy) || isNaN(hr) || isNaN(mn)) return null;
  return new Date(yr, mo - 1, dy, hr, mn, 0, 0); // local time constructor — always correct
}

function getTimerFlags(j, activeDT, now) {
  // Preview mode forces all alerts on regardless of elapsed time
  if (previewTimers) {
    return {
      mrOvertime: j.status === 'makeready',
      logDue:     j.status === 'production' && !activeDT
    };
  }

  const nowMs = now.getTime();

  // Make Ready overtime — flag after 30 minutes
  let mrOvertime = false;
  if (j.status === 'makeready' && j.mrStart) {
    const t = parseLocalTime(j.mrStart);
    if (t) mrOvertime = (nowMs - t.getTime()) / 60000 >= 30;
  }

  // Production — flag if no log entry in last 30 minutes
  let logDue = false;
  if (j.status === 'production' && j.prodStart && !activeDT) {
    const logs    = j.prodLogs || [];
    const refStr  = logs.length > 0 ? logs[logs.length - 1].time : j.prodStart;
    const t       = parseLocalTime(refStr);
    if (t) logDue = (nowMs - t.getTime()) / 60000 >= 30;
  }

  return { mrOvertime, logDue };
}


function buildProgressBar(totalUnits, qty) {
  if (!qty || qty <= 0) return '';
  const pct     = Math.min(100, (totalUnits / qty) * 100);
  const fillCls = pct >= 100 ? 'p100' : pct >= 75 ? 'p75' : pct >= 50 ? 'p50' : pct >= 25 ? 'p25' : 'p0';
  const pctColor= pct >= 100 ? 'color:var(--accent2)' : pct >= 75 ? 'color:var(--green)' : pct >= 50 ? 'color:var(--accent)' : pct >= 25 ? 'color:var(--yellow)' : 'color:var(--gray)';
  return `<div class="prog-wrap">
    <div class="prog-header">
      <span class="prog-label">Job Progress</span>
      <span class="prog-pct" style="${pctColor}">${pct.toFixed(1)}%</span>
    </div>
    <div class="prog-track">
      <div class="prog-fill ${fillCls}" style="width:${pct}%"></div>
      <div class="prog-tick" style="left:25%"></div>
      <div class="prog-tick" style="left:50%"></div>
      <div class="prog-tick" style="left:75%"></div>
    </div>
    <div class="prog-footer">
      <span class="prog-foot-lbl">0</span>
      <span class="prog-foot-lbl">25%</span>
      <span class="prog-foot-lbl">50%</span>
      <span class="prog-foot-lbl">75%</span>
      <span class="prog-foot-lbl">100%</span>
    </div>
    <div class="prog-units">${totalUnits.toLocaleString()} / ${qty.toLocaleString()} units</div>
  </div>`;
}


let archSort = { col: 'date', dir: 'desc' };

// ── 3-DAY DATA RETENTION ──────────────────────────────────────────────────────
function purgeOldJobs() {
  const now     = new Date();
  const today   = now.toISOString().slice(0, 10); // yyyy-MM-dd
  const hour    = now.getHours();
  const minute  = now.getMinutes();
  const isAfterArchiveTime = (hour === 23 && minute >= 59) || hour === 0;

  const all = getData();
  let changed = false;

  all.forEach(j => {
    if (j.status !== 'complete') return;

    const completedDate = (j.completedAt || j.date || '').slice(0, 10);

    // Archive if: it's 11:59pm+ on ANY day, OR job was completed on a previous day
    // (handles devices that were off at 11:59pm)
    if (isAfterArchiveTime || (completedDate && completedDate < today)) {
      j.status     = 'archived';
      j.archivedAt = now.toISOString();
      j.lastUpdated = now.toISOString();
      changed = true;
    }
  });

  if (changed) {
    setData(all);
    renderActiveJobs();
    toast('🗂 Nightly archive complete — completed jobs moved to Archive');
  }
}

// ── ARCHIVE REOPEN ────────────────────────────────────────────
function searchArchiveAndReopen(val) {
  val = (val || '').trim();
  if (!val || val.length < 3) { toast('Enter at least 3 characters of the job number'); return; }

  const jobNum = formatJobNumber(val);
  const job    = getData().find(j =>
    (j.jobNumber || '').toLowerCase() === jobNum.toLowerCase() &&
    j.status === 'archived'
  );

  const resultEl = document.getElementById('arch_reopen_result');
  resultEl.className = '';

  if (!job) {
    resultEl.innerHTML = `
      <div style="background:#fff5f5;padding:14px 18px;border-radius:8px;border:1px solid #fcc;display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.3rem;">🔍</span>
        <div>
          <div style="font-weight:700;color:var(--red);">Job ${jobNum} not found in Archive</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px;">It may still be active — check the Active Jobs tab</div>
        </div>
      </div>`;
    return;
  }

  resultEl.innerHTML = `
    <div style="background:#fff;border:2px solid var(--accent);border-radius:8px;overflow:hidden;">
      <div style="background:var(--navy);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <span style="font-size:1rem;font-weight:800;color:#fff;">Job ${job.jobNumber}</span>
          <span style="font-size:.8rem;color:rgba(255,255,255,.55);margin-left:12px;">${job.customer||''}</span>
        </div>
        <button onclick="document.getElementById('arch_reopen_result').className='hidden'" style="background:none;border:none;color:rgba(255,255,255,.4);font-size:1rem;cursor:pointer;">✕</button>
      </div>
      <div style="padding:14px 18px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
        <div><div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);">Last Department</div>
          <div style="font-weight:700;">${job.opType||'—'}</div></div>
        <div><div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);">Archived</div>
          <div style="font-weight:700;">${(job.archivedAt||job.completedAt||'').slice(0,10)||'—'}</div></div>
        <div><div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);">Due Date</div>
          <div style="font-weight:700;">${job.dueDate||'—'}</div></div>
        <div><div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);">Quantity</div>
          <div style="font-weight:700;">${(job.qty||0).toLocaleString()}</div></div>
        <div style="margin-left:auto;">
          <button class="btn btn-primary" onclick="reopenFromArchive('${job.id}')">
            ↩ Reopen in Shipping/Inventory
          </button>
        </div>
      </div>
    </div>`;
}

function reopenFromArchive(jobId) {
  const job = getData().find(j => j.id === jobId);
  if (!job) return;
  if (!confirm('Reopen Job ' + job.jobNumber + '?\n\nThis will return it to Shipping/Inventory as "Awaiting Next" so your team can take action.')) return;

  job.status      = 'awaiting_next';
  job.opType      = 'Shipping/Inventory';
  job.archivedAt  = null;
  job.completedAt = null;
  job.lastUpdated = new Date().toISOString();

  saveJob(job);
  document.getElementById('arch_reopen_result').className = 'hidden';
  document.getElementById('arch_reopen_search').value = '';
  showView('active', document.getElementById('nav_active'));
  toast('↩ Job ' + job.jobNumber + ' returned to Shipping/Inventory');
}

function clearArchiveFilters() {
  document.getElementById('arch_search').value = '';
  document.getElementById('arch_op').value = '';
  document.getElementById('arch_from').value = '';
  document.getElementById('arch_to').value = '';
  renderArchive();
}

function renderArchive() {
  purgeOldJobs(); // moves old completed jobs to 'archived' status

  const all      = getData();
  // Archive shows jobs in 'archived' status OR 'complete' older than today
  const archived = all.filter(d => d.status === 'archived' || d.status === 'complete');

  // 3-day window default
  const cutoff   = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  const cutoffStr = new Date(cutoff.getTime() - cutoff.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);

  // Apply filters
  const search   = (document.getElementById('arch_search').value || '').toLowerCase();
  const opFilter = document.getElementById('arch_op').value;
  const fromDate = document.getElementById('arch_from').value || cutoffStr;
  const toDate   = document.getElementById('arch_to').value;

  const filtered = archived.filter(d => {
    if (opFilter && d.opType !== opFilter) return false;
    if (fromDate && d.date < fromDate) return false;
    if (toDate   && d.date > toDate)   return false;
    if (search && ![d.jobNumber, d.poNumber, d.operator, d.machine, d.paperType, d.opType]
      .join(' ').toLowerCase().includes(search)) return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let av = a[archSort.col] || '', bv = b[archSort.col] || '';
    if (typeof av === 'number') return archSort.dir === 'asc' ? av-bv : bv-av;
    return archSort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  // Summary strip
  const totalJobs  = filtered.length;
  const totalUnits = filtered.reduce((s,d) => s+d.totalUnits, 0);
  const avgUph     = filtered.filter(d=>d.uph>0).length
    ? Math.round(filtered.filter(d=>d.uph>0).reduce((s,d)=>s+d.uph,0) / filtered.filter(d=>d.uph>0).length) : 0;
  const totalDT    = filtered.reduce((s,d)=>s+(d.totalDT||0),0).toFixed(1);
  const totalHrs   = filtered.reduce((s,d)=>s+(d.prodHrs||0),0).toFixed(1);
  document.getElementById('arch_summary').innerHTML = `
    <div class="sc"><div class="sc-val">${totalJobs}</div><div class="sc-lbl">Total Jobs</div></div>
    <div class="sc"><div class="sc-val">${totalUnits.toLocaleString()}</div><div class="sc-lbl">Total Units</div></div>
    <div class="sc"><div class="sc-val">${avgUph}</div><div class="sc-lbl">Avg U/hr</div></div>
    <div class="sc"><div class="sc-val">${totalHrs}</div><div class="sc-lbl">Total Run hrs</div></div>
    <div class="sc"><div class="sc-val">${totalDT}</div><div class="sc-lbl">Total DT hrs</div></div>`;

  // Render each department
  renderArchiveSection('Scheduling',       'sched',   sorted.filter(d => d.opType === 'Scheduling'));
  renderArchiveSection('Prepress',         'prepress',sorted.filter(d => d.opType === 'Prepress'));
  renderArchiveSection('Press',            'press',   sorted.filter(d => d.opType === 'Press'));
  renderArchiveSection('Folding',          'fold',    sorted.filter(d => d.opType === 'Folding'));
  renderArchiveSection('Bindery',          'bind',    sorted.filter(d => d.opType === 'Bindery'));
  renderArchiveSection('Finishing',        'finish',  sorted.filter(d => d.opType === 'Finishing'));
  renderArchiveSection('Mailing',          'mail',    sorted.filter(d => d.opType === 'Mailing'));
  renderArchiveSection('Fulfillment',      'fulfill', sorted.filter(d => d.opType === 'Fulfillment'));
  renderArchiveSection('Shipping/Inventory','ship',   sorted.filter(d => d.opType === 'Shipping/Inventory'));
}

function archSortBy(col) {
  if (archSort.col === col) {
    archSort.dir = archSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    archSort.col = col;
    archSort.dir = 'desc';
  }
  renderArchive();
}

function renderArchiveSection(opType, cls, rows) {
  const countEl = document.getElementById('arch_'+cls+'_count');
  const tableEl = document.getElementById('arch_'+cls+'_table');

  countEl.textContent = rows.length + ' job' + (rows.length !== 1 ? 's' : '');

  if (!rows.length) {
    tableEl.innerHTML = '<div class="arch-empty">No completed jobs found for this department.</div>';
    return;
  }

  const thClass = col => archSort.col === col
    ? (archSort.dir === 'asc' ? 'sort-asc' : 'sort-desc') : '';

  const showColors  = opType === 'Press';
  const showFold    = opType === 'Folding';
  const showSched   = opType === 'Scheduling';

  tableEl.innerHTML = `<table class="arch-table">
    <thead><tr>
      <th class="${thClass('date')}"        onclick="archSortBy('date')">Date</th>
      <th class="${thClass('jobNumber')}"   onclick="archSortBy('jobNumber')">Job #</th>
      <th class="${thClass('poNumber')}"    onclick="archSortBy('poNumber')">PO #</th>
      <th class="${thClass('operator')}"    onclick="archSortBy('operator')">Operator</th>
      <th class="${thClass('machine')}"     onclick="archSortBy('machine')">Operation</th>
      <th class="${thClass('qty')}"         onclick="archSortBy('qty')">Qty</th>
      ${showSched ? `<th>Customer</th><th>Process</th><th>Days</th><th>Action</th>` : `
      <th class="${thClass('pages')}"       onclick="archSortBy('pages')">Pages</th>
      <th class="${thClass('sigs')}"        onclick="archSortBy('sigs')">Sigs</th>
      <th class="${thClass('paperSize')}"   onclick="archSortBy('paperSize')">Paper Size</th>
      <th class="${thClass('paperType')}"   onclick="archSortBy('paperType')">Paper Type</th>
      ${showColors ? `<th class="${thClass('colors')}" onclick="archSortBy('colors')">Colors</th>` : ''}
      ${showFold   ? `<th class="${thClass('foldType')}" onclick="archSortBy('foldType')">Fold Type</th>` : ''}
      <th class="${thClass('mrHrs')}"       onclick="archSortBy('mrHrs')">MR hrs</th>
      <th class="${thClass('prodHrs')}"     onclick="archSortBy('prodHrs')">Run hrs</th>
      <th class="${thClass('totalUnits')}"  onclick="archSortBy('totalUnits')">Units</th>
      <th class="${thClass('uph')}"         onclick="archSortBy('uph')">U/hr</th>
      <th class="${thClass('totalDT')}"     onclick="archSortBy('totalDT')">DT hrs</th>
      <th>DT Reasons</th>`}
    </tr></thead>
    <tbody>
    ${rows.map(d => {
      if (showSched) {
        const schedDate   = d.scheduledAt ? new Date(d.scheduledAt.replace('T',' ')) : null;
        const invoicedAt  = d.invoicedAt  ? new Date(d.invoicedAt.replace('T',' '))  : null;
        const elapsed     = schedDate && invoicedAt
          ? Math.floor((invoicedAt - schedDate) / 86400000)
          : schedDate ? Math.floor((new Date() - schedDate) / 86400000) : '—';
        const invoiced    = !!d.invoicedAt;
        return `<tr>
          <td class="mono">${d.date}</td>
          <td><strong>${d.jobNumber||'—'}</strong></td>
          <td class="mono">${d.poNumber||'—'}</td>
          <td>${d.operator||'—'}</td>
          <td><span class="arch-badge sched">${d.machine||'—'}</span></td>
          <td class="mono">${d.qty ? d.qty.toLocaleString() : '—'}</td>
          <td>${d.customer||'—'}</td>
          <td>${d.printProcess||'—'}</td>
          <td class="mono" style="${typeof elapsed==='number'&&elapsed>10?'color:var(--red);font-weight:700;':''}">${elapsed} day${elapsed!==1?'s':''}</td>
          <td>${invoiced
            ? `<span style="color:var(--green);font-weight:700;">✓ Invoiced ${d.invoicedAt.slice(0,10)}</span>`
            : `<button class="btn btn-success btn-sm" onclick="markInvoiced('${d.id}')">✓ Mark Invoiced</button>`}
          </td>
        </tr>`;
      }
      const dtReasons = d.downtime && d.downtime.length
        ? d.downtime.map(dt => dt.reason).filter(Boolean).join(', ')
        : '—';
      return `<tr>
        <td class="mono">${d.date}</td>
        <td><strong>${d.jobNumber||'—'}</strong></td>
        <td class="mono">${d.poNumber||'—'}</td>
        <td>${d.operator||'—'}</td>
        <td><span class="arch-badge ${cls}">${d.machine||'—'}</span></td>
        <td class="mono">${d.qty ? d.qty.toLocaleString() : '—'}</td>
        <td>${d.paperType||'—'}</td>
        ${showColors ? `<td>${d.colors||'—'}</td>` : ''}
        ${showFold   ? `<td>${d.foldType||'—'}</td>` : ''}
        <td class="mono">${d.mrHrs||0}</td>
        <td class="mono">${d.prodHrs||0}</td>
        <td class="mono"><strong>${(d.totalUnits||0).toLocaleString()}</strong></td>
        <td><span class="uph-pill">${d.uph||0}</span></td>
        <td>${(d.totalDT||0) > 0 ? `<span class="dt-pill">${d.totalDT}</span>` : '—'}</td>
        <td style="max-width:180px;white-space:normal;font-size:.72rem;">${dtReasons}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

function exportArchive() {
  const all      = getData().filter(d => d.status === 'complete');
  const opFilter = document.getElementById('arch_op').value;
  const search   = (document.getElementById('arch_search').value || '').toLowerCase();
  const fromDate = document.getElementById('arch_from').value;
  const toDate   = document.getElementById('arch_to').value;

  const rows = all.filter(d => {
    if (opFilter && d.opType !== opFilter) return false;
    if (fromDate && d.date < fromDate) return false;
    if (toDate   && d.date > toDate)   return false;
    if (search && ![d.jobNumber, d.poNumber, d.operator, d.machine].join(' ').toLowerCase().includes(search)) return false;
    return true;
  });

  if (!rows.length) { alert('No jobs to export with current filters.'); return; }

  const headers = ['Date','Job #','PO #','Operation','Machine','Operator','Qty','Pages','Sigs',
    'Paper Size','Paper Type','Colors','Fold Type','MR Hrs','Run Hrs','Net Prod Hrs',
    'Total Units','U/hr','DT Hrs','DT Reasons'];

  const csv = [headers, ...rows.map(d => [
    d.date, d.jobNumber, d.poNumber, d.opType, d.machine, d.operator,
    d.qty, d.pages, d.sigs, d.paperSize, d.paperType,
    d.colors||'', d.foldType||'',
    d.mrHrs||0, d.prodHrs||0, d.netProdHrs||d.prodHrs||0,
    d.totalUnits, d.uph, d.totalDT||0,
    (d.downtime||[]).map(dt=>dt.reason).filter(Boolean).join('; ')
  ])].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'job_archive_' + localToday() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('Archive exported ✓');
}


function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2600);
}

// ── GLOBAL ERROR DISPLAY ─────────────────────────────────────────────────────
window.onerror = function(msg, src, line) {
  var d = document.getElementById('_err');
  if (!d) {
    d = document.createElement('div');
    d.id = '_err';
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#c0392b;color:#fff;padding:10px 16px;z-index:99999;font-family:monospace;font-size:12px;';
    document.body.appendChild(d);
  }
  d.innerHTML += '<div>⚠ Line ' + line + ': ' + msg + '</div>';
};

async function manualSync() {
  const ok = await loadJobsFromSheets(false);
  if (ok) { renderActiveJobs(); toast('✓ Jobs refreshed from Google Sheets'); }
  else toast('⚡ Working offline — showing cached data');
}

async function hardReset() {
  if (!currentUser || currentUser.role !== 'admin') {
    toast('Admin access required'); return;
  }
  if (!confirm(
    '⚠ HARD RESET — Are you sure?\n\n' +
    'This will permanently delete ALL jobs from:\n' +
    '  • Google Sheets (MIS Jobs tab)\n' +
    '  • This device\'s local memory\n\n' +
    'All other devices will sync to empty within 30 seconds.\n\n' +
    'This cannot be undone. Continue?'
  )) return;

  // 1. Stop any pending syncs immediately
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncQueue   = {};
  _db          = [];
  _memStore    = [];

  // 2. Clear localStorage on this device
  try { localStorage.removeItem('mis_jobs'); } catch(e) {}
  try { localStorage.clear(); } catch(e) {}

  // 3. Tell Sheets to delete all job rows
  updateSyncStatus('syncing');
  toast('⟳ Clearing Sheets…');

  try {
    const res  = await fetch(SHEET_URL + '?action=clearJobs&ts=' + Date.now());
    const data = await res.json();
    if (data.status === 'ok') {
      renderActiveJobs();
      updateSyncStatus('ok', 0);
      toast('✓ Hard reset complete — all jobs cleared from Sheets and this device. Other devices will clear on next sync.');
    } else {
      toast('⚠ Sheets error: ' + (data.message || 'unknown'));
    }
  } catch(e) {
    // Even if Sheets call fails, local is clear
    renderActiveJobs();
    toast('⚡ Local cleared. Could not reach Sheets — go to MIS Jobs tab and manually delete all rows below the header.');
  }
}

function clearAllJobsLocal() { hardReset(); } // backward compat

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Wire login button
  var loginBtn = document.getElementById('login_btn');
  if (loginBtn) loginBtn.addEventListener('click', doLogin);

  var lu = document.getElementById('login_user');
  var lp = document.getElementById('login_pass');
  if (lu) lu.addEventListener('keydown', function(e){ if(e.key==='Enter') lp && lp.focus(); });
  if (lp) lp.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });

  var pt = document.getElementById('pw_toggle');
  if (pt) pt.addEventListener('click', function() {
    var inp = document.getElementById('login_pass');
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    pt.textContent = show ? 'HIDE' : 'SHOW';
  });

  // Clock
  try {
    setInterval(function(){ var c=document.getElementById('clock'); if(c) c.textContent=new Date().toLocaleTimeString(); }, 1000);
    document.getElementById('clock').textContent = new Date().toLocaleTimeString();
  } catch(e){}

  // Init app
  try { purgeOldJobs(); } catch(e){}
  // Check for nightly archive every minute
  setInterval(function() { try { purgeOldJobs(); } catch(e){} }, 60 * 1000);
  try { checkLogin(); } catch(e){ console.error('checkLogin:',e); }

  // Load jobs from Sheets then start auto-sync
  loadJobsFromSheets(false).then(function(ok) {
    try { renderActiveJobs(); } catch(e){ console.error('renderActiveJobs:',e); }
    startAutoSync();
  }).catch(function() {
    try { renderActiveJobs(); } catch(e){ console.error('renderActiveJobs:',e); }
  });
});
