import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EN_TRANSLATIONS,
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
  translate,
  type AppLanguage,
  type TranslationKey,
} from './translations';

test('all 4 languages (VN, EN, TW, JP) are registered with distinct codes', () => {
  const codes = LANGUAGE_OPTIONS.map((o) => o.code).sort();
  assert.deepEqual(codes, ['EN', 'JP', 'TW', 'VN']);
});

test('every translation key exists and is non-empty across EN, VN, TW, and JP', () => {
  const keys = Object.keys(EN_TRANSLATIONS) as TranslationKey[];
  const langs: AppLanguage[] = ['en', 'vi', 'zh-TW', 'ja'];

  for (const lang of langs) {
    const dict = TRANSLATIONS[lang];
    assert.ok(dict, `Missing dictionary for ${lang}`);
    for (const key of keys) {
      const val = dict[key];
      assert.equal(typeof val, 'string', `Missing key ${key} in ${lang}`);
      assert.ok(val.trim().length > 0, `Empty key ${key} in ${lang}`);
    }
  }
});

test('translate interpolates placeholders cleanly across locales', () => {
  assert.equal(
    translate('vi', 'catAppThemeSub', { count: 38 }).includes('38'),
    true
  );
  assert.equal(
    translate('zh-TW', 'catBoardThemeSub', { count: 46 }).includes('46'),
    true
  );
  assert.equal(
    translate('ja', 'catAppThemeSub', { count: 38 }).includes('38'),
    true
  );
});
