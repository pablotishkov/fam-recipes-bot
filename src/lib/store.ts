import type { Family, Product, Recipe, SessionUser } from '../types';
import { FAMILIES_KEY, PRODUCTS_KEY, RECIPES_KEY, SYNCED_RECIPES_KEY, USER_KEY, uid } from './constants';
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

/* ---------- Статус синхронизации рецептов ---------- */

function readSyncedIds(): Set<string> {
  return new Set(read<string[]>(SYNCED_RECIPES_KEY, []));
}

function writeSyncedIds(ids: Iterable<string>): void {
  write(SYNCED_RECIPES_KEY, [...ids]);
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
    persistRecipe(recipe)
      .then(() => {
        // Помечаем рецепт как подтверждённый в БД — при заходе он не
        // будет перезаписываться в базу снова.
        const synced = readSyncedIds();
        synced.add(recipe.id);
        writeSyncedIds(synced);
      })
      .catch((e) => {
        console.error('recipe push', e);
        // Явно сообщаем пользователю, что рецепт не ушёл в облако.
        window.alert(`Не удалось сохранить рецепт в облако: ${e.message}`);
      });
  }
  return recipe;
}

export function deleteRecipe(id: string): void {
  const recipes = read<Recipe[]>(RECIPES_KEY, []).filter((r) => r.id !== id);
  write(RECIPES_KEY, recipes);
  // Больше не считаем рецепт подтверждённым — на случай повторного создания.
  const synced = readSyncedIds();
  synced.delete(id);
  writeSyncedIds(synced);
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

/** Бросает исключение, если Supabase вернул ошибку (RLS, сеть и т.п.). */
function assertNoError(res: { error: unknown }): void {
  if (res.error) {
    const msg = (res.error as { message?: string }).message ?? 'Ошибка Supabase';
    throw new Error(msg);
  }
}

/**
 * Апсерт рецепта со всеми ингредиентами и шагами (идемпотентно по id).
 *
 * Пишем через RPC save_recipe (security definer): она атомарно сохраняет
 * рецепт + ингредиенты + шаги и сама проверяет членство в семье. Это
 * надёжнее, чем пер-рядные RLS-политики с `with check` на recipes_insert,
 * которые могли отклонять вставку даже при совпадающем family_id.
 */
async function persistRecipe(recipe: Recipe): Promise<void> {
  if (!supabase) return;
  const familyId = recipe.familyId;
  if (!familyId) return;

  const ings = recipe.ingredients ?? [];
  const resolved = await Promise.all(
    ings.map(async (ing, position) => {
      const productId = await findDbProductIdByName(ing.productName);
      return {
        product_id: productId,
        product_name: ing.productName,
        amount: ing.amount,
        unit: ing.unit,
        position,
      };
    }),
  );
  const steps = (recipe.steps ?? []).map((s, position) => ({
    position,
    text: s.text,
    photo_url: s.photoUrl ?? null,
  }));

  const { error } = await supabase.rpc('save_recipe', {
    p_id: recipe.id,
    p_family_id: familyId,
    p_created_by: recipe.createdBy ?? null,
    p_title: recipe.title,
    p_description: recipe.description,
    p_photo_url: recipe.photoUrl ?? null,
    p_created_at: toIso(recipe.createdAt),
    p_updated_at: toIso(recipe.updatedAt),
    p_ingredients: resolved,
    p_steps: steps,
  });
  if (error) throw new Error(error.message);
}

/** Апсерт продукта в общую базу по уникальному имени (без дублей). */
async function persistProduct(product: Product): Promise<void> {
  if (!supabase) return;
  const res = await supabase.from('products').upsert(
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
  assertNoError(res);
}

/** Поиск id продукта в общей базе по имени (для связи ингредиента). */
async function findDbProductIdByName(name: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  assertNoError({ error });
  return data?.id ?? null;
}

/** Регулярка для проверки валидного UUID (в любом регистре). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return typeof v === 'string' && UUID_RE.test(v);
}

/**
 * Выгрузка локальных (уже существующих) данных в БД при первом входе.
 * Рецепты апсертятся по id (идемпотентно), продукты — по имени (дедупликация).
 *
 * Важно: `familyId` принудительно берётся из текущей семьи пользователя, а не
 * из сохранённого в старом локальном рецепте (там может лежать uuid другой —
 * демо/локальной — семьи, и вставка будет отклонена RLS).
 *
 * Рецепты с невалидным id (старый `uid()` мог вернуть "id-...") получают новый
 * валидный UUID и обновляются в локальном кэше — иначе Postgres не примет
 * их в uuid-колонку recipes.id, и они не выгрузятся в БД.
 */
export async function pushLegacyToSupabase(familyId: string, userId: string): Promise<void> {
  if (!supabase) return;

  const recipes = read<Recipe[]>(RECIPES_KEY, []);
  let cacheChanged = false;
  const normalized = recipes.map((r) => {
    if (isUuid(r.id)) return r;
    cacheChanged = true;
    return { ...r, id: uid() };
  });
  if (cacheChanged) write(RECIPES_KEY, normalized);

  // Дозаписываем в БД только рецепты, которых ещё нет в ней (не подтверждены
  // синхронизацией). Рецепты, удалённые из БД другим членом семьи, не
  // перезаписываются обратно — их уберёт последующий pull.
  const synced = readSyncedIds();
  for (const r of normalized) {
    if (synced.has(r.id)) continue;
    await persistRecipe({ ...r, familyId, createdBy: r.createdBy ?? userId });
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
 * Бросает исключение при ошибке — вызывающий код не должен перезаписывать
 * локальный кэш результатом неуспешной синхронизации.
 */
export async function pullFromSupabase(familyId: string): Promise<{ recipes: Recipe[]; products: Product[] }> {
  if (!supabase) {
    return { recipes: getRecipes(), products: getProducts() };
  }

  const { data: rows, error: rowsErr } = await supabase
    .from('recipes')
    .select('*')
    .eq('family_id', familyId);
  assertNoError({ error: rowsErr });
  const ids = (rows ?? []).map((r) => r.id);

  const [ingRes, stepRes] = await Promise.all([
    ids.length ? supabase.from('ingredients').select('*').in('recipe_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from('steps').select('*').in('recipe_id', ids) : Promise.resolve({ data: [], error: null }),
  ]);
  assertNoError(ingRes);
  assertNoError(stepRes);
  const ingRows = ingRes.data;
  const stepRows = stepRes.data;

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

  const { data: prodRows, error: prodErr } = await supabase.from('products').select('*');
  assertNoError({ error: prodErr });
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

  // Защита от потери данных: не затираем непустой локальный кэш пустым
  // результатом синхронизации. Сценарий: push по какой-то причине не записался
  // в БД (RLS, сеть), а pull уже вернул пустоту — перезапись стёрла бы локальные
  // данные. При срабатывании оставляем локальный кэш и данные для рендера.
  const localRecipes = read<Recipe[]>(RECIPES_KEY, []);
  const localProducts = read<Product[]>(PRODUCTS_KEY, []);
  const emptyRecipes = recipes.length === 0 && localRecipes.length > 0;
  const emptyProducts = products.length === 0 && localProducts.length > 0;
  if (emptyRecipes || emptyProducts) {
    console.warn(
      `Синхронизация семьи вернула пустое значение${emptyRecipes && emptyProducts ? '' : emptyRecipes ? ' (рецепты)' : ' (продукты)'} при непустом локальном кэше — локальные данные не затираются. Проверьте запись в БД (RLS/права).`,
    );
    return {
      recipes: [...localRecipes].sort((a, b) => b.updatedAt - a.updatedAt),
      products: getProducts(),
    };
  }

  write(RECIPES_KEY, recipes);
  write(PRODUCTS_KEY, products);
  // Все рецепты из успешного pull считаем подтверждёнными в БД: при заходе
  // они больше не будут перезаписываться обратно.
  writeSyncedIds(recipes.map((r) => r.id));
  return { recipes, products };
}