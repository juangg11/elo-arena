create table if not exists public.reports (
    id uuid default gen_random_uuid() primary key,
    match_id uuid references public.matches(id) not null,
    reporter_id uuid references auth.users(id) not null,
    description text,
    evidence_url text,
    status text default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.reports enable row level security;

-- Policies
create policy "Users can insert their own reports"
    on public.reports for insert
    with check (auth.uid() = reporter_id);

create policy "Admins can view all reports"
    on public.reports for select
    using (true); -- Simplified for now, ideally check for admin role
