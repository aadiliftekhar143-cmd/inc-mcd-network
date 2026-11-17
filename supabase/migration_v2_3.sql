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

-- member_stats counts a sent reply as a full task. Easiest way to refresh the view: run schema.sql once after this file.
