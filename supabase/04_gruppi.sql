-- =====================================================================
--  AGGIORNAMENTO 4 — gruppi con codice di invito
--  Da eseguire UNA VOLTA SOLA, DOPO 03_sicurezza.sql.
--
--  Come funziona:
--  - ogni gruppo ha un codice di 6 caratteri (es. "A3F09B");
--  - chi crea il gruppo lo manda agli amici (WhatsApp);
--  - gli amici lo scrivono nell'app ed entrano nel gruppo come "membro".
--  Il codice lo vede solo chi è già nel gruppo.
-- =====================================================================

-- 1. Il codice di invito (si crea da solo per ogni gruppo nuovo)
alter table public.gruppi
  add column codice text not null unique
    default upper(substr(md5(gen_random_uuid()::text), 1, 6));

-- 2. Entrare in un gruppo con il codice.
--    È "security definer" perché chi non è ancora nel gruppo non può vederlo:
--    la funzione controlla il codice al posto suo e lo aggiunge come membro.
create function public.entra_nel_gruppo(codice_invito text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  g uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi fare il login';
  end if;

  select id into g
  from public.gruppi
  where codice = upper(trim(codice_invito));

  if g is null then
    raise exception 'Codice sbagliato';
  end if;

  insert into public.membri_gruppo (gruppo_id, utente_id, ruolo)
  values (g, auth.uid(), 'membro')
  on conflict do nothing;

  return g;
end;
$$;

-- solo chi ha fatto il login può usarla
revoke execute on function public.entra_nel_gruppo(text) from public, anon;
grant  execute on function public.entra_nel_gruppo(text) to authenticated;
