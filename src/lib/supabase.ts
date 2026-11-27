import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Supabase-клиент. Если переменные окружения не заданы (демо-режим),
 * возвращаем null — приложение работает на локальном хранилище.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);

/** URL функции аутентификации через Telegram. */
export const telegramAuthFunctionUrl =
  import.meta.env.VITE_SUPABASE_FUNCTION_URL ||
  (url ? `${url}/functions/v1/telegram-auth` : '');

export type { SupabaseClient };