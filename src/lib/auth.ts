import type { SessionUser } from '../types';
import { supabase, telegramAuthFunctionUrl } from './supabase';
import { getInitData } from './telegram';

/** Ответ Edge Function telegram-auth. */
interface TelegramAuthResponse {
  access_token: string;
  user: { id: string; name: string; family_id: string | null };
}

/**
 * Аутентификация через Telegram.
 *
 * Отправляет подписанный `initData` в Edge Function, которая проверяет
 * HMAC-подпись, находит/создаёт пользователя Supabase и семью, и возвращает
 * `access_token`. Затем сохраняем сессию и возвращаем пользователя приложения.
 *
 * Возвращает null, если Supabase не настроен (демо-режим).
 */
export async function authenticateWithTelegram(): Promise<SessionUser | null> {
  if (!supabase) return null;

  const initData = getInitData();
  if (!initData) {
    throw new Error('Нет данных Telegram. Откройте приложение через бота.');
  }

  const res = await fetch(telegramAuthFunctionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Ошибка входа (HTTP ${res.status})`);
  }

  const data = (await res.json()) as TelegramAuthResponse;

  // Токен без refresh (edge-функция выдаёт короткоживущий access_token).
  await supabase.auth.setSession({ access_token: data.access_token, refresh_token: '' });

  // Имя семьи для отображения — берём из базы (RLS пускает к своей семье).
  let familyName: string | undefined;
  if (data.user.family_id) {
    const { data: family } = await supabase
      .from('families')
      .select('name')
      .eq('id', data.user.family_id)
      .maybeSingle();
    familyName = family?.name;
  }

  const user: SessionUser = {
    id: data.user.id,
    name: data.user.name,
    familyId: data.user.family_id ?? undefined,
    familyName,
  };
  return user;
}

/** Выход: сбрасывает локальную сессию Supabase (если она есть). */
export async function signOutFromSupabase(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
}