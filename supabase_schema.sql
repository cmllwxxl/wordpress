-- Create sites table
create table sites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  url text not null,
  username text,
  app_password text,
  status text default 'unknown',
  last_checked timestamp with time zone,
  wp_version text,
  post_count integer default 0,
  comment_count integer default 0,
  user_id uuid default auth.uid(),
  order_index integer default 0,
  tags text[] default '{}',
  type text default 'wordpress'
);

-- Enable RLS
alter table sites enable row level security;

-- Create policies
create policy "Users can view their own sites"
  on sites for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sites"
  on sites for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sites"
  on sites for update
  using (auth.uid() = user_id);

create policy "Users can delete their own sites"
  on sites for delete
  using (auth.uid() = user_id);

-- Create settings table (optional, for syncing settings)
create table settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() unique,
  webhook_url text,
  enable_notifications boolean default false,
  notify_email text,
  enable_email_notification boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table settings enable row level security;

create policy "Users can view their own settings"
  on settings for select
  using (auth.uid() = user_id);

create policy "Users can insert/update their own settings"
  on settings for all
  using (auth.uid() = user_id);

-- Create posts_cache table
create table posts_cache (
  site_id uuid primary key references sites(id) on delete cascade,
  user_id uuid default auth.uid(),
  posts jsonb default '[]'::jsonb,
  counts jsonb default '{}'::jsonb,
  last_sync bigint,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table posts_cache enable row level security;

create policy "Users can view their own posts cache"
  on posts_cache for select
  using (auth.uid() = user_id);

create policy "Users can insert/update their own posts cache"
  on posts_cache for all
  using (auth.uid() = user_id);

-- Create search_queries table
create table search_queries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid default auth.uid(),
  site_id uuid references sites(id) on delete cascade,
  source text not null,
  query text not null,
  impressions integer default 0,
  clicks integer default 0,
  ctr float8,
  position float8,
  last_seen date default current_date,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table search_queries enable row level security;

create unique index uq_search_queries on search_queries (user_id, site_id, source, query);

create policy "Users can view their own search queries"
  on search_queries for select
  using (auth.uid() = user_id);

create policy "Users can insert/update their own search queries"
  on search_queries for all
  using (auth.uid() = user_id);

-- Create webmaster_cache table
create table webmaster_cache (
  site_id uuid primary key references sites(id) on delete cascade,
  user_id uuid default auth.uid(),
  overview_data jsonb default '{}'::jsonb,
  detail_data jsonb default '{}'::jsonb,
  last_sync bigint,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table webmaster_cache enable row level security;

create policy "Users can view their own webmaster cache"
  on webmaster_cache for select
  using (auth.uid() = user_id);

create policy "Users can insert/update their own webmaster cache"
  on webmaster_cache for all
  using (auth.uid() = user_id);
