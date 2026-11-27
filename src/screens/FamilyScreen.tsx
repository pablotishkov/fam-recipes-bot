import { useState } from 'react';
import type { Family } from '../types';

interface Props {
  family: Family;
  onBack: () => void;
  onLeave: () => void;
  /** Переименование семьи (в Supabase-режиме — в БД, иначе — localStorage). */
  onRename: (name: string) => void;
}

export function FamilyScreen({ family, onBack, onLeave, onRename }: Props) {
  const [name, setName] = useState(family.name);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!name.trim()) return;
    onRename(name.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(family.inviteCode);
    } catch {
      // Код и так виден на экране.
    }
  }

  return (
    <div>
      <div className="topbar">
        <button className="btn btn-icon" onClick={onBack} aria-label="Назад">
          ←
        </button>
        <h1 style={{ fontSize: 17 }}>Настройки семьи</h1>
        <span style={{ width: 48 }} />
      </div>

      <div className="field">
        <label>Название семьи</label>
        <input
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder="Например, Тишковы"
        />
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 10 }}
          onClick={handleSave}
        >
          {saved ? '✓ Сохранено' : 'Сохранить'}
        </button>
      </div>

      <div className="section-title">Код-приглашение</div>
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
          По этому коду родные войдут в семью
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: 5,
            background: 'var(--surface-2)',
            borderRadius: 10,
            padding: '10px 0',
            marginBottom: 10,
          }}
        >
          {family.inviteCode}
        </div>
        <button className="btn btn-block" onClick={copyCode}>
          Скопировать код
        </button>
      </div>

      <div className="section-title">Участники</div>
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          Все члены семьи видят и редактируют общие рецепты. Приглашайте новых по
          коду выше.
        </p>
      </div>

      <div className="section-title">Выход</div>
      <button
        className="btn btn-danger btn-block"
        onClick={() => {
          if (window.confirm('Выйти из семьи и вернуться к экрану входа?')) onLeave();
        }}
      >
        Выйти из семьи
      </button>
    </div>
  );
}