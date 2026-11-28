import { useRef, useState } from 'react';
import type { Product } from '../types';
import { addProduct, getProducts, updateProduct } from '../lib/store';
import { formatKbju } from '../lib/nutrition';
import { fuzzyFilter } from '../lib/search';
import { BackButton } from '../components/BackButton';

interface Props {
  onBack: () => void;
  familyId?: string;
}

interface Draft {
  name: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  gramsShp: string;
  gramsBank: string;
}

const emptyDraft: Draft = {
  name: '',
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  gramsShp: '',
  gramsBank: '',
};

export function ProductsScreen({ onBack, familyId }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  const products = getProducts();
  const filtered = fuzzyFilter(products, query, (p) => p.name);

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setDraft({
      name: p.name,
      calories: String(p.kbju.calories),
      protein: String(p.kbju.protein),
      fat: String(p.kbju.fat),
      carbs: String(p.kbju.carbs),
      gramsShp: p.gramsPerUnit?.шт != null ? String(p.gramsPerUnit.шт) : '',
      gramsBank: p.gramsPerUnit?.банка != null ? String(p.gramsPerUnit.банка) : '',
    });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  }

  /** Переключение: повторный клик по открытому продукту закрывает форму. */
  function toggleEdit(p: Product) {
    if (showForm && editingId === p.id) closeForm();
    else openEdit(p);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setDraft(emptyDraft);
  }

  function handleSave() {
    const num = (s: string) => (s.trim() === '' ? 0 : Number(s));
    if (!draft.name.trim()) return;
    const kbju = {
      calories: num(draft.calories),
      protein: num(draft.protein),
      fat: num(draft.fat),
      carbs: num(draft.carbs),
    };
    const gramsPerUnit: Product['gramsPerUnit'] = {};
    const shp = num(draft.gramsShp);
    const bank = num(draft.gramsBank);
    if (shp > 0) gramsPerUnit.шт = shp;
    if (bank > 0) gramsPerUnit.банка = bank;

    if (editingId) {
      updateProduct(
        {
          id: editingId,
          name: draft.name.trim(),
          kbju,
          gramsPerUnit: Object.keys(gramsPerUnit).length ? gramsPerUnit : undefined,
        },
        familyId,
      );
    } else {
      addProduct(
        {
          name: draft.name.trim(),
          kbju,
          gramsPerUnit: Object.keys(gramsPerUnit).length ? gramsPerUnit : undefined,
        },
        familyId,
      );
    }
    closeForm();
  }

  return (
    <div>
      <div className="topbar">
        <BackButton onClick={onBack} />
        <h1 style={{ fontSize: 17 }}>База продуктов</h1>
        <button className="btn btn-icon btn-primary" onClick={openAdd}>
          +
        </button>
      </div>

      {/* Форма добавления — под верхней панелью */}
      {showForm && !editingId && <ProductForm draft={draft} setDraft={setDraft} editing={false} onSave={handleSave} onCancel={closeForm} formRef={formRef} />}

      <input
        className="search"
        placeholder="Поиск продукта…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.map((p) => (
        <div key={p.id}>
          <button
            className="card"
            style={{ marginBottom: 8, padding: 12, width: '100%', textAlign: 'left' }}
            onClick={() => toggleEdit(p)}
            title="Нажмите, чтобы изменить"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span className="badge">{p.kbju.calories} ккал</span>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Б {formatKbju(p.kbju.protein)} · Ж {formatKbju(p.kbju.fat)} · У{' '}
              {formatKbju(p.kbju.carbs)} (на 100 г)
            </div>
            {(p.gramsPerUnit?.шт != null || p.gramsPerUnit?.банка != null) && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {p.gramsPerUnit?.шт != null && `1 шт = ${p.gramsPerUnit.шт} г`}
                {p.gramsPerUnit?.шт != null && p.gramsPerUnit?.банка != null && ' · '}
                {p.gramsPerUnit?.банка != null && `1 банка = ${p.gramsPerUnit.банка} г`}
              </div>
            )}
          </button>

          {/* Форма редактирования — сразу под выбранным продуктом */}
          {showForm && editingId === p.id && (
            <ProductForm draft={draft} setDraft={setDraft} editing onSave={handleSave} onCancel={closeForm} formRef={formRef} />
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="empty" style={{ padding: 24 }}>
          {query.trim()
            ? 'Ничего не найдено по запросу.'
            : 'Продуктов пока нет. Добавьте первый через кнопку +.'}
        </p>
      )}
    </div>
  );
}

function ProductForm({
  draft,
  setDraft,
  editing,
  onSave,
  onCancel,
  formRef,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  editing: boolean;
  onSave: () => void;
  onCancel: () => void;
  formRef?: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div ref={formRef} className="card" style={{ marginBottom: 12 }}>
      <div className="field">
        <label>Название продукта</label>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Например, Киноа"
        />
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
        КБЖУ на 100 г:
      </div>
      <div className="ingredient-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
        <input className="input" placeholder="ккал" inputMode="decimal" value={draft.calories}
          onChange={(e) => setDraft({ ...draft, calories: e.target.value })} />
        <input className="input" placeholder="белки" inputMode="decimal" value={draft.protein}
          onChange={(e) => setDraft({ ...draft, protein: e.target.value })} />
        <input className="input" placeholder="жиры" inputMode="decimal" value={draft.fat}
          onChange={(e) => setDraft({ ...draft, fat: e.target.value })} />
        <input className="input" placeholder="углев." inputMode="decimal" value={draft.carbs}
          onChange={(e) => setDraft({ ...draft, carbs: e.target.value })} />
      </div>

      <div className="muted" style={{ fontSize: 13, margin: '12px 0 6px' }}>
        Вес одной единицы (необязательно, для невесовых единиц):
      </div>
      <div className="ingredient-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <input className="input" placeholder="г в 1 шт" inputMode="decimal" value={draft.gramsShp}
          onChange={(e) => setDraft({ ...draft, gramsShp: e.target.value })} />
        <input className="input" placeholder="г в 1 банке" inputMode="decimal" value={draft.gramsBank}
          onChange={(e) => setDraft({ ...draft, gramsBank: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onSave}>
          {editing ? 'Сохранить' : 'Добавить в базу'}
        </button>
        <button className="btn" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}