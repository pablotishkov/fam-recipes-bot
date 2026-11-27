import { useCallback, useEffect, useState } from 'react';
import type { Recipe, SessionUser } from './types';
import {
  currentColorScheme,
  displayName,
  getTelegramUser,
  initTelegram,
} from './lib/telegram';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { authenticateWithTelegram, signOutFromSupabase, type FamilyAction } from './lib/auth';
import { deleteRecipe, getFamily, getProducts, getRecipes, getUser, leaveFamily, saveRecipe, updateFamilyName } from './lib/store';
import { Onboarding } from './screens/Onboarding';
import { FamilySetup } from './screens/FamilySetup';
import { ListScreen } from './screens/ListScreen';
import { RecipeForm } from './screens/RecipeForm';
import { RecipeView } from './screens/RecipeView';
import { ProductsScreen } from './screens/ProductsScreen';
import { FamilyScreen } from './screens/FamilyScreen';

type View =
  | { name: 'onboarding' }
  | { name: 'family-setup' }
  | { name: 'list' }
  | { name: 'form'; recipeId?: string }
  | { name: 'view'; recipeId: string }
  | { name: 'products' }
  | { name: 'family' };

/** Промежуточные экраны аутентификации. */
function AuthLoading() {
  return (
    <div className="center">
      <h1>Семейные рецепты 🍳</h1>
      <p className="muted">Входим через Telegram…</p>
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

  useEffect(() => {
    initTelegram();
    document.documentElement.setAttribute('data-theme', currentColorScheme());

    // В Supabase-режиме входим через Telegram при старте.
    if (isSupabaseConfigured) {
      setAuthState('loading');
      authenticateWithTelegram()
        .then((u) => {
          if (u) {
            setUser(u);
            setView(u.familyId ? { name: 'list' } : { name: 'family-setup' });
          }
          setAuthState('idle');
        })
        .catch((e: Error) => {
          setAuthError(e.message);
          setAuthState('error');
        });
    }
  }, []);

  const retryAuth = useCallback(() => {
    setAuthState('loading');
    setAuthError('');
    authenticateWithTelegram()
      .then((u) => {
        if (u) {
          setUser(u);
          setView(u.familyId ? { name: 'list' } : { name: 'family-setup' });
        }
        setAuthState('idle');
      })
      .catch((e: Error) => {
        setAuthError(e.message);
        setAuthState('error');
      });
  }, []);

  // Создание семьи или вступление по коду (Supabase-режим).
  const handleFamilySetup = useCallback(async (action: FamilyAction) => {
    const u = await authenticateWithTelegram(action);
    if (u) {
      setUser(u);
      setView(u.familyId ? { name: 'list' } : { name: 'family-setup' });
    }
  }, []);

  const recipes = getRecipes();
  const products = getProducts();
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
      setView({ name: 'view', recipeId: recipe.id });
    },
    [],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm('Удалить рецепт?')) return;
      deleteRecipe(id);
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
        />
      );
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