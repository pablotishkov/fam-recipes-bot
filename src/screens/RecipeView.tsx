import { useMemo, useState } from 'react';
import type { Ingredient, Product, Recipe } from '../types';
import { rescaleIngredients, sumKbju } from '../lib/nutrition';
import { KbjuBar } from '../components/KbjuBar';
import { AmountInput } from '../components/AmountInput';
import { getCategories } from '../lib/store';

interface Props {
  recipe: Recipe;
  products: Product[];
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

export function RecipeView({ recipe, products, onEdit, onDelete, onBack }: Props) {
  const category = recipe.categoryId
    ? getCategories().find((c) => c.id === recipe.categoryId)
    : undefined;
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Базовые (как сохранено) — от них считается масштабирование.
  const base = useMemo<Ingredient[]>(() => recipe.ingredients, [recipe.ingredients]);
  const [display, setDisplay] = useState<Ingredient[]>(base);
  const [isScaled, setIsScaled] = useState(false);

  const total = useMemo(() => sumKbju(display, productsById), [display, productsById]);

  function changeAmount(id: string, newAmount: number) {
    if (!isFinite(newAmount) || newAmount <= 0) return;
    const { ingredients, factor } = rescaleIngredients(base, id, newAmount);
    setDisplay(ingredients);
    setIsScaled(Math.abs(factor - 1) > 0.0001);
  }

  function reset() {
    setDisplay(base);
    setIsScaled(false);
  }

  return (
    <div>
      <div className="topbar">
        <button className="btn btn-icon" onClick={onBack} aria-label="Назад">
          ←
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={onEdit}>
            ✏️
          </button>
          <button className="btn btn-sm btn-danger" onClick={onDelete}>
            🗑
          </button>
        </div>
      </div>

      <h1 style={{ fontSize: 22 }}>{recipe.title}</h1>

      {category && (
        <span className="chip view-category" title={`Категория: ${category.name}`}>
          {category.name}
        </span>
      )}

      {recipe.photoUrl && (
        <img
          src={recipe.photoUrl}
          alt={recipe.title}
          style={{ width: '100%', borderRadius: 14, marginBottom: 12, objectFit: 'cover' }}
        />
      )}

      <div className="section-title" style={{ marginTop: 0 }}>Ингредиенты</div>

      {display.map((ing) => {
        const product = productsById.get(ing.productId);
        return (
          <div
            key={ing.id}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
          >
            <AmountInput
              className="input"
              value={ing.amount}
              onChange={(n) => changeAmount(ing.id, n)}
              style={{ width: 84, textAlign: 'center' }}
              title="Измените количество, чтобы пересчитать пропорции всего блюда"
            />
            <span style={{ width: 76, color: 'var(--text-2)' }}>{ing.unit}</span>
            <span style={{ fontWeight: 600 }}>
              {product?.name ?? ing.productName}
            </span>
          </div>
        );
      })}

      <div className="section-title">КБЖУ блюда</div>
      <KbjuBar total={total} />

      {isScaled && (
        <button className="btn btn-sm" onClick={reset}>
          Вернуть исходные пропорции
        </button>
      )}

      <p className="muted" style={{ fontSize: 13 }}>
        Измените количество любого ингредиента — остальные пересчитаются
        пропорционально.
      </p>

      {recipe.description && (
        <>
          <div className="section-title">Описание</div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{recipe.description}</p>
        </>
      )}

      {(recipe.steps?.length ?? 0) > 0 && (
        <>
          <div className="section-title">Приготовление</div>
          {recipe.steps!.map((step, i) => (
            <div key={step.id} className="card" style={{ marginBottom: 10, padding: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{step.text}</p>
                  {step.photoUrl && (
                    <img
                      src={step.photoUrl}
                      alt={`Шаг ${i + 1}`}
                      style={{
                        width: '100%',
                        maxHeight: 260,
                        objectFit: 'cover',
                        borderRadius: 10,
                        marginTop: 10,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}