-- ============================================================
-- Миграция 20261128155108: save_recipe — запись рецепта через RPC
-- Дата создания/применения: 2026-11-28 15:51
--
-- Применять вручную в SQL-редакторе Supabase (как отдельную миграцию).
--
-- Зачем: пер-рядные RLS-политики на recipes_insert могли отклонять вставку
-- даже при авторизованной сессии и совпадающем family_id. Эта функция
-- атомарно пишет рецепт + ингредиенты + шаги и сама проверяет членство
-- в семье, обходя хрупкие `with check`-политики.
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