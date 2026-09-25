-- Promotions and event sign-ups for the Kranich Kaffee app.
-- Visitors (anon/authenticated) get NO table access. They can only call
-- get_promotions() and sign_up(). Names are never readable by visitors.

create table public.promotions (
  id bigint generated always as identity primary key,
  title text not null,
  text text,
  code text,
  valid_until date,
  event_date date,
  start_time time,
  end_time time,
  place text,
  signups_open boolean not null default false,
  capacity int check (capacity > 0),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.signups (
  id bigint generated always as identity primary key,
  promotion_id bigint not null references public.promotions (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create index signups_promotion_id_idx on public.signups (promotion_id);

alter table public.promotions enable row level security;
alter table public.signups enable row level security;
revoke all on public.promotions, public.signups from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

create function public.get_promotions()
returns table (
  id bigint, title text, text text, code text, valid_until date, event_date date,
  start_time time, end_time time, place text, signups_open boolean, capacity int,
  places_left int
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, p.text, p.code, p.valid_until, p.event_date,
         p.start_time, p.end_time, p.place, p.signups_open, p.capacity,
         case when p.capacity is null then null
              else p.capacity - (select count(*)::int from public.signups s where s.promotion_id = p.id)
         end
  from public.promotions p
  where coalesce(p.valid_until, p.event_date) is null
     or coalesce(p.valid_until, p.event_date) >= (now() at time zone 'Europe/Berlin')::date
  order by p.sort, p.id;
$$;

create function public.sign_up(p_promotion_id bigint, p_name text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_promo public.promotions%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_taken int;
begin
  -- Lock the event row so two sign-ups for the last place cannot both succeed.
  select * into v_promo from public.promotions where id = p_promotion_id for update;
  if not found then raise exception 'not_found'; end if;
  if not v_promo.signups_open or v_promo.event_date is null then raise exception 'closed'; end if;
  if v_promo.event_date < (now() at time zone 'Europe/Berlin')::date then raise exception 'past'; end if;
  if char_length(v_name) not between 1 and 60 then raise exception 'bad_name'; end if;
  select count(*) into v_taken from public.signups where promotion_id = p_promotion_id;
  if v_promo.capacity is not null and v_taken >= v_promo.capacity then raise exception 'full'; end if;
  insert into public.signups (promotion_id, name) values (p_promotion_id, v_name);
  return case when v_promo.capacity is null then null else v_promo.capacity - v_taken - 1 end;
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant execute on function public.get_promotions() to anon, authenticated;
grant execute on function public.sign_up(bigint, text) to anon, authenticated;

-- Delete sign-ups 14 days after their event.
create extension if not exists pg_cron;
select cron.schedule(
  'delete-old-signups', '15 3 * * *',
  $$delete from public.signups s using public.promotions p
    where s.promotion_id = p.id
      and p.event_date < (now() at time zone 'Europe/Berlin')::date - 14$$
);
