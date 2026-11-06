-- =====================================================================
--  AGGIORNAMENTO 8 — la chat con l'assistente (una al giorno)
--  Da eseguire UNA VOLTA SOLA (SQL Editor di Supabase), dopo gli altri.
--
--  Ogni messaggio della chat con l'assistente è una riga: chi l'ha scritto
--  (utente o assistente), il giorno della chat, il testo e cosa ha fatto
--  l'assistente (azioni). Ogni giorno la chat riparte da zero, ma quelle
--  vecchie restano da rileggere. Ognuno vede e cancella SOLO le sue.
--  I messaggi li scrive la funzione "assistente" (con il login dell'utente).
-- =====================================================================

create table public.chat_assistente (
  id         uuid primary key default gen_random_uuid(),
  utente_id  uuid not null default auth.uid() references public.profili (id) on delete cascade,
  giorno     date not null,                     -- il giorno della chat (fuso italiano)
  ruolo      text not null check (ruolo in ('utente', 'assistente')),
  testo      text not null check (length(testo) between 1 and 8000),
  azioni     jsonb not null default '[]'::jsonb, -- es. ["✓ Lavare i denti (1/2)", "🔔 Chiamare la nonna"]
  origine    text not null default 'app' check (origine in ('app', 'telegram')),
  creato_il  timestamptz not null default now()
);
create index chat_assistente_utente_giorno on public.chat_assistente (utente_id, giorno, creato_il);

alter table public.chat_assistente enable row level security;

create policy "chat_assistente: vedere le mie" on public.chat_assistente
  for select to authenticated using (utente_id = auth.uid());
create policy "chat_assistente: scrivere le mie" on public.chat_assistente
  for insert to authenticated with check (utente_id = auth.uid());
create policy "chat_assistente: cancellare le mie" on public.chat_assistente
  for delete to authenticated using (utente_id = auth.uid());
-- niente modifica: un messaggio, una volta scritto, resta com'è
revoke update on public.chat_assistente from anon, authenticated;
