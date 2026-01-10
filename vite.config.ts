
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite standardně klientskému kódu process.env neposkytuje.
// Tímto 'define' mu ho tam při buildu na Vercelu "vypálíme".
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
  }
});
