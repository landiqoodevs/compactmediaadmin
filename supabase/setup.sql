-- =====================================================================
-- THE COMPACT MEDIA: shared backend (dashboard + public website)
-- Run ONCE in Supabase: SQL Editor > New query > paste > Run.
-- Then run the "OWNER ACCOUNT" statement at the bottom.
-- =====================================================================
create extension if not exists pgcrypto;

create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  slug text not null unique,
  client_name text, category text not null default 'Social Media',
  short_description text check (char_length(short_description) <= 400),
  full_description text,
  cover_image_url text, gallery_images text[] not null default '{}',
  video_url text, project_url text, services text[] not null default '{}',
  project_date date, featured boolean not null default false,
  display_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz);

create table public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  business_name text check (char_length(business_name) <= 120),
  rating int check (rating between 1 and 5),
  service text check (char_length(service) <= 80),
  review_text text not null check (char_length(review_text) between 10 and 2000),
  image_url text,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz);

-- Customer email is kept in an admin-only table so it can never leak through public queries.
create table public.feedback_private (
  feedback_id uuid primary key references public.customer_feedback(id) on delete cascade,
  email_private text check (char_length(email_private) <= 254));

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 1 and 100),
  business_name text, title text,
  testimonial_text text not null check (char_length(testimonial_text) between 1 and 3000),
  image_url text, rating int check (rating between 1 and 5), service text, testimonial_date date,
  featured boolean not null default false, display_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','published')),
  source_feedback_id uuid references public.customer_feedback(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz);

create index on public.projects (status, display_order);
create index on public.testimonials (status, display_order);
create index on public.customer_feedback (status, created_at desc);

create or replace function public.cm_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then new.published_at := now();
  elsif new.status <> 'published' then new.published_at := null; end if;
  return new;
end $$;
create or replace function public.cm_order() returns trigger language plpgsql as $$
begin
  if new.display_order is null or new.display_order = 0 then
    execute format('select coalesce(max(display_order),0)+1 from public.%I', tg_table_name) into new.display_order;
  end if; return new;
end $$;
create trigger p_t before insert or update on public.projects for each row execute function public.cm_touch();
create trigger t_t before insert or update on public.testimonials for each row execute function public.cm_touch();
create trigger f_t before insert or update on public.customer_feedback for each row execute function public.cm_touch();
create trigger p_o before insert on public.projects for each row execute function public.cm_order();
create trigger t_o before insert on public.testimonials for each row execute function public.cm_order();

-- ---------- row level security ----------
alter table public.admins enable row level security;
alter table public.projects enable row level security;
alter table public.testimonials enable row level security;
alter table public.customer_feedback enable row level security;
alter table public.feedback_private enable row level security;

create policy "admin reads self" on public.admins for select to authenticated using (user_id = auth.uid());
create policy "public reads published" on public.projects for select using (status = 'published');
create policy "public reads published" on public.testimonials for select using (status = 'published');
create policy "public reads published" on public.customer_feedback for select using (status = 'published');
create policy "admin all" on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.testimonials for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.customer_feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.feedback_private for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Visitors can only INSERT feedback, only as 'pending'. They cannot read it back, edit it, or publish it.
create policy "visitors submit pending" on public.customer_feedback for insert to anon, authenticated
  with check (status = 'pending' and published_at is null);
create policy "visitors submit email" on public.feedback_private for insert to anon, authenticated with check (true);

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('feedback-images', 'feedback-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = true;
create policy "admin writes media" on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());
create policy "visitors upload feedback images" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'feedback-images');
create policy "admin manages feedback images" on storage.objects for all to authenticated
  using (bucket_id = 'feedback-images' and public.is_admin()) with check (bucket_id = 'feedback-images' and public.is_admin());

-- =====================================================================
-- OWNER ACCOUNT: AFTER creating the owner in Authentication > Users > Add user
-- (tick "Auto confirm"), replace the email and run ONLY this statement:
--
--   insert into public.admins (user_id) select id from auth.users where email = 'OWNER_EMAIL_HERE';
-- =====================================================================
