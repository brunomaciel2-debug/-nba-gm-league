-- ═══════════════════════════════════════════════════════════
-- NBA GM LEAGUE — DATABASE SCHEMA
-- Run this in Supabase SQL Editor (once, on a fresh project)
-- ═══════════════════════════════════════════════════════════

-- ── EXTENSIONS ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── TEAMS ───────────────────────────────────────────────────
create table teams (
  id          text primary key,          -- e.g. "ORL"
  name        text not null,             -- "Orlando Magic"
  conference  text not null,             -- "Eastern" | "Western"
  division    text not null,             -- "Southeast" etc.
  color       text not null,             -- hex without #
  arena       text not null,
  city        text not null,
  -- season record
  wins        int default 0,
  losses      int default 0,
  pts_for     int default 0,
  pts_against int default 0,
  -- cap
  salary_cap  int default 140588000,     -- 2025-26 cap
  cap_used    int default 0,
  created_at  timestamptz default now()
);

-- ── PLAYERS ─────────────────────────────────────────────────
create table players (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  pos         text not null,
  nationality text,
  age         int,
  team_id     text references teams(id),
  -- contract
  salary      int default 5000000,
  contract_years int default 1,
  -- status
  status      text default 'active',   -- active | injured | suspended
  injury_type text,
  games_missed int default 0,
  suspended_games_remaining int default 0, -- technical-foul suspensions still owed
  -- attributes (0-100)
  usage       int default 40,
  three       int default 50,
  layup       int default 60,
  dunk        int default 55,
  mid         int default 55,
  ft          int default 70,
  siq         int default 65,
  draw_foul   int default 55,
  blk         int default 45,
  stl         int default 45,
  idef        int default 55,
  pdef        int default 55,
  def_reb     int default 55,
  off_reb     int default 40,
  stamina     int default 75,
  durability  int default 75,
  ball_hdl    int default 55,
  pass_vis    int default 55,
  pass_iq     int default 55,
  pressure    int default 65,
  consistency int default 70,
  crowd_effect int default 55,
  streaky     int default 40,
  trash_talk  int default 30,
  assist_role int default 30,
  -- game mins (from depth chart)
  mins        int default 15,
  created_at  timestamptz default now()
);

-- ── SEASON STATS (per player, accumulated) ──────────────────
create table player_stats (
  id          uuid primary key default uuid_generate_v4(),
  player_id   uuid references players(id) on delete cascade,
  season      text default '2025-26',
  games       int default 0,
  pts         numeric(6,1) default 0,
  reb         numeric(5,1) default 0,
  ast         numeric(5,1) default 0,
  stl         numeric(5,1) default 0,
  blk         numeric(5,1) default 0,
  fgm         int default 0,
  fga         int default 0,
  tpm         int default 0,
  tpa         int default 0,
  ftm         int default 0,
  fta         int default 0,
  turnovers   int default 0,
  unique(player_id, season)
);

-- ── USERS (GMs + Commissioner) ──────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id),
  username    text unique,
  role        text default 'gm',        -- 'gm' | 'commissioner'
  team_id     text references teams(id), -- null for commissioner
  created_at  timestamptz default now()
);

-- ── GM ORDERS ───────────────────────────────────────────────
create table gm_orders (
  id          uuid primary key default uuid_generate_v4(),
  team_id     text references teams(id),
  week_number int not null,
  -- priorities
  priority_1  text,
  priority_2  text,
  priority_3  text,
  clutch_player text,
  -- tactics
  pace        int default 70,
  three_rate  int default 40,
  atk_style   text default 'motion',
  def_style   text default 'man',
  -- depth chart (JSON)
  depth_chart jsonb,
  locked      boolean default false,    -- locked after deadline
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(team_id, week_number)
);

-- ── GAMES ───────────────────────────────────────────────────
create table games (
  id          uuid primary key default uuid_generate_v4(),
  week_number int not null,
  game_number int not null,             -- 1-4 within week
  home_team   text references teams(id),
  away_team   text references teams(id),
  home_score  int,
  away_score  int,
  status      text default 'scheduled', -- scheduled | final
  played_at   timestamptz,
  created_at  timestamptz default now()
);

-- ── BOX SCORES ──────────────────────────────────────────────
create table box_scores (
  id          uuid primary key default uuid_generate_v4(),
  game_id     uuid references games(id) on delete cascade,
  player_id   uuid references players(id),
  team_id     text references teams(id),
  mins        int default 0,
  pts         int default 0,
  reb         int default 0,
  ast         int default 0,
  stl         int default 0,
  blk         int default 0,
  fgm         int default 0,
  fga         int default 0,
  tpm         int default 0,
  tpa         int default 0,
  ftm         int default 0,
  fta         int default 0,
  turnovers   int default 0,
  plus_minus  int default 0
);

-- ── PLAY BY PLAY ────────────────────────────────────────────
create table play_by_play (
  id          uuid primary key default uuid_generate_v4(),
  game_id     uuid references games(id) on delete cascade,
  quarter     int not null,
  time_left   text not null,            -- "4:32"
  team_id     text,
  event_type  text,                     -- score | foul | turnover | timeout | etc.
  description text not null,
  home_score  int default 0,
  away_score  int default 0,
  created_at  timestamptz default now()
);

-- ── TRANSACTIONS ────────────────────────────────────────────
create table transactions (
  id          uuid primary key default uuid_generate_v4(),
  type        text not null,            -- trade | signing | waiver | injury | suspension
  description text not null,
  teams       text[],                   -- teams involved
  players     text[],                   -- player names involved
  details     jsonb,                    -- full trade details
  status      text default 'completed', -- pending | approved | rejected | completed
  initiated_by uuid references profiles(id),
  approved_by  uuid references profiles(id),
  created_at  timestamptz default now()
);

-- ── NEWS ARTICLES (Commissioner) ────────────────────────────
create table articles (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  slug        text unique not null,
  content     text not null,            -- HTML/Markdown
  excerpt     text,
  cover_image text,                     -- URL
  tags        text[],
  published   boolean default false,
  author_id   uuid references profiles(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── INJURIES ────────────────────────────────────────────────
create table injuries (
  id          uuid primary key default uuid_generate_v4(),
  player_id   uuid references players(id),
  injury_type text not null,
  games_out   int default 0,
  games_remaining int default 0,
  occurred_game uuid references games(id),
  created_at  timestamptz default now()
);

-- ── SEASON CONFIG ───────────────────────────────────────────
create table season_config (
  id          int primary key default 1,
  season      text default '2025-26',
  current_week int default 0,
  total_weeks  int default 26,          -- ~26 weeks = 82 game season
  sim_day_1   text default 'Monday',
  sim_day_2   text default 'Thursday',
  sim_time    text default '00:00',
  timezone    text default 'Europe/Lisbon',
  orders_deadline text default 'Sunday 23:59',
  status      text default 'pre-season' -- pre-season | active | playoffs | off-season
);
insert into season_config(id) values(1) on conflict do nothing;

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════
alter table teams          enable row level security;
alter table players        enable row level security;
alter table player_stats   enable row level security;
alter table profiles       enable row level security;
alter table gm_orders      enable row level security;
alter table games          enable row level security;
alter table box_scores     enable row level security;
alter table play_by_play   enable row level security;
alter table transactions   enable row level security;
alter table articles       enable row level security;
alter table injuries       enable row level security;
alter table season_config  enable row level security;

-- Public read for most tables
create policy "Public read teams"         on teams          for select using (true);
create policy "Public read players"       on players        for select using (true);
create policy "Public read stats"         on player_stats   for select using (true);
create policy "Public read games"         on games          for select using (true);
create policy "Public read box scores"    on box_scores     for select using (true);
create policy "Public read pbp"           on play_by_play   for select using (true);
create policy "Public read transactions"  on transactions   for select using (true);
create policy "Public read articles"      on articles       for select using (published = true);
create policy "Public read standings"     on teams          for select using (true);
create policy "Public read injuries"      on injuries       for select using (true);
create policy "Public read season"        on season_config  for select using (true);

-- GMs can only edit their own team orders
create policy "GMs manage own orders" on gm_orders
  for all using (
    auth.uid() in (
      select id from profiles where team_id = gm_orders.team_id
    )
  );

-- Commissioner can do everything
create policy "Commissioner full access articles" on articles
  for all using (
    auth.uid() in (select id from profiles where role = 'commissioner')
  );
create policy "Commissioner manages transactions" on transactions
  for all using (
    auth.uid() in (select id from profiles where role = 'commissioner')
    or initiated_by = auth.uid()
  );
create policy "Commissioner manages players" on players
  for update using (
    auth.uid() in (select id from profiles where role = 'commissioner')
  );

-- Profiles: users see own profile, commissioner sees all
create policy "Users read own profile" on profiles
  for select using (auth.uid() = id);
create policy "Commissioner reads all profiles" on profiles
  for select using (
    auth.uid() in (select id from profiles where role = 'commissioner')
  );
create policy "Users update own profile" on profiles
  for update using (auth.uid() = id);

-- Service role bypasses RLS (used by cron/simulation)
