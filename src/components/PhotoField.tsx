import { useRef } from 'react';

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  label?: string;
}

/** Поле загрузки фото: выбор из галереи/камеры устройства, предпросмотр. */
export function PhotoField({ value, onChange, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(file?: File) {
    if (!file) return;
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
          style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, display: 'block' }}
        />
        <button
          className="btn btn-sm btn-danger"
          style={{ marginTop: 8 }}
          onClick={() => onChange(undefined)}
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
      >
        <div>
          <div style={{ fontSize: 26 }}>📷</div>
          <div style={{ fontSize: 13 }}>{label ?? 'Добавить фото'}</div>
        </div>
      </button>
    </div>
  );
}