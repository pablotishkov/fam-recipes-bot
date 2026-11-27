import type { Ingredient, Kbju, Product, Unit } from '../types';

/** Весовые единицы, конвертируемые в граммы напрямую. */
const WEIGHT_UNITS: ReadonlySet<Unit> = new Set(['г', 'кг', 'мл', 'л']);

const toGramsByWeightUnit: Record<'г' | 'кг' | 'мл' | 'л', number> = {
  г: 1,
  кг: 1000,
  мл: 1, // для простоты 1 мл ≈ 1 г
  л: 1000,
};

/** Невесовые единицы с фиксированным весом (одинаковым для всех продуктов). */
const FIXED_GRAMS_PER_UNIT: Partial<Record<Unit, number>> = {
  'ч. ложка': 5,
  'ст. ложка': 15,
  микроложка: 1,
};

/** Сколько грамм в одной единице для невесовых единиц. */
export function gramsPerUnitFor(unit: Unit, product?: Product): number {
  const fixed = FIXED_GRAMS_PER_UNIT[unit];
  if (fixed != null) return fixed;
  if (!product?.gramsPerUnit) return 0;
  return product.gramsPerUnit[unit as Exclude<Unit, 'г' | 'кг' | 'мл' | 'л'>] ?? 0;
}

/** Масса ингредиента в граммах. */
export function ingredientGrams(ingredient: Ingredient, product?: Product): number {
  if (WEIGHT_UNITS.has(ingredient.unit)) {
    return ingredient.amount * toGramsByWeightUnit[ingredient.unit as 'г' | 'кг' | 'мл' | 'л'];
  }
  return ingredient.amount * gramsPerUnitFor(ingredient.unit, product);
}

/** КБЖУ ингредиента с учётом его массы и КБЖУ продукта на 100 г. */
export function kbjuForIngredient(ingredient: Ingredient, product?: Product): Kbju {
  const grams = ingredientGrams(ingredient, product);
  const base = product?.kbju ?? { calories: 0, protein: 0, fat: 0, carbs: 0 };
  return {
    calories: (base.calories * grams) / 100,
    protein: (base.protein * grams) / 100,
    fat: (base.fat * grams) / 100,
    carbs: (base.carbs * grams) / 100,
  };
}

/** Суммарное КБЖУ списка ингредиентов. */
export function sumKbju(
  ingredients: Ingredient[],
  productsById: Map<string, Product>,
): Kbju {
  const total: Kbju = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  for (const ing of ingredients) {
    const kbju = kbjuForIngredient(ing, productsById.get(ing.productId));
    total.calories += kbju.calories;
    total.protein += kbju.protein;
    total.fat += kbju.fat;
    total.carbs += kbju.carbs;
  }
  return total;
}

export interface RescaleResult {
  ingredients: Ingredient[];
  /** Коэффициент, на который были умножены все количества. */
  factor: number;
}

/**
 * Пропорциональный пересчёт: изменяется количество одного ингредиента,
 * а все остальные масштабируются на тот же коэффициент, сохраняя пропорции блюда.
 */
export function rescaleIngredients(
  ingredients: Ingredient[],
  changedId: string,
  newAmount: number,
): RescaleResult {
  const changed = ingredients.find((i) => i.id === changedId);
  if (!changed || changed.amount <= 0 || newAmount <= 0 || !isFinite(newAmount)) {
    return { ingredients, factor: 1 };
  }
  const factor = newAmount / changed.amount;
  return {
    factor,
    ingredients: ingredients.map((i) => ({
      ...i,
      amount: Math.round(i.amount * factor * 100) / 100,
    })),
  };
}

/** Форматирование числа без лишних нулей. */
export function formatAmount(n: number): string {
  if (!isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Округление числа КБЖУ до 1 знака. */
export function formatKbju(n: number): string {
  return Math.round(n * 10) / 10 === 0 ? '0' : String(Math.round(n * 10) / 10);
}