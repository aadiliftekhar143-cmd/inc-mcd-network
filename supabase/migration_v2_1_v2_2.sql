-- ================================================================
-- Migration v2.1 & v2.2: Block Presidents, District Coordinators, Leader Profiles,
-- Task Types, Observer Member Feedback, Coordinator Reports, Deletion Requests,
-- Member Mobile Changer, and View updates.
-- ================================================================

-- 1. Updates to data_issues
alter table data_issues drop constraint if exists data_issues_kind_check;
alter table data_issues add constraint data_issues_kind_check check (kind in ('member','observer','dp','gs','president','dc','block'));

-- 2. Updates to president_messages
alter table president_messages add column if not exists admin_tag text;

-- 3. Updates to leaders & leader profiles
alter table leaders drop constraint if exists leaders_role_check;
alter table leaders add constraint leaders_role_check check (role in ('president','gs','dc','dp','observer'));
alter table leaders add column if not exists photo_path text;
alter table leaders add column if not exists position text;
alter table leaders add column if not exists dob date;
alter table leaders add column if not exists gender text;
alter table leaders add column if not exists married boolean;
alter table leaders add column if not exists anniversary date;

create table if not exists leader_profile_requests (
  id           bigserial primary key,
  mobile       text not null references leaders(mobile) on delete cascade,
  name         text not null,
  position     text,
  dob          date,
  gender       text,
  married      boolean,
  anniversary  date,
  photo_path   text,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  text
);
create index if not exists leader_profile_requests_idx on leader_profile_requests (status, submitted_at desc);

-- 4. Updates to members (Block Presidents)
alter table members add column if not exists is_applicant boolean not null default true;
alter table members add column if not exists block_no int;
create index if not exists members_block_idx on members (block_no) where block_no is not null;

-- 5. Updates to tasks & task types
alter table tasks add column if not exists audience text not null default 'all';
alter table tasks add column if not exists type_label text;
create table if not exists task_types (
  label      text primary key,
  base       text not null check (base in ('upload','share')),
  created_at timestamptz not null default now()
);

-- 6. Updates to leader_tasks & leader_task_done
alter table leader_tasks drop constraint if exists leader_tasks_level_check;
alter table leader_tasks add constraint leader_tasks_level_check check (level in ('gs','dc','dp','observer','block','member'));
alter table leader_task_done drop constraint if exists leader_task_done_mobile_fkey;

-- 7. Updates to field_reports
alter table field_reports add column if not exists ward_no int;
alter table field_reports add column if not exists activities jsonb not null default '[]';

-- 8. Observer's monthly feedback
create table if not exists member_feedback (
  id              bigserial primary key,
  observer_mobile text not null references leaders(mobile) on delete cascade,
  member_mobile   text not null,
  month           date not null,
  flags           jsonb not null default '[]',
  note            text,
  audio_path      text,
  created_at      timestamptz not null default now(),
  unique (observer_mobile, member_mobile, month)
);
create index if not exists member_feedback_month_idx on member_feedback (month, observer_mobile);

-- 9. District Coordinator's daily report
create table if not exists coordinator_reports (
  id          bigserial primary key,
  mobile      text not null references leaders(mobile) on delete cascade,
  report_date date not null,
  calls       int not null default 0,
  talked      int not null default 0,
  note        text,
  created_at  timestamptz not null default now(),
  unique (mobile, report_date)
);

-- 10. Account deletion requests (Google Play Store compliance)
create table if not exists deletion_requests (
  id           bigserial primary key,
  mobile       text not null,
  name         text,
  reason       text,
  source       text not null default 'app',
  status       text not null default 'pending' check (status in ('pending','done','rejected')),
  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  processed_by text
);
create index if not exists deletion_requests_idx on deletion_requests (status, created_at desc);

-- 11. Announcements audience
alter table announcements add column if not exists audience text;
alter table announcements add column if not exists sent_count int;

-- 12. Profile sync trigger
create or replace function sync_member_from_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare w wards%rowtype;
begin
  select * into w from wards where ward_no = new.ward_no;
  update members m set
    name      = coalesce(nullif(trim(new.full_name), ''), m.name),
    ward_no   = coalesce(new.ward_no, m.ward_no),
    ward_name = coalesce(w.ward_name, m.ward_name),
    assembly  = coalesce(w.assembly, nullif(trim(new.assembly), ''), m.assembly),
    district  = coalesce(w.district, nullif(trim(new.district), ''), m.district),
    lok_sabha = coalesce(w.lok_sabha, nullif(trim(new.lok_sabha), ''), m.lok_sabha),
    alt_mobile = coalesce(new.alt_mobile, m.alt_mobile)
  where m.mobile = new.mobile;
  return new;
end $$;

drop trigger if exists member_profiles_sync on member_profiles;
create trigger member_profiles_sync after insert or update on member_profiles
  for each row execute function sync_member_from_profile();

do $$ begin
  if not exists (select 1 from settings where key = 'profile_sync_done') then
    update member_profiles set approved_at = approved_at;
    insert into settings (key, value) values ('profile_sync_done', 'yes');
  end if;
end $$;

-- 13. Admin change mobile function
create or replace function change_member_mobile(old_mobile text, new_mobile text) returns void
language plpgsql security definer set search_path = public as $$
declare also_leader boolean;
begin
  if not is_admin() then raise exception 'not_allowed'; end if;
  if new_mobile !~ '^[6-9][0-9]{9}$' then raise exception 'bad_mobile'; end if;
  if old_mobile = new_mobile then return; end if;
  if not exists (select 1 from members where mobile = old_mobile) then raise exception 'no_member'; end if;
  if exists (select 1 from members where mobile = new_mobile) then raise exception 'number_in_use'; end if;
  insert into members
    select (jsonb_populate_record(null::members, to_jsonb(m) || jsonb_build_object('mobile', new_mobile))).*
    from members m where m.mobile = old_mobile;
  update media            set mobile = new_mobile where mobile = old_mobile;
  update completions      set mobile = new_mobile where mobile = old_mobile;
  update message_views    set mobile = new_mobile where mobile = old_mobile;
  update share_events     set mobile = new_mobile where mobile = old_mobile;
  update profile_requests set mobile = new_mobile where mobile = old_mobile;
  update member_profiles  set mobile = new_mobile where mobile = old_mobile;
  update member_tasks     set mobile = new_mobile where mobile = old_mobile;
  update push_tokens      set mobile = new_mobile where mobile = old_mobile;
  update call_logs        set member_mobile = new_mobile where member_mobile = old_mobile;
  update member_ratings   set member_mobile = new_mobile where member_mobile = old_mobile;
  update member_feedback  set member_mobile = new_mobile where member_mobile = old_mobile;
  update president_messages set mobile = new_mobile where mobile = old_mobile and sender_role = 'member';
  select exists (select 1 from leaders where mobile = old_mobile) into also_leader;
  if not also_leader then
    update inbox set to_mobile = new_mobile where to_mobile = old_mobile;
    update leader_task_done set mobile = new_mobile where mobile = old_mobile
      and not exists (select 1 from leader_task_done d where d.task_id = leader_task_done.task_id and d.mobile = new_mobile);
  end if;
  delete from members where mobile = old_mobile;
end $$;

-- 14. Row level security on new tables
do $$
declare t text;
begin
  foreach t in array array['task_types','leader_profile_requests','member_feedback','coordinator_reports','deletion_requests']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists admin_all on %I', t);
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- 15. Update member_stats view
drop view if exists member_stats;
create view member_stats with (security_invoker = true) as
select m.mobile, m.name, m.ward_no, m.ward_name, m.zone, coalesce(m.district, m.zone) as district, m.assembly, m.active,
       m.first_login_at, m.last_active_at,
       coalesce(c.tasks_done, 0) as tasks_done,
       coalesce(med.videos, 0)   as videos,
       coalesce(med.photos, 0)   as photos,
       coalesce(sh.shares, 0)    as shares,
       (coalesce(sh.shares, 0) * 100 + coalesce(c.full_tasks, 0) * 100 + coalesce(st.approved, 0) * 100) as points,
       coalesce(c.full_tasks, 0) as full_tasks,
       coalesce(st.approved, 0) as own_tasks,
       c.last_completed_at, m.block_no, m.is_applicant
from members m
left join (
  select mobile, count(*) as tasks_done, max(completed_at) as last_completed_at,
         count(*) filter (where video_count >= 2 and photo_count >= 2) as full_tasks
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
) sh on sh.mobile = m.mobile
left join (
  select mobile, count(*) as approved from member_tasks where status = 'approved' group by mobile
) st on st.mobile = m.mobile;
