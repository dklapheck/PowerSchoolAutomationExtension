'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

function fixture() {
  let listener;
  let now = 1000;
  const opened = [];
  const context = vm.createContext({
    chrome: {
      runtime: { onMessage: { addListener(fn) { listener = fn; } } },
      tabs: { create: options => { opened.push(options); return Promise.resolve(); } }
    },
    Date: class extends Date { static now() { return now; } },
    console: { error() {} }
  });
  vm.runInContext(source, context);
  return {
    opened,
    advance(ms) { now += ms; },
    async send(message) {
      const replies = [];
      listener(message, {}, reply => replies.push(reply));
      await new Promise(resolve => setImmediate(resolve));
      return replies[0];
    }
  };
}

test('duplicate frame reports open one PowerSchool tab', async () => {
  const env = fixture();
  const message = {
    type: 'OPEN_POWERSCHOOL_SCC',
    url: 'https://californiak12.powerschool.com/teachers/home.html#scc=abc_123'
  };

  const first = await env.send(message);
  const duplicate = await env.send(message);
  assert.equal(first.ok, true);
  assert.equal(first.deduplicated, undefined);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.deduplicated, true);
  assert.equal(env.opened.length, 1);

  env.advance(15100);
  const retry = await env.send(message);
  assert.equal(retry.ok, true);
  assert.equal(retry.deduplicated, undefined);
  assert.equal(env.opened.length, 2);
});
