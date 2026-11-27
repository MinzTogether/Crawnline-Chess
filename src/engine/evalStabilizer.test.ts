import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_EVAL_CACHE_SIZE,
  MIN_STABLE_DEPTH,
  positionKeyFromFen,
  stabilizeEvaluation,
  type CachedEvalEntry,
} from './evalStabilizer';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

test('positionKeyFromFen strips move counters so identical positions share cache keys', () => {
  const fenA = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  const fenB = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 4 12';
  assert.equal(positionKeyFromFen(fenA), positionKeyFromFen(fenB));
});

test('stabilizeEvaluation ignores shallow depth spikes when a deeper cached score exists', () => {
  const cache = new Map<string, CachedEvalEntry>();
  cache.set(positionKeyFromFen(AFTER_E4_FEN), { score: { type: 'cp', value: 35 }, depth: 14 });

  const res = stabilizeEvaluation({
    fen: AFTER_E4_FEN,
    incomingScore: { type: 'cp', value: 420 }, // noisy depth-2 horizon spike
    incomingDepth: 2,
    isSearching: true,
    cache,
    displayed: { fen: AFTER_E4_FEN, score: { type: 'cp', value: 35 }, depth: 14 },
  });

  assert.deepEqual(res.score, { type: 'cp', value: 35 });
  assert.equal(res.depth, 14);
});

test('stabilizeEvaluation holds previous score smoothly while waiting for depth 4 on a new position', () => {
  const cache = new Map<string, CachedEvalEntry>();

  const res = stabilizeEvaluation({
    fen: AFTER_E4_FEN,
    incomingScore: { type: 'cp', value: -250 }, // depth 2 noise on new move
    incomingDepth: 2,
    isSearching: true,
    cache,
    displayed: { fen: START_FEN, score: { type: 'cp', value: 25 }, depth: 12 },
  });

  assert.deepEqual(res.score, { type: 'cp', value: 25 });
  assert.equal(res.isStabilizing, true);
});

test('stabilizeEvaluation absorbs sub-deadband centipawn micro-jitter on the same FEN', () => {
  const cache = new Map<string, CachedEvalEntry>();
  cache.set(positionKeyFromFen(AFTER_E4_FEN), { score: { type: 'cp', value: 40 }, depth: 8 });

  const res = stabilizeEvaluation({
    fen: AFTER_E4_FEN,
    incomingScore: { type: 'cp', value: 46 }, // only +6cp change while searching depth 9
    incomingDepth: 9,
    isSearching: true,
    cache,
    displayed: { fen: AFTER_E4_FEN, score: { type: 'cp', value: 40 }, depth: 8 },
  });

  // Held at 40cp to prevent trembling
  assert.deepEqual(res.score, { type: 'cp', value: 40 });
});

test('stabilizeEvaluation immediately reflects forced mate and terminal positions', () => {
  const cache = new Map<string, CachedEvalEntry>();
  cache.set(positionKeyFromFen(AFTER_E4_FEN), { score: { type: 'cp', value: 120 }, depth: 12 });

  const mateRes = stabilizeEvaluation({
    fen: AFTER_E4_FEN,
    incomingScore: { type: 'mate', value: 3 },
    incomingDepth: MIN_STABLE_DEPTH + 6,
    isSearching: true,
    cache,
    displayed: { fen: AFTER_E4_FEN, score: { type: 'cp', value: 120 }, depth: 12 },
  });

  assert.deepEqual(mateRes.score, { type: 'mate', value: 3 });
  assert.equal(mateRes.barPercent, 100);

  const terminalRes = stabilizeEvaluation({
    fen: AFTER_E4_FEN,
    incomingScore: { type: 'mate', value: -1 },
    incomingDepth: 0,
    isSearching: false,
    cache,
    displayed: { fen: AFTER_E4_FEN, score: { type: 'cp', value: 120 }, depth: 12 },
  });

  assert.deepEqual(terminalRes.score, { type: 'mate', value: -1 });
  assert.equal(terminalRes.barPercent, 0);
});

test('stabilizeEvaluation bounds evaluation cache to MAX_EVAL_CACHE_SIZE with LRU eviction', () => {
  const cache = new Map<string, CachedEvalEntry>();
  const totalInserts = MAX_EVAL_CACHE_SIZE + 25;

  for (let i = 0; i < totalInserts; i++) {
    // Vary board part uniquely so positionKeyFromFen is distinct per entry
    const uniqueFen = `pos-${i} w - - 0 1`;
    stabilizeEvaluation({
      fen: uniqueFen,
      incomingScore: { type: 'cp', value: i },
      incomingDepth: MIN_STABLE_DEPTH + 4,
      isSearching: false,
      cache,
      displayed: { fen: null, score: null, depth: 0 },
    });
  }

  assert.equal(cache.size, MAX_EVAL_CACHE_SIZE);
  // Oldest entries should have been evicted while newest remain
  assert.equal(cache.has('pos-0 w - -'), false);
  assert.equal(cache.has(`pos-${totalInserts - 1} w - -`), true);
});
