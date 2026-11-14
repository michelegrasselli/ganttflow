/* ============================================================
   GanttFlow — applicazione
   Pianificatore di attività con diagramma di Gantt, dipendenze
   finish-to-start, export PDF e file di progetto JSON.
   ============================================================ */
(function () {
  'use strict';

  /* --------------------------- costanti --------------------------- */
  var ZOOMS = [
    { px: 36, label: 'Dettaglio' },
    { px: 20, label: 'Standard' },
    { px: 10, label: 'Compatto' },
    { px: 4.5, label: 'Panoramica' }
  ];
  var ROW_H = 44;
  var PALETTE = ['#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b'];
  var SWATCHES = ['#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b', '#0f172a', '#94a3b8'];
  var LINK_TYPES = {
    FS: { label: 'Inizia dopo', short: 'dopo' },
    SS: { label: 'Inizia con', short: 'con' },
    FF: { label: 'Finisce prima', short: 'prima' }
  };
  var LINK_ORDER = ['FS', 'SS', 'FF'];
  var STORAGE_KEY = 'ganttflow.project.v1';
  var LAYOUT_KEY = 'ganttflow.layout.v1';
  var MAX_TASKS = 500;
  var MAX_DURATION = 3650;
  var MAX_HIDDEN = 50;
  var MAX_CUSTOM = 200;
  var COL_MIN = [80, 34, 76, 76, 118, 36, 54, 48];
  var COL_MAX = [640, 160, 260, 260, 420, 120, 180, 120];
  /* Configurazione colonne per tipo di lavoro (Gantt / tempo ciclo). */
  var COLS = {
    gantt: { min: COL_MIN, max: COL_MAX, def: [121, 46, 104, 104, 168, 44, 64, 60], key: 'ganttflow.layout.v1' },
    cycle: {
      min: [80, 40, 48, 48, 118, 36, 48],
      max: [640, 160, 200, 200, 420, 120, 120],
      def: [194, 64, 70, 70, 168, 44, 60],
      key: 'ganttflow.layout.cycle.v1'
    }
  };
  /* Zoom del tempo ciclo: pixel per secondo. */
  var CYCLE_ZOOMS = [
    { px: 100, label: 'Dettaglio' },
    { px: 40, label: 'Standard' },
    { px: 14, label: 'Compatto' },
    { px: 4, label: 'Panoramica' }
  ];
  var CYCLE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
  var CYCLE_HEAD_H = 54;
  var MAX_SHEETS = 50;
  var MAX_SECONDS = 86400;
  var MAX_LAG_SECONDS = 3600;
  var DAY_MS = 86400000;
  var WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  var MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');
  var FIXED_HOLIDAYS = {
    '01-01': 'Capodanno',
    '01-06': 'Epifania',
    '04-25': 'Festa della Liberazione',
    '05-01': 'Festa dei Lavoratori',
    '06-02': 'Festa della Repubblica',
    '08-15': 'Ferragosto',
    '11-01': 'Ognissanti',
    '12-08': 'Immacolata Concezione',
    '12-25': 'Natale',
    '12-26': 'Santo Stefano'
  };

  /* --------------------------- stato --------------------------- */
  var state = {
    project: null,
    zoom: 1,
    selectedId: null
  };
  var range = null;
  var timeMap = null;
  var headerSig = '';
  var saveTimer = null;
  var colorCursor = 0;
  var customHolidayIndex = {};
  var colDrag = null;
  var cycleScale = null;

  /* --------------------------- riferimenti DOM --------------------------- */
  var board, grid, emptyEl, statsbar, headerRow, headTimeline, linksSvg;
  var saveStatusEl, toastWrapEl, projectNameEl, projectMetaEl;
  var modalEl, modalTitleEl, modalTextEl, modalOkEl, modalCancelEl, modalIconEl;
  var tlChip, tlChipText, chipRaf = 0;
  var hideStartEl, hideEndEl, hiddenChipsEl, customDateEl, customNameEl, customChipsEl;
  var sheetBarEl, sheetTabsEl, importSheetSel, typeModalEl, typeModalResolve = null;
  var ctCalcEl, calcFromSel, calcToSel, calcResultEl, calcDetailEl, calcSplitEl;
  var SPLIT_KEY = 'ganttflow.split.cycle.v1';
  var BOARD_MIN_H = 140;
  var splitDrag = null;

  /* ============================================================
     UTILITÀ
     ============================================================ */
  function pad2(n) { return String(n).padStart(2, '0'); }

  function parseISO(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }
  function isISO(s) { return !!parseISO(s); }
  function toISO(dt) { return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate()); }
  function todayISO() {
    var n = new Date();
    return toISO(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
  }
  function addDays(iso, n) {
    var d = parseISO(iso);
    if (!d) return iso;
    d.setUTCDate(d.getUTCDate() + (n | 0));
    return toISO(d);
  }
  function diffDays(a, b) {
    var da = parseISO(a), db = parseISO(b);
    if (!da || !db) return 0;
    return Math.round((db.getTime() - da.getTime()) / DAY_MS);
  }
  function startOfMonth(iso) {
    var d = parseISO(iso);
    if (!d) return todayISO();
    return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }
  function endOfMonth(iso) {
    var d = parseISO(iso);
    if (!d) return todayISO();
    return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
  }
  function dayOfWeek(iso) {
    var d = parseISO(iso);
    return d ? d.getUTCDay() : 0;
  }

  /* --------------------- festivi italiani --------------------- */
  var holidayCache = {};
  function easterISO(year) {
    var a = year % 19, b = Math.floor(year / 100), c = year % 100;
    var d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return toISO(new Date(Date.UTC(year, month - 1, day)));
  }
  function holidaysForYear(year) {
    if (holidayCache[year]) return holidayCache[year];
    var map = {};
    Object.keys(FIXED_HOLIDAYS).forEach(function (md) { map[year + '-' + md] = FIXED_HOLIDAYS[md]; });
    var easter = easterISO(year);
    map[easter] = 'Pasqua';
    map[addDays(easter, 1)] = 'Lunedì dell’Angelo';
    holidayCache[year] = map;
    return map;
  }
  function builtinHolidayName(iso) {
    if (!isISO(iso)) return null;
    return holidaysForYear(+iso.slice(0, 4))[iso] || null;
  }
  function customIndexFrom(list) {
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function (d) {
      if (d && isISO(d.date)) map[d.date] = typeof d.name === 'string' && d.name.trim() ? d.name.trim() : 'Festivo personalizzato';
    });
    return map;
  }
  function rebuildHolidayIndex() {
    customHolidayIndex = customIndexFrom(state.project ? state.project.customHolidays : []);
  }
  function holidayName(iso) {
    if (!isISO(iso)) return null;
    return customHolidayIndex[iso] || builtinHolidayName(iso);
  }
  function isWeekend(iso) {
    var wd = dayOfWeek(iso);
    return wd === 0 || wd === 6;
  }

  /* ---------------- giorni considerati nella durata ----------------
     Le tre spunte (sabati, domeniche, festivi) decidono quali giorni
     contano nella durata. Se una spunta è assente, quel giorno viene
     saltato nel calcolo della durata. */
  function countsDay(iso, t) {
    if (!t) return true;
    var wd = dayOfWeek(iso);
    if (!t.countSat && wd === 6) return false;
    if (!t.countSun && wd === 0) return false;
    if (!t.countHol && holidayName(iso)) return false;
    return true;
  }
  function nextCounted(iso, t) {
    var cur = iso, guard = 0;
    while (!countsDay(cur, t) && guard++ < 4000) cur = addDays(cur, 1);
    return cur;
  }
  function prevCounted(iso, t) {
    var cur = iso, guard = 0;
    while (!countsDay(cur, t) && guard++ < 4000) cur = addDays(cur, -1);
    return cur;
  }
  function endFromStart(start, duration, t) {
    var cur = nextCounted(start, t);
    var left = Math.max(1, duration | 0) - 1;
    var guard = 0;
    while (left > 0 && guard++ < 20000) {
      cur = addDays(cur, 1);
      if (countsDay(cur, t)) left--;
    }
    return cur;
  }
  function startFromEnd(end, duration, t) {
    var cur = prevCounted(end, t);
    var left = Math.max(1, duration | 0) - 1;
    var guard = 0;
    while (left > 0 && guard++ < 20000) {
      cur = addDays(cur, -1);
      if (countsDay(cur, t)) left--;
    }
    return cur;
  }
  function countDays(start, end, t) {
    if (diffDays(start, end) < 0) return 0;
    var n = 0, cur = start, guard = 0;
    while (cur <= end && guard++ < 40000) {
      if (countsDay(cur, t)) n++;
      cur = addDays(cur, 1);
    }
    return n;
  }
  function fmtLong(iso) {
    var d = parseISO(iso);
    return d ? d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : '—';
  }
  function fmtShort(iso) {
    var d = parseISO(iso);
    return d ? d.getUTCDate() + ' ' + MONTHS_SHORT[d.getUTCMonth()] : '—';
  }
  function fmtNum(iso) {
    var d = parseISO(iso);
    return d ? pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() : '—';
  }
  function fmtTime(dt) {
    return pad2(dt.getHours()) + ':' + pad2(dt.getMinutes());
  }
  /* Numero di settimana ISO 8601 (lunedì–domenica). */
  function isoWeek(iso) {
    var d = parseISO(iso);
    if (!d) return { year: 0, week: 0 };
    var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    var shift = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - shift + 3);
    var year = t.getUTCFullYear();
    var jan4 = new Date(Date.UTC(year, 0, 4));
    var jan4Shift = (jan4.getUTCDay() + 6) % 7;
    var week1Thursday = new Date(Date.UTC(year, 0, 4 - jan4Shift + 3));
    var week = 1 + Math.round((t.getTime() - week1Thursday.getTime()) / (7 * 86400000));
    return { year: year, week: week };
  }
  function clampInt(v, min, max, def) {
    var n = parseInt(v, 10);
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, n));
  }
  /* ---------------- secondi (tempo ciclo) ---------------- */
  function round1(v) { return Math.round(v * 10) / 10; }
  function clampSec(v, min, max, def) {
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    if (!Number.isFinite(n)) return def;
    return round1(Math.min(max, Math.max(min, n)));
  }
  function secText(v) {
    var r = round1(v || 0);
    return String(r);
  }
  function fmtSec(v) {
    return secText(v).replace('.', ',') + ' s';
  }
  function hexColor(v) {
    return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
  }
  function isLight(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    function f(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) > 0.56;
  }
  function slugify(s) {
    var out = String(s || 'progetto').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return out || 'progetto';
  }
  function uid() {
    return 't' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);
  }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function download(filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  /* ============================================================
     MODELLO
     ============================================================ */
  function normalizeHiddenRanges(raw) {
    var ranges = [];
    (Array.isArray(raw) ? raw : []).forEach(function (r) {
      var a = null, b = null;
      if (typeof r === 'string') { a = b = r; }
      else if (r && typeof r === 'object') { a = r.start; b = r.end || r.start; }
      if (!isISO(a) || !isISO(b)) return;
      if (a > b) { var tmp = a; a = b; b = tmp; }
      ranges.push({ start: a, end: b });
    });
    ranges.sort(function (x, y) { return x.start < y.start ? -1 : (x.start > y.start ? 1 : 0); });
    var out = [];
    ranges.forEach(function (r) {
      var last = out[out.length - 1];
      if (last && diffDays(last.end, r.start) <= 1) {
        if (r.end > last.end) last.end = r.end;
      } else {
        out.push({ start: r.start, end: r.end });
      }
    });
    return out.slice(0, MAX_HIDDEN);
  }

  function normalizeCustomHolidays(raw) {
    var map = {};
    (Array.isArray(raw) ? raw : []).forEach(function (item) {
      var date = null, name = '';
      if (typeof item === 'string') date = item;
      else if (item && typeof item === 'object') { date = item.date || item.start || item.end; name = item.name; }
      if (!isISO(date) || map[date]) return;
      name = typeof name === 'string' ? name.trim().slice(0, 60) : '';
      map[date] = { date: date, name: name || 'Festivo personalizzato' };
    });
    return Object.keys(map).sort().map(function (d) { return map[d]; }).slice(0, MAX_CUSTOM);
  }

  function hiddenRanges() {
    return state.project && Array.isArray(state.project.hiddenRanges) ? state.project.hiddenRanges : [];
  }

  function makeProject(name, tasks) {
    var now = new Date().toISOString();
    return {
      type: 'gantt',
      name: name || 'Nuovo progetto',
      createdAt: now,
      updatedAt: now,
      tasks: tasks || [],
      hiddenRanges: [],
      customHolidays: []
    };
  }

  function nextColor() {
    return PALETTE[colorCursor++ % PALETTE.length];
  }

  function makeTask(partial) {
    var t = {
      id: uid(),
      name: 'Nuova attività',
      start: todayISO(),
      end: todayISO(),
      duration: 1,
      color: nextColor(),
      predecessorId: null,
      link: 'FS',
      lag: 0,
      countSat: false,
      countSun: false,
      countHol: false
    };
    if (partial) Object.keys(partial).forEach(function (k) { if (partial[k] !== undefined) t[k] = partial[k]; });
    t.countSat = t.countSat === true;
    t.countSun = t.countSun === true;
    t.countHol = t.countHol === true;
    if (!isISO(t.start)) t.start = todayISO();
    t.start = nextCounted(t.start, t);
    t.duration = clampInt(t.duration, 1, MAX_DURATION, 1);
    if (!isISO(t.end)) t.end = endFromStart(t.start, t.duration, t);
    return t;
  }

  function isCycle() { return !!state.project && state.project.type === 'cycle'; }
  function sheets() { return isCycle() && Array.isArray(state.project.sheets) ? state.project.sheets : []; }
  function sheetById(id) {
    var list = sheets();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function activeSheet() {
    if (!isCycle()) return null;
    var s = sheetById(state.project.activeSheet);
    if (!s && sheets().length) {
      s = sheets()[0];
      state.project.activeSheet = s.id;
    }
    return s;
  }
  function tasks() {
    if (!state.project) return [];
    if (isCycle()) {
      var s = activeSheet();
      return s ? s.tasks : [];
    }
    return state.project.tasks;
  }
  function setTasks(list) {
    if (isCycle()) {
      var s = activeSheet();
      if (s) s.tasks = list;
    } else {
      state.project.tasks = list;
    }
  }

  function taskById(id) {
    var list = tasks();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function indexById(id) {
    var list = tasks();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  function wouldCycle(taskId, predId) {
    var guard = 0;
    var cur = predId;
    while (cur && guard++ < MAX_TASKS + 1) {
      if (cur === taskId) return true;
      var t = taskById(cur);
      cur = t ? t.predecessorId : null;
    }
    return false;
  }

  /* Ricostruisce durate, date e catene di dipendenza in ordine topologico. */
  function recalc() {
    if (isCycle()) { recalcCycle(); return; }
    var list = tasks();
    if (!list.length) return;
    rebuildHolidayIndex();
    var map = {};
    list.forEach(function (t) { map[t.id] = t; });

    list.forEach(function (t) {
      t.countSat = t.countSat === true;
      t.countSun = t.countSun === true;
      t.countHol = t.countHol === true;
      if (!isISO(t.start)) t.start = todayISO();
      if (!isISO(t.end)) t.end = endFromStart(t.start, Math.max(1, t.duration), t);
      t.duration = clampInt(t.duration, 1, MAX_DURATION, 1);
      t.lag = clampInt(t.lag, 0, 365, 0);
      t.link = LINK_TYPES[t.link] ? t.link : 'FS';
      t.color = hexColor(t.color) || '#6366f1';
      t.name = typeof t.name === 'string' ? t.name : 'Attività';
      if (t.predecessorId && !map[t.predecessorId]) t.predecessorId = null;
      if (t.predecessorId === t.id) t.predecessorId = null;
    });

    var visited = {};
    var order = [];
    function visit(t, stack) {
      if (visited[t.id]) return;
      if (stack[t.id]) { t.predecessorId = null; return; }
      stack[t.id] = true;
      if (t.predecessorId && map[t.predecessorId]) visit(map[t.predecessorId], stack);
      delete stack[t.id];
      visited[t.id] = true;
      order.push(t);
    }
    list.forEach(function (t) { visit(t, {}); });

    order.forEach(function (t) {
      t.duration = clampInt(t.duration, 1, MAX_DURATION, 1);
      if (t.predecessorId && map[t.predecessorId]) {
        var p = map[t.predecessorId];
        if (t.link === 'SS') {
          t.start = nextCounted(addDays(p.start, t.lag), t);
          t.end = endFromStart(t.start, t.duration, t);
        } else if (t.link === 'FF') {
          t.end = prevCounted(addDays(p.end, -(1 + t.lag)), t);
          t.start = startFromEnd(t.end, t.duration, t);
        } else {
          t.start = nextCounted(addDays(p.end, 1 + t.lag), t);
          t.end = endFromStart(t.start, t.duration, t);
        }
      } else {
        t.start = nextCounted(t.start, t);
        t.end = endFromStart(t.start, t.duration, t);
      }
    });
  }

  function sanitizeProject(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tasks)) {
      throw new Error('Formato non valido: manca l\'elenco delle attività.');
    }
    var now = new Date().toISOString();
    var customs = normalizeCustomHolidays(raw.customHolidays);
    var project = {
      type: 'gantt',
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Progetto importato',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
      tasks: [],
      hiddenRanges: normalizeHiddenRanges(raw.hiddenRanges),
      customHolidays: customs
    };
    var previousIndex = customHolidayIndex;
    customHolidayIndex = customIndexFrom(customs);
    try {
      var ids = {};
      raw.tasks.slice(0, MAX_TASKS).forEach(function (src, i) {
        if (!src || typeof src !== 'object') return;
        var id = typeof src.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(src.id) ? src.id : uid();
        while (ids[id]) id = uid();
        ids[id] = true;
        var flags = {
          countSat: src.countSat === true,
          countSun: src.countSun === true,
          countHol: src.countHol === true
        };
        var start = nextCounted(isISO(src.start) ? src.start : todayISO(), flags);
        var duration = clampInt(src.duration, 1, MAX_DURATION, 0);
        var end = isISO(src.end) ? prevCounted(src.end, flags) : null;
        if (!duration) {
          duration = end && diffDays(start, end) >= 0
            ? Math.max(1, countDays(start, end, flags))
            : 1;
        }
        if (!end || diffDays(start, end) < 0) end = endFromStart(start, duration, flags);
        project.tasks.push({
          id: id,
          name: typeof src.name === 'string' && src.name.trim() ? src.name.trim().slice(0, 120) : 'Attività ' + (i + 1),
          start: start,
          end: end,
          duration: duration,
          color: hexColor(src.color) || PALETTE[i % PALETTE.length],
          predecessorId: typeof src.predecessorId === 'string' ? src.predecessorId : null,
          link: LINK_TYPES[src.link] ? src.link : 'FS',
          lag: clampInt(src.lag, 0, 365, 0),
          countSat: flags.countSat,
          countSun: flags.countSun,
          countHol: flags.countHol
        });
      });
      var byId = {};
      project.tasks.forEach(function (t) { byId[t.id] = t; });
      project.tasks.forEach(function (t) {
        if (t.predecessorId && !byId[t.predecessorId]) t.predecessorId = null;
        if (t.predecessorId === t.id) t.predecessorId = null;
      });
    } finally {
      customHolidayIndex = previousIndex;
    }
    return project;
  }

  function demoProject() {
    var list = [];
    var base = todayISO();
    var dow = dayOfWeek(base);
    var start = addDays(base, (8 - dow) % 7);
    var seed = [
      ['Brief e ricerca', 5, '#6366f1', null, 'FS', 0],
      ['Wireframe UX', 6, '#0ea5e9', 0, 'FS', 0],
      ['Design UI', 8, '#a855f7', 1, 'SS', 0],
      ['Sviluppo frontend', 12, '#14b8a6', 2, 'FS', 0],
      ['Sviluppo backend', 10, '#f59e0b', 3, 'SS', 0],
      ['Test e QA', 5, '#ef4444', 3, 'FS', 0],
      ['Lancio', 1, '#22c55e', 5, 'FS', 0],
      ['Revisione finale', 3, '#ec4899', 6, 'FF', 0]
    ];
    seed.forEach(function (s, i) {
      var t = makeTask({
        name: s[0],
        start: start,
        duration: s[1],
        color: s[2],
        predecessorId: s[3] === null ? null : list[s[3]].id,
        link: s[4],
        lag: s[5]
      });
      list.push(t);
    });
    var p = makeProject('Lancio nuovo sito web', list);
    state.project = p;
    recalc();
    return p;
  }

  function countLinks() {
    return tasks().filter(function (t) { return t.predecessorId && taskById(t.predecessorId); }).length;
  }

  /* ============================================================
     MODELLO — STIMA TEMPO CICLO
     Attività in secondi (decimi), organizzate in pagine. Una pagina
     può essere importata in un'altra come attività collegata: nome
     della pagina e durata pari al suo tempo ciclo, sempre aggiornati.
     ============================================================ */
  function makeSheet(name, list) {
    return { id: uid(), name: name || 'Pagina 1', tasks: list || [], calcFrom: null, calcTo: null };
  }

  function makeCycleProject(name, sheetList) {
    var now = new Date().toISOString();
    var list = sheetList && sheetList.length ? sheetList : [makeSheet('Pagina 1', [])];
    return {
      type: 'cycle',
      name: name || 'Nuova stima tempo ciclo',
      createdAt: now,
      updatedAt: now,
      activeSheet: list[0].id,
      sheets: list
    };
  }

  function makeCycleTask(partial) {
    var t = {
      id: uid(),
      name: 'Nuova attività',
      start: 0,
      end: 0,
      duration: 1,
      color: nextColor(),
      predecessorId: null,
      link: 'FS',
      lag: 0,
      sourceSheetId: null
    };
    if (partial) Object.keys(partial).forEach(function (k) { if (partial[k] !== undefined) t[k] = partial[k]; });
    t.start = clampSec(t.start, 0, MAX_SECONDS, 0);
    t.duration = clampSec(t.duration, t.sourceSheetId ? 0 : 0.1, MAX_SECONDS, 1);
    t.lag = clampSec(t.lag, 0, MAX_LAG_SECONDS, 0);
    t.end = round1(t.start + t.duration);
    return t;
  }

  /* Tempo ciclo di una pagina: dal secondo 0 alla fine dell'ultima attività. */
  function sheetCycleTime(sheet) {
    var max = 0;
    (sheet && Array.isArray(sheet.tasks) ? sheet.tasks : []).forEach(function (t) {
      if (t.end > max) max = t.end;
    });
    return round1(max);
  }

  /* true se la pagina `fromId` contiene (anche indirettamente) la pagina `targetId`. */
  function sheetDependsOn(fromId, targetId, seen) {
    if (fromId === targetId) return true;
    seen = seen || {};
    if (seen[fromId]) return false;
    seen[fromId] = true;
    var s = sheetById(fromId);
    if (!s) return false;
    return s.tasks.some(function (t) {
      return t.sourceSheetId && sheetDependsOn(t.sourceSheetId, targetId, seen);
    });
  }

  function canImportSheet(sourceId, intoId) {
    return sourceId !== intoId && !!sheetById(sourceId) && !sheetDependsOn(sourceId, intoId);
  }

  function recalcSheetTasks(list) {
    var map = {};
    list.forEach(function (t) { map[t.id] = t; });
    list.forEach(function (t) {
      t.lag = clampSec(t.lag, 0, MAX_LAG_SECONDS, 0);
      t.link = LINK_TYPES[t.link] ? t.link : 'FS';
      t.color = hexColor(t.color) || '#6366f1';
      t.name = typeof t.name === 'string' ? t.name : 'Attività';
      if (t.predecessorId && !map[t.predecessorId]) t.predecessorId = null;
      if (t.predecessorId === t.id) t.predecessorId = null;
    });

    var visited = {};
    var order = [];
    function visit(t, stack) {
      if (visited[t.id]) return;
      if (stack[t.id]) { t.predecessorId = null; return; }
      stack[t.id] = true;
      if (t.predecessorId && map[t.predecessorId]) visit(map[t.predecessorId], stack);
      delete stack[t.id];
      visited[t.id] = true;
      order.push(t);
    }
    list.forEach(function (t) { visit(t, {}); });

    order.forEach(function (t) {
      t.duration = clampSec(t.duration, t.sourceSheetId ? 0 : 0.1, MAX_SECONDS, 1);
      var start;
      if (t.predecessorId && map[t.predecessorId]) {
        var p = map[t.predecessorId];
        if (t.link === 'SS') start = p.start + t.lag;
        else if (t.link === 'FF') start = p.end - t.lag - t.duration;
        else start = p.end + t.lag;
      } else {
        start = clampSec(t.start, 0, MAX_SECONDS, 0);
      }
      t.start = round1(Math.max(0, Math.min(MAX_SECONDS, start)));
      t.end = round1(t.start + t.duration);
    });
  }

  /* Ricalcola tutte le pagine: prima quelle importate, poi quelle che le contengono. */
  function recalcCycle() {
    if (!Array.isArray(state.project.sheets) || !state.project.sheets.length) {
      state.project.sheets = [makeSheet('Pagina 1', [])];
    }
    var list = state.project.sheets;
    if (!sheetById(state.project.activeSheet)) state.project.activeSheet = list[0].id;
    var byId = {};
    list.forEach(function (s) { byId[s.id] = s; });
    var done = {}, visiting = {};
    function visitSheet(s) {
      if (done[s.id]) return;
      visiting[s.id] = true;
      s.tasks.forEach(function (t) {
        if (!t.sourceSheetId) return;
        var src = byId[t.sourceSheetId];
        if (!src || src === s || visiting[src.id]) {
          t.sourceSheetId = null;
          if (!(t.duration >= 0.1)) t.duration = 0.1;
          return;
        }
        visitSheet(src);
      });
      s.tasks.forEach(function (t) {
        var src = t.sourceSheetId ? byId[t.sourceSheetId] : null;
        if (!src) return;
        t.duration = sheetCycleTime(src);
        t.name = src.name;
      });
      recalcSheetTasks(s.tasks);
      ['calcFrom', 'calcTo'].forEach(function (k) {
        if (s[k] && !s.tasks.some(function (t) { return t.id === s[k]; })) s[k] = null;
        if (!s[k]) s[k] = null;
      });
      delete visiting[s.id];
      done[s.id] = true;
    }
    list.forEach(function (s) { visitSheet(s); });
  }

  function validId(v) {
    return typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
  }

  function sanitizeCycleProject(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sheets) || !raw.sheets.length) {
      throw new Error('Formato non valido: mancano le pagine del tempo ciclo.');
    }
    var now = new Date().toISOString();
    var sheetIds = {}, taskIds = {};
    var out = [];
    raw.sheets.slice(0, MAX_SHEETS).forEach(function (src, si) {
      if (!src || typeof src !== 'object') return;
      var id = validId(src.id) ? src.id : uid();
      while (sheetIds[id]) id = uid();
      sheetIds[id] = true;
      var sheet = {
        id: id,
        name: typeof src.name === 'string' && src.name.trim() ? src.name.trim().slice(0, 60) : 'Pagina ' + (si + 1),
        tasks: [],
        calcFrom: validId(src.calcFrom) ? src.calcFrom : null,
        calcTo: validId(src.calcTo) ? src.calcTo : null
      };
      (Array.isArray(src.tasks) ? src.tasks : []).slice(0, MAX_TASKS).forEach(function (t, i) {
        if (!t || typeof t !== 'object') return;
        var tid = validId(t.id) ? t.id : uid();
        while (taskIds[tid]) tid = uid();
        taskIds[tid] = true;
        var start = clampSec(t.start, 0, MAX_SECONDS, 0);
        var dur = clampSec(t.duration, 0, MAX_SECONDS, NaN);
        if (!Number.isFinite(dur)) {
          var end = clampSec(t.end, 0, MAX_SECONDS, NaN);
          dur = Number.isFinite(end) && end > start ? round1(end - start) : 1;
        }
        sheet.tasks.push({
          id: tid,
          name: typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 120) : 'Attività ' + (i + 1),
          start: start,
          end: round1(start + dur),
          duration: dur,
          color: hexColor(t.color) || PALETTE[i % PALETTE.length],
          predecessorId: typeof t.predecessorId === 'string' ? t.predecessorId : null,
          link: LINK_TYPES[t.link] ? t.link : 'FS',
          lag: clampSec(t.lag, 0, MAX_LAG_SECONDS, 0),
          sourceSheetId: typeof t.sourceSheetId === 'string' ? t.sourceSheetId : null
        });
      });
      var byId = {};
      sheet.tasks.forEach(function (t) { byId[t.id] = t; });
      sheet.tasks.forEach(function (t) {
        if (t.predecessorId && !byId[t.predecessorId]) t.predecessorId = null;
        if (t.predecessorId === t.id) t.predecessorId = null;
      });
      out.push(sheet);
    });
    if (!out.length) throw new Error('Il file non contiene pagine valide.');
    out.forEach(function (s) {
      s.tasks.forEach(function (t) {
        if (t.sourceSheetId && (!sheetIds[t.sourceSheetId] || t.sourceSheetId === s.id)) t.sourceSheetId = null;
        if (!t.sourceSheetId && t.duration < 0.1) {
          t.duration = 0.1;
          t.end = round1(t.start + t.duration);
        }
      });
    });
    return {
      type: 'cycle',
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Tempo ciclo importato',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
      activeSheet: typeof raw.activeSheet === 'string' && sheetIds[raw.activeSheet] ? raw.activeSheet : out[0].id,
      sheets: out
    };
  }

  function sanitizeAny(raw) {
    if (raw && typeof raw === 'object' && (raw.type === 'cycle' || (Array.isArray(raw.sheets) && !Array.isArray(raw.tasks)))) {
      return sanitizeCycleProject(raw);
    }
    return sanitizeProject(raw);
  }

  function projectTaskCount(p) {
    if (!p) return 0;
    if (p.type === 'cycle') {
      return (p.sheets || []).reduce(function (n, s) { return n + (s.tasks ? s.tasks.length : 0); }, 0);
    }
    return Array.isArray(p.tasks) ? p.tasks.length : 0;
  }

  function demoCycleProject() {
    function seq(seed) {
      var list = [];
      seed.forEach(function (s) {
        list.push(makeCycleTask({
          name: s[0],
          duration: s[1],
          color: s[2],
          predecessorId: s[3] === null ? null : list[s[3]].id,
          link: s[4] || 'FS',
          lag: s[5] || 0
        }));
      });
      return list;
    }
    var s1 = makeSheet('Stazione 1 – Carico', seq([
      ['Prelievo pezzo', 3.5, '#6366f1', null],
      ['Posizionamento in attrezzatura', 2.5, '#0ea5e9', 0, 'FS'],
      ['Bloccaggio', 1.5, '#14b8a6', 1, 'FS'],
      ['Controllo presenza pezzo', 1, '#a855f7', 2, 'SS', 0.5],
      ['Consenso partenza', 0.5, '#22c55e', 2, 'FS', 0]
    ]));
    var s2 = makeSheet('Stazione 2 – Lavorazione', seq([
      ['Avvicinamento utensile', 2, '#f59e0b', null],
      ['Fresatura', 18, '#f97316', 0, 'FS'],
      ['Soffiatura trucioli', 3, '#64748b', 1, 'FF', 0],
      ['Ritorno utensile', 2, '#eab308', 1, 'FS'],
      ['Misura in macchina', 4.5, '#ef4444', 3, 'FS', 0.5]
    ]));
    var t1 = makeCycleTask({ name: s1.name, sourceSheetId: s1.id, duration: 0, color: '#6366f1' });
    var t2 = makeCycleTask({ name: s2.name, sourceSheetId: s2.id, duration: 0, color: '#f97316', predecessorId: t1.id });
    var t3 = makeCycleTask({ name: 'Scarico pezzo', duration: 4, color: '#ec4899', predecessorId: t2.id });
    var t4 = makeCycleTask({ name: 'Rotazione tavola', duration: 2.5, color: '#14b8a6', predecessorId: t3.id, link: 'FS' });
    var s3 = makeSheet('Ciclo completo', [t1, t2, t3, t4]);
    var p = makeCycleProject('Stima tempo ciclo – Cella di lavorazione', [s1, s2, s3]);
    p.activeSheet = s3.id;
    return p;
  }


  /* ============================================================
     RENDER
     ============================================================ */
  function buildGrid() {
    grid.innerHTML = '';

    var head = el('div', 'row row-head');
    var headFields = el('div', 'fields head-fields');
    var cyc = isCycle();
    var labels = cyc
      ? ['Attività', 'Durata', 'Inizio', 'Fine', 'Vincolo', 'Colore', '']
      : ['Attività', 'Giorni', 'Inizio', 'Fine', 'Vincolo', 'Colore', 'Includi', ''];
    var classes = cyc
      ? ['cell-name', 'cell-dur', 'cell-start', 'cell-end', 'cell-pred', 'cell-color', 'cell-act']
      : ['cell-name', 'cell-dur', 'cell-start', 'cell-end', 'cell-pred', 'cell-color', 'cell-flags', 'cell-act'];
    labels.forEach(function (label, i) {
      var c = el('div', 'cell ' + classes[i]);
      if (i === 4) {
        c.appendChild(el('span', '', label));
        c.appendChild(el('span', 'head-sub', cyc ? 'offset (s)' : 'offset (gg)'));
        c.title = cyc
          ? 'Collega l’attività a una precedente e scegli il tipo di vincolo. Il numero è l’offset in secondi rispetto al riferimento del vincolo.'
          : 'Collega l’attività a una precedente e scegli il tipo di vincolo. Il numero è l’offset in giorni rispetto al riferimento del vincolo.';
      } else if (cyc && i >= 1 && i <= 3) {
        c.appendChild(el('span', '', label));
        c.appendChild(el('span', 'head-sub', 's'));
        c.title = i === 1 ? 'Durata in secondi (decimi ammessi)' : (i === 2 ? 'Secondo di inizio' : 'Secondo di fine');
      } else if (!cyc && i === 6) {
        c.textContent = label;
        c.title = 'Giorni da considerare nella durata: sabati, domeniche e festivi. Se una spunta è assente, quei giorni vengono saltati.';
      } else {
        c.textContent = label;
      }
      if (i < labels.length) {
        var rz = el('span', 'col-resizer');
        rz.dataset.col = String(i);
        rz.title = 'Trascina per allargare o restringere la colonna · doppio clic per ripristinare';
        rz.setAttribute('aria-hidden', 'true');
        c.appendChild(rz);
      }
      headFields.appendChild(c);
    });
    head.appendChild(headFields);

    headTimeline = el('div', 'head-timeline');
    head.appendChild(headTimeline);
    headerRow = head;
    grid.appendChild(head);

    tasks().forEach(function (t) { grid.appendChild(cyc ? buildCycleRow(t) : buildTaskRow(t)); });

    var addRow = el('div', 'row add-row');
    var addFields = el('div', 'fields');
    addFields.innerHTML = '<button type="button" class="add-btn" data-action="add">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.2v9.6M3.2 8h9.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
      '<span>Nuova attività</span></button>';
    addRow.appendChild(addFields);
    addRow.appendChild(el('div', 'timeline'));
    grid.appendChild(addRow);

    linksSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    linksSvg.setAttribute('class', 'links');
    linksSvg.setAttribute('aria-hidden', 'true');
    grid.appendChild(linksSvg);
  }

  function colCfg() { return isCycle() ? COLS.cycle : COLS.gantt; }
  function readSavedColumns() {
    var cfg = colCfg();
    try {
      var raw = localStorage.getItem(cfg.key);
      if (!raw) return null;
      var data = JSON.parse(raw);
      var widths = data && Array.isArray(data.widths) ? data.widths : null;
      if (!widths || widths.length !== cfg.def.length) return null;
      var ok = true;
      var clean = widths.map(function (w, i) {
        var n = Number(w);
        if (!Number.isFinite(n)) { ok = false; return cfg.min[i]; }
        return Math.max(cfg.min[i], Math.min(cfg.max[i], n));
      });
      return ok ? clean : null;
    } catch (e) {
      return null;
    }
  }
  function currentColumnWidths() {
    var cfg = colCfg();
    var fields = grid.querySelector('.row-head .fields');
    if (fields) {
      var parts = getComputedStyle(fields).gridTemplateColumns.split(/\s+/).map(parseFloat)
        .filter(function (n) { return Number.isFinite(n); });
      if (parts.length === cfg.def.length) return parts;
    }
    return cfg.def.slice();
  }
  function applyColumnWidths(widths) {
    var cfg = colCfg();
    var clean = widths.map(function (w, i) {
      return Math.max(cfg.min[i], Math.min(cfg.max[i], Math.round(w * 10) / 10));
    });
    var sum = clean.reduce(function (a, b) { return a + b; }, 0);
    state.columnWidths = clean;
    grid.style.setProperty('--colw', clean.map(function (w) { return w + 'px'; }).join(' '));
    document.documentElement.style.setProperty('--left-w', (Math.round(sum * 10) / 10) + 'px');
  }
  function persistColumnWidths() {
    if (!state.columnWidths) return;
    try { localStorage.setItem(colCfg().key, JSON.stringify({ widths: state.columnWidths })); } catch (e) { /* ignore */ }
  }
  function resetColumnWidths() {
    state.columnWidths = null;
    try { localStorage.removeItem(colCfg().key); } catch (e) { /* ignore */ }
    grid.style.removeProperty('--colw');
    document.documentElement.style.removeProperty('--left-w');
    renderLinks();
    updateMonthChip();
    toast('Larghezza colonne ripristinata.');
  }
  function initColumnLayout() {
    state.columnWidths = null;
    grid.style.removeProperty('--colw');
    document.documentElement.style.removeProperty('--left-w');
    var saved = readSavedColumns();
    if (saved) applyColumnWidths(saved);
  }

  /* Adatta l'interfaccia al tipo di lavoro (Gantt o tempo ciclo). */
  function applyMode() {
    var cyc = isCycle();
    document.documentElement.classList.toggle('mode-cycle', cyc);
    var appName = document.querySelector('.app-name');
    if (appName) appName.textContent = cyc ? 'GanttFlow · Tempo ciclo' : 'GanttFlow';
    var calPanel = document.getElementById('calPanel');
    if (calPanel) calPanel.hidden = cyc;
    if (sheetBarEl) sheetBarEl.hidden = !cyc;
    var btnToday = document.getElementById('btnToday');
    if (btnToday) {
      btnToday.textContent = cyc ? 'Inizio' : 'Oggi';
      btnToday.title = cyc ? 'Torna al secondo 0' : 'Vai a oggi';
    }
    var legend = document.querySelector('.statusbar .legend');
    if (legend) legend.hidden = cyc;
    var hint = document.querySelector('.statusbar .status-hint');
    if (hint) {
      hint.textContent = cyc
        ? 'Trascina dai pallini di inizio/fine delle barre per creare un vincolo · Doppio clic su una pagina per rinominarla.'
        : 'Trascina dai pallini di inizio/fine delle barre per creare un vincolo · Spunte Sab/Dom/Fest: giorni inclusi nella durata.';
    }
    var emptyTitle = emptyEl ? emptyEl.querySelector('h2') : null;
    var emptyText = emptyEl ? emptyEl.querySelector('p') : null;
    if (emptyTitle) emptyTitle.textContent = cyc ? 'Pagina vuota' : 'Inizia a pianificare';
    if (emptyText) {
      emptyText.textContent = cyc
        ? 'Aggiungi la prima attività con durata in secondi, oppure importa un’altra pagina come attività con il suo tempo ciclo dalla barra delle pagine.'
        : 'Aggiungi la prima attività con durata e date, oppure importa un progetto salvato. Puoi partire anche da un esempio già collegato.';
    }
    var board0 = document.getElementById('board');
    if (board0) board0.setAttribute('aria-label', cyc ? 'Grafico di stima tempo ciclo' : 'Diagramma di Gantt');
    headerSig = '';
    initColumnLayout();
  }
  function onColMouseDown(e) {
    var rz = e.target.closest ? e.target.closest('.col-resizer') : null;
    if (!rz || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    colDrag = {
      index: +rz.dataset.col,
      startX: e.clientX,
      widths: currentColumnWidths()
    };
    document.body.classList.add('col-resizing');
  }
  function onColMouseMove(e) {
    if (!colDrag) return;
    e.preventDefault();
    var widths = colDrag.widths.slice();
    var i = colDrag.index;
    widths[i] = colDrag.widths[i] + (e.clientX - colDrag.startX);
    applyColumnWidths(widths);
  }
  function onColMouseUp() {
    if (!colDrag) return;
    colDrag = null;
    document.body.classList.remove('col-resizing');
    persistColumnWidths();
    renderLinks();
    updateMonthChip();
  }

  function buildTaskRow(t) {
    var row = el('div', 'row task');
    row.dataset.id = t.id;
    row.innerHTML =
      '<div class="fields">' +
        '<div class="cell cell-name">' + DRAG_HANDLE + '<input class="inp inp-name" data-field="name" maxlength="120" aria-label="Nome attività" spellcheck="false" placeholder="Nome attività"></div>' +
        '<div class="cell cell-dur"><input class="inp inp-num" data-field="duration" type="number" min="1" max="' + MAX_DURATION + '" step="1" aria-label="Durata in giorni" title="Durata stimata in giorni"></div>' +
        '<div class="cell cell-start">' +
          '<input class="inp inp-date" data-field="start" type="date" aria-label="Data di inizio">' +
          '<span class="lock" aria-hidden="true"><svg viewBox="0 0 16 16"><rect x="3.2" y="7" width="9.6" height="6.6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span>' +
        '</div>' +
        '<div class="cell cell-end">' +
          '<input class="inp inp-date" data-field="end" type="date" aria-label="Data di fine">' +
          '<span class="lock" aria-hidden="true"><svg viewBox="0 0 16 16"><rect x="3.2" y="7" width="9.6" height="6.6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span>' +
        '</div>' +
        '<div class="cell cell-pred">' +
          '<div class="link-line">' +
            '<select class="inp inp-select inp-pred" data-field="pred" aria-label="Attività a cui collegare questa" title="Nessun collegamento"></select>' +
          '</div>' +
          '<div class="link-line">' +
            '<select class="inp inp-select inp-link" data-field="link" aria-label="Tipo di vincolo" title="Tipo di vincolo"></select>' +
            '<input class="inp inp-lag" data-field="lag" type="number" min="0" max="365" step="1" placeholder="0" title="Offset in giorni" aria-label="Offset in giorni">' +
          '</div>' +
        '</div>' +
        '<div class="cell cell-color">' +
          '<button type="button" class="swatch-btn" data-action="color" aria-label="Scegli il colore" aria-haspopup="true" title="Scegli un colore">' +
            '<span class="swatch-dot"></span>' +
          '</button>' +
          '<div class="swatch-pop" hidden></div>' +
        '</div>' +
        '<div class="cell cell-flags">' +
          '<label class="flag" title="Considera i sabati nella durata: se non spuntato, i sabati vengono saltati"><input type="checkbox" data-field="countSat" aria-label="Considera i sabati nella durata"><span>Sab</span></label>' +
          '<label class="flag" title="Considera le domeniche nella durata: se non spuntato, le domeniche vengono saltate"><input type="checkbox" data-field="countSun" aria-label="Considera le domeniche nella durata"><span>Dom</span></label>' +
          '<label class="flag" title="Considera i festivi italiani nella durata: se non spuntato, i festivi vengono saltati"><input type="checkbox" data-field="countHol" aria-label="Considera i festivi nella durata"><span>Fest</span></label>' +
        '</div>' +
        '<div class="cell cell-act">' +
          '<button type="button" class="icon-btn" data-action="duplicate" title="Duplica attività" aria-label="Duplica attività"><svg viewBox="0 0 16 16"><rect x="5.2" y="5.2" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.4 3.4H5.2a2 2 0 0 0-2 2v5.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>' +
          '<button type="button" class="icon-btn danger" data-action="delete" title="Elimina attività" aria-label="Elimina attività"><svg viewBox="0 0 16 16"><path d="M3.4 4.6h9.2M6.2 4.6V3.2h3.6v1.4M4.6 4.6l.6 8.2h5.6l.6-8.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="timeline"><div class="lane"><div class="bar"></div>' + LINK_POINTS + '</div></div>';
    var select = row.querySelector('[data-field="pred"]');
    buildPredOptions(select, t);
    var linkSel = row.querySelector('[data-field="link"]');
    LINK_ORDER.forEach(function (k) { linkSel.appendChild(new Option(LINK_TYPES[k].label, k)); });
    linkSel.value = t.link;
    var pop = row.querySelector('.swatch-pop');
    var colors = SWATCHES.slice();
    if (colors.indexOf(t.color) < 0) colors.unshift(t.color);
    colors.forEach(function (c) {
      var b = el('button', 'swatch');
      b.type = 'button';
      b.dataset.color = c;
      b.style.background = c;
      b.title = c;
      b.setAttribute('aria-label', 'Colore ' + c);
      pop.appendChild(b);
    });
    return row;
  }

  var DRAG_HANDLE = '<button type="button" class="drag-handle" tabindex="-1" title="Trascina per spostare l’attività sopra o sotto le altre (oppure Alt+↑/↓ sul nome)" aria-hidden="true">' +
    '<svg viewBox="0 0 8 14"><circle cx="2" cy="2.5" r="1.1"/><circle cx="6" cy="2.5" r="1.1"/><circle cx="2" cy="7" r="1.1"/><circle cx="6" cy="7" r="1.1"/><circle cx="2" cy="11.5" r="1.1"/><circle cx="6" cy="11.5" r="1.1"/></svg></button>';
  var LINK_POINTS =
    '<span class="link-pt link-pt-start" data-pt="start" title="Inizio: trascina sull’inizio o sulla fine di un’altra attività per creare un vincolo"></span>' +
    '<span class="link-pt link-pt-end" data-pt="end" title="Fine: trascina sull’inizio o sulla fine di un’altra attività per creare un vincolo"></span>';
  var LOCK_SVG = '<span class="lock" aria-hidden="true"><svg viewBox="0 0 16 16"><rect x="3.2" y="7" width="9.6" height="6.6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span>';
  var SHEET_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 6.5h11M6.5 6.5v7" stroke="currentColor" stroke-width="1.3"/></svg>';

  function buildCycleRow(t) {
    var row = el('div', 'row task' + (t.sourceSheetId ? ' sheet-linked' : ''));
    row.dataset.id = t.id;
    row.innerHTML =
      '<div class="fields">' +
        '<div class="cell cell-name">' + DRAG_HANDLE +
          '<span class="row-num" title="Numero progressivo dell’attività nella pagina">' + (indexById(t.id) + 1) + '</span>' +
          (t.sourceSheetId ? '<span class="sheet-badge" title="Pagina importata: nome e durata seguono la pagina sorgente">' + SHEET_SVG + '</span>' : '') +
          '<input class="inp inp-name" data-field="name" maxlength="120" aria-label="Nome attività" spellcheck="false" placeholder="Nome attività">' +
        '</div>' +
        '<div class="cell cell-dur"><input class="inp inp-num inp-sec" data-field="duration" type="number" min="0.1" max="' + MAX_SECONDS + '" step="0.1" aria-label="Durata in secondi" title="Durata stimata in secondi"></div>' +
        '<div class="cell cell-start"><input class="inp inp-num inp-sec" data-field="start" type="number" min="0" max="' + MAX_SECONDS + '" step="0.1" aria-label="Secondo di inizio">' + LOCK_SVG + '</div>' +
        '<div class="cell cell-end"><input class="inp inp-num inp-sec" data-field="end" type="number" min="0.1" max="' + MAX_SECONDS + '" step="0.1" aria-label="Secondo di fine">' + LOCK_SVG + '</div>' +
        '<div class="cell cell-pred">' +
          '<div class="link-line">' +
            '<select class="inp inp-select inp-pred" data-field="pred" aria-label="Attività a cui collegare questa" title="Nessun collegamento"></select>' +
          '</div>' +
          '<div class="link-line">' +
            '<select class="inp inp-select inp-link" data-field="link" aria-label="Tipo di vincolo" title="Tipo di vincolo"></select>' +
            '<input class="inp inp-lag" data-field="lag" type="number" min="0" max="' + MAX_LAG_SECONDS + '" step="0.1" placeholder="0" title="Offset in secondi" aria-label="Offset in secondi">' +
          '</div>' +
        '</div>' +
        '<div class="cell cell-color">' +
          '<button type="button" class="swatch-btn" data-action="color" aria-label="Scegli il colore" aria-haspopup="true" title="Scegli un colore">' +
            '<span class="swatch-dot"></span>' +
          '</button>' +
          '<div class="swatch-pop" hidden></div>' +
        '</div>' +
        '<div class="cell cell-act">' +
          '<button type="button" class="icon-btn" data-action="duplicate" title="Duplica attività" aria-label="Duplica attività"><svg viewBox="0 0 16 16"><rect x="5.2" y="5.2" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.4 3.4H5.2a2 2 0 0 0-2 2v5.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>' +
          '<button type="button" class="icon-btn danger" data-action="delete" title="Elimina attività" aria-label="Elimina attività"><svg viewBox="0 0 16 16"><path d="M3.4 4.6h9.2M6.2 4.6V3.2h3.6v1.4M4.6 4.6l.6 8.2h5.6l.6-8.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="timeline"><div class="lane"><div class="bar"></div>' + LINK_POINTS + '</div></div>';
    buildPredOptions(row.querySelector('[data-field="pred"]'), t);
    var linkSel = row.querySelector('[data-field="link"]');
    LINK_ORDER.forEach(function (k) { linkSel.appendChild(new Option(LINK_TYPES[k].label, k)); });
    linkSel.value = t.link;
    var pop = row.querySelector('.swatch-pop');
    var colors = SWATCHES.slice();
    if (colors.indexOf(t.color) < 0) colors.unshift(t.color);
    colors.forEach(function (c) {
      var b = el('button', 'swatch');
      b.type = 'button';
      b.dataset.color = c;
      b.style.background = c;
      b.title = c;
      b.setAttribute('aria-label', 'Colore ' + c);
      pop.appendChild(b);
    });
    return row;
  }

  function syncCycleRows() {
    grid.querySelectorAll('.row.task').forEach(function (row) {
      var t = taskById(row.dataset.id);
      if (!t) return;
      var src = t.sourceSheetId ? sheetById(t.sourceSheetId) : null;
      var nameInp = row.querySelector('[data-field="name"]');
      setInput(nameInp, t.name);
      nameInp.disabled = !!src;
      nameInp.title = src ? 'Nome della pagina importata «' + src.name + '»: rinomina la pagina per cambiarlo' : '';
      setInput(row.querySelector('[data-field="duration"]'), secText(t.duration));
      setInput(row.querySelector('[data-field="start"]'), secText(t.start));
      setInput(row.querySelector('[data-field="end"]'), secText(t.end));
      setInput(row.querySelector('[data-field="lag"]'), secText(t.lag));

      var predSel = row.querySelector('[data-field="pred"]');
      if (document.activeElement !== predSel && predSel.value !== (t.predecessorId || '')) predSel.value = t.predecessorId || '';
      var predTask = t.predecessorId ? taskById(t.predecessorId) : null;
      predSel.title = predTask ? 'Collegata a «' + predTask.name + '»' : 'Nessun collegamento';

      var linkSel = row.querySelector('[data-field="link"]');
      if (document.activeElement !== linkSel && linkSel.value !== t.link) linkSel.value = t.link;
      linkSel.disabled = !t.predecessorId;
      linkSel.title = predTask ? 'Tipo di vincolo con «' + predTask.name + '»' : 'Scegli prima un’attività collegata';

      var lag = row.querySelector('[data-field="lag"]');
      lag.disabled = !t.predecessorId;
      if (!t.predecessorId) lag.title = 'Offset in secondi: disponibile con un collegamento';
      else if (t.link === 'SS') lag.title = 'Secondi tra l’inizio dell’attività collegata e l’inizio di questa';
      else if (t.link === 'FF') lag.title = 'Secondi prima della fine dell’attività collegata in cui questa si conclude';
      else lag.title = 'Secondi di attesa dopo la fine dell’attività collegata';

      var dot = row.querySelector('.swatch-dot');
      if (dot) dot.style.background = t.color;
      row.querySelectorAll('.swatch').forEach(function (b) {
        b.classList.toggle('on', b.dataset.color === t.color);
      });

      var durInput = row.querySelector('[data-field="duration"]');
      var startInput = row.querySelector('[data-field="start"]');
      var endInput = row.querySelector('[data-field="end"]');
      var lockedStart = !!t.predecessorId;
      var lockedEnd = !!src || (!!t.predecessorId && t.link === 'FF');
      var lockTitle = t.link === 'SS'
        ? 'Secondo calcolato: mantiene la stessa distanza dall’inizio dell’attività collegata'
        : (t.link === 'FF'
          ? 'Secondo calcolato: finisce prima della fine dell’attività collegata'
          : 'Secondo calcolato: inizia dopo la fine dell’attività collegata');
      durInput.disabled = !!src;
      durInput.classList.toggle('locked', !!src);
      durInput.title = src ? 'Tempo ciclo della pagina «' + src.name + '» (aggiornato automaticamente)' : 'Durata stimata in secondi';
      [['start', startInput, lockedStart], ['end', endInput, lockedEnd]].forEach(function (pair) {
        var inp = pair[1];
        inp.disabled = pair[2];
        inp.classList.toggle('locked', pair[2]);
        inp.title = pair[2] ? (pair[0] === 'end' && src && !(t.predecessorId && t.link === 'FF')
          ? 'Fine calcolata da inizio + tempo ciclo della pagina importata' : lockTitle) : '';
        inp.closest(pair[0] === 'start' ? '.cell-start' : '.cell-end').classList.toggle('locked', pair[2]);
      });
    });
  }

  function buildPredOptions(select, t) {
    select.textContent = '';
    select.appendChild(new Option('—', ''));
    tasks().forEach(function (p) {
      if (p.id === t.id) return;
      if (wouldCycle(t.id, p.id)) return;
      select.appendChild(new Option(taskLabel(p), p.id));
    });
    select.value = t.predecessorId || '';
  }

  /* Etichetta di un'attività nei menu: nel tempo ciclo è preceduta dal numero. */
  function taskLabel(t) {
    var name = t.name || 'Senza nome';
    return isCycle() ? (indexById(t.id) + 1) + ' · ' + name : name;
  }

  function updateOptionLabels() {
    grid.querySelectorAll('.row.task').forEach(function (row) {
      var select = row.querySelector('[data-field="pred"]');
      if (!select) return;
      Array.prototype.forEach.call(select.options, function (opt) {
        if (!opt.value) return;
        var t = taskById(opt.value);
        if (t) opt.textContent = taskLabel(t);
      });
    });
    renderCycleCalc();
  }

  /* ---------------- vincoli trascinando tra inizio/fine delle barre ---------------- */
  var linkDrag = null;

  function placeLinkPoints(row, left, width) {
    var s = row.querySelector('.link-pt-start');
    var e = row.querySelector('.link-pt-end');
    if (s) s.style.left = left + 'px';
    if (e) e.style.left = (left + width) + 'px';
  }

  /* Traduce i due punti collegati nel vincolo del modello (un solo predecessore per attività):
     inizio↔fine → «Inizia dopo» (chi ha l'inizio dipende da chi ha la fine);
     inizio↔inizio → «Inizia con», fine↔fine → «Finisce prima»: dipende l'attività da cui si parte. */
  function linkFromPoints(aId, aPt, bId, bPt) {
    if (aPt === 'start' && bPt === 'end') return { dep: aId, pred: bId, link: 'FS' };
    if (aPt === 'end' && bPt === 'start') return { dep: bId, pred: aId, link: 'FS' };
    if (aPt === 'start') return { dep: aId, pred: bId, link: 'SS' };
    return { dep: aId, pred: bId, link: 'FF' };
  }

  function pointCenter(pt) {
    var r = pt.getBoundingClientRect();
    var g = grid.getBoundingClientRect();
    return { x: r.left + r.width / 2 - g.left, y: r.top + r.height / 2 - g.top };
  }

  function onLinkDragStart(e) {
    var pt = e.target.closest ? e.target.closest('.link-pt') : null;
    if (!pt || e.button !== 0) return;
    var row = pt.closest('.row.task');
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();
    closeColorPops(null);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'link-drag');
    svg.setAttribute('width', grid.scrollWidth);
    svg.setAttribute('height', grid.scrollHeight);
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(path);
    grid.appendChild(svg);
    var label = el('div', 'link-drag-label');
    grid.appendChild(label);
    linkDrag = { id: row.dataset.id, pt: pt.dataset.pt, el: pt, svg: svg, path: path, label: label, target: null };
    pt.classList.add('source');
    grid.classList.add('linking');
    document.body.classList.add('link-dragging');
    selectTask(row.dataset.id);
    updateLinkDrag(e.clientX, e.clientY);
  }

  /* Trova il punto di aggancio sotto il cursore: un punto, oppure l'estremo più vicino di una barra. */
  function linkTargetAt(x, y) {
    var node = document.elementFromPoint(x, y);
    if (!node || !node.closest) return null;
    if (node.closest('.fields')) return null;
    var row = node.closest('.row.task');
    if (!row || row.dataset.id === linkDrag.id) return null;
    var pt = node.closest('.link-pt');
    if (!pt) {
      var bar = node.closest('.bar') || row.querySelector('.bar');
      var r = bar.getBoundingClientRect();
      if (!node.closest('.bar') && (x < r.left - 18 || x > r.right + 18)) return null;
      pt = row.querySelector(x < r.left + r.width / 2 ? '.link-pt-start' : '.link-pt-end');
    }
    return pt ? { id: row.dataset.id, pt: pt.dataset.pt, el: pt } : null;
  }

  function linkDescription(rel) {
    var dep = taskById(rel.dep), pred = taskById(rel.pred);
    if (!dep || !pred) return '';
    var dn = taskLabel(dep), pn = taskLabel(pred);
    if (rel.link === 'FS') return '«' + dn + '» inizia dopo la fine di «' + pn + '»';
    if (rel.link === 'SS') return '«' + dn + '» inizia con «' + pn + '»';
    return isCycle()
      ? '«' + dn + '» finisce insieme a «' + pn + '»'
      : '«' + dn + '» finisce prima della fine di «' + pn + '»';
  }

  function updateLinkDrag(clientX, clientY) {
    var d = linkDrag;
    var g = grid.getBoundingClientRect();
    var a = pointCenter(d.el);
    var target = linkTargetAt(clientX, clientY);
    if (d.target && (!target || target.el !== d.target.el)) d.target.el.classList.remove('target', 'invalid');
    d.target = target;
    var bx = clientX - g.left, by = clientY - g.top;
    var valid = false, text = 'Rilascia sull’inizio o sulla fine di un’altra attività';
    if (target) {
      var c = pointCenter(target.el);
      bx = c.x; by = c.y;
      var rel = linkFromPoints(d.id, d.pt, target.id, target.pt);
      valid = !wouldCycle(rel.dep, rel.pred);
      target.el.classList.add('target');
      target.el.classList.toggle('invalid', !valid);
      text = valid ? linkDescription(rel) : 'Non possibile: creerebbe un ciclo tra le attività';
    }
    var mx = (a.x + bx) / 2;
    d.path.setAttribute('d', 'M' + a.x + ' ' + a.y + ' C' + mx + ' ' + a.y + ' ' + mx + ' ' + by + ' ' + bx + ' ' + by);
    d.svg.classList.toggle('ok', !!target && valid);
    d.svg.classList.toggle('bad', !!target && !valid);
    d.label.textContent = text;
    d.label.classList.toggle('ok', !!target && valid);
    d.label.classList.toggle('bad', !!target && !valid);
    d.label.style.left = (clientX - g.left + 14) + 'px';
    d.label.style.top = (clientY - g.top + 16) + 'px';
  }

  function onLinkDragMove(e) {
    if (!linkDrag) return;
    e.preventDefault();
    var br = board.getBoundingClientRect();
    var edge = 30;
    if (e.clientX > br.right - edge) board.scrollLeft += 14;
    else if (e.clientX < br.left + leftWidth() + edge) board.scrollLeft -= 14;
    if (e.clientY > br.bottom - edge) board.scrollTop += 10;
    else if (e.clientY < br.top + (headerRow ? headerRow.offsetHeight : 0) + edge) board.scrollTop -= 10;
    updateLinkDrag(e.clientX, e.clientY);
  }

  function onLinkDragEnd() {
    if (!linkDrag) return;
    var d = linkDrag;
    linkDrag = null;
    d.svg.remove();
    d.label.remove();
    d.el.classList.remove('source');
    if (d.target) d.target.el.classList.remove('target', 'invalid');
    grid.classList.remove('linking');
    document.body.classList.remove('link-dragging');
    if (d.target) createLink(linkFromPoints(d.id, d.pt, d.target.id, d.target.pt));
  }

  function createLink(rel) {
    var dep = taskById(rel.dep), pred = taskById(rel.pred);
    if (!dep || !pred || dep === pred) return;
    if (wouldCycle(dep.id, pred.id)) {
      toast('Vincolo non possibile: creerebbe un ciclo tra le attività.', { type: 'error' });
      return;
    }
    if (dep.predecessorId === pred.id && dep.link === rel.link && !dep.lag) {
      toast('Questo vincolo esiste già.');
      return;
    }
    var old = dep.predecessorId ? taskById(dep.predecessorId) : null;
    var snapshot = JSON.stringify(tasks());
    var projectAt = state.project;
    var sheetAt = isCycle() ? state.project.activeSheet : null;
    dep.predecessorId = pred.id;
    dep.link = rel.link;
    dep.lag = 0;
    state.selectedId = dep.id;
    var msg = 'Vincolo creato: ' + linkDescription(rel) + '.' +
      (old && old.id !== pred.id ? ' Sostituisce il collegamento con «' + (old.name || 'attività') + '».' : '');
    renderAll();
    toast(msg, {
      actionLabel: 'Annulla',
      duration: 7000,
      onAction: function () {
        if (state.project !== projectAt) return;
        if (isCycle()) {
          if (!sheetById(sheetAt)) return;
          state.project.activeSheet = sheetAt;
        }
        try {
          setTasks(JSON.parse(snapshot));
          renderAll();
          toast('Vincolo annullato.');
        } catch (err) { /* ignore */ }
      }
    });
  }

  /* ---------------- calcolo del tempo ciclo tra due fini ---------------- */
  function calcPair(sheet) {
    if (!sheet) return null;
    var a = null, b = null;
    sheet.tasks.forEach(function (t) {
      if (t.id === sheet.calcFrom) a = t;
      if (t.id === sheet.calcTo) b = t;
    });
    if (!a || !b) return { a: a, b: b, diff: null };
    return { a: a, b: b, diff: round1(Math.abs(b.end - a.end)) };
  }

  function renderCycleCalc() {
    if (!ctCalcEl) return;
    if (!isCycle()) {
      ctCalcEl.hidden = true;
      if (calcSplitEl) calcSplitEl.hidden = true;
      return;
    }
    ctCalcEl.hidden = false;
    if (calcSplitEl) calcSplitEl.hidden = false;
    var sheet = activeSheet();
    [[calcFromSel, 'calcFrom'], [calcToSel, 'calcTo']].forEach(function (pair) {
      var sel = pair[0];
      if (document.activeElement === sel) return;
      sel.textContent = '';
      sel.appendChild(new Option('— scegli —', ''));
      (sheet ? sheet.tasks : []).forEach(function (t) {
        sel.appendChild(new Option(taskLabel(t) + ' · fine ' + fmtSec(t.end), t.id));
      });
      sel.value = sheet && sheet[pair[1]] && taskById(sheet[pair[1]]) ? sheet[pair[1]] : '';
      sel.disabled = !sheet || !sheet.tasks.length;
    });
    var res = calcPair(sheet);
    calcResultEl.classList.toggle('is-empty', !res || res.diff === null);
    if (!res || res.diff === null) {
      calcResultEl.textContent = '—';
      calcDetailEl.textContent = sheet && sheet.tasks.length >= 2
        ? 'Scegli due attività: il risultato è la differenza tra i loro secondi di fine.'
        : 'Servono almeno due attività nella pagina.';
      return;
    }
    calcResultEl.textContent = fmtSec(res.diff);
    calcDetailEl.textContent = 'fine n. ' + (indexById(res.a.id) + 1) + ' = ' + fmtSec(res.a.end) +
      '  →  fine n. ' + (indexById(res.b.id) + 1) + ' = ' + fmtSec(res.b.end);
  }

  /* ---------------- divisore grafico / calcolo ---------------- */
  /* Altezza naturale del pannello di calcolo (senza altezza impostata). */
  function calcNaturalHeight() {
    var prev = ctCalcEl.style.height;
    ctCalcEl.style.height = '';
    var h = ctCalcEl.offsetHeight;
    ctCalcEl.style.height = prev;
    return h;
  }
  function calcHeightLimits() {
    var min = calcNaturalHeight();
    var current = ctCalcEl.offsetHeight;
    var max = Math.max(min, current + board.offsetHeight - BOARD_MIN_H);
    return { min: min, max: max };
  }
  function setCalcHeight(h, persist) {
    if (!isCycle() || ctCalcEl.hidden) return;
    var lim = calcHeightLimits();
    if (h === null || h <= lim.min + 1) {
      ctCalcEl.style.height = '';
      ctCalcEl.classList.remove('sized');
    } else {
      h = Math.round(Math.min(lim.max, Math.max(lim.min, h)));
      ctCalcEl.style.height = h + 'px';
      ctCalcEl.classList.add('sized');
    }
    calcSplitEl.setAttribute('aria-valuenow', String(ctCalcEl.offsetHeight));
    if (persist) {
      try {
        if (ctCalcEl.style.height) localStorage.setItem(SPLIT_KEY, JSON.stringify({ calcH: parseInt(ctCalcEl.style.height, 10) }));
        else localStorage.removeItem(SPLIT_KEY);
      } catch (e) { /* ignore */ }
    }
    renderLinks();
    updateMonthChip();
  }
  function savedCalcHeight() {
    try {
      var d = JSON.parse(localStorage.getItem(SPLIT_KEY) || 'null');
      return d && Number.isFinite(d.calcH) ? d.calcH : null;
    } catch (e) { return null; }
  }
  function applySavedSplit() {
    if (!ctCalcEl || ctCalcEl.hidden) return;
    var h = savedCalcHeight();
    if (h !== null) setCalcHeight(h, false);
    else ctCalcEl.style.height = '';
  }
  function onSplitDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    splitDrag = { startY: e.clientY, startH: ctCalcEl.offsetHeight };
    document.body.classList.add('split-resizing');
    calcSplitEl.classList.add('active');
  }
  function onSplitMove(e) {
    if (!splitDrag) return;
    e.preventDefault();
    setCalcHeight(splitDrag.startH + (splitDrag.startY - e.clientY), false);
  }
  function onSplitUp() {
    if (!splitDrag) return;
    splitDrag = null;
    document.body.classList.remove('split-resizing');
    calcSplitEl.classList.remove('active');
    setCalcHeight(ctCalcEl.style.height ? parseInt(ctCalcEl.style.height, 10) : null, true);
  }
  function onSplitKey(e) {
    var step = e.shiftKey ? 60 : 20;
    if (e.key === 'ArrowUp') { e.preventDefault(); setCalcHeight(ctCalcEl.offsetHeight + step, true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCalcHeight(ctCalcEl.offsetHeight - step, true); }
    else if (e.key === 'Home') { e.preventDefault(); setCalcHeight(null, true); }
    else if (e.key === 'End') { e.preventDefault(); setCalcHeight(1e6, true); }
  }

  function onCalcChange(e) {
    var sheet = activeSheet();
    if (!sheet) return;
    var key = e.target === calcFromSel ? 'calcFrom' : 'calcTo';
    sheet[key] = e.target.value || null;
    e.target.blur();
    renderCycleCalc();
    renderBars();
    renderLinks();
    saveSoon();
  }

  /* ---------------- riordino delle attività (trascinamento) ---------------- */
  var rowDrag = null;

  function moveTask(id, toIndex) {
    var list = tasks();
    var from = indexById(id);
    if (from < 0) return false;
    toIndex = Math.max(0, Math.min(list.length - 1, toIndex));
    if (toIndex === from) return false;
    var item = list.splice(from, 1)[0];
    list.splice(toIndex, 0, item);
    state.selectedId = id;
    renderAll();
    return true;
  }

  function onRowDragStart(e) {
    var handle = e.target.closest ? e.target.closest('.drag-handle') : null;
    if (!handle || e.button !== 0) return;
    var row = handle.closest('.row.task');
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();
    closeColorPops(null);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    var line = el('div', 'drop-line');
    grid.appendChild(line);
    rowDrag = { id: row.dataset.id, row: row, line: line, target: indexById(row.dataset.id), moved: false, startY: e.clientY };
    row.classList.add('dragging');
    document.body.classList.add('row-dragging');
    selectTask(row.dataset.id);
    updateRowDrag(e.clientY);
  }

  /* Calcola la posizione di inserimento in base al cursore e mostra la linea guida. */
  function updateRowDrag(clientY) {
    var rows = Array.prototype.slice.call(grid.querySelectorAll('.row.task'));
    if (!rows.length) return;
    var slot = rows.length;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) { slot = i; break; }
    }
    var gridTop = grid.getBoundingClientRect().top;
    var ref = slot < rows.length ? rows[slot].getBoundingClientRect().top : rows[rows.length - 1].getBoundingClientRect().bottom;
    rowDrag.line.style.top = (ref - gridTop - 1) + 'px';
    var from = indexById(rowDrag.id);
    var target = slot > from ? slot - 1 : slot;
    rowDrag.target = target;
    rowDrag.line.classList.toggle('noop', target === from);
  }

  function onRowDragMove(e) {
    if (!rowDrag) return;
    e.preventDefault();
    if (Math.abs(e.clientY - rowDrag.startY) > 3) rowDrag.moved = true;
    var br = board.getBoundingClientRect();
    var edge = 36;
    if (e.clientY < br.top + edge + (headerRow ? headerRow.offsetHeight : 0)) board.scrollTop -= 12;
    else if (e.clientY > br.bottom - edge) board.scrollTop += 12;
    updateRowDrag(e.clientY);
  }

  function onRowDragEnd() {
    if (!rowDrag) return;
    var d = rowDrag;
    rowDrag = null;
    d.row.classList.remove('dragging');
    d.line.remove();
    document.body.classList.remove('row-dragging');
    if (d.moved && moveTask(d.id, d.target)) {
      var t = taskById(d.id);
      toast('«' + (t && t.name ? t.name : 'Attività') + '» spostata in posizione ' + (d.target + 1) + '.');
    }
  }

  function syncRows() {
    if (isCycle()) { syncCycleRows(); return; }
    var rows = grid.querySelectorAll('.row.task');
    rows.forEach(function (row) {
      var t = taskById(row.dataset.id);
      if (!t) return;
      setInput(row.querySelector('[data-field="name"]'), t.name);
      setInput(row.querySelector('[data-field="duration"]'), t.duration);
      setInput(row.querySelector('[data-field="start"]'), t.start);
      setInput(row.querySelector('[data-field="end"]'), t.end);
      setInput(row.querySelector('[data-field="lag"]'), t.lag);

      var predSel = row.querySelector('[data-field="pred"]');
      if (document.activeElement !== predSel && predSel.value !== (t.predecessorId || '')) predSel.value = t.predecessorId || '';
      var predTask = t.predecessorId ? taskById(t.predecessorId) : null;
      predSel.title = predTask ? 'Collegata a «' + predTask.name + '»' : 'Nessun collegamento';

      var linkSel = row.querySelector('[data-field="link"]');
      if (document.activeElement !== linkSel && linkSel.value !== t.link) linkSel.value = t.link;
      linkSel.disabled = !t.predecessorId;
      linkSel.title = predTask ? 'Tipo di vincolo con «' + predTask.name + '»' : 'Scegli prima un’attività collegata';

      var lag = row.querySelector('[data-field="lag"]');
      lag.disabled = !t.predecessorId;
      if (!t.predecessorId) {
        lag.title = 'Offset in giorni: disponibile con un collegamento';
      } else if (t.link === 'SS') {
        lag.title = 'Offset in giorni tra l’inizio di questa attività e l’inizio di quella collegata';
      } else if (t.link === 'FF') {
        lag.title = 'Giorni prima della fine dell’attività collegata in cui questa si conclude';
      } else {
        lag.title = 'Giorni di attesa dopo la fine dell’attività collegata';
      }

      var dot = row.querySelector('.swatch-dot');
      if (dot) dot.style.background = t.color;
      var colorBtn = row.querySelector('[data-action="color"]');
      if (colorBtn) colorBtn.title = 'Colore ' + t.color + ' — clicca per sceglierne un altro';
      row.querySelectorAll('.swatch').forEach(function (b) {
        b.classList.toggle('on', b.dataset.color === t.color);
      });

      ['countSat', 'countSun', 'countHol'].forEach(function (f) {
        var cb = row.querySelector('[data-field="' + f + '"]');
        if (cb && document.activeElement !== cb) cb.checked = t[f] === true;
      });

      var startInput = row.querySelector('[data-field="start"]');
      var endInput = row.querySelector('[data-field="end"]');
      var lockedStart = !!t.predecessorId;
      var lockedEnd = !!t.predecessorId && t.link === 'FF';
      var lockTitle = t.link === 'SS'
        ? 'Data calcolata: mantiene la stessa distanza dall’inizio dell’attività collegata'
        : (t.link === 'FF'
          ? 'Data calcolata: finisce prima della fine dell’attività collegata'
          : 'Data calcolata: inizia dopo la fine dell’attività collegata');
      [['start', startInput, lockedStart], ['end', endInput, lockedEnd]].forEach(function (pair) {
        var inp = pair[1];
        inp.disabled = pair[2];
        inp.classList.toggle('locked', pair[2]);
        inp.title = pair[2] ? lockTitle : '';
        inp.closest(pair[0] === 'start' ? '.cell-start' : '.cell-end').classList.toggle('locked', pair[2]);
      });
    });
  }

  function setInput(input, value) {
    if (!input) return;
    if (document.activeElement === input) return;
    var v = String(value);
    if (input.value !== v) input.value = v;
  }

  function computeRange() {
    var list = tasks();
    var min = null, max = null;
    list.forEach(function (t) {
      if (!min || t.start < min) min = t.start;
      if (!max || t.end > max) max = t.end;
    });
    if (!min) {
      var t0 = todayISO();
      min = addDays(t0, -3);
      max = addDays(t0, 24);
    }
    var start = startOfMonth(addDays(min, -7));
    var end = endOfMonth(addDays(max, 7));
    return { start: start, end: end, days: diffDays(start, end) + 1 };
  }

  /* Mappa i giorni di calendario sulla timeline: i periodi nascosti
     vengono omessi e non occupano larghezza. */
  function isHiddenIn(iso, list) {
    list = list || hiddenRanges();
    for (var i = 0; i < list.length; i++) {
      if (iso < list[i].start) return false;
      if (iso <= list[i].end) return true;
    }
    return false;
  }
  function countVisibleBetween(a, b, list) {
    if (!isISO(a) || !isISO(b) || diffDays(a, b) < 0) return 0;
    var n = 0, cur = a, guard = 0;
    while (cur <= b && guard++ < 40000) {
      if (!isHiddenIn(cur, list)) n++;
      cur = addDays(cur, 1);
    }
    return n;
  }
  function buildTimeMap() {
    if (!range) {
      timeMap = null;
      return null;
    }
    var px = ZOOMS[state.zoom].px;
    var hidden = hiddenRanges();
    var prefix = new Array(range.days + 1);
    var visible = [];
    var ri = 0;
    prefix[0] = 0;
    for (var i = 0; i < range.days; i++) {
      var iso = addDays(range.start, i);
      while (ri < hidden.length && hidden[ri].end < iso) ri++;
      var isHidden = ri < hidden.length && hidden[ri].start <= iso && iso <= hidden[ri].end;
      if (!isHidden) visible.push(iso);
      prefix[i + 1] = visible.length;
    }
    timeMap = {
      start: range.start,
      days: range.days,
      prefix: prefix,
      visible: visible,
      count: visible.length,
      px: px
    };
    return timeMap;
  }
  function visIndex(iso) {
    if (!timeMap) return 0;
    var d = diffDays(timeMap.start, iso);
    if (d < 0) d = 0;
    if (d > timeMap.days) d = timeMap.days;
    return timeMap.prefix[d];
  }
  function xOf(iso) {
    return timeMap ? visIndex(iso) * timeMap.px : 0;
  }
  function hiddenSig() {
    return hiddenRanges().map(function (r) { return r.start + '~' + r.end; }).join(',');
  }

  function dayGradient() {
    if (!timeMap) return 'linear-gradient(90deg, transparent, transparent)';
    var list = timeMap.visible;
    var px = timeMap.px;
    var count = list.length;
    if (!count) return 'linear-gradient(90deg, transparent, transparent)';
    function colorOf(iso) {
      if (holidayName(iso)) return 'rgba(239, 68, 68, .18)';
      if (isWeekend(iso)) return 'rgba(249, 115, 22, .15)';
      return null;
    }
    var stops = ['transparent 0px'];
    var k = 0;
    while (k < count) {
      var color = colorOf(list[k]);
      if (!color) { k++; continue; }
      var a = k;
      while (k + 1 < count && colorOf(list[k + 1]) === color) k++;
      var b = k;
      stops.push('transparent ' + (a * px) + 'px');
      stops.push(color + ' ' + (a * px) + 'px');
      stops.push(color + ' ' + ((b + 1) * px) + 'px');
      stops.push('transparent ' + ((b + 1) * px) + 'px');
      k++;
    }
    stops.push('transparent ' + (count * px) + 'px');
    return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
  }

  function renderTimelineHeader(force) {
    if (isCycle()) { renderCycleHeader(force); return; }
    range = computeRange();
    buildTimeMap();
    var zoom = ZOOMS[state.zoom];
    var px = zoom.px;
    var tlW = timeMap.count * px;
    var compact = px < 14;

    grid.classList.toggle('compact', compact);
    grid.style.setProperty('--px', px + 'px');
    grid.style.setProperty('--tl-w', tlW + 'px');
    grid.style.setProperty('--dayline', px >= 14 ? 'rgba(148, 163, 184, .2)' : 'transparent');
    grid.style.setProperty('--day-bg', dayGradient());

    var sig = range.start + '|' + range.end + '|' + state.zoom + '|' + timeMap.count + '|' + hiddenSig();
    if (!force && sig === headerSig) return;
    headerSig = sig;

    headTimeline.textContent = '';

    /* numeri di settimana ISO, compressi sui giorni visibili */
    var weeks = el('div', 'weeks');
    var vis = timeMap.visible;
    var weekKeys = vis.map(function (iso) {
      var w = isoWeek(iso);
      return w.year + '-' + w.week;
    });
    var segStart = 0;
    for (var wi = 1; wi <= vis.length; wi++) {
      if (wi === vis.length || weekKeys[wi] !== weekKeys[segStart]) {
        var wInfo = isoWeek(vis[segStart]);
        var wCount = wi - segStart;
        var weekEl = el('div', 'week');
        weekEl.style.width = (wCount * px) + 'px';
        if (wCount * px >= 25) weekEl.textContent = 'CW' + wInfo.week;
        weekEl.title = 'Settimana ' + wInfo.week + ' del ' + wInfo.year + ' · ' +
          wCount + (wCount === 1 ? ' giorno visibile' : ' giorni visibili');
        weeks.appendChild(weekEl);
        segStart = wi;
      }
    }
    headTimeline.appendChild(weeks);

    var months = el('div', 'months');
    var cursor = range.start;
    while (cursor <= range.end) {
      var mStart = startOfMonth(cursor);
      var mEnd = endOfMonth(cursor);
      var a = cursor > mStart ? cursor : mStart;
      var b = mEnd < range.end ? mEnd : range.end;
      var count = visIndex(addDays(b, 1)) - visIndex(a);
      if (count > 0) {
        var d = parseISO(a);
        var label = MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
        label = label.charAt(0).toUpperCase() + label.slice(1);
        var m = el('div', 'month', label);
        m.style.width = (count * px) + 'px';
        m.title = label + ' — ' + count + (count === 1 ? ' giorno visibile' : ' giorni visibili');
        months.appendChild(m);
      }
      cursor = addDays(b, 1);
    }
    headTimeline.appendChild(months);

    if (!compact) {
      var days = el('div', 'days');
      var today = todayISO();
      for (var i = 0; i < timeMap.visible.length; i++) {
        var iso = timeMap.visible[i];
        var dd = parseISO(iso);
        var wd = dd.getUTCDay();
        var hol = holidayName(iso);
        var cls = 'day' + (isWeekend(iso) ? ' we' : '') + (hol ? ' hol' : '') + (iso === today ? ' is-today' : '');
        var cell = el('div', cls);
        cell.style.width = px + 'px';
        if (hol) cell.title = hol + (iso === today ? ' · Oggi' : '');
        else if (iso === today) cell.title = 'Oggi';
        cell.appendChild(el('span', 'dnum', String(dd.getUTCDate())));
        if (px >= 18) cell.appendChild(el('span', 'dw', WD[wd]));
        days.appendChild(cell);
      }
      headTimeline.appendChild(days);
    }
  }

  function renderBars() {
    if (isCycle()) { renderCycleBars(); return; }
    if (!range) return;
    if (!timeMap) buildTimeMap();
    var px = timeMap.px;
    var rows = {};
    grid.querySelectorAll('.row.task').forEach(function (r) { rows[r.dataset.id] = r; });
    tasks().forEach(function (t) {
      var row = rows[t.id];
      if (!row) return;
      var bar = row.querySelector('.bar');
      var x0 = xOf(t.start);
      var x1 = xOf(addDays(t.end, 1));
      var w = Math.max(4, x1 - x0 - 2);
      var maxLeft = Math.max(0, timeMap.count * px - 4);
      bar.style.left = Math.min(x0 + 1, maxLeft) + 'px';
      placeLinkPoints(row, Math.min(x0 + 1, maxLeft), w);
      bar.style.width = w + 'px';
      bar.style.background = t.color;
      bar.classList.toggle('light', isLight(t.color));
      bar.classList.toggle('selected', t.id === state.selectedId);
      bar.classList.toggle('linked', !!t.predecessorId);
      bar.textContent = '';
      if (w >= 54) bar.appendChild(el('span', 'bar-name', t.name || 'Senza nome'));
      if (w >= 118) bar.appendChild(el('span', 'bar-days', t.duration + 'g'));
      var pred = t.predecessorId ? taskById(t.predecessorId) : null;
      bar.title = (t.name || 'Senza nome') + '\n' + fmtLong(t.start) + ' → ' + fmtLong(t.end) +
        '  (' + t.duration + (t.duration === 1 ? ' giorno' : ' giorni') + ')' +
        (pred ? '\n' + LINK_TYPES[t.link].label + ': ' + pred.name + (t.lag ? ' (offset ' + t.lag + ' gg)' : '') : '');
    });
  }

  /* Connettori tra attività collegate; spanOf(t) restituisce [x inizio, x fine]. */
  function linkPaths(spanOf) {
    var out = '';
    var idx = {};
    tasks().forEach(function (t, i) { idx[t.id] = i; });
    tasks().forEach(function (t) {
      if (!t.predecessorId) return;
      var p = taskById(t.predecessorId);
      if (!p || idx[p.id] === undefined || idx[t.id] === undefined) return;
      var ps = spanOf(p), ts = spanOf(t);
      var x1 = t.link === 'SS' ? ps[0] : ps[1];
      var x2 = t.link === 'FF' ? ts[1] : ts[0];
      var y1 = idx[p.id] * ROW_H + ROW_H / 2;
      var y2 = idx[t.id] * ROW_H + ROW_H / 2;
      var dash = t.link === 'SS' ? ' stroke-dasharray="4 3"' : (t.link === 'FF' ? ' stroke-dasharray="2 3"' : '');
      var d;
      if (x2 - x1 >= 8) {
        var mid = x1 + Math.max(6, Math.min(14, (x2 - x1) / 2));
        d = 'M' + x1 + ' ' + y1 + ' H' + mid + ' V' + y2 + ' H' + x2;
      } else {
        var back = Math.max(2, Math.min(x1, x2) - 12);
        d = 'M' + x1 + ' ' + y1 + ' H' + back + ' V' + y2 + ' H' + x2;
      }
      out += '<path d="' + d + '" fill="none" stroke="#94a3b8" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"' + dash + '></path>';
      out += '<path d="M' + x2 + ' ' + y2 + ' l-7 -3.4 v6.8 z" fill="#94a3b8"></path>';
    });
    return out;
  }

  /* ---------------- tempo ciclo: scala, intestazione, barre ---------------- */
  function pickStep(minPx, px, multipleOf) {
    for (var i = 0; i < CYCLE_STEPS.length; i++) {
      var s = CYCLE_STEPS[i];
      if (multipleOf) {
        var r = s / multipleOf;
        if (r < 2 || Math.abs(r - Math.round(r)) > 1e-6) continue;
      }
      if (s * px >= minPx) return s;
    }
    return CYCLE_STEPS[CYCLE_STEPS.length - 1];
  }

  function buildCycleScale() {
    var px = CYCLE_ZOOMS[state.zoom].px;
    var minor = pickStep(26, px);
    var major = pickStep(110, px, minor);
    var ct = sheetCycleTime(activeSheet());
    var want = ct + Math.max(major, ct * 0.15);
    var fill = visibleTimelineWidth() / px;
    var total = Math.max(want, fill, major * 2);
    var nMajor = Math.max(1, Math.ceil(total / major - 1e-9));
    total = round1(nMajor * major);
    cycleScale = {
      px: px,
      minor: minor,
      major: major,
      total: total,
      nMajor: nMajor,
      width: total * px,
      cycleTime: ct
    };
    return cycleScale;
  }

  function clockLabel(v) {
    var m = Math.floor(v / 60);
    var s = round1(v - m * 60);
    return m + ':' + (s < 10 ? '0' : '') + secText(s).replace('.', ',');
  }

  function renderCycleHeader(force) {
    var sc = buildCycleScale();
    grid.classList.remove('compact');
    grid.style.setProperty('--px', (sc.minor * sc.px) + 'px');
    grid.style.setProperty('--tl-w', sc.width + 'px');
    grid.style.setProperty('--dayline', 'rgba(148, 163, 184, .22)');
    grid.style.setProperty('--day-bg', 'linear-gradient(90deg, transparent, transparent)');

    var sig = 'c|' + sc.px + '|' + sc.minor + '|' + sc.major + '|' + sc.total + '|' + sc.cycleTime;
    if (!force && sig === headerSig) return;
    headerSig = sig;
    headTimeline.textContent = '';

    var majors = el('div', 'months');
    for (var i = 0; i < sc.nMajor; i++) {
      var v = round1(i * sc.major);
      var label = v >= 60 ? fmtSec(v) + ' · ' + clockLabel(v) : fmtSec(v);
      var m = el('div', 'month', label);
      m.style.width = (sc.major * sc.px) + 'px';
      m.title = 'Da ' + fmtSec(v) + ' a ' + fmtSec(round1(v + sc.major));
      majors.appendChild(m);
    }
    headTimeline.appendChild(majors);

    var ticks = el('div', 'days sec-ticks');
    var nMinor = Math.round(sc.total / sc.minor);
    var ratio = Math.round(sc.major / sc.minor);
    for (var j = 0; j < nMinor; j++) {
      var tv = round1(j * sc.minor);
      var cell = el('div', 'day' + (j % ratio === 0 ? ' major' : ''));
      cell.style.width = (sc.minor * sc.px) + 'px';
      cell.appendChild(el('span', 'dnum', secText(tv).replace('.', ',')));
      ticks.appendChild(cell);
    }
    headTimeline.appendChild(ticks);

    if (sc.cycleTime > 0) {
      var flag = el('div', 'ct-flag', 'TC ' + fmtSec(sc.cycleTime));
      flag.style.left = (sc.cycleTime * sc.px) + 'px';
      flag.title = 'Tempo ciclo della pagina: ' + fmtSec(sc.cycleTime);
      headTimeline.appendChild(flag);
    }
  }

  function renderCycleBars() {
    var sc = cycleScale || buildCycleScale();
    var px = sc.px;
    var rows = {};
    grid.querySelectorAll('.row.task').forEach(function (r) { rows[r.dataset.id] = r; });
    tasks().forEach(function (t) {
      var row = rows[t.id];
      if (!row) return;
      var bar = row.querySelector('.bar');
      var x0 = t.start * px;
      var w = Math.max(4, t.duration * px - 2);
      bar.style.left = (x0 + 1) + 'px';
      bar.style.width = w + 'px';
      placeLinkPoints(row, x0 + 1, w);
      bar.style.background = t.color;
      bar.classList.toggle('light', isLight(t.color));
      bar.classList.toggle('selected', t.id === state.selectedId);
      bar.classList.toggle('linked', !!t.predecessorId);
      bar.classList.toggle('sheet-bar', !!t.sourceSheetId);
      bar.textContent = '';
      if (w >= 54) bar.appendChild(el('span', 'bar-name', t.name || 'Senza nome'));
      if (w >= 118) bar.appendChild(el('span', 'bar-days', fmtSec(t.duration)));
      var pred = t.predecessorId ? taskById(t.predecessorId) : null;
      var src = t.sourceSheetId ? sheetById(t.sourceSheetId) : null;
      bar.title = (t.name || 'Senza nome') + '\n' + fmtSec(t.start) + ' → ' + fmtSec(t.end) +
        '  (durata ' + fmtSec(t.duration) + ')' +
        (src ? '\nPagina importata: «' + src.name + '»' : '') +
        (pred ? '\n' + LINK_TYPES[t.link].label + ': ' + pred.name + (t.lag ? ' (offset ' + fmtSec(t.lag) + ')' : '') : '');
    });
  }

  function renderCycleLinks() {
    var sc = cycleScale || buildCycleScale();
    var px = sc.px;
    var headH = headerRow ? headerRow.offsetHeight : CYCLE_HEAD_H;
    var totalH = tasks().length * ROW_H;
    linksSvg.setAttribute('width', sc.width);
    linksSvg.setAttribute('height', totalH);
    linksSvg.style.width = sc.width + 'px';
    linksSvg.style.height = totalH + 'px';
    linksSvg.style.top = headH + 'px';
    if (!totalH) { linksSvg.textContent = ''; return; }
    var out = '';
    for (var i = 1; i < sc.nMajor; i++) {
      var x = i * sc.major * px;
      out += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + totalH + '" stroke="rgba(100,116,139,.22)" stroke-width="1"></line>';
    }
    if (sc.cycleTime > 0) {
      var cx = sc.cycleTime * px;
      out += '<line x1="' + cx + '" y1="0" x2="' + cx + '" y2="' + totalH + '" stroke="#ef4444" stroke-width="1.6" stroke-dasharray="4 3" opacity=".62"></line>';
    }
    /* quota del calcolo tra due fini */
    var calc = calcPair(activeSheet());
    if (calc && calc.diff !== null) {
      var xa = calc.a.end * px, xb = calc.b.end * px;
      var ya = indexById(calc.a.id) * ROW_H + ROW_H / 2, yb = indexById(calc.b.id) * ROW_H + ROW_H / 2;
      var yq = Math.max(ya, yb) + 17;
      out += '<line x1="' + xa + '" y1="' + (ya - 13) + '" x2="' + xa + '" y2="' + (yq + 4) + '" stroke="#4f46e5" stroke-width="1.3" stroke-dasharray="3 2"></line>';
      out += '<line x1="' + xb + '" y1="' + (yb - 13) + '" x2="' + xb + '" y2="' + (yq + 4) + '" stroke="#4f46e5" stroke-width="1.3" stroke-dasharray="3 2"></line>';
      if (Math.abs(xb - xa) >= 2) {
        var lo = Math.min(xa, xb), hi = Math.max(xa, xb);
        out += '<line x1="' + lo + '" y1="' + yq + '" x2="' + hi + '" y2="' + yq + '" stroke="#4f46e5" stroke-width="1.4"></line>';
        out += '<path d="M' + lo + ' ' + yq + ' l5 -3 v6 z M' + hi + ' ' + yq + ' l-5 -3 v6 z" fill="#4f46e5"></path>';
      }
      var lbl = fmtSec(calc.diff);
      var lw = lbl.length * 6.2 + 10;
      var lx = Math.max(xa, xb) + 6 + lw / 2;
      out += '<rect x="' + (lx - lw / 2) + '" y="' + (yq - 6.5) + '" width="' + lw + '" height="13" rx="4" fill="#4f46e5"></rect>';
      out += '<text x="' + lx + '" y="' + (yq + 3.3) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff" font-family="Segoe UI, system-ui, sans-serif">' + escapeHtml(lbl) + '</text>';
    }
    out += linkPaths(function (t) { return [t.start * px + 1, t.end * px]; });
    linksSvg.innerHTML = out;
  }

  function renderLinks() {
    if (isCycle()) { if (linksSvg) renderCycleLinks(); return; }
    if (!linksSvg || !range) return;
    if (!timeMap) buildTimeMap();
    var px = timeMap.px;
    var headH = headerRow ? headerRow.offsetHeight : 54;
    var totalH = tasks().length * ROW_H;
    var width = timeMap.count * px;
    linksSvg.setAttribute('width', width);
    linksSvg.setAttribute('height', totalH);
    linksSvg.style.width = width + 'px';
    linksSvg.style.height = totalH + 'px';
    linksSvg.style.top = headH + 'px';
    if (!totalH) { linksSvg.textContent = ''; return; }

    var out = '';
    var cursor = range.start;
    while (cursor <= range.end) {
      var next = addDays(endOfMonth(cursor), 1);
      if (next > range.end) break;
      var x = xOf(next);
      out += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + totalH + '" stroke="rgba(100,116,139,.22)" stroke-width="1"></line>';
      cursor = next;
    }

    var today = todayISO();
    var ti = diffDays(range.start, today);
    if (ti >= 0 && ti < range.days && !isHiddenIn(today, hiddenRanges())) {
      var tx = xOf(today) + 0.5 * px;
      out += '<line x1="' + tx + '" y1="0" x2="' + tx + '" y2="' + totalH + '" stroke="#ef4444" stroke-width="1.6" stroke-dasharray="4 3" opacity=".62"></line>';
    }

    out += linkPaths(function (t) { return [xOf(t.start) + 1, xOf(addDays(t.end, 1))]; });
    linksSvg.innerHTML = out;
  }

  function updateCycleStats() {
    var list = tasks();
    var n = list.length;
    var sheet = activeSheet();
    statsbar.textContent = '';
    function stat(value, label) {
      var s = el('span', 'stat');
      s.appendChild(el('b', '', String(value)));
      s.appendChild(document.createTextNode(' ' + label));
      statsbar.appendChild(s);
    }
    statsbar.appendChild(el('span', 'stat stat-sheet', sheet ? sheet.name : 'Pagina'));
    statsbar.appendChild(el('span', 'dot'));
    if (!n) {
      statsbar.appendChild(el('span', 'stat', 'Nessuna attività in questa pagina.'));
    } else {
      var sum = 0;
      list.forEach(function (t) { sum += t.duration; });
      stat(n, 'attività');
      statsbar.appendChild(el('span', 'dot'));
      stat(fmtSec(sheetCycleTime(sheet)), 'tempo ciclo');
      statsbar.appendChild(el('span', 'dot'));
      stat(fmtSec(round1(sum)), 'somma durate');
    }
    statsbar.appendChild(el('span', 'dot'));
    stat(sheets().length, sheets().length === 1 ? 'pagina' : 'pagine');
    var links = countLinks();
    var imported = list.filter(function (t) { return t.sourceSheetId; }).length;
    if (links || imported) {
      var pill = el('span', 'pill');
      var parts = [];
      if (links) parts.push(links + (links === 1 ? ' collegamento' : ' collegamenti'));
      if (imported) parts.push(imported + (imported === 1 ? ' pagina importata' : ' pagine importate'));
      pill.textContent = parts.join(' · ');
      statsbar.appendChild(pill);
    }
    updateProjectMeta();
  }

  function updateStats() {
    if (isCycle()) { updateCycleStats(); return; }
    var list = tasks();
    var n = list.length;
    statsbar.textContent = '';
    if (!n) {
      statsbar.appendChild(el('span', 'stat', 'Nessuna attività: aggiungi la prima per iniziare.'));
      updateProjectMeta();
      return;
    }
    var min = null, max = null, total = 0;
    list.forEach(function (t) {
      if (!min || t.start < min) min = t.start;
      if (!max || t.end > max) max = t.end;
      total += t.duration;
    });
    var span = diffDays(min, max) + 1;
    var links = countLinks();

    function stat(value, label) {
      var s = el('span', 'stat');
      s.appendChild(el('b', '', String(value)));
      s.appendChild(document.createTextNode(' ' + label));
      statsbar.appendChild(s);
    }
    stat(n, n === 1 ? 'attività' : 'attività');
    statsbar.appendChild(el('span', 'dot'));
    stat(span, span === 1 ? 'giorno di calendario' : 'giorni di calendario');
    statsbar.appendChild(el('span', 'dot'));
    stat(total, 'giorni stimati in totale');
    statsbar.appendChild(el('span', 'dot'));
    statsbar.appendChild(el('span', 'stat', fmtShort(min) + ' → ' + fmtShort(max)));
    if (links) {
      var pill = el('span', 'pill');
      pill.textContent = links + (links === 1 ? ' collegamento attivo' : ' collegamenti attivi');
      statsbar.appendChild(pill);
    }
    updateProjectMeta();
  }

  function syncProjectName() {
    projectNameEl.value = state.project.name || 'Progetto senza titolo';
    document.title = (projectNameEl.value || 'Progetto') + ' — GanttFlow';
  }

  function updateProjectMeta() {
    if (isCycle()) {
      var sh = activeSheet();
      var nS = sheets().length;
      projectMetaEl.textContent = 'Tempo ciclo · ' + nS + (nS === 1 ? ' pagina' : ' pagine') +
        ' · ' + (sh ? sh.name + ': ' + fmtSec(sheetCycleTime(sh)) : '');
      return;
    }
    var list = tasks();
    if (!list.length) {
      projectMetaEl.textContent = 'Nessuna attività';
      return;
    }
    var min = null, max = null;
    list.forEach(function (t) {
      if (!min || t.start < min) min = t.start;
      if (!max || t.end > max) max = t.end;
    });
    var sameYear = min.slice(0, 4) === max.slice(0, 4);
    var rangeTxt = sameYear
      ? fmtShort(min) + ' – ' + fmtShort(max) + ' ' + max.slice(0, 4)
      : fmtShort(min) + ' ' + min.slice(0, 4) + ' – ' + fmtShort(max) + ' ' + max.slice(0, 4);
    projectMetaEl.textContent = list.length + ' attività · ' + rangeTxt;
  }

  function updateEmpty() {
    var emptyNow = tasks().length === 0;
    grid.hidden = emptyNow;
    emptyEl.hidden = !emptyNow;
    if (tlChip) tlChip.style.display = emptyNow ? 'none' : '';
    var demoBtn = document.getElementById('emptyDemo');
    if (demoBtn) demoBtn.hidden = isCycle() && projectTaskCount(state.project) > 0;
  }

  /* ============================================================
     RENDER COMPLETO / SCROLL
     ============================================================ */
  function renderAll(opts) {
    opts = opts || {};
    recalc();
    var st = board.scrollTop, sl = board.scrollLeft;
    buildGrid();
    updateEmpty();
    headerSig = '';
    renderTimelineHeader(true);
    syncRows();
    renderBars();
    renderLinks();
    updateStats();
    updateZoomLabel();
    updateMonthChip();
    renderCalendarPanel();
    renderSheetBar();
    renderCycleCalc();
    applySavedSplit();
    board.scrollTop = st;
    board.scrollLeft = sl;
    if (opts.focusId) {
      var inp = grid.querySelector('.row.task[data-id="' + opts.focusId + '"] [data-field="name"]');
      if (inp) {
        try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
        inp.select();
      }
    }
    saveSoon();
  }

  function afterEdit() {
    recalc();
    renderTimelineHeader(false);
    syncRows();
    renderBars();
    renderLinks();
    updateStats();
    updateMonthChip();
    renderSheetBar();
    renderCycleCalc();
    saveSoon();
  }

  function updateZoomLabel() {
    var label = document.getElementById('zoomLabel');
    if (label) label.textContent = (isCycle() ? CYCLE_ZOOMS : ZOOMS)[state.zoom].label;
    var out = document.getElementById('zoomOut');
    var inp = document.getElementById('zoomIn');
    if (out) out.disabled = state.zoom === 0;
    if (inp) inp.disabled = state.zoom === ZOOMS.length - 1;
  }

  function updateMonthChip() {
    if (!tlChip) return;
    if (isCycle()) {
      if (!cycleScale || !tasks().length) { tlChip.style.display = 'none'; return; }
      tlChip.style.display = '';
      var sec = Math.max(0, board.scrollLeft) / cycleScale.px;
      sec = Math.floor(sec / cycleScale.minor) * cycleScale.minor;
      tlChipText.textContent = (activeSheet() ? activeSheet().name + ' · ' : '') + 'da ' + fmtSec(round1(sec));
      return;
    }
    if (!range || !timeMap || !timeMap.visible.length || !tasks().length) { tlChip.style.display = 'none'; return; }
    tlChip.style.display = '';
    var px = timeMap.px;
    var idx = Math.floor(Math.max(0, board.scrollLeft) / px);
    idx = Math.max(0, Math.min(timeMap.visible.length - 1, idx));
    var d = parseISO(timeMap.visible[idx]);
    var month = MONTHS[d.getUTCMonth()];
    tlChipText.textContent = month.charAt(0).toUpperCase() + month.slice(1) + ' ' + d.getUTCFullYear();
  }

  function leftWidth() {
    var f = grid.querySelector('.row-head .fields');
    return f ? f.getBoundingClientRect().width : 712;
  }
  function visibleTimelineWidth() {
    return Math.max(120, board.clientWidth - leftWidth());
  }
  function scrollToDate(iso, smooth) {
    if (isCycle()) {
      if (smooth && typeof board.scrollTo === 'function') board.scrollTo({ left: 0, behavior: 'smooth' });
      else board.scrollLeft = 0;
      return;
    }
    if (!range || !timeMap) return;
    var px = timeMap.px;
    var x = xOf(iso) + 0.5 * px;
    var maxScroll = Math.max(0, board.scrollWidth - board.clientWidth);
    var target = x - visibleTimelineWidth() / 2;
    target = Math.max(0, Math.min(target, maxScroll));
    if (smooth && typeof board.scrollTo === 'function') board.scrollTo({ left: target, behavior: 'smooth' });
    else board.scrollLeft = target;
  }
  function dateAtCenter() {
    if (!range || !timeMap || !timeMap.visible.length) return todayISO();
    var px = timeMap.px;
    var x = board.scrollLeft + visibleTimelineWidth() / 2;
    var idx = Math.floor(x / px);
    idx = Math.max(0, Math.min(timeMap.visible.length - 1, idx));
    return timeMap.visible[idx];
  }
  function setZoom(delta) {
    var next = Math.max(0, Math.min(ZOOMS.length - 1, state.zoom + delta));
    if (next === state.zoom) return;
    if (isCycle()) {
      var oldPx = cycleScale ? cycleScale.px : CYCLE_ZOOMS[state.zoom].px;
      var centerSec = (board.scrollLeft + visibleTimelineWidth() / 2) / oldPx;
      state.zoom = next;
      renderTimelineHeader(true);
      renderBars();
      renderLinks();
      board.scrollLeft = Math.max(0, centerSec * cycleScale.px - visibleTimelineWidth() / 2);
      updateZoomLabel();
      updateMonthChip();
      return;
    }
    var center = dateAtCenter();
    state.zoom = next;
    renderTimelineHeader(true);
    renderBars();
    renderLinks();
    scrollToDate(center);
    updateZoomLabel();
    updateMonthChip();
    saveSoon();
  }

  function selectTask(id) {
    state.selectedId = id;
    grid.querySelectorAll('.row.task').forEach(function (row) {
      var on = row.dataset.id === id;
      row.classList.toggle('selected', on);
      var bar = row.querySelector('.bar');
      if (bar) bar.classList.toggle('selected', on);
    });
  }

  /* ============================================================
     AZIONI
     ============================================================ */
  function addTask() {
    if (tasks().length >= MAX_TASKS) {
      toast('Limite di ' + MAX_TASKS + ' attività raggiunto.', { type: 'error' });
      return;
    }
    var sel = taskById(state.selectedId);
    var t;
    if (isCycle()) {
      var cStart = sel ? sel.end : sheetCycleTime(activeSheet());
      t = makeCycleTask({ name: 'Nuova attività', start: cStart, duration: 2 });
    } else {
      var start = sel ? addDays(sel.end, 1) : todayISO();
      t = makeTask({ name: 'Nuova attività', start: start, duration: 3 });
    }
    tasks().push(t);
    state.selectedId = t.id;
    renderAll();
    var row = grid.querySelector('.row.task[data-id="' + t.id + '"]');
    if (row) {
      try { row.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
      var inp = row.querySelector('[data-field="name"]');
      if (inp) {
        try { inp.focus({ preventScroll: true }); } catch (e2) { inp.focus(); }
        inp.select();
      }
    }
  }

  function duplicateTask(id) {
    var src = taskById(id);
    if (!src) return;
    if (tasks().length >= MAX_TASKS) {
      toast('Limite di ' + MAX_TASKS + ' attività raggiunto.', { type: 'error' });
      return;
    }
    var copy;
    if (isCycle()) {
      copy = makeCycleTask({
        name: src.sourceSheetId ? src.name : src.name + ' (copia)',
        start: src.end,
        duration: src.duration,
        color: src.color,
        predecessorId: src.id,
        lag: 0,
        sourceSheetId: src.sourceSheetId || null
      });
    } else {
      copy = makeTask({
        name: src.name + ' (copia)',
        start: addDays(src.end, 1),
        duration: src.duration,
        color: src.color,
        predecessorId: src.id,
        lag: 0,
        countSat: src.countSat,
        countSun: src.countSun,
        countHol: src.countHol
      });
    }
    tasks().splice(indexById(id) + 1, 0, copy);
    state.selectedId = copy.id;
    renderAll({ focusId: copy.id });
    toast('Attività duplicata e collegata alla fine di «' + src.name + '».');
  }

  function deleteTask(id) {
    var idx = indexById(id);
    if (idx < 0) return;
    var name = tasks()[idx].name || 'Attività';
    var snapshot = JSON.stringify(tasks());
    tasks().splice(idx, 1);
    tasks().forEach(function (t) {
      if (t.predecessorId === id) t.predecessorId = null;
    });
    if (state.selectedId === id) state.selectedId = null;
    var sheetAtDelete = isCycle() ? state.project.activeSheet : null;
    var projectAtDelete = state.project;
    renderAll();
    toast('«' + name + '» eliminata', {
      actionLabel: 'Annulla',
      duration: 7000,
      onAction: function () {
        try {
          if (state.project !== projectAtDelete) return;
          if (isCycle()) {
            if (!sheetById(sheetAtDelete)) return;
            state.project.activeSheet = sheetAtDelete;
          }
          setTasks(JSON.parse(snapshot));
          state.selectedId = id;
          renderAll();
          toast('Attività ripristinata.');
        } catch (e) { /* ignore */ }
      }
    });
  }

  /* ---------------- calendario personalizzato ---------------- */
  function renderCalendarPanel() {
    if (!hiddenChipsEl || !customChipsEl) return;

    hiddenChipsEl.textContent = '';
    var ranges = hiddenRanges();
    if (!ranges.length) {
      hiddenChipsEl.appendChild(el('span', 'cal-empty', 'Nessun periodo nascosto'));
    } else {
      ranges.forEach(function (r) {
        var chip = el('span', 'chip chip-hidden');
        var label = r.start === r.end
          ? fmtShort(r.start) + ' ' + r.start.slice(0, 4)
          : fmtShort(r.start) + ' – ' + fmtShort(r.end) + ' ' + r.end.slice(0, 4);
        chip.appendChild(el('span', '', label));
        var x = el('button', 'chip-x', '×');
        x.type = 'button';
        x.title = 'Mostra di nuovo questo periodo';
        x.setAttribute('aria-label', 'Rimuovi il periodo nascosto ' + label);
        x.addEventListener('click', function () { removeHiddenRange(r.start, r.end); });
        chip.appendChild(x);
        hiddenChipsEl.appendChild(chip);
      });
    }

    customChipsEl.textContent = '';
    var customs = state.project && Array.isArray(state.project.customHolidays) ? state.project.customHolidays : [];
    if (!customs.length) {
      customChipsEl.appendChild(el('span', 'cal-empty', 'Nessun giorno rosso personalizzato'));
    } else {
      customs.forEach(function (d) {
        var chip = el('span', 'chip chip-red');
        chip.appendChild(el('span', '', fmtNum(d.date) + ' · ' + d.name));
        var x = el('button', 'chip-x', '×');
        x.type = 'button';
        x.title = 'Rimuovi questo giorno rosso';
        x.setAttribute('aria-label', 'Rimuovi il giorno rosso del ' + fmtNum(d.date));
        x.addEventListener('click', function () { removeCustomHoliday(d.date); });
        chip.appendChild(x);
        customChipsEl.appendChild(chip);
      });
    }
  }

  function addHiddenRange() {
    if (!hideStartEl || !hideEndEl) return;
    var a = hideStartEl.value, b = hideEndEl.value;
    if (!isISO(a) || !isISO(b)) {
      toast('Indica inizio e fine del periodo da nascondere.', { type: 'error' });
      return;
    }
    if (a > b) { var tmp = a; a = b; b = tmp; }
    if (diffDays(a, b) > MAX_DURATION) {
      toast('Il periodo da nascondere è troppo lungo.', { type: 'error' });
      return;
    }
    var proposed = normalizeHiddenRanges(hiddenRanges().concat([{ start: a, end: b }]));
    var r = computeRange();
    if (countVisibleBetween(r.start, r.end, proposed) <= 0) {
      toast('Il periodo nasconde tutte le date del diagramma: riduci l’intervallo.', { type: 'error' });
      return;
    }
    state.project.hiddenRanges = proposed;
    hideStartEl.value = '';
    hideEndEl.value = '';
    headerSig = '';
    renderAll();
    toast('Periodo nascosto dal diagramma: le date non occupano più spazio.');
  }

  function removeHiddenRange(start, end) {
    state.project.hiddenRanges = hiddenRanges().filter(function (r) {
      return !(r.start === start && r.end === end);
    });
    headerSig = '';
    renderAll();
    toast('Periodo di nuovo visibile nel diagramma.');
  }

  function addCustomHoliday() {
    if (!customDateEl) return;
    var date = customDateEl.value;
    if (!isISO(date)) {
      toast('Indica la data del giorno rosso da aggiungere.', { type: 'error' });
      return;
    }
    var builtin = builtinHolidayName(date);
    if (builtin) {
      toast('Il ' + fmtNum(date) + ' è già un festivo italiano (' + builtin + ').', { type: 'error' });
      return;
    }
    if (customHolidayIndex[date]) {
      toast('Il ' + fmtNum(date) + ' è già tra i giorni rossi personalizzati.', { type: 'error' });
      return;
    }
    var current = normalizeCustomHolidays(state.project.customHolidays || []);
    if (current.length >= MAX_CUSTOM) {
      toast('Limite di ' + MAX_CUSTOM + ' giorni rossi personalizzati raggiunto.', { type: 'error' });
      return;
    }
    var name = (customNameEl.value || '').trim().slice(0, 60) || 'Festivo personalizzato';
    state.project.customHolidays = normalizeCustomHolidays(current.concat([{ date: date, name: name }]));
    rebuildHolidayIndex();
    customDateEl.value = '';
    customNameEl.value = '';
    headerSig = '';
    renderAll();
    toast('Giorno rosso aggiunto: le durate sono state ricalcolate.');
  }

  function removeCustomHoliday(date) {
    state.project.customHolidays = (state.project.customHolidays || []).filter(function (d) {
      return d.date !== date;
    });
    rebuildHolidayIndex();
    headerSig = '';
    renderAll();
    toast('Giorno rosso rimosso: le durate sono state ricalcolate.');
  }

  /* Nuovo lavoro: si sceglie tra diagramma di Gantt e stima tempo ciclo. */
  function changeProject() {
    openTypeChooser(projectTaskCount(state.project) > 0).then(function (type) {
      if (type) newProject(type);
    });
  }

  function openTypeChooser(warn) {
    return new Promise(function (resolve) {
      typeModalResolve = resolve;
      var warnEl = document.getElementById('typeWarn');
      if (warnEl) warnEl.hidden = !warn;
      typeModalEl.hidden = false;
      setTimeout(function () {
        var first = typeModalEl.querySelector('.type-card');
        if (first) first.focus();
      }, 40);
    });
  }
  function closeTypeChooser(value) {
    if (!typeModalEl || typeModalEl.hidden) return;
    typeModalEl.hidden = true;
    var resolve = typeModalResolve;
    typeModalResolve = null;
    if (resolve) resolve(value);
  }

  /* Imposta un progetto appena creato/caricato e aggiorna tutta l'interfaccia. */
  function setProject(p) {
    state.project = p;
    state.selectedId = null;
    colorCursor = projectTaskCount(p);
    headerSig = '';
    cycleScale = null;
    rebuildHolidayIndex();
    applyMode();
    syncProjectName();
    renderAll();
  }

  function newProject(type) {
    var cyc = type === 'cycle';
    setProject(cyc ? makeCycleProject('Nuova stima tempo ciclo') : makeProject('Nuovo progetto', []));
    scrollToDate(todayISO());
    toast(cyc
      ? 'Nuova stima tempo ciclo pronta. Aggiungi la prima attività in secondi.'
      : 'Nuovo progetto pronto. Aggiungi la prima attività.');
    var inp = grid.querySelector('[data-field="name"]');
    if (inp) inp.focus();
  }

  function loadDemo() {
    if (isCycle()) {
      setProject(demoCycleProject());
      recalc();
      renderAll();
      scrollToDate(0);
      toast('Esempio caricato: la pagina «Ciclo completo» importa le due stazioni con il loro tempo ciclo.');
      return;
    }
    setProject(demoProject());
    scrollToDate(tasks()[0] ? tasks()[0].start : todayISO());
    toast('Esempio caricato: le attività collegate si aggiornano a catena.');
  }

  /* ---------------- pagine (tempo ciclo) ---------------- */
  function selectSheet(id) {
    if (!sheetById(id) || state.project.activeSheet === id) return;
    state.project.activeSheet = id;
    state.selectedId = null;
    headerSig = '';
    renderAll();
    board.scrollLeft = 0;
    board.scrollTop = 0;
  }

  function uniqueSheetName(base) {
    var names = {};
    sheets().forEach(function (s) { names[s.name.toLowerCase()] = true; });
    if (!names[base.toLowerCase()]) return base;
    var n = 2;
    while (names[(base + ' ' + n).toLowerCase()]) n++;
    return base + ' ' + n;
  }

  function addSheet() {
    if (sheets().length >= MAX_SHEETS) {
      toast('Limite di ' + MAX_SHEETS + ' pagine raggiunto.', { type: 'error' });
      return;
    }
    var n = sheets().length + 1;
    var name = 'Pagina ' + n;
    while (sheets().some(function (s) { return s.name.toLowerCase() === name.toLowerCase(); })) name = 'Pagina ' + (++n);
    var s = makeSheet(name, []);
    state.project.sheets.push(s);
    selectSheet(s.id);
    toast('Pagina «' + s.name + '» aggiunta. Doppio clic sulla linguetta per rinominarla.');
  }

  function duplicateSheet(id) {
    var src = sheetById(id);
    if (!src) return;
    if (sheets().length >= MAX_SHEETS) {
      toast('Limite di ' + MAX_SHEETS + ' pagine raggiunto.', { type: 'error' });
      return;
    }
    var idMap = {};
    var copyTasks = src.tasks.map(function (t) {
      var c = JSON.parse(JSON.stringify(t));
      c.id = uid();
      idMap[t.id] = c.id;
      return c;
    });
    copyTasks.forEach(function (c) { if (c.predecessorId) c.predecessorId = idMap[c.predecessorId] || null; });
    var s = makeSheet(uniqueSheetName(src.name + ' (copia)'), copyTasks);
    s.calcFrom = src.calcFrom ? idMap[src.calcFrom] || null : null;
    s.calcTo = src.calcTo ? idMap[src.calcTo] || null : null;
    state.project.sheets.splice(sheets().indexOf(src) + 1, 0, s);
    selectSheet(s.id);
    toast('Pagina duplicata: «' + s.name + '».');
  }

  function renameSheet(id, name) {
    var s = sheetById(id);
    if (!s) return;
    name = String(name || '').trim().slice(0, 60);
    if (!name) { renderSheetBar(); return; }
    s.name = name;
    recalc();
    renderAll();
  }

  function deleteSheet(id) {
    var s = sheetById(id);
    if (!s) return;
    if (sheets().length <= 1) {
      toast('Deve esserci almeno una pagina.', { type: 'error' });
      return;
    }
    var users = [];
    sheets().forEach(function (o) {
      if (o.tasks.some(function (t) { return t.sourceSheetId === id; })) users.push(o.name);
    });
    var msg = 'La pagina e le sue ' + s.tasks.length + ' attività verranno eliminate.' +
      (users.length ? ' È importata in: ' + users.join(', ') + '; lì diventerà un’attività normale con l’ultima durata calcolata (' + fmtSec(sheetCycleTime(s)) + ').' : '');
    openConfirm({
      title: 'Eliminare la pagina «' + s.name + '»?',
      message: msg,
      okLabel: 'Elimina pagina',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      var snapshot = JSON.stringify(state.project.sheets);
      var activeBefore = state.project.activeSheet;
      var projectAtDelete = state.project;
      var idx = sheets().indexOf(s);
      sheets().forEach(function (o) {
        o.tasks.forEach(function (t) { if (t.sourceSheetId === id) t.sourceSheetId = null; });
      });
      state.project.sheets.splice(idx, 1);
      if (state.project.activeSheet === id) state.project.activeSheet = sheets()[Math.max(0, idx - 1)].id;
      state.selectedId = null;
      headerSig = '';
      renderAll();
      toast('Pagina «' + s.name + '» eliminata', {
        actionLabel: 'Annulla',
        duration: 7000,
        onAction: function () {
          if (state.project !== projectAtDelete) return;
          try {
            state.project.sheets = JSON.parse(snapshot);
            state.project.activeSheet = activeBefore;
            headerSig = '';
            renderAll();
            toast('Pagina ripristinata.');
          } catch (e) { /* ignore */ }
        }
      });
    });
  }

  function moveSheet(id, delta) {
    var list = sheets();
    var i = list.indexOf(sheetById(id));
    var j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    var tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
    renderSheetBar();
    saveSoon();
  }

  /* Inserisce una pagina nella pagina attiva come attività collegata. */
  function importSheet(sourceId) {
    var into = activeSheet();
    var src = sheetById(sourceId);
    if (!into || !src) return;
    if (!canImportSheet(sourceId, into.id)) {
      toast('Importazione non possibile: «' + src.name + '» contiene già questa pagina (si creerebbe un ciclo).', { type: 'error' });
      return;
    }
    if (into.tasks.length >= MAX_TASKS) {
      toast('Limite di ' + MAX_TASKS + ' attività raggiunto.', { type: 'error' });
      return;
    }
    var sel = taskById(state.selectedId);
    var t = makeCycleTask({
      name: src.name,
      sourceSheetId: src.id,
      start: sel ? sel.end : sheetCycleTime(into),
      duration: sheetCycleTime(src),
      color: src.tasks[0] ? src.tasks[0].color : nextColor()
    });
    into.tasks.push(t);
    state.selectedId = t.id;
    renderAll();
    toast('«' + src.name + '» importata come attività: ' + fmtSec(sheetCycleTime(src)) + ' (si aggiorna automaticamente).');
  }

  function renderSheetBar() {
    if (!sheetBarEl || !sheetTabsEl) return;
    if (!isCycle()) { sheetBarEl.hidden = true; return; }
    sheetBarEl.hidden = false;
    if (sheetTabsEl.querySelector('.sheet-rename')) return;
    var active = activeSheet();
    sheetTabsEl.textContent = '';
    sheets().forEach(function (s, i) {
      var tab = el('div', 'sheet-tab' + (active && s.id === active.id ? ' active' : ''));
      tab.dataset.id = s.id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', active && s.id === active.id ? 'true' : 'false');
      tab.tabIndex = 0;
      tab.title = s.name + ' · tempo ciclo ' + fmtSec(sheetCycleTime(s)) + '\nDoppio clic per rinominare';
      var label = el('span', 'sheet-name', s.name);
      tab.appendChild(label);
      tab.appendChild(el('span', 'sheet-ct', fmtSec(sheetCycleTime(s))));
      if (active && s.id === active.id) {
        var tools = el('span', 'sheet-tools');
        [['left', '‹', 'Sposta a sinistra', i === 0],
          ['right', '›', 'Sposta a destra', i === sheets().length - 1],
          ['dup', '⧉', 'Duplica pagina', false],
          ['del', '×', 'Elimina pagina', sheets().length <= 1]].forEach(function (b) {
          var btn = el('button', 'sheet-btn sheet-' + b[0], b[1]);
          btn.type = 'button';
          btn.dataset.sheetAction = b[0];
          btn.title = b[2];
          btn.setAttribute('aria-label', b[2]);
          btn.disabled = b[3];
          tools.appendChild(btn);
        });
        tab.appendChild(tools);
      }
      sheetTabsEl.appendChild(tab);
    });

    if (importSheetSel) {
      importSheetSel.textContent = '';
      importSheetSel.appendChild(new Option('Importa pagina come attività…', ''));
      var count = 0;
      sheets().forEach(function (s) {
        if (!active || s.id === active.id) return;
        var opt = new Option(s.name + ' (' + fmtSec(sheetCycleTime(s)) + ')', s.id);
        if (!canImportSheet(s.id, active.id)) {
          opt.disabled = true;
          opt.textContent += ' — contiene questa pagina';
        } else {
          count++;
        }
        importSheetSel.appendChild(opt);
      });
      importSheetSel.disabled = !count;
      importSheetSel.title = count
        ? 'Inserisce la pagina scelta come attività con nome e tempo ciclo, aggiornati automaticamente'
        : 'Aggiungi un’altra pagina per poterla importare qui';
      importSheetSel.value = '';
    }
  }

  function startRenameSheet(tab) {
    var s = sheetById(tab.dataset.id);
    if (!s) return;
    var label = tab.querySelector('.sheet-name');
    var inp = el('input', 'sheet-rename');
    inp.value = s.name;
    inp.maxLength = 60;
    inp.setAttribute('aria-label', 'Nome della pagina');
    label.replaceWith(inp);
    inp.focus();
    inp.select();
    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      var value = inp.value;
      inp.remove();
      if (save) renameSheet(s.id, value);
      else renderSheetBar();
    }
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    inp.addEventListener('blur', function () { finish(true); });
  }

  function onSheetBarClick(e) {
    var btn = e.target.closest('[data-sheet-action]');
    var tab = e.target.closest('.sheet-tab');
    if (btn && tab) {
      var id = tab.dataset.id;
      var a = btn.dataset.sheetAction;
      if (a === 'left') moveSheet(id, -1);
      else if (a === 'right') moveSheet(id, 1);
      else if (a === 'dup') duplicateSheet(id);
      else if (a === 'del') deleteSheet(id);
      return;
    }
    if (tab && !e.target.closest('.sheet-rename')) selectSheet(tab.dataset.id);
  }

  function exportJSON() {
    saveNow();
    var payload = {
      format: 'ganttflow-project',
      version: 4,
      exportedAt: new Date().toISOString(),
      project: state.project
    };
    var name = slugify(state.project.name) + (isCycle() ? '-tempo-ciclo' : '') + '-' + todayISO() + '.json';
    download(name, JSON.stringify(payload, null, 2), 'application/json');
    toast('Progetto esportato: ' + name);
  }

  function exportPDF() {
    if (!window.GanttPDF) {
      toast('Modulo PDF non disponibile.', { type: 'error' });
      return;
    }
    try {
      recalc();
      var name = window.GanttPDF.download(state.project);
      toast('PDF generato: ' + name);
    } catch (err) {
      console.error(err);
      toast('Impossibile generare il PDF: ' + (err.message || 'errore sconosciuto'), { type: 'error' });
    }
  }

  function importFile(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast('File troppo grande (massimo 4 MB).', { type: 'error' });
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        var raw = data && data.project ? data.project : data;
        var p = sanitizeAny(raw);
        var count = projectTaskCount(p);
        if (p.type !== 'cycle' && !count) throw new Error('Il file non contiene attività.');
        setProject(p);
        scrollToDate(tasks()[0] ? tasks()[0].start : todayISO());
        saveNow();
        toast(p.type === 'cycle'
          ? 'Tempo ciclo «' + p.name + '» importato: ' + p.sheets.length + (p.sheets.length === 1 ? ' pagina, ' : ' pagine, ') + count + ' attività.'
          : 'Progetto «' + p.name + '» importato: ' + count + ' attività.');
      } catch (err) {
        toast(err && err.message ? err.message : 'File non valido.', { type: 'error' });
      }
    };
    reader.onerror = function () { toast('Impossibile leggere il file.', { type: 'error' }); };
    reader.readAsText(file);
  }

  /* ============================================================
     SALVATAGGIO LOCALE
     ============================================================ */
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
  }
  function saveNow() {
    if (!state.project) return;
    try {
      state.project.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ format: 'ganttflow', version: 1, project: state.project }));
      saveStatusEl.textContent = 'Salvato alle ' + fmtTime(new Date());
    } catch (e) {
      saveStatusEl.textContent = 'Salvataggio locale non disponibile';
    }
  }

  /* ============================================================
     TOAST E MODALE
     ============================================================ */
  function toast(message, opts) {
    opts = opts || {};
    if (!toastWrapEl) return;
    while (toastWrapEl.children.length >= 3) toastWrapEl.firstElementChild.remove();
    var box = el('div', 'toast' + (opts.type === 'error' ? ' error' : ''));
    box.appendChild(el('span', '', message));
    var timer = null;
    function close() {
      clearTimeout(timer);
      box.classList.add('out');
      setTimeout(function () { box.remove(); }, 220);
    }
    if (opts.actionLabel) {
      var action = el('button', 'toast-action', opts.actionLabel);
      action.type = 'button';
      action.addEventListener('click', function () {
        close();
        if (opts.onAction) opts.onAction();
      });
      box.appendChild(action);
    }
    toastWrapEl.appendChild(box);
    timer = setTimeout(close, opts.duration || 4200);
    box.addEventListener('mouseenter', function () { clearTimeout(timer); });
    box.addEventListener('mouseleave', function () { timer = setTimeout(close, 1600); });
  }

  var modalResolve = null;
  function openConfirm(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      modalResolve = resolve;
      modalTitleEl.textContent = opts.title || 'Conferma';
      modalTextEl.textContent = opts.message || '';
      modalIconEl.textContent = opts.danger ? '!' : '?';
      modalOkEl.textContent = opts.okLabel || 'Conferma';
      modalOkEl.className = 'btn ' + (opts.danger ? 'danger' : 'primary');
      modalCancelEl.textContent = opts.cancelLabel || 'Annulla';
      modalEl.hidden = false;
      setTimeout(function () { modalOkEl.focus(); }, 40);
    });
  }
  function closeModal(value) {
    if (modalEl.hidden) return;
    modalEl.hidden = true;
    var resolve = modalResolve;
    modalResolve = null;
    if (resolve) resolve(value);
  }

  /* ============================================================
     EVENTI
     ============================================================ */
  function onCycleInput(t, field, input) {
    var v = parseFloat(String(input.value).replace(',', '.'));
    if (field === 'duration') {
      if (t.sourceSheetId || !Number.isFinite(v) || v < 0.1) return;
      t.duration = clampSec(v, 0.1, MAX_SECONDS, 1);
      afterEdit();
      return;
    }
    if (field === 'start') {
      if (t.predecessorId || !Number.isFinite(v) || v < 0) return;
      t.start = clampSec(v, 0, MAX_SECONDS, 0);
      afterEdit();
      return;
    }
    if (field === 'end') {
      if (t.sourceSheetId || (t.predecessorId && t.link === 'FF') || !Number.isFinite(v)) return;
      var d = round1(v - t.start);
      if (d < 0.1) return;
      t.duration = clampSec(d, 0.1, MAX_SECONDS, 1);
      afterEdit();
      return;
    }
    if (field === 'lag') {
      t.lag = Number.isFinite(v) && v > 0 ? clampSec(v, 0, MAX_LAG_SECONDS, 0) : 0;
      afterEdit();
    }
  }

  function onGridInput(e) {
    var input = e.target;
    var field = input.dataset ? input.dataset.field : null;
    if (!field) return;
    var row = input.closest('.row.task');
    if (!row) return;
    var t = taskById(row.dataset.id);
    if (!t) return;

    if (field === 'name') {
      if (t.sourceSheetId) return;
      t.name = input.value.slice(0, 120);
      updateOptionLabels();
      renderBars();
      saveSoon();
      return;
    }
    if (isCycle()) { onCycleInput(t, field, input); return; }
    if (field === 'duration') {
      var dur = parseInt(input.value, 10);
      if (!Number.isFinite(dur) || dur < 1) return;
      t.duration = Math.min(MAX_DURATION, dur);
      afterEdit();
      return;
    }
    if (field === 'start') {
      if (t.predecessorId) return;
      if (!isISO(input.value)) return;
      t.start = input.value;
      afterEdit();
      return;
    }
    if (field === 'end') {
      if (!isISO(input.value)) return;
      var end = prevCounted(input.value, t);
      var d = countDays(t.start, end, t);
      if (d < 1) {
        toast('L’intervallo scelto non contiene giorni considerati: controlla le spunte Sab/Dom/Fest.', { type: 'error' });
        syncRows();
        return;
      }
      if (d > MAX_DURATION) d = MAX_DURATION;
      t.duration = d;
      t.end = endFromStart(t.start, d, t);
      afterEdit();
      return;
    }
    if (field === 'lag') {
      var lag = parseInt(input.value, 10);
      t.lag = Number.isFinite(lag) && lag > 0 ? Math.min(365, lag) : 0;
      afterEdit();
      return;
    }
  }

  function onGridChange(e) {
    var input = e.target;
    var field = input.dataset ? input.dataset.field : null;
    if (!field) return;
    var row = input.closest('.row.task');
    if (!row) return;
    var t = taskById(row.dataset.id);
    if (!t) return;

    if (field === 'pred') {
      var val = input.value || null;
      if (val && wouldCycle(t.id, val)) {
        toast('Collegamento non possibile: creerebbe un ciclo tra le attività.', { type: 'error' });
        syncRows();
        return;
      }
      t.predecessorId = val;
      afterEdit();
      return;
    }
    if (field === 'link') {
      t.link = LINK_TYPES[input.value] ? input.value : 'FS';
      afterEdit();
      return;
    }
    if (field === 'countSat' || field === 'countSun' || field === 'countHol') {
      t[field] = input.checked === true;
      afterEdit();
      return;
    }
    if (isCycle() && (field === 'duration' || field === 'start' || field === 'end' || field === 'lag')) {
      if (field === 'end') {
        var ev = parseFloat(String(input.value).replace(',', '.'));
        if (Number.isFinite(ev) && round1(ev - t.start) < 0.1) {
          toast('La fine deve essere successiva all’inizio (' + fmtSec(t.start) + ').', { type: 'error' });
        }
      }
      input.value = secText(t[field]);
      return;
    }
    if (field === 'duration') {
      var dur = parseInt(input.value, 10);
      if (!Number.isFinite(dur) || dur < 1) syncRows();
      return;
    }
    if (field === 'end') {
      if (!isISO(input.value)) syncRows();
      return;
    }
  }

  function closeColorPops(except) {
    grid.querySelectorAll('.swatch-pop').forEach(function (p) {
      if (p !== except) p.hidden = true;
    });
  }

  function toggleColorPop(row) {
    var pop = row.querySelector('.swatch-pop');
    if (!pop) return;
    var willOpen = pop.hidden;
    closeColorPops(null);
    pop.hidden = !willOpen;
    if (willOpen) {
      pop.classList.remove('up');
      var br = board.getBoundingClientRect();
      var pr = pop.getBoundingClientRect();
      if (pr.bottom > br.bottom - 6) pop.classList.add('up');
    }
  }

  function onGridClick(e) {
    var actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      var action = actionBtn.dataset.action;
      if (action === 'add') { addTask(); return; }
      var row = actionBtn.closest('.row.task');
      if (!row) return;
      if (action === 'delete') deleteTask(row.dataset.id);
      else if (action === 'duplicate') duplicateTask(row.dataset.id);
      else if (action === 'color') toggleColorPop(row);
      return;
    }
    var swatch = e.target.closest('.swatch');
    if (swatch) {
      var swRow = swatch.closest('.row.task');
      var swTask = swRow ? taskById(swRow.dataset.id) : null;
      if (swTask && hexColor(swatch.dataset.color)) {
        swTask.color = swatch.dataset.color;
        closeColorPops(null);
        renderBars();
        syncRows();
        saveSoon();
      }
      return;
    }
    var bar = e.target.closest('.bar');
    if (bar) {
      var barRow = bar.closest('.row.task');
      if (barRow) selectTask(barRow.dataset.id);
    }
  }

  function onGridDoubleClick(e) {
    var rz = e.target.closest('.col-resizer');
    if (rz) {
      e.preventDefault();
      resetColumnWidths();
      return;
    }
    var bar = e.target.closest('.bar');
    if (!bar) return;
    var row = bar.closest('.row.task');
    if (!row) return;
    selectTask(row.dataset.id);
    var inp = row.querySelector('[data-field="name"]');
    if (inp) { inp.focus(); inp.select(); }
  }

  function bindEvents() {
    grid.addEventListener('input', onGridInput);
    grid.addEventListener('change', onGridChange);
    grid.addEventListener('click', onGridClick);
    grid.addEventListener('dblclick', onGridDoubleClick);
    grid.addEventListener('mousedown', onColMouseDown);
    grid.addEventListener('mousedown', onRowDragStart);
    grid.addEventListener('mousedown', onLinkDragStart);
    document.addEventListener('mousemove', onLinkDragMove);
    document.addEventListener('mouseup', onLinkDragEnd);
    window.addEventListener('blur', onLinkDragEnd);
    document.addEventListener('mousemove', onColMouseMove);
    document.addEventListener('mousemove', onRowDragMove);
    document.addEventListener('mouseup', onColMouseUp);
    document.addEventListener('mouseup', onRowDragEnd);
    window.addEventListener('blur', onColMouseUp);
    window.addEventListener('blur', onRowDragEnd);
    calcFromSel.addEventListener('change', onCalcChange);
    calcToSel.addEventListener('change', onCalcChange);
    calcSplitEl.addEventListener('mousedown', onSplitDown);
    calcSplitEl.addEventListener('dblclick', function () { setCalcHeight(null, true); });
    calcSplitEl.addEventListener('keydown', onSplitKey);
    document.addEventListener('mousemove', onSplitMove);
    document.addEventListener('mouseup', onSplitUp);
    window.addEventListener('blur', onSplitUp);
    grid.addEventListener('focusin', function (e) {
      var row = e.target.closest('.row.task');
      if (row) selectTask(row.dataset.id);
    });
    grid.addEventListener('keydown', function (e) {
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        var kRow = e.target.closest('.row.task');
        if (!kRow) return;
        e.preventDefault();
        var kId = kRow.dataset.id;
        var field = e.target.dataset ? e.target.dataset.field : null;
        if (moveTask(kId, indexById(kId) + (e.key === 'ArrowUp' ? -1 : 1))) {
          var again = grid.querySelector('.row.task[data-id="' + kId + '"] [data-field="' + (field || 'name') + '"]');
          if (again && !again.disabled) { try { again.focus({ preventScroll: false }); } catch (err) { again.focus(); } }
        }
        return;
      }
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        e.target.blur();
      } else if (e.key === 'Escape') {
        e.target.blur();
      }
    });

    document.getElementById('btnAdd').addEventListener('click', addTask);
    document.getElementById('emptyAdd').addEventListener('click', addTask);
    document.getElementById('emptyDemo').addEventListener('click', loadDemo);
    document.getElementById('btnToday').addEventListener('click', function () { scrollToDate(todayISO(), true); });
    document.getElementById('zoomIn').addEventListener('click', function () { setZoom(1); });
    document.getElementById('zoomOut').addEventListener('click', function () { setZoom(-1); });
    document.getElementById('btnNew').addEventListener('click', changeProject);
    document.getElementById('btnJson').addEventListener('click', exportJSON);
    document.getElementById('btnPdf').addEventListener('click', exportPDF);
    document.getElementById('btnImport').addEventListener('click', function () {
      document.getElementById('fileInput').click();
    });
    var fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) importFile(fileInput.files[0]);
      fileInput.value = '';
    });

    var btnHide = document.getElementById('btnHideRange');
    if (btnHide) btnHide.addEventListener('click', addHiddenRange);
    var btnCustom = document.getElementById('btnAddCustom');
    if (btnCustom) btnCustom.addEventListener('click', addCustomHoliday);
    var btnResetCols = document.getElementById('btnResetCols');
    if (btnResetCols) btnResetCols.addEventListener('click', resetColumnWidths);
    var btnResetCols2 = document.getElementById('btnResetColsCycle');
    if (btnResetCols2) btnResetCols2.addEventListener('click', resetColumnWidths);

    /* barra delle pagine (tempo ciclo) */
    sheetTabsEl.addEventListener('click', onSheetBarClick);
    sheetTabsEl.addEventListener('dblclick', function (e) {
      var tab = e.target.closest('.sheet-tab');
      if (tab && !e.target.closest('[data-sheet-action]') && !e.target.closest('.sheet-rename')) startRenameSheet(tab);
    });
    sheetTabsEl.addEventListener('keydown', function (e) {
      var tab = e.target.closest('.sheet-tab');
      if (!tab || e.target !== tab) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSheet(tab.dataset.id); }
      else if (e.key === 'F2') { e.preventDefault(); startRenameSheet(tab); }
    });
    document.getElementById('btnAddSheet').addEventListener('click', addSheet);
    importSheetSel.addEventListener('change', function () {
      var id = importSheetSel.value;
      importSheetSel.value = '';
      if (id) importSheet(id);
    });

    /* scelta del tipo di lavoro */
    typeModalEl.addEventListener('click', function (e) {
      var card = e.target.closest('.type-card');
      if (card) { closeTypeChooser(card.dataset.type); return; }
      if (e.target.closest('#typeCancel')) closeTypeChooser(null);
    });
    typeModalEl.addEventListener('mousedown', function (e) { if (e.target === typeModalEl) closeTypeChooser(null); });
    [hideStartEl, hideEndEl].forEach(function (inp) {
      if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addHiddenRange(); } });
    });
    [customDateEl, customNameEl].forEach(function (inp) {
      if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addCustomHoliday(); } });
    });

    projectNameEl.addEventListener('input', function () {
      state.project.name = projectNameEl.value.slice(0, 80);
      document.title = (state.project.name || 'Progetto') + ' — GanttFlow';
      saveSoon();
    });
    projectNameEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') projectNameEl.blur();
    });

    modalOkEl.addEventListener('click', function () { closeModal(true); });
    modalCancelEl.addEventListener('click', function () { closeModal(false); });
    modalEl.addEventListener('mousedown', function (e) { if (e.target === modalEl) closeModal(false); });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.cell-color')) closeColorPops(null);
    });
    document.addEventListener('keydown', function (e) {
      if (!modalEl.hidden && e.key === 'Escape') { e.preventDefault(); closeModal(false); return; }
      if (typeModalEl && !typeModalEl.hidden) {
        if (e.key === 'Escape') { e.preventDefault(); closeTypeChooser(null); }
        return;
      }
      if (e.key === 'Escape') closeColorPops(null);
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
        e.preventDefault();
        exportJSON();
      }
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'o') {
        e.preventDefault();
        document.getElementById('fileInput').click();
      }
    });

    window.addEventListener('resize', function () {
      if (isCycle()) { applySavedSplit(); renderTimelineHeader(false); renderBars(); }
      renderLinks();
      updateMonthChip();
    });

    board.addEventListener('scroll', function () {
      if (chipRaf) return;
      chipRaf = requestAnimationFrame(function () {
        chipRaf = 0;
        updateMonthChip();
      });
    }, { passive: true });

    var zoomLabel = document.getElementById('zoomLabel');
    zoomLabel.title = 'Zoom: ' + (IS_MAC ? '⌘' : 'Ctrl') + ' + rotella del mouse';
    board.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }

  /* ============================================================
     AVVIO
     ============================================================ */
  function readStoredProject() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      return sanitizeAny(data && data.project ? data.project : data);
    } catch (e) {
      return null;
    }
  }

  function init() {
    board = document.getElementById('board');
    grid = document.getElementById('grid');
    emptyEl = document.getElementById('empty');
    statsbar = document.getElementById('statsbar');
    saveStatusEl = document.getElementById('saveStatus');
    toastWrapEl = document.getElementById('toast');
    projectNameEl = document.getElementById('projectName');
    projectMetaEl = document.getElementById('projectMeta');
    modalEl = document.getElementById('modal');
    modalTitleEl = document.getElementById('modalTitle');
    modalTextEl = document.getElementById('modalText');
    modalOkEl = document.getElementById('modalOk');
    modalCancelEl = document.getElementById('modalCancel');
    modalIconEl = document.getElementById('modalIcon');
    tlChip = document.getElementById('tlChip');
    tlChipText = document.getElementById('tlChipText');
    hideStartEl = document.getElementById('hideStart');
    hideEndEl = document.getElementById('hideEnd');
    hiddenChipsEl = document.getElementById('hiddenChips');
    customDateEl = document.getElementById('customDate');
    customNameEl = document.getElementById('customName');
    customChipsEl = document.getElementById('customChips');
    sheetBarEl = document.getElementById('sheetBar');
    sheetTabsEl = document.getElementById('sheetTabs');
    importSheetSel = document.getElementById('importSheetSel');
    typeModalEl = document.getElementById('typeModal');
    ctCalcEl = document.getElementById('ctCalc');
    calcFromSel = document.getElementById('calcFrom');
    calcToSel = document.getElementById('calcTo');
    calcResultEl = document.getElementById('calcResult');
    calcDetailEl = document.getElementById('calcDetail');
    calcSplitEl = document.getElementById('calcSplit');

    var stored = readStoredProject();
    state.project = stored || demoProject();
    colorCursor = projectTaskCount(state.project);
    if (stored) state.project.name = state.project.name || 'Progetto senza titolo';
    rebuildHolidayIndex();
    syncProjectName();

    bindEvents();
    applyMode();
    renderAll();

    requestAnimationFrame(function () {
      if (isCycle()) { renderAll(); return; }
      var t0 = todayISO();
      var focusDate = tasks().length ? tasks()[0].start : t0;
      if (range && (focusDate < range.start || focusDate > range.end)) focusDate = t0;
      scrollToDate(focusDate);
      updateMonthChip();
    });

    window.addEventListener('beforeunload', saveNow);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
