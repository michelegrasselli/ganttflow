# GanttFlow

Pianificatore di attività con diagramma di Gantt, dipendenze automatiche,
esportazione PDF e file di progetto reimportabile.

App statica, **senza dipendenze e senza build**: si apre `index.html` nel browser
e funziona anche completamente offline.

## Funzionalità

- **Tabella attività** con nome, durata stimata in giorni, data di inizio e data di fine.
- **Calcolo bidirezionale**: durata + inizio → fine; inizio + fine → durata.
- **Diagramma di Gantt** a calendario con mesi e giorni; **sabati e domeniche in arancione**, **festivi italiani in rosso** (Natale, Pasqua, Ferragosto, ecc.) e linea di "oggi".
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

La fine è inclusiva: 5 giorni a partire dal 16 novembre terminano il 20 novembre.

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
Repubblica, Santo Stefano) sono in **rosso**, con il nome nel tooltip. La stessa
legenda è riportata a piè di pagina nel PDF.

### Scorciatoie

| Tasto | Azione |
|---|---|
| `Ctrl`/`⌘` + `S` | Esporta il progetto in JSON |
| `Ctrl`/`⌘` + `O` | Importa un progetto |
| `Ctrl`/`⌘` + rotella | Zoom del diagramma |
| `Invio` | Conferma il campo in modifica |
| `Esc` | Annulla la modifica / chiude la finestra |

## Formato del progetto

Il file esportato è JSON e può essere reimportato con il pulsante **Importa**:

```json
{
  "format": "ganttflow-project",
  "version": 1,
  "exportedAt": "2026-11-10T08:04:57.146Z",
  "project": {
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
        "lag": 0
      }
    ]
  }
}
```

- Le date usano il formato `YYYY-MM-DD` e sono giorni di calendario inclusivi.
- `predecessorId` è `null` o l'id di un'altra attività dello stesso progetto.
- `link` è il tipo di vincolo: `FS` (inizia dopo la fine), `SS` (stessa distanza tra
  gli inizi), `FF` (finisce prima della fine). Se manca, viene assunto `FS`.
- `lag` è l'offset in giorni rispetto al riferimento del vincolo (0–365).
- In importazione i dati vengono validati: id non validi rigenerati, riferimenti
  inesistenti rimossi, durate e lag limitati ai valori ammessi, `link` sconosciuti
  riportati a `FS`.

## Note sul PDF

Il PDF è generato interamente in JavaScript (`js/pdf.js`), senza librerie esterne.
È un PDF vettoriale con testo selezionabile: contiene l'intestazione del progetto,
la tabella delle attività (numero, nome, giorni, inizio, fine, colonna **Vincolo**
con tipo e numero dell'attività collegata) e le barre sul calendario, con paginazione
automatica quando le attività superano lo spazio disponibile (circa 30 righe per
pagina, formato A4 orizzontale). Nel calendario i fine settimana sono evidenziati in
arancione e i festivi italiani in rosso, con legenda a piè di pagina.

## Struttura del progetto

```
index.html          interfaccia dell'applicazione
css/styles.css      stile e layout responsive
js/app.js           logica: modello, date, dipendenze, rendering, storage, import/export
js/pdf.js           generatore PDF autonomo
assets/favicon.svg  logo e favicon
PROJECT_CONTEXT.md  contesto, requisiti e decisioni del progetto
```

## Compatibilità

Funziona con le versioni recenti di Chrome, Edge, Firefox e Safari.
Richiede JavaScript abilitato; il salvataggio automatico usa `localStorage`.

## Licenza

Distribuito con licenza MIT. Vedi [LICENSE](LICENSE).
