import type { Recipe } from '../types';

interface Props {
  recipe: Recipe;
  onClick: () => void;
}

const THUMB_SIZE = 56;

export function RecipeCard({ recipe, onClick }: Props) {
  const count = recipe.ingredients.length;
  return (
    <button className="card recipe-card" onClick={onClick}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: 10,
            flexShrink: 0,
            overflow: 'hidden',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
          }}
        >
          {recipe.photoUrl ? (
            <img
              src={recipe.photoUrl}
              alt={recipe.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <span aria-hidden>🍽</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="title">{recipe.title || 'Без названия'}</div>
          <div className="meta">
            {count > 0 ? `${count} ${pluralIng(count)}` : 'Нет ингредиентов'}
          </div>
        </div>
      </div>
    </button>
  );
}

function pluralIng(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ингредиент';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'ингредиента';
  return 'ингредиентов';
}