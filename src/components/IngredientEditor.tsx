import { useState } from 'react';
import type { Ingredient, Kbju, Product, Unit } from '../types';
import { UNITS, uid } from '../lib/constants';
import { AmountInput } from './AmountInput';
import { fuzzyFilter } from '../lib/search';

interface Props {
  ingredients: Ingredient[];
  products: Product[];
  onChange: (ingredients: Ingredient[]) => void;
  /** Создаёт новый продукт в базе и возвращает его (нужен для подстановки id). */
  onAddProduct: (product: Omit<Product, 'id'>) => Product;
}

interface KbjuDraft {
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
}

const emptyDraft: KbjuDraft = { calories: '', protein: '', fat: '', carbs: '' };

export function IngredientEditor({ ingredients, products, onChange, onAddProduct }: Props) {
  // Черновики КБЖУ для продуктов, которых нет в базе (ключ — id ингредиента).
  const [drafts, setDrafts] = useState<Record<string, KbjuDraft>>({});
  // Интредиент, у которого открыт выпадающий список продуктов.
  const [openId, setOpenId] = useState<string | null>(null);

  const openIng = ingredients.find((i) => i.id === openId);
  const suggestions =
    openIng && openIng.productName.trim()
      ? fuzzyFilter(products, openIng.productName, (p) => p.name).slice(0, 6)
      : [];

  function update(id: string, patch: Partial<Ingredient>) {
    onChange(ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function add() {
    onChange([...ingredients, { id: uid(), productId: '', productName: '', amount: 0, unit: 'г' }]);
  }

  function remove(id: string) {
    onChange(ingredients.filter((i) => i.id !== id));
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }

  function onProductName(id: string, name: string) {
    const match = products.find(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
    );
    update(id, {
      productName: name,
      productId: match ? match.id : '',
    });
  }

  function saveCustomProduct(id: string, name: string) {
    const draft = drafts[id] ?? emptyDraft;
    const num = (s: string) => (s.trim() === '' ? 0 : Number(s));
    const kbju: Kbju = {
      calories: num(draft.calories),
      protein: num(draft.protein),
      fat: num(draft.fat),
      carbs: num(draft.carbs),
    };
    const product = onAddProduct({ name: name.trim(), kbju });
    update(id, { productId: product.id, productName: product.name });
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }

  return (
    <div>
      {ingredients.length === 0 && (
        <p className="muted">Добавьте ингредиенты, чтобы посчитать КБЖУ блюда.</p>
      )}

      {ingredients.map((ing) => {
        const product = products.find((p) => p.id === ing.productId);
        return (
          <div key={ing.id} className="card" style={{ marginBottom: 8, padding: 12 }}>
            <div className="autocomplete">
              <input
                className="input"
                style={{ width: '100%', marginBottom: 8 }}
                value={ing.productName}
                placeholder="Продукт"
                onChange={(e) => onProductName(ing.id, e.target.value)}
                onFocus={() => setOpenId(ing.id)}
                onBlur={() =>
                  setTimeout(() => setOpenId((cur) => (cur === ing.id ? null : cur)), 150)
                }
              />
              {openId === ing.id && suggestions.length > 0 && (
                <div className="autocomplete-list">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="autocomplete-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onProductName(ing.id, p.name);
                        setOpenId(null);
                      }}
                    >
                      <span className="autocomplete-name">{p.name}</span>
                      <span className="autocomplete-hint">{p.kbju.calories} ккал/100г</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="ingredient-row" style={{ gridTemplateColumns: '1fr 84px 96px 40px' }}>
              <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>Количество</span>
              <AmountInput
                className="input"
                value={ing.amount}
                placeholder="Кол-во"
                onChange={(n) => update(ing.id, { amount: n })}
              />
              <select
                className="input"
                value={ing.unit}
                onChange={(e) => update(ing.id, { unit: e.target.value as Unit })}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-icon btn-danger"
                onClick={() => remove(ing.id)}
                title="Удалить"
              >
                ✕
              </button>
            </div>

            {product ? (
              <div className="muted" style={{ fontSize: 12 }}>
                КБЖУ на 100 г: {product.kbju.calories} ккал · б {product.kbju.protein} ·
                ж {product.kbju.fat} · у {product.kbju.carbs}
              </div>
            ) : ing.productName ? (
              <CustomProductForm
                name={ing.productName}
                draft={drafts[ing.id] ?? emptyDraft}
                onDraft={(d) => setDrafts((prev) => ({ ...prev, [ing.id]: d }))}
                onSave={() => saveCustomProduct(ing.id, ing.productName)}
              />
            ) : null}
          </div>
        );
      })}

      <button className="btn btn-block" onClick={add}>
        Добавить ингредиент
      </button>
    </div>
  );
}

function CustomProductForm({
  name,
  draft,
  onDraft,
  onSave,
}: {
  name: string;
  draft: KbjuDraft;
  onDraft: (d: KbjuDraft) => void;
  onSave: () => void;
}) {
  return (
    <div className="card" style={{ marginTop: 8, padding: 10, background: 'var(--surface-2)' }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
        «{name}» нет в базе — укажите КБЖУ на 100 г и сохраните:
      </div>
      <div className="ingredient-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
        <input className="input" placeholder="ккал" inputMode="decimal" value={draft.calories}
          onChange={(e) => onDraft({ ...draft, calories: e.target.value })} />
        <input className="input" placeholder="белки" inputMode="decimal" value={draft.protein}
          onChange={(e) => onDraft({ ...draft, protein: e.target.value })} />
        <input className="input" placeholder="жиры" inputMode="decimal" value={draft.fat}
          onChange={(e) => onDraft({ ...draft, fat: e.target.value })} />
        <input className="input" placeholder="углев." inputMode="decimal" value={draft.carbs}
          onChange={(e) => onDraft({ ...draft, carbs: e.target.value })} />
      </div>
      <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={onSave}>
        Сохранить в базу продуктов
      </button>
    </div>
  );
}