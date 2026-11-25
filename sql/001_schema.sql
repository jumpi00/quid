-- Quid · 001 schema
-- Da eseguire una volta nel SQL Editor di Supabase (progetto nuovo e vuoto).
--
-- Sicurezza:
--  * RLS su tutte le tabelle: ogni riga appartiene a un utente e la vede solo lui.
--  * Tutte le letture/scritture dall'app richiedono la verifica in due passaggi (aal2).
--  * Il Comando Rapido usa un token personale: nel database c'è solo il suo hash SHA-256.
--  * Il ruolo anonimo può eseguire solo ingest_applepay, daily_check e keepalive.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- helper

create or replace function public.is_aal2() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;

create or replace function public.today_rome() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Rome')::date
$$;

-- "McDonald's Milano 12" -> "mcdonalds milano 12"
create or replace function public.normalize_merchant(t text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(
           regexp_replace(translate(lower(coalesce(t, '')), 'àáâäèéêëìíîïòóôöùúûü', 'aaaaeeeeiiiioooouuuu'), '[''’`]', '', 'g'),
           '[^a-z0-9]+', ' ', 'g'))
$$;

-- "€12,50" / "12.50 EUR" / "1.234,56 €" / "1,234.56" -> numeric
create or replace function public.parse_amount(t text) returns numeric
language plpgsql immutable set search_path = '' as $$
declare
  s text := regexp_replace(coalesce(t, ''), '[^0-9,.]', '', 'g');
  pc int; pd int; p int;
begin
  if s = '' then return null; end if;
  pc := strpos(reverse(s), ',');
  pd := strpos(reverse(s), '.');
  if pc > 0 and pd > 0 then
    p := least(pc, pd);                       -- il separatore più a destra è quello decimale
  elsif pc > 0 then
    p := case when pc - 1 between 1 and 2 then pc else 0 end;
  elsif pd > 0 then
    p := case when pd - 1 between 1 and 2 then pd else 0 end;
  else
    p := 0;
  end if;
  if p = 0 then
    return round(regexp_replace(s, '[,.]', '', 'g')::numeric, 2);
  end if;
  return round((regexp_replace(left(s, length(s) - p), '[,.]', '', 'g') || '.' || right(s, p - 1))::numeric, 2);
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------- tabelle

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  budget numeric(12,2) check (budget is null or (budget >= 0 and budget < 10000000)),
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table public.recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  amount numeric(12,2) not null check (amount > 0 and amount < 1000000),
  category_id uuid,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  start_date date not null,
  next_index int not null default 0 check (next_index >= 0),
  mode text not null default 'confirm' check (mode in ('confirm', 'auto')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  amount numeric(12,2) not null check (amount > 0 and amount < 1000000),
  merchant text not null default '' check (char_length(merchant) <= 120),
  note text not null default '' check (char_length(note) <= 500),
  category_id uuid,
  card text not null default '' check (char_length(card) <= 60),
  source text not null default 'manual' check (source in ('manual', 'applepay', 'recurring')),
  status text not null default 'confirmed' check (status in ('confirmed', 'pending')),
  needs_review boolean not null default false,
  recurring_id uuid,
  occurred_on date not null default public.today_rome(),
  created_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (recurring_id, user_id) references public.recurring (id, user_id) on delete set null (recurring_id)
);
create index transactions_user_date on public.transactions (user_id, occurred_on desc);
create index transactions_user_inbox on public.transactions (user_id) where status = 'pending' or needs_review;

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern text not null check (char_length(pattern) between 1 and 120),
  category_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, pattern),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

create table public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text not null default 'iPhone' check (char_length(label) between 1 and 40),
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- dizionario comune esercente -> categoria (solo lettura, usato dalle funzioni)
create table public.merchant_dictionary (
  keyword text primary key,
  category text not null
);

create table public.keepalive (
  id int primary key default 1 check (id = 1),
  at timestamptz not null default now()
);
insert into public.keepalive default values;

-- ---------------------------------------------------------------- permessi + RLS

revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update, delete on public.categories, public.recurring, public.transactions, public.rules to authenticated;
grant select on public.ingest_tokens to authenticated;
grant update (label, revoked_at) on public.ingest_tokens to authenticated;

alter table public.categories enable row level security;
alter table public.recurring enable row level security;
alter table public.transactions enable row level security;
alter table public.rules enable row level security;
alter table public.ingest_tokens enable row level security;
alter table public.merchant_dictionary enable row level security;
alter table public.keepalive enable row level security;

create policy own_categories on public.categories for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_aal2()))
  with check (user_id = (select auth.uid()) and (select public.is_aal2()));

create policy own_recurring on public.recurring for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_aal2()))
  with check (user_id = (select auth.uid()) and (select public.is_aal2()));

create policy own_transactions on public.transactions for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_aal2()))
  with check (user_id = (select auth.uid()) and (select public.is_aal2()));

create policy own_rules on public.rules for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_aal2()))
  with check (user_id = (select auth.uid()) and (select public.is_aal2()));

create policy own_tokens_select on public.ingest_tokens for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_aal2()));
create policy own_tokens_update on public.ingest_tokens for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_aal2()))
  with check (user_id = (select auth.uid()) and (select public.is_aal2()));
-- merchant_dictionary e keepalive: nessuna policy = nessun accesso diretto.

-- ---------------------------------------------------------------- logica

create or replace function public.recurring_date(p_start date, p_freq text, p_index int) returns date
language sql immutable set search_path = '' as $$
  select case p_freq
    when 'weekly'  then p_start + p_index * 7
    when 'monthly' then (p_start + make_interval(months => p_index))::date
    when 'yearly'  then (p_start + make_interval(years => p_index))::date
  end
$$;

create or replace function public.categorize(p_uid uuid, p_merchant text, out category_id uuid, out from_rule boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_norm text := public.normalize_merchant(p_merchant);
begin
  from_rule := false;
  if v_norm = '' then return; end if;

  select r.category_id into category_id
  from public.rules r
  where r.user_id = p_uid and (v_norm = r.pattern or v_norm like r.pattern || ' %')
  order by length(r.pattern) desc limit 1;
  if category_id is not null then from_rule := true; return; end if;

  select c.id into category_id
  from public.merchant_dictionary d
  join public.categories c on c.user_id = p_uid and c.name = d.category and not c.archived
  where v_norm ~ (case when length(d.keyword) <= 3 then '(^| )' || d.keyword || '( |$)' else '(^| )' || d.keyword end)
  order by length(d.keyword) desc limit 1;
end $$;

create or replace function public.materialize_recurring(p_uid uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record; d date; n int := 0; guard int;
  v_today date := public.today_rome();
begin
  for r in select * from public.recurring where user_id = p_uid and active for update loop
    guard := 0;
    loop
      d := public.recurring_date(r.start_date, r.frequency, r.next_index);
      exit when d > v_today or guard >= 24;
      insert into public.transactions (user_id, amount, merchant, category_id, source, status, recurring_id, occurred_on)
      values (p_uid, r.amount, r.name, r.category_id, 'recurring',
              case when r.mode = 'auto' then 'confirmed' else 'pending' end, r.id, d);
      r.next_index := r.next_index + 1;
      guard := guard + 1;
      n := n + 1;
    end loop;
    if guard > 0 then
      update public.recurring set next_index = r.next_index where id = r.id;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.user_from_token(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if p_token is null or p_token !~ '^quid_[0-9a-f]{64}$' then
    raise exception 'Token non valido' using errcode = '28000';
  end if;
  update public.ingest_tokens
     set last_used_at = now()
   where token_hash = extensions.digest(p_token, 'sha256') and revoked_at is null
  returning user_id into v_uid;
  if v_uid is null then
    raise exception 'Token non valido' using errcode = '28000';
  end if;
  return v_uid;
end $$;

create or replace function public.fmt_eur(a numeric) returns text
language sql immutable set search_path = '' as $$
  select replace(to_char(a, 'FM999999990.00'), '.', ',') || ' €'
$$;

-- Chiamata dal Comando Rapido a ogni pagamento Apple Pay.
create or replace function public.ingest_applepay(p_token text, p_amount text, p_merchant text default '', p_card text default '')
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.user_from_token(p_token);
  v_amount numeric := public.parse_amount(p_amount);
  v_merchant text := left(btrim(coalesce(p_merchant, '')), 120);
  v_card text := left(btrim(coalesce(p_card, '')), 60);
  v_norm text := public.normalize_merchant(v_merchant);
  v_cat uuid; v_rule boolean; v_pending uuid; v_name text;
  v_today date := public.today_rome();
begin
  if v_amount is null or v_amount <= 0 or v_amount >= 1000000 then
    raise exception 'Importo non valido' using errcode = '22023';
  end if;
  if (select count(*) from public.transactions
       where user_id = v_uid and source = 'applepay' and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Troppe richieste' using errcode = '54000';
  end if;

  perform public.materialize_recurring(v_uid);

  -- è una ricorrente in attesa? allora la conferma invece di creare un doppione
  select t.id into v_pending
  from public.transactions t join public.recurring r on r.id = t.recurring_id
  where t.user_id = v_uid and t.status = 'pending'
    and abs(t.occurred_on - v_today) <= 3
    and abs(t.amount - v_amount) <= t.amount * 0.10
    and v_norm <> ''
    and (public.normalize_merchant(r.name) = v_norm
         or v_norm like public.normalize_merchant(r.name) || '%'
         or public.normalize_merchant(r.name) like v_norm || '%')
  order by abs(t.occurred_on - v_today) limit 1;

  if v_pending is not null then
    update public.transactions
       set status = 'confirmed', amount = v_amount, card = v_card, source = 'applepay', occurred_on = v_today
     where id = v_pending
    returning category_id into v_cat;
    if v_cat is null then
      select c.category_id into v_cat from public.categorize(v_uid, v_merchant) c;
      update public.transactions set category_id = v_cat where id = v_pending;
    end if;
  else
    select c.category_id, c.from_rule into v_cat, v_rule from public.categorize(v_uid, v_merchant) c;
    insert into public.transactions (user_id, amount, merchant, card, category_id, source, needs_review)
    values (v_uid, v_amount, v_merchant, v_card, v_cat, 'applepay', not coalesce(v_rule, false));
  end if;

  select name into v_name from public.categories where id = v_cat;
  return 'Quid: ' || public.fmt_eur(v_amount)
         || case when v_merchant <> '' then ' · ' || v_merchant else '' end
         || ' → ' || coalesce(v_name, 'da categorizzare');
end $$;

-- Chiamata dall'automazione giornaliera: crea le ricorrenti in scadenza e riassume cosa c'è da confermare.
create or replace function public.daily_check(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.user_from_token(p_token);
  v_n int; v_list text;
begin
  perform public.materialize_recurring(v_uid);
  select count(*), string_agg(coalesce(nullif(merchant, ''), 'Spesa') || ' ' || public.fmt_eur(amount), ', ' order by occurred_on)
    into v_n, v_list
  from public.transactions
  where user_id = v_uid and status = 'pending';
  if v_n = 0 then return null; end if;
  return 'Quid: ' || v_n || ' da confermare: ' || v_list;
end $$;

-- ---------------------------------------------------------------- RPC per l'app (richiedono aal2)

create or replace function public.require_aal2() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_aal2() then
    raise exception 'Verifica in due passaggi richiesta' using errcode = '28000';
  end if;
  return auth.uid();
end $$;

create or replace function public.app_start() returns int
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_aal2();
begin
  if not exists (select 1 from public.categories where user_id = v_uid) then
    insert into public.categories (user_id, name, position) values
      (v_uid, 'Spesa', 1), (v_uid, 'Ristoranti e bar', 2), (v_uid, 'Trasporti', 3),
      (v_uid, 'Casa', 4), (v_uid, 'Bollette', 5), (v_uid, 'Abbonamenti', 6),
      (v_uid, 'Salute', 7), (v_uid, 'Shopping', 8), (v_uid, 'Svago', 9),
      (v_uid, 'Viaggi', 10), (v_uid, 'Regali', 11), (v_uid, 'Altro', 12);
  end if;
  return public.materialize_recurring(v_uid);
end $$;

create or replace function public.set_category(p_tx uuid, p_category uuid, p_remember boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_aal2(); v_norm text;
begin
  update public.transactions set category_id = p_category, needs_review = false
   where id = p_tx and user_id = v_uid
  returning public.normalize_merchant(merchant) into v_norm;
  if not found then raise exception 'Spesa non trovata'; end if;

  if p_remember and p_category is not null and v_norm <> '' then
    insert into public.rules (user_id, pattern, category_id) values (v_uid, v_norm, p_category)
    on conflict (user_id, pattern) do update set category_id = excluded.category_id;
    -- applica subito alle altre spese dello stesso esercente ancora da rivedere
    update public.transactions set category_id = p_category, needs_review = false
     where user_id = v_uid and needs_review and public.normalize_merchant(merchant) = v_norm;
  end if;
end $$;

create or replace function public.create_ingest_token(p_label text default 'iPhone') returns text
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_aal2(); v_token text;
begin
  if (select count(*) from public.ingest_tokens where user_id = v_uid and revoked_at is null) >= 5 then
    raise exception 'Massimo 5 token attivi: revocane uno';
  end if;
  v_token := 'quid_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.ingest_tokens (user_id, label, token_hash)
  values (v_uid, left(coalesce(nullif(btrim(p_label), ''), 'iPhone'), 40), extensions.digest(v_token, 'sha256'));
  return v_token;   -- mostrato una sola volta, poi resta solo l'hash
end $$;

create or replace function public.keepalive() returns timestamptz
language sql security definer set search_path = '' as $$
  update public.keepalive set at = now() where id = 1 returning at
$$;

-- ---------------------------------------------------------------- permessi sulle funzioni

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.ingest_applepay(text, text, text, text) to anon, authenticated;
grant execute on function public.daily_check(text) to anon, authenticated;
grant execute on function public.keepalive() to anon;
grant execute on function public.app_start() to authenticated;
grant execute on function public.set_category(uuid, uuid, boolean) to authenticated;
grant execute on function public.create_ingest_token(text) to authenticated;
grant execute on function public.is_aal2() to authenticated;
grant execute on function public.today_rome() to authenticated;   -- default di transactions.occurred_on

-- le funzioni create in futuro non sono eseguibili di default
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
