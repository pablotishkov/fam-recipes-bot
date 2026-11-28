-- ============================================================
-- FamReceipts — семейная база продуктов (2026-11-28)
--
-- Продукты становятся семейными: у каждой семьи свой набор
-- (включая стандартные продукты). Раньше products была глобальной
-- (name уникален, RLS открыт), поэтому правки одного члена семьи
-- меняли данные для всех.
--
-- Меняем:
--  1. добавляем family_id в products;
--  2. уникальность name — теперь в рамках семьи (family_id, name);
--  3. RLS-политики продуктов — по принадлежности к семье;
--  4. функция seed_default_products(p_family_id) — одноразовый сид
--     стандартного набора для конкретной семьи.
--
-- Применять по порядку. Идемпотентно.
-- ============================================================

-- ---------- 1. Колонка family_id ----------
alter table public.products
  add column if not exists family_id uuid references public.families (id);

create index if not exists idx_products_family on public.products (family_id);

-- Убираем глобальную уникальность name, заменяем на уникальность в семье.
alter table public.products drop constraint if exists products_name_key;
alter table public.products
  add constraint products_family_name_key unique (family_id, name);

-- ---------- 2. RLS: продукты по семье ----------
drop policy if exists products_read   on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;

create policy "products_read" on public.products for select
  using (family_id in (select family_id from public.profiles where id = auth.uid()));

create policy "products_insert" on public.products for insert
  with check (family_id in (select family_id from public.profiles where id = auth.uid()));

create policy "products_update" on public.products for update
  using (family_id in (select family_id from public.profiles where id = auth.uid()));

create policy "products_delete" on public.products for delete
  using (family_id in (select family_id from public.profiles where id = auth.uid()));

-- ---------- 3. Сид стандартного набора для семьи ----------
-- Вставляет стандартные продукты, если их ещё нет (по family_id + name).
-- Вызывается из edge function при создании семьи и вручную для
-- существующих семей. После сида семья свободно правит свой набор.
create or replace function public.seed_default_products(p_family_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.products (id, family_id, name, calories, protein, fat, carbs, grams_per_unit)
  values
    (gen_random_uuid(), p_family_id, 'Мука пшеничная', 334, 10.3, 1.1, 69, null),
    (gen_random_uuid(), p_family_id, 'Сахар', 398, 0, 0, 99.8, null),
    (gen_random_uuid(), p_family_id, 'Масло сливочное', 748, 0.8, 82.5, 0.8, '{"ст. ложка":20,"ч. ложка":7,"стакан":200}'::jsonb),
    (gen_random_uuid(), p_family_id, 'Масло подсолнечное', 899, 0, 99.9, 0, '{"ст. ложка":17,"ч. ложка":5,"стакан":210}'::jsonb),
    (gen_random_uuid(), p_family_id, 'Яйцо куриное', 157, 12.7, 11.5, 0.7, '{"шт":55}'::jsonb),
    (gen_random_uuid(), p_family_id, 'Молоко 2,5%', 54, 2.9, 2.5, 4.8, null),
    (gen_random_uuid(), p_family_id, 'Сливки 20%', 209, 2.5, 20, 4.2, null),
    (gen_random_uuid(), p_family_id, 'Творог 5%', 121, 17, 5, 1.8, null),
    (gen_random_uuid(), p_family_id, 'Сыр твёрдый', 352, 24.1, 29.5, 0.3, null),
    (gen_random_uuid(), p_family_id, 'Куриное филе', 165, 31, 3.6, 0, null),
    (gen_random_uuid(), p_family_id, 'Говядина', 187, 19, 12.4, 0, null),
    (gen_random_uuid(), p_family_id, 'Свинина', 259, 16, 21.6, 0, null),
    (gen_random_uuid(), p_family_id, 'Лосось', 142, 19.8, 6.3, 0, null),
    (gen_random_uuid(), p_family_id, 'Картофель', 77, 2, 0.4, 16.3, null),
    (gen_random_uuid(), p_family_id, 'Рис белый', 344, 6.7, 0.7, 78.9, null),
    (gen_random_uuid(), p_family_id, 'Гречка', 313, 12.6, 3.3, 62.1, null),
    (gen_random_uuid(), p_family_id, 'Овсяные хлопья', 352, 12.3, 6.1, 59.5, null),
    (gen_random_uuid(), p_family_id, 'Макароны', 352, 13, 1.5, 70.5, null),
    (gen_random_uuid(), p_family_id, 'Хлеб', 265, 8, 3, 50, null),
    (gen_random_uuid(), p_family_id, 'Баклажан', 24, 1, 0.1, 5.7, null),
    (gen_random_uuid(), p_family_id, 'Помидор', 18, 0.9, 0.2, 3.9, null),
    (gen_random_uuid(), p_family_id, 'Огурец', 15, 0.8, 0.1, 2.8, null),
    (gen_random_uuid(), p_family_id, 'Лук репчатый', 40, 1.1, 0.2, 8.2, null),
    (gen_random_uuid(), p_family_id, 'Чеснок', 149, 6.4, 0.5, 33, null),
    (gen_random_uuid(), p_family_id, 'Морковь', 33, 1.3, 0.1, 6.9, null),
    (gen_random_uuid(), p_family_id, 'Оливки', 115, 0.8, 10.7, 6.3, null),
    (gen_random_uuid(), p_family_id, 'Сметана 15%', 162, 2.6, 15, 3.6, null),
    (gen_random_uuid(), p_family_id, 'Мёд', 329, 0.8, 0, 81.5, '{"ст. ложка":30,"ч. ложка":10,"стакан":330}'::jsonb),
    (gen_random_uuid(), p_family_id, 'Мука рисовая', 366, 5.8, 1.4, 80, null),
    (gen_random_uuid(), p_family_id, 'Какао-порошок', 374, 24, 17.5, 28.8, null),
    (gen_random_uuid(), p_family_id, 'Шоколад тёмный', 539, 6.2, 35.4, 48.2, null),
    (gen_random_uuid(), p_family_id, 'Яблоко', 47, 0.4, 0.4, 9.8, null),
    (gen_random_uuid(), p_family_id, 'Банан', 89, 1.1, 0.3, 22.8, null),
    (gen_random_uuid(), p_family_id, 'Малина', 52, 1.2, 0.7, 11.9, null),
    (gen_random_uuid(), p_family_id, 'Шампиньоны', 27, 4.3, 1, 0.1, null),
    (gen_random_uuid(), p_family_id, 'Томатная паста', 82, 4.8, 0.5, 14, null),
    (gen_random_uuid(), p_family_id, 'Соль', 0, 0, 0, 0, null),
    (gen_random_uuid(), p_family_id, 'Перец чёрный', 251, 10, 3.3, 64, null),
    (gen_random_uuid(), p_family_id, 'Дрожжи сухие', 325, 49, 6, 41, null)
  on conflict (family_id, name) do nothing;
end $$;