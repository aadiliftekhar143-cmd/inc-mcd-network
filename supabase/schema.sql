-- Ward Sadasya: database schema for Supabase
-- Run once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

-- Ward members. Mobile number is the unique ID and the login.
create table if not exists members (
  mobile        text primary key check (mobile ~ '^[6-9][0-9]{9}$'),
  name          text not null,
  ward_no       int  not null check (ward_no between 1 and 250),
  ward_name     text,
  zone          text,
  assembly      text,
  active        boolean not null default true,
  first_login_at timestamptz,
  last_active_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists members_ward_idx on members (ward_no);

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
  zone       text,          -- null = all zones
  only_pending boolean not null default false,
  created_at timestamptz not null default now()
);

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
  ('reminder_hours', '7,10,13,16,19,22')
on conflict (key) do nothing;

-- Admin users (Supabase Auth users who may use the admin panel).
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  label   text
);

-- Automatically promote newly created Supabase Auth users to admins
create or replace function public.handle_new_admin_user()
returns trigger as $$
begin
  insert into public.admins (user_id, label)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin
  after insert on auth.users
  for each row execute procedure public.handle_new_admin_user();

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- Row level security: the app talks only through the Edge Function (service role),
-- so plain clients get nothing; admins get full access.
do $$
declare t text;
begin
  foreach t in array array['members','sessions','tasks','media','completions','leader_messages','message_views','announcements','settings','admins']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists admin_all on %I', t);
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Per-member totals for rankings, points and the members list.
create or replace view member_stats with (security_invoker = true) as
select m.mobile, m.name, m.ward_no, m.ward_name, m.zone, coalesce(m.district, m.zone) as district, m.assembly, m.active,
       m.first_login_at, m.last_active_at,
       coalesce(c.tasks_done, 0) as tasks_done,
       coalesce(med.videos, 0)   as videos,
       coalesce(med.photos, 0)   as photos,
       -- Points formula: 100 per completed task + 50 per video + 20 per photo
       (coalesce(c.tasks_done, 0) * 100 + coalesce(med.videos, 0) * 50 + coalesce(med.photos, 0) * 20) as points
from members m
left join (
  select mobile, count(*) as tasks_done
  from completions group by mobile
) c on c.mobile = m.mobile
left join (
  select mobile,
         count(*) filter (where kind = 'video') as videos,
         count(*) filter (where kind = 'photo') as photos
  from media group by mobile
) med on med.mobile = m.mobile;

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
