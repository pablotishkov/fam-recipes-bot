-- Фото рецептов и шагов: выносим из base64 (localStorage ~5 МБ на iOS / колонка БД)
-- в Supabase Storage. В БД и localStorage теперь хранится только URL/путь.

-- Публичный bucket для фото.
insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do update set public = excluded.public;

-- Чтение — публичное (нужно для показа <img src> без авторизации).
create policy "recipe-photos public read"
  on storage.objects for select
  using (bucket_id = 'recipe-photos');

-- Загрузка — любой авторизованный пользователь.
create policy "recipe-photos insert"
  on storage.objects for insert
  with check (bucket_id = 'recipe-photos' and auth.role() = 'authenticated');

-- Удаление — только владелец файла (кто загрузил).
create policy "recipe-photos delete owner"
  on storage.objects for delete
  using (bucket_id = 'recipe-photos' and owner = auth.uid());