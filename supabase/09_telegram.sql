-- =====================================================================
--  AGGIORNAMENTO 9 — bot Telegram + limite di domande al giorno
--  Da eseguire UNA VOLTA SOLA (SQL Editor di Supabase), dopo gli altri.
--
--  1. telegram_codici: codice da usare una volta (dura 15 minuti) che l'app
--     crea quando tocchi "Collega Telegram". Lo mandi al bot e lui capisce chi sei.
--  2. telegram_collegamenti: quale chat Telegram appartiene a quale account.
--     Ognuno vede (e può cancellare = scollegare) solo la sua riga.
--     La riga la scrive SOLO la funzione "assistente" (chiave di servizio).
--  3. uso_assistente + conta_domanda(): quante domande ha fatto ognuno oggi,
--     per non consumare troppo credito di Claude (vale per app e Telegram).
-- =====================================================================

-- 1. Codici per collegare
create table public.telegram_codici (
  codice     text primary key,
  utente_id  uuid not null references public.profili (id) on delete cascade,
  scade_il   timestamptz not null default now() + interval '15 minutes'
);
alter table public.telegram_codici enable row level security;
revoke all on public.telegram_codici from anon, authenticated; -- li legge solo la funzione

-- L'app chiama questa funzione e riceve un codice nuovo (quelli vecchi si cancellano)
create or replace function public.codice_telegram()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuovo text;
begin
  if auth.uid() is null then
    raise exception 'Devi fare il login.';
  end if;
  delete from public.telegram_codici where utente_id = auth.uid() or scade_il < now();
  -- 8 caratteri senza lettere che si confondono (niente 0/O, 1/I/L)
  nuovo := array_to_string(array(
    select substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1)
    from generate_series(1, 8)), '');
  insert into public.telegram_codici (codice, utente_id) values (nuovo, auth.uid());
  return nuovo;
end;
$$;
revoke execute on function public.codice_telegram() from public, anon;
grant  execute on function public.codice_telegram() to authenticated;

-- 2. Collegamenti Telegram ↔ account
create table public.telegram_collegamenti (
  utente_id      uuid primary key references public.profili (id) on delete cascade,
  chat_id        bigint not null unique,      -- la chat privata con il bot
  nome_telegram  text not null default '',
  collegato_il   timestamptz not null default now()
);
alter table public.telegram_collegamenti enable row level security;
create policy "telegram: vedere il mio" on public.telegram_collegamenti
  for select to authenticated using (utente_id = auth.uid());
create policy "telegram: scollegare il mio" on public.telegram_collegamenti
  for delete to authenticated using (utente_id = auth.uid());
revoke insert, update on public.telegram_collegamenti from anon, authenticated;

-- 3. Limite di domande al giorno
create table public.uso_assistente (
  utente_id  uuid not null references public.profili (id) on delete cascade,
  giorno     date not null,
  domande    integer not null default 0,
  primary key (utente_id, giorno)
);
alter table public.uso_assistente enable row level security;
create policy "uso: vedere il mio" on public.uso_assistente
  for select to authenticated using (utente_id = auth.uid());
revoke insert, update, delete on public.uso_assistente from anon, authenticated;

-- Aggiunge 1 al contatore di oggi e dice se si può ancora chiedere.
-- La chiama SOLO la funzione "assistente" con la chiave di servizio.
create or replace function public.conta_domanda(p_utente uuid, p_giorno date, p_limite integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  fatte integer;
begin
  insert into public.uso_assistente (utente_id, giorno, domande)
  values (p_utente, p_giorno, 1)
  on conflict (utente_id, giorno) do update set domande = public.uso_assistente.domande + 1
  returning domande into fatte;
  return fatte <= p_limite;
end;
$$;
revoke execute on function public.conta_domanda(uuid, date, integer) from public, anon, authenticated;
grant  execute on function public.conta_domanda(uuid, date, integer) to service_role;
