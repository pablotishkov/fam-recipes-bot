// Общие типы приложения.

/** КБЖУ на 100 г продукта. */
export interface Kbju {
  /** Калорийность, ккал. */
  calories: number;
  /** Белки, г. */
  protein: number;
  /** Жиры, г. */
  fat: number;
  /** Углеводы, г. */
  carbs: number;
}

/** Единицы измерения ингредиента. */
export type Unit =
  | 'г'
  | 'кг'
  | 'мл'
  | 'л'
  | 'шт'
  | 'банка'
  | 'ст. ложка'
  | 'ч. ложка'
  | 'стакан'
  | 'микроложка';

/** Продукт из базы с КБЖУ на 100 г. */
export interface Product {
  id: string;
  name: string;
  kbju: Kbju;
  /**
   * Приблизительный вес одной единицы в граммах для невесовых единиц
   * (шт, банка, ложка, стакан). Позволяет считать КБЖУ и для них.
   */
  gramsPerUnit?: Partial<Record<Exclude<Unit, 'г' | 'кг' | 'мл' | 'л'>, number>>;
}

/** Ингредиент в составе рецепта. */
export interface Ingredient {
  id: string;
  productId: string;
  productName: string;
  amount: number;
  unit: Unit;
}

/** Один шаг приготовления. */
export interface RecipeStep {
  id: string;
  text: string;
  photoUrl?: string;
}

/** Рецепт. */
export interface Recipe {
  id: string;
  title: string;
  description: string;
  photoUrl?: string;
  ingredients: Ingredient[];
  steps?: RecipeStep[];
  createdAt: number;
  updatedAt: number;
  familyId?: string;
  createdBy?: string;
}

/** Семья. Имя (напр. «Тишковы») — для отображения; inviteCode — уникальный код входа. */
export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: number;
}

/** Профиль пользователя (в приложении). */
export interface Profile {
  id: string;
  name: string;
  telegramId?: string;
  familyId?: string;
}

/** Текущий пользователь в сессии. */
export interface SessionUser {
  id: string;
  name: string;
  familyId?: string;
  familyName?: string;
  /** Код-приглашение семьи (в Supabase-режиме берётся из БД). */
  inviteCode?: string;
}