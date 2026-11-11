# Project Context — GanttFlow

File di contesto per tracciare scopo, requisiti e decisioni del progetto.
Va aggiornato quando cambiano obiettivi, modello dati o architettura.

## 1. Scopo

GanttFlow è un'applicazione web per pianificare attività e visualizzarle su un
diagramma di Gantt. È pensata per funzionare **offline**, senza installazione,
senza build e senza dipendenze esterne: si apre `index.html` nel browser.

Obiettivo principale: permettere di inserire attività con durata e date in modo
rapido, vedere subito la pianificazione su un calendario e mantenere coerenti le
attività concatenate, esportando il tutto in PDF o in un file di progetto
reimportabile.

## 2. Requisiti funzionali

### 2.1 Tabella attività (colonna sinistra)
- Campi per ogni attività: **nome**, **durata in giorni considerati**, **data di inizio**,
  **data di fine**, **colore** e tre spunte **Sab / Dom / Fest**.
- Calcolo bidirezionale:
  - durata + inizio compilati → la **fine** viene calcolata contando solo i giorni
    considerati;
  - inizio + fine compilati → la **durata** viene calcolata contando solo i giorni
    considerati nell'intervallo.
- Le date sono giorni di calendario inclusivi, ma la durata può escludere sabati,
  domeniche e festivi italiani in base alle tre spunte (per attività).
- Le tre spunte sono **normalmente non spuntate**: sabati, domeniche e festivi non
  contano nella durata. Se una data di inizio cade in un giorno escluso viene spostata
  al primo giorno considerato; una data di fine viene arretrata all'ultimo giorno
  considerato.
- Ogni attività ha un **colore** scelto da una palette di tonalità preimpostate (14 colori),
  usato nella barra del Gantt e nel PDF. Non è previsto il selettore colore nativo.

### 2.2 Diagramma di Gantt (centro)
- Asse temporale a calendario con mesi, giorni, numero del giorno e iniziale del
  giorno della settimana.
- Barra colorata per ogni attività, estesa all'intervallo di calendario tra inizio e
  fine (quindi può attraversare giorni esclusi).
- **Sabati e domeniche in arancione**, **festivi italiani in rosso** con nome nel
  tooltip del giorno; il giorno corrente ha un indicatore dedicato. La colorazione
  indica il tipo di giorno, non se è conteggiato dall'attività.
- Zoom a 4 livelli (Dettaglio, Standard, Compatto, Panoramica), navigazione "Oggi"
  e indicatore del mese visibile durante lo scorrimento.

### 2.3 Dipendenze tra attività
- Ogni attività può avere una **attività collegata** e un **tipo di vincolo**:
  - `FS` — **Inizia dopo**: inizia il giorno dopo la fine dell'attività collegata
    (`inizio = fine_predecessore + 1 + offset`);
  - `SS` — **Inizia con**: mantiene sempre la stessa distanza tra le date di inizio
    delle due attività (`inizio = inizio_predecessore + offset`);
  - `FF` — **Finisce prima**: termina prima della fine dell'attività collegata
    (`fine = fine_predecessore − 1 − offset`, poi `inizio = fine − durata + 1`).
- L'**offset** è un intero 0–365 giorni e il suo significato dipende dal tipo.
- Le date derivate vengono allineate al calendario dell'attività: se il giorno
  calcolato è escluso, si passa al successivo (`FS`, `SS`) o al precedente (`FF`)
  giorno considerato.
- Quando cambia una data o la durata di un predecessore, tutti i successori vengono
  ricalcolati a catena in ordine topologico.
- Le date derivate sono **bloccate** (lucchetto accanto al campo): l'inizio per `FS`
  e `SS`, entrambe le date per `FF` (la fine è calcolata e l'inizio ne consegue). Per
  sbloccarle si sceglie "—" nel selettore.
- I **cicli** sono impediti: le opzioni che creerebbero un ciclo non sono mostrate
  e un controllo runtime rifiuta comunque il collegamento.
- I collegamenti sono disegnati come connettori tra le barre: linea continua per `FS`,
  tratteggio lungo per `SS`, tratteggio corto per `FF`.

### 2.4 Esportazione
- **PDF** A4 orizzontale, generato senza librerie: tabella attività (numero, nome,
  giorni, inizio, fine, colonna **Vincolo** con tipo e numero dell'attività collegata)
  e barre sul calendario con weekend arancioni e festivi rossi, legenda a piè di
  pagina, paginazione automatica, intestazione e numero di pagina; nome file derivato
  dal nome del progetto.
- **Progetto JSON** reimportabile (`format: "ganttflow-project"`, versione 2),
  contenente metadati e tutte le attività con dipendenze (tipo e offset), colori e
  spunte dei giorni considerati.

### 2.5 Gestione progetto
- Nome progetto modificabile.
- Salvataggio automatico in `localStorage` (`ganttflow.project.v1`).
- Nuovo progetto (con conferma), import da file, esempio precaricato al primo avvio.
- Aggiunta, duplicazione ed eliminazione attività (con annullamento).
- Statistiche: numero attività, estensione calendario, giorni stimati totali,
  intervallo date, collegamenti attivi.
- Interfaccia interamente in **italiano**.

## 3. Modello dati

Progetto (in memoria e nel file esportato):

```json
{
  "name": "Lancio nuovo sito web",
  "createdAt": "2026-11-10T08:00:00.000Z",
  "updatedAt": "2026-11-10T08:00:00.000Z",
  "tasks": [
    {
      "id": "t9e17ounkti",
      "name": "Brief e ricerca",
      "start": "2026-11-16",
      "end": "2026-11-20",
      "duration": 5,
      "color": "#6366f1",
      "predecessorId": null,
      "link": "FS",
      "lag": 0,
      "countSat": false,
      "countSun": false,
      "countHol": false
    }
  ]
}
```

File esportato/importato:

```json
{
  "format": "ganttflow-project",
  "version": 2,
  "exportedAt": "2026-11-10T08:04:57.146Z",
  "project": { "...": "come sopra" }
}
```

Regole:
- Date in formato `YYYY-MM-DD`, sempre giorni UTC per evitare problemi di fuso.
- `end` è inclusivo.
- `predecessorId` è `null` oppure l'`id` di un'altra attività.
- `link` è uno tra `FS`, `SS`, `FF`; se assente o sconosciuto viene normalizzato a `FS`.
- `lag` è un intero 0–365: giorni di attesa dopo la fine (`FS`), distanza tra gli
  inizi (`SS`) o giorni prima della fine (`FF`).
- `countSat`, `countSun`, `countHol` (booleani, default `false`) indicano se sabati,
  domeniche e festivi contano nella durata. Se assenti (file precedenti alla v2)
  vengono trattati come `false`, quindi saltati.
- In import ogni campo viene validato e normalizzato; id non validi vengono
  rigenerati, riferimenti mancanti azzerati, durata e lag limitati.

## 4. Architettura

Applicazione statica, nessun build step, nessuna dipendenza:

```
index.html          struttura dell'interfaccia
css/styles.css      stile, layout responsive, tema
js/app.js           stato, modello, calcoli, rendering, eventi, storage, import/export
js/pdf.js           generatore PDF autonomo (window.GanttPDF)
assets/favicon.svg  logo e favicon
```

- `app.js` è un IIFE in strict mode; lo stato vive in `state.project` e viene
  ricalcolato con `recalc()` prima di ogni render.
- `pdf.js` scrive direttamente i byte del PDF (oggetti, xref, stream di contenuto)
  e usa i font standard Helvetica/Helvetica-Bold con `WinAnsiEncoding`.
- Persistenza: `localStorage`; nessun backend, nessuna chiamata di rete.

## 5. Decisioni tecniche

| Decisione | Motivo |
|---|---|
| Vanilla JS senza framework né build | Deve funzionare offline aprendo il file; nell'ambiente non sono disponibili Node/npm. |
| Giorni di calendario inclusivi | Coerente con la percezione utente di "durata in giorni" e semplice da spiegare. |
| Calendario per attività (spunte Sab/Dom/Fest) | Ogni attività può avere un calendario diverso (es. lavoro nei weekend, uffici chiusi nei festivi) senza imporre una regola globale. |
| Default spunte vuote | Comportamento prevedibile: la durata conta i giorni lavorativi feriali; l'utente attiva solo le eccezioni che gli servono. |
| Dipendenze FS + SS + FF con offset | Coprono sequenza, avvio parallelo a distanza fissa e chiusura anticipata rispetto al predecessore. |
| Ricalcolo topologico con visita delle dipendenze | Aggiorna tutti i successori in un solo passaggio e ignora/azzera i cicli residui. |
| Date derivate bloccate (inizio per FS/SS, fine per FF) | Rende esplicito che la data è calcolata dal vincolo; evita stati incoerenti. |
| Palette colori preimpostata | Scelta più rapida e coerente rispetto al selettore colore nativo. |
| Festivi italiani calcolati (Pasqua inclusa) | Nessun dato esterno: algoritmo gregoriano + festivi nazionali fissi, condiviso tra UI e PDF. |
| PDF scritto a mano | Nessuna libreria disponibile offline; output vettoriale e testo selezionabile. |
| Formato progetto versionato | Consente evoluzioni future mantenendo la compatibilità. |
| Autosalvataggio locale | L'utente non deve perdere il lavoro chiudendo il browser. |

## 6. Stato attuale (v1.2)

Implementato e verificato:
- calcolo bidirezionale durata/inizio/fine sui **giorni considerati**;
- calendario per attività con tre spunte **Sab / Dom / Fest** (default vuote) e
  allineamento automatico di inizio/fine ai giorni considerati;
- dipendenze a catena con tre tipi di vincolo (FS, SS, FF), offset 0–365 e
  prevenzione dei cicli;
- rendering del Gantt con zoom, weekend arancioni, festivi italiani rossi, oggi,
  connettori differenziati per tipo e palette colori preimpostata;
- export PDF multipagina con colonna Vincolo e legenda weekend/festivi; export/import JSON v2;
- salvataggio automatico, nuovo progetto, esempio, duplicazione (con copia delle spunte),
  eliminazione con undo;
- layout responsive (breakpoint 1280/1100/980 px) e stato vuoto.

## 7. Roadmap possibile

- Percentuale di completamento e baseline di piano.
- Trascinamento delle barre per spostare/ridimensionare le attività.
- Più progetti e cartelle, con esportazione di backup completo.
- Import/export CSV e MS Project XML.
- Test automatici (unit test sul motore date e sulle dipendenze).
