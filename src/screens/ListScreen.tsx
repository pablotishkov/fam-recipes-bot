import { useMemo, useState } from 'react';
import type { Recipe } from '../types';
import { RecipeCard } from '../components/RecipeCard';
import { fuzzyFilter } from '../lib/search';
import { getCategories } from '../lib/store';

interface Props {
  recipes: Recipe[];
  onOpen: (recipe: Recipe) => void;
  onAdd: () => void;
  onManageProducts: () => void;
}

/** 'all' — все рецепты, 'none' — «Общие» (без категории), иначе id категории. */
type CategoryFilter = 'all' | 'none' | string;

export function ListScreen({ recipes, onOpen, onAdd, onManageProducts }: Props) {
  const [query, setQuery] = useState('');
  // По умолчанию выбрана «Общие» (рецепты без категории). Ненажатого
  // состояния нет — фильтр всегда по одной из категорий.
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('none');
  const categories = getCategories();

  const filtered = useMemo(() => {
    let list = fuzzyFilter(recipes, query, (r) => r.title);
    if (categoryFilter === 'none') list = list.filter((r) => !r.categoryId);
    else if (categoryFilter !== 'all') list = list.filter((r) => r.categoryId === categoryFilter);
    return list;
  }, [recipes, query, categoryFilter]);

  return (
    <div>
      <input
        className="search"
        placeholder="Поиск по названию…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {categories.length > 0 && (
        <div className="chips">
          <button
            className={`chip${categoryFilter === 'none' ? ' chip-active' : ''}`}
            onClick={() => setCategoryFilter('none')}
          >
            Общие
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip${categoryFilter === c.id ? ' chip-active' : ''}`}
              onClick={() => setCategoryFilter(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

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