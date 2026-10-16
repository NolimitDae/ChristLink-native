-- Christ Link Social — native app features (Phase 3 standout features + Phase 5 compliance)
-- Additive migration. Review before applying to production (see docs/SECURITY.md).
-- Apply to a development project first: supabase db push, or paste into the SQL editor.

begin;

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_follows where follower_id = a and following_id = b)
     and exists (select 1 from public.user_follows where follower_id = b and following_id = a);
$$;

create or replace function public.is_event_host(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = p_event_id and host_id = auth.uid());
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Keep ticket, payment and moderation records when an account is deleted
-- ─────────────────────────────────────────────────────────────
alter table public.tickets alter column user_id drop not null;
alter table public.tickets drop constraint if exists tickets_user_id_fkey;
alter table public.tickets add constraint tickets_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.refund_requests alter column requester_id drop not null;
alter table public.refund_requests drop constraint if exists refund_requests_requester_id_fkey;
alter table public.refund_requests add constraint refund_requests_requester_id_fkey
  foreign key (requester_id) references auth.users(id) on delete set null;

alter table public.ticket_checkins drop constraint if exists ticket_checkins_checked_in_by_fkey;
alter table public.ticket_checkins add constraint ticket_checkins_checked_in_by_fkey
  foreign key (checked_in_by) references public.profiles(id) on delete set null;

alter table public.identity_verifications drop constraint if exists identity_verifications_reviewed_by_fkey;
alter table public.identity_verifications add constraint identity_verifications_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles(id) on delete set null;

-- Community post type labels and Answered ribbon
alter table public.community_posts add column if not exists post_type text
  check (post_type in ('prayer', 'praise', 'testimony', 'encouragement', 'answered'));
alter table public.community_posts add column if not exists prayer_id uuid;

-- ─────────────────────────────────────────────────────────────
-- Churches (Step 3.4)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  denomination text,
  address text,
  city text,
  state text,
  zip text,
  lat double precision,
  lng double precision,
  service_times jsonb not null default '[]'::jsonb,
  livestream_url text,
  website_url text,
  leaders jsonb not null default '[]'::jsonb,
  photos text[] not null default '{}',
  logo_url text,
  about text,
  verified boolean not null default false,
  claimed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists churches_name_idx on public.churches using gin (to_tsvector('simple', name || ' ' || coalesce(city, '')));
create trigger churches_touch before update on public.churches for each row execute function public.touch_updated_at();

create or replace function public.churches_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.created_by := auth.uid();
      new.claimed_by := auth.uid();
      new.hidden := false;
    else
      new.verified := old.verified;
      new.claimed_by := old.claimed_by;
      new.created_by := old.created_by;
      new.hidden := old.hidden;
    end if;
  end if;
  return new;
end $$;
create trigger churches_guard before insert or update on public.churches
  for each row execute function public.churches_guard();

alter table public.churches enable row level security;
create policy churches_select on public.churches for select to anon, authenticated
  using (not hidden or claimed_by = auth.uid() or public.is_admin());
create policy churches_insert on public.churches for insert to authenticated
  with check (auth.uid() is not null);
create policy churches_update on public.churches for update to authenticated
  using (claimed_by = auth.uid() or public.is_admin());
create policy churches_delete on public.churches for delete to authenticated
  using (public.is_admin());

create table if not exists public.church_claims (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  role_at_church text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (church_id, user_id)
);
alter table public.church_claims enable row level security;
create policy church_claims_select on public.church_claims for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy church_claims_insert on public.church_claims for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create or replace function public.decide_church_claim(p_claim_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c public.church_claims;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.church_claims
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_claim_id returning * into c;
  if c.id is null then raise exception 'Claim not found'; end if;
  if p_approve then
    update public.churches set claimed_by = c.user_id, verified = true where id = c.church_id;
  end if;
  insert into public.notifications (user_id, type, title, body, data)
  values (c.user_id, 'church_claim',
          case when p_approve then 'Church claim approved' else 'Church claim not approved' end,
          case when p_approve then 'You can now manage your church page.' else 'Reply to support if you think this is a mistake.' end,
          jsonb_build_object('churchId', c.church_id));
end $$;

create or replace function public.verify_church(p_church_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.churches set verified = p_verified where id = p_church_id;
end $$;

create table if not exists public.church_follows (
  church_id uuid not null references public.churches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (church_id, user_id)
);
alter table public.church_follows enable row level security;
create policy church_follows_select on public.church_follows for select to authenticated using (true);
create policy church_follows_insert on public.church_follows for insert to authenticated with check (user_id = auth.uid());
create policy church_follows_delete on public.church_follows for delete to authenticated using (user_id = auth.uid());

create table if not exists public.church_events (
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (church_id, event_id)
);
alter table public.church_events enable row level security;
create policy church_events_select on public.church_events for select to anon, authenticated using (true);
create policy church_events_insert on public.church_events for insert to authenticated
  with check (public.is_event_host(event_id)
              and exists (select 1 from public.churches c where c.id = church_id and c.claimed_by = auth.uid()));
create policy church_events_delete on public.church_events for delete to authenticated
  using (exists (select 1 from public.churches c where c.id = church_id and (c.claimed_by = auth.uid() or public.is_admin())));

-- Recurring services and gatherings, posted once
create table if not exists public.church_recurring_events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text,
  event_type text,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  weekday smallint check (weekday between 0 and 6),
  day_of_month smallint check (day_of_month between 1 and 28),
  start_time time not null,
  duration_minutes integer not null default 90 check (duration_minutes between 15 and 1440),
  starts_on date not null default current_date,
  ends_on date,
  location text,
  is_service boolean not null default false,
  created_at timestamptz not null default now(),
  check ((frequency = 'monthly' and day_of_month is not null) or (frequency <> 'monthly' and weekday is not null))
);
alter table public.church_recurring_events enable row level security;
create policy cre_select on public.church_recurring_events for select to anon, authenticated using (true);
create policy cre_write on public.church_recurring_events for all to authenticated
  using (exists (select 1 from public.churches c where c.id = church_id and (c.claimed_by = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.churches c where c.id = church_id and (c.claimed_by = auth.uid() or public.is_admin())));

-- ─────────────────────────────────────────────────────────────
-- Per-user settings: privacy, notifications, consent, Home Church
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade default auth.uid(),
  home_church_id uuid references public.churches(id) on delete set null,
  hide_rsvps_from_non_friends boolean not null default false,
  notification_prefs jsonb not null default '{}'::jsonb,
  quiet_hours_start smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end smallint check (quiet_hours_end between 0 and 23),
  timezone text,
  terms_version text,
  terms_accepted_at timestamptz,
  host_adult_confirmed_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_settings_touch before update on public.user_settings for each row execute function public.touch_updated_at();
alter table public.user_settings enable row level security;
create policy user_settings_own on public.user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  platform text check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;
create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Verse of the day (Step 3.2)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.verses (
  id serial primary key,
  reference text not null,
  text text not null,
  translation text not null default 'WEB',
  themes text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.verses enable row level security;
create policy verses_select on public.verses for select to anon, authenticated using (active or public.is_admin());
create policy verses_admin on public.verses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.verse_of_the_day(p_theme text default null)
returns table (id integer, reference text, text text, translation text)
language plpgsql stable security definer set search_path = public as $$
declare
  n integer;
  day_index integer := (current_date - date '2026-01-01');
begin
  if p_theme is not null then
    select count(*) into n from public.verses v where v.active and lower(p_theme) = any (v.themes);
    if n > 0 then
      return query select v.id, v.reference, v.text, v.translation from public.verses v
        where v.active and lower(p_theme) = any (v.themes)
        order by v.id offset (abs(day_index) % n) limit 1;
      return;
    end if;
  end if;
  select count(*) into n from public.verses v where v.active;
  if n = 0 then return; end if;
  return query select v.id, v.reference, v.text, v.translation from public.verses v
    where v.active order by v.id offset (abs(day_index) % n) limit 1;
end $$;

insert into public.verses (reference, text, themes) values
  ('Psalm 46:10', 'Be still, and know that I am God.', '{prayer,worship}'),
  ('Matthew 18:20', 'For where two or three are gathered together in my name, there I am in the middle of them.', '{fellowship,community,bible study}'),
  ('Philippians 4:6', 'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.', '{prayer}'),
  ('Psalm 95:1', 'Oh come, let''s sing to Yahweh. Let''s shout aloud to the rock of our salvation!', '{worship,concert}'),
  ('Hebrews 10:24', 'Let''s consider how to provoke one another to love and good works.', '{community,fellowship,outreach}'),
  ('Psalm 119:105', 'Your word is a lamp to my feet, and a light for my path.', '{bible study}'),
  ('Isaiah 40:31', 'But those who wait for Yahweh will renew their strength. They will mount up with wings like eagles.', '{retreat,prayer}'),
  ('1 Timothy 4:12', 'Let no man despise your youth; but be an example to those who believe, in word, in your way of life, in love, in spirit, in faith, and in purity.', '{youth}'),
  ('Matthew 5:16', 'Even so, let your light shine before men, that they may see your good works, and glorify your Father who is in heaven.', '{outreach,community}'),
  ('Colossians 3:16', 'Let the word of Christ dwell in you richly; in all wisdom teaching and admonishing one another with psalms, hymns, and spiritual songs.', '{worship,bible study,concert}'),
  ('Psalm 133:1', 'See how good and how pleasant it is for brothers to live together in unity!', '{fellowship,community}'),
  ('Mark 6:31', 'Come away into a deserted place, and rest awhile.', '{retreat}'),
  ('Proverbs 27:17', 'Iron sharpens iron; so a man sharpens his friend''s countenance.', '{fellowship,youth,conference}'),
  ('Galatians 6:2', 'Bear one another''s burdens, and so fulfill the law of Christ.', '{prayer,community,outreach}'),
  ('Romans 12:12', 'Rejoicing in hope, enduring in troubles, continuing steadfastly in prayer.', '{prayer}'),
  ('Lamentations 3:22-23', 'His compassion doesn''t fail. They are new every morning. Great is your faithfulness.', '{}'),
  ('John 13:35', 'By this everyone will know that you are my disciples, if you have love for one another.', '{community,fellowship}'),
  ('Joshua 1:9', 'Be strong and courageous. Don''t be afraid. Don''t be dismayed, for Yahweh your God is with you wherever you go.', '{youth,conference}'),
  ('Psalm 100:2', 'Serve Yahweh with gladness. Come before his presence with singing.', '{worship,outreach}'),
  ('Acts 2:42', 'They continued steadfastly in the apostles'' teaching and fellowship, in the breaking of bread, and prayer.', '{bible study,fellowship}'),
  ('2 Timothy 3:16', 'Every Scripture is God-breathed and profitable for teaching, for reproof, for correction, and for instruction in righteousness.', '{bible study,conference}'),
  ('1 Peter 4:10', 'As each has received a gift, employ it in serving one another, as good managers of the grace of God.', '{outreach}'),
  ('Zephaniah 3:17', 'Yahweh your God is among you, a mighty one who will save. He will rejoice over you with joy.', '{worship}'),
  ('Psalm 23:1', 'Yahweh is my shepherd; I shall lack nothing.', '{retreat}'),
  ('Matthew 11:28', 'Come to me, all you who labor and are heavily burdened, and I will give you rest.', '{retreat,prayer}'),
  ('Ephesians 4:2-3', 'With all lowliness and humility, with patience, bearing with one another in love; being eager to keep the unity of the Spirit.', '{community}'),
  ('Jeremiah 29:11', 'For I know the thoughts that I think toward you, says Yahweh, thoughts of peace, and not of evil, to give you hope and a future.', '{youth}'),
  ('Psalm 150:6', 'Let everything that has breath praise Yah! Praise Yah!', '{worship,concert}'),
  ('James 5:16', 'Pray for one another, that you may be healed. The insistent prayer of a righteous person is powerfully effective.', '{prayer}'),
  ('Romans 15:13', 'Now may the God of hope fill you with all joy and peace in believing, that you may abound in hope.', '{}'),
  ('Micah 6:8', 'What does Yahweh require of you, but to act justly, to love mercy, and to walk humbly with your God?', '{outreach,conference}')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- Prayer Wall (Step 3.3)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.prayers (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 3 and 1000),
  is_anonymous boolean not null default false,
  church_id uuid references public.churches(id) on delete set null,
  prayed_count integer not null default 0,
  answered_at timestamptz,
  testimony text check (testimony is null or char_length(testimony) <= 2000),
  testimony_post_id uuid references public.community_posts(id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists prayers_created_idx on public.prayers(created_at desc) where not hidden;
alter table public.prayers enable row level security;
create policy prayers_select_own on public.prayers for select to authenticated
  using (author_id = auth.uid() or public.is_admin());
create policy prayers_insert on public.prayers for insert to authenticated
  with check (author_id = auth.uid() and not hidden and prayed_count = 0 and answered_at is null);
create policy prayers_update_own on public.prayers for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy prayers_delete_own on public.prayers for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

create or replace function public.prayers_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.trusted_write', true), '') <> 'on' and not public.is_admin() then
    new.prayed_count := old.prayed_count;
    new.hidden := old.hidden;
    new.answered_at := old.answered_at;
    new.testimony_post_id := old.testimony_post_id;
    new.author_id := old.author_id;
  end if;
  return new;
end $$;
create trigger prayers_guard before update on public.prayers
  for each row execute function public.prayers_guard();

create table if not exists public.prayer_prays (
  prayer_id uuid not null references public.prayers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (prayer_id, user_id)
);
alter table public.prayer_prays enable row level security;
create policy prayer_prays_select_own on public.prayer_prays for select to authenticated using (user_id = auth.uid());

-- Blocks (Step 5.1) are needed by the wall and feed queries below
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create or replace function public.get_prayer_wall(
  p_filter text default 'all',
  p_limit integer default 30,
  p_before timestamptz default null
)
returns table (
  id uuid, body text, is_anonymous boolean, created_at timestamptz, answered_at timestamptz,
  testimony text, prayed_count integer, has_prayed boolean, is_mine boolean, is_friend boolean,
  church_id uuid, author_id uuid, author_name text, author_avatar_url text, author_avatar_color text
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  home as (select home_church_id from public.user_settings where user_id = auth.uid())
  select p.id, p.body, p.is_anonymous, p.created_at, p.answered_at, p.testimony, p.prayed_count,
         exists (select 1 from public.prayer_prays pp where pp.prayer_id = p.id and pp.user_id = (select uid from me)),
         p.author_id = (select uid from me),
         public.are_friends(p.author_id, (select uid from me)),
         p.church_id,
         case when p.is_anonymous and p.author_id <> (select uid from me) then null else p.author_id end,
         case when p.is_anonymous and p.author_id <> (select uid from me) then null else pr.full_name end,
         case when p.is_anonymous and p.author_id <> (select uid from me) then null else pr.avatar_url end,
         case when p.is_anonymous and p.author_id <> (select uid from me) then null else pr.avatar_color end
  from public.prayers p
  join public.profiles pr on pr.id = p.author_id
  where not p.hidden
    and (p_before is null or p.created_at < p_before)
    and not exists (select 1 from public.blocks b where b.blocker_id = (select uid from me) and b.blocked_id = p.author_id)
    and (
      p_filter = 'all'
      or (p_filter = 'answered' and p.answered_at is not null)
      or (p_filter = 'mine' and p.author_id = (select uid from me))
      or (p_filter = 'friends' and not p.is_anonymous and public.are_friends(p.author_id, (select uid from me)))
      or (p_filter = 'church' and p.church_id is not null and p.church_id = (select home_church_id from home))
    )
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.pray_for(p_prayer_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare new_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to pray'; end if;
  perform set_config('app.trusted_write', 'on', true);
  insert into public.prayer_prays (prayer_id, user_id) values (p_prayer_id, auth.uid())
    on conflict do nothing;
  if found then
    update public.prayers set prayed_count = prayed_count + 1 where id = p_prayer_id
      returning prayed_count into new_count;
  else
    select prayed_count into new_count from public.prayers where id = p_prayer_id;
  end if;
  return coalesce(new_count, 0);
end $$;

create or replace function public.mark_prayer_answered(p_prayer_id uuid, p_testimony text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.prayers;
  post_id uuid;
  v_name text;
begin
  select * into p from public.prayers where id = p_prayer_id;
  if p.id is null or p.author_id <> auth.uid() then raise exception 'Only the author can mark this prayer answered'; end if;
  if p.answered_at is not null then return p.testimony_post_id; end if;
  if p_testimony is null or char_length(trim(p_testimony)) < 3 then raise exception 'Share a short testimony'; end if;
  perform set_config('app.trusted_write', 'on', true);

  insert into public.community_posts (author_id, body, post_type, prayer_id)
  values (auth.uid(), trim(p_testimony), 'answered', p.id)
  returning id into post_id;

  update public.prayers set answered_at = now(), testimony = trim(p_testimony), testimony_post_id = post_id
   where id = p.id;

  select case when p.is_anonymous then 'Someone you prayed for' else coalesce(full_name, 'Someone') end
    into v_name from public.profiles where id = p.author_id;

  insert into public.notifications (user_id, type, title, body, data)
  select pp.user_id, 'prayer_answered', 'A prayer you prayed for was answered',
         v_name || ' shared how God answered their prayer.',
         jsonb_build_object('prayerId', p.id, 'postId', post_id)
    from public.prayer_prays pp where pp.prayer_id = p.id and pp.user_id <> p.author_id;

  return post_id;
end $$;

-- Daily "N people prayed for you" summary, run by pg_cron (see bottom)
create or replace function public.queue_prayer_summaries()
returns integer language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  insert into public.notifications (user_id, type, title, body, data)
  select p.author_id, 'prayer_summary',
         count(*) || case when count(*) = 1 then ' person prayed for you today' else ' people prayed for you today' end,
         'Your community is standing with you.',
         jsonb_build_object('count', count(*))
    from public.prayer_prays pp
    join public.prayers p on p.id = pp.prayer_id
   where pp.created_at > now() - interval '24 hours' and pp.user_id <> p.author_id
   group by p.author_id;
  get diagnostics inserted = row_count;
  return inserted;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Friends going and friend activity (Step 3.1)
-- Friends = mutual follows. Counts confirmed RSVPs and confirmed tickets.
-- ─────────────────────────────────────────────────────────────
create or replace function public.friends_going(p_event_ids uuid[])
returns table (event_id uuid, friend_count integer, friends jsonb)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  friends as (
    select f1.following_id as fid from public.user_follows f1
    join public.user_follows f2 on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
    where f1.follower_id = (select uid from me)
  ),
  going as (
    select r.event_id, r.user_id from public.rsvps r
     where r.event_id = any (p_event_ids) and r.status = 'confirmed' and r.user_id in (select fid from friends)
    union
    select t.event_id, t.user_id from public.tickets t
     where t.event_id = any (p_event_ids) and t.status = 'confirmed' and t.user_id in (select fid from friends)
  )
  select g.event_id, count(*)::integer,
         coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name,
                                               'avatar_url', p.avatar_url, 'avatar_color', p.avatar_color)
                  order by p.full_name) filter (where p.id is not null), '[]'::jsonb)
  from going g join public.profiles p on p.id = g.user_id
  group by g.event_id;
$$;

create or replace function public.friends_this_week()
returns table (event_id uuid, event_name text, start_date timestamptz, cover_url text, friends jsonb)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  friends as (
    select f1.following_id as fid from public.user_follows f1
    join public.user_follows f2 on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
    where f1.follower_id = (select uid from me)
  ),
  going as (
    select r.event_id, r.user_id from public.rsvps r where r.status = 'confirmed' and r.user_id in (select fid from friends)
    union
    select t.event_id, t.user_id from public.tickets t where t.status = 'confirmed' and t.user_id in (select fid from friends)
  )
  select e.id, e.name, e.start_date, e.cover_url,
         jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name,
                                      'avatar_url', p.avatar_url, 'avatar_color', p.avatar_color))
  from going g
  join public.events e on e.id = g.event_id
  join public.profiles p on p.id = g.user_id
  where e.status = 'published' and e.start_date between now() and now() + interval '7 days'
  group by e.id, e.name, e.start_date, e.cover_url
  order by e.start_date
  limit 10;
$$;

create or replace function public.my_friends()
returns table (id uuid, full_name text, avatar_url text, avatar_color text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_url, p.avatar_color
  from public.user_follows f1
  join public.user_follows f2 on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
  join public.profiles p on p.id = f1.following_id
  where f1.follower_id = auth.uid()
  order by p.full_name;
$$;

-- Notify friends when someone RSVPs to an event in their city (max one per friend per day)
create or replace function public.notify_friends_of_rsvp()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  e public.events;
  actor_name text;
begin
  if new.status <> 'confirmed' then return new; end if;
  select * into e from public.events where id = new.event_id;
  if e.id is null or e.status <> 'published' or e.start_date < now() then return new; end if;
  select full_name into actor_name from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, type, title, body, data)
  select f.follower_id, 'friend_rsvp',
         coalesce(actor_name, 'A friend') || ' is going to ' || e.name,
         'Tap to see the event and join them.',
         jsonb_build_object('eventId', e.id, 'friendId', new.user_id)
    from public.user_follows f
    join public.user_follows back on back.follower_id = new.user_id and back.following_id = f.follower_id
    join public.profiles fp on fp.id = f.follower_id
   where f.following_id = new.user_id
     and (e.city is null or fp.city is null or lower(fp.city) = lower(e.city))
     and not exists (
       select 1 from public.notifications n
        where n.user_id = f.follower_id and n.type = 'friend_rsvp' and n.created_at > now() - interval '1 day'
     );
  return new;
end $$;
drop trigger if exists rsvps_notify_friends on public.rsvps;
create trigger rsvps_notify_friends after insert on public.rsvps
  for each row execute function public.notify_friends_of_rsvp();

-- ─────────────────────────────────────────────────────────────
-- Serve: volunteer roles, shifts and sign-ups (Step 3.5)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.serve_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  church_id uuid references public.churches(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text,
  requirements text,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  check (event_id is not null or church_id is not null)
);
alter table public.serve_roles enable row level security;
create policy serve_roles_select on public.serve_roles for select to anon, authenticated using (true);
create policy serve_roles_insert on public.serve_roles for insert to authenticated
  with check (
    created_by = auth.uid() and (
      (event_id is not null and public.is_event_host(event_id))
      or (church_id is not null and exists (select 1 from public.churches c where c.id = church_id and c.claimed_by = auth.uid()))
    )
  );
create policy serve_roles_modify on public.serve_roles for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy serve_roles_delete on public.serve_roles for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

create table if not exists public.serve_shifts (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.serve_roles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  spots integer not null check (spots between 1 and 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.serve_shifts enable row level security;
create policy serve_shifts_select on public.serve_shifts for select to anon, authenticated using (true);
create policy serve_shifts_write on public.serve_shifts for all to authenticated
  using (exists (select 1 from public.serve_roles r where r.id = role_id and r.created_by = auth.uid()))
  with check (exists (select 1 from public.serve_roles r where r.id = role_id and r.created_by = auth.uid()));

create table if not exists public.serve_signups (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.serve_shifts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  status text not null default 'signed_up' check (status in ('signed_up', 'checked_in', 'completed', 'cancelled', 'no_show')),
  code text not null default upper(substr(md5(random()::text), 1, 8)),
  checked_in_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shift_id, user_id),
  unique (code)
);
alter table public.serve_signups enable row level security;
create policy serve_signups_select on public.serve_signups for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.serve_shifts s join public.serve_roles r on r.id = s.role_id
               where s.id = shift_id and r.created_by = auth.uid())
  );
create policy serve_signups_insert on public.serve_signups for insert to authenticated
  with check (user_id = auth.uid() and status = 'signed_up');
create policy serve_signups_own_update on public.serve_signups for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('cancelled', 'signed_up'));

create or replace function public.serve_signup_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.serve_shifts;
  taken integer;
begin
  if tg_op = 'UPDATE' then
    if coalesce(current_setting('app.trusted_write', true), '') = 'on' then return new; end if;
    -- Volunteers may only cancel, or re-join a shift they cancelled.
    if not ((old.status = 'signed_up' and new.status = 'cancelled')
            or (old.status = 'cancelled' and new.status = 'signed_up')) then
      raise exception 'Not allowed';
    end if;
    new.code := old.code;
    new.checked_in_at := old.checked_in_at;
    new.completed_at := old.completed_at;
    if new.status = 'cancelled' then return new; end if;
  end if;
  select * into s from public.serve_shifts where id = new.shift_id for update;
  if s.id is null then raise exception 'Shift not found'; end if;
  if s.starts_at < now() then raise exception 'This shift has already started'; end if;
  select count(*) into taken from public.serve_signups
   where shift_id = new.shift_id and status in ('signed_up', 'checked_in', 'completed');
  if taken >= s.spots then raise exception 'This shift is full'; end if;
  return new;
end $$;
create trigger serve_signups_guard before insert or update on public.serve_signups
  for each row execute function public.serve_signup_guard();

create or replace function public.serve_shift_counts(p_shift_ids uuid[])
returns table (shift_id uuid, taken integer)
language sql stable security definer set search_path = public as $$
  select s.shift_id, count(*)::integer from public.serve_signups s
   where s.shift_id = any (p_shift_ids) and s.status in ('signed_up', 'checked_in', 'completed')
   group by s.shift_id;
$$;

create or replace function public.serve_check_in(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  su public.serve_signups;
  role_name text;
  vol_name text;
begin
  select ss.* into su from public.serve_signups ss
    join public.serve_shifts sh on sh.id = ss.shift_id
    join public.serve_roles r on r.id = sh.role_id
   where ss.code = upper(trim(p_code)) and (r.created_by = auth.uid() or public.is_admin());
  if su.id is null then
    return jsonb_build_object('valid', false, 'error', 'This volunteer pass is not for one of your shifts.');
  end if;
  if su.status = 'cancelled' then
    return jsonb_build_object('valid', false, 'error', 'This sign-up was cancelled.');
  end if;
  if su.status in ('checked_in', 'completed') then
    return jsonb_build_object('valid', false, 'error', 'Already checked in.');
  end if;
  perform set_config('app.trusted_write', 'on', true);
  update public.serve_signups set status = 'checked_in', checked_in_at = now() where id = su.id;
  select r.name, p.full_name into role_name, vol_name from public.serve_shifts sh
    join public.serve_roles r on r.id = sh.role_id
    join public.profiles p on p.id = su.user_id where sh.id = su.shift_id;
  return jsonb_build_object('valid', true, 'message', coalesce(vol_name, 'Volunteer') || ' checked in · ' || role_name);
end $$;

create or replace function public.complete_serve_shift(p_shift_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare done integer;
begin
  if not exists (select 1 from public.serve_shifts s join public.serve_roles r on r.id = s.role_id
                  where s.id = p_shift_id and (r.created_by = auth.uid() or public.is_admin())) then
    raise exception 'Only the organizer can complete this shift';
  end if;
  perform set_config('app.trusted_write', 'on', true);
  update public.serve_shifts set completed_at = now() where id = p_shift_id;
  update public.serve_signups set status = 'completed', completed_at = now()
   where shift_id = p_shift_id and status = 'checked_in';
  get diagnostics done = row_count;
  update public.serve_signups set status = 'no_show' where shift_id = p_shift_id and status = 'signed_up';
  return done;
end $$;

create or replace function public.message_volunteers(p_shift_id uuid, p_message text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  sent integer;
  role_name text;
begin
  select r.name into role_name from public.serve_shifts s join public.serve_roles r on r.id = s.role_id
   where s.id = p_shift_id and (r.created_by = auth.uid() or public.is_admin());
  if role_name is null then raise exception 'Only the organizer can message this shift'; end if;
  if p_message is null or char_length(trim(p_message)) < 2 then raise exception 'Message is empty'; end if;
  insert into public.notifications (user_id, type, title, body, data)
  select su.user_id, 'serve_message', 'Message about your ' || role_name || ' shift', left(trim(p_message), 500),
         jsonb_build_object('shiftId', p_shift_id)
    from public.serve_signups su where su.shift_id = p_shift_id and su.status in ('signed_up', 'checked_in');
  get diagnostics sent = row_count;
  return sent;
end $$;

create or replace function public.my_hours_served()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(round(sum(extract(epoch from (sh.ends_at - sh.starts_at)) / 3600.0)::numeric, 1), 0)
    from public.serve_signups su join public.serve_shifts sh on sh.id = su.shift_id
   where su.user_id = auth.uid() and su.status = 'completed';
$$;

create or replace function public.open_serve_shifts(p_church_id uuid default null, p_event_id uuid default null)
returns table (
  shift_id uuid, role_id uuid, role_name text, description text, requirements text,
  starts_at timestamptz, ends_at timestamptz, spots integer, taken integer,
  event_id uuid, event_name text, church_id uuid, church_name text, my_signup_id uuid, my_status text, my_code text
)
language sql stable security definer set search_path = public as $$
  select sh.id, r.id, r.name, r.description, r.requirements, sh.starts_at, sh.ends_at, sh.spots,
         (select count(*)::integer from public.serve_signups x
           where x.shift_id = sh.id and x.status in ('signed_up', 'checked_in', 'completed')),
         r.event_id, e.name, r.church_id, c.name, mine.id, mine.status, mine.code
  from public.serve_shifts sh
  join public.serve_roles r on r.id = sh.role_id
  left join public.events e on e.id = r.event_id
  left join public.churches c on c.id = r.church_id
  left join public.serve_signups mine on mine.shift_id = sh.id and mine.user_id = auth.uid()
  where sh.starts_at > now()
    and (p_church_id is null or r.church_id = p_church_id)
    and (p_event_id is null or r.event_id = p_event_id)
    and (e.id is null or e.status = 'published')
  order by sh.starts_at
  limit 100;
$$;

-- ─────────────────────────────────────────────────────────────
-- Reports and moderation queue (Step 5.1)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null default auth.uid(),
  target_type text not null check (target_type in ('post', 'reply', 'forum_message', 'prayer', 'profile', 'event', 'church')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'false_info', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index if not exists reports_open_idx on public.reports(created_at) where status = 'open';
alter table public.reports enable row level security;
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.resolve_report(p_report_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_action not in ('dismiss', 'remove') then raise exception 'Unknown action'; end if;
  select * into r from public.reports where id = p_report_id;
  if r.id is null then raise exception 'Report not found'; end if;
  if p_action = 'remove' then
    case r.target_type
      when 'prayer' then update public.prayers set hidden = true where id = r.target_id;
      when 'post' then delete from public.community_posts where id = r.target_id;
      when 'reply' then delete from public.community_replies where id = r.target_id;
      when 'forum_message' then delete from public.event_forum_posts where id = r.target_id;
      when 'church' then update public.churches set hidden = true where id = r.target_id;
      when 'event' then update public.events set status = 'cancelled' where id = r.target_id;
      else null;
    end case;
  end if;
  update public.reports
     set status = case when p_action = 'remove' then 'actioned' else 'dismissed' end,
         resolved_by = auth.uid(), resolved_at = now()
   where target_type = r.target_type and target_id = r.target_id and status = 'open';
end $$;

create or replace function public.admin_report_queue()
returns table (id uuid, target_type text, target_id uuid, reason text, details text, created_at timestamptz,
               report_count integer, preview text, reporter_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.created_at,
         (select count(*)::integer from public.reports x where x.target_type = r.target_type and x.target_id = r.target_id and x.status = 'open'),
         left(coalesce(
           case r.target_type
             when 'prayer' then (select body from public.prayers where id = r.target_id)
             when 'post' then (select body from public.community_posts where id = r.target_id)
             when 'reply' then (select body from public.community_replies where id = r.target_id)
             when 'forum_message' then (select content from public.event_forum_posts where id = r.target_id)
             when 'profile' then (select full_name || ' — ' || coalesce(bio, '') from public.profiles where id = r.target_id)
             when 'event' then (select name from public.events where id = r.target_id)
             when 'church' then (select name from public.churches where id = r.target_id)
           end, '[removed]'), 240),
         (select full_name from public.profiles where id = r.reporter_id)
  from public.reports r
  where r.status = 'open'
  order by r.created_at asc;
end $$;

-- Community post type label, set by the author right after creating the post through the API
create or replace function public.set_post_type(p_post_id uuid, p_type text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_type not in ('prayer', 'praise', 'testimony', 'encouragement') then raise exception 'Unknown post type'; end if;
  update public.community_posts set post_type = p_type where id = p_post_id and author_id = auth.uid();
end $$;

-- ─────────────────────────────────────────────────────────────
-- Account deletion (Step 5.1): removes the person, their content and files;
-- ticket and payment records are kept (user_id set to null) for legal reasons.
-- ─────────────────────────────────────────────────────────────
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists (
    select 1 from public.events e
     where e.host_id = uid and e.start_date > now() and e.status = 'published'
       and exists (select 1 from public.tickets t where t.event_id = e.id and t.status = 'confirmed')
  ) then
    raise exception 'You have upcoming events with sold tickets. Cancel and refund them before deleting your account.';
  end if;
  if exists (
    select 1 from public.events e where e.host_id = uid
       and exists (select 1 from public.tickets t where t.event_id = e.id and t.status in ('confirmed', 'refunded'))
  ) then
    -- Keep hosted events with sales history (payment records) but detach and scrub the host profile.
    update public.events set status = 'cancelled' where host_id = uid and start_date > now();
    update public.profiles set full_name = 'Deleted host', email = null, bio = null, city = null,
      avatar_url = null, banner_url = null, instagram_url = null, facebook_url = null, tiktok_url = null,
      bible_verse = null, bible_verse_reference = null, hot_takes = null, hobbies = null, connect_tags = null,
      prayer_request = null, testimony = null, prayer_supporters = null
     where id = uid;
    delete from public.community_posts where author_id = uid;
    delete from public.community_replies where author_id = uid;
    delete from public.event_forum_posts where user_id = uid;
    delete from public.prayers where author_id = uid;
    delete from public.user_follows where follower_id = uid or following_id = uid;
    delete from public.push_tokens where user_id = uid;
    delete from public.user_settings where user_id = uid;
    delete from public.identity_verifications where user_id = uid;
    update auth.users set email = 'deleted+' || uid::text || '@deleted.christlinksocial.com',
      phone = null, raw_user_meta_data = '{}'::jsonb, banned_until = 'infinity'
     where id = uid;
    return;
  end if;
  delete from public.event_forum_posts where user_id = uid;
  delete from auth.users where id = uid;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function
  public.get_prayer_wall(text, integer, timestamptz), public.pray_for(uuid), public.mark_prayer_answered(uuid, text),
  public.friends_going(uuid[]), public.friends_this_week(), public.my_friends(),
  public.serve_shift_counts(uuid[]), public.serve_check_in(text), public.complete_serve_shift(uuid),
  public.message_volunteers(uuid, text), public.my_hours_served(), public.open_serve_shifts(uuid, uuid),
  public.resolve_report(uuid, text), public.admin_report_queue(), public.set_post_type(uuid, text),
  public.decide_church_claim(uuid, boolean), public.verify_church(uuid, boolean)
to authenticated;
grant execute on function public.verse_of_the_day(text) to anon, authenticated;
revoke execute on function public.queue_prayer_summaries() from public, anon, authenticated;

commit;

-- Optional: nightly prayer summaries at 8pm UTC (requires the pg_cron extension in Database → Extensions)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('prayer-daily-summary', '0 20 * * *', 'select public.queue_prayer_summaries()');
  end if;
end $$;
