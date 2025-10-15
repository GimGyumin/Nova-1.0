import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

// FIX: `__dirname` is not available in ES modules. This defines it using `import.meta.url`.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getBasePath = () => {
  if (!pkg.homepage) {
    return '/';
  }
  const homepageUrl = new URL(pkg.homepage);
  let pathname = homepageUrl.pathname;
  // Vite's 'base' option expects a path that starts and ends with a slash.
  if (!pathname.endsWith('/')) {
    pathname += '/';
  }
  return pathname;
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: getBasePath(),
      build: {
        outDir: 'docs',
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});