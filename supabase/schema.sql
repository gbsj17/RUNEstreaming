-- Rode isto no Supabase: SQL Editor > New query > Run.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tmdb_key text,
  jellyfin jsonb,
  my_list jsonb not null default '[]',
  progress jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- Cada usuário só enxerga e altera a própria linha.
create policy "own row select" on public.user_settings for select using (auth.uid() = user_id);
create policy "own row insert" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "own row update" on public.user_settings for update using (auth.uid() = user_id);
create policy "own row delete" on public.user_settings for delete using (auth.uid() = user_id);
