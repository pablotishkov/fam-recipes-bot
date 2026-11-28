import type { RecipeStep } from '../types';
import { uid } from '../lib/constants';
import { PhotoField } from './PhotoField';

interface Props {
  steps: RecipeStep[];
  onChange: (steps: RecipeStep[]) => void;
  /** Асинхронная загрузка фото шага (сжатие + Storage). */
  onUpload?: (file: File) => Promise<string>;
}

export function StepsEditor({ steps, onChange, onUpload }: Props) {
  function update(id: string, patch: Partial<RecipeStep>) {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function add() {
    onChange([...steps, { id: uid(), text: '' }]);
  }

  function remove(id: string) {
    onChange(steps.filter((s) => s.id !== id));
  }

  return (
    <div>
      {steps.map((step, i) => (
        <div key={step.id} className="card" style={{ marginBottom: 10, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong>Шаг {i + 1}</strong>
            <button className="btn btn-sm btn-danger" onClick={() => remove(step.id)}>
              Удалить
            </button>
          </div>
          <textarea
            className="textarea"
            style={{ minHeight: 70 }}
            value={step.text}
            onChange={(e) => update(step.id, { text: e.target.value })}
            placeholder="Что сделать на этом шаге…"
          />
          <div style={{ marginTop: 8 }}>
            <PhotoField
              value={step.photoUrl}
              onChange={(dataUrl) => update(step.id, { photoUrl: dataUrl })}
              label="Фото шага (необязательно)"
              onUpload={onUpload}
            />
          </div>
        </div>
      ))}

      <button className="btn btn-block" onClick={add}>
        Добавить шаг
      </button>
    </div>
  );
}