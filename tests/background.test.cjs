'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

function fixture(shared = {}) {
  let listener;
  let now = shared.now ?? 1000;
  const opened = shared.opened || [];
  const session = shared.session || {};
  const context = vm.createContext({
    chrome: {
      runtime: { onMessage: { addListener(fn) { listener = fn; } } },
      storage: {
        session: {
          async get(defaults) { return { ...defaults, ...session }; },
          async set(values) { Object.assign(session, values); }
        }
      },
      tabs: { create: options => { opened.push(options); return Promise.resolve(); } }
    },
    Date: class extends Date { static now() { return now; } },
    console: { error() {} }
  });
  vm.runInContext(source, context);
  return {
    opened,
    session,
    advance(ms) { now += ms; },
    async send(message) {
      const replies = [];
      listener(message, {}, reply => replies.push(reply));
      await new Promise(resolve => setImmediate(resolve));
      return replies[0];
    }
  };
}

const message = {
  type: 'OPEN_POWERSCHOOL_ECC',
  url: 'https://californiak12.powerschool.com/teachers/home.html#ecc=abc_123'
};

test('duplicate frame reports open one PowerSchool tab', async () => {
  const env = fixture();
  const first = await env.send(message);
  const duplicate = await env.send(message);

  assert.equal(first.ok, true);
  assert.equal(first.deduplicated, undefined);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.deduplicated, true);
  assert.equal(env.opened.length, 1);

  env.advance(60100);
  const retry = await env.send(message);
  assert.equal(retry.ok, true);
  assert.equal(retry.deduplicated, undefined);
  assert.equal(env.opened.length, 2);
});

test('worker restart still deduplicates the same handoff', async () => {
  const shared = { opened: [], session: {}, now: 1000 };
  const firstWorker = fixture(shared);
  const first = await firstWorker.send(message);
  assert.equal(first.ok, true);
  assert.equal(shared.opened.length, 1);

  // A new fixture has fresh module memory, like a restarted MV3 worker, but
  // receives the same extension session storage.
  const restartedWorker = fixture(shared);
  const duplicate = await restartedWorker.send(message);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.deduplicated, true);
  assert.equal(shared.opened.length, 1);
});
