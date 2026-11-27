# telegram-auth — вход через Telegram

Supabase Edge Function, которая безопасно аутентифицирует пользователя Telegram
Mini App: проверяет HMAC-подпись `initData` секретным токеном бота и выдаёт
клиенту `access_token` Supabase.

## Зачем

`initData` приходит с клиента и не заслуживает доверия без проверки подписи.
Токен бота (`BOT_TOKEN`) хранится только на сервере (в секретах функции), поэтому
подделать данные пользователя нельзя.

## Настройка

1. Создайте функцию:

   ```bash
   cd supabase
   supabase functions deploy telegram-auth --no-verify-jwt
   ```

2. Задайте секрет с токеном бота (получить у @BotFather):

   ```bash
   supabase secrets set BOT_TOKEN=<токен_бота>
   ```

3. Переменные окружения фронтенда (`.env`):

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   VITE_SUPABASE_FUNCTION_URL=https://<project-ref>.supabase.co/functions/v1/telegram-auth
   ```

## Клиентский вызов

Фронтенд передаёт `window.Telegram.WebApp.initData` и сохраняет полученный токен:

```ts
const res = await fetch(import.meta.env.VITE_SUPABASE_FUNCTION_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ initData: window.Telegram.WebApp.initData }),
});
const { access_token, user } = await res.json();
await supabase.auth.setSession({ access_token, refresh_token: '' });
```

## Вступление в семью по коду-приглашению

Бот может передавать код через `startapp`: `/start?startapp=ABC123`.
Telegram кладёт его в `initDataUnsafe.start_param`, а функция автоматически
присоединяет пользователя к семье с таким `invite_code`.

## Локальный запуск функции

```bash
supabase start          # локальный Supabase
supabase functions serve telegram-auth --env-file .env.local
```

Локально задайте `BOT_TOKEN` и `SUPABASE_SERVICE_ROLE_KEY` в `.env.local`.