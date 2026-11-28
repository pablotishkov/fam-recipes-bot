import { useState } from 'react';
import type { Category } from '../types';

interface Props {
  value: string; // categoryId, '' = «Общие»
  categories: Category[];
  onChange: (categoryId: string) => void;
}

/**
 * Выбор категории рецепта — кастомный bottom-sheet (шторка снизу) в стиле
 * iOS на всех платформах: единообразно на iOS и Android.
 */
export function CategoryPicker({ value, categories, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const selectedName = value
    ? categories.find((c) => c.id === value)?.name ?? 'Общие'
    : 'Общие';

  return (
    <>
      <button
        type="button"
        className="input cat-picker-trigger"
        onClick={() => setOpen(true)}
      >
        <span>{selectedName}</span>
        <span className="cat-picker-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="sheet-overlay" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">Категория</div>
            <button
              type="button"
              className={`sheet-option${value === '' ? ' sheet-option-active' : ''}`}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              <span>Общие</span>
              {value === '' && <span className="sheet-check">✓</span>}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`sheet-option${value === c.id ? ' sheet-option-active' : ''}`}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <span>{c.name}</span>
                {value === c.id && <span className="sheet-check">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}