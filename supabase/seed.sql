-- Development seed for the native-app feature tables. Run ONLY against a development project
-- (supabase db reset locally, or the SQL editor of a dev project) — never production.
-- Requires at least one profile to exist (sign in once with the app first). The first admin
-- profile (or the oldest profile) becomes the church owner and serve organizer.

do $$
declare
  owner uuid;
  member uuid;
  church uuid;
  role_id uuid;
begin
  select id into owner from public.profiles order by (role = 'admin') desc, created_at limit 1;
  select id into member from public.profiles where id <> owner order by created_at limit 1;
  if owner is null then
    raise notice 'No profiles yet: sign in with the app once, then rerun this seed.';
    return;
  end if;

  insert into public.churches (name, denomination, address, city, state, zip, lat, lng, service_times, livestream_url,
                               leaders, about, verified, claimed_by, created_by)
  values ('Grace Fellowship Church', 'Non-denominational', '120 Market St', 'Philadelphia', 'PA', '19106', 39.9500, -75.1450,
          '[{"day":0,"time":"09:00","label":"Traditional"},{"day":0,"time":"11:00","label":"Contemporary"}]'::jsonb,
          'https://youtube.com/@gracefellowship',
          '[{"name":"Pastor Ruth Adeyemi","title":"Lead Pastor"},{"name":"Marcus Bell","title":"Worship Director"}]'::jsonb,
          'A multi-generational church in Old City. Everyone is welcome.', true, owner, owner)
  returning id into church;

  insert into public.churches (name, denomination, city, state, lat, lng, service_times, verified)
  values ('New Hope Community Church', 'Baptist', 'Camden', 'NJ', 39.9259, -75.1196, '[{"day":0,"time":"10:00"}]'::jsonb, false),
         ('St. Luke''s Parish', 'Catholic', 'Philadelphia', 'PA', 39.9612, -75.1700, '[{"day":6,"time":"17:00","label":"Vigil"},{"day":0,"time":"08:00"}]'::jsonb, true);

  insert into public.church_recurring_events (church_id, name, description, event_type, frequency, weekday, start_time, duration_minutes, location, is_service)
  values (church, 'Sunday Worship', 'Main gathering with worship and teaching.', 'Worship', 'weekly', 0, '11:00', 90, 'Main sanctuary', true),
         (church, 'Wednesday Bible Study', 'Verse-by-verse through Acts. Coffee at 6:45.', 'Bible Study', 'weekly', 3, '19:00', 75, 'Fellowship hall', false),
         (church, 'Young Adults Night', 'Ages 18–30. Worship, discussion and food.', 'Youth', 'biweekly', 5, '19:30', 120, 'Upper room', false);
  insert into public.church_recurring_events (church_id, name, event_type, frequency, day_of_month, start_time, duration_minutes, location)
  values (church, 'Community Breakfast', 'Outreach', 'monthly', 1, '08:30', 120, 'Fellowship hall');

  insert into public.user_settings (user_id, home_church_id) values (owner, church)
    on conflict (user_id) do update set home_church_id = excluded.home_church_id;

  insert into public.prayers (author_id, body, is_anonymous, church_id)
  values (owner, 'Please pray for my mom''s surgery on Friday — for peace and a quick recovery.', false, church),
         (owner, 'Starting a new job next week. Praying for wisdom and good relationships with my team.', false, null),
         (owner, 'Pray for healing in my family. We need reconciliation.', true, church);

  insert into public.serve_roles (church_id, name, description, requirements, created_by)
  values (church, 'Greeter', 'Welcome people at the doors and help newcomers find their way.', 'Friendly smile. Arrive 20 minutes early.', owner)
  returning id into role_id;
  insert into public.serve_shifts (role_id, starts_at, ends_at, spots)
  values (role_id, date_trunc('week', now()) + interval '13 days 10 hours 30 minutes', date_trunc('week', now()) + interval '13 days 12 hours 30 minutes', 6),
         (role_id, date_trunc('week', now()) + interval '20 days 10 hours 30 minutes', date_trunc('week', now()) + interval '20 days 12 hours 30 minutes', 6);

  insert into public.serve_roles (church_id, name, description, created_by)
  values (church, 'Community Breakfast Kitchen', 'Cook and serve breakfast for neighbors.', owner)
  returning id into role_id;
  insert into public.serve_shifts (role_id, starts_at, ends_at, spots)
  values (role_id, now() + interval '9 days', now() + interval '9 days 3 hours', 10);

  if member is not null then
    perform set_config('app.trusted_write', 'on', true);
    insert into public.prayer_prays (prayer_id, user_id) select id, member from public.prayers where author_id = owner on conflict do nothing;
    update public.prayers p set prayed_count = (select count(*) from public.prayer_prays pp where pp.prayer_id = p.id) where author_id = owner;
  end if;
end $$;
