// Персональные настройки пользователя. Применяются конкретно к пользователю,
// независимо от семьи (в отличие от категорий/рецептов, которые семейные).

/** Акцентный цвет приложения. */
export interface AccentPrefs {
  /** Оттенок (0–360), «градиентный цвет». */
  hue: number;
  /** Глубина/светлота (0–100), управляет тем, насколько цвет тёмный. */
  light: number;
  /** Насыщенность (0–100): от серого/белого до максимально цветного. */
  sat: number;
}

/** Текущий зелёный — значение по умолчанию (светлая тема). */
export const DEFAULT_ACCENT: AccentPrefs = { hue: 157, light: 34, sat: 45 };

const PREFS_PREFIX = 'famr:prefs:';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function hsl(hue: number, sat: number, light: number): string {
  return `hsl(${Math.round(hue)} ${Math.round(sat)}% ${Math.round(light)}%)`;
}

/** Акцентные настройки пользователя (или дефолт, если ещё не заданы). */
export function getAccent(userId: string): AccentPrefs {
  try {
    const raw = localStorage.getItem(`${PREFS_PREFIX}${userId}`);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AccentPrefs>;
      if (typeof p.hue === 'number' && typeof p.light === 'number') {
        return {
          hue: clamp(p.hue, 0, 360),
          light: clamp(p.light, 0, 100),
          sat: typeof p.sat === 'number' ? clamp(p.sat, 0, 100) : DEFAULT_ACCENT.sat,
        };
      }
    }
  } catch {
    // Испорченные данные — игнорируем, вернём дефолт.
  }
  return { ...DEFAULT_ACCENT };
}

/** Сохранить акцентные настройки пользователя. */
export function saveAccent(userId: string, accent: AccentPrefs): void {
  try {
    localStorage.setItem(`${PREFS_PREFIX}${userId}`, JSON.stringify(accent));
  } catch {
    // localStorage недоступен — пропускаем.
  }
}

/** Применить акцент на CSS-переменные (--primary / --primary-2) с учётом темы. */
export function applyAccent(accent: AccentPrefs, scheme: 'light' | 'dark'): void {
  const el = document.documentElement;
  // В тёмной теме фон темнее, поэтому тот же цвет делаем светлее.
  const sat = accent.sat + (scheme === 'dark' ? 5 : 0);
  const base = scheme === 'dark' ? clamp(accent.light + 16, 15, 90) : clamp(accent.light, 15, 90);
  const secondary = clamp(base - 9, 12, 85);
  el.style.setProperty('--primary', hsl(accent.hue, sat, base));
  el.style.setProperty('--primary-2', hsl(accent.hue, sat, secondary));
}