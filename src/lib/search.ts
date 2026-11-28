/**
 * Fuzzy-поиск без внешних зависимостей.
 *
 * Логика: нормализуем регистр (lowercase), затем для цели считаем лучший
 * результат из (подстроки / префикса / похожести Дамерау–Левенштейна).
 * Дамерау–Левенштейн ловит перестановки соседних букв (тип «вечтина» →
 * «ветчина»), вставки/удаления (тип «етчнина» → «ветчина»).
 */

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Расстояние Дамерау–Левенштейна (включая транспозицию соседних символов). */
function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

/** Похожесть одной строки-кандидата на запрос: 1 — точно, >=0 — близко, -1 — мимо. */
function scoreOne(q: string, t: string): number {
  if (t === q) return 1;
  if (t.includes(q)) return 0.95; // подстрока (регистронезависимо)
  if (t.startsWith(q)) return 0.92; // префикс
  const dist = damerauLevenshtein(q, t);
  const maxLen = Math.max(q.length, t.length);
  return 1 - dist / maxLen;
}

/**
 * Скоринг запроса против цели (учитывает и всю цель, и отдельные слова цели).
 * Возвращает число от -1 (нет совпадения) до 1 (точное совпадение).
 */
export function fuzzyScore(rawQuery: string, rawTarget: string): number {
  const q = norm(rawQuery);
  const t = norm(rawTarget);
  if (!q) return 0;
  if (!t) return -1;
  const candidates = [t, ...t.split(' ')].filter(Boolean);
  let best = -1;
  for (const c of candidates) {
    const s = scoreOne(q, c);
    if (s > best) best = s;
  }
  return best;
}

/** Фильтрует массив по fuzzyScore >= threshold (по умолчанию 0.5). */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  pick: (item: T) => string,
  threshold = 0.5,
): T[] {
  if (!query.trim()) return [...items];
  const scored = items
    .map((it) => ({ it, score: fuzzyScore(query, pick(it)) }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.it);
}