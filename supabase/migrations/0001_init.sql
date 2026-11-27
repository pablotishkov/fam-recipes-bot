-- ============================================================
-- FamReceipts — схема БД (Supabase / PostgreSQL)
-- Применить в SQL-редакторе Supabase → SQL Editor.
-- ============================================================

-- ---------- База продуктов с КБЖУ на 100 г ----------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  calories      numeric not null default 0,
  protein       numeric not null default 0,
  fat           numeric not null default 0,
  carbs         numeric not null default 0,
  grams_per_unit jsonb,          -- {"шт": 120, "банка": 400, ...}
  created_at    timestamptz not null default now()
);

-- ---------- Семьи ----------
create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Моя семья',
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------- Профили пользователей ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  telegram_id bigint unique,
  name        text,
  family_id   uuid references public.families (id),
  created_at  timestamptz not null default now()
);

-- ---------- Рецепты ----------
create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  photo_url   text,
  family_id   uuid references public.families (id),
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Ингредиенты ----------
create table if not exists public.ingredients (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid not null references public.recipes (id) on delete cascade,
  product_id   uuid references public.products (id),
  product_name text not null,
  amount       numeric not null,
  unit         text not null,
  position     int not null default 0
);

create index if not exists idx_recipes_family   on public.recipes (family_id);
create index if not exists idx_ingredients_recipe on public.ingredients (recipe_id);
create index if not exists idx_profiles_family  on public.profiles (family_id);

-- ---------- Шаги приготовления ----------
create table if not exists public.steps (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  position   int not null default 0,
  text       text not null,
  photo_url  text
);

create index if not exists idx_steps_recipe on public.steps (recipe_id);

-- ============================================================
-- Row Level Security
-- Все рецепты семьи общие; у всех членов полный доступ.
-- ============================================================
alter table public.products    enable row level security;
alter table public.families    enable row level security;
alter table public.profiles    enable row level security;
alter table public.recipes     enable row level security;
alter table public.ingredients enable row level security;
alter table public.steps       enable row level security;

-- Вспомогательная функция: состоит ли пользователь в семье семейного рецепта.
create or replace function public.is_family_member(recipe_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.recipes r
    join public.profiles me on me.id = auth.uid() and me.family_id = r.family_id
    where r.id = recipe_id
  );
$$;

-- Продукты: база общая, все читают и добавляют.
create policy "products_read"  on public.products for select using (true);
create policy "products_insert" on public.products for insert with check (true);

-- Семьи: участники читают, код-приглашение виден только своей семье.
create policy "families_read" on public.families for select
  using (id in (select family_id from public.profiles where id = auth.uid()));

-- Профили: читают все (для имён), пишет только свой.
create policy "profiles_read" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert
  with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid());

-- Рецепты: члены семьи видят, создают, правят, удаляют.
create policy "recipes_read" on public.recipes for select
  using (public.is_family_member(id));
create policy "recipes_insert" on public.recipes for insert
  with check (
    family_id in (select family_id from public.profiles where id = auth.uid())
  );
create policy "recipes_update" on public.recipes for update
  using (public.is_family_member(id));
create policy "recipes_delete" on public.recipes for delete
  using (public.is_family_member(id));

-- Ингредиенты: через родительский рецепт.
create policy "ingredients_read" on public.ingredients for select
  using (public.is_family_member(recipe_id));
create policy "ingredients_insert" on public.ingredients for insert
  with check (public.is_family_member(recipe_id));
create policy "ingredients_update" on public.ingredients for update
  using (public.is_family_member(recipe_id));
create policy "ingredients_delete" on public.ingredients for delete
  using (public.is_family_member(recipe_id));

-- Шаги: через родительский рецепт.
create policy "steps_read" on public.steps for select
  using (public.is_family_member(recipe_id));
create policy "steps_insert" on public.steps for insert
  with check (public.is_family_member(recipe_id));
create policy "steps_update" on public.steps for update
  using (public.is_family_member(recipe_id));
create policy "steps_delete" on public.steps for delete
  using (public.is_family_member(recipe_id));

-- ============================================================
-- Права на таблицы/последовательности/функции для ролей API.
-- Таблицы созданы через миграцию, а не через дашборд, поэтому
-- Supabase не выдал гранты автоматически (если «Grant API access»
-- выключен). Выдаём явно. Безопасность на уровне строк
-- обеспечивает RLS-политики выше.
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- ============================================================
-- Триггер авто-обновления updated_at у рецептов
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch
  before update on public.recipes
  for each row execute function public.touch_updated_at();