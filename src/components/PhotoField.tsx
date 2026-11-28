import { useRef, useState } from 'react';
import { deleteRecipePhotos } from '../lib/photos';

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  label?: string;
  /** Асинхронная загрузка фото (сжатие + Storage). Если задан — результат onChange — URL/dataURL после загрузки. */
  onUpload?: (file: File) => Promise<string>;
}

/** Поле загрузки фото: выбор из галереи/камеры устройства, предпросмотр. */
export function PhotoField({ value, onChange, label, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function removePhoto() {
    const url = value;
    // Сразу убираем фото из формы.
    onChange(undefined);
    // И удаляем файл из Storage (для base64/dataURL — no-op).
    if (url) deleteRecipePhotos([url]).catch((e) => console.error('photo delete', e));
  }

  async function onFile(file?: File) {
    if (!file || uploading) return;
    if (onUpload) {
      setUploading(true);
      try {
        const url = await onUpload(file);
        onChange(url);
      } catch (e) {
        window.alert(`Не удалось загрузить фото: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setUploading(false);
      }
      // Сбрасываем input, чтобы повторный выбор того же файла снова сработал.
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  if (value) {
    return (
      <div>
        <img
          src={value}
          alt="Фото"
          style={{ width: '100%', maxHeight: 220, objectFit: 'contain', background: 'var(--surface-2)', borderRadius: 12, display: 'block' }}
        />
        <button
          className="btn btn-sm btn-danger"
          style={{ marginTop: 8 }}
          onClick={removePhoto}
        >
          Удалить фото
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button
        className="btn btn-block"
        style={{ height: 96, border: '1px dashed var(--border)', background: 'var(--surface)' }}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <div>
          <div style={{ fontSize: 26 }}>{uploading ? '⏳' : '📷'}</div>
          <div style={{ fontSize: 13 }}>{uploading ? 'Загрузка…' : label ?? 'Добавить фото'}</div>
        </div>
      </button>
    </div>
  );
}