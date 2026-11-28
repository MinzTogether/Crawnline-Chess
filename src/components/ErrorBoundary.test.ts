import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorBoundary, type ErrorBoundaryState } from './ErrorBoundary';
import {
  MATCHES_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  type StorageLike,
} from '../types/preferences';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  const storage: StorageLike = {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
  return { storage, map };
}

function attachSynchronousSetState(boundary: ErrorBoundary): void {
  boundary.setState = ((
    updater:
      | Partial<ErrorBoundaryState>
      | ((prev: Readonly<ErrorBoundaryState>) => Partial<ErrorBoundaryState> | null)
      | null,
    cb?: () => void
  ) => {
    const patch = typeof updater === 'function' ? updater(boundary.state) : updater;
    if (patch) {
      boundary.state = { ...boundary.state, ...patch };
    }
    cb?.();
  }) as typeof boundary.setState;
}

test('ErrorBoundary captures render errors with fallback copy and renders alert UI until resetError() restores children', () => {
  const derivedWithMsg = ErrorBoundary.getDerivedStateFromError(new Error('Board canvas crash'));
  assert.deepEqual(derivedWithMsg, {
    hasError: true,
    errorMessage: 'Board canvas crash',
  });

  const derivedEmpty = ErrorBoundary.getDerivedStateFromError(new Error(''));
  assert.equal(derivedEmpty.hasError, true);
  assert.ok(derivedEmpty.errorMessage.length > 0);

  const boundary = new ErrorBoundary({
    children: React.createElement('div', { id: 'healthy-app' }, 'Crownline Running'),
  });
  attachSynchronousSetState(boundary);

  // Healthy state renders children directly
  const healthyHtml = renderToStaticMarkup(boundary.render() as React.ReactElement);
  assert.ok(healthyHtml.includes('Crownline Running'));
  assert.ok(!healthyHtml.includes('role="alert"'));

  // Transition into error state -> renders recovery screen with diagnostic message
  boundary.state = derivedWithMsg;
  const fallbackHtml = renderToStaticMarkup(boundary.render() as React.ReactElement);
  assert.ok(fallbackHtml.includes('role="alert"'));
  assert.ok(fallbackHtml.includes('Board canvas crash'));
  assert.ok(fallbackHtml.includes('Reload App'));
  assert.ok(fallbackHtml.includes('Reset Preferences'));

  // Calling resetError() clears error state and restores child rendering cleanly
  boundary.resetError();
  assert.deepEqual(boundary.state, { hasError: false, errorMessage: '' });
  const recoveredHtml = renderToStaticMarkup(boundary.render() as React.ReactElement);
  assert.ok(recoveredHtml.includes('Crownline Running'));
  assert.ok(!recoveredHtml.includes('role="alert"'));
});

test('ErrorBoundary handleResetAndReload clears only preferences while preserving user profile and saved match history', () => {
  const savedProfileJson = JSON.stringify({ displayName: 'Grandmaster Linh', title: 'IM' });
  const savedMatchesJson = JSON.stringify([
    {
      id: 'match-keep-1',
      date: 'Today',
      whiteName: 'Grandmaster Linh',
      blackName: 'Stockfish',
      result: '1-0',
      reason: 'Checkmate',
      openingName: 'Sicilian',
      movesCount: 34,
      pgn: '1. e4 c5 2. Nf3',
    },
  ]);
  const { storage, map } = createMemoryStorage({
    [PREFERENCES_STORAGE_KEY]: '{"appTheme":"corrupt-theme"}',
    [PROFILE_STORAGE_KEY]: savedProfileJson,
    [MATCHES_STORAGE_KEY]: savedMatchesJson,
  });

  let reloadCount = 0;
  const boundary = new ErrorBoundary({
    children: React.createElement('span', null, 'App'),
    storage,
    onReload: () => {
      reloadCount += 1;
    },
  });
  attachSynchronousSetState(boundary);
  boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('Theme render exception'));

  boundary.handleResetAndReload();

  assert.equal(reloadCount, 1);
  assert.equal(boundary.state.hasError, false);
  assert.equal(boundary.state.errorMessage, '');
  // Only preferences were cleared; profile and match archive remain untouched
  assert.equal(map.has(PREFERENCES_STORAGE_KEY), false);
  assert.equal(map.get(PROFILE_STORAGE_KEY), savedProfileJson);
  assert.equal(map.get(MATCHES_STORAGE_KEY), savedMatchesJson);
});

test('ErrorBoundary handleReload triggers reload without modifying stored preferences, profile, or match history', () => {
  const { storage, map } = createMemoryStorage({
    [PREFERENCES_STORAGE_KEY]: '{"boardTheme":"walnut"}',
    [PROFILE_STORAGE_KEY]: '{"displayName":"Alice"}',
    [MATCHES_STORAGE_KEY]: '[{"id":"m1","pgn":"1. e4 e5"}]',
  });

  let reloadCount = 0;
  const boundary = new ErrorBoundary({
    children: React.createElement('span', null, 'App'),
    storage,
    onReload: () => {
      reloadCount += 1;
    },
  });
  attachSynchronousSetState(boundary);
  boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('Transient error'));

  boundary.handleReload();

  assert.equal(reloadCount, 1);
  assert.equal(map.get(PREFERENCES_STORAGE_KEY), '{"boardTheme":"walnut"}');
  assert.equal(map.get(PROFILE_STORAGE_KEY), '{"displayName":"Alice"}');
  assert.equal(map.get(MATCHES_STORAGE_KEY), '[{"id":"m1","pgn":"1. e4 e5"}]');
});
