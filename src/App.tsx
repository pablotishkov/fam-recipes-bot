import { useCallback, useEffect, useState } from 'react';
import type { Recipe, SessionUser } from './types';
import {
  currentColorScheme,
  displayName,
  getTelegramUser,
  initTelegram,
} from './lib/telegram';
import { isSupabaseConfigured } from './lib/supabase';
import { authenticateWithTelegram, signOutFromSupabase } from './lib/auth';
import { deleteRecipe, getFamily, getProducts, getRecipes, getUser, leaveFamily, saveRecipe } from './lib/store';
import { Onboarding } from './screens/Onboarding';
import { ListScreen } from './screens/ListScreen';
import { RecipeForm } from './screens/RecipeForm';
import { RecipeView } from './screens/RecipeView';
import { ProductsScreen } from './screens/ProductsScreen';
import { FamilyScreen } from './screens/FamilyScreen';

type View =
  | { name: 'onboarding' }
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
            setView({ name: 'list' });
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
          setView({ name: 'list' });
        }
        setAuthState('idle');
      })
      .catch((e: Error) => {
        setAuthError(e.message);
        setAuthState('error');
      });
  }, []);

  const recipes = getRecipes();
  const products = getProducts();
  const family = user?.familyId ? getFamily(user.familyId) ?? null : null;

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
      // В Supabase-режиме семья живёт на сервере — просто сбрасываем сессию
      // и заново проходим вход (состояние семьи сохраняется на сервере).
      signOutFromSupabase().then(() => {
        leaveFamily();
        window.location.reload();
      });
      return;
    }
    leaveFamily();
    setUser(null);
    setView({ name: 'onboarding' });
  }, []);

  if (authState === 'loading') {
    return <AuthLoading />;
  }
  if (authState === 'error') {
    return <AuthError message={authError} onRetry={retryAuth} />;
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
    if (family) return <FamilyScreen family={family} onBack={openList} onLeave={handleLeave} />;
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