import { useCallback, useEffect, useState } from 'react';
import type { Product, Recipe, SessionUser } from './types';
import {
  currentColorScheme,
  displayName,
  getTelegramUser,
  initTelegram,
} from './lib/telegram';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { authenticateWithTelegram, signOutFromSupabase, type FamilyAction } from './lib/auth';
import { deleteRecipe, getFamily, getProducts, getRecipes, getUser, leaveFamily, pullFromSupabase, pushLegacyToSupabase, saveRecipe, updateFamilyName } from './lib/store';
import { Onboarding } from './screens/Onboarding';
import { FamilySetup } from './screens/FamilySetup';
import { ListScreen } from './screens/ListScreen';
import { RecipeForm } from './screens/RecipeForm';
import { RecipeView } from './screens/RecipeView';
import { ProductsScreen } from './screens/ProductsScreen';
import { FamilyScreen } from './screens/FamilyScreen';
import { PersonalizationScreen } from './screens/PersonalizationScreen';
import { applyAccent, getAccent } from './lib/prefs';

type View =
  | { name: 'onboarding' }
  | { name: 'family-setup' }
  | { name: 'list' }
  | { name: 'form'; recipeId?: string }
  | { name: 'view'; recipeId: string }
  | { name: 'products' }
  | { name: 'family' }
  | { name: 'personalization' };

/** Промежуточные экраны аутентификации. */
function AuthLoading() {
  return (
    <div className="auth-loading">
      <div className="auth-loading-title">Авторизация…</div>
      <div className="auth-loading-spinner" role="status" aria-label="Загрузка" />
    </div>
  );
}

function AuthError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="center">
      <h1>Семейные рецепты 🍳</h1>
      <p style={{ color: 'var(--danger)', textAlign: 'center' }}>{message}</p>
      <button className="btn btn-primary btn-block" onClick={onRetry}>
        Попробовать снова
      </button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(() => getUser());
  const [view, setView] = useState<View>(() =>
    getUser() ? { name: 'list' } : { name: 'onboarding' },
  );
  const [authState, setAuthState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [authError, setAuthError] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>(() => getRecipes());
  const [products, setProducts] = useState<Product[]>(() => getProducts());

  // Применяем персональный акцентный цвет пользователя при входе/смене.
  useEffect(() => {
    if (user) applyAccent(getAccent(user.id), currentColorScheme());
  }, [user]);

  /**
   * После входа (Supabase-режим): выгружаем существующие локальные данные в БД
   * (идемпотентно) и подтягиваем свежие данные семьи в кэш + состояние.
   */
  const loadFamilyData = useCallback(async (u: SessionUser) => {
    if (!isSupabaseConfigured || !u.familyId) return;
    try {
      await pushLegacyToSupabase(u.familyId, u.id);
      const data = await pullFromSupabase(u.familyId);
      setRecipes(data.recipes);
      setProducts(data.products);
    } catch (e) {
      console.error('Синхронизация семьи', e);
      let detail = e instanceof Error ? e.message : String(e);
      // Подробная диагностика RLS/авторизации: авторизована ли сессия и
      // совпадает ли family_id фронтенда с профилем в БД.
      try {
        const { data: au } = await supabase!.auth.getUser();
        const authed = Boolean(au?.user);
        const { data: prof } = await supabase!
          .from('profiles')
          .select('id, family_id, name')
          .eq('id', u.id)
          .maybeSingle();
        detail += `\n\nСессия авторизована: ${authed}`;
        detail += `\nuser.id: ${u.id}`;
        detail += `\nuser.familyId (фронт): ${u.familyId}`;
        detail += `\nпрофиль в БД: ${JSON.stringify(prof)}`;
      } catch (e2) {
        detail += `\n(ошибка диагностики: ${(e2 as Error).message})`;
      }
      // Показываем причину — иначе пользователь не видит, что локальные
      // данные не выгрузились в облако.
      window.alert(`Не удалось выгрузить локальные данные в облако:\n${detail}`);
    }
  }, []);

  useEffect(() => {
    initTelegram();
    document.documentElement.setAttribute('data-theme', currentColorScheme());
    // Применяем персональный акцентный цвет (если задан), сразу после темы.
    const u = getUser();
    if (u) applyAccent(getAccent(u.id), currentColorScheme());

    // В Supabase-режиме входим через Telegram при старте.
    if (isSupabaseConfigured) {
      setAuthState('loading');
      authenticateWithTelegram()
        .then((u) => {
          if (u) {
            setUser(u);
            setView(u.familyId ? { name: 'list' } : { name: 'family-setup' });
            loadFamilyData(u);
          }
          setAuthState('idle');
        })
        .catch((e: Error) => {
          setAuthError(e.message);
          setAuthState('error');
        });
    }
  }, [loadFamilyData]);

  // Обновление при возврате в приложение: подтягиваем изменения других членов семьи.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && user?.familyId) {
        pullFromSupabase(user.familyId)
          .then((d) => {
            setRecipes(d.recipes);
            setProducts(d.products);
          })
          .catch((e) => console.error('Обновление данных семьи', e));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [user?.familyId]);

  // Realtime: живые обновления рецептов и продуктов, пока приложение открыто.
  // RLS-фильтр отдаёт только свою семью; дебаунс схлопывает пачки событий
  // (например, каскадную перезапись ингредиентов/шагов) в один pull.
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client || !user?.familyId) return;
    const familyId = user.familyId;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedulePull = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        pullFromSupabase(familyId)
          .then((d) => {
            setRecipes(d.recipes);
            setProducts(d.products);
          })
          .catch((e) => console.error('Realtime-обновление', e));
      }, 400);
    };

    const recipesChannel = client
      .channel(`recipes-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipes', filter: `family_id=eq.${familyId}` },
        schedulePull,
      )
      .subscribe();

    const productsChannel = client
      .channel(`products-${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, schedulePull)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(recipesChannel);
      client.removeChannel(productsChannel);
    };
  }, [user?.familyId]);

  const retryAuth = useCallback(() => {
    setAuthState('loading');
    setAuthError('');
    authenticateWithTelegram()
      .then((u) => {
        if (u) {
          setUser(u);
          setView(u.familyId ? { name: 'list' } : { name: 'family-setup' });
          loadFamilyData(u);
        }
        setAuthState('idle');
      })
      .catch((e: Error) => {
        setAuthError(e.message);
        setAuthState('error');
      });
  }, [loadFamilyData]);

  // Создание семьи или вступление по коду (Supabase-режим).
  const handleFamilySetup = useCallback(
    async (action: FamilyAction) => {
      const u = await authenticateWithTelegram(action);
      if (u) {
        setUser(u);
        setView(u.familyId ? { name: 'list' } : { name: 'family-setup' });
        loadFamilyData(u);
      }
    },
    [loadFamilyData],
  );

  // В Supabase-режиме семья живёт в БД и приходит в SessionUser (имя + код);
  // в демо-режиме — из localStorage.
  const family = user?.familyId
    ? isSupabaseConfigured
      ? {
          id: user.familyId,
          name: user.familyName || 'Моя семья',
          inviteCode: user.inviteCode || '',
          createdAt: 0,
        }
      : getFamily(user.familyId) ?? null
    : null;

  const openList = useCallback(() => {
    // Перечитываем кэш из localStorage: так сразу отражаются изменения,
    // сделанные через store (например, удаление категории сняло её с рецептов).
    setRecipes(getRecipes());
    setView({ name: 'list' });
  }, []);

  const handleOnboardingDone = useCallback(
    (u: SessionUser) => {
      setUser(u);
      openList();
    },
    [openList],
  );

  const handleSave = useCallback(
    (recipe: Recipe) => {
      saveRecipe(recipe);
      // Сразу кладём рецепт в состояние, чтобы страница рецепта (view) нашла
      // его без перезагрузки. Раньше новый рецепт не попадал в стейт и
      // открывался пустой экран.
      setRecipes((prev) => {
        const idx = prev.findIndex((r) => r.id === recipe.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = recipe;
          return next;
        }
        return [recipe, ...prev];
      });
      setView({ name: 'view', recipeId: recipe.id });
    },
    [],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm('Удалить рецепт?')) return;
      deleteRecipe(id);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      openList();
    },
    [openList],
  );

  const handleLeave = useCallback(() => {
    if (isSupabaseConfigured) {
      // В Supabase-режиме отвязываем профиль от семьи (RLS позволяет менять свой),
      // выходим из сессии и перезаходим — тогда вернёмся на экран создания/входа.
      const uid = user?.id;
      const p = uid
        ? supabase?.from('profiles').update({ family_id: null }).eq('id', uid)
        : Promise.resolve();
      (p ?? Promise.resolve())
        .then(() => signOutFromSupabase())
        .then(() => {
          leaveFamily();
          window.location.reload();
        });
      return;
    }
    leaveFamily();
    setUser(null);
    setView({ name: 'onboarding' });
  }, [user]);

  const handleRename = useCallback(
    (name: string) => {
      if (!user?.familyId) return;
      if (isSupabaseConfigured) {
        supabase
          ?.from('families')
          .update({ name })
          .eq('id', user.familyId)
          .then(() => {
            setUser({ ...user, familyName: name });
          });
      } else {
        updateFamilyName(user.familyId, name);
      }
    },
    [user],
  );

  if (authState === 'loading') {
    return <AuthLoading />;
  }
  if (authState === 'error') {
    return <AuthError message={authError} onRetry={retryAuth} />;
  }

  if (view.name === 'family-setup') {
    return <FamilySetup onSubmit={handleFamilySetup} />;
  }

  if (view.name === 'onboarding' || !user) {
    const tg = getTelegramUser();
    const defaultName = displayName(tg?.first_name, tg?.last_name, tg?.username);
    return <Onboarding defaultName={defaultName} onDone={handleOnboardingDone} />;
  }

  if (view.name === 'products') {
    return <ProductsScreen onBack={openList} />;
  }

  if (view.name === 'family') {
    // Если семьи нет (не должно происходить) — показываем список.
    if (family)
      return (
        <FamilyScreen
          family={family}
          onBack={openList}
          onLeave={handleLeave}
          onRename={handleRename}
          onOpenPersonalization={() => setView({ name: 'personalization' })}
        />
      );
  }

  if (view.name === 'personalization') {
    return <PersonalizationScreen user={user} onBack={() => setView({ name: 'family' })} />;
  }

  if (view.name === 'form') {
    const initial = view.recipeId
      ? recipes.find((r) => r.id === view.recipeId)
      : undefined;
    return (
      <RecipeForm
        initial={initial}
        user={user}
        onSave={handleSave}
        onCancel={openList}
      />
    );
  }

  if (view.name === 'view') {
    const recipe = recipes.find((r) => r.id === view.recipeId);
    if (!recipe) {
      return <ListScreen recipes={[]} onOpen={() => {}} onAdd={() => {}} onManageProducts={() => {}} />;
    }
    return (
      <RecipeView
        recipe={recipe}
        products={products}
        onEdit={() => setView({ name: 'form', recipeId: recipe.id })}
        onDelete={() => handleDelete(recipe.id)}
        onBack={openList}
      />
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>Рецепты</h1>
        <button
          className="btn btn-sm"
          onClick={() => setView({ name: 'family' })}
          title="Настройки семьи"
        >
          {family ? `Семья ${family.name}` : 'Семья'}
        </button>
      </div>
      <ListScreen
        recipes={recipes}
        onOpen={(r) => setView({ name: 'view', recipeId: r.id })}
        onAdd={() => setView({ name: 'form' })}
        onManageProducts={() => setView({ name: 'products' })}
      />
    </div>
  );
}