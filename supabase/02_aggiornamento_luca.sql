-- =====================================================================
--  AGGIORNAMENTO 2 — richiesto da Luca (vedi app/tabelle-nuove.md)
--  Da eseguire UNA VOLTA SOLA nel SQL Editor, DOPO schema.sql.
-- =====================================================================

-- 1. EVENTI: nuovo tipo "produttivita" (studio, lavoro, progetti)
alter table public.eventi drop constraint if exists eventi_tipo_check;
alter table public.eventi add constraint eventi_tipo_check
  check (tipo in ('scuola', 'produttivita', 'allenamento', 'impegno', 'altro'));

-- 2. EVENTI: campi nuovi
alter table public.eventi
  add column luogo             text not null default '',
  add column colore            text,   -- es. '#f4511e'; vuoto = automatico
  add column google_id         text,   -- id dell'evento su Google Calendar
  add column google_calendario text;   -- id del calendario Google

-- 3. DATI PERSONALI: una tabella sola per tutte le altre sezioni dell'app
--    (spese, lista della spesa, giornata, routine, sonno, obiettivi, materie...).
--    Ogni sezione salva i suoi dati sotto una "chiave", in formato JSON.
create table public.dati_personali (
  utente_id     uuid not null default auth.uid() references public.profili (id) on delete cascade,
  chiave        text not null,
  valore        jsonb not null,
  aggiornato_il timestamptz not null default now(),
  primary key (utente_id, chiave)
);

-- Lucchetto: ognuno vede e modifica solo i suoi dati personali.
alter table public.dati_personali enable row level security;

create policy "dati_personali: solo i miei" on public.dati_personali
  for all to authenticated
  using (utente_id = auth.uid()) with check (utente_id = auth.uid());
