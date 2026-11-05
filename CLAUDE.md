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

## Database — nomi dei campi (CONTRATTO: non cambiarli senza avvisare l'altro)
Questi nomi li usano sia il database (Edoardo) sia l'app (Luca). Se uno li
cambia, deve aggiornare questo file e dirlo all'altro.

| Tabella | Campi |
|---|---|
| `profili` | `id` (uuid, = id dell'account), `nome`, `avatar_url`, `creato_il` |
| `gruppi` | `id`, `nome`, `creato_da`, `creato_il` |
| `membri_gruppo` | `gruppo_id`, `utente_id`, `ruolo` (`admin` / `membro`) |
| `eventi` | `id`, `titolo`, `descrizione`, `tipo` (`scuola` / `allenamento` / `impegno` / `altro`), `inizio`, `fine` (data+ora ISO), `tutto_il_giorno` (true/false), `proprietario_id`, `gruppo_id` (null = privato), `completato` (true/false), `creato_il` |
| `messaggi` | `id`, `mittente_id`, `destinatario_id`, `testo`, `evento_id` (opzionale), `letto` (true/false), `creato_il` |

Esempio di evento come arriverà all'app (usare questa forma anche nei dati finti):
```json
{
  "id": "e1",
  "titolo": "Verifica di matematica",
  "descrizione": "Capitoli 4 e 5",
  "tipo": "scuola",
  "inizio": "2026-11-12T08:00:00+01:00",
  "fine": "2026-11-12T09:00:00+01:00",
  "tutto_il_giorno": false,
  "proprietario_id": "u-edoardo",
  "gruppo_id": "g-classe",
  "completato": false,
  "creato_il": "2026-11-05T17:00:00+01:00"
}
```

## Divisione del lavoro (cartelle separate = niente conflitti)
- **Edoardo → database**: cartella `supabase/` (file SQL: tabelle, Row Level
  Security, funzioni). Account e progetto Supabase.
- **Luca → app e design**: cartella `app/` (HTML, CSS, JavaScript). Per ora
  usa **dati finti** in `app/dati-finti.js` con esattamente i campi qui sopra;
  quando il database è pronto si sostituiscono con le chiamate a Supabase.
- Tecnologia app: HTML + CSS + JavaScript semplice (niente framework per ora),
  poi la libreria `@supabase/supabase-js` per collegarsi al database.
- `CLAUDE.md` lo possono modificare entrambi, ma solo per aggiornare decisioni.

## Supabase
- Progetto Supabase: **Xecute**, organizzazione "Edoardo e luca", regione
  North EU (Stockholm), piano gratuito.
- Project URL: `https://jpesiyylptdfkdgdxrqt.supabase.co` (pubblico, può stare nell'app).
  La publishable/anon key si prende da Project Settings → API Keys (pubblica);
  la secret/service_role key **mai** nell'app né su GitHub.
- Team Supabase: Edoardo (Owner), Luca (Developer, invitato).
- Login: provider Email attivo, "Confirm email" attivo (arriva un link di conferma).
- Il database si aggiorna **a mano** incollando il codice SQL nel SQL Editor.
- L'integrazione GitHub di Supabase per ora **non è collegata**. Se un giorno
  si collega: **NON creare la cartella `supabase/migrations/`** senza
  decidere prima, perché Supabase eseguirebbe il codice da solo.

## Regole di lavoro
- Le chiavi segrete stanno solo in `.env` (escluso da git). Mai nel codice o su GitHub.
- Prima di lavorare: Pull. Dopo: Commit + Push (con GitHub Desktop).
- Dividiamo il lavoro per parti (es. uno il calendario, l'altro la chat) per
  evitare conflitti.

## Stato
- [x] Repository creato
- [x] Struttura cartelle (`app/`, `supabase/`) e divisione del lavoro
- [x] Progetto Supabase
- [x] Tabelle, sicurezza (RLS) e tempo reale: `supabase/schema.sql` eseguito su Supabase
- [ ] Login e profili
- [ ] Calendario ed eventi condivisi
- [ ] Chat
- [ ] Integrazione Claude
