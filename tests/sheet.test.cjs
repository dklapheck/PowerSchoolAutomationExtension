'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'sheet.js'), 'utf8');
const NODE = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

class FakeElement {
  constructor() {
    this.nodeType = NODE.ELEMENT_NODE;
    this.children = [];
    this.id = '';
    this.style = {};
    this.parentElement = null;
  }
  get childElementCount() {
    return this.children.filter(child => child.nodeType === NODE.ELEMENT_NODE).length;
  }
  get textContent() {
    return this.children.map(child => child.nodeType === NODE.TEXT_NODE
      ? child.nodeValue : child.textContent).join('');
  }
  set textContent(value) { this.children = [new FakeText(value, this)]; }
  appendChild(child) { child.parentElement = this; this.children.push(child); }
  setAttribute() {}
}
class FakeText {
  constructor(value, parent = null) {
    this.nodeType = NODE.TEXT_NODE;
    this.nodeValue = value;
    this.parentElement = parent;
  }
}

function run({ approved = [], pathname = '/spreadsheets/d/NEW-ROSTER/edit', reply = { ok: true } } = {}) {
  const body = new FakeElement();
  let now = 1000;
  let observer = null;
  let poll = null;
  const toastRegions = [];
  const messages = [];
  const document = {
    body,
    documentElement: new FakeElement(),
    getElementById: id => body.children.find(child => child.id === id) || null,
    createElement: () => new FakeElement(),
    querySelectorAll: () => toastRegions,
    createTreeWalker(root) {
      const texts = [];
      function visit(node) {
        if (node.nodeType === NODE.TEXT_NODE) texts.push(node);
        else node.children.forEach(visit);
      }
      visit(root);
      let index = 0;
      return { nextNode: () => texts[index++] || null };
    }
  };
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage: (message, callback) => {
        messages.push(message);
        callback(reply);
      }
    },
    storage: { local: { get: (_defaults, callback) => {
      callback({ eccApprovedSpreadsheetIds: approved });
    } } }
  };
  class FakeObserver {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() {}
  }
  class FakeDate extends Date {
    static now() { return now; }
  }
  const context = vm.createContext({
    document, chrome, location: { pathname },
    MutationObserver: FakeObserver,
    setInterval: callback => { poll = callback; return 1; },
    Date: FakeDate,
    console: { error() {} }
  });
  vm.runInContext(source, context);
  return {
    body, messages,
    addToastRegion(node) { toastRegions.push(node); },
    poll() { poll?.(); },
    advance(ms) { now += ms; },
    get observer() { return observer; },
    get status() { return document.getElementById('ecc-helper-status')?.textContent; }
  };
}

test('unapproved sheet has no watcher and does not inspect a handoff', () => {
  const env = run();
  assert.equal(env.observer, null);
  assert.equal(env.status, undefined);
  assert.equal(env.messages.length, 0);
});

test('6RosterORNFinal is watched without a stored approval', () => {
  const env = run({
    pathname: '/spreadsheets/d/1_MpkySxTB6BYBB8In3ELRUsH2XpGjaeipMXxxGQb0To/edit'
  });
  assert.ok(env.observer);

  const toast = new FakeElement();
  toast.appendChild(new FakeText('SCC_HANDOFF_V1:attempt_123'));
  env.observer.callback([{ type: 'childList', addedNodes: [toast] }]);

  assert.equal(env.messages.length, 1);
  assert.equal(env.messages[0].type, 'OPEN_POWERSCHOOL_SCC');
  assert.equal(env.messages[0].url,
    'https://californiak12.powerschool.com/teachers/home.html#scc=attempt_123');
});

test('watcher does not depend on page Node or HTMLElement globals', () => {
  const env = run({ approved: ['NEW-ROSTER'] });
  const toast = new FakeElement();
  toast.appendChild(new FakeText('SCC_HANDOFF_V1:no_dom_globals'));

  assert.doesNotThrow(() => {
    env.observer.callback([{ type: 'childList', addedNodes: [toast] }]);
  });
  assert.equal(env.messages.length, 1);
});

test('toast polling fallback detects SCC and ECC live regions', () => {
  const env = run({ approved: ['NEW-ROSTER'] });
  const sccToast = new FakeElement();
  sccToast.appendChild(new FakeText('SCC_HANDOFF_V1:scc_poll'));
  const eccToast = new FakeElement();
  eccToast.appendChild(new FakeText('ECC_HANDOFF_V1:ecc_poll'));
  env.addToastRegion(sccToast);
  env.addToastRegion(eccToast);

  env.poll();

  assert.deepEqual(env.messages.map(message => message.type), [
    'OPEN_POWERSCHOOL_SCC',
    'OPEN_POWERSCHOOL_ECC'
  ]);

  // The same visible toasts are polled every 250 ms for ten seconds.
  for (let i = 0; i < 40; i += 1) {
    env.advance(250);
    env.poll();
  }
  assert.equal(env.messages.length, 2);
});

test('an identical handoff can be retried after the visible-toast window', () => {
  const env = run({ approved: ['NEW-ROSTER'] });
  const firstToast = new FakeElement();
  firstToast.appendChild(new FakeText('ECC_HANDOFF_V1:abc_123'));
  env.observer.callback([{ type: 'childList', addedNodes: [firstToast] }]);
  assert.equal(env.messages.length, 1);

  env.advance(16000);
  const retryToast = new FakeElement();
  retryToast.appendChild(new FakeText('ECC_HANDOFF_V1:abc_123'));
  env.observer.callback([{ type: 'childList', addedNodes: [retryToast] }]);
  assert.equal(env.messages.length, 2);
});

test('approved sheet opens a split toast once without covering controls', () => {
  const env = run({ approved: ['NEW-ROSTER'] });
  assert.equal(env.status, undefined);
  const toast = new FakeElement();
  toast.appendChild(new FakeText('ECC_HANDOFF_V1:'));
  toast.appendChild(new FakeText('abc_123'));
  env.observer.callback([{ type: 'childList', addedNodes: [toast] }]);
  assert.equal(env.messages.length, 1);
  assert.equal(env.messages[0].url,
    'https://californiak12.powerschool.com/teachers/home.html#ecc=abc_123');
  assert.equal(env.status, undefined);
  env.observer.callback([{ type: 'childList', addedNodes: [toast] }]);
  assert.equal(env.messages.length, 1);
});

test('launch failure is visible without revealing the handoff payload', () => {
  const env = run({ approved: ['NEW-ROSTER'], reply: { ok: false, error: 'Tab blocked' } });
  const toast = new FakeElement();
  toast.appendChild(new FakeText('ECC_HANDOFF_V1:abc_123'));
  env.observer.callback([{ type: 'childList', addedNodes: [toast] }]);
  assert.match(env.status, /could not open: Tab blocked/);
  assert.doesNotMatch(env.status, /abc_123/);
});

test('approved sheet opens the Student Connection Call handoff only once', () => {
  const env = run({ approved: ['NEW-ROSTER'] });
  const toast = new FakeElement();
  toast.appendChild(new FakeText('SCC_HANDOFF_V1:'));
  toast.appendChild(new FakeText('abc_123'));
  env.observer.callback([{ type: 'childList', addedNodes: [toast] }]);
  assert.equal(env.messages.length, 1);
  assert.equal(env.messages[0].type, 'OPEN_POWERSCHOOL_SCC');
  assert.equal(env.messages[0].url,
    'https://californiak12.powerschool.com/teachers/home.html#scc=abc_123');
  assert.equal(env.status, undefined);
  env.observer.callback([{ type: 'childList', addedNodes: [toast] }]);
  assert.equal(env.messages.length, 1);
});

test('approved sheet opens a demographics handoff only once', () => {
  const env = run({ approved: ['NEW-ROSTER'] });
  const toast = new FakeElement();
  toast.appendChild(new FakeText('DEMOGRAPHICS_HANDOFF_V1:'));
  toast.appendChild(new FakeText('student_123'));
  env.observer.callback([{ type: 'childList', addedNodes: [toast] }]);
  assert.equal(env.messages.length, 1);
  assert.equal(env.messages[0].type, 'OPEN_POWERSCHOOL_DEMOGRAPHICS');
  assert.equal(env.messages[0].url,
    'https://californiak12.powerschool.com/teachers/home.html#demographics=student_123');
  assert.equal(env.status, undefined);
  env.observer.callback([{ type: 'childList', addedNodes: [toast] }]);
  assert.equal(env.messages.length, 1);
});
