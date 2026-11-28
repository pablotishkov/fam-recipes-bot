import type { Product } from '../types';

/** Детерминированный валидный UUID v4 из строки (стабилен между устройствами). */
function stableUuid(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bytes = new Uint8Array(16);
  let state = h;
  for (let i = 0; i < 16; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    bytes[i] = state & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * База продуктов с КБЖУ на 100 г. Расширяется вручную из интерфейса.
 * Значения типичные из открытых источников (ФНЦ питания и др.), округлены.
 *
 * id у стандартных продуктов — стабильный UUID, полученный из slug. Он нужен,
 * чтобы стандартные продукты могли записываться в общую БД (колонка id — uuid)
 * и правки синхронизировались между членами семьи.
 */
const rawSeed: Array<Omit<Product, 'id'> & { id: string }> = [
  { id: 'p-muka', name: 'Мука пшеничная', kbju: { calories: 334, protein: 10.3, fat: 1.1, carbs: 69 } },
  { id: 'p-sahar', name: 'Сахар', kbju: { calories: 398, protein: 0, fat: 0, carbs: 99.8 } },
  { id: 'p-maslo', name: 'Масло сливочное', kbju: { calories: 748, protein: 0.8, fat: 82.5, carbs: 0.8 }, gramsPerUnit: { 'ст. ложка': 20, 'ч. ложка': 7, стакан: 200 } },
  { id: 'p-maslo-pod', name: 'Масло подсолнечное', kbju: { calories: 899, protein: 0, fat: 99.9, carbs: 0 }, gramsPerUnit: { 'ст. ложка': 17, 'ч. ложка': 5, стакан: 210 } },
  { id: 'p-yajco', name: 'Яйцо куриное', kbju: { calories: 157, protein: 12.7, fat: 11.5, carbs: 0.7 }, gramsPerUnit: { шт: 55 } },
  { id: 'p-moloko', name: 'Молоко 2,5%', kbju: { calories: 54, protein: 2.9, fat: 2.5, carbs: 4.8 } },
  { id: 'p-slivki', name: 'Сливки 20%', kbju: { calories: 209, protein: 2.5, fat: 20, carbs: 4.2 } },
  { id: 'p-tvorog', name: 'Творог 5%', kbju: { calories: 121, protein: 17, fat: 5, carbs: 1.8 } },
  { id: 'p-syr', name: 'Сыр твёрдый', kbju: { calories: 352, protein: 24.1, fat: 29.5, carbs: 0.3 } },
  { id: 'p-kurica', name: 'Куриное филе', kbju: { calories: 165, protein: 31, fat: 3.6, carbs: 0 } },
  { id: 'p-govyadina', name: 'Говядина', kbju: { calories: 187, protein: 19, fat: 12.4, carbs: 0 } },
  { id: 'p-svinina', name: 'Свинина', kbju: { calories: 259, protein: 16, fat: 21.6, carbs: 0 } },
  { id: 'p-losos', name: 'Лосось', kbju: { calories: 142, protein: 19.8, fat: 6.3, carbs: 0 } },
  { id: 'p-kartofel', name: 'Картофель', kbju: { calories: 77, protein: 2, fat: 0.4, carbs: 16.3 } },
  { id: 'p-ris', name: 'Рис белый', kbju: { calories: 344, protein: 6.7, fat: 0.7, carbs: 78.9 } },
  { id: 'p-grechka', name: 'Гречка', kbju: { calories: 313, protein: 12.6, fat: 3.3, carbs: 62.1 } },
  { id: 'p-ovsjanka', name: 'Овсяные хлопья', kbju: { calories: 352, protein: 12.3, fat: 6.1, carbs: 59.5 } },
  { id: 'p-makaron', name: 'Макароны', kbju: { calories: 352, protein: 13, fat: 1.5, carbs: 70.5 } },
  { id: 'p-hleb', name: 'Хлеб', kbju: { calories: 265, protein: 8, fat: 3, carbs: 50 } },
  { id: 'p-baklajan', name: 'Баклажан', kbju: { calories: 24, protein: 1, fat: 0.1, carbs: 5.7 } },
  { id: 'p-pomidor', name: 'Помидор', kbju: { calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9 } },
  { id: 'p-ogurec', name: 'Огурец', kbju: { calories: 15, protein: 0.8, fat: 0.1, carbs: 2.8 } },
  { id: 'p-luk', name: 'Лук репчатый', kbju: { calories: 40, protein: 1.1, fat: 0.2, carbs: 8.2 } },
  { id: 'p-chesnok', name: 'Чеснок', kbju: { calories: 149, protein: 6.4, fat: 0.5, carbs: 33 } },
  { id: 'p-morkov', name: 'Морковь', kbju: { calories: 33, protein: 1.3, fat: 0.1, carbs: 6.9 } },
  { id: 'p-maslina', name: 'Оливки', kbju: { calories: 115, protein: 0.8, fat: 10.7, carbs: 6.3 } },
  { id: 'p-smetana', name: 'Сметана 15%', kbju: { calories: 162, protein: 2.6, fat: 15, carbs: 3.6 } },
  { id: 'p-med', name: 'Мёд', kbju: { calories: 329, protein: 0.8, fat: 0, carbs: 81.5 }, gramsPerUnit: { 'ст. ложка': 30, 'ч. ложка': 10, стакан: 330 } },
  { id: 'p-muka-ris', name: 'Мука рисовая', kbju: { calories: 366, protein: 5.8, fat: 1.4, carbs: 80 } },
  { id: 'p-kakao', name: 'Какао-порошок', kbju: { calories: 374, protein: 24, fat: 17.5, carbs: 28.8 } },
  { id: 'p-shokolad', name: 'Шоколад тёмный', kbju: { calories: 539, protein: 6.2, fat: 35.4, carbs: 48.2 } },
  { id: 'p-jablo', name: 'Яблоко', kbju: { calories: 47, protein: 0.4, fat: 0.4, carbs: 9.8 } },
  { id: 'p-banan', name: 'Банан', kbju: { calories: 89, protein: 1.1, fat: 0.3, carbs: 22.8 } },
  { id: 'p-malina', name: 'Малина', kbju: { calories: 52, protein: 1.2, fat: 0.7, carbs: 11.9 } },
  { id: 'p-grib', name: 'Шампиньоны', kbju: { calories: 27, protein: 4.3, fat: 1, carbs: 0.1 } },
  { id: 'p-tomat-pasta', name: 'Томатная паста', kbju: { calories: 82, protein: 4.8, fat: 0.5, carbs: 14 } },
  { id: 'p-solev', name: 'Соль', kbju: { calories: 0, protein: 0, fat: 0, carbs: 0 } },
  { id: 'p-perec', name: 'Перец чёрный', kbju: { calories: 251, protein: 10, fat: 3.3, carbs: 64 } },
  { id: 'p-drozhzhi', name: 'Дрожжи сухие', kbju: { calories: 325, protein: 49, fat: 6, carbs: 41 } },
];

/** Стандартные продукты со стабильными UUID id (детерминированно из slug). */
export const seedProducts: Product[] = rawSeed.map((p) => ({
  ...p,
  id: stableUuid(p.id),
}));