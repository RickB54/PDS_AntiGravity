-- Supabase schema for Prime Detail Solutions
-- Tables and RLS policies for admin/employee secure access

-- Helper functions for role checks
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists(
    select 1 from public.app_users u where u.id = auth.uid() and u.role = 'admin'
  );
$$;

create or replace function public.is_employee()
returns boolean language sql stable as $$
  select exists(
    select 1 from public.app_users u where u.id = auth.uid() and u.role in ('employee','admin')
  );
$$;

-- App users mapping table (used by application for role checks)
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text check (role in ('admin','employee','customer')) not null default 'customer',
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean default true
);
alter table public.app_users enable row level security;
-- Allow users to view their own record; admins see all
create policy if not exists app_users_self_select on public.app_users
  for select using (auth.uid() = id or public.is_admin());
-- Admin can insert/update/delete
create policy if not exists app_users_admin_modify on public.app_users
  for all using (public.is_admin()) with check (public.is_admin());

-- Services catalog (optional, minimal)
create table if not exists public.services (
  id text primary key,
  name text not null,
  description text,
  category text,
  price_min numeric,
  price_max numeric,
  duration integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.services enable row level security;
create policy if not exists services_read on public.services for select using (public.is_employee());
create policy if not exists services_admin_write on public.services for all using (public.is_admin()) with check (public.is_admin());

-- Ensure idempotent columns for services
alter table if exists public.services
  add column if not exists is_active boolean default true,
  add column if not exists updated_at timestamptz default now();

-- Packages
create table if not exists public.packages (
  id text primary key,
  name text not null,
  description text,
  compact_price numeric,
  midsize_price numeric,
  truck_price numeric,
  luxury_price numeric,
  discount_percent numeric,
  discount_start timestamptz,
  discount_end timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.packages enable row level security;
create policy if not exists packages_read on public.packages for select using (public.is_employee());
create policy if not exists packages_admin_write on public.packages for all using (public.is_admin()) with check (public.is_admin());

-- Ensure idempotent columns for existing deployments
alter table if exists public.packages
  add column if not exists description text,
  add column if not exists compact_price numeric,
  add column if not exists midsize_price numeric,
  add column if not exists truck_price numeric,
  add column if not exists luxury_price numeric,
  add column if not exists discount_percent numeric,
  add column if not exists discount_start timestamptz,
  add column if not exists discount_end timestamptz,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Add-ons
create table if not exists public.add_ons (
  id text primary key,
  name text not null,
  description text,
  compact_price numeric,
  midsize_price numeric,
  truck_price numeric,
  luxury_price numeric,
  discount_percent numeric,
  discount_start timestamptz,
  discount_end timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.add_ons enable row level security;
create policy if not exists add_ons_read on public.add_ons for select using (public.is_employee());
create policy if not exists add_ons_admin_write on public.add_ons for all using (public.is_admin()) with check (public.is_admin());

-- Ensure idempotent columns for existing deployments
alter table if exists public.add_ons
  add column if not exists description text,
  add column if not exists compact_price numeric,
  add column if not exists midsize_price numeric,
  add column if not exists truck_price numeric,
  add column if not exists luxury_price numeric,
  add column if not exists discount_percent numeric,
  add column if not exists discount_start timestamptz,
  add column if not exists discount_end timestamptz,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Vehicle types
create table if not exists public.vehicle_types (
  id text primary key,
  name text not null,
  description text,
  size text,
  multiplier numeric default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vehicle_types enable row level security;
create policy if not exists vehicle_types_read on public.vehicle_types for select using (public.is_employee());
create policy if not exists vehicle_types_admin_write on public.vehicle_types for all using (public.is_admin()) with check (public.is_admin());

alter table if exists public.vehicle_types
  add column if not exists is_active boolean default true,
  add column if not exists updated_at timestamptz default now();

-- Bookings
create table if not exists public.bookings (
  id bigserial primary key,
  customer_name text,
  phone text,
  email text,
  vehicle_type text,
  package text,
  add_ons jsonb,
  date timestamptz,
  notes text,
  price_total numeric,
  status text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bookings enable row level security;
create policy if not exists bookings_read on public.bookings for select using (public.is_employee());
create policy if not exists bookings_create on public.bookings for insert with check (public.is_employee());
create policy if not exists bookings_admin_write on public.bookings for update using (public.is_admin()) with check (public.is_admin());
create policy if not exists bookings_admin_delete on public.bookings for delete using (public.is_admin());

alter table if exists public.bookings
  add column if not exists updated_at timestamptz default now();

-- Contact messages
create table if not exists public.contact_messages (
  id bigserial primary key,
  name text,
  email text,
  phone text,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
create policy if not exists contact_read on public.contact_messages for select using (public.is_employee());
create policy if not exists contact_create on public.contact_messages for insert with check (public.is_employee());
create policy if not exists contact_admin_modify on public.contact_messages for update using (public.is_admin()) with check (public.is_admin());
create policy if not exists contact_admin_delete on public.contact_messages for delete using (public.is_admin());

alter table if exists public.contact_messages
  add column if not exists updated_at timestamptz default now();

-- Todos
create table if not exists public.todos (
  id bigserial primary key,
  title text not null,
  status text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);
alter table public.todos enable row level security;
create policy if not exists todos_read on public.todos for select using (public.is_employee());
create policy if not exists todos_create on public.todos for insert with check (public.is_employee());
create policy if not exists todos_admin_modify on public.todos for update using (public.is_admin()) with check (public.is_admin());
create policy if not exists todos_admin_delete on public.todos for delete using (public.is_admin());

alter table if exists public.todos
  add column if not exists updated_at timestamptz default now();
alter table if exists public.todos
  add column if not exists is_active boolean default true;

-- Inventory
create table if not exists public.inventory (
  id bigserial primary key,
  item_name text not null,
  quantity integer not null default 0,
  min_required integer not null default 0,
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);
alter table public.inventory enable row level security;
create policy if not exists inventory_read on public.inventory for select using (public.is_employee());
create policy if not exists inventory_admin_write on public.inventory for all using (public.is_admin()) with check (public.is_admin());

alter table if exists public.inventory
  add column if not exists is_active boolean default true;

-- Coupons
create table if not exists public.coupons (
  code text primary key,
  type text check (type in ('percent','amount')) not null,
  value numeric not null,
  applies_to text,
  usage_limit integer,
  active boolean not null default true,
  start timestamptz,
  "end" timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
create policy if not exists coupons_read on public.coupons for select using (public.is_employee());
create policy if not exists coupons_admin_write on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- Customers
alter table if exists public.customers enable row level security;
create policy if not exists customers_read on public.customers for select using (public.is_employee());
create policy if not exists customers_admin_write on public.customers for update using (public.is_admin()) with check (public.is_admin());
create policy if not exists customers_admin_delete on public.customers for delete using (public.is_admin());

-- Invoices
alter table if exists public.invoices enable row level security;
create policy if not exists invoices_read on public.invoices for select using (public.is_employee());
create policy if not exists invoices_admin_write on public.invoices for update using (public.is_admin()) with check (public.is_admin());
create policy if not exists invoices_admin_delete on public.invoices for delete using (public.is_admin());

-- Expenses
alter table if exists public.expenses enable row level security;
create policy if not exists expenses_read on public.expenses for select using (public.is_employee());
create policy if not exists expenses_admin_write on public.expenses for update using (public.is_admin()) with check (public.is_admin());
create policy if not exists expenses_admin_delete on public.expenses for delete using (public.is_admin());

-- Usage (inventory usage log)
alter table if exists public.usage enable row level security;
create policy if not exists usage_read on public.usage for select using (public.is_employee());
create policy if not exists usage_admin_write on public.usage for update using (public.is_admin()) with check (public.is_admin());
create policy if not exists usage_admin_delete on public.usage for delete using (public.is_admin());

-- Inventory records (receipts/purchase log)
alter table if exists public.inventory_records enable row level security;
create policy if not exists inventory_records_read on public.inventory_records for select using (public.is_employee());
create policy if not exists inventory_records_admin_write on public.inventory_records for update using (public.is_admin()) with check (public.is_admin());
create policy if not exists inventory_records_admin_delete on public.inventory_records for delete using (public.is_admin());

-- Idempotent alterations for coupons
alter table if exists public.coupons
  add column if not exists type text check (type in ('percent','amount')),
  add column if not exists value numeric,
  add column if not exists applies_to text,
  add column if not exists usage_limit integer,
  add column if not exists active boolean default true,
  add column if not exists start timestamptz,
  add column if not exists "end" timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- No public access: Anon has no policies; authenticated users must have a user record
-- Ensure authenticated users have a corresponding users row before access
create or replace function public.has_user_row()
returns boolean language sql stable as $$
  select exists(select 1 from public.users u where u.id = auth.uid());
$$;

-- Example global guard: add to select policies if you want to enforce user row presence
-- (Policies above already imply employee/admin membership through role checks.)

-- Audit Log
create table if not exists public.audit_log (
  id bigserial primary key,
  action text not null,
  actor_user_id uuid references public.users(id),
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy if not exists audit_admin_read on public.audit_log for select using (public.is_admin());
create policy if not exists audit_admin_write on public.audit_log for insert with check (public.is_admin());

-- Index checks and additions (idempotent)
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='customers') then
    create index if not exists customers_created_at_idx on public.customers (created_at);
    create index if not exists customers_updated_at_idx on public.customers (updated_at);
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='bookings') then
    create index if not exists bookings_created_at_idx on public.bookings (created_at);
    create index if not exists bookings_updated_at_idx on public.bookings (updated_at);
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='invoices') then
    create index if not exists invoices_created_at_idx on public.invoices (created_at);
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='expenses') then
    create index if not exists expenses_date_idx on public.expenses (date);
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='usage') then
    create index if not exists usage_date_idx on public.usage (date);
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='inventory_records') then
    create index if not exists inventory_records_date_idx on public.inventory_records (date);
  end if;
end $$;
