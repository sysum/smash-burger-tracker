-- Atomic burger creation.
--
-- `Repository.addVisit` is documented as creating a burger and its scorecards
-- "in one atomic write", and the IndexedDB implementation gets that for free
-- from a single transaction. Two separate INSERTs over HTTP would not: if the
-- ratings call fails after the visit call succeeds, the leaderboard gains a
-- burger that nobody rated and no error says why. Scores are the entire point
-- of the app, so this is worth a function.
--
-- Run after 0001. SQL Editor → New query → paste → Run.

create or replace function public.add_visit(visit jsonb, ratings jsonb)
returns void
language plpgsql
-- SECURITY INVOKER, deliberately: the function runs as the caller, so the row
-- level security policies still apply. SECURITY DEFINER would let anyone who
-- can call this bypass them entirely and write to the leaderboard anonymously.
security invoker
set search_path = public
as $$
begin
  insert into public.visits (
    id, restaurant_name, burger_name, location, date, price, notes, photo_id, created_at
  )
  values (
    visit ->> 'id',
    visit ->> 'restaurant_name',
    visit ->> 'burger_name',
    coalesce(visit ->> 'location', ''),
    (visit ->> 'date')::date,
    (visit ->> 'price')::numeric,
    coalesce(visit ->> 'notes', ''),
    visit ->> 'photo_id',
    coalesce((visit ->> 'created_at')::timestamptz, now())
  );

  insert into public.ratings (
    id, visit_id, reviewer_id, smash_texture, beef_flavor, cheese_toppings, bun, value
  )
  select
    r ->> 'id',
    r ->> 'visit_id',
    r ->> 'reviewer_id',
    (r ->> 'smash_texture')::public.rating_value,
    (r ->> 'beef_flavor')::public.rating_value,
    (r ->> 'cheese_toppings')::public.rating_value,
    (r ->> 'bun')::public.rating_value,
    (r ->> 'value')::public.rating_value
  from jsonb_array_elements(coalesce(ratings, '[]'::jsonb)) as r;
end;
$$;

-- Functions grant EXECUTE to PUBLIC by default, so the revoke is the part that
-- matters. RLS would still block an anonymous insert, but there is no reason to
-- let a stranger call this at all.
revoke execute on function public.add_visit(jsonb, jsonb) from public, anon;
grant  execute on function public.add_visit(jsonb, jsonb) to authenticated;
