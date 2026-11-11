-- Shared circles, loans, and jar votes. User ids match Better Auth's text ids.
-- Amounts are integer cents. Provider-confirmed money cannot be inserted:
-- contribution and repayment sources are constrained, and withdrawal checks
-- cannot record funds_moved = true.

create table if not exists circles (
  id text primary key,
  name text not null,
  created_by text not null references "user" (id),
  created_at timestamptz not null default now()
);

create table if not exists circle_members (
  circle_id text not null references circles (id) on delete cascade,
  user_id text not null references "user" (id),
  status text not null check (status in ('active', 'inactive')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create index if not exists circle_members_user_idx on circle_members (user_id);

create table if not exists loans (
  id text primary key,
  circle_id text not null references circles (id) on delete cascade,
  lender_id text not null references "user" (id),
  borrower_id text not null references "user" (id),
  principal_cents integer not null check (principal_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  opened_at timestamptz not null default now(),
  due_on text,
  note text not null default '',
  voided_at timestamptz,
  check (lender_id <> borrower_id)
);

create table if not exists repayments (
  id text primary key,
  loan_id text not null references loans (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  recorded_at timestamptz not null default now(),
  note text not null default '',
  source text not null default 'manual' check (source = 'manual'),
  recorded_by text not null references "user" (id)
);

create table if not exists jars (
  id text primary key,
  circle_id text not null references circles (id) on delete cascade,
  name text not null,
  goal_cents integer not null check (goal_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  custody text not null default 'undecided' check (custody = 'undecided'),
  created_at timestamptz not null default now()
);

create table if not exists jar_members (
  jar_id text not null references jars (id) on delete cascade,
  user_id text not null references "user" (id),
  status text not null check (status in ('active', 'inactive')),
  joined_at timestamptz not null default now(),
  primary key (jar_id, user_id)
);

create table if not exists contributions (
  id text primary key,
  jar_id text not null references jars (id) on delete cascade,
  user_id text not null references "user" (id),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  recorded_at timestamptz not null default now(),
  note text not null default '',
  source text not null default 'recorded' check (source = 'recorded')
);

create table if not exists withdrawals (
  id text primary key,
  jar_id text not null references jars (id) on delete cascade,
  requester_id text not null references "user" (id),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  destination_user_id text not null references "user" (id),
  purpose text not null,
  revision integer not null default 1 check (revision > 0),
  closed text check (closed in ('rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists withdrawal_votes (
  withdrawal_id text not null references withdrawals (id) on delete cascade,
  user_id text not null references "user" (id),
  revision integer not null,
  binding text not null,
  decision text not null check (decision in ('approve', 'reject')),
  voted_at timestamptz not null default now(),
  primary key (withdrawal_id, user_id, revision)
);

create table if not exists withdrawal_checks (
  withdrawal_id text not null references withdrawals (id) on delete cascade,
  idempotency_key text not null,
  checked_at timestamptz not null default now(),
  funds_moved boolean not null default false check (funds_moved = false),
  policy_approved boolean not null,
  reasons text not null,
  primary key (withdrawal_id, idempotency_key)
);

create table if not exists audit_events (
  id text primary key,
  circle_id text,
  jar_id text,
  actor_id text,
  at timestamptz not null default now(),
  kind text not null,
  summary text not null
);
