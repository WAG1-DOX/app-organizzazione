-- =====================================================================
--  AGGIORNAMENTO 6 — banche collegate con Enable Banking
--  Da eseguire UNA VOLTA SOLA (SQL Editor di Supabase), dopo gli altri.
--  Scritto dal Claude di Luca, da controllare ed eseguire da Edoardo.
--
--  Come funziona:
--  - ognuno ha la SUA applicazione Enable Banking (Application ID + chiave privata .pem);
--  - la chiave privata la manda l'app UNA volta alla funzione "banca", che la salva
--    CIFRATA qui sotto (banca_chiavi). Nessun utente può leggerla, neanche la sua:
--    la usa solo la funzione (con la chiave di servizio, lato server);
--  - i collegamenti alle banche (banca_collegamenti) li vede solo il proprietario,
--    ma li crea/cancella solo la funzione;
--  - i movimenti NON stanno qui: la funzione li legge da Enable Banking e li manda
--    all'app, che li salva insieme alle altre spese (dati_personali, chiave "movimenti").
-- =====================================================================

-- 1. Le chiavi Enable Banking di ognuno (cifrate). Nessuna policy = nessun accesso dall'app.
create table public.banca_chiavi (
  utente_id      uuid primary key references public.profili (id) on delete cascade,
  application_id text not null,
  chiave_cifrata text not null,          -- chiave privata cifrata con il segreto BANCA_SEGRETO
  aggiornato_il  timestamptz not null default now()
);
alter table public.banca_chiavi enable row level security;
revoke all on public.banca_chiavi from anon, authenticated;

-- 2. Le banche collegate (una riga per ogni collegamento/consenso)
create table public.banca_collegamenti (
  id                   uuid primary key default gen_random_uuid(),
  utente_id            uuid not null references public.profili (id) on delete cascade,
  session_id           text not null,    -- sessione Enable Banking (serve solo alla funzione)
  banca                text not null,    -- es. "Revolut", "FinecoBank"
  paese                text not null,    -- es. "LT", "IT"
  conti                jsonb not null default '[]'::jsonb,  -- [{ uid, nome, iban, valuta }]
  valido_fino          timestamptz,      -- quando scade il permesso della banca
  ultimo_aggiornamento timestamptz,      -- ultima lettura dei movimenti
  creato_il            timestamptz not null default now()
);
alter table public.banca_collegamenti enable row level security;
create index banca_collegamenti_utente on public.banca_collegamenti (utente_id);

-- l'app può solo LEGGERE i propri collegamenti, e senza session_id
revoke all on public.banca_collegamenti from anon, authenticated;
grant select (id, utente_id, banca, paese, conti, valido_fino, ultimo_aggiornamento, creato_il)
  on public.banca_collegamenti to authenticated;
create policy "banca_collegamenti: vedere i miei" on public.banca_collegamenti
  for select to authenticated using (utente_id = auth.uid());

-- 3. Collegamenti iniziati e non ancora finiti (mentre sei sul sito della banca).
--    Serve a riconoscere chi torna dalla banca. Solo la funzione la usa.
create table public.banca_attese (
  state     text primary key,
  utente_id uuid not null references public.profili (id) on delete cascade,
  banca     text not null,
  paese     text not null,
  creato_il timestamptz not null default now()
);
alter table public.banca_attese enable row level security;
revoke all on public.banca_attese from anon, authenticated;
