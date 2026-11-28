import { useState } from 'react';
import { applyAccent, DEFAULT_ACCENT, getAccent, saveAccent } from '../lib/prefs';
import type { SessionUser } from '../types';
import { currentColorScheme } from '../lib/telegram';
import { BackButton } from '../components/BackButton';

interface Props {
  user: SessionUser;
  onBack: () => void;
}

/**
 * Персональные настройки пользователя. Применяются конкретно к пользователю,
 * независимо от семьи. Акцентный цвет: оттенок (градиентный ползунок), его
 * глубина (светлота) и насыщенность.
 */
export function PersonalizationScreen({ user, onBack }: Props) {
  const [hue, setHue] = useState(() => getAccent(user.id).hue);
  const [light, setLight] = useState(() => getAccent(user.id).light);
  const [sat, setSat] = useState(() => getAccent(user.id).sat);

  function apply(h: number, l: number, s: number) {
    const accent = { hue: h, light: l, sat: s };
    saveAccent(user.id, accent);
    applyAccent(accent, currentColorScheme());
  }

  function reset() {
    setHue(DEFAULT_ACCENT.hue);
    setLight(DEFAULT_ACCENT.light);
    setSat(DEFAULT_ACCENT.sat);
    apply(DEFAULT_ACCENT.hue, DEFAULT_ACCENT.light, DEFAULT_ACCENT.sat);
  }

  // Градиент трека ползунка оттенка — радуга.
  const hueTrack = `linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)`;
  // Градиент трека глубины — от тёмного к светлому того же оттенка и насыщенности.
  const depthTrack = `linear-gradient(to right, hsl(${hue} ${sat}% 20%), hsl(${hue} ${sat}% 60%))`;
  // Градиент трека насыщенности — от серого/белого к максимально цветному.
  const satTrack = `linear-gradient(to right, hsl(${hue} 0% ${light}%), hsl(${hue} 100% ${light}%))`;

  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="topbar">
        <BackButton onClick={onBack} />
        <h1 style={{ fontSize: 17 }}>Персонализация</h1>
        <span style={{ width: 48 }} />
      </div>

      <div className="field">
        <label>Цвет кнопок</label>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
          Выберите цвет акцента — он используется на кнопках, чипсах, в КБЖУ и
          других местах приложения.
        </p>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={hue}
          onChange={(e) => {
            const v = Number(e.target.value);
            setHue(v);
            apply(v, light, sat);
          }}
          className="range-hue"
          style={{ background: hueTrack }}
          aria-label="Оттенок цвета"
        />
      </div>

      <div className="field">
        <label>Глубина цвета</label>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
          Насколько тёмным будет цвет.
        </p>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={light}
          onChange={(e) => {
            const v = Number(e.target.value);
            setLight(v);
            apply(hue, v, sat);
          }}
          className="range-depth"
          style={{ background: depthTrack }}
          aria-label="Глубина цвета"
        />
      </div>

      <div className="field">
        <label>Насыщенность</label>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
          От серого/белого до максимально цветного.
        </p>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={sat}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSat(v);
            apply(hue, light, v);
          }}
          className="range-sat"
          style={{ background: satTrack }}
          aria-label="Насыщенность цвета"
        />
      </div>

      <div className="field">
        <label>Предпросмотр</label>
        <div className="card" style={{ textAlign: 'center' }}>
          <button className="btn btn-primary btn-block" type="button">
            Кнопка
          </button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
            <span className="chip chip-active">Чипс</span>
            <span className="kbju-chip">
              <span className="v" style={{ color: 'var(--primary)' }}>
                350
              </span>
              <span className="l">ккал</span>
            </span>
          </div>
        </div>
      </div>

      <button className="btn btn-block" onClick={reset}>
        Сбросить к зелёному
      </button>
    </div>
  );
}