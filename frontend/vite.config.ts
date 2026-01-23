import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { loadEnv } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  // Note: env is loaded but not used directly - it's accessed via import.meta.env
  loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3003,
      strictPort: true, // Tauri needs the exact port
      hmr: {
        port: 3003,
        protocol: 'ws',
      },
    },

    // To make use of `TAURI_PLATFORM`, `TAURI_ARCH`, 
    // `TAURI_FAMILY`, `TAURI_PLATFORM_VERSION`, `TAURI_PLATFORM_TYPE`,
    // and `TAURI_DEBUG` env variables
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
      // Tauri supports es2021
      target: ['es2021', 'chrome100', 'safari13'],
      // Don't minify for debug builds - always disable minification in dev
      minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
      // Produce sourcemaps for debug builds - always enable in dev
      sourcemap: process.env.NODE_ENV !== 'production',
    },
    plugins: [
      react({
        // Use React plugin for all React files
        include: '**/*.{tsx,ts,jsx,js}',
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    },
    // Clear screen for Tauri debug logs
    clearScreen: false,
  };
});
