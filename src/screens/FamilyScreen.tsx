import { useState } from 'react';
import type { Category, Family } from '../types';
import { addCategory, deleteCategory, getCategories, updateCategory } from '../lib/store';
import { BackButton } from '../components/BackButton';

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
  const [cats, setCats] = useState<Category[]>(() => getCategories());
  const [newCat, setNewCat] = useState('');
  const [renames, setRenames] = useState<Record<string, string>>({});

  function refreshCats() {
    setCats(getCategories());
  }

  function addCat() {
    const n = newCat.trim();
    if (!n) return;
    addCategory(n, family.id);
    setNewCat('');
    refreshCats();
  }

  function renameCat(id: string) {
    const n = (renames[id] ?? '').trim();
    if (!n) return;
    updateCategory(id, n, family.id);
    refreshCats();
  }

  function removeCat(id: string) {
    if (!window.confirm('Удалить категорию? Рецепты из неё перейдут в «Общие».')) return;
    deleteCategory(id, family.id);
    refreshCats();
  }

  // Ссылка-приглашение, по которой родные вступят в семью по коду (startapp).
  const inviteLink = `https://t.me/FamReceiptsBot/app?startapp=${family.inviteCode}`;

  function handleSave() {
    if (!name.trim()) return;
    onRename(name.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      // Ссылка и так видна на экране.
    }
  }

  return (
    <div>
      <div className="topbar">
        <BackButton onClick={onBack} />
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
          По этой ссылке родные вступят в семью
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
        <div
          className="muted"
          style={{
            fontSize: 12,
            wordBreak: 'break-all',
            marginBottom: 10,
            color: 'var(--link, #2a6fd8)',
          }}
        >
          {inviteLink}
        </div>
        <button className="btn btn-block" onClick={copyCode}>
          Скопировать ссылку-приглашение
        </button>
      </div>

      <div className="section-title">Категории рецептов</div>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>
        «Общие» — рецепты без категории. Созданные категории появятся на главном
        экране как фильтры.
      </p>

      {cats.map((c) => (
        <div key={c.id} className="row cat-row">
          <input
            className="input"
            value={renames[c.id] ?? c.name}
            placeholder="Название категории"
            onChange={(e) => setRenames((r) => ({ ...r, [c.id]: e.target.value }))}
          />
          <button
            className="btn btn-sm"
            onClick={() => renameCat(c.id)}
            aria-label="Сохранить категорию"
          >
            ✓
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => removeCat(c.id)}
            aria-label="Удалить категорию"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="row cat-row">
        <input
          className="input"
          value={newCat}
          placeholder="Новая категория"
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCat()}
        />
        <button className="btn btn-sm btn-primary" onClick={addCat} aria-label="Добавить категорию">
          +
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