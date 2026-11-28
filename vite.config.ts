import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

const ROOT_DIR = import.meta.dirname;
const REQUIRED_STOCKFISH_FILES = ['stockfish.wasm.js', 'stockfish.wasm', 'stockfish.js'] as const;

export default defineConfig(({command}) => {
  // Ensure `vite build` always bundles the optimized production React runtime
  // even when the host environment exports NODE_ENV=development.
  if (command === 'build' && process.env.NODE_ENV !== 'production') {
    process.env.NODE_ENV = 'production';
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(ROOT_DIR, 'dist');
          const srcAssets = path.resolve(ROOT_DIR, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      // Guarantees Stockfish WASM/asm.js runtime files and default chess piece sprites
      // are always present in dist/ after a production build.
      {
        name: 'verify-production-runtime-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(ROOT_DIR, 'dist');
          const distStockfishDir = path.resolve(distDir, 'stockfish');
          const pkgStockfishDir = path.resolve(ROOT_DIR, 'node_modules/stockfish.js');

          fs.mkdirSync(distStockfishDir, {recursive: true});
          for (const filename of REQUIRED_STOCKFISH_FILES) {
            const target = path.resolve(distStockfishDir, filename);
            if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
              const fallback = path.resolve(pkgStockfishDir, filename);
              if (fs.existsSync(fallback)) {
                fs.copyFileSync(fallback, target);
              } else {
                throw new Error(`Missing required Stockfish production asset: ${filename}`);
              }
            }
          }

          const distPiecesDir = path.resolve(distDir, 'assets/pieces/default');
          for (const color of ['w', 'b'] as const) {
            for (const piece of ['k', 'q', 'r', 'b', 'n', 'p'] as const) {
              const sprite = path.resolve(distPiecesDir, `${color}${piece}.png`);
              if (!fs.existsSync(sprite) || fs.statSync(sprite).size === 0) {
                throw new Error(`Missing required piece sprite in production build: ${color}${piece}.png`);
              }
            }
          }
        },
      },
    ],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-chess',
                test: /node_modules[\\/]chess\.js[\\/]/,
                priority: 20,
              },
              {
                name: 'vendor-icons',
                test: /node_modules[\\/]lucide-react[\\/]/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(ROOT_DIR, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
