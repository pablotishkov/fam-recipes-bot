import type { Kbju, Unit } from '../types';

export const UNITS: Unit[] = ['г', 'кг', 'мл', 'л', 'шт', 'банка', 'ст. ложка', 'ч. ложка', 'стакан', 'микроложка'];

export const EMPTY_KBJU: Kbju = { calories: 0, protein: 0, fat: 0, carbs: 0 };

/** Ключ localStorage для продуктов, добавленных пользователем. */
export const PRODUCTS_KEY = 'famr:products';

/** Ключ localStorage для рецептов. */
export const RECIPES_KEY = 'famr:recipes';

/** Ключ localStorage для текущего пользователя. */
export const USER_KEY = 'famr:user';

/** Ключ localStorage для списка семей. */
export const FAMILIES_KEY = 'famr:families';

/** Уникальный id. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}