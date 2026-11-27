import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_ICONS,
  filterAppIcons,
  getAppIconMeta,
  resolveAppIconId,
} from './appIconCatalog';

test('APP_ICONS contains all 6 chess pieces for both white and black frosted jade sets', () => {
  assert.equal(APP_ICONS.length, 12);

  const expectedPieces = ['k', 'q', 'r', 'b', 'n', 'p'];
  const whiteIcons = filterAppIcons('white');
  const blackIcons = filterAppIcons('black');

  assert.equal(whiteIcons.length, 6);
  assert.equal(blackIcons.length, 6);
  assert.deepEqual(
    whiteIcons.map((i) => i.piece),
    expectedPieces
  );
  assert.deepEqual(
    blackIcons.map((i) => i.piece),
    expectedPieces
  );
});

test('resolveAppIconId preserves valid IDs and migrates legacy icon IDs safely', () => {
  assert.equal(resolveAppIconId('white-bishop'), 'white-bishop');
  assert.equal(resolveAppIconId('black-pawn'), 'black-pawn');
  assert.equal(resolveAppIconId('crown'), 'white-king');
  assert.equal(resolveAppIconId('knight'), 'white-knight');
  assert.equal(resolveAppIconId('rook'), 'white-rook');
  assert.equal(resolveAppIconId('queen'), 'white-queen');
  assert.equal(resolveAppIconId('unknown-legacy'), 'white-king');
  assert.equal(resolveAppIconId(null), 'white-king');
});

test('getAppIconMeta returns matching piece and tone metadata', () => {
  const bk = getAppIconMeta('black-knight');
  assert.equal(bk.piece, 'n');
  assert.equal(bk.tone, 'black');

  const wr = getAppIconMeta('white-rook');
  assert.equal(wr.piece, 'r');
  assert.equal(wr.tone, 'white');
});
