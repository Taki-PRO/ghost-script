import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds are served from https://<user>.github.io/ghost-script/.
// The dev server and Vitest (serve command) keep the root base.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/ghost-script/' : '/',
}));
