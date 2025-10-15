// FIX: Removed invalid file marker comment from the top of the file.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

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

export default defineConfig({
  plugins: [react()],
  base: getBasePath(),
});