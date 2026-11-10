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
- Campi per ogni attività: **nome**, **durata stimata in giorni**, **data di inizio**,
  **data di fine**.
- Calcolo bidirezionale:
  - durata + inizio compilati → la **fine** viene calcolata (`fine = inizio + durata − 1`);
  - inizio + fine compilati → la **durata** viene calcolata (`durata = fine − inizio + 1`).
- Le date sono giorni di calendario inclusivi (nessuna esclusione di weekend o festivi).
- Ogni attività ha un **colore** selezionabile, usato nella barra del Gantt e nel PDF.

### 2.2 Diagramma di Gantt (centro)
- Asse temporale a calendario con mesi, giorni, numero del giorno e iniziale del
  giorno della settimana.
- Barra colorata per ogni attività, proporzionale alla durata.
- Evidenziazione di weekend, giorno corrente e separatori di mese.
- Zoom a 4 livelli (Dettaglio, Standard, Compatto, Panoramica), navigazione "Oggi"
  e indicatore del mese visibile durante lo scorrimento.

### 2.3 Dipendenze tra attività
- Ogni attività può avere una **attività precedente** (relazione finish-to-start):
  il successore inizia il giorno dopo la fine del predecessore.
- È previsto uno **sfasamento** opzionale (lag 0–365 giorni).
- Quando cambia la data di fine o la durata di un predecessore, tutti i successori
  vengono ricalcolati a catena in ordine topologico.
- La data di inizio di un'attività collegata è **bloccata** (calcolata); per
  sbloccarla si sceglie "—" nel selettore del predecessore.
- I **cicli** sono impediti: le opzioni che creerebbero un ciclo non sono mostrate
  e un controllo runtime rifiuta comunque il collegamento.
- I collegamenti sono disegnati come connettori tra le barre.

### 2.4 Esportazione
- **PDF** A4 orizzontale, generato senza librerie: tabella attività (numero, nome,
  giorni, inizio, fine, precedente) e barre sul calendario, con paginazione
  automatica, intestazione, piè di pagina con numero di pagina e file name
  derivato dal nome del progetto.
- **Progetto JSON** reimportabile (`format: "ganttflow-project"`), contenente
  metadati e tutte le attività con dipendenze e colori.

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
      "lag": 0
    }
  ]
}
```

File esportato/importato:

```json
{
  "format": "ganttflow-project",
  "version": 1,
  "exportedAt": "2026-11-10T08:04:57.146Z",
  "project": { "...": "come sopra" }
}
```

Regole:
- Date in formato `YYYY-MM-DD`, sempre giorni UTC per evitare problemi di fuso.
- `end` è inclusivo.
- `predecessorId` è `null` oppure l'`id` di un'altra attività.
- `lag` è un intero ≥ 0 (giorni di attesa dopo la fine del predecessore).
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
| Dipendenza finish-to-start + lag | Modello più diffuso e prevedibile; copre i casi richiesti. |
| Ricalcolo topologico con visita delle dipendenze | Aggiorna tutti i successori in un solo passaggio e ignora/azzera i cicli residui. |
| Inizio bloccato quando c'è un predecessore | Rende esplicito che la data è derivata; evita stati incoerenti. |
| PDF scritto a mano | Nessuna libreria disponibile offline; output vettoriale e testo selezionabile. |
| Formato progetto versionato | Consente evoluzioni future mantenendo la compatibilità. |
| Autosalvataggio locale | L'utente non deve perdere il lavoro chiudendo il browser. |

## 6. Stato attuale (v1.0)

Implementato e verificato:
- calcolo bidirezionale durata/inizio/fine;
- dipendenze a catena con lag e prevenzione dei cicli;
- rendering del Gantt con zoom, weekend, oggi, connettori, selettore colore;
- export PDF multipagina e export/import JSON;
- salvataggio automatico, nuovo progetto, esempio, duplicazione, eliminazione con undo;
- layout responsive (breakpoint 1280/1100/980 px) e stato vuoto.

## 7. Roadmap possibile

- Feriali/holidays esclusi dalla durata.
- Dipendenze start-to-start, finish-to-finish e percentuale di completamento.
- Trascinamento delle barre per spostare/ridimensionare le attività.
- Più progetti e cartelle, con esportazione di backup completo.
- Import/export CSV e MS Project XML.
- Test automatici (unit test sul motore date e sulle dipendenze).
