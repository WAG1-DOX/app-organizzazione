# Tabelle nuove da aggiungere al database (proposta di Luca)

## ⭐ Cosa serve ADESSO per collegare l'app (Edoardo, leggi qui)

Il tuo `schema.sql` va benissimo. L'app però nel frattempo è cresciuta: per
collegarla servono **2 cose**. Ti propongo il codice SQL, ma decidi tu: la
cartella `supabase/` è tua.

**1. Eventi: un tipo e quattro campi in più**
- tipo `produttivita` (studio, lavoro, progetti): oggi il controllo accetta solo
  scuola / allenamento / impegno / altro, e l'app non riuscirebbe a salvarli;
- `luogo`, `colore` (il colore scelto per l'evento, uguale a quelli di Google),
  `google_id` e `google_calendario` (per sapere quale evento di Google è).

**2. Una tabella unica per tutto il resto** (spese, lista della spesa, giornata,
routine, sonno, obiettivi, materie e orario…). Invece di 20 tabelle diverse,
una sola dove ogni sezione salva i suoi dati in formato JSON. È la strada più
veloce e sicura per partire; più avanti, se serve, si dividono.

```sql
-- 1. eventi: tipo "produttivita" + campi nuovi
--    (controlla il nome del vincolo in Table Editor → eventi → tipo; di solito è eventi_tipo_check)
alter table public.eventi drop constraint eventi_tipo_check;
alter table public.eventi add constraint eventi_tipo_check
  check (tipo in ('scuola', 'produttivita', 'allenamento', 'impegno', 'altro'));
alter table public.eventi
  add column luogo             text not null default '',
  add column colore            text,   -- es. '#f4511e'; vuoto = automatico
  add column google_id         text,   -- id dell'evento su Google Calendar
  add column google_calendario text;   -- id del calendario Google

-- 2. tutti gli altri dati personali dell'app, uno per "chiave"
--    (es. chiave 'movimenti', 'giornate', 'obiettivi_lungo', 'sonno')
create table public.dati_personali (
  utente_id     uuid not null default auth.uid() references public.profili (id) on delete cascade,
  chiave        text not null,
  valore        jsonb not null,
  aggiornato_il timestamptz not null default now(),
  primary key (utente_id, chiave)
);
alter table public.dati_personali enable row level security;
create policy "dati_personali: solo i miei" on public.dati_personali
  for all to authenticated
  using (utente_id = auth.uid()) with check (utente_id = auth.uid());
```

Le chiavi che l'app userà in `dati_personali`: `materie`, `orario`, `quotidiane`,
`registro`, `modelli_extra`, `promemoria`, `movimenti`, `budget`, `scontrini`,
`lista_spesa`, `acqua`, `pasti`, `regole_mail`, `micro_modelli`, `routine_base`,
`giornate`, `obiettivi_settimana`, `sonno`, `categorie_obiettivi`, `obiettivi_lungo`.

---

## La proposta di prima (tabelle separate, per quando vorremo dividerle)

Edoardo: la prima bozza dell'app ha sezioni nuove che hanno bisogno di queste
tabelle. Per ora i dati sono finti (`app/dati-finti.js`) e si salvano solo nel
browser. Se vanno bene, aggiungile a `CLAUDE.md` (sezione Database) e creale su
Supabase. Se vuoi cambiare un nome, dimmelo prima.

Ogni tabella ha anche `id` e, dove serve, `utente_id` (di chi è il dato).

| Tabella | Campi | A cosa serve |
|---|---|---|
| `materie` | `id`, `utente_id`, `nome`, `prof`, `aula`, `colore` (es. `#d1fe17`) | Le materie (Principles of Economics, …): rinominandone una cambia ovunque |
| `orario_lezioni` | `id`, `utente_id`, `giorno` (1 = lun … 6 = sab), `inizio` (HH:MM), `fine` (HH:MM), `materia_id` | Orario settimanale che si ripete |
| `lista_spesa` | `id`, `utente_id`, `nome`, `quantita`, `preso` (true/false) | Cosa comprare |
| `scontrini` | `id`, `utente_id`, `negozio`, `data`, `totale`, `movimento_id`, `foto_url`, `articoli` (lista) | Foto dello scontrino collegata all'uscita in `movimenti` (la foto andrà in Supabase Storage) |
| `attivita_quotidiane` | `id`, `utente_id`, `nome`, `minuti`, `volte_al_giorno`, `icona` | Denti (2 min, 2 volte), doccia (25 min, 1 volta)… |
| `registro_quotidiane` | `utente_id`, `giorno` (AAAA-MM-GG), `attivita_id`, `volte` | Quante volte hai fatto ogni attività quel giorno |
| `modelli_extra` | `id`, `utente_id`, `nome`, `minuti`, `tipo` (`allenamento` / `impegno` / `altro`) | Attività salvate da mettere in calendario col + |
| `promemoria` | `id`, `utente_id`, `testo`, `scadenza` (AAAA-MM-GG o vuoto), `fatto` (true/false) | Cose da non dimenticare |
| `movimenti` | `id`, `utente_id`, `tipo` (`entrata` / `uscita`), `importo`, `categoria`, `descrizione`, `data` (AAAA-MM-GG), `scontrino_id` (facoltativo) | Entrate e uscite |
| `budget` | `utente_id`, `mensile`, `categorie` (JSON: `{ "Cibo": 70, … }`) | Budget del mese e per categoria |
| `acqua` | `utente_id`, `giorno`, `bicchieri` | Bicchieri d'acqua del giorno |
| `pasti` | `utente_id`, `giorno`, `pasto` (`colazione` / `pranzo` / `merenda` / `cena`), `testo` | Cosa hai mangiato |
| `regole_mail` | `utente_id`, `mittenti` (lista), `parole` (lista) | Cosa rende importante una mail |

Le attività extra messe in calendario diventano normali righe di `eventi`
(con `tipo` = `allenamento` / `impegno` / `altro`): non serve un'altra tabella.

**Campo nuovo in `eventi`**: `google_id` (testo, facoltativo) = l'id dell'evento su
Google Calendar, per sapere quale evento di Google corrisponde a quale evento nostro.

Tutte con **Row Level Security**: ognuno vede solo le sue righe.

## Google Calendar
**Già nell'app** (`app/js/google.js`): ognuno collega il suo Google dal browser con un
Client ID gratuito; l'app legge gli eventi ogni 30 secondi e manda a Google quelli creati,
modificati o eliminati. Limite: il permesso dura ~1 ora e a ogni apertura bisogna toccare "Collega".

**Per renderlo automatico al 100% (lavoro per Edoardo, con Supabase):**
- login con Google tramite Supabase Auth, chiedendo anche il permesso del calendario
  e salvando il "refresh token" (così non scade);
- una Edge Function che riceve gli avvisi di Google ("push notifications") quando il
  calendario cambia e aggiorna la tabella `eventi`; l'app la riceve con Supabase Realtime.

## Per dopo (non ancora nell'app)
- **Gmail**: stesso login, permesso di sola lettura. Le regole qui sopra decidono
  cosa è importante, senza AI e senza crediti.
