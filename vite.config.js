// FIX: Removed invalid file marker comment from the top of the file.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub 리포지토리 이름을 정확히 넣기!
const repoName = 'Nova-AI-Planer';

export default defineConfig({
  plugins: [react()],
  base: `/${repoName}/`, // <-- 이게 핵심
});