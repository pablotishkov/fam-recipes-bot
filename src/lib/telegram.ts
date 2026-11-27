/** Минимальное описание объекта window.Telegram.WebApp. */
interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  expand: () => void;
  ready: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

interface TelegramWindow {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}

declare global {
  interface Window {
    Telegram?: TelegramWindow['Telegram'];
  }
}

/** Работаем ли внутри Telegram (или при открытии через бота). */
export function isTelegram(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp);
}

export function webApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/** Сырой initData для проверки подписи на сервере. */
export function getInitData(): string {
  return webApp()?.initData ?? '';
}

/** Данные пользователя Telegram из initDataUnsafe. */
export function getTelegramUser(): TelegramWebAppUser | null {
  return webApp()?.initDataUnsafe?.user ?? null;
}

/** Запускный параметр (например, код-приглашение семьи из ссылки /start). */
export function getStartParam(): string | undefined {
  return webApp()?.initDataUnsafe?.start_param;
}

/** Инициализация и раскрытие на весь экран. */
export function initTelegram(): void {
  const app = webApp();
  if (!app) return;
  app.ready();
  app.expand();
}

/** Текущая тема по настройке Telegram. */
export function currentColorScheme(): 'light' | 'dark' {
  return webApp()?.colorScheme === 'dark' ? 'dark' : 'light';
}

/** Главный цвет темы Telegram (например, для кнопок). */
export function themeButtonColor(): string | undefined {
  return webApp()?.themeParams?.button_color;
}

/** Имя пользователя из Telegram или fallback. */
export function displayName(first?: string, last?: string, username?: string): string {
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || username || 'Гость';
}