import { useState } from 'react';
import type { SessionUser } from '../types';
import { createFamily, joinFamilyByCode } from '../lib/store';
import { uid } from '../lib/constants';

interface Props {
  defaultName: string;
  onDone: (user: SessionUser) => void;
}

export function Onboarding({ defaultName, onDone }: Props) {
  const [name, setName] = useState(defaultName);
  const [familyName, setFamilyName] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState('');
  const [error, setError] = useState('');

  function handleCreate() {
    if (!familyName.trim()) {
      setError('Укажите название семьи, например «Тишковы»');
      return;
    }
    const user: SessionUser = { id: uid(), name: name.trim() || 'Гость' };
    const { family, user: updated } = createFamily(familyName, user);
    setShowCode(family.inviteCode);
    onDone(updated);
  }

  function handleJoin() {
    if (!code.trim()) {
      setError('Введите код-приглашение');
      return;
    }
    const user: SessionUser = { id: uid(), name: name.trim() || 'Гость' };
    const result = joinFamilyByCode(code, user);
    if (!result) {
      setError('Семья с таким кодом не найдена. Проверьте код.');
      return;
    }
    onDone(result.user);
  }

  return (
    <div className="center">
      <h1>Семейные рецепты 🍳</h1>
      <p className="muted" style={{ textAlign: 'center', marginTop: -8 }}>
        Общие рецепты для всей семьи
      </p>

      <div className="field">
        <label>Ваше имя</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как вас зовут?"
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={`btn ${mode === 'create' ? 'btn-primary' : ''}`}
          onClick={() => {
            setMode('create');
            setError('');
          }}
        >
          Создать семью
        </button>
        <button
          className={`btn ${mode === 'join' ? 'btn-primary' : ''}`}
          onClick={() => {
            setMode('join');
            setError('');
          }}
        >
          Войти по коду
        </button>
      </div>

      {mode === 'create' ? (
        <>
          <div className="field">
            <label>Название семьи</label>
            <input
              className="input"
              value={familyName}
              onChange={(e) => {
                setFamilyName(e.target.value);
                setError('');
              }}
              placeholder="Например, Тишковы"
            />
          </div>
          <button className="btn btn-primary btn-block" onClick={handleCreate}>
            Создать семью и начать
          </button>
        </>
      ) : (
        <div className="field">
          <label>Код-приглашение</label>
          <input
            className="input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="Например ABC123"
            maxLength={8}
          />
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 10 }}
            onClick={handleJoin}
          >
            Присоединиться
          </button>
        </div>
      )}

      {showCode && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="muted" style={{ marginBottom: 6 }}>
            Код вашей семьи
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4 }}>{showCode}</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Поделитесь кодом с семьёй — по нему они присоединятся к этой семье.
            Позже код можно снова посмотреть в приложении.
          </p>
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}