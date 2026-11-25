# GanttCT by MG

Pianificatore di attività con diagramma di Gantt, dipendenze automatiche,
esportazione PDF e file di progetto reimportabile. Nel Gantt ogni attività può avere
**più periodi di date sulla stessa riga** e, sotto le attività, c'è la
**pianificazione delle persone**. Include anche un grafico di **stima del tempo ciclo**
in secondi, organizzato in più pagine.

Con **Nuovo** si sceglie il tipo di lavoro da creare:

- **Diagramma di Gantt** — attività su calendario in giorni (descritto qui sotto);
- **Stima tempo ciclo** — attività in secondi su più pagine (vedi
  [Stima tempo ciclo](#stima-tempo-ciclo)).

App statica, **senza dipendenze e senza build**: si apre `index.html` nel browser
e funziona anche completamente offline.

## Funzionalità

- **Tabella attività** con nome, durata in giorni considerati, data di inizio e data di fine.
- **Calcolo bidirezionale**: durata + inizio → fine; inizio + fine → durata.
- **Giorni considerati** per ogni attività: tre spunte **Sab**, **Dom**, **Fest** (normalmente non spuntate) includono sabati, domeniche e festivi nel conteggio della durata. Se non spuntate, quei giorni vengono saltati.
- **Colonne ridimensionabili**: trascina il bordo destro di un'intestazione per allargare o restringere la colonna; doppio clic (o **Ripristina colonne**) per tornare alle larghezze predefinite. La larghezza viene ricordata nel browser.
- **Periodi nascosti**: nasconde un intervallo di date dal diagramma (e dal PDF) senza modificare le date o le durate delle attività.
- **Giorni rossi personalizzati**: aggiunge manualmente date in rosso (chiusure, festività locali) che valgono come festivi per la spunta **Fest**.
- **Diagramma di Gantt** a calendario con mesi e giorni; **settimane ISO (CW)** sopra i mesi, **sabati e domeniche in arancione**, **festivi italiani in rosso** (Natale, Pasqua, Ferragosto, ecc.) e linea di "oggi".
- **Colori preimpostati** per ogni attività, scelti da una palette e usati nella barra e nel PDF.
- **Tre tipi di vincolo** tra attività, con offset in giorni e aggiornamento automatico a catena:
  - **Inizia dopo**: parte il giorno dopo la fine dell'attività collegata;
  - **Inizia con**: mantiene sempre la stessa distanza tra le date di inizio delle due attività;
  - **Finisce prima**: termina prima della fine dell'attività collegata.
- **Prevenzione dei cicli**: le combinazioni non valide non sono selezionabili.
- **Zoom** a 4 livelli, pulsante "Oggi", indicatore del mese visibile.
- **Esportazione PDF** A4 orizzontale, multipagina, con tabella, tipo di vincolo e barre colorate.
- **Esportazione/Importazione progetto JSON** per riprendere il lavoro in un secondo momento.
- **Salvataggio automatico** nel browser (`localStorage`).
- Aggiunta, duplicazione, eliminazione con annullamento, progetto di esempio.
- Interfaccia responsive e interamente in italiano.

## Come si usa

Apri `index.html` con doppio clic. In alternativa, servi la cartella con un qualsiasi
server statico, ad esempio:

```powershell
# con Python installato
python -m http.server 8000
```

poi visita `http://localhost:8000/`.

### Compilare le attività

| Se inserisci… | Ottieni… |
|---|---|
| durata + inizio | la data di **fine** viene calcolata |
| inizio + fine | la **durata** viene calcolata |
| solo durata | la fine viene ricalcolata dall'inizio esistente |

La fine è inclusiva. La durata conta solo i giorni considerati dall'attività: con
tutte le spunte vuote, 5 giorni a partire da lunedì 16 novembre terminano venerdì
20 novembre.

### Giorni considerati (Sab / Dom / Fest)

A destra del colore ogni attività ha tre spunte sovrapposte, **normalmente non
spuntate**:

| Spunta | Se è attiva | Se è vuota |
|---|---|---|
| **Sab** | i sabati contano nella durata | i sabati vengono saltati |
| **Dom** | le domeniche contano nella durata | le domeniche vengono saltate |
| **Fest** | i festivi italiani contano nella durata | i festivi vengono saltati |

Esempio: con tutte le spunte vuote, un'attività che inizia **lunedì** e dura **7
giorni** finisce il **martedì della settimana successiva** (5 giorni feriali + lunedì
e martedì). Se la data di inizio cade in un giorno escluso, viene spostata avanti al
primo giorno considerato; se la data di fine cade in un giorno escluso, viene
arretrata all'ultimo giorno considerato.

Le spunte sono per singola attività: duplicando un'attività vengono copiate, mentre
le nuove attività partono con tutte le spunte vuote. Le date calcolate dai vincoli
tengono conto del calendario dell'attività collegata.

### Collegare le attività

Nella colonna **Vincolo** scegli prima l'attività a cui collegarti, poi il tipo di
vincolo. Il numero accanto è l'**offset in giorni** (0–365) e cambia significato in
base al tipo scelto:

| Tipo | Significato | Offset |
|---|---|---|
| **Inizia dopo** | parte il giorno dopo la fine dell'attività collegata | giorni di attesa dopo la fine |
| **Inizia con** | mantiene sempre la stessa distanza tra le date di inizio delle due attività | giorni tra i due inizi |
| **Finisce prima** | termina prima della fine dell'attività collegata | giorni prima della fine |

Le date calcolate vengono bloccate (lucchetto accanto al campo): per **Inizia dopo** e
**Inizia con** si blocca la data di inizio, per **Finisce prima** entrambe le date
(la fine è calcolata e l'inizio ne deriva). Per sbloccarle scegli `—` nel selettore.
I successori si aggiornano automaticamente a catena e le combinazioni che creerebbero
un ciclo vengono rifiutate.

### Colori

Ogni attività ha un colore scelto da una palette di 14 tonalità preimpostate: fai clic
sul quadratino colorato nella colonna **Colore** e seleziona la tinta desiderata.
Il colore viene usato nella barra del Gantt e nel PDF.

### Weekend e festivi

Nel calendario i **sabati e le domeniche** sono evidenziati in **arancione**, mentre i
**festivi italiani** (Natale, Pasqua e Lunedì dell'Angelo, Ferragosto, Immacolata,
Ognissanti, Capodanno, Epifania, Liberazione, Festa dei Lavoratori, Festa della
Repubblica, Santo Stefano) sono in **rosso**, con il nome nel tooltip. La colorazione
indica il tipo di giorno; è la spunta **Sab**, **Dom** o **Fest** dell'attività a
decidere se quel giorno conta nella durata. La legenda è riportata anche a piè di
pagina nel PDF.

### Settimane

Sopra i mesi ogni settimana è etichettata con il numero ISO 8601: **CW44**, **CW45**,
ecc. Il tooltip mostra l'anno e quanti giorni della settimana sono visibili. Quando un
periodo è nascosto, anche le settimane si compattano e le etichette seguono i giorni
effettivamente mostrati.

### Personalizzare il calendario

Sotto il diagramma ci sono due strumenti.

**Periodo nascosto** — indica inizio e fine e premi **Nascondi**: l'intervallo
scompare dal diagramma (e dal PDF) e le date successive vengono compattate, così un
periodo di chiusura non occupa spazio. Le date e le durate delle attività non
cambiano. I periodi nascosti sono elencati come pillole: premi **×** per mostrarli di
nuovo.

**Giorni rossi** — indica una data, un nome facoltativo e premi **Aggiungi**: il
giorno diventa rosso nel calendario e nel PDF e conta come festivo per la spunta
**Fest** dell'attività (con la spunta vuota viene saltato nella durata, come i festivi
italiani). Anche questi giorni sono elencati come pillole rimovibili con **×**.

Entrambe le impostazioni vengono salvate con il progetto e incluse nel JSON
esportato.

### Larghezza delle colonne

Nell'intestazione della tabella, trascina il bordo destro di una colonna per
allargarla o restringerla. Il cursore diventa una doppia freccia quando sei sul
bordo. Fai **doppio clic** sul bordo, oppure usa **Ripristina colonne** in basso a
destra, per tornare alle larghezze predefinite. La scelta viene ricordata nel browser
e non modifica il file del progetto.

### Creare vincoli trascinando sul grafico

Passando sopra una riga, all'inizio e alla fine della barra compaiono due pallini.
Trascina da un pallino fino all'inizio o alla fine di un'altra attività (basta
rilasciare vicino all'estremo della barra): una linea guida e un'etichetta mostrano il
vincolo che verrà creato.

| Da → a | Vincolo creato |
|---|---|
| inizio di A → fine di B | A **inizia dopo** la fine di B |
| fine di A → inizio di B | B **inizia dopo** la fine di A |
| inizio di A → inizio di B | A **inizia con** B |
| fine di A → fine di B | A **finisce prima** della fine di B (nel tempo ciclo: finisce insieme) |

L'offset viene messo a 0. Ogni attività ha un solo collegamento: se ne aveva già uno
viene sostituito (il messaggio lo indica e offre **Annulla**). I collegamenti che
creerebbero un ciclo sono segnalati in rosso e non vengono creati. Funziona sia nel
Gantt sia nel tempo ciclo.

### Spostare un'attività nel tempo

Passando sopra una barra compare al centro una maniglia **⇆** e il cursore diventa
una mano. Trascina la barra (o la maniglia) a destra o a sinistra: un'etichetta mostra
le nuove date (o i secondi, nel tempo ciclo).

- **Senza vincolo** cambia la data/il secondo di inizio; la durata resta invariata.
- **Con un vincolo** cambia l'**offset** del vincolo, così il collegamento resta
  valido. L'attività non può andare oltre il limite del vincolo (per esempio prima
  della fine dell'attività a cui è collegata con «Inizia dopo»): l'etichetta diventa
  rossa e la barra si ferma lì.
- Le attività che dipendono da quella spostata si aggiornano a catena.

Al rilascio un messaggio riepiloga lo spostamento e offre **Annulla**. Nel Gantt i
periodi nascosti vengono saltati; nel tempo ciclo lo spostamento procede a passi
adatti allo zoom (da 0,1 s in su).

### Selezionare ed eliminare dal grafico

Un clic su una barra seleziona l'attività (evidenziata anche nella tabella). Premi
**Canc** per eliminarla: un messaggio offre **Annulla**. Se la barra cliccata è un
periodo aggiuntivo, Canc rimuove solo quel periodo. Mentre stai scrivendo in un
campo, Canc agisce solo sul testo. **Esc** toglie la selezione.

### Più periodi per la stessa attività

Un'attività può svolgersi in più intervalli, per esempio dal 1 al 10 gennaio e poi
dal 16 al 17 gennaio. Premi il pulsante **+** accanto al nome: sotto la riga compare una
riga rientrata **↳ Periodo 2** con le sue date di inizio e fine, la sua durata e il suo
vincolo. Si possono aggiungere fino a 20 periodi per riga.

- Nel grafico **tutti i periodi stanno sulla stessa riga** dell'attività, con lo stesso
  colore; i periodi aggiuntivi hanno una leggera trama a righe e il numero del periodo.
  Se due periodi si sovrappongono nel tempo, la riga si divide in sotto-linee per
  mostrarli entrambi.
- Ogni periodo si comporta **come un'attività separata** per i vincoli: nel menu
  «Vincolo» compare come «Nome attività · periodo 2», si collega trascinando dai suoi
  pallini sul grafico, si sposta trascinando la sua barra e altre attività possono
  dipendere da lui.
- Le spunte Sab/Dom/Fest e il colore sono quelli della riga principale.
- Il cestino sulla riga del periodo (o Canc dopo averne cliccato la barra) lo rimuove,
  con **Annulla**; `Alt` + `↑`/`↓` sulla riga del periodo ne cambia l'ordine.

### Pianificazione delle persone

Sotto le attività c'è la sezione **Persone**: con **+ Persona** si aggiunge una persona,
con le stesse colonne delle attività (date, durata, vincolo, colore, Sab/Dom/Fest).
Nel grafico le persone compaiono sotto le attività, separate da una fascia viola.

- Anche le persone possono avere **più periodi** con il pulsante **+**, tutti sulla
  stessa riga del grafico.
- I vincoli delle persone collegano persone e loro periodi tra loro; attività e
  persone restano due pianificazioni distinte.
- Spostamento, selezione, Canc, duplicazione, riordino e PDF funzionano come per le
  attività.

### Riordinare le attività

Passando con il mouse sul bordo sinistro di una riga compare una **maniglia** (⋮⋮):
tienila premuta e trascina l'attività sopra o sotto le altre; una linea blu indica dove
verrà inserita. In alternativa, con il cursore in un campo della riga, `Alt` + `↑`/`↓`
la sposta di una posizione. L'ordine cambia solo la visualizzazione: date, durate e
collegamenti restano invariati. Funziona sia nel Gantt sia nel tempo ciclo.

### Stima tempo ciclo

Scegliendo **Nuovo → Stima tempo ciclo** si crea un grafico con la stessa grafica del
Gantt, ma con la scala in **secondi** (decimi ammessi, es. `2,5`):

- ogni attività ha **nome**, **durata (s)**, **secondo di inizio** e **secondo di fine**
  (fine = inizio + durata; modificando la fine si ricalcola la durata);
- valgono gli stessi vincoli del Gantt, con offset in secondi (0–3600):
  **Inizia dopo** (`inizio = fine collegata + offset`), **Inizia con**
  (`inizio = inizio collegata + offset`), **Finisce prima**
  (`fine = fine collegata − offset`);
- il **tempo ciclo** della pagina è il secondo in cui termina l'ultima attività: è
  indicato da una linea rossa tratteggiata con l'etichetta `TC`;
- il righello mostra secondi principali e intermedi e si adatta ai 4 livelli di zoom;
- le attività di ogni pagina sono **numerate progressivamente** (1, 2, 3…); il numero
  compare anche nei menu dei vincoli e si aggiorna quando riordini le righe.

**Calcolo tempo ciclo tra due attività.** Nella fascia in basso scegli «dalla fine di»
un'attività e «alla fine di» un'altra: il risultato è la differenza tra i loro secondi
di fine (es. fine n. 1 = 8 s → fine n. 4 = 39 s → **31 s**). Nel grafico compare una
quota blu tra le due fini. La scelta è salvata per ogni pagina e riportata nel PDF.

**Dividere lo spazio.** La barretta grigia sopra la fascia del calcolo si trascina in
alto o in basso per dividere lo schermo tra grafico e calcolo (il grafico resta alto
almeno 140 px). Doppio clic sulla barretta per tornare all'altezza minima; da tastiera
`↑`/`↓` (con `Maiusc` a passi più grandi), `Home`/`Fine`. La divisione è una preferenza
locale del browser e non entra nel file del progetto.

**Pagine.** In basso, come in un foglio di calcolo, ci sono le linguette delle pagine:

- **+** aggiunge una pagina; clic per aprirla; **doppio clic** (o `F2`) per rinominarla;
- sulla pagina attiva: **‹ ›** spostano la linguetta, **⧉** duplica la pagina,
  **×** la elimina (con annullamento);
- ogni linguetta mostra il tempo ciclo della pagina.

**Importare una pagina.** Dal menu **Importa pagina come attività…** si inserisce
un'altra pagina nella pagina attiva come **una sola attività** con il nome della pagina
e durata pari al suo tempo ciclo. L'attività è **collegata**: se modifichi o rinomini la
pagina sorgente, nome e durata si aggiornano da soli (sono bloccati in modifica). Si può
comunque collegarla ad altre attività con i vincoli. Non è possibile importare una
pagina che contiene già (anche indirettamente) quella attiva. Se la pagina sorgente
viene eliminata, l'attività diventa normale con l'ultima durata calcolata.

Il PDF della stima tempo ciclo contiene **tutte le pagine**, ognuna con tabella,
righello dei secondi e linea del tempo ciclo.

### Scorciatoie

| Tasto | Azione |
|---|---|
| `Ctrl`/`⌘` + `S` | Esporta il progetto in JSON |
| `Ctrl`/`⌘` + `O` | Importa un progetto |
| `Ctrl`/`⌘` + rotella | Zoom del diagramma |
| `Invio` | Conferma il campo in modifica |
| `Esc` | Annulla la modifica / chiude la finestra / toglie la selezione |
| `Canc` | Elimina l'attività, la persona o il singolo periodo selezionato sul grafico (con Annulla) |

## Formato del progetto

Il file esportato è JSON e può essere reimportato con il pulsante **Importa**:

```json
{
  "format": "ganttflow-project",
  "version": 5,
  "exportedAt": "2026-11-11T09:30:00.000Z",
  "project": {
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
        "countHol": false,
        "slots": [
          {
            "id": "s4k2m9x1abc",
            "start": "2027-01-16",
            "end": "2027-01-17",
            "duration": 2,
            "predecessorId": null,
            "link": "FS",
            "lag": 0
          }
        ]
      }
    ],
    "people": [
      {
        "id": "t9e1p3rsn01",
        "name": "Giulia Rossi",
        "start": "2026-11-16",
        "end": "2026-11-27",
        "duration": 10,
        "color": "#a855f7",
        "predecessorId": null,
        "link": "FS",
        "lag": 0,
        "countSat": false,
        "countSun": false,
        "countHol": false,
        "slots": []
      }
    ]
  }
}
```

- `slots` contiene i periodi aggiuntivi della riga (il primo periodo resta nei campi
  principali). Ogni periodo ha un proprio `id` e un proprio vincolo.
- `people` ha la stessa struttura di `tasks`. I `predecessorId` puntano a righe o
  periodi dello stesso elenco. I file senza `slots` o `people` (versioni precedenti)
  si importano normalmente.

- Le date usano il formato `YYYY-MM-DD` e sono giorni di calendario inclusivi.
- `predecessorId` è `null` o l'id di un'altra attività dello stesso progetto.
- `link` è il tipo di vincolo: `FS` (inizia dopo la fine), `SS` (stessa distanza tra
  gli inizi), `FF` (finisce prima della fine). Se manca, viene assunto `FS`.
- `lag` è l'offset in giorni rispetto al riferimento del vincolo (0–365).
- `countSat`, `countSun`, `countHol`: se `true`, sabati, domeniche e festivi contano
  nella durata; se assenti o `false`, vengono saltati. Nei file precedenti alla
  versione 2 le spunte sono assenti e quindi i giorni vengono saltati.
- `hiddenRanges` elenca i periodi nascosti dal diagramma: ogni voce ha `start` e `end`
  inclusivi. Influisce solo sulla visualizzazione (schermo e PDF): le date e le durate
  delle attività restano invariate. In importazione gli intervalli invertiti vengono
  scambiati, quelli sovrapposti o adiacenti uniti e l'elenco è limitato a 50 voci.
- `customHolidays` elenca i giorni rossi personalizzati: `date` e `name` (nome
  facoltativo, sostituito da "Festivo personalizzato" se vuoto). Si comportano come i
  festivi italiani: rossi nel calendario e nel PDF, saltati nella durata quando la
  spunta **Fest** è vuota. In importazione le date non valide e i duplicati vengono
  scartati, l'elenco è ordinato e limitato a 200 voci.
- I file delle versioni precedenti (senza questi campi) si importano normalmente: i due
  elenchi vengono creati vuoti.
- In importazione i dati vengono validati: id non validi rigenerati, riferimenti
  inesistenti rimossi, durate e lag limitati ai valori ammessi, `link` sconosciuti
  riportati a `FS`.
- Dalla versione 4 il progetto ha il campo `type`: `"gantt"` (predefinito se assente)
  oppure `"cycle"`.

Una **stima tempo ciclo** ha invece le pagine al posto dell'elenco `tasks`:

```json
{
  "format": "ganttflow-project",
  "version": 4,
  "project": {
    "type": "cycle",
    "name": "Cella di lavorazione",
    "activeSheet": "s2",
    "sheets": [
      { "id": "s1", "name": "Stazione 1", "tasks": [
        { "id": "a1", "name": "Prelievo pezzo", "start": 0, "end": 3.5, "duration": 3.5,
          "color": "#6366f1", "predecessorId": null, "link": "FS", "lag": 0, "sourceSheetId": null }
      ] },
      { "id": "s2", "name": "Ciclo completo", "tasks": [
        { "id": "b1", "name": "Stazione 1", "start": 0, "end": 3.5, "duration": 3.5,
          "color": "#6366f1", "predecessorId": null, "link": "FS", "lag": 0, "sourceSheetId": "s1" }
      ] }
    ]
  }
}
```

- `start`, `end`, `duration` e `lag` sono secondi con al massimo un decimale.
- `calcFrom` e `calcTo` (facoltativi, per pagina) sono gli id delle due attività usate
  dal calcolo del tempo ciclo tra due fini; riferimenti non validi vengono azzerati.
- `sourceSheetId` è `null` oppure l'id della pagina importata: in quel caso nome e
  durata vengono ricalcolati dalla pagina sorgente. Riferimenti mancanti o ciclici
  vengono rimossi in importazione.

## Note sul PDF

Il PDF è generato interamente in JavaScript (`js/pdf.js`), senza librerie esterne.
È un PDF vettoriale con testo selezionabile **interamente in inglese** (intestazioni,
legenda, date e messaggi): contiene l'intestazione del progetto, la tabella delle
attività (numero, nome, giorni, inizio, fine, colonna **Link** con tipo e numero
dell'attività collegata) e le barre sul calendario. Sopra il calendario un righello
mostra per ogni giorno il **numero** e il **giorno abbreviato** (Mon, Tue, Wed, ...),
ruotato quando le colonne sono strette, così anche ingrandendo si capisce dove
iniziano e finiscono le attività. I fine settimana sono evidenziati in arancione e i
festivi (italiani e personalizzati) in rosso, con legenda a piè di pagina. I periodi
nascosti vengono compattati anche nel PDF e indicati nella legenda; l'intestazione
riporta quanti giorni sono stati nascosti. La paginazione è automatica quando le
attività superano lo spazio disponibile (circa 29 righe per pagina, formato A4
orizzontale).

## Struttura del progetto

```
index.html          interfaccia dell'applicazione
css/styles.css      stile e layout responsive
js/app.js           logica: modello, date, dipendenze, rendering, storage, import/export
js/pdf.js           generatore PDF autonomo
assets/icon.png     icona dell’app (favicon), generata da Icona.png
assets/icon.ico     icona dei collegamenti di Windows
Icona.png           immagine sorgente dell’icona
PROJECT_CONTEXT.md  contesto, requisiti e decisioni del progetto
```

## Installazione su un altro PC

La cartella `GanttCT-Installazione/` contiene tutto il necessario: copiala sul
nuovo PC e fai doppio clic su **Installa GanttCT.bat** (installa per l'utente
corrente in `%LOCALAPPDATA%\GanttCT`, crea i collegamenti **GanttCT by MG** su
Desktop e menu Start con l'icona dell'app, senza permessi di amministratore).
Istruzioni complete in `GanttCT-Installazione/LEGGIMI.txt`.

L'icona nasce da `Icona.png`: per cambiarla sostituisci quell'immagine (meglio se
quadrata) e rigenera il pacchetto. Dopo aver modificato l'app, aggiorna il pacchetto
(icone comprese) con:

```powershell
powershell -ExecutionPolicy Bypass -File .\crea-pacchetto.ps1
```

I progetti salvati nel browser non si spostano con la cartella: esportali in JSON
e reimportali sul nuovo PC.

## Compatibilità

Funziona con le versioni recenti di Chrome, Edge, Firefox e Safari, su
Windows 10/11 (Home e Pro), macOS e Linux.
Richiede JavaScript abilitato; il salvataggio automatico usa `localStorage`.

## Licenza

Distribuito con licenza MIT. Vedi [LICENSE](LICENSE).
