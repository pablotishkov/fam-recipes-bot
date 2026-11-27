import { useCallback, useEffect, useState } from 'react';
import type { Recipe, SessionUser } from './types';
import {
  currentColorScheme,
  displayName,
  getTelegramUser,
  initTelegram,
} from './lib/telegram';
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

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(() => getUser());
  const [view, setView] = useState<View>(() =>
    getUser() ? { name: 'list' } : { name: 'onboarding' },
  );

  useEffect(() => {
    initTelegram();
    document.documentElement.setAttribute('data-theme', currentColorScheme());
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
    leaveFamily();
    setUser(null);
    setView({ name: 'onboarding' });
  }, []);

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