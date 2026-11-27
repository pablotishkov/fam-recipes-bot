import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Базовый путь. На GitHub Pages проект живёт в подпапке /fam-recipes-bot/,
  // поэтому CI передаёт VITE_BASE. Локально (VITE_BASE не задан) — корень '/'.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});