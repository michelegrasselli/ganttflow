/* File di progetto d'esempio, uno per ogni versione del formato prodotta dall'app.
   Servono a verificare che ogni versione nuova sappia ancora importarli
   (aprire test/compatibilita.html). Quando il formato cambia, AGGIUNGERE un esempio:
   non modificare né rimuovere quelli esistenti. */
window.COMPAT_FIXTURES = [
  {
    label: 'v1 · app 1.0 — solo attività, senza tipo di vincolo',
    expect: { type: 'gantt', tasks: 2, people: 0, links: 1, firstLink: 'FS' },
    file: {
      format: 'ganttflow-project',
      version: 1,
      exportedAt: '2026-11-10T09:00:00.000Z',
      project: {
        name: 'Progetto v1.0',
        createdAt: '2026-11-10T08:00:00.000Z',
        updatedAt: '2026-11-10T09:00:00.000Z',
        tasks: [
          { id: 'ta1', name: 'Analisi', start: '2026-11-16', end: '2026-11-20', duration: 5, color: '#6366f1', predecessorId: null, lag: 0 },
          { id: 'ta2', name: 'Sviluppo', start: '2026-11-23', end: '2026-11-27', duration: 5, color: '#0ea5e9', predecessorId: 'ta1', lag: 0 }
        ]
      }
    }
  },
  {
    label: 'v1 · app 1.1 — tre tipi di vincolo',
    expect: { type: 'gantt', tasks: 2, people: 0, links: 1, firstLink: 'SS' },
    file: {
      format: 'ganttflow-project',
      version: 1,
      project: {
        name: 'Progetto v1.1',
        tasks: [
          { id: 'tb1', name: 'Progetto', start: '2026-11-16', end: '2026-11-20', duration: 5, color: '#6366f1', predecessorId: null, link: 'FS', lag: 0 },
          { id: 'tb2', name: 'Revisione', start: '2026-11-17', end: '2026-11-19', duration: 3, color: '#ef4444', predecessorId: 'tb1', link: 'SS', lag: 1 }
        ]
      }
    }
  },
  {
    label: 'v2 · app 1.2 — giorni considerati Sab/Dom/Fest',
    expect: { type: 'gantt', tasks: 1, people: 0, links: 0, countSat: true },
    file: {
      format: 'ganttflow-project',
      version: 2,
      project: {
        name: 'Progetto v1.2',
        tasks: [
          { id: 'tc1', name: 'Turno weekend', start: '2026-11-14', end: '2026-11-15', duration: 2, color: '#f59e0b', predecessorId: null, link: 'FS', lag: 0, countSat: true, countSun: true, countHol: false }
        ]
      }
    }
  },
  {
    label: 'v3 · app 1.3 — periodi nascosti e giorni rossi',
    expect: { type: 'gantt', tasks: 1, people: 0, links: 0, hiddenRanges: 1, customHolidays: 1 },
    file: {
      format: 'ganttflow-project',
      version: 3,
      project: {
        name: 'Progetto v1.3',
        hiddenRanges: [{ start: '2026-12-24', end: '2026-12-27' }],
        customHolidays: [{ date: '2026-12-07', name: 'Chiusura aziendale' }],
        tasks: [
          { id: 'td1', name: 'Fase unica', start: '2026-12-01', end: '2026-12-11', duration: 9, color: '#14b8a6', predecessorId: null, link: 'FS', lag: 0, countSat: false, countSun: false, countHol: false }
        ]
      }
    }
  },
  {
    label: 'v4 · app 1.5–1.9 — Gantt',
    expect: { type: 'gantt', tasks: 2, people: 0, links: 1, firstLink: 'FF' },
    file: {
      format: 'ganttflow-project',
      version: 4,
      project: {
        name: 'Progetto v1.9',
        hiddenRanges: [],
        customHolidays: [],
        tasks: [
          { id: 'te1', name: 'Montaggio', start: '2026-11-16', end: '2026-11-27', duration: 10, color: '#6366f1', predecessorId: null, link: 'FS', lag: 0, countSat: false, countSun: false, countHol: false },
          { id: 'te2', name: 'Collaudo', start: '2026-11-25', end: '2026-11-26', duration: 2, color: '#22c55e', predecessorId: 'te1', link: 'FF', lag: 1, countSat: false, countSun: false, countHol: false }
        ]
      }
    }
  },
  {
    label: 'v4 · app 1.5–1.9 — tempo ciclo con pagine',
    expect: { type: 'cycle', sheets: 2, cycleTasks: 3 },
    file: {
      format: 'ganttflow-project',
      version: 4,
      project: {
        type: 'cycle',
        name: 'Cella v1.9',
        activeSheet: 'sh1',
        sheets: [
          { id: 'sh1', name: 'Stazione 1', calcFrom: null, calcTo: null, tasks: [
            { id: 'cf1', name: 'Carico', start: 0, end: 8, duration: 8, color: '#6366f1', predecessorId: null, link: 'FS', lag: 0, sourceSheetId: null },
            { id: 'cf2', name: 'Lavorazione', start: 8, end: 20, duration: 12, color: '#0ea5e9', predecessorId: 'cf1', link: 'FS', lag: 0, sourceSheetId: null }
          ] },
          { id: 'sh2', name: 'Ciclo completo', tasks: [
            { id: 'cf3', name: 'Stazione 1', start: 0, end: 20, duration: 20, color: '#a855f7', predecessorId: null, link: 'FS', lag: 0, sourceSheetId: 'sh1' }
          ] }
        ]
      }
    }
  },
  {
    label: 'v5 · app 2.0 — periodi multipli e persone',
    expect: { type: 'gantt', tasks: 2, people: 1, slots: 2, links: 2 },
    file: {
      format: 'ganttflow-project',
      version: 5,
      exportedAt: '2026-11-25T10:00:00.000Z',
      project: {
        name: 'Progetto v2.0',
        hiddenRanges: [],
        customHolidays: [],
        tasks: [
          { id: 'tf1', name: 'Installazione', start: '2027-01-01', end: '2027-01-10', duration: 6, color: '#6366f1', predecessorId: null, link: 'FS', lag: 0, countSat: false, countSun: false, countHol: false,
            slots: [{ id: 'sf1', start: '2027-01-18', end: '2027-01-19', duration: 2, predecessorId: null, link: 'FS', lag: 0 }] },
          { id: 'tf2', name: 'Verifica', start: '2027-01-20', end: '2027-01-20', duration: 1, color: '#22c55e', predecessorId: 'sf1', link: 'FS', lag: 0, countSat: false, countSun: false, countHol: false, slots: [] }
        ],
        people: [
          { id: 'pf1', name: 'Giulia Rossi', start: '2027-01-04', end: '2027-01-08', duration: 5, color: '#a855f7', predecessorId: null, link: 'FS', lag: 0, countSat: false, countSun: false, countHol: false,
            slots: [{ id: 'sp1', start: '2027-01-18', end: '2027-01-19', duration: 2, predecessorId: 'pf1', link: 'FS', lag: 5 }] }
        ]
      }
    }
  },
  {
    label: 'senza involucro — solo il progetto (salvataggi molto vecchi)',
    expect: { type: 'gantt', tasks: 1, people: 0, links: 0 },
    file: {
      name: 'Solo progetto',
      tasks: [{ id: 'tg1', name: 'Attività', start: '2026-11-16', end: '2026-11-18', duration: 3, color: '#6366f1', predecessorId: null }]
    }
  },
  {
    label: 'versione futura (v99) — import con avviso, campi sconosciuti ignorati',
    expect: { type: 'gantt', tasks: 1, people: 0, links: 0, newer: true },
    file: {
      format: 'ganttflow-project',
      version: 99,
      project: {
        name: 'Dal futuro',
        somethingNew: { a: 1 },
        tasks: [{ id: 'th1', name: 'Attività', start: '2026-11-16', end: '2026-11-18', duration: 3, color: '#6366f1', predecessorId: null, link: 'FS', lag: 0, futureField: true }]
      }
    }
  }
];
