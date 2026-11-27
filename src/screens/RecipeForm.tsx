import { useMemo, useState } from 'react';
import type { Ingredient, Recipe, RecipeStep, SessionUser } from '../types';
import { addProduct, getProducts } from '../lib/store';
import { uid } from '../lib/constants';
import { sumKbju } from '../lib/nutrition';
import { IngredientEditor } from '../components/IngredientEditor';
import { KbjuBar } from '../components/KbjuBar';
import { PhotoField } from '../components/PhotoField';
import { StepsEditor } from '../components/StepsEditor';

interface Props {
  initial?: Recipe;
  user: SessionUser;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}

export function RecipeForm({ initial, user, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initial?.photoUrl);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initial?.ingredients ?? [],
  );
  const [steps, setSteps] = useState<RecipeStep[]>(initial?.steps ?? []);

  const products = getProducts();
  const productsById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const total = useMemo(() => sumKbju(ingredients, productsById), [ingredients, productsById]);

  function handleSave() {
    if (!title.trim()) return;
    const now = Date.now();
    const recipe: Recipe = {
      id: initial?.id ?? uid(),
      title: title.trim(),
      description: description.trim(),
      photoUrl,
      ingredients: ingredients.filter((i) => i.productName.trim()),
      steps: steps.filter((s) => s.text.trim()),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      familyId: user.familyId,
      createdBy: initial?.createdBy ?? user.id,
    };
    onSave(recipe);
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="topbar">
        <button className="btn btn-icon" onClick={onCancel} aria-label="Назад">
          ←
        </button>
        <h1 style={{ fontSize: 17 }}>{initial ? 'Редактировать' : 'Новый рецепт'}</h1>
        <button className="btn btn-sm btn-primary" onClick={handleSave}>
          Сохранить
        </button>
      </div>

      <div className="field">
        <label>Название</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например, Сырники"
        />
      </div>

      <div className="field">
        <label>Фото блюда</label>
        <PhotoField value={photoUrl} onChange={setPhotoUrl} label="Добавить фото из галереи" />
      </div>

      <div className="section-title">Ингредиенты и КБЖУ</div>
      <IngredientEditor
        ingredients={ingredients}
        products={products}
        onChange={setIngredients}
        onAddProduct={(p) => addProduct(p)}
      />

      {ingredients.some((i) => i.productName) && <KbjuBar total={total} />}

      <div className="field" style={{ marginTop: 16 }}>
        <label>Описание</label>
        <textarea
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Кратко о блюде…"
        />
      </div>

      <div className="section-title">Приготовление</div>
      <StepsEditor steps={steps} onChange={setSteps} />
    </div>
  );
}