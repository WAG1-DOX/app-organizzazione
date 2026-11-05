# App organizzazione — istruzioni per Claude

Progetto di **Edoardo** (GitHub: WAG1-DOX) e **Luca**. Siamo principianti: spiega
le cose in modo semplice, in italiano, e fai un passo alla volta.

## Cos'è
App personale per organizzare la vita quotidiana: impegni, allenamenti, scuola.
Due account separati (uno per Edoardo, uno per Luca) sullo **stesso database**.
Ognuno vede le proprie cose; le cose in comune (es. la scuola) si condividono
tramite gruppi. In più una chat tra di noi.

## Decisioni prese
- **App**: PWA (sito installabile), un solo codice per telefono e computer.
- **Database, login, sync in tempo reale**: Supabase (piano gratuito).
  - Login con Supabase Auth (email/password o Google).
  - **Row Level Security** sempre attiva: ognuno legge/modifica solo i propri dati
    o quelli dei gruppi di cui fa parte.
  - Sync e chat con Supabase Realtime (NON passano dall'AI).
- **AI**: Claude tramite API (non l'abbonamento), chiamata da una funzione lato
  server (Supabase Edge Function). La chiave API non va mai nell'app.
  - `claude-haiku-5-5` per le richieste di tutti i giorni (testo → evento, ecc.).
  - `claude-sonnet-5-5` solo per la pianificazione settimanale complessa.
  - Risposte in JSON strutturato (structured outputs) + controllo dei dati nel codice.
  - Prompt caching per le istruzioni fisse; mandare solo gli eventi dei prossimi 7 giorni.
  - Effort `low` per le richieste semplici; Batch API per cose non urgenti.
- Modello AI locale: scartato per ora (qualità più bassa, più lavoro). Forse in futuro.

## Database (bozza)
| Tabella | Contenuto |
|---|---|
| `profili` | nome, foto, preferenze |
| `gruppi` | es. "Classe 4B", "Palestra" |
| `membri_gruppo` | chi è in quale gruppo |
| `eventi` | titolo, data, ora, tipo (scuola/allenamento/altro), proprietario, gruppo (vuoto = privato) |
| `messaggi` | mittente, destinatario, testo, ora |

## Regole di lavoro
- Le chiavi segrete stanno solo in `.env` (escluso da git). Mai nel codice o su GitHub.
- Prima di lavorare: Pull. Dopo: Commit + Push (con GitHub Desktop).
- Dividiamo il lavoro per parti (es. uno il calendario, l'altro la chat) per
  evitare conflitti.

## Stato
- [x] Repository creato
- [ ] Progetto Supabase
- [ ] Login e profili
- [ ] Calendario ed eventi condivisi
- [ ] Chat
- [ ] Integrazione Claude
