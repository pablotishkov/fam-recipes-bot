import type { Kbju, Unit } from '../types';

export const UNITS: Unit[] = ['г', 'кг', 'мл', 'л', 'шт', 'банка', 'ст. ложка', 'ч. ложка', 'стакан', 'микроложка'];

export const EMPTY_KBJU: Kbju = { calories: 0, protein: 0, fat: 0, carbs: 0 };

/** Ключ localStorage для продуктов, добавленных пользователем. */
export const PRODUCTS_KEY = 'famr:products';

/** Ключ localStorage для рецептов. */
export const RECIPES_KEY = 'famr:recipes';

/** Ключ localStorage для id рецептов, уже подтверждённых в БД. */
export const SYNCED_RECIPES_KEY = 'famr:syncedRecipeIds';

/** Ключ localStorage для категорий рецептов. */
export const CATEGORIES_KEY = 'famr:categories';

/** Ключ localStorage для id категорий, уже подтверждённых в БД. */
export const SYNCED_CATEGORIES_KEY = 'famr:syncedCategoryIds';

/** Ключ localStorage для текущего пользователя. */
export const USER_KEY = 'famr:user';

/** Ключ localStorage для списка семей. */
export const FAMILIES_KEY = 'famr:families';

/** Уникальный id — всегда валидный UUID v4 (нужно для uuid-колонок в БД). */
export function uid(): string {
  const c = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  // RFC 4122 v4 fallback. В старых WebView (например, внутри Telegram) без
  // crypto.randomUUID нельзя вернуть строку вида "id-..." — она не валидный
  // uuid, и вставка в uuid-колонку (recipes.id и т.п.) упадёт.
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}