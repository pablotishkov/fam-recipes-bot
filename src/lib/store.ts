import type { Family, Product, Recipe, SessionUser } from '../types';
import { FAMILIES_KEY, PRODUCTS_KEY, RECIPES_KEY, USER_KEY, uid } from './constants';
import { seedProducts } from './seed';
import { isSupabaseConfigured, supabase } from './supabase';

/* ------------------------------------------------------------------ */
/* Локальный кэш (localStorage).                                       */
/*                                                                     */
/* localStorage остаётся быстрым кэшем для мгновенного рендера и        */
/* офлайн-резервом. В Supabase-режиме каждое изменение дополнительно    */
/* пишется в БД (write-through), а данные семьи подтягиваются из БД     */
/* при загрузке и при возврате в приложение (см. pullFromSupabase).     */
/* ------------------------------------------------------------------ */

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

const toIso = (ms: number) => new Date(ms).toISOString();
const toMs = (iso: string) => new Date(iso).getTime();

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
  // В Supabase-режиме сохраняем в общую базу (по уникальному имени).
  if (isSupabaseConfigured) persistProduct(created).catch((e) => console.error('product push', e));
  return created;
}

/** Обновление продукта: правка существующего или переопределение встроенного. */
export function updateProduct(product: Product): void {
  const custom = read<Product[]>(PRODUCTS_KEY, []);
  const idx = custom.findIndex((p) => p.id === product.id);
  if (idx >= 0) custom[idx] = product;
  else custom.push(product);
  write(PRODUCTS_KEY, custom);
  if (isSupabaseConfigured) persistProduct(product).catch((e) => console.error('product push', e));
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
  // В Supabase-режиме сохраняем рецепт со всеми ингредиентами/шагами в БД.
  if (isSupabaseConfigured && recipe.familyId) {
    persistRecipe(recipe).catch((e) => console.error('recipe push', e));
  }
  return recipe;
}

export function deleteRecipe(id: string): void {
  const recipes = read<Recipe[]>(RECIPES_KEY, []).filter((r) => r.id !== id);
  write(RECIPES_KEY, recipes);
  if (isSupabaseConfigured) {
    supabase
      ?.from('recipes')
      .delete()
      .eq('id', id)
      .then(() => {}, (e) => console.error('recipe delete', e));
  }
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

/* ================================================================== */
/* Supabase: синхронизация семьи                                       */
/* ================================================================== */

/** Апсерт рецепта со всеми ингредиентами и шагами (идемпотентно по id). */
async function persistRecipe(recipe: Recipe): Promise<void> {
  if (!supabase) return;
  const familyId = recipe.familyId;
  if (!familyId) return;

  // 1. Рецепт — upsert по id (повторная выгрузка не создаёт дубли).
  await supabase.from('recipes').upsert(
    {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      photo_url: recipe.photoUrl ?? null,
      family_id: familyId,
      created_by: recipe.createdBy ?? null,
      created_at: toIso(recipe.createdAt),
      updated_at: toIso(recipe.updatedAt),
    },
    { onConflict: 'id' },
  );

  // 2. Ингредиенты и шаги — замена целиком (перезапись дочерних строк).
  await supabase.from('ingredients').delete().eq('recipe_id', recipe.id);
  await supabase.from('steps').delete().eq('recipe_id', recipe.id);

  const ings = recipe.ingredients ?? [];
  if (ings.length) {
    // Сопоставляем product_id с существующей записью в общей базе по имени.
    const rows = await Promise.all(
      ings.map(async (ing, position) => {
        const productId = await findDbProductIdByName(ing.productName);
        return {
          recipe_id: recipe.id,
          product_id: productId,
          product_name: ing.productName,
          amount: ing.amount,
          unit: ing.unit,
          position,
        };
      }),
    );
    await supabase.from('ingredients').insert(rows);
  }

  const steps = recipe.steps ?? [];
  if (steps.length) {
    await supabase.from('steps').insert(
      steps.map((s, position) => ({
        recipe_id: recipe.id,
        position,
        text: s.text,
        photo_url: s.photoUrl ?? null,
      })),
    );
  }
}

/** Апсерт продукта в общую базу по уникальному имени (без дублей). */
async function persistProduct(product: Product): Promise<void> {
  if (!supabase) return;
  await supabase.from('products').upsert(
    {
      name: product.name,
      calories: product.kbju.calories,
      protein: product.kbju.protein,
      fat: product.kbju.fat,
      carbs: product.kbju.carbs,
      grams_per_unit: product.gramsPerUnit ?? null,
    },
    { onConflict: 'name' },
  );
}

/** Поиск id продукта в общей базе по имени (для связи ингредиента). */
async function findDbProductIdByName(name: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('products')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Выгрузка локальных (уже существующих) данных в БД при первом входе.
 * Рецепты апсертятся по id (идемпотентно), продукты — по имени (дедупликация).
 */
export async function pushLegacyToSupabase(familyId: string, userId: string): Promise<void> {
  if (!supabase) return;

  const recipes = read<Recipe[]>(RECIPES_KEY, []);
  for (const r of recipes) {
    await persistRecipe({ ...r, familyId: r.familyId ?? familyId, createdBy: r.createdBy ?? userId });
  }

  const customs = read<Product[]>(PRODUCTS_KEY, []);
  const seen = new Set<string>();
  for (const p of customs) {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    await persistProduct(p);
  }
}

/**
 * Подтягивает рецепты и продукты семьи из БД в локальный кэш.
 * Возвращает данные, чтобы App мог обновить состояние и перерисоваться.
 */
export async function pullFromSupabase(familyId: string): Promise<{ recipes: Recipe[]; products: Product[] }> {
  if (!supabase) {
    return { recipes: getRecipes(), products: getProducts() };
  }

  const { data: rows } = await supabase.from('recipes').select('*').eq('family_id', familyId);
  const ids = (rows ?? []).map((r) => r.id);

  const [{ data: ingRows }, { data: stepRows }] = await Promise.all([
    ids.length ? supabase.from('ingredients').select('*').in('recipe_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('steps').select('*').in('recipe_id', ids) : Promise.resolve({ data: [] }),
  ]);

  const ingByRecipe = new Map<string, typeof ingRows>();
  for (const i of ingRows ?? []) {
    const list = ingByRecipe.get(i.recipe_id) ?? [];
    list.push(i);
    ingByRecipe.set(i.recipe_id, list);
  }
  const stepsByRecipe = new Map<string, typeof stepRows>();
  for (const s of stepRows ?? []) {
    const list = stepsByRecipe.get(s.recipe_id) ?? [];
    list.push(s);
    stepsByRecipe.set(s.recipe_id, list);
  }

  // Карта имя → id из текущего кэша (включая встроенные продукты) для
  // восстановления связи seed-продуктов, у которых в БД нет своей записи.
  const nameToId = new Map(getProducts().map((p) => [p.name, p.id]));

  const recipes: Recipe[] = (rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    photoUrl: r.photo_url ?? undefined,
    familyId: r.family_id ?? undefined,
    createdBy: r.created_by ?? undefined,
    createdAt: toMs(r.created_at),
    updatedAt: toMs(r.updated_at),
    ingredients: (ingByRecipe.get(r.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        id: i.id,
        productId: i.product_id ?? nameToId.get(i.product_name),
        productName: i.product_name,
        amount: Number(i.amount),
        unit: i.unit,
      })),
    steps: (stepsByRecipe.get(r.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ id: s.id, text: s.text, photoUrl: s.photo_url ?? undefined })),
  }));

  const { data: prodRows } = await supabase.from('products').select('*');
  const products: Product[] = (prodRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    kbju: {
      calories: Number(p.calories),
      protein: Number(p.protein),
      fat: Number(p.fat),
      carbs: Number(p.carbs),
    },
    gramsPerUnit: p.grams_per_unit ?? undefined,
  }));

  write(RECIPES_KEY, recipes);
  write(PRODUCTS_KEY, products);
  return { recipes, products };
}