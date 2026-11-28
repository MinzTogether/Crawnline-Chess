import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_PROFILE,
  MATCHES_STORAGE_KEY,
  MAX_AVATAR_DATA_URL_LENGTH,
  PREFERENCES_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  SEEDED_MATCHES,
  isValidAvatarDataUrl,
  loadPreferencesWithStatus,
  loadProfileWithStatus,
  loadSavedMatchesWithStatus,
  resetStoredPreferences,
  sanitizePreferences,
  sanitizeProfile,
  sanitizeSavedMatches,
  saveMatches,
  savePreferences,
  saveProfile,
  type SavedMatch,
  type StorageLike,
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

function createMemoryStorage(initial?: Record<string, string>): {
  storage: StorageLike;
  map: Map<string, string>;
} {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  const storage: StorageLike = {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
  return { storage, map };
}

test('corrupted JSON in LocalStorage returns safe fallbacks without deleting or overwriting raw stored data', () => {
  const corruptPrefs = '{broken-json-prefs';
  const corruptProfile = '<<<not-json-profile';
  const corruptMatches = '[{"id":"m1", broken';
  const { storage, map } = createMemoryStorage({
    [PREFERENCES_STORAGE_KEY]: corruptPrefs,
    [PROFILE_STORAGE_KEY]: corruptProfile,
    [MATCHES_STORAGE_KEY]: corruptMatches,
  });

  const prefsRes = loadPreferencesWithStatus(storage);
  const profileRes = loadProfileWithStatus(storage);
  const matchesRes = loadSavedMatchesWithStatus(storage);

  assert.equal(prefsRes.status, 'corrupted');
  assert.deepEqual(prefsRes.data, DEFAULT_PREFERENCES);
  assert.equal(profileRes.status, 'corrupted');
  assert.deepEqual(profileRes.data, DEFAULT_PROFILE);
  assert.equal(matchesRes.status, 'corrupted');
  assert.equal(matchesRes.data.length, SEEDED_MATCHES.length);

  // Raw keys in storage MUST remain untouched after read errors!
  assert.equal(map.get(PREFERENCES_STORAGE_KEY), corruptPrefs);
  assert.equal(map.get(PROFILE_STORAGE_KEY), corruptProfile);
  assert.equal(map.get(MATCHES_STORAGE_KEY), corruptMatches);

  // If user later explicitly saves new preferences, raw corrupt value is backed up and profile/matches stay untouched
  const writeRes = savePreferences({ ...DEFAULT_PREFERENCES, muted: true }, storage);
  assert.equal(writeRes.ok, true);
  assert.equal(map.get(`${PREFERENCES_STORAGE_KEY}_corrupt_backup`), corruptPrefs);
  assert.equal(map.get(PROFILE_STORAGE_KEY), corruptProfile);
  assert.equal(map.get(MATCHES_STORAGE_KEY), corruptMatches);
});

test('QuotaExceededError and unavailable LocalStorage fail gracefully without erasing existing matches or profile', () => {
  const existingMatches = JSON.stringify([
    {
      id: 'user-match-1',
      date: 'Today',
      whiteName: 'Alice',
      blackName: 'Bob',
      result: '1-0',
      reason: 'Checkmate',
      openingName: 'Sicilian',
      movesCount: 24,
      pgn: '1. e4 c5',
    },
  ]);
  const existingProfile = JSON.stringify({
    displayName: 'Alice',
    title: 'FM',
    avatarColor: '#5C9CE6',
    avatarImage: null,
    bio: 'Club champ',
  });
  const map = new Map<string, string>([
    [MATCHES_STORAGE_KEY, existingMatches],
    [PROFILE_STORAGE_KEY, existingProfile],
  ]);

  const fullStorage: StorageLike = {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: () => {
      const err = new Error('Storage quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };

  const prefWrite = savePreferences({ ...DEFAULT_PREFERENCES, muted: true }, fullStorage);
  assert.equal(prefWrite.ok, false);
  assert.equal(prefWrite.error, 'quota_exceeded');

  const profileWrite = saveProfile(
    { ...DEFAULT_PROFILE, displayName: 'Alice', avatarImage: 'data:image/png;base64,iVBORw0KGgo=' },
    fullStorage
  );
  assert.equal(profileWrite.ok, false);
  assert.equal(profileWrite.error, 'quota_exceeded');

  const matchesWrite = saveMatches(SEEDED_MATCHES, fullStorage);
  assert.equal(matchesWrite.ok, false);
  assert.equal(matchesWrite.error, 'quota_exceeded');

  // Existing valid user profile and match history remain 100% intact!
  assert.equal(map.get(MATCHES_STORAGE_KEY), existingMatches);
  assert.equal(map.get(PROFILE_STORAGE_KEY), existingProfile);

  // Unavailable storage (null or throwing SecurityError) never crashes loads, saves, or reset
  assert.equal(loadPreferencesWithStatus(null).status, 'unavailable');
  assert.equal(loadProfileWithStatus(null).status, 'unavailable');
  assert.equal(loadSavedMatchesWithStatus(null).status, 'unavailable');
  assert.equal(savePreferences(DEFAULT_PREFERENCES, null).error, 'unavailable');
  assert.equal(saveProfile(DEFAULT_PROFILE, null).error, 'unavailable');
  assert.equal(saveMatches(SEEDED_MATCHES, null).error, 'unavailable');
  assert.doesNotThrow(() => resetStoredPreferences(null));

  const throwingStorage: StorageLike = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('SecurityError');
    },
    removeItem: () => {
      throw new Error('SecurityError');
    },
  };
  assert.equal(loadPreferencesWithStatus(throwingStorage).status, 'corrupted');
  assert.equal(savePreferences(DEFAULT_PREFERENCES, throwingStorage).ok, false);
  assert.doesNotThrow(() => resetStoredPreferences(throwingStorage));
});

test('avatar validation blocks SVG XSS and oversized payloads while preserving valid profile fields', () => {
  assert.equal(isValidAvatarDataUrl('data:image/webp;base64,UklGRh4AAABXRUJQVlA4'), true);
  assert.equal(isValidAvatarDataUrl('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(isValidAvatarDataUrl('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4='), false);
  assert.equal(isValidAvatarDataUrl('https://evil.example/a.png'), false);

  const oversized = `data:image/png;base64,${'A'.repeat(MAX_AVATAR_DATA_URL_LENGTH + 100)}`;
  assert.equal(isValidAvatarDataUrl(oversized), false);

  const sanitized = sanitizeProfile({
    displayName: 'Safe Player',
    title: 'NM',
    avatarColor: '#5C9CE6',
    avatarImage: oversized,
    bio: 'Preserved bio',
  });
  assert.equal(sanitized.displayName, 'Safe Player');
  assert.equal(sanitized.title, 'NM');
  assert.equal(sanitized.avatarColor, '#5C9CE6');
  assert.equal(sanitized.bio, 'Preserved bio');
  assert.equal(sanitized.avatarImage, null);
});

test('backward-compatible migrations preserve legacy preferences, profiles, and match history safely', () => {
  // Legacy language/animation/icon values + wrapped envelope
  const migratedPrefs = sanitizePreferences({
    schemaVersion: 1,
    data: {
      language: 'vn',
      animationLevel: 'normal',
      appIcon: 'knight',
      analysisDepth: 18,
    },
  });
  assert.equal(migratedPrefs.language, 'vi');
  assert.equal(migratedPrefs.animationLevel, 'smooth');
  assert.equal(migratedPrefs.appIcon, 'white-knight');
  assert.equal(migratedPrefs.analysisDepth, 18);

  // Legacy profile field aliases
  const migratedProfile = sanitizeProfile({
    name: 'Legacy Grandmaster',
    avatar: 'data:image/png;base64,iVBORw0KGgo=',
    title: 'GM',
  });
  assert.equal(migratedProfile.displayName, 'Legacy Grandmaster');
  assert.equal(migratedProfile.avatarImage, 'data:image/png;base64,iVBORw0KGgo=');

  // Legacy match array wrapped in object, missing id, legacy whiteElo/blackElo, plus duplicate IDs
  const migratedMatches = sanitizeSavedMatches({
    version: 1,
    matches: [
      {
        pgn: '1. d4 d5 2. c4 e6',
        whiteName: 'Legacy White',
        blackName: 'Legacy Black',
        result: '1-0',
        whiteElo: 2150,
        blackElo: 1800,
      },
      {
        id: 'dup-id',
        pgn: '1. e4 e5',
        whiteName: 'First Copy',
      },
      {
        id: 'dup-id',
        pgn: '1. c4 e5',
        whiteName: 'Duplicate Should Be Skipped',
      },
    ],
  });
  assert.equal(migratedMatches.length, 2);
  assert.equal(migratedMatches[0].id, 'legacy-match-1');
  assert.equal(migratedMatches[0].whiteGameElo, 2150);
  assert.equal(migratedMatches[0].blackGameElo, 1800);
  assert.equal(migratedMatches[1].whiteName, 'First Copy');
});

test('saveMatches never overwrites valid stored match history with empty or invalid-only arrays', () => {
  const existing = JSON.stringify([
    {
      id: 'real-match',
      date: 'Today',
      whiteName: 'Player',
      blackName: 'Stockfish',
      result: '1-0',
      reason: 'Checkmate',
      openingName: 'Ruy Lopez',
      movesCount: 30,
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5',
    },
  ]);
  const { storage, map } = createMemoryStorage({ [MATCHES_STORAGE_KEY]: existing });

  assert.equal(saveMatches([], storage).ok, false);
  assert.equal(saveMatches([{ id: '', pgn: '' } as unknown as SavedMatch], storage).ok, false);
  assert.equal(map.get(MATCHES_STORAGE_KEY), existing);
});

test('LocalStorage recovery isolates corrupted preferences while keeping valid profile and partially valid match history intact', () => {
  const corruptPrefs = '{"appTheme": "classic", truncated';
  const validProfile = JSON.stringify({
    displayName: 'Tactical Ada',
    title: 'WGM',
    avatarColor: '#4F7CAC',
    avatarImage: 'data:image/png;base64,iVBORw0KGgo=',
    bio: 'Endgame study',
  });
  const mixedMatches = JSON.stringify([
    {
      id: 'valid-match-1',
      date: '2026-11-28',
      whiteName: 'Tactical Ada',
      blackName: 'Stockfish',
      result: '1-0',
      reason: 'Checkmate',
      openingName: 'Queen Gambit',
      movesCount: 28,
      pgn: '1. d4 d5 2. c4',
    },
    null,
    { id: '', pgn: '' }, // invalid record
    {
      id: 'valid-match-2',
      date: '2026-11-27',
      whiteName: 'Stockfish',
      blackName: 'Tactical Ada',
      result: '0-1',
      reason: 'Resignation',
      openingName: 'Sicilian Defense',
      movesCount: 41,
      pgn: '1. e4 c5 2. Nf3',
    },
  ]);

  const { storage, map } = createMemoryStorage({
    [PREFERENCES_STORAGE_KEY]: corruptPrefs,
    [PROFILE_STORAGE_KEY]: validProfile,
    [MATCHES_STORAGE_KEY]: mixedMatches,
  });

  // Preferences reports corrupted + safe defaults, while valid profile and valid matches load cleanly
  const prefsLoad = loadPreferencesWithStatus(storage);
  assert.equal(prefsLoad.status, 'corrupted');
  assert.deepEqual(prefsLoad.data, DEFAULT_PREFERENCES);
  assert.equal(map.get(PREFERENCES_STORAGE_KEY), corruptPrefs);

  const profileLoad = loadProfileWithStatus(storage);
  assert.equal(profileLoad.status, 'ok');
  assert.equal(profileLoad.data.displayName, 'Tactical Ada');
  assert.equal(profileLoad.data.title, 'WGM');

  const matchesLoad = loadSavedMatchesWithStatus(storage);
  assert.equal(matchesLoad.status, 'ok');
  assert.deepEqual(
    matchesLoad.data.map((m) => m.id),
    ['valid-match-1', 'valid-match-2']
  );

  // Explicit save recovers preferences cleanly, backs up corrupt payload, and never disturbs profile/matches
  const recoveredWrite = savePreferences({ ...DEFAULT_PREFERENCES, language: 'vi', analysisDepth: 16 }, storage);
  assert.equal(recoveredWrite.ok, true);
  assert.equal(map.get(`${PREFERENCES_STORAGE_KEY}_corrupt_backup`), corruptPrefs);

  const prefsAfterRecovery = loadPreferencesWithStatus(storage);
  assert.equal(prefsAfterRecovery.status, 'ok');
  assert.equal(prefsAfterRecovery.data.language, 'vi');
  assert.equal(prefsAfterRecovery.data.analysisDepth, 16);
  assert.equal(map.get(PROFILE_STORAGE_KEY), validProfile);
  assert.equal(map.get(MATCHES_STORAGE_KEY), mixedMatches);
});

test('savePreferences skips redundant LocalStorage setItem calls when serialized payload is unchanged', () => {
  const map = new Map<string, string>();
  let setItemCalls = 0;
  const spyStorage: StorageLike = {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      setItemCalls += 1;
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };

  const prefs = { ...DEFAULT_PREFERENCES, muted: true, analysisDepth: 16 };
  assert.equal(savePreferences(prefs, spyStorage).ok, true);
  assert.equal(setItemCalls, 1);

  // Saving the exact same preferences again must be a no-op on storage I/O
  assert.equal(savePreferences({ ...prefs }, spyStorage).ok, true);
  assert.equal(setItemCalls, 1);

  // Saving a genuinely changed value performs the write
  assert.equal(savePreferences({ ...prefs, analysisDepth: 18 }, spyStorage).ok, true);
  assert.equal(setItemCalls, 2);
});



