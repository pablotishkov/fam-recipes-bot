import { useMemo, useState } from 'react';
import type { Recipe } from '../types';
import { RecipeCard } from '../components/RecipeCard';

interface Props {
  recipes: Recipe[];
  onOpen: (recipe: Recipe) => void;
  onAdd: () => void;
  onManageProducts: () => void;
}

export function ListScreen({ recipes, onOpen, onAdd, onManageProducts }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, query]);

  return (
    <div>
      <input
        className="search"
        placeholder="Поиск по названию…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="empty">
          {recipes.length === 0
            ? 'Пока нет рецептов. Нажмите +, чтобы добавить первый.'
            : 'Ничего не найдено по запросу.'}
        </div>
      ) : (
        filtered.map((r) => <RecipeCard key={r.id} recipe={r} onClick={() => onOpen(r)} />)
      )}

      <button className="fab" onClick={onAdd} aria-label="Добавить рецепт">
        +
      </button>

      <button className="fab-left" onClick={onManageProducts} title="База продуктов">
        🧺
      </button>
    </div>
  );
}