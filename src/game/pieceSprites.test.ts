import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PREFERENCES, PIECE_STYLES } from '../types/preferences';

test('default classic piece style references all 12 transparent PNG sprites on disk', () => {
  assert.equal(DEFAULT_PREFERENCES.pieceStyle, 'classic');
  const classic = PIECE_STYLES.classic;
  assert.equal(classic.spriteBasePath, '/assets/pieces/default');

  const colors = ['w', 'b'] as const;
  const types = ['k', 'q', 'r', 'b', 'n', 'p'] as const;
  for (const color of colors) {
    for (const type of types) {
      const filePath = path.join(process.cwd(), 'public', 'assets', 'pieces', 'default', `${color}${type}.png`);
      assert.equal(fs.existsSync(filePath), true, `Missing sprite: ${filePath}`);
      const stat = fs.statSync(filePath);
      assert.ok(stat.size > 5000, `Sprite looks empty or corrupted: ${filePath}`);
    }
  }

  // Alternate vector Staunton Neo style remains available without spriteBasePath
  assert.equal(PIECE_STYLES['staunton-neo'].spriteBasePath, undefined);
});
