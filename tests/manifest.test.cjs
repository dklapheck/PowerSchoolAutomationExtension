'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const manifest = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'manifest.json'),
  'utf8'
));

test('manifest 3.6.0 has no Google Sheets content access or background launcher', () => {
  assert.equal(manifest.version, '3.6.0');
  assert.equal('background' in manifest, false);
  const matches = manifest.content_scripts.flatMap(script => script.matches || []);
  const scripts = manifest.content_scripts.flatMap(script => script.js || []);
  assert.equal(matches.some(match => match.includes('docs.google.com/spreadsheets')), false);
  assert.deepEqual(scripts, ['content.js']);
  assert.equal(manifest.content_scripts.some(script =>
    'all_frames' in script || 'match_about_blank' in script), false);
  assert.equal(manifest.permissions.includes('tabs'), false);
});
