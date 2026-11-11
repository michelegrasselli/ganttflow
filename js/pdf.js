/* ============================================================
   GanttFlow — generatore PDF (senza dipendenze esterne)
   Produce un PDF A4 orizzontale con tabella attività e barre
   su scala calendario. Scritto a mano: nessuna libreria.
   ============================================================ */
window.GanttPDF = (function () {
  'use strict';

  var PAGE_W = 841.89;
  var PAGE_H = 595.28;
  var M = 32;
  var ROW_H = 15;
  var ROWS_TOP = 500;
  var ROWS_BOTTOM = 48;
  var ROWS_PER_PAGE = Math.floor((ROWS_TOP - ROWS_BOTTOM) / ROW_H);
  var COL = {
    no: 32,
    name: 54,
    nameW: 176,
    durRight: 258,
    start: 282,
    end: 340,
    after: 406,
    timeline: 424
  };
  var TL_W = PAGE_W - M - COL.timeline;
  var INK = [0.06, 0.09, 0.16];
  var MUTED = [0.35, 0.4, 0.5];
  var FAINT = [0.82, 0.85, 0.9];
  var ACCENT = [0.31, 0.27, 0.9];
  var TODAY = [0.88, 0.11, 0.28];
  var WEEKEND_FILL = [0.996, 0.925, 0.875];
  var HOLIDAY_FILL = [0.988, 0.868, 0.868];
  var LINK_LABEL = { FS: 'dopo', SS: 'con', FF: 'prima' };
  var FIXED_HOLIDAYS = {
    '01-01': 'Capodanno', '01-06': 'Epifania', '04-25': 'Liberazione', '05-01': 'Lavoratori',
    '06-02': 'Repubblica', '08-15': 'Ferragosto', '11-01': 'Ognissanti', '12-08': 'Immacolata',
    '12-25': 'Natale', '12-26': 'Santo Stefano'
  };
  var MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  var DAY = 86400000;

  /* ----------------------------- date ----------------------------- */
  function parseISO(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toISO(dt) { return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate()); }
  function addDays(iso, n) {
    var d = parseISO(iso);
    if (!d) return iso;
    d.setUTCDate(d.getUTCDate() + (n | 0));
    return toISO(d);
  }
  function diffDays(a, b) {
    var da = parseISO(a), db = parseISO(b);
    if (!da || !db) return 0;
    return Math.round((db.getTime() - da.getTime()) / DAY);
  }
  function startOfMonth(iso) {
    var d = parseISO(iso);
    return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }
  function endOfMonth(iso) {
    var d = parseISO(iso);
    return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
  }
  function todayISO() {
    var n = new Date();
    return toISO(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
  }
  function fmtLong(iso) {
    var d = parseISO(iso);
    return d ? d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : '—';
  }
  function fmtNum(iso) {
    var d = parseISO(iso);
    return d ? pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() : '—';
  }
  function fmtNumShort(iso) {
    var d = parseISO(iso);
    return d ? pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + '/' + String(d.getUTCFullYear()).slice(2) : '—';
  }

  /* ------------------------- festivi italiani ------------------------- */
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
    map[addDays(easter, 1)] = 'Lunedi dell Angelo';
    holidayCache[year] = map;
    return map;
  }
  function holidayName(iso) {
    if (!parseISO(iso)) return null;
    return holidaysForYear(+iso.slice(0, 4))[iso] || null;
  }
  function slug(s) {
    var out = String(s || 'progetto').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return out || 'progetto';
  }

  /* --------------------------- encoding --------------------------- */
  function toLatin1(str) {
    var out = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
    return out;
  }
  function sanitize(str) {
    var map = { '\u20AC': '\x80', '\u2013': '\x96', '\u2014': '\x97', '\u2018': '\x91', '\u2019': '\x92', '\u201C': '\x93', '\u201D': '\x94', '\u2026': '\x85' };
    return String(str).normalize('NFC')
      .replace(/\u2192/g, ' -> ')
      .replace(/[\u2018\u2019\u201C\u201D\u2013\u2014\u20AC\u2026]/g, function (c) { return map[c]; })
      .replace(/\r?\n/g, ' ').replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/[^\x00-\xFF]/g, '?');
  }
  function esc(str) {
    return sanitize(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
  function num(n) {
    return (Math.round(n * 1000) / 1000).toString();
  }
  function rgb(c) {
    return num(c[0]) + ' ' + num(c[1]) + ' ' + num(c[2]);
  }
  function hexRgb(hex) {
    var n = parseInt(String(hex).replace('#', ''), 16);
    if (!Number.isFinite(n)) return [0.4, 0.4, 0.4];
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  function estWidth(str, size, bold) {
    return sanitize(str).length * size * (bold ? 0.545 : 0.515);
  }
  function fit(str, maxW, size, bold) {
    var s = String(str);
    if (estWidth(s, size, bold) <= maxW) return s;
    while (s.length > 2 && estWidth(s + '...', size, bold) > maxW) s = s.slice(0, -1);
    return s.replace(/\s+$/, '') + '...';
  }

  /* --------------------------- writer --------------------------- */
  function Writer() {
    this.parts = [];
    this.length = 0;
  }
  Writer.prototype.raw = function (str) {
    var b = toLatin1(str);
    this.parts.push(b);
    this.length += b.length;
  };
  Writer.prototype.toBytes = function () {
    var out = new Uint8Array(this.length);
    var off = 0;
    for (var i = 0; i < this.parts.length; i++) {
      out.set(this.parts[i], off);
      off += this.parts[i].length;
    }
    return out;
  };

  /* --------------------------- contenuto pagina --------------------------- */
  function opsText(ops, x, y, str, size, opts) {
    opts = opts || {};
    var font = opts.bold ? 'F2' : 'F1';
    var color = opts.color || INK;
    var text = sanitize(str);
    var px = x;
    if (opts.align === 'right') px = x - estWidth(text, size, opts.bold);
    else if (opts.align === 'center') px = x - estWidth(text, size, opts.bold) / 2;
    ops.push('BT /' + font + ' ' + num(size) + ' Tf ' + rgb(color) + ' rg ' +
      num(px) + ' ' + num(y) + ' Td (' + esc(text) + ') Tj ET');
  }
  function opsRect(ops, x, y, w, h, color, stroke) {
    ops.push('q ' + rgb(color) + ' rg ' + num(x) + ' ' + num(y) + ' ' + num(w) + ' ' + num(h) + ' re f Q');
    if (stroke) {
      ops.push('q ' + rgb(stroke) + ' RG 0.5 w ' + num(x + 0.25) + ' ' + num(y + 0.25) + ' ' + num(w - 0.5) + ' ' + num(h - 0.5) + ' re S Q');
    }
  }
  function opsLine(ops, x1, y1, x2, y2, width, color, dash) {
    var s = 'q ' + rgb(color) + ' RG ' + num(width) + ' w ';
    if (dash) s += '[' + dash + '] 0 d ';
    s += num(x1) + ' ' + num(y1) + ' m ' + num(x2) + ' ' + num(y2) + ' l S Q';
    ops.push(s);
  }

  function prepare(project) {
    var list = (project && Array.isArray(project.tasks) ? project.tasks : [])
      .filter(function (t) { return t && parseISO(t.start) && parseISO(t.end); })
      .map(function (t, i) {
        return {
          index: i,
          id: t.id,
          name: t.name || 'Attività',
          start: t.start,
          end: t.end,
          duration: Math.max(1, parseInt(t.duration, 10) || diffDays(t.start, t.end) + 1),
          color: /^#[0-9a-fA-F]{6}$/.test(t.color || '') ? t.color : '#6366f1',
          predecessorId: t.predecessorId || null,
          link: LINK_LABEL[t.link] ? t.link : 'FS'
        };
      });
    var min = null, max = null;
    list.forEach(function (t) {
      if (!min || t.start < min) min = t.start;
      if (!max || t.end > max) max = t.end;
    });
    if (!min) min = max = todayISO();
    var start = startOfMonth(min);
    var end = endOfMonth(max);
    var days = diffDays(start, end) + 1;
    var pages = [];
    if (!list.length) pages.push([]);
    for (var i = 0; i < list.length; i += ROWS_PER_PAGE) pages.push(list.slice(i, i + ROWS_PER_PAGE));
    return {
      project: project || {},
      tasks: list,
      start: start,
      end: end,
      days: days,
      colW: TL_W / days,
      pages: pages
    };
  }

  function renderPage(data, pageIndex, pageCount) {
    var ops = [];
    var rows = data.pages[pageIndex] || [];
    var project = data.project || {};
    var list = data.tasks;
    var colW = data.colW;
    var tlX = COL.timeline;
    var monthNames = MONTHS_SHORT;

    /* sfondo zebrato */
    rows.forEach(function (t, i) {
      if (i % 2 === 1) opsRect(ops, M, ROWS_TOP - (i + 1) * ROW_H, PAGE_W - M * 2, ROW_H, [0.965, 0.972, 0.988]);
    });

    /* intestazione */
    opsText(ops, M, 556, fit(project.name || 'Progetto senza titolo', PAGE_W - M * 2 - 150, 18, true), 18, { bold: true });
    var meta = list.length + (list.length === 1 ? ' attività' : ' attività') +
      '  ·  ' + fmtLong(data.start) + ' → ' + fmtLong(data.end) +
      '  ·  ' + data.days + ' giorni' +
      (list.length ? '  ·  generato il ' + fmtNum(todayISO()) : '');
    opsText(ops, M, 538, fit(meta, PAGE_W - M * 2, 8, false), 8, { color: MUTED });
    opsLine(ops, M, 527, PAGE_W - M, 527, 1, [0.88, 0.9, 0.94]);

    /* intestazione tabella */
    opsText(ops, COL.no, 512, '#', 6.5, { bold: true, color: MUTED });
    opsText(ops, COL.name, 512, 'ATTIVITÀ', 6.5, { bold: true, color: MUTED });
    opsText(ops, COL.durRight, 512, 'GG', 6.5, { bold: true, color: MUTED, align: 'right' });
    opsText(ops, COL.start, 512, 'INIZIO', 6.5, { bold: true, color: MUTED });
    opsText(ops, COL.end, 512, 'FINE', 6.5, { bold: true, color: MUTED });
    opsText(ops, COL.after, 512, 'VINCOLO', 6.5, { bold: true, color: MUTED, align: 'right' });

    /* mesi */
    var cursor = data.start;
    var monthSegments = [];
    while (cursor <= data.end) {
      var mStart = startOfMonth(cursor);
      var mEnd = endOfMonth(cursor);
      var a = cursor > mStart ? cursor : mStart;
      var b = mEnd < data.end ? mEnd : data.end;
      var count = diffDays(a, b) + 1;
      var d = parseISO(a);
      monthSegments.push({ iso: a, x: diffDays(data.start, a) * colW, w: count * colW, m: d.getUTCMonth(), y: d.getUTCFullYear() });
      cursor = addDays(b, 1);
    }
    monthSegments.forEach(function (seg) {
      if (seg.w >= 26) {
        opsText(ops, tlX + seg.x + 3, 512, monthNames[seg.m] + ' ' + String(seg.y).slice(2), 6.5, { bold: true, color: [0.28, 0.33, 0.42] });
      }
    });
    opsLine(ops, M, 506, PAGE_W - M, 506, 1, [0.78, 0.82, 0.89]);
    opsLine(ops, tlX - 10, 506, tlX - 10, ROWS_BOTTOM, 0.8, [0.88, 0.9, 0.94]);

    /* weekend e festivi */
    for (var i = 0; i < data.days; i++) {
      var iso = addDays(data.start, i);
      var wd = parseISO(iso).getUTCDay();
      var hol = holidayName(iso);
      if (!hol && wd !== 0 && wd !== 6) continue;
      var w = Math.max(0.9, colW);
      opsRect(ops, tlX + i * colW, ROWS_BOTTOM, w, ROWS_TOP - ROWS_BOTTOM, hol ? HOLIDAY_FILL : WEEKEND_FILL);
    }

    /* linee mesi */
    monthSegments.forEach(function (seg, i) {
      if (i === 0) return;
      opsLine(ops, tlX + seg.x, ROWS_BOTTOM, tlX + seg.x, ROWS_TOP, 0.6, [0.9, 0.92, 0.95]);
    });

    /* oggi */
    var ti = diffDays(data.start, todayISO());
    if (ti >= 0 && ti < data.days) {
      opsLine(ops, tlX + (ti + 0.5) * colW, ROWS_BOTTOM, tlX + (ti + 0.5) * colW, ROWS_TOP, 1, TODAY, '2 2');
    }

    /* collegamenti */
    var pos = {};
    list.forEach(function (t, i) { pos[t.id] = i; });
    var pageStart = pageIndex * ROWS_PER_PAGE;
    rows.forEach(function (t, i) {
      if (!t.predecessorId) return;
      var pi = pos[t.predecessorId];
      if (pi === undefined) return;
      if (pi < pageStart || pi >= pageStart + rows.length) return;
      var pred = list[pi];
      var pStartX = tlX + diffDays(data.start, pred.start) * colW;
      var pEndX = tlX + diffDays(data.start, pred.end) * colW + colW;
      var tStartX = tlX + diffDays(data.start, t.start) * colW;
      var tEndX = tlX + diffDays(data.start, t.end) * colW + colW;
      var x1 = t.link === 'SS' ? pStartX : pEndX;
      var x2 = t.link === 'FF' ? tEndX : tStartX;
      var y1 = ROWS_TOP - (pi - pageStart + 0.5) * ROW_H;
      var y2 = ROWS_TOP - (i + 0.5) * ROW_H;
      var dash = t.link === 'SS' ? '[2 1.5] 0 d ' : (t.link === 'FF' ? '[1 1.5] 0 d ' : '');
      var mid, path;
      if (x2 - x1 >= 4) {
        mid = x1 + Math.min(8, (x2 - x1) / 2);
        path = num(x1) + ' ' + num(y1) + ' m ' + num(mid) + ' ' + num(y1) + ' l ' +
          num(mid) + ' ' + num(y2) + ' l ' + num(x2 - 2) + ' ' + num(y2) + ' l';
      } else {
        mid = Math.max(tlX + 1, Math.min(x1, x2) - 6);
        path = num(x1) + ' ' + num(y1) + ' m ' + num(mid) + ' ' + num(y1) + ' l ' +
          num(mid) + ' ' + num(y2) + ' l ' + num(x2 - 2) + ' ' + num(y2) + ' l';
      }
      ops.push('q 0.45 0.5 0.6 RG 0.7 w ' + dash + path + ' S Q');
      ops.push('q 0.45 0.5 0.6 rg ' + num(x2) + ' ' + num(y2) + ' m ' + num(x2 - 4) + ' ' + num(y2 + 1.8) + ' l ' +
        num(x2 - 4) + ' ' + num(y2 - 1.8) + ' l f Q');
    });

    /* righe */
    rows.forEach(function (t, i) {
      var top = ROWS_TOP - (i + 1) * ROW_H;
      var cy = top + ROW_H / 2;
      var idx = pageStart + i + 1;
      opsText(ops, COL.no, cy - 2.2, String(idx), 6.5, { color: [0.6, 0.66, 0.75] });
      opsText(ops, COL.name, cy - 2.4, fit(t.name, COL.nameW, 7.5, false), 7.5, { bold: false });
      opsText(ops, COL.durRight, cy - 2.4, String(t.duration), 7.5, { align: 'right' });
      opsText(ops, COL.start, cy - 2.4, fmtNumShort(t.start), 7);
      opsText(ops, COL.end, cy - 2.4, fmtNumShort(t.end), 7);
      var pi = t.predecessorId ? pos[t.predecessorId] : undefined;
      if (pi !== undefined) opsText(ops, COL.after, cy - 2.4, (LINK_LABEL[t.link] || 'dopo') + ' #' + (pi + 1), 7, { color: MUTED, align: 'right' });

      var x = tlX + diffDays(data.start, t.start) * colW;
      var bw = Math.max(1.4, (diffDays(t.start, t.end) + 1) * colW);
      var c = hexRgb(t.color);
      opsRect(ops, x, cy - 4.5, bw, 9, c, [Math.max(0, c[0] - .18), Math.max(0, c[1] - .18), Math.max(0, c[2] - .18)]);
    });

    /* piè di pagina */
    opsLine(ops, M, 36, PAGE_W - M, 36, 0.7, [0.9, 0.92, 0.95]);
    opsText(ops, M, 23, fit('GanttFlow · ' + (project.name || 'Progetto'), 320, 7, false), 7, { color: MUTED });
    opsRect(ops, 372, 20, 7, 7, WEEKEND_FILL, [0.9, 0.78, 0.7]);
    opsText(ops, 383, 23, 'weekend', 6.5, { color: MUTED });
    opsRect(ops, 428, 20, 7, 7, HOLIDAY_FILL, [0.9, 0.72, 0.72]);
    opsText(ops, 439, 23, 'festivo', 6.5, { color: MUTED });
    opsText(ops, PAGE_W - M, 23, 'Pagina ' + (pageIndex + 1) + ' di ' + pageCount, 7, { color: MUTED, align: 'right' });
    if (!list.length) {
      opsText(ops, PAGE_W / 2, 300, 'Nessuna attività nel progetto', 12, { color: MUTED, align: 'center' });
    }
    return ops.join('\n') + '\n';
  }

  /* --------------------------- build / download --------------------------- */
  function build(project) {
    var data = prepare(project);
    var pageCount = data.pages.length;
    var total = 5 + pageCount * 2;
    var w = new Writer();
    var offsets = new Array(total + 1).fill(0);
    var title = (project && project.name) || 'Progetto';

    function obj(n, body) {
      offsets[n] = w.length;
      w.raw(n + ' 0 obj\n' + body + '\nendobj\n');
    }

    w.raw('%PDF-1.4\n');
    w.raw('%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    var kids = [];
    for (var i = 0; i < pageCount; i++) kids.push((6 + i * 2) + ' 0 R');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pageCount + ' >>');
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var now = new Date();
    var pdfDate = 'D:' + now.getUTCFullYear() + pad2(now.getUTCMonth() + 1) + pad2(now.getUTCDate()) +
      pad2(now.getUTCHours()) + pad2(now.getUTCMinutes()) + pad2(now.getUTCSeconds()) + 'Z';
    obj(5, '<< /Title (' + esc(title) + ') /Author (GanttFlow) /Creator (GanttFlow) /Producer (GanttFlow) /CreationDate (' + pdfDate + ') >>');

    for (i = 0; i < pageCount; i++) {
      var content = renderPage(data, i, pageCount);
      var pageNo = 6 + i * 2;
      var contentNo = 7 + i * 2;
      obj(pageNo, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(PAGE_W) + ' ' + num(PAGE_H) +
        '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /ProcSet [/PDF /Text] >> /Contents ' + contentNo + ' 0 R >>');
      obj(contentNo, '<< /Length ' + toLatin1(content).length + ' >>\nstream\n' + content + 'endstream');
    }

    var xrefPos = w.length;
    var xref = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
    for (i = 1; i <= total; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    w.raw(xref);
    w.raw('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n');
    return w.toBytes();
  }

  function download(project) {
    var bytes = build(project);
    var filename = slug(project && project.name) + '-gantt-' + todayISO() + '.pdf';
    var blob = new Blob([bytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
    return filename;
  }

  return { build: build, download: download };
})();
