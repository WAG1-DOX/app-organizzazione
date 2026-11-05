-- =====================================================================
--  AGGIORNAMENTO 3 — correzioni del Security Advisor di Supabase
--  Da eseguire UNA VOLTA SOLA, DOPO schema.sql e 02_aggiornamento_luca.sql.
--
--  Problema: 4 funzioni "speciali" (security definer) erano chiamabili
--  da chiunque tramite le API. Non erano pericolose, ma è meglio chiuderle.
-- =====================================================================

-- 1. Le due funzioni usate dai lucchetti (sono_membro, sono_admin) vanno in
--    uno schema "privato", che le API non mostrano. I lucchetti continuano
--    a funzionare uguale.
create schema if not exists privato;
grant usage on schema privato to authenticated;

alter function public.sono_membro(uuid) set schema privato;
alter function public.sono_admin(uuid)  set schema privato;

revoke execute on function privato.sono_membro(uuid) from public, anon;
revoke execute on function privato.sono_admin(uuid)  from public, anon;
grant  execute on function privato.sono_membro(uuid) to authenticated;
grant  execute on function privato.sono_admin(uuid)  to authenticated;

-- 2. Le due funzioni automatiche (crea_profilo, creatore_diventa_admin) le
--    usa solo il database da solo: nessuno deve poterle chiamare a mano.
revoke execute on function public.crea_profilo()           from public, anon, authenticated;
revoke execute on function public.creatore_diventa_admin() from public, anon, authenticated;
