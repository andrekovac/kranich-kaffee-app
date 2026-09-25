-- After review: refuse sign-ups for promotions the app no longer shows, and make
-- sure functions and tables created LATER are not open to visitors by default.

create or replace function public.sign_up(p_promotion_id bigint, p_name text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_promo public.promotions%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_taken int;
  v_today date := (now() at time zone 'Europe/Berlin')::date;
begin
  -- Lock the event row so two sign-ups for the last place cannot both succeed.
  select * into v_promo from public.promotions where id = p_promotion_id for update;
  if not found then raise exception 'not_found'; end if;
  if not v_promo.signups_open or v_promo.event_date is null
     or v_promo.valid_until < v_today then raise exception 'closed'; end if;
  if v_promo.event_date < v_today then raise exception 'past'; end if;
  if char_length(v_name) not between 1 and 60 then raise exception 'bad_name'; end if;
  select count(*) into v_taken from public.signups where promotion_id = p_promotion_id;
  if v_promo.capacity is not null and v_taken >= v_promo.capacity then raise exception 'full'; end if;
  insert into public.signups (promotion_id, name) values (p_promotion_id, v_name);
  return case when v_promo.capacity is null then null else v_promo.capacity - v_taken - 1 end;
end;
$$;

-- "create or replace" keeps grants, but state them again to be explicit.
revoke execute on function public.sign_up(bigint, text) from public;
grant execute on function public.sign_up(bigint, text) to anon, authenticated;

-- Defaults for objects created later by the postgres role.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
