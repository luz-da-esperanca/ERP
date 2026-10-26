import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'PORT');
  const serverPort = environment.PORT ?? '3000';
  return {
    plugins: [react()],
    build: { outDir: 'dist/client', emptyOutDir: true },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${serverPort}`,
          changeOrigin: false,
        },
      },
    },
  };
});
