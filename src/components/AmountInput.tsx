import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';

interface Props {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  title?: string;
}

/** Парсинг текста в число: ведущие нули ("002", "05") считаются как 0. */
function parseAmount(digits: string): number {
  if (!digits) return 0;
  if (digits.length > 1 && digits.startsWith('0')) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Поле ввода числа, которое хранит сырой текст, чтобы курсор не перескакивал
 * при редактировании и значение не обнулялось при удалении до нуля.
 * Ввод только цифр; ведущие нули блокируются и парсятся как 0.
 */
export function AmountInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  // Внешнее изменение значения (например, пересчёт пропорций) отражаем,
  // только если поле не в фокусе — иначе теряем то, что вводит пользователь.
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '');
    if (digits === text) return;
    // Блокируем вставку цифры, образующую ведущий ноль ("012", "002", ...),
    // но позволяем удаление, создающее "00"/"05".
    const insertion = digits.length > text.length;
    if (insertion && digits.length > 1 && digits.startsWith('0')) return;
    setText(digits);
    onChange(parseAmount(digits));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      {...rest}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setText(String(value));
      }}
      onChange={handleChange}
    />
  );
}