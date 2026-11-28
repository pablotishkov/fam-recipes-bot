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

-- Продукты: база общая, все читают, добавляют и правят (upsert по имени).
create policy "products_read"   on public.products for select using (true);
create policy "products_insert" on public.products for insert with check (true);
create policy "products_update" on public.products for update using (true);

-- Семьи: участники читают, код-приглашение виден только своей семье.
create policy "families_read" on public.families for select
  using (id in (select family_id from public.profiles where id = auth.uid()));

-- Семьи: участники могут переименовать свою семью.
create policy "families_update" on public.families for update
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

-- ============================================================
-- Запись рецепта через RPC (security definer)
-- Фронтенд вызывает save_recipe, а не вставляет в recipes/ingredients/
-- steps напрямую. Функция атомарно пишет рецепт + ингредиенты + шаги и
-- сама проверяет членство в семье. Это надёжнее пер-рядных RLS-политик с
-- `with check` на recipes_insert, которые могут отклонять вставку даже при
-- совпадающем family_id.
-- ============================================================
create or replace function public.save_recipe(
  p_id uuid,
  p_family_id uuid,
  p_created_by uuid,
  p_title text,
  p_description text,
  p_photo_url text,
  p_created_at timestamptz,
  p_updated_at timestamptz,
  p_ingredients jsonb,
  p_steps jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  -- Разрешаем только члену семьи писать рецепты в свою семью.
  if v_me is null
     or not exists (
        select 1 from public.profiles
        where id = v_me and family_id = p_family_id
     ) then
    raise exception 'Нет доступа к этой семье';
  end if;

  insert into public.recipes (id, title, description, photo_url, family_id, created_by, created_at, updated_at)
  values (p_id, p_title, p_description, p_photo_url, p_family_id, p_created_by, p_created_at, p_updated_at)
  on conflict (id) do update
    set title        = excluded.title,
        description  = excluded.description,
        photo_url    = excluded.photo_url,
        family_id    = excluded.family_id,
        created_by   = excluded.created_by,
        updated_at   = excluded.updated_at;

  delete from public.ingredients where recipe_id = p_id;
  delete from public.steps where recipe_id = p_id;

  insert into public.ingredients (recipe_id, product_id, product_name, amount, unit, position)
  select p_id,
         (e->>'product_id')::uuid,
         e->>'product_name',
         (e->>'amount')::numeric,
         e->>'unit',
         (e->>'position')::int
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) e;

  insert into public.steps (recipe_id, position, text, photo_url)
  select p_id, (e->>'position')::int, e->>'text', e->>'photo_url'
  from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) e;
end;
$$;

revoke all on function public.save_recipe from public;
grant execute on function public.save_recipe to authenticated;

-- ============================================================
-- Realtime
-- Фронтенд подписывается на изменения рецептов и продуктов, чтобы
-- правки других членов семьи подтягивались вживую. Realtime уважает RLS,
-- поэтому канал по рецептам отдаёт только данные своей семьи.
-- ============================================================
alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.ingredients;
alter publication supabase_realtime add table public.steps;
alter publication supabase_realtime add table public.products;