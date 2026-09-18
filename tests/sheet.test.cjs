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
  let observer = null;
  const messages = [];
  const document = {
    body,
    documentElement: new FakeElement(),
    getElementById: id => body.children.find(child => child.id === id) || null,
    createElement: () => new FakeElement(),
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
  const context = vm.createContext({
    document, chrome, location: { pathname },
    MutationObserver: FakeObserver, HTMLElement: FakeElement,
    Node: NODE, NodeFilter: { SHOW_TEXT: 4 },
    console: { error() {} }
  });
  vm.runInContext(source, context);
  return {
    body, messages,
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
