# Project Context — GanttCT by MG

File di contesto per tracciare scopo, requisiti e decisioni del progetto.
Va aggiornato quando cambiano obiettivi, modello dati o architettura.

## 1. Scopo

GanttCT by MG è un'applicazione web per pianificare attività e visualizzarle su un
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
- Fascia delle **settimane ISO 8601** (`CW44`, `CW45`, ...) sopra i mesi; le
  etichette seguono solo i giorni visibili e si compattano con i periodi nascosti.
- Barra colorata per ogni attività, estesa all'intervallo di calendario tra inizio e
  fine (quindi può attraversare giorni esclusi).
- **Sabati e domeniche in arancione**, **festivi italiani e giorni rossi personalizzati
  in rosso** con nome nel tooltip del giorno; il giorno corrente ha un indicatore
  dedicato. La colorazione indica il tipo di giorno, non se è conteggiato dall'attività.
- **Periodi nascosti**: un intervallo di date può essere escluso dalla timeline; le
  date successive vengono compattate e il periodo non occupa spazio. Le date e le
  durate delle attività non cambiano; l'intervallo è escluso anche dal PDF.
- Zoom a 4 livelli (Dettaglio, Standard, Compatto, Panoramica), navigazione "Oggi"
  e indicatore del mese visibile durante lo scorrimento.

### 2.2.1 Tabella e colonne
- Colonne della colonna sinistra **ridimensionabili**: si trascina il bordo destro di
  un'intestazione per allargare o restringere la colonna (limiti min/max per colonna).
- Doppio clic sul bordo o pulsante **Ripristina colonne** per tornare ai valori
  predefiniti.
- La larghezza è una preferenza di visualizzazione salvata nel browser
  (`ganttflow.layout.v1`), non fa parte del progetto esportato.

### 2.2.2 Calendario personalizzato (pannello sotto il Gantt)
- **Periodo nascosto**: campi inizio/fine e pulsante **Nascondi**; i periodi attivi
  sono mostrati come pillole rimovibili con **×**. Gli intervalli invertiti vengono
  scambiati, quelli sovrapposti o adiacenti uniti; massimo 50. È rifiutato un intervallo
  che nasconderebbe tutte le date del diagramma.
- **Giorni rossi**: campo data, nome facoltativo e pulsante **Aggiungi**; le voci sono
  mostrate come pillole rimovibili con **×**. Un giorno rosso personalizzato si comporta
  come un festivo italiano: rosso in app e PDF, saltato nella durata se la spunta
  **Fest** è vuota. Sono rifiutati duplicati e date già festive in Italia; massimo 200.

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
- **PDF** A4 orizzontale, generato senza librerie e **interamente in inglese**
  (intestazioni, legenda, date, messaggi e nomi dei collegamenti): tabella attività
  (numero, nome, giorni, inizio, fine, colonna **Link** con tipo e numero
  dell'attività collegata) e barre sul calendario con weekend arancioni, festivi
  (italiani e personalizzati) rossi, legenda a piè di pagina, paginazione automatica,
  intestazione e numero di pagina; nome file derivato dal nome del progetto.
- Sopra il calendario un **righello dei giorni** mostra per ogni giorno il numero e il
  giorno abbreviato inglese (`Mon`, `Tue`, `Wed`, ...). Con colonne strette le
  etichette sono ruotate di 90°; con intervalli molto lunghi si mostrano i lunedì e i
  primi del mese.
- Nel PDF i **periodi nascosti** vengono compattati come nella schermata, con
  indicazione del numero di giorni nascosti nell'intestazione e voce dedicata nella
  legenda.
- **Progetto JSON** reimportabile (`format: "ganttflow-project"`, versione 3),
  contenente metadati, tutte le attività con dipendenze (tipo e offset), colori e
  spunte dei giorni considerati, periodi nascosti e giorni rossi personalizzati.
  I file versione 2 (senza i nuovi elenchi) restano importabili.

### 2.5 Gestione progetto
- Nome progetto modificabile.
- Salvataggio automatico in `localStorage` (`ganttflow.project.v1`).
- Nuovo progetto (con conferma), import da file, esempio precaricato al primo avvio.
- Aggiunta, duplicazione ed eliminazione attività (con annullamento).
- Statistiche: numero attività, estensione calendario, giorni stimati totali,
  intervallo date, collegamenti attivi.
- Interfaccia dell'app interamente in **italiano**; il PDF esportato è interamente in
  **inglese** (scelta esplicita per la condivisione del documento).

### 2.5.2 Vincoli trascinando sul grafico
- Pallini di aggancio a inizio e fine di ogni barra (visibili al passaggio). Trascinando
  da un pallino all'inizio/fine di un'altra attività si crea il vincolo:
  inizio↔fine → `FS` (dipende chi ha l'inizio), inizio→inizio → `SS`, fine→fine → `FF`
  (per `SS`/`FF` dipende l'attività da cui si parte). Offset 0; il collegamento
  precedente dell'attività dipendente viene sostituito, con annullamento.
- Linea guida curva + etichetta descrittiva; cicli segnalati in rosso e rifiutati;
  scorrimento automatico vicino ai bordi.

### 2.5.3 Spostamento delle barre e selezione dal grafico
- Trascinando una barra (o la maniglia ⇆ che compare al passaggio) l'attività si sposta
  nel tempo. Senza predecessore cambia `start`; con predecessore cambia `lag` (limitato
  a 0…max, quindi la barra si ferma al limite del vincolo). `recalc()` aggiorna a catena
  i dipendenti. Gantt: posizione → giorno visibile (salta i periodi nascosti) e
  l'intervallo del calendario può solo allargarsi durante il trascinamento, con
  compensazione dello scorrimento; tempo ciclo: passo minimo 0,1 s adattato allo zoom.
- Rilascio con messaggio e **Annulla** (istantanea delle attività della pagina).
- Clic su una barra = selezione; **Canc** (Backspace su Mac) elimina la selezionata se il
  fuoco non è in un campo; **Esc** toglie la selezione.

### 2.5.4 Periodi multipli (slot) e pianificazione persone (solo Gantt)
- Ogni riga (attività o persona) è un gruppo: il primo periodo usa i campi della riga,
  gli altri stanno in `slots[]` (id, start, end, duration, predecessorId, link, lag;
  max 20). Colore e spunte Sab/Dom/Fest sono della riga.
- Ogni periodo è un **nodo** autonomo (`ganttNodes()`, `nodeById()`): `recalc()` ordina
  topologicamente i nodi, quindi un periodo può avere un proprio vincolo ed essere
  predecessore di altri. I vincoli restano all'interno dello stesso elenco
  (attività con attività, persone con persone).
- Tabella: pulsante **+** sul nome → riga rientrata «↳ Periodo N» con date, durata e
  vincolo propri. Grafico: tutte le barre del gruppo sulla riga principale
  (`assignTracks()`: periodi sovrapposti su sotto-linee); i periodi aggiuntivi hanno
  trama a righe. Pallini di vincolo, maniglia e selezione lavorano per periodo
  (`data-node`); Canc su un periodo aggiuntivo rimuove solo quello.
- `project.people[]` con la stessa struttura di `tasks[]`, mostrato sotto le attività
  nella sezione «Persone» (+ Persona). PDF: persone «(P)» dopo le attività, periodi sulla
  stessa riga, «[n periods]» nel nome.
- Titolo nella barra in alto: «GanttCT by Michele Grasselli» (font Bahnschrift,
  incluso in Windows 10/11, con alternative).

### 2.5.1 Riordino attività
- Maniglia (⋮⋮) visibile al passaggio sul bordo sinistro della riga: trascinando si
  sposta l'attività sopra/sotto le altre (linea guida blu, scorrimento automatico ai
  bordi). Da tastiera: `Alt` + `↑`/`↓` su un campo della riga. Vale per Gantt e tempo
  ciclo; cambia solo l'ordine, non date, durate o collegamenti.

### 2.6 Stima tempo ciclo (tipo di lavoro alternativo)
- **Nuovo** apre una scelta tra **Diagramma di Gantt** e **Stima tempo ciclo**; il lavoro
  corrente viene sostituito (avviso se contiene attività).
- Stessa grafica del Gantt, ma scala in **secondi** con risoluzione al **decimo**:
  colonne Attività, Durata (s), Inizio (s), Fine (s), Vincolo + offset (s), Colore.
- Tempo continuo: `fine = inizio + durata`. Vincoli: `FS` `inizio = fine_pred + offset`,
  `SS` `inizio = inizio_pred + offset`, `FF` `fine = fine_pred − offset`; inizio mai < 0.
- **Tempo ciclo della pagina** = massima fine tra le attività (misurato dal secondo 0);
  linea rossa tratteggiata + etichetta `TC` nel grafico e nel PDF.
- **Pagine** stile foglio di calcolo (linguette in basso): aggiungi, rinomina (doppio
  clic/F2), sposta, duplica, elimina con annullamento; massimo 50.
- **Import di una pagina** nella pagina attiva come **attività collegata**
  (`sourceSheetId`): nome = nome pagina, durata = tempo ciclo della pagina, entrambi
  aggiornati in automatico e bloccati. Import ciclici (diretti o indiretti) impediti;
  eliminando la pagina sorgente l'attività diventa normale con l'ultima durata.
- Pannello calendario, weekend/festivi e pulsante Oggi non si applicano (il pulsante
  diventa **Inizio**, torna al secondo 0).
- Attività **numerate progressivamente** per pagina (numero anche nei menu dei vincoli).
- **Calcolo tempo ciclo tra due fini** (fascia in basso): `|fine_B − fine_A|` tra due
  attività scelte; quota blu nel grafico; scelta salvata per pagina (`calcFrom`,
  `calcTo`) e riportata nel PDF.
- **Divisore trascinabile** tra grafico e fascia di calcolo (min. 140 px al grafico,
  doppio clic per ripristinare, frecce da tastiera); altezza salvata come preferenza
  locale in `ganttflow.split.cycle.v1`.
- Nota CSS: la classe di stato del risultato è `is-empty` per non collidere con `.empty`
  dello stato vuoto (che impone `min-height: 420px`).
- PDF in inglese con **tutte le pagine** in sequenza (`[sheet]` indica una pagina
  importata), file `<nome>-cycle-time-<data>.pdf`.

## 3. Modello dati

Progetto (in memoria e nel file esportato):

```json
{
  "name": "Lancio nuovo sito web",
  "createdAt": "2026-11-10T08:00:00.000Z",
  "updatedAt": "2026-11-11T09:30:00.000Z",
  "hiddenRanges": [
    { "start": "2026-12-24", "end": "2026-12-27" }
  ],
  "customHolidays": [
    { "date": "2026-12-07", "name": "Chiusura aziendale" }
  ],
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
  "version": 3,
  "exportedAt": "2026-11-11T09:30:00.000Z",
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
- `hiddenRanges` (default `[]`) contiene intervalli `{start, end}` inclusivi esclusi
  dalla visualizzazione. Non modifica il modello temporale delle attività; in
  importazione viene normalizzato (scambio, fusione di intervalli sovrapposti o
  adiacenti, massimo 50).
- `customHolidays` (default `[]`) contiene giorni rossi `{date, name}` che si comportano
  come festivi (rossi e saltati quando `countHol` è `false`). In importazione viene
  normalizzato (scarto di date non valide e duplicati, ordinamento, massimo 200).
- La larghezza delle colonne **non** è nel progetto: è una preferenza locale
  (`ganttflow.layout.v1` in `localStorage`).
- In import ogni campo viene validato e normalizzato; id non validi vengono
  rigenerati, riferimenti mancanti azzerati, durata e lag limitati.
- `type` (v4): `"gantt"` (default se assente) oppure `"cycle"`. Il file esportato ha
  `version: 4`; le versioni 2 e 3 restano importabili come Gantt.

Stima tempo ciclo (`type: "cycle"`): al posto di `tasks`/`hiddenRanges`/`customHolidays`
contiene `activeSheet` e `sheets: [{ id, name, tasks }]`. Ogni attività ha `start`,
`end`, `duration`, `lag` in secondi (un decimale, durata ≥ 0,1 s, offset 0–3600 s),
`color`, `predecessorId` (solo nella stessa pagina), `link` e `sourceSheetId`
(`null` o id della pagina importata). Le larghezze colonne del tempo ciclo sono salvate
a parte in `ganttflow.layout.cycle.v1`.

## 4. Architettura

Applicazione statica, nessun build step, nessuna dipendenza:

```
index.html          struttura dell'interfaccia
css/styles.css      stile, layout responsive, tema
js/app.js           stato, modello, calcoli, rendering, eventi, storage, import/export
js/pdf.js           generatore PDF autonomo (window.GanttPDF)
assets/icon.png     icona dell’app (favicon), generata da Icona.png
assets/icon.ico     icona dei collegamenti di Windows
Icona.png           immagine sorgente dell’icona
```

- `app.js` è un IIFE in strict mode; lo stato vive in `state.project` e viene
  ricalcolato con `recalc()` prima di ogni render.
- La timeline usa una **mappa dei giorni visibili** (`timeMap` con array di prefissi
  `prefix` e lista `visible`) costruita dai periodi nascosti: barre, connettori, oggi,
  intestazioni e scorrimento usano `visIndex()`/`xOf()` invece dell'indice di
  calendario. Il PDF applica lo stesso principio con `visIndex`, `xAt` e
  `visibleSpan`.
- I giorni rossi personalizzati alimentano un indice (`customHolidayIndex`) ricostruito
  da `rebuildHolidayIndex()` e usato da `holidayName()` insieme ai festivi italiani.
- Le colonne usano la variabile CSS `--colw` (griglia a 8 tracce) e `--left-w`;
  il trascinamento aggiorna le variabili e salva le larghezze in `localStorage`.
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
| Periodi nascosti solo visivi | L'utente vuole compattare chiusure e pause senza alterare le date reali del piano; il modello resta coerente e reversibile. |
| Periodi nascosti normalizzati e fusi | Evita intervalli sovrapposti o invertiti, mantiene la mappa `prefix` monotona e il PDF stabile. |
| Giorni rossi come festivi a tutti gli effetti | Riutilizza la regola esistente della spunta Fest: un solo comportamento da spiegare, coerente tra calcoli, UI e PDF. |
| PDF interamente in inglese | Il documento è pensato per la condivisione con clienti/partner internazionali; l'interfaccia dell'app resta in italiano. |
| Righello giorni del PDF con etichette ruotate sotto i 12 pt per giorno | Con 60–90 giorni in A4 orizzontale le etichette orizzontali si sovrapporrebbero; la rotazione mantiene numero e giorno leggibili ingrandendo il PDF. |
| Settimane ISO 8601 | Standard internazionale, coerente con `CW` e con settimane che iniziano il lunedì. |
| Larghezza colonne in `localStorage` | È una preferenza di vista personale, non un dato del progetto: non sporca il JSON né il lavoro condiviso. |
| Colonne con limiti min/max | Evita colonne inutilizzabili o layout rotti ed è coerente con il ridimensionamento da tastiera/doppio clic. |
| PDF scritto a mano | Nessuna libreria disponibile offline; output vettoriale e testo selezionabile. |
| Formato progetto versionato | Consente evoluzioni future mantenendo la compatibilità. |
| Tempo ciclo nello stesso app.js con `type` di progetto | Riusa griglia, vincoli, colori, colonne, toast e PDF: stessa grafica, una sola app da mantenere. |
| Secondi continui (fine esclusiva) e decimi | Nel tempo ciclo le attività si susseguono senza "giorno inclusivo"; i decimi coprono le stime tipiche di stazioni e macchine. |
| Pagina importata come attività collegata | Il tempo ciclo della pagina sorgente resta sempre coerente; il ricalcolo visita le pagine in ordine di dipendenza e rompe eventuali cicli. |
| Tempo ciclo misurato dal secondo 0 | Un ritardo iniziale fa parte del ciclo; coerente con il righello che parte da 0. |
| Autosalvataggio locale | L'utente non deve perdere il lavoro chiudendo il browser. |

## 6. Stato attuale (v2.0)

Novità v2.0: periodi multipli per attività sulla stessa riga del Gantt, ciascuno con
vincoli propri; sezione Persone sotto le attività (anch'esse con periodi multipli);
titolo «GanttCT by Michele Grasselli»; PDF aggiornato.

Novità v1.9: nome «GanttCT by MG» e icona dell'applicazione.

Novità v1.8: spostamento delle attività nel tempo trascinando le barre (con
aggiornamento di offset e dipendenti), selezione dal grafico ed eliminazione con Canc
(Gantt e tempo ciclo).

Novità v1.7: creazione dei vincoli trascinando tra inizio e fine delle barre (Gantt e
tempo ciclo).

Novità v1.6: riordino delle attività per trascinamento (Gantt e tempo ciclo), numerazione
progressiva e calcolo del tempo ciclo tra le fini di due attività.

Novità v1.5: scelta del tipo di lavoro con **Nuovo**; **stima tempo ciclo** in secondi
con pagine, import di pagine come attività collegate, export JSON v4 e PDF multipagina.

Implementato e verificato:
- calcolo bidirezionale durata/inizio/fine sui **giorni considerati**;
- calendario per attività con tre spunte **Sab / Dom / Fest** (default vuote) e
  allineamento automatico di inizio/fine ai giorni considerati;
- dipendenze a catena con tre tipi di vincolo (FS, SS, FF), offset 0–365 e
  prevenzione dei cicli;
- rendering del Gantt con zoom, **settimane ISO (CW)** sopra i mesi, weekend
  arancioni, festivi italiani rossi, oggi, connettori differenziati per tipo e palette
  colori preimpostata;
- **colonne ridimensionabili** con limiti, ripristino (doppio clic o pulsante) e
  persistenza locale della larghezza;
- **periodi nascosti** con compattazione della timeline e del PDF, pillole rimovibili
  e salvataggio nel progetto;
- **giorni rossi personalizzati** con nome, pillole rimovibili, effetto su durate
  (spunta Fest), colorazione in app/PDF e salvataggio nel progetto;
- **export PDF interamente in inglese**, multipagina, con righello giorni
  (numero + `Mon`/`Tue`/...), colonna Link, legenda weekend/holiday/hidden period e
  conteggio dei giorni nascosti;
- export/import JSON v3 (v2 ancora importabile);
- salvataggio automatico, nuovo progetto, esempio, duplicazione (con copia delle spunte),
  eliminazione con undo;
- layout responsive (breakpoint 1280/1100/980 px), pannello calendario senza overflow
  e stato vuoto.

## 7. Roadmap possibile

- Percentuale di completamento e baseline di piano.
- Trascinamento delle barre per spostare/ridimensionare le attività.
- Più progetti e cartelle, con esportazione di backup completo.
- Import/export CSV e MS Project XML.
- Test automatici (unit test sul motore date e sulle dipendenze).
