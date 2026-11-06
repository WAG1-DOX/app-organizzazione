# App organizzazione — istruzioni per Claude

Progetto di **Edoardo** (GitHub: WAG1-DOX) e **Luca**. Siamo principianti: spiega
le cose in modo semplice, in italiano, e fai un passo alla volta.

## ⚠️ Claude: cose da ricordare a chi lavora (ogni sessione)
Lavoriamo in due sullo stesso progetto con GitHub Desktop. Claude deve:
1. **All'inizio di ogni sessione** chiedere: "Hai fatto Fetch origin e Pull
   origin in GitHub Desktop?". Se no, farlo fare prima di toccare qualsiasi file.
2. **Dopo un Pull**, rileggere `CLAUDE.md` e i file su cui si lavora: l'altro
   potrebbe averli cambiati. Non fidarsi di quello che ricordi della conversazione.
3. **Chiedere su cosa si lavora** e ricordare di avvisare l'altro su WhatsApp.
   Edoardo → cartella `supabase/`; Luca → cartella `app/`. Se serve toccare
   un file dell'altro o questo `CLAUDE.md`, dire di avvisarlo prima.
4. **Quando una cosa funziona**, ricordare di salvare e mandare, in quest'ordine:
   Commit to main → Fetch origin → (se compare) Pull origin → Push origin.
   Meglio tanti invii piccoli che uno enorme.
5. **Se c'è un conflitto**: niente panico, non si perde niente. Spiegare con
   parole semplici quali sono le due versioni e far scegliere; non cancellare.
6. **Mai** mettere nel codice password o chiavi segrete (secret/service_role key):
   solo nel file `.env`, che non va su GitHub.
7. **Mai** cambiare i nomi dei campi del database senza avvisare l'altro.
8. **Mai** creare la cartella `supabase/migrations/`.
9. **Mai** dire di cliccare *Undo* o di cancellare cose in GitHub Desktop
   senza spiegare cosa succede.

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
| `eventi` (aggiunti con `02_aggiornamento_luca.sql`) | tipo anche `produttivita`; campi nuovi `luogo` (testo, default ''), `colore` (es. `#f4511e`, vuoto = automatico), `google_id`, `google_calendario` |
| `dati_personali` | `utente_id`, `chiave` (es. `movimenti`, `lista_spesa`, `sonno`…, elenco in `app/tabelle-nuove.md`), `valore` (JSON), `aggiornato_il`. Una riga per chiave per utente; ognuno vede solo le sue |
| `messaggi` | `id`, `mittente_id`, `destinatario_id`, `testo`, `evento_id` (opzionale), `letto` (true/false), `creato_il` |

Esempio di evento come arriverà all'app (usare questa forma per tutti gli eventi):
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
- **Luca → app e design**: cartella `app/` (HTML, CSS, JavaScript).
  Niente dati finti: l'app parte vuota e al primo accesso c'è la configurazione guidata
  (`app/js/configurazione.js`), che propone le idee di `app/suggerimenti.js`.
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

## Assistente AI ("cervello") — FUNZIONA
- Edge Function Supabase **`assistente`** (codice: `supabase/functions/assistente/index.ts`,
  di Edoardo). Pubblicata dal pannello di Supabase (Edge Functions → assistente → Code →
  Deploy updates), non con la cartella migrations.
- Modello: `claude-haiku-5-5`, effort `low`. Per cambiarlo: costante `MODELLO` in cima al file.
  Le regole dell'assistente sono nella costante `ISTRUZIONI` (da riscrivere quando avremo
  deciso bene cosa deve fare).
- Legge da sola gli eventi dell'utente dei prossimi 7 giorni (+ gruppi) dalla tabella `eventi`.
- Chiave di Claude: segreto `ANTHROPIC_API_KEY` in Supabase (chiave "Non collegata/legacy").
  **Mai** nel codice, mai in chat, mai negli screenshot.
- **Come la chiama l'app (Luca)**, dopo il login:
  ```js
  const { data, error } = await sb.functions.invoke("assistente", {
    body: { domanda: "Organizzami la settimana" },
  });
  // data.risposta = testo della risposta (italiano, può avere elenchi con "-")
  // se error: mostrare un messaggio tipo "L'assistente non risponde, riprova"
  ```
  Mentre aspetta (1-5 secondi) mostrare un caricamento. Domanda max 2000 caratteri.

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
- [x] Aggiornamento 2 (tipo produttivita, campi eventi, tabella `dati_personali`): `supabase/02_aggiornamento_luca.sql` eseguito
- [x] Sicurezza: `supabase/03_sicurezza.sql` eseguito (Security Advisor: 0 errori; resta solo
      "leaked password protection", disponibile solo col piano Pro). Le funzioni dei lucchetti
      ora sono `privato.sono_membro(uuid)` e `privato.sono_admin(uuid)`: nel nuovo SQL usare questi nomi.
- [x] URL di login: Site URL `http://localhost:5500`, redirect `http://localhost:*/**`
- [ ] Login e profili (pagina di login fatta da Luca; account di Edoardo creato e confermato; manca Luca)
- [x] App che salva i dati su Supabase (fatto da Edoardo il 6 nov, file `app/js/sincronizza.js`, provato)
- [x] Gruppi con codice di invito: `supabase/04_gruppi.sql` (colonna `gruppi.codice` + funzione
      `entra_nel_gruppo(codice_invito)`) — eseguito il 6 nov, provato
- [x] Gruppi veri nel calendario: il menu "Visibile a" usa `gruppiDisponibili()` (chat.js)
- [x] Chat: pagina "Chat e gruppi" (`app/js/sezioni/chat.js`): persone = chi è in un gruppo con te,
      messaggi in tempo reale (Supabase Realtime), pallino dei non letti nel menu, creare/entrare/uscire
      dai gruppi. Provata da Edoardo il 6 nov (con un solo account: manca la prova a due)
- [x] Integrazione Claude lato server: funzione `assistente` provata, risponde in ~4 secondi
- [x] Pulsante "Chiedi all'assistente…" collegato alla funzione (`apriAssistente` in `app/js/app.js`)
- [x] Sul telefono l'assistente è un bottone rotondo con la scintilla; toccando l'avatar si esce
- [ ] Foto degli scontrini: restano solo nel browser (IndexedDB), non ancora su Supabase Storage
- [ ] Banche: eseguire `supabase/06_banca.sql`, mettere il segreto `BANCA_SEGRETO`, pubblicare la funzione `banca` (Edoardo)

## Sito online
- Indirizzo: **https://xecute-app.vercel.app** (Vercel, piano gratuito, collegato al repository; pubblica la cartella `app/`).
- Il repository GitHub è **pubblico** (6 nov): col piano gratuito Vercel bloccava i commit di Luca
  perché il progetto Vercel è di Edoardo. Con il repository pubblico ogni Push di tutti e due va online da solo.
- Quindi nel codice: **mai** segreti (solo la chiave pubblica di Supabase). Controllato il 6 nov: la storia è pulita.
- Indirizzo aggiunto anche su Google Cloud (origini del Client ID) e su Supabase (URL Configuration).

## Banche collegate (Enable Banking) — `app/js/banca.js` + funzione `banca`
- Enable Banking gratis in modalità **restricted**: ognuno ha la SUA applicazione (Production) e può
  leggere SOLO i conti che ha collegato lui. Solo uso personale: per altri utenti servirebbe un contratto.
- Luca: applicazione "X-ECUTE Luca" attiva, Revolut (paese LT) + Fideuram (IT) collegati dal Control Panel.
  Edoardo: da fare (Fineco IT + Revolut LT). Redirect URL dell'applicazione: `https://xecute-app.vercel.app/`.
- Il file `.pem` (chiave privata) NON va mai nel progetto, in chat o su GitHub: si carica una volta
  dall'app (Spese → Configura Enable Banking) e la funzione lo salva **cifrato** (segreto `BANCA_SEGRETO`).
- Supabase: `supabase/06_banca.sql` (tabelle `banca_chiavi`, `banca_collegamenti`, `banca_attese`) e la
  Edge Function `supabase/functions/banca/index.ts` (azioni: stato, salva_chiave, elimina_chiave, banche,
  collega, completa, movimenti, scollega). Scritti dal Claude di Luca: li esegue/pubblica Edoardo.
- Nell'app: i movimenti arrivano in `stato.movimenti` con `fonte: "banca"` (id `eb-…`) o `"csv"` (id `csv-…`),
  categoria indovinata, senza doppioni; `giroconto: true` = soldi tra due propri conti (non conta nei totali).
  `stato.banca = { attiva, ignorati }` (chiave cloud `banca`): `ignorati` = movimenti importati e poi eliminati.
- Piano B: Spese → "Importa estratto conto (CSV)" (Revolut, Fineco, Fideuram… colonne riconosciute da sole).
- Versione 2 (6 nov): la funzione manda anche i movimenti **in attesa** (`in_attesa`, id `ebp-…`, diventano
  definitivi da soli), i **saldi** di ogni conto (`stato.banca.saldi`), errori spiegati (permesso scaduto → «Rinnova»);
  alla prima lettura `strategy=longest`; «Rinnova» sostituisce il collegamento vecchio della stessa banca.
  Nell'app: nomi ripuliti (es. "PAGAMENTO POS … PRESSO CONAD" → "Conad"), categoria da MCC + parole + regole
  imparate (`stato.banca.regole`), giroconti anche "a coppie" (ricarica Revolut da Fideuram), conti rinominabili
  o nascosti (`stato.banca.conti`), grafico del saldo reale, analisi e consigli (`analisiMese`, `trovaAbbonamenti`).
  Regola unica per i totali: `contaNeiTotali(m)` in base.js (niente giroconti, conti nascosti, valute ≠ EUR).

## Check-up mail (Gmail) — `app/js/gmail.js` + `app/js/sezioni/mail.js`
- Gratis: Gmail API + regole, **niente AI**. Usa lo stesso collegamento Google della funzione `google`
  (nessuna modifica alla funzione): `collegaDalServer(SCOPE_GMAIL)` in google.js chiede calendario + Gmail
  insieme (`include_granted_scopes`). Permesso `gmail.modify` = leggere, segnare letta, archiviare
  (NON cancellare per sempre, NON mandare mail).
- Su Google Cloud (progetto **x-ecute**, Edoardo): **Gmail API abilitata** e scope `gmail.modify` aggiunto
  in "Accesso ai dati". Senza l'API attiva l'app mostra "API di Gmail spente".
- Cosa fa: smista in Importanti / Da leggere / Rumore (etichette di Gmail, persone a cui hai scritto,
  regole, posta di massa) e dice perché; trova le **scadenze** nel testo → promemoria (anche su Google);
  "Fallo dopo" = promemoria + archivia; **newsletter** (disiscriviti one-click, silenzia); **ricevute**
  collegate ai movimenti (`movimento.ricevuta = { id, oggetto, da, thread }`); riepilogo in Home.
- Le mail **non** vanno su Supabase: cache solo nel browser (`organizza-posta`), svuotata all'uscita.
  Su Supabase solo le regole (chiave `regole_mail`: `mittenti`, `parole`, `mai`, `silenziati`, `scadenzeViste`).
  Promemoria creati da una mail hanno `da_mail` (id della mail).
- Mail della scuola: Luca ha l'**inoltro automatico** da luca.deodati@student.h-farm.com alla Gmail personale.
  L'app riconosce le mail inoltrate (intestazione `X-Forwarded-For`, o destinatario @h-farm) → `m.conto = "H-FARM"`;
  in alto il filtro Tutte / Personale / H-FARM. Arrivano solo le mail nuove (da quando l'inoltro è attivo).

## Salvataggio su Supabase (`app/js/sincronizza.js`)
- Il browser tiene una copia (localStorage); dopo il login comandano i dati del database.
- `salva()` in base.js, dopo 0,8 secondi, manda a Supabase SOLO quello che è cambiato:
  eventi → tabella `eventi`; tutto il resto → `dati_personali` (una riga per chiave, elenco
  in `CHIAVI_CLOUD`; in più `google_impostazioni` = Client ID e calendari scelti).
- Gli id dell'app (es. `e-abc`) diventano uuid sempre uguali con `uuidDi()` (SHA-256), calcolati insieme all'id dell'account
  (così l'"e1" di Luca e l'"e1" di Edoardo sono due righe diverse: prima il secondo veniva bloccato dalla sicurezza).
- Sezione nuova con dati nuovi? Aggiungi il campo di `stato` a `CHIAVI_CLOUD`, sennò non si salva online.
- Con il login il pulsante "Ricomincia da capo" è nascosto (svuoterebbe solo il browser, non il database).
- Chiave `configurazione` in `dati_personali` = `{ completata, dal }`: se manca, al login l'app fa UNA volta
  la pulizia dei vecchi dati di esempio (`pulisciDatiDiEsempio`): copia di sicurezza nella chiave
  `backup_prima_pulizia`, sezioni svuotate, eventi di esempio e1…e6 tolti (quelli di Google restano).
  Poi parte la configurazione guidata (si rifà dal menu "Configurazione guidata").
- Indicatore in alto sotto l'email (`#stato-cloud`): "Salvato" / errore.
