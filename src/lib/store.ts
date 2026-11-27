import type { Family, Product, Recipe, SessionUser } from '../types';
import { FAMILIES_KEY, PRODUCTS_KEY, RECIPES_KEY, USER_KEY, uid } from './constants';
import { seedProducts } from './seed';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------- Продукты (база КБЖУ) ---------- */

export function getProducts(): Product[] {
  const custom = read<Product[]>(PRODUCTS_KEY, []);
  // Кастомные продукты переопределяют встроенные с тем же id.
  const merged = new Map(seedProducts.map((p) => [p.id, p]));
  for (const c of custom) merged.set(c.id, c);
  return [...merged.values()];
}

export function addProduct(product: Omit<Product, 'id'>): Product {
  const custom = read<Product[]>(PRODUCTS_KEY, []);
  const created: Product = { ...product, id: uid() };
  write(PRODUCTS_KEY, [...custom, created]);
  return created;
}

/** Обновление продукта: правка существующего или переопределение встроенного. */
export function updateProduct(product: Product): void {
  const custom = read<Product[]>(PRODUCTS_KEY, []);
  const idx = custom.findIndex((p) => p.id === product.id);
  if (idx >= 0) custom[idx] = product;
  else custom.push(product);
  write(PRODUCTS_KEY, custom);
}

/* ---------- Рецепты ---------- */

export function getRecipes(): Recipe[] {
  return read<Recipe[]>(RECIPES_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getRecipe(id: string): Recipe | undefined {
  return read<Recipe[]>(RECIPES_KEY, []).find((r) => r.id === id);
}

export function saveRecipe(recipe: Recipe): Recipe {
  const recipes = read<Recipe[]>(RECIPES_KEY, []);
  const idx = recipes.findIndex((r) => r.id === recipe.id);
  if (idx >= 0) recipes[idx] = recipe;
  else recipes.push(recipe);
  write(RECIPES_KEY, recipes);
  return recipe;
}

export function deleteRecipe(id: string): void {
  const recipes = read<Recipe[]>(RECIPES_KEY, []).filter((r) => r.id !== id);
  write(RECIPES_KEY, recipes);
}

/* ---------- Пользователь и семья ---------- */

export function getUser(): SessionUser | null {
  return read<SessionUser | null>(USER_KEY, null);
}

export function setUser(user: SessionUser | null): void {
  if (user) write(USER_KEY, user);
  else localStorage.removeItem(USER_KEY);
}

export function getFamilies(): Family[] {
  return read<Family[]>(FAMILIES_KEY, []);
}

/** Семья по id. */
export function getFamily(id: string): Family | undefined {
  return getFamilies().find((f) => f.id === id);
}

/** Семья по коду-приглашению. */
export function findFamilyByCode(code: string): Family | undefined {
  const normalized = code.trim().toUpperCase();
  return getFamilies().find((f) => f.inviteCode === normalized);
}

/** Генерация уникального кода-приглашения семьи. */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (findFamilyByCode(code));
  return code;
}

/**
 * Создаёт семью с заданным именем (напр. «Тишковы»). Имя — только для
 * отображения: несколько семей могут иметь одинаковое имя, но у каждой свой
 * уникальный id и код-приглашение.
 */
export function createFamily(name: string, user: SessionUser): { family: Family; user: SessionUser } {
  const family: Family = {
    id: uid(),
    name: name.trim() || 'Моя семья',
    inviteCode: generateInviteCode(),
    createdAt: Date.now(),
  };
  write(FAMILIES_KEY, [...getFamilies(), family]);
  const updated: SessionUser = { ...user, familyId: family.id, familyName: family.name };
  setUser(updated);
  return { family, user: updated };
}

/**
 * Вступление в семью по коду-приглашению. Возвращает null, если код не найден.
 */
export function joinFamilyByCode(code: string, user: SessionUser): { family: Family; user: SessionUser } | null {
  const family = findFamilyByCode(code);
  if (!family) return null;
  const updated: SessionUser = { ...user, familyId: family.id, familyName: family.name };
  setUser(updated);
  return { family, user: updated };
}

/** Переименование семьи. Обновляет имя и у текущего пользователя, если он в ней. */
export function updateFamilyName(familyId: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  write(
    FAMILIES_KEY,
    getFamilies().map((f) => (f.id === familyId ? { ...f, name: trimmed } : f)),
  );
  const user = getUser();
  if (user && user.familyId === familyId) {
    setUser({ ...user, familyName: trimmed });
  }
}

/** Выход из семьи: сбрасывает текущего пользователя (возврат к онбордингу). */
export function leaveFamily(): void {
  setUser(null);
}