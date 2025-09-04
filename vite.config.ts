 import { defineConfig } from 'vite';
 import { fileURLToPath, URL } from 'node:url';

 export default defineConfig({
  base: '/Sudoku_ELQ/',
   resolve: {
     alias: {
       '@': fileURLToPath(new URL('./src', import.meta.url))
     }
   },
   server: { port: 5173, open: false },
  preview: { port: 5174 },
  build: { outDir: 'dist' }
});
