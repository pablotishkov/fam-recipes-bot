import { isSupabaseConfigured, supabase } from './supabase';
import { uid } from './constants';

/** Имя bucket в Supabase Storage для фото рецептов/шагов. */
export const PHOTO_BUCKET = 'recipe-photos';

/** Максимальная сторона сжатого изображения (px). */
const MAX_SIDE = 900;
/** Качество JPEG. */
const JPEG_QUALITY = 0.8;

/**
 * Сжимает изображение в JPEG через canvas (ресайз до MAX_SIDE + качество).
 * Возвращает Blob. Всегда меньше исходника — не переполняет localStorage/БД.
 */
export function compressImage(
  file: Blob,
  maxSide = MAX_SIDE,
  quality = JPEG_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas не поддерживается'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось сжать изображение'))),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = objectUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать изображение'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Подготовка фото к сохранению: всегда сжимает.
 * - Supabase-режим: загружает файл в Storage, возвращает публичный URL.
 * - Демо-режим (без БД/семьи): возвращает dataURL сжатого изображения.
 */
export async function uploadRecipePhoto(file: File, familyId?: string): Promise<string> {
  const compressed = await compressImage(file);
  if (!isSupabaseConfigured || !supabase || !familyId) {
    return blobToDataUrl(compressed);
  }
  const path = `${familyId}/${uid()}.jpg`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Извлекает путь файла внутри нашего bucket из публичного URL.
 * Для base64/dataURL и URL других bucket возвращает null.
 */
function pathFromPublicUrl(url?: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${PHOTO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length).split('?')[0];
}

/** Пути файлов нашего bucket из списка URL (не-наши/base64 игнорируются). */
export function storagePathsFromUrls(urls: Array<string | undefined>): string[] {
  const paths: string[] = [];
  for (const u of urls) {
    const p = pathFromPublicUrl(u);
    if (p) paths.push(p);
  }
  return paths;
}

/** Удаляет перечисленные фото из Storage. base64/dataURL и чужие URL — no-op. */
export async function deleteRecipePhotos(urls: Array<string | undefined>): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const paths = storagePathsFromUrls(urls);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) throw new Error(error.message);
}