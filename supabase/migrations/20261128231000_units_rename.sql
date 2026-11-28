-- Единицы измерения: микроложка удалена, ложки сокращены (ст. л. / ч. л.).
-- Приводим уже сохранённые значения в БД к новому набору (идемпотентно).

-- Ингредиенты: единица хранится текстом.
update public.ingredients set unit = 'ст. л.' where unit = 'ст. ложка';
update public.ingredients set unit = 'ч. л.'   where unit = 'ч. ложка';
update public.ingredients set unit = 'ч. л.'   where unit = 'микроложка';

-- Продукты: grams_per_unit — jsonb-ключи единиц.
update public.products
set grams_per_unit =
      (grams_per_unit - 'ст. ложка') || jsonb_build_object('ст. л.', grams_per_unit -> 'ст. ложка')
where grams_per_unit ? 'ст. ложка';

update public.products
set grams_per_unit =
      (grams_per_unit - 'ч. ложка') || jsonb_build_object('ч. л.', grams_per_unit -> 'ч. ложка')
where grams_per_unit ? 'ч. ложка';

-- микроложка удалена: если ч. л. уже есть — просто убираем, иначе переносим её значение.
update public.products
set grams_per_unit =
      case
        when grams_per_unit ? 'ч. л.' then grams_per_unit - 'микроложка'
        else (grams_per_unit - 'микроложка') || jsonb_build_object('ч. л.', grams_per_unit -> 'микроложка')
      end
where grams_per_unit ? 'микроложка';