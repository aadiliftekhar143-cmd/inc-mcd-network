-- Migration for v2.3 on top of v2.2. Safe to run more than once.
-- It is the same block that sits in schema.sql; running the whole schema.sql does the same job
-- (and also refreshes the member_stats view and the row-level security loop, which this file repeats below).

-- ================================================================ v2.3: one task funnel, more task types, no location
-- Daily tasks can now also be a checklist ('choice': tick the listed items and submit) or a written/spoken reply ('text').
alter table tasks drop constraint if exists tasks_kind_check;
alter table tasks add constraint tasks_kind_check check (kind in ('upload','share','choice','text'));
alter table tasks add column if not exists options jsonb not null default '[]';       -- the lines to tick, for kind 'choice'
alter table tasks add column if not exists audio_path text;                           -- voice note with the task
alter table tasks add column if not exists from_president boolean not null default false;  -- came through the leaders' side
alter table tasks add column if not exists target_district text;                      -- null = every district
alter table tasks add column if not exists target_assembly text;
alter table tasks add column if not exists until_date date;                           -- stays on the list until this day if not done
alter table tasks add column if not exists created_by text;                           -- admin | president | gs | dp | observer
alter table task_types drop constraint if exists task_types_base_check;
alter table task_types add constraint task_types_base_check check (base in ('upload','share','choice','text'));
-- What a ward member or Block President sent for a 'choice' or 'text' task. Sending it completes the task (100 points).
create table if not exists task_responses (
  task_id    bigint not null references tasks(id) on delete cascade,
  mobile     text not null references members(mobile) on delete cascade,
  choices    jsonb not null default '[]',
  note       text,
  audio_path text,
  created_at timestamptz not null default now(),
  primary key (task_id, mobile)
);
-- Leader tasks for ward members and Block Presidents move into the daily tasks once sent or approved.
alter table leader_tasks drop constraint if exists leader_tasks_status_check;
alter table leader_tasks add constraint leader_tasks_status_check check (status in ('active','pending','suggested','rejected','moved'));
-- A leader finishes a task with a remark (and a voice note if they like), not a bare tick.
alter table leader_task_done add column if not exists note text;
alter table leader_task_done add column if not exists audio_path text;
-- Location is no longer collected anywhere. Old values are removed with the columns.
alter table field_reports drop column if exists lat;
alter table field_reports drop column if exists lng;

alter table task_responses enable row level security;
drop policy if exists admin_all on task_responses;
create policy admin_all on task_responses for all to authenticated using (is_admin()) with check (is_admin());

-- member_stats counts a sent reply as a full task.
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
  -- A full task: 2 photos + 2 videos for an upload task, or the reply sent for a checklist or written task.
  select cc.mobile, count(*) as tasks_done, max(cc.completed_at) as last_completed_at,
         count(*) filter (where (cc.video_count >= 2 and cc.photo_count >= 2) or t.kind in ('choice','text')) as full_tasks
  from completions cc join tasks t on t.id = cc.task_id group by cc.mobile
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

-- Settings update for v2.3
update settings set value = '2.3' where key = 'app_version_name';
update settings set value = '14' where key = 'app_version_code';
update settings set value = 'INC MCD NETWORK v2.3: चेकलिस्ट और लिखित उत्तर वाले नए टास्क, एकीकृत टास्क फ़नल, लीडर टास्क प्रगति काउंट, और प्ले स्टोर अनुरूपता।' where key = 'app_update_notes';
