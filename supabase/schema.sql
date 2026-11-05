-- =====================================================================
--  SCHEMA DEL DATABASE — app-organizzazione
--  Da incollare UNA VOLTA SOLA nel SQL Editor di Supabase su un progetto
--  nuovo, poi premere "Run".
--  I nomi dei campi sono quelli di CLAUDE.md: non cambiarli senza avvisare Luca.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABELLE
-- ---------------------------------------------------------------------

-- Un profilo per ogni account. L'id è lo stesso dell'account di login.
create table public.profili (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null,
  avatar_url  text,
  creato_il   timestamptz not null default now()
);

-- Gruppi di persone (es. "Classe 4B").
create table public.gruppi (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  creato_da   uuid not null default auth.uid() references public.profili (id) on delete cascade,
  creato_il   timestamptz not null default now()
);

-- Chi fa parte di quale gruppo.
create table public.membri_gruppo (
  gruppo_id   uuid not null references public.gruppi (id) on delete cascade,
  utente_id   uuid not null references public.profili (id) on delete cascade,
  ruolo       text not null default 'membro' check (ruolo in ('admin', 'membro')),
  primary key (gruppo_id, utente_id)
);

-- Impegni, allenamenti, verifiche...
-- gruppo_id vuoto (null) = evento privato.
create table public.eventi (
  id               uuid primary key default gen_random_uuid(),
  titolo           text not null,
  descrizione      text not null default '',
  tipo             text not null default 'altro'
                     check (tipo in ('scuola', 'allenamento', 'impegno', 'altro')),
  inizio           timestamptz not null,
  fine             timestamptz not null,
  tutto_il_giorno  boolean not null default false,
  proprietario_id  uuid not null default auth.uid() references public.profili (id) on delete cascade,
  gruppo_id        uuid references public.gruppi (id) on delete cascade,
  completato       boolean not null default false,
  creato_il        timestamptz not null default now(),
  check (fine >= inizio)
);

-- Messaggi della chat tra due persone.
create table public.messaggi (
  id               uuid primary key default gen_random_uuid(),
  mittente_id      uuid not null default auth.uid() references public.profili (id) on delete cascade,
  destinatario_id  uuid not null references public.profili (id) on delete cascade,
  testo            text not null check (length(testo) > 0),
  evento_id        uuid references public.eventi (id) on delete set null,
  letto            boolean not null default false,
  creato_il        timestamptz not null default now()
);

-- Indici: rendono veloci le ricerche più frequenti.
create index eventi_proprietario_inizio on public.eventi (proprietario_id, inizio);
create index eventi_gruppo_inizio       on public.eventi (gruppo_id, inizio);
create index messaggi_destinatario      on public.messaggi (destinatario_id, creato_il);
create index messaggi_mittente          on public.messaggi (mittente_id, creato_il);
create index membri_utente              on public.membri_gruppo (utente_id);


-- ---------------------------------------------------------------------
-- 2. AUTOMATISMI
-- ---------------------------------------------------------------------

-- Quando qualcuno si registra, gli crea in automatico il profilo.
-- Il nome lo prende da quello inserito alla registrazione, altrimenti
-- dalla prima parte dell'email.
create function public.crea_profilo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profili (id, nome)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger quando_nuovo_account
  after insert on auth.users
  for each row execute function public.crea_profilo();

-- Chi crea un gruppo ne diventa subito admin.
create function public.creatore_diventa_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.membri_gruppo (gruppo_id, utente_id, ruolo)
  values (new.id, new.creato_da, 'admin');
  return new;
end;
$$;

create trigger quando_nuovo_gruppo
  after insert on public.gruppi
  for each row execute function public.creatore_diventa_admin();

-- Funzioni di aiuto per le regole di sicurezza.
create function public.sono_membro(g uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membri_gruppo
    where gruppo_id = g and utente_id = auth.uid()
  );
$$;

create function public.sono_admin(g uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membri_gruppo
    where gruppo_id = g and utente_id = auth.uid() and ruolo = 'admin'
  );
$$;


-- ---------------------------------------------------------------------
-- 3. SICUREZZA (Row Level Security)
--    Regola base: ognuno vede e modifica solo le sue cose,
--    più quelle dei gruppi di cui fa parte.
-- ---------------------------------------------------------------------

alter table public.profili       enable row level security;
alter table public.gruppi        enable row level security;
alter table public.membri_gruppo enable row level security;
alter table public.eventi        enable row level security;
alter table public.messaggi      enable row level security;

-- PROFILI: chi ha fatto il login vede nome e foto degli altri
-- (serve per la chat), ma modifica solo il proprio.
create policy "profili: vedere" on public.profili
  for select to authenticated using (true);

create policy "profili: modificare il proprio" on public.profili
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- GRUPPI
create policy "gruppi: vedere i miei" on public.gruppi
  for select to authenticated
  using (public.sono_membro(id) or creato_da = auth.uid());

create policy "gruppi: crearne uno" on public.gruppi
  for insert to authenticated
  with check (creato_da = auth.uid());

create policy "gruppi: modificare se admin" on public.gruppi
  for update to authenticated
  using (public.sono_admin(id)) with check (public.sono_admin(id));

create policy "gruppi: eliminare se admin" on public.gruppi
  for delete to authenticated
  using (public.sono_admin(id));

-- MEMBRI DEI GRUPPI
create policy "membri: vedere quelli dei miei gruppi" on public.membri_gruppo
  for select to authenticated
  using (public.sono_membro(gruppo_id));

create policy "membri: aggiungere se admin" on public.membri_gruppo
  for insert to authenticated
  with check (public.sono_admin(gruppo_id));

create policy "membri: togliere se admin o uscire da solo" on public.membri_gruppo
  for delete to authenticated
  using (public.sono_admin(gruppo_id) or utente_id = auth.uid());

-- EVENTI: vedo i miei e quelli dei miei gruppi.
-- Creo/modifico/elimino solo i miei, e posso metterli solo in gruppi miei.
create policy "eventi: vedere" on public.eventi
  for select to authenticated
  using (
    proprietario_id = auth.uid()
    or (gruppo_id is not null and public.sono_membro(gruppo_id))
  );

create policy "eventi: creare" on public.eventi
  for insert to authenticated
  with check (
    proprietario_id = auth.uid()
    and (gruppo_id is null or public.sono_membro(gruppo_id))
  );

create policy "eventi: modificare i miei" on public.eventi
  for update to authenticated
  using (proprietario_id = auth.uid())
  with check (
    proprietario_id = auth.uid()
    and (gruppo_id is null or public.sono_membro(gruppo_id))
  );

create policy "eventi: eliminare i miei" on public.eventi
  for delete to authenticated
  using (proprietario_id = auth.uid());

-- MESSAGGI: vedo solo quelli che ho mandato o ricevuto.
create policy "messaggi: vedere i miei" on public.messaggi
  for select to authenticated
  using (mittente_id = auth.uid() or destinatario_id = auth.uid());

create policy "messaggi: mandare" on public.messaggi
  for insert to authenticated
  with check (mittente_id = auth.uid());

create policy "messaggi: segnare come letto" on public.messaggi
  for update to authenticated
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

create policy "messaggi: eliminare i miei" on public.messaggi
  for delete to authenticated
  using (mittente_id = auth.uid());


-- ---------------------------------------------------------------------
-- 4. TEMPO REALE
--    Eventi e messaggi arrivano subito sull'altro telefono.
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.eventi, public.messaggi;
