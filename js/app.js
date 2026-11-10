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
  var STORAGE_KEY = 'ganttflow.project.v1';
  var MAX_TASKS = 500;
  var MAX_DURATION = 3650;
  var DAY_MS = 86400000;
  var WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  var MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');

  /* --------------------------- stato --------------------------- */
  var state = {
    project: null,
    zoom: 1,
    selectedId: null
  };
  var range = null;
  var headerSig = '';
  var saveTimer = null;
  var colorCursor = 0;

  /* --------------------------- riferimenti DOM --------------------------- */
  var board, grid, emptyEl, statsbar, headerRow, headTimeline, linksSvg;
  var saveStatusEl, toastWrapEl, projectNameEl, projectMetaEl;
  var modalEl, modalTitleEl, modalTextEl, modalOkEl, modalCancelEl, modalIconEl;
  var tlChip, tlChipText, chipRaf = 0;

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
  function clampInt(v, min, max, def) {
    var n = parseInt(v, 10);
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, n));
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
  function makeProject(name, tasks) {
    var now = new Date().toISOString();
    return { name: name || 'Nuovo progetto', createdAt: now, updatedAt: now, tasks: tasks || [] };
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
      lag: 0
    };
    if (partial) Object.keys(partial).forEach(function (k) { if (partial[k] !== undefined) t[k] = partial[k]; });
    if (!isISO(t.start)) t.start = todayISO();
    t.duration = clampInt(t.duration, 1, MAX_DURATION, 1);
    if (!isISO(t.end)) t.end = addDays(t.start, t.duration - 1);
    return t;
  }

  function tasks() { return state.project ? state.project.tasks : []; }

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
    var list = tasks();
    if (!list.length) return;
    var map = {};
    list.forEach(function (t) { map[t.id] = t; });

    list.forEach(function (t) {
      if (!isISO(t.start)) t.start = todayISO();
      if (!isISO(t.end)) t.end = addDays(t.start, Math.max(1, t.duration) - 1);
      t.duration = clampInt(t.duration, 1, MAX_DURATION, 1);
      t.lag = clampInt(t.lag, 0, 365, 0);
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
      if (t.predecessorId && map[t.predecessorId]) {
        var p = map[t.predecessorId];
        t.start = addDays(p.end, 1 + t.lag);
      }
      t.duration = clampInt(t.duration, 1, MAX_DURATION, 1);
      t.end = addDays(t.start, t.duration - 1);
    });
  }

  function sanitizeProject(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tasks)) {
      throw new Error('Formato non valido: manca l\'elenco delle attività.');
    }
    var now = new Date().toISOString();
    var project = {
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Progetto importato',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
      tasks: []
    };
    var ids = {};
    raw.tasks.slice(0, MAX_TASKS).forEach(function (src, i) {
      if (!src || typeof src !== 'object') return;
      var id = typeof src.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(src.id) ? src.id : uid();
      while (ids[id]) id = uid();
      ids[id] = true;
      var start = isISO(src.start) ? src.start : todayISO();
      var duration = clampInt(src.duration, 1, MAX_DURATION, 0);
      var end = isISO(src.end) ? src.end : null;
      if (!duration && end) duration = Math.max(1, diffDays(start, end) + 1);
      if (!duration) duration = 1;
      if (end && diffDays(start, end) + 1 !== duration) end = addDays(start, duration - 1);
      project.tasks.push({
        id: id,
        name: typeof src.name === 'string' && src.name.trim() ? src.name.trim().slice(0, 120) : 'Attività ' + (i + 1),
        start: start,
        end: end || addDays(start, duration - 1),
        duration: duration,
        color: hexColor(src.color) || PALETTE[i % PALETTE.length],
        predecessorId: typeof src.predecessorId === 'string' ? src.predecessorId : null,
        lag: clampInt(src.lag, 0, 365, 0)
      });
    });
    var byId = {};
    project.tasks.forEach(function (t) { byId[t.id] = t; });
    project.tasks.forEach(function (t) {
      if (t.predecessorId && !byId[t.predecessorId]) t.predecessorId = null;
      if (t.predecessorId === t.id) t.predecessorId = null;
    });
    return project;
  }

  function demoProject() {
    var list = [];
    var base = todayISO();
    var dow = dayOfWeek(base);
    var start = addDays(base, (8 - dow) % 7);
    var seed = [
      ['Brief e ricerca', 5, '#6366f1', null],
      ['Wireframe UX', 6, '#0ea5e9', 0],
      ['Design UI', 8, '#a855f7', 1],
      ['Sviluppo frontend', 12, '#14b8a6', 2],
      ['Sviluppo backend', 10, '#f59e0b', 2],
      ['Test e QA', 5, '#ef4444', 3],
      ['Lancio', 1, '#22c55e', 5]
    ];
    seed.forEach(function (s, i) {
      var t = makeTask({
        name: s[0],
        start: start,
        duration: s[1],
        color: s[2],
        predecessorId: s[3] === null ? null : list[s[3]].id
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
     RENDER
     ============================================================ */
  function buildGrid() {
    grid.innerHTML = '';

    var head = el('div', 'row row-head');
    var headFields = el('div', 'fields head-fields');
    var labels = ['Attività', 'Giorni', 'Inizio', 'Fine', 'Inizia dopo', 'Colore', ''];
    var classes = ['cell-name', 'cell-dur', 'cell-start', 'cell-end', 'cell-pred', 'cell-color', 'cell-act'];
    labels.forEach(function (label, i) {
      var c = el('div', 'cell ' + classes[i], label);
      if (i === 4) c.title = 'L’attività parte il giorno dopo la fine di quella scelta';
      headFields.appendChild(c);
    });
    head.appendChild(headFields);

    headTimeline = el('div', 'head-timeline');
    head.appendChild(headTimeline);
    headerRow = head;
    grid.appendChild(head);

    tasks().forEach(function (t) { grid.appendChild(buildTaskRow(t)); });

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

  function buildTaskRow(t) {
    var row = el('div', 'row task');
    row.dataset.id = t.id;
    row.innerHTML =
      '<div class="fields">' +
        '<div class="cell cell-name"><input class="inp inp-name" data-field="name" maxlength="120" aria-label="Nome attività" spellcheck="false" placeholder="Nome attività"></div>' +
        '<div class="cell cell-dur"><input class="inp inp-num" data-field="duration" type="number" min="1" max="' + MAX_DURATION + '" step="1" aria-label="Durata in giorni" title="Durata stimata in giorni"></div>' +
        '<div class="cell cell-start">' +
          '<input class="inp inp-date" data-field="start" type="date" aria-label="Data di inizio">' +
          '<span class="lock" aria-hidden="true"><svg viewBox="0 0 16 16"><rect x="3.2" y="7" width="9.6" height="6.6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span>' +
        '</div>' +
        '<div class="cell cell-end"><input class="inp inp-date" data-field="end" type="date" aria-label="Data di fine"></div>' +
        '<div class="cell cell-pred">' +
          '<select class="inp inp-select" data-field="pred" aria-label="Attività precedente"></select>' +
          '<input class="inp inp-lag" data-field="lag" type="number" min="0" max="365" step="1" title="Sfasamento in giorni" aria-label="Sfasamento in giorni">' +
        '</div>' +
        '<div class="cell cell-color"><input class="inp-color" data-field="color" type="color" aria-label="Colore attività"></div>' +
        '<div class="cell cell-act">' +
          '<button type="button" class="icon-btn" data-action="duplicate" title="Duplica attività" aria-label="Duplica attività"><svg viewBox="0 0 16 16"><rect x="5.2" y="5.2" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.4 3.4H5.2a2 2 0 0 0-2 2v5.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>' +
          '<button type="button" class="icon-btn danger" data-action="delete" title="Elimina attività" aria-label="Elimina attività"><svg viewBox="0 0 16 16"><path d="M3.4 4.6h9.2M6.2 4.6V3.2h3.6v1.4M4.6 4.6l.6 8.2h5.6l.6-8.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="timeline"><div class="lane"><div class="bar"></div></div></div>';
    var select = row.querySelector('[data-field="pred"]');
    buildPredOptions(select, t);
    return row;
  }

  function buildPredOptions(select, t) {
    select.textContent = '';
    select.appendChild(new Option('—', ''));
    tasks().forEach(function (p) {
      if (p.id === t.id) return;
      if (wouldCycle(t.id, p.id)) return;
      select.appendChild(new Option(p.name || 'Senza nome', p.id));
    });
    select.value = t.predecessorId || '';
  }

  function updateOptionLabels() {
    grid.querySelectorAll('.row.task').forEach(function (row) {
      var select = row.querySelector('[data-field="pred"]');
      if (!select) return;
      Array.prototype.forEach.call(select.options, function (opt) {
        if (!opt.value) return;
        var t = taskById(opt.value);
        if (t) opt.textContent = t.name || 'Senza nome';
      });
    });
  }

  function syncRows() {
    var rows = grid.querySelectorAll('.row.task');
    rows.forEach(function (row) {
      var t = taskById(row.dataset.id);
      if (!t) return;
      setInput(row.querySelector('[data-field="name"]'), t.name);
      setInput(row.querySelector('[data-field="duration"]'), t.duration);
      setInput(row.querySelector('[data-field="start"]'), t.start);
      setInput(row.querySelector('[data-field="end"]'), t.end);
      setInput(row.querySelector('[data-field="lag"]'), t.lag);
      var sel = row.querySelector('[data-field="pred"]');
      if (document.activeElement !== sel && sel.value !== (t.predecessorId || '')) sel.value = t.predecessorId || '';
      var predTask = t.predecessorId ? taskById(t.predecessorId) : null;
      sel.title = predTask ? 'Inizia dopo «' + predTask.name + '»' + (t.lag ? ' (+' + t.lag + ' gg)' : '') : 'Nessun collegamento';
      var color = row.querySelector('[data-field="color"]');
      if (color.value !== t.color) color.value = t.color;

      var startInput = row.querySelector('[data-field="start"]');
      var locked = !!t.predecessorId;
      startInput.disabled = locked;
      startInput.classList.toggle('locked', locked);
      startInput.title = locked ? 'Data calcolata dalla attività precedente' : '';
      startInput.closest('.cell-start').classList.toggle('locked', locked);
      var lag = row.querySelector('[data-field="lag"]');
      lag.disabled = !locked;
      lag.style.display = locked ? '' : 'none';
      lag.title = locked ? 'Sfasamento in giorni rispetto alla fine dell’attività precedente' : 'Sfasamento (disponibile solo con un collegamento)';
      lag.closest('.cell-pred').title = locked ? 'Inizio calcolato automaticamente' : '';
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

  function renderTimelineHeader(force) {
    range = computeRange();
    var zoom = ZOOMS[state.zoom];
    var px = zoom.px;
    var tlW = range.days * px;
    var compact = px < 14;

    grid.classList.toggle('compact', compact);
    grid.style.setProperty('--px', px + 'px');
    grid.style.setProperty('--tl-w', tlW + 'px');

    var dow = dayOfWeek(range.start);
    var sat = (6 - dow + 7) % 7;
    var sun = (sat + 1) % 7;
    grid.style.setProperty('--sat', sat);
    grid.style.setProperty('--sun', sun);
    grid.style.setProperty('--dayline', px >= 14 ? 'rgba(148, 163, 184, .2)' : 'transparent');

    var sig = range.start + '|' + range.end + '|' + state.zoom;
    if (!force && sig === headerSig) return;
    headerSig = sig;

    headTimeline.textContent = '';
    var months = el('div', 'months');
    var cursor = range.start;
    while (cursor <= range.end) {
      var mStart = startOfMonth(cursor);
      var mEnd = endOfMonth(cursor);
      var a = cursor > mStart ? cursor : mStart;
      var b = mEnd < range.end ? mEnd : range.end;
      var count = diffDays(a, b) + 1;
      var d = parseISO(a);
      var label = MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
      var m = el('div', 'month', label.charAt(0).toUpperCase() + label.slice(1));
      m.style.width = (count * px) + 'px';
      m.title = label.charAt(0).toUpperCase() + label.slice(1) + ' — ' + count + ' giorni';
      months.appendChild(m);
      cursor = addDays(b, 1);
    }
    headTimeline.appendChild(months);

    if (!compact) {
      var days = el('div', 'days');
      var today = todayISO();
      for (var i = 0; i < range.days; i++) {
        var iso = addDays(range.start, i);
        var dd = parseISO(iso);
        var wd = dd.getUTCDay();
        var cell = el('div', 'day' + (wd === 0 || wd === 6 ? ' we' : '') + (iso === today ? ' is-today' : ''));
        cell.style.width = px + 'px';
        if (iso === today) cell.title = 'Oggi';
        cell.appendChild(el('span', 'dnum', String(dd.getUTCDate())));
        if (px >= 18) cell.appendChild(el('span', 'dw', WD[wd]));
        days.appendChild(cell);
      }
      headTimeline.appendChild(days);
    }
  }

  function renderBars() {
    if (!range) return;
    var px = ZOOMS[state.zoom].px;
    var rows = {};
    grid.querySelectorAll('.row.task').forEach(function (r) { rows[r.dataset.id] = r; });
    tasks().forEach(function (t) {
      var row = rows[t.id];
      if (!row) return;
      var bar = row.querySelector('.bar');
      var w = Math.max(4, t.duration * px - 2);
      bar.style.left = (diffDays(range.start, t.start) * px + 1) + 'px';
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
        (pred ? '\nDopo: ' + pred.name + (t.lag ? ' (+' + t.lag + ' gg)' : '') : '');
    });
  }

  function renderLinks() {
    if (!linksSvg || !range) return;
    var px = ZOOMS[state.zoom].px;
    var headH = headerRow ? headerRow.offsetHeight : 54;
    var totalH = tasks().length * ROW_H;
    var width = range.days * px;
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
      var x = diffDays(range.start, next) * px;
      out += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + totalH + '" stroke="rgba(100,116,139,.22)" stroke-width="1"></line>';
      cursor = next;
    }

    var ti = diffDays(range.start, todayISO());
    if (ti >= 0 && ti < range.days) {
      var tx = (ti + 0.5) * px;
      out += '<line x1="' + tx + '" y1="0" x2="' + tx + '" y2="' + totalH + '" stroke="#ef4444" stroke-width="1.6" stroke-dasharray="4 3" opacity=".62"></line>';
    }

    var idx = {};
    tasks().forEach(function (t, i) { idx[t.id] = i; });
    tasks().forEach(function (t) {
      if (!t.predecessorId) return;
      var p = taskById(t.predecessorId);
      if (!p || idx[p.id] === undefined || idx[t.id] === undefined) return;
      var x1 = diffDays(range.start, p.start) * px + Math.max(4, p.duration * px - 2) + 1;
      var x2 = diffDays(range.start, t.start) * px + 1;
      var y1 = idx[p.id] * ROW_H + ROW_H / 2;
      var y2 = idx[t.id] * ROW_H + ROW_H / 2;
      var gap = x2 - x1;
      if (gap < 0) return;
      var mid = x1 + Math.max(6, Math.min(14, gap / 2));
      out += '<path d="M' + x1 + ' ' + y1 + ' H' + mid + ' V' + y2 + ' H' + x2 + '" fill="none" stroke="#94a3b8" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"></path>';
      out += '<path d="M' + x2 + ' ' + y2 + ' l-7 -3.4 v6.8 z" fill="#94a3b8"></path>';
    });
    linksSvg.innerHTML = out;
  }

  function updateStats() {
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
    saveSoon();
  }

  function updateZoomLabel() {
    var label = document.getElementById('zoomLabel');
    if (label) label.textContent = ZOOMS[state.zoom].label;
    var out = document.getElementById('zoomOut');
    var inp = document.getElementById('zoomIn');
    if (out) out.disabled = state.zoom === 0;
    if (inp) inp.disabled = state.zoom === ZOOMS.length - 1;
  }

  function updateMonthChip() {
    if (!tlChip) return;
    if (!range || !tasks().length) { tlChip.style.display = 'none'; return; }
    tlChip.style.display = '';
    var px = ZOOMS[state.zoom].px;
    var idx = Math.floor(Math.max(0, board.scrollLeft) / px);
    idx = Math.max(0, Math.min(range.days - 1, idx));
    var d = parseISO(addDays(range.start, idx));
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
    if (!range) return;
    var px = ZOOMS[state.zoom].px;
    var x = (diffDays(range.start, iso) + 0.5) * px;
    var maxScroll = Math.max(0, board.scrollWidth - board.clientWidth);
    var target = x - visibleTimelineWidth() / 2;
    target = Math.max(0, Math.min(target, maxScroll));
    if (smooth && typeof board.scrollTo === 'function') board.scrollTo({ left: target, behavior: 'smooth' });
    else board.scrollLeft = target;
  }
  function dateAtCenter() {
    if (!range) return todayISO();
    var px = ZOOMS[state.zoom].px;
    var x = board.scrollLeft + visibleTimelineWidth() / 2;
    var idx = Math.floor(x / px);
    idx = Math.max(0, Math.min(range.days - 1, idx));
    return addDays(range.start, idx);
  }
  function setZoom(delta) {
    var center = dateAtCenter();
    var next = Math.max(0, Math.min(ZOOMS.length - 1, state.zoom + delta));
    if (next === state.zoom) return;
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
    var start = sel ? addDays(sel.end, 1) : todayISO();
    var t = makeTask({ name: 'Nuova attività', start: start, duration: 3 });
    state.project.tasks.push(t);
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
    var copy = makeTask({
      name: src.name + ' (copia)',
      start: addDays(src.end, 1),
      duration: src.duration,
      color: src.color,
      predecessorId: src.id,
      lag: 0
    });
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
    state.project.tasks.splice(idx, 1);
    state.project.tasks.forEach(function (t) {
      if (t.predecessorId === id) t.predecessorId = null;
    });
    if (state.selectedId === id) state.selectedId = null;
    renderAll();
    toast('«' + name + '» eliminata', {
      actionLabel: 'Annulla',
      duration: 7000,
      onAction: function () {
        try {
          state.project.tasks = JSON.parse(snapshot);
          state.selectedId = id;
          renderAll();
          toast('Attività ripristinata.');
        } catch (e) { /* ignore */ }
      }
    });
  }

  function changeProject() {
    if (!tasks().length) {
      newProject();
      return;
    }
    openConfirm({
      title: 'Creare un nuovo progetto?',
      message: 'Il progetto attuale verrà sostituito. Se vuoi conservarlo, esportalo prima in JSON: il salvataggio locale verrà sovrascritto.',
      okLabel: 'Crea nuovo progetto',
      danger: true
    }).then(function (ok) {
      if (ok) newProject();
    });
  }

  function newProject() {
    state.project = makeProject('Nuovo progetto', []);
    state.selectedId = null;
    headerSig = '';
    syncProjectName();
    renderAll();
    scrollToDate(todayISO());
    toast('Nuovo progetto pronto. Aggiungi la prima attività.');
    var inp = grid.querySelector('[data-field="name"]');
    if (inp) inp.focus();
  }

  function loadDemo() {
    state.project = demoProject();
    state.selectedId = null;
    colorCursor = state.project.tasks.length;
    headerSig = '';
    syncProjectName();
    renderAll();
    scrollToDate(tasks()[0] ? tasks()[0].start : todayISO());
    toast('Esempio caricato: le attività collegate si aggiornano a catena.');
  }

  function exportJSON() {
    saveNow();
    var payload = {
      format: 'ganttflow-project',
      version: 1,
      exportedAt: new Date().toISOString(),
      project: state.project
    };
    var name = slugify(state.project.name) + '-' + todayISO() + '.json';
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
        var p = sanitizeProject(raw);
        if (!p.tasks.length) throw new Error('Il file non contiene attività.');
        state.project = p;
        state.selectedId = null;
        colorCursor = p.tasks.length;
        headerSig = '';
        syncProjectName();
        renderAll();
        scrollToDate(tasks()[0] ? tasks()[0].start : todayISO());
        saveNow();
        toast('Progetto «' + p.name + '» importato: ' + p.tasks.length + ' attività.');
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
  function onGridInput(e) {
    var input = e.target;
    var field = input.dataset ? input.dataset.field : null;
    if (!field) return;
    var row = input.closest('.row.task');
    if (!row) return;
    var t = taskById(row.dataset.id);
    if (!t) return;

    if (field === 'name') {
      t.name = input.value.slice(0, 120);
      updateOptionLabels();
      renderBars();
      saveSoon();
      return;
    }
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
      var d = diffDays(t.start, input.value) + 1;
      if (d < 1) {
        toast('La data di fine non può precedere quella di inizio.', { type: 'error' });
        syncRows();
        return;
      }
      if (d > MAX_DURATION) d = MAX_DURATION;
      t.duration = d;
      t.end = addDays(t.start, d - 1);
      afterEdit();
      return;
    }
    if (field === 'lag') {
      var lag = parseInt(input.value, 10);
      t.lag = Number.isFinite(lag) && lag > 0 ? Math.min(365, lag) : 0;
      afterEdit();
      return;
    }
    if (field === 'color') {
      if (hexColor(input.value)) {
        t.color = input.value;
        renderBars();
        saveSoon();
      }
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

  function onGridClick(e) {
    var actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      var action = actionBtn.dataset.action;
      if (action === 'add') { addTask(); return; }
      var row = actionBtn.closest('.row.task');
      if (!row) return;
      if (action === 'delete') deleteTask(row.dataset.id);
      else if (action === 'duplicate') duplicateTask(row.dataset.id);
      return;
    }
    var bar = e.target.closest('.bar');
    if (bar) {
      var barRow = bar.closest('.row.task');
      if (barRow) selectTask(barRow.dataset.id);
    }
  }

  function onGridDoubleClick(e) {
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
    grid.addEventListener('focusin', function (e) {
      var row = e.target.closest('.row.task');
      if (row) selectTask(row.dataset.id);
    });
    grid.addEventListener('keydown', function (e) {
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
    document.addEventListener('keydown', function (e) {
      if (!modalEl.hidden && e.key === 'Escape') { e.preventDefault(); closeModal(false); return; }
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
        e.preventDefault();
        exportJSON();
      }
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'o') {
        e.preventDefault();
        document.getElementById('fileInput').click();
      }
    });

    window.addEventListener('resize', function () { renderLinks(); updateMonthChip(); });

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
      return sanitizeProject(data && data.project ? data.project : data);
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

    var stored = readStoredProject();
    state.project = stored || demoProject();
    colorCursor = tasks().length;
    if (stored) state.project.name = state.project.name || 'Progetto senza titolo';
    syncProjectName();

    bindEvents();
    renderAll();

    requestAnimationFrame(function () {
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
