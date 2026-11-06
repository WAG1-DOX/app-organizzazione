-- =====================================================================
--  AGGIORNAMENTO 7 — Google Calendar sempre collegato
--  Da eseguire UNA VOLTA SOLA (SQL Editor di Supabase), dopo gli altri.
--
--  Prima il permesso di Google stava solo nel browser e durava 1 ora:
--  poi bisognava ripremere "Collega". Adesso la funzione "google" tiene,
--  CIFRATO qui sotto, il permesso "a lungo termine" (refresh token) di ognuno
--  e ogni ora dà all'app un permesso nuovo, senza chiedere niente.
--
--  Nessuna policy = nessun utente può leggere questa tabella (neanche la sua riga):
--  la usa solo la funzione "google" con la chiave di servizio, lato server.
-- =====================================================================

create table public.google_collegamenti (
  utente_id        uuid primary key references public.profili (id) on delete cascade,
  refresh_cifrato  text not null,          -- refresh token di Google, cifrato con BANCA_SEGRETO
  email            text,                   -- l'account Google collegato (solo per mostrarlo)
  creato_il        timestamptz not null default now(),
  aggiornato_il    timestamptz not null default now()
);
alter table public.google_collegamenti enable row level security;
revoke all on public.google_collegamenti from anon, authenticated;
