import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePublicAssetUrl } from './assetUrl';

test('resolvePublicAssetUrl handles root, subpath, and relative Vite BASE_URL values cleanly', () => {
  assert.equal(resolvePublicAssetUrl('/stockfish/stockfish.wasm.js', '/'), '/stockfish/stockfish.wasm.js');
  assert.equal(resolvePublicAssetUrl('stockfish/stockfish.wasm.js', '/'), '/stockfish/stockfish.wasm.js');
  assert.equal(
    resolvePublicAssetUrl('/stockfish/stockfish.wasm.js', '/chess/'),
    '/chess/stockfish/stockfish.wasm.js'
  );
  assert.equal(
    resolvePublicAssetUrl('/assets/pieces/default/wk.png', '/chess'),
    '/chess/assets/pieces/default/wk.png'
  );
  assert.equal(
    resolvePublicAssetUrl('/stockfish/stockfish.js', './'),
    './stockfish/stockfish.js'
  );
  // Default in Node (without Vite import.meta.env.BASE_URL) falls back cleanly to '/'
  assert.equal(resolvePublicAssetUrl('/stockfish/stockfish.wasm.js'), '/stockfish/stockfish.wasm.js');
});

test('Stockfish WASM and asm.js runtime assets exist in public/stockfish and match installed stockfish.js package', () => {
  const requiredFiles = ['stockfish.wasm.js', 'stockfish.wasm', 'stockfish.js'];
  for (const file of requiredFiles) {
    const publicFile = path.join(process.cwd(), 'public', 'stockfish', file);
    const pkgFile = path.join(process.cwd(), 'node_modules', 'stockfish.js', file);

    assert.equal(fs.existsSync(publicFile), true, `Missing public Stockfish asset: ${publicFile}`);
    assert.equal(fs.existsSync(pkgFile), true, `Missing package Stockfish asset: ${pkgFile}`);

    const publicStat = fs.statSync(publicFile);
    const pkgStat = fs.statSync(pkgFile);
    assert.ok(publicStat.size > 10_000, `Stockfish asset looks truncated: ${publicFile}`);
    assert.equal(
      publicStat.size,
      pkgStat.size,
      `public/stockfish/${file} size differs from node_modules/stockfish.js/${file}`
    );
  }
});
