-- INC MCD NETWORK (Ward Sadasya): database schema for Supabase
-- Run in Supabase Dashboard > SQL Editor. Safe to re-run on an existing database.

create extension if not exists pgcrypto;

-- Ward members. Mobile number is the unique ID and the login.
create table if not exists members (
  mobile        text primary key check (mobile ~ '^[6-9][0-9]{9}$'),
  name          text not null,
  ward_no       int  not null check (ward_no between 1 and 250),
  ward_name     text,
  zone          text,          -- legacy name for district, kept for older rows
  district      text,          -- MCD district (same as zone)
  assembly      text,
  active        boolean not null default true,
  first_login_at timestamptz,
  last_active_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists members_ward_idx on members (ward_no);
-- Existing databases: add district and copy it from the old zone column.
alter table members add column if not exists district text;
update members set district = zone where district is null and zone is not null;
create index if not exists members_district_idx on members (lower(trim(coalesce(district, zone, ''))));

-- App sessions (no OTP: login by registered mobile number only).
create table if not exists sessions (
  token      uuid primary key default gen_random_uuid(),
  mobile     text not null references members(mobile) on delete cascade,
  created_at timestamptz not null default now()
);

-- Daily tasks. kind 'upload' = needs videos; kind 'share' = a watch/reshare card with links, not a task.
create table if not exists tasks (
  id           bigserial primary key,
  task_date    date not null,
  sort         int  not null default 1,
  kind         text not null default 'upload' check (kind in ('upload','share')),
  title        text not null,
  description  text,
  video_slots  int  not null default 1 check (video_slots between 1 and 5),
  allow_photos boolean not null default true,
  link_x         text,
  link_instagram text,
  link_facebook  text,
  link_whatsapp  text,
  created_at   timestamptz not null default now()
);
create index if not exists tasks_date_idx on tasks (task_date, sort);

-- Every uploaded file.
create table if not exists media (
  id         bigserial primary key,
  mobile     text not null references members(mobile) on delete cascade,
  task_id    bigint not null references tasks(id) on delete cascade,
  kind       text not null check (kind in ('video','photo')),
  path       text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists media_task_idx on media (task_id, mobile);

-- A tick. Only allowed by the API once at least 1 video exists for that task.
create table if not exists completions (
  mobile       text not null references members(mobile) on delete cascade,
  task_id      bigint not null references tasks(id) on delete cascade,
  completed_at timestamptz not null default now(),
  video_count  int not null default 0,
  photo_count  int not null default 0,
  primary key (mobile, task_id)
);
create index if not exists completions_task_idx on completions (task_id);

-- Leader video/audio messages.
create table if not exists leader_messages (
  id           bigserial primary key,
  title        text not null,
  kind         text not null check (kind in ('video','audio')),
  path         text not null,          -- path inside the public 'leader' bucket
  published_at timestamptz not null default now()
);
-- Optional short summary shown under the caption in the app.
alter table leader_messages add column if not exists summary text;

create table if not exists message_views (
  mobile     text not null references members(mobile) on delete cascade,
  message_id bigint not null references leader_messages(id) on delete cascade,
  seen_at    timestamptz not null default now(),
  primary key (mobile, message_id)
);

-- One-off messages from admin, shown in the app at the next reminder check or app open.
create table if not exists announcements (
  id         bigserial primary key,
  body       text not null,
  ward_no    int,           -- null = everyone
  zone       text,          -- legacy, same as district
  district   text,          -- null = all districts
  only_pending boolean not null default false,
  created_at timestamptz not null default now()
);
alter table announcements add column if not exists district text;
alter table announcements add column if not exists title text;
alter table announcements add column if not exists priority text not null default 'high';
alter table announcements add column if not exists pushed_count int;

-- Leader social links and other settings.
create table if not exists settings (
  key   text primary key,
  value text
);
insert into settings (key, value) values
  ('social_facebook', 'https://www.facebook.com/'),
  ('social_x', 'https://x.com/'),
  ('social_instagram', 'https://www.instagram.com/'),
  ('helpline', '9000000000'),
  ('reminder_hours', '7,10,13,16,19,22'),
  ('max_upload_mb', '50'),
  ('app_version_code', '2'),
  ('app_version_name', '1.1'),
  ('app_download_url', 'https://github.com/amandangi26/ward-sadasya/releases/latest'),
  ('app_update_notes', 'नए फ़ीचर्स: पॉइंट्स सिस्टम, स्टार रेटिंग्स, तेज़ वीडियो अपलोड और बग फिक्स।'),
  ('app_update_mandatory', 'false')
on conflict (key) do nothing;

-- Admin users (Supabase Auth users who may use the admin panel). These are master admins.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  label   text
);

-- Telecallers: staff who call ward members. Each one sees only their districts.
create table if not exists telecallers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  phone      text,
  remarks    text,
  districts  text[] not null default '{}',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Every call a telecaller (or admin) makes to a ward member.
create table if not exists call_logs (
  id            bigserial primary key,
  member_mobile text not null references members(mobile) on delete cascade,
  caller_id     uuid references auth.users(id) on delete set null,
  caller_name   text,
  outcome       text not null check (outcome in ('connected','will_do','not_reachable','switched_off','wrong_number','not_interested','call_back','other')),
  remarks       text,
  follow_up     date,
  created_at    timestamptz not null default now()
);
create index if not exists call_logs_member_idx on call_logs (member_mobile, created_at desc);
create index if not exists call_logs_caller_idx on call_logs (caller_id, created_at desc);

-- Firebase push tokens, one per phone install.
create table if not exists push_tokens (
  token      text primary key,
  mobile     text not null references members(mobile) on delete cascade,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_mobile_idx on push_tokens (mobile);

-- Share button taps from the app (X, Facebook, Instagram, WhatsApp). One row per member, task and platform.
create table if not exists share_events (
  mobile     text not null references members(mobile) on delete cascade,
  task_id    bigint not null references tasks(id) on delete cascade,
  platform   text not null check (platform in ('x','facebook','instagram','whatsapp')),
  action     text not null default 'open',
  created_at timestamptz not null default now(),
  primary key (mobile, task_id, platform)
);

-- Profile details members fill in from the app (photo, name, ward, assembly, Lok Sabha, district, family size,
-- contact numbers). Kept apart from members: login stays on the allotted number and nothing here changes it.
-- Every save is a request; an admin approves it in the Profile updates tab, which copies it into member_profiles.
create table if not exists profile_requests (
  id             bigserial primary key,
  mobile         text not null references members(mobile) on delete cascade,
  full_name      text not null,
  details        text,
  ward_no        int,
  assembly       text,
  lok_sabha      text,
  district       text,
  family_members int check (family_members between 0 and 50),
  contact_mobile text,
  alt_mobile     text,
  photo_path     text,           -- inside the private 'uploads' bucket, under profiles/<mobile>/
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at   timestamptz not null default now(),
  reviewed_at    timestamptz,
  reviewed_by    text,
  review_note    text
);
create index if not exists profile_requests_status_idx on profile_requests (status, submitted_at desc);
create index if not exists profile_requests_mobile_idx on profile_requests (mobile, submitted_at desc);

-- Approved profile, one row per member.
create table if not exists member_profiles (
  mobile         text primary key references members(mobile) on delete cascade,
  full_name      text not null,
  details        text,
  ward_no        int,
  assembly       text,
  lok_sabha      text,
  district       text,
  family_members int,
  contact_mobile text,
  alt_mobile     text,
  photo_path     text,
  request_id     bigint references profile_requests(id) on delete set null,
  approved_at    timestamptz not null default now()
);

-- SECURITY: an earlier version promoted every new Supabase Auth user to admin.
-- With public sign-ups on, anyone could make themselves an admin. Removed.
-- Admins and telecallers are now created from the admin panel (Team tab).
drop trigger if exists on_auth_user_created_admin on auth.users;
drop function if exists public.handle_new_admin_user();

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function is_telecaller() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from telecallers where user_id = auth.uid() and active);
$$;

-- Districts of the signed-in telecaller, normalised to lower case.
create or replace function my_districts() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select array_agg(lower(trim(d))) from telecallers t, unnest(t.districts) d
                   where t.user_id = auth.uid() and t.active), '{}');
$$;

-- True when the member belongs to one of the signed-in telecaller's districts.
create or replace function in_my_districts(member_mobile text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m
                 where m.mobile = member_mobile
                   and lower(trim(coalesce(m.district, m.zone, ''))) = any (my_districts()));
$$;

-- Who is signed in to the admin panel: 'admin', 'telecaller' or null.
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select case when is_admin() then 'admin' when is_telecaller() then 'telecaller' else null end;
$$;

-- Row level security: the app talks only through the Edge Function (service role),
-- so plain clients get nothing; admins get full access.
do $$
declare t text;
begin
  foreach t in array array['members','sessions','tasks','media','completions','leader_messages','message_views','announcements','settings','admins','telecallers','call_logs','push_tokens','share_events','profile_requests','member_profiles']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists admin_all on %I', t);
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Public read for app configuration and updates
drop policy if exists public_read_settings on settings;
create policy public_read_settings on settings for select to anon, authenticated using (true);

-- Telecaller access: read-only on ward members (and their activity) in their own districts,
-- read their own profile, and log calls for those members.
drop policy if exists tc_members on members;
create policy tc_members on members for select to authenticated
  using (is_telecaller() and lower(trim(coalesce(district, zone, ''))) = any (my_districts()));
drop policy if exists tc_completions on completions;
create policy tc_completions on completions for select to authenticated using (is_telecaller() and in_my_districts(mobile));
drop policy if exists tc_media on media;
create policy tc_media on media for select to authenticated using (is_telecaller() and in_my_districts(mobile));
drop policy if exists tc_shares on share_events;
create policy tc_shares on share_events for select to authenticated using (is_telecaller() and in_my_districts(mobile));
drop policy if exists tc_tasks on tasks;
create policy tc_tasks on tasks for select to authenticated using (is_telecaller());
drop policy if exists tc_self on telecallers;
create policy tc_self on telecallers for select to authenticated using (user_id = auth.uid());
drop policy if exists tc_calls_read on call_logs;
create policy tc_calls_read on call_logs for select to authenticated using (is_telecaller() and in_my_districts(member_mobile));
drop policy if exists tc_calls_write on call_logs;
create policy tc_calls_write on call_logs for insert to authenticated
  with check (is_telecaller() and caller_id = auth.uid() and in_my_districts(member_mobile));

-- Per-member totals for rankings, points and the members list.
-- Points: 100 per share (per task and platform) + 100 per photo + 200 per video. Completing a task earns nothing by itself.
drop view if exists member_stats;
create view member_stats with (security_invoker = true) as
select m.mobile, m.name, m.ward_no, m.ward_name, m.zone, coalesce(m.district, m.zone) as district, m.assembly, m.active,
       m.first_login_at, m.last_active_at,
       coalesce(c.tasks_done, 0) as tasks_done,
       coalesce(med.videos, 0)   as videos,
       coalesce(med.photos, 0)   as photos,
       coalesce(sh.shares, 0)    as shares,
       (coalesce(sh.shares, 0) * 100 + coalesce(med.photos, 0) * 100 + coalesce(med.videos, 0) * 200) as points,
       c.last_completed_at
from members m
left join (
  select mobile, count(*) as tasks_done, max(completed_at) as last_completed_at
  from completions group by mobile
) c on c.mobile = m.mobile
left join (
  select mobile,
         count(*) filter (where kind = 'video') as videos,
         count(*) filter (where kind = 'photo') as photos
  from media group by mobile
) med on med.mobile = m.mobile
left join (
  select mobile, count(*) as shares from share_events group by mobile
) sh on sh.mobile = m.mobile;

-- Latest call per member, for the calling list.
create or replace view member_last_call with (security_invoker = true) as
select distinct on (member_mobile)
       member_mobile as mobile, outcome as last_outcome, remarks as last_remarks,
       follow_up as next_follow_up, caller_name as last_caller, created_at as last_call_at
from call_logs
order by member_mobile, created_at desc;

-- Per-task totals for the task report.
create or replace view task_stats with (security_invoker = true) as
select t.id, t.task_date, t.sort, t.kind, t.title,
       (select count(*) from completions c where c.task_id = t.id) as completed,
       (select count(*) from media x where x.task_id = t.id and x.kind = 'video') as videos,
       (select count(*) from media x where x.task_id = t.id and x.kind = 'photo') as photos,
       (select count(*) from share_events e where e.task_id = t.id) as shares,
       (select count(*) from share_events e where e.task_id = t.id and e.platform = 'x') as shares_x,
       (select count(*) from share_events e where e.task_id = t.id and e.platform = 'facebook') as shares_facebook,
       (select count(*) from share_events e where e.task_id = t.id and e.platform = 'instagram') as shares_instagram,
       (select count(*) from share_events e where e.task_id = t.id and e.platform = 'whatsapp') as shares_whatsapp
from tasks t;

-- Storage buckets: private uploads from members, public leader messages.
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', false, 524288000),
       ('leader', 'leader', true, 524288000)
on conflict (id) do nothing;

drop policy if exists admin_read_uploads on storage.objects;
create policy admin_read_uploads on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and is_admin());

drop policy if exists admin_write_leader on storage.objects;
create policy admin_write_leader on storage.objects for all to authenticated
  using (bucket_id = 'leader' and is_admin()) with check (bucket_id = 'leader' and is_admin());

-- Dashboard summary views (admin only through RLS on the base tables).
create or replace view day_stats with (security_invoker = true) as
select t.task_date,
       count(distinct t.id)        as tasks,
       count(c.task_id)            as completed,
       count(distinct c.mobile)    as active,
       coalesce(sum(c.video_count), 0) as videos
from tasks t
left join completions c on c.task_id = t.id
where t.kind = 'upload'
group by t.task_date;

create or replace view ward_day_stats with (security_invoker = true) as
select t.task_date, m.ward_no,
       count(*)                 as completed,
       count(distinct c.mobile) as active,
       coalesce(sum(c.video_count), 0) as videos
from completions c
join tasks t   on t.id = c.task_id
join members m on m.mobile = c.mobile
group by t.task_date, m.ward_no;

create or replace view hour_stats with (security_invoker = true) as
select (created_at at time zone 'Asia/Kolkata')::date as day,
       extract(hour from created_at at time zone 'Asia/Kolkata')::int as hour,
       count(*) as uploads
from media where kind = 'video'
group by 1, 2;
