import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_PROFILE,
  MATCHES_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  SEEDED_MATCHES,
  resetStoredPreferences,
  sanitizePreferences,
  sanitizeProfile,
  sanitizeSavedMatches,
} from './preferences';

test('sanitizePreferences handles non-object input and falls back to defaults', () => {
  assert.deepEqual(sanitizePreferences(null), DEFAULT_PREFERENCES);
  assert.deepEqual(sanitizePreferences('corrupt'), DEFAULT_PREFERENCES);
  assert.deepEqual(sanitizePreferences([1, 2, 3]), DEFAULT_PREFERENCES);
});

test('sanitizePreferences validates enums, clamps numbers, and ignores invalid types', () => {
  const sanitized = sanitizePreferences({
    appTheme: 'does-not-exist',
    boardTheme: 'invalid-board',
    pieceStyle: 'invalid-piece',
    language: 'fr',
    animationLevel: 'ultra-mega',
    animationEasing: 'nonexistent',
    pieceSpeedMs: 99999,
    uiSpeedMultiplier: -5,
    analysisDepth: 99,
    multiPv: 0,
    muted: 'yes',
    showCoordinates: false,
    showMaterialDifference: false,
  });

  assert.equal(sanitized.appTheme, DEFAULT_PREFERENCES.appTheme);
  assert.equal(sanitized.boardTheme, DEFAULT_PREFERENCES.boardTheme);
  assert.equal(sanitized.pieceStyle, DEFAULT_PREFERENCES.pieceStyle);
  assert.equal(sanitized.language, DEFAULT_PREFERENCES.language);
  assert.equal(sanitized.animationLevel, DEFAULT_PREFERENCES.animationLevel);
  assert.equal(sanitized.animationEasing, DEFAULT_PREFERENCES.animationEasing);
  assert.equal(sanitized.analysisDepth, 22);
  assert.equal(sanitized.multiPv, 1);
  assert.equal(sanitized.muted, DEFAULT_PREFERENCES.muted);
  assert.equal(sanitized.showCoordinates, false);
  assert.equal(sanitized.showMaterialDifference, false);
  assert.ok(sanitized.pieceSpeedMs <= 420);
  assert.ok(sanitized.uiSpeedMultiplier >= 0.4);
});

test('sanitizePreferences preserves valid custom settings including NaN protection', () => {
  const sanitized = sanitizePreferences({
    appTheme: 'chesscom-dark',
    boardTheme: 'walnut',
    pieceStyle: 'ivory',
    language: 'vi',
    analysisDepth: Number.NaN,
    multiPv: 2,
  });

  assert.equal(sanitized.appTheme, 'chesscom-dark');
  assert.equal(sanitized.boardTheme, 'walnut');
  assert.equal(sanitized.pieceStyle, 'ivory');
  assert.equal(sanitized.language, 'vi');
  assert.equal(sanitized.analysisDepth, DEFAULT_PREFERENCES.analysisDepth);
  assert.equal(sanitized.multiPv, 2);
});

test('sanitizeProfile enforces valid strings, hex color, and data:image avatar URLs', () => {
  assert.deepEqual(sanitizeProfile(null), DEFAULT_PROFILE);

  const bad = sanitizeProfile({
    displayName: '   ',
    title: 123,
    avatarColor: 'javascript:alert(1)',
    avatarImage: 'https://evil.example/avatar.png',
    bio: 'x'.repeat(500),
  });

  assert.equal(bad.displayName, DEFAULT_PROFILE.displayName);
  assert.equal(bad.title, DEFAULT_PROFILE.title);
  assert.equal(bad.avatarColor, DEFAULT_PROFILE.avatarColor);
  assert.equal(bad.avatarImage, null);
  assert.equal(bad.bio.length, 240);

  const good = sanitizeProfile({
    displayName: 'Grandmaster Ada',
    title: 'GM',
    avatarColor: '#3A7AFE',
    avatarImage: 'data:image/png;base64,iVBORw0KGgo=',
    bio: 'Endgame specialist',
  });

  assert.equal(good.displayName, 'Grandmaster Ada');
  assert.equal(good.title, 'GM');
  assert.equal(good.avatarColor, '#3A7AFE');
  assert.equal(good.avatarImage, 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(good.bio, 'Endgame specialist');
});

test('sanitizeSavedMatches filters corrupted records, caps at 25, and falls back to seeded matches', () => {
  assert.deepEqual(sanitizeSavedMatches(null), SEEDED_MATCHES);
  assert.deepEqual(sanitizeSavedMatches([{ id: '', pgn: '' }, 'bad']), SEEDED_MATCHES);

  const many = Array.from({ length: 30 }, (_, idx) => ({
    id: `m-${idx}`,
    date: 'Today',
    whiteName: 'White',
    blackName: 'Black',
    result: idx === 0 ? 'invalid' : '1-0',
    reason: 'Checkmate',
    openingName: 'Italian Game',
    movesCount: idx === 0 ? -5 : 12,
    pgn: '1. e4 e5',
    whiteAccuracy: idx === 0 ? 140 : 88.5,
    blackAccuracy: Number.NaN,
    whiteGameElo: 2100,
    userSide: idx === 0 ? 'invalid' : 'w',
  }));

  const cleaned = sanitizeSavedMatches(many);
  assert.equal(cleaned.length, 25);
  assert.equal(cleaned[0].result, '*');
  assert.equal(cleaned[0].movesCount, 0);
  assert.equal(cleaned[0].whiteAccuracy, 100);
  assert.equal(cleaned[0].blackAccuracy, null);
  assert.equal(cleaned[0].userSide, undefined);
  assert.equal(cleaned[1].result, '1-0');
  assert.equal(cleaned[1].userSide, 'w');
});

test('resetStoredPreferences removes only preferences and preserves profile and saved matches', () => {
  const store = new Map<string, string>([
    [PREFERENCES_STORAGE_KEY, '{"appTheme":"chesscom-dark"}'],
    [PROFILE_STORAGE_KEY, '{"displayName":"Magnus"}'],
    [MATCHES_STORAGE_KEY, '[{"id":"m1","pgn":"1. e4 e5"}]'],
  ]);

  const fakeStorage = {
    removeItem(key: string) {
      store.delete(key);
    },
  };

  resetStoredPreferences(fakeStorage);

  assert.equal(store.has(PREFERENCES_STORAGE_KEY), false);
  assert.equal(store.get(PROFILE_STORAGE_KEY), '{"displayName":"Magnus"}');
  assert.equal(store.get(MATCHES_STORAGE_KEY), '[{"id":"m1","pgn":"1. e4 e5"}]');
});
