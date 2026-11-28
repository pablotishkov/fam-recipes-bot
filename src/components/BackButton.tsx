import { isAndroid } from '../lib/telegram';

interface Props {
  onClick: () => void;
  label?: string;
}

/**
 * Кнопка «назад». На iOS остаётся текстовой стрелкой (как было и выглядит
 * хорошо), а на Android рисуется SVG-шеврон — иначе текстовый символ ←
 * на Android рендерится «криво» (кружок + текст).
 */
export function BackButton({ onClick, label = 'Назад' }: Props) {
  return (
    <button className="btn btn-icon" onClick={onClick} aria-label={label}>
      {isAndroid() ? (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      ) : (
        '←'
      )}
    </button>
  );
}