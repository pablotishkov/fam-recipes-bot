import { useState } from 'react';
import type { FamilyAction } from '../lib/auth';

interface Props {
  /** Создать семью или вступить по коду. Бросает Error при неудаче. */
  onSubmit: (action: FamilyAction) => Promise<void>;
}

/**
 * Экран выбора семьи (Supabase-режим): создать новую или войти по коду.
 * Показывается, когда у пользователя ещё нет семьи.
 */
export function FamilySetup({ onSubmit }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [familyName, setFamilyName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (mode === 'create') {
      if (!familyName.trim()) {
        setError('Укажите название семьи, например «Тишковы»');
        return;
      }
    } else {
      if (!code.trim()) {
        setError('Введите код-приглашение');
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(
        mode === 'create' ? { familyName: familyName.trim() } : { joinCode: code.trim().toUpperCase() },
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <h1>Семейные рецепты 🍳</h1>
      <p className="muted" style={{ textAlign: 'center', marginTop: -8 }}>
        Создайте семью или войдите по коду-приглашению
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={`btn ${mode === 'create' ? 'btn-primary' : ''}`}
          disabled={busy}
          onClick={() => {
            setMode('create');
            setError('');
          }}
        >
          Создать семью
        </button>
        <button
          className={`btn ${mode === 'join' ? 'btn-primary' : ''}`}
          disabled={busy}
          onClick={() => {
            setMode('join');
            setError('');
          }}
        >
          Войти по коду
        </button>
      </div>

      {mode === 'create' ? (
        <div className="field">
          <label>Название семьи</label>
          <input
            className="input"
            value={familyName}
            disabled={busy}
            onChange={(e) => {
              setFamilyName(e.target.value);
              setError('');
            }}
            placeholder="Например, Тишковы"
          />
          <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={handleSubmit}>
            {busy ? 'Создаём…' : 'Создать семью и начать'}
          </button>
        </div>
      ) : (
        <div className="field">
          <label>Код-приглашение</label>
          <input
            className="input"
            value={code}
            disabled={busy}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="Например ABC123"
            maxLength={8}
          />
          <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={handleSubmit}>
            {busy ? 'Входим…' : 'Присоединиться'}
          </button>
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}