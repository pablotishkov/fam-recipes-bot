# 🍳 Семейные рецепты — Telegram Mini App

Веб-приложение для Telegram (бот `@FamReceiptsBot`): общие рецепты для всей семьи
с ингредиентами и граммовками, автоматическим подсчётом КБЖУ из базы продуктов
и пропорциональным пересчётом.

## Функции

- CRUD рецептов: название, описание, фото, ингредиенты
- Ингредиенты: количество + единица (г, кг, мл, шт, банка, ложка, стакан…)
- База продуктов с КБЖУ на 100 г (автозаполнение) + ручное добавление
- Автоподсчёт КБЖУ всего блюда из ингредиентов
- **Пропорциональный пересчёт**: меняете количество одного ингредиента —
  остальные пересчитываются, сохраняя пропорции
- Список рецептов с поиском по названию
- Семейный доступ: первый вход создаёт семью, остальные входят по коду-приглашению;
  все рецепты общие, у всех полный доступ
- Тёмная/светлая тема по настройке Telegram

## Стек

- **Frontend:** React + Vite + TypeScript
- **Backend/данные:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Хостинг:** Render или Railway (HTTPS)
- Telegram Web App SDK

## Локальный запуск

```bash
npm install
npm run dev          # http://localhost:5173
```

В демо-режиме (без Supabase) данные хранятся в `localStorage` браузера —
приложение полностью работает локально. Чтобы переключиться на реальный бэкенд,
заполните `.env` по образцу `.env.example` (см. `supabase/functions/telegram-auth/README.md`).

Продакшен-сборка:

```bash
npm run build
npm run preview
```

## Структура

```
src/
  components/        # RecipeCard, IngredientEditor, KbjuBar
  screens/           # Onboarding, ListScreen, RecipeForm, RecipeView, ProductsScreen
  lib/
    nutrition.ts     # КБЖУ + пропорциональный пересчёт (чистая логика)
    store.ts         # слой данных (localStorage; заготовка под Supabase)
    seed.ts          # база продуктов с КБЖУ
    telegram.ts      # initData, тема, данные пользователя
    supabase.ts      # клиент Supabase
supabase/
  migrations/0001_init.sql          # схема БД + RLS
  functions/telegram-auth/          # вход через Telegram (HMAC-проверка)
```

## Деплой

1. **Supabase** — создайте проект, примените `supabase/migrations/0001_init.sql`,
   задеплойте функцию `telegram-auth`, задайте секрет `BOT_TOKEN`.
2. **Фронтенд** — выложите на Render/Railway статический сайт (сборка `npm run build`,
   директория `dist`), получите HTTPS-ссылку.
3. **BotFather** — у бота `@FamReceiptsBot` задайте Menu Button → URL приложения
   (команда `/setmenubutton`). Включите Mini App mode (если требуется) у `/newapp`.

Подробные шаги — в плане проекта (см. README этого раздела при необходимости).