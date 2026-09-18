'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
const NOTE = 'On 9/18/2026, spoke with parent.';

function fixture({ kind = 'SCC', stored = {}, original = 'PowerSchool header' } = {}) {
  const elements = new Map();
  const session = new Map();
  const storage = { ...stored };
  const body = { appendChild(el) { if (el.id) elements.set(el.id, el); } };
  let submits = 0;
  const makeElement = () => ({
    style: {},
    children: [],
    appendChild(el) { this.children.push(el); },
    addEventListener() {},
    remove() { elements.delete(this.id); },
    dispatchEvent() {},
    setAttribute() {},
    scrollIntoView() {},
    focus() {},
    submit() { submits++; }
  });
  function makeSelect(options) {
    const select = makeElement();
    select.value = '';
    select.options = options.map(([value, textContent]) => ({ value, textContent }));
    Object.defineProperty(select, 'selectedOptions', {
      get: () => select.options.filter(option => option.value === select.value)
    });
    return select;
  }
  const logType = makeSelect([['', 'Choose Type'], ['1187', 'Student Contact'], ['SCC_TYPE', 'Student Connection Call']]);
  const subtype = makeSelect([['', 'Choose Subtype'], ['GE:ECC', 'ECC'], ['SCC_PARENT', 'Parent Connection Call']]);
  const noteBox = makeElement();
  noteBox.value = original;
  const document = {
    body, title: 'New Log',
    getElementById: id => id === 'logtype' ? logType : elements.get(id) ?? null,
    querySelector: selector => selector === 'select[name="subtype"]'
      ? subtype : selector === 'textarea[name="UF-008009-1"]' ? noteBox : null,
    querySelectorAll: () => [],
    createElement: () => makeElement()
  };
  const encoded = Buffer.from(JSON.stringify({
    v: 1, studentNumber: '12345678', note: NOTE
  })).toString('base64url');
  const context = vm.createContext({
    document, location: { pathname: '/teachers/log.html', search: '', hash: '#' + kind.toLowerCase() + '=' + encoded },
    history: { replaceState() {} },
    sessionStorage: {
      getItem: key => session.get(key) ?? null,
      setItem: (key, value) => session.set(key, String(value)),
      removeItem: key => session.delete(key)
    },
    chrome: { storage: { local: {
      get: async defaults => ({ ...defaults, ...storage }),
      set: async values => Object.assign(storage, values)
    } } },
    Event: class { constructor(type) { this.type = type; } },
    TextDecoder, Uint8Array, atob, setInterval, clearInterval, setTimeout,
    console: { log() {}, error() {} }
  });
  vm.runInContext(source, context);
  return {
    logType, subtype, noteBox, storage, session,
    get button() { return elements.get('ps-ecc-status-button'); },
    get submits() { return submits; }
  };
}

async function waitFor(predicate, timeout = 2500) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for handoff');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

test('saved SCC selections prepare the parent call and preserve template text', async () => {
  const env = fixture({ stored: {
    sccLogTypeValue: 'SCC_TYPE', sccLogSubtypeValue: 'SCC_PARENT'
  } });
  await waitFor(() => env.button?.textContent === 'SCC ready — review & Submit');
  assert.equal(env.logType.value, 'SCC_TYPE');
  assert.equal(env.subtype.value, 'SCC_PARENT');
  assert.equal(env.noteBox.value, 'PowerSchool header\n\n' + NOTE);
  assert.equal(env.submits, 0);
  assert.equal(env.session.has('ps_ecc_workflow_payload_v1'), false);
});

test('first SCC handoff waits for teacher selections and remembers them', async () => {
  const env = fixture({ original: 'Call note: Note' });
  await waitFor(() => env.button?.textContent.includes('choose Type & Subtype'));
  assert.equal(env.noteBox.value, 'Call note: Note');
  env.logType.value = 'SCC_TYPE';
  env.subtype.value = 'SCC_PARENT';
  env.button.onclick();
  await waitFor(() => env.button?.textContent === 'SCC ready — review & Submit');
  assert.equal(env.noteBox.value, 'Call note: ' + NOTE);
  assert.equal(env.storage.sccLogTypeValue, 'SCC_TYPE');
  assert.equal(env.storage.sccLogSubtypeLabel, 'Parent Connection Call');
  assert.equal(env.submits, 0);
});

test('missing saved subtype stops before changing the note', async () => {
  const env = fixture({ stored: {
    sccLogTypeValue: 'SCC_TYPE', sccLogSubtypeValue: 'NO_LONGER_AVAILABLE'
  } });
  await waitFor(() => env.button?.textContent === 'SCC automation stopped');
  assert.equal(env.noteBox.value, 'PowerSchool header');
  assert.equal(env.submits, 0);
});

test('ECC still uses its own type, subtype, and Note placeholder', async () => {
  const env = fixture({ kind: 'ECC', original: 'Contact: Note' });
  await waitFor(() => env.button?.textContent === 'ECC ready — review & Submit');
  assert.equal(env.logType.value, '1187');
  assert.equal(env.subtype.value, 'GE:ECC');
  assert.equal(env.noteBox.value, 'Contact: ' + NOTE);
  assert.equal(env.submits, 0);
});
