-- ROBOREALM cloud persistence (Phase 2 extension point — not used by the current local-first build).
-- Minimal data, row-level security everywhere, educator access only through explicit cohort membership.

create type app_role as enum ('student', 'educator', 'admin');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role app_role not null default 'student',
  nickname text not null check (char_length(nickname) between 2 and 20),
  age_band text not null check (age_band in ('13-15', '16-17', '18-24')),
  guardian_consent_at timestamptz,          -- required where applicable before a minor's account is activated
  avatar jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table saves (
  user_id uuid primary key references profiles(id) on delete cascade,
  state jsonb not null,                      -- the SaveState blob (version 1)
  updated_at timestamptz not null default now()
);

create table attempts (
  id text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  mission_id text not null,
  mode text not null check (mode in ('test', 'submit')),
  passed boolean not null,
  score int,
  hints_used int not null default 0,
  code text not null,
  report jsonb,
  created_at timestamptz not null default now()
);

create table evidence (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  skill_id text not null,
  mission_id text not null,
  kind text not null,
  score int not null,
  attempt_id text references attempts(id),
  created_at timestamptz not null default now()
);

create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id),
  join_code text unique not null
);

create table cohort_members (
  cohort_id uuid references cohorts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  member_role app_role not null,
  primary key (cohort_id, user_id)
);

alter table profiles enable row level security;
alter table saves enable row level security;
alter table attempts enable row level security;
alter table evidence enable row level security;
alter table cohorts enable row level security;
alter table cohort_members enable row level security;

-- Students see and edit only their own data.
create policy own_profile on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy own_save on saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_attempts on attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Evidence is written by a trusted server function that re-grades submissions, never directly by clients.
create policy read_own_evidence on evidence for select using (user_id = auth.uid());

-- Educators can read attempts/evidence of students in cohorts they own.
create policy educator_read_attempts on attempts for select using (
  exists (select 1 from cohort_members m join cohorts c on c.id = m.cohort_id
          where m.user_id = attempts.user_id and c.owner_id = auth.uid())
);
create policy educator_read_evidence on evidence for select using (
  exists (select 1 from cohort_members m join cohorts c on c.id = m.cohort_id
          where m.user_id = evidence.user_id and c.owner_id = auth.uid())
);
create policy own_cohorts on cohorts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy see_membership on cohort_members for select using (
  user_id = auth.uid() or exists (select 1 from cohorts c where c.id = cohort_id and c.owner_id = auth.uid())
);
