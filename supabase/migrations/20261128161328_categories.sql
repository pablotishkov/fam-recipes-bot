-- ============================================================
-- Миграция 20261128161328: категории рецептов
-- Дата создания/применения: 2026-11-28 16:13
--
-- Применять вручную в SQL-редакторе Supabase (как отдельную миграцию).
-- Зависит от функции save_recipe (миграция 20261128155108).
--
-- Добавляет:
-- 1) таблицу categories (семейная, по одной категории на рецепт);
-- 2) колонку recipes.category_id;
-- 3) RPC save_category / delete_category (security definer);
-- 4) расширенную версию save_recipe с параметром p_category_id.
-- ============================================================

-- ---------- Таблица категорий ----------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ---------- Категория у рецепта ----------
alter table public.recipes
  add column if not exists category_id uuid references public.categories (id);

-- ---------- RLS на categories (на всякий случай; основная защита — RPC) ----------
alter table public.categories enable row level security;
create policy "categories_read" on public.categories
  for select using (public.is_family_member(id));
create policy "categories_write" on public.categories
  for all using (public.is_family_member(id)) with check (public.is_family_member(id));

-- ---------- save_category: создание/переименование категории ----------
create or replace function public.save_category(
  p_id uuid,
  p_family_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null
     or not exists (select 1 from public.profiles where id = v_me and family_id = p_family_id) then
    raise exception 'Нет доступа к этой семье';
  end if;

  insert into public.categories (id, family_id, name)
  values (p_id, p_family_id, p_name)
  on conflict (id) do update
    set name = excluded.name;
end;
$$;

revoke all on function public.save_category from public;
grant execute on function public.save_category to authenticated;

-- ---------- delete_category: удаление + перевод рецептов в «Общие» ----------
create or replace function public.delete_category(
  p_id uuid,
  p_family_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null
     or not exists (select 1 from public.profiles where id = v_me and family_id = p_family_id) then
    raise exception 'Нет доступа к этой семье';
  end if;

  update public.recipes set category_id = null where category_id = p_id;
  delete from public.categories where id = p_id and family_id = p_family_id;
end;
$$;

revoke all on function public.delete_category from public;
grant execute on function public.delete_category to authenticated;

-- ---------- save_recipe: добавлен параметр категории ----------
-- Убираем прежнюю перегрузку save_recipe (без категории). create or replace
-- не может менять список аргументов — без drop создалась бы вторая функция
-- с тем же именем и ошибка 42725 "function is not unique".
drop function if exists public.save_recipe;

create or replace function public.save_recipe(
  p_id uuid,
  p_family_id uuid,
  p_created_by uuid,
  p_title text,
  p_description text,
  p_photo_url text,
  p_category_id uuid,
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
  if v_me is null
     or not exists (
        select 1 from public.profiles
        where id = v_me and family_id = p_family_id
     ) then
    raise exception 'Нет доступа к этой семье';
  end if;

  insert into public.recipes (id, title, description, photo_url, category_id, family_id, created_by, created_at, updated_at)
  values (p_id, p_title, p_description, p_photo_url, p_category_id, p_family_id, p_created_by, p_created_at, p_updated_at)
  on conflict (id) do update
    set title        = excluded.title,
        description  = excluded.description,
        photo_url    = excluded.photo_url,
        category_id  = excluded.category_id,
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