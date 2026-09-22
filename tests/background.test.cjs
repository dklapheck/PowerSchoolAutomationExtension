'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

function run() {
  let listener = null;
  let now = 1000;
  let stored = [];
  const opened = [];
  const chrome = {
    runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    storage: { session: {
      get: () => Promise.resolve({ recentPowerSchoolHandoffs: stored }),
      set: values => {
        stored = values.recentPowerSchoolHandoffs;
        return Promise.resolve();
      }
    } },
    tabs: { create(options) { opened.push(options); return Promise.resolve(); } }
  };
  const context = vm.createContext({
    chrome,
    Date: class extends Date { static now() { return now; } },
    console: { error() {} }
  });
  vm.runInContext(source, context);
  return {
    opened,
    advance(ms) { now += ms; },
    send(message) {
      return new Promise(resolve => listener(message, {}, resolve));
    }
  };
}

test('background opens only one tab for simultaneous identical handoffs', async () => {
  const env = run();
  const message = {
    type: 'OPEN_POWERSCHOOL_DEMOGRAPHICS',
    url: 'https://californiak12.powerschool.com/teachers/home.html#demographics=student_123'
  };
  const results = await Promise.all([
    env.send(message), env.send(message), env.send(message)
  ]);
  assert.equal(env.opened.length, 1);
  assert.equal(results.filter(result => result.duplicate).length, 2);
});

test('a new handoff can open after the replay-protection window', async () => {
  const env = run();
  const message = {
    type: 'OPEN_POWERSCHOOL_SCC',
    url: 'https://californiak12.powerschool.com/teachers/home.html#scc=abc_123'
  };
  await env.send(message);
  env.advance(10 * 60 * 1000 + 1);
  await env.send(message);
  assert.equal(env.opened.length, 2);
});
