'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element(tagName, props = {}) {
  return {
    tagName: tagName.toUpperCase(),
    children: [], events: {}, style: {},
    ...props,
    append(...children) { this.children.push(...children); },
    addEventListener(name, handler) { this.events[name] = handler; },
    setAttribute(name, value) { this[name] = value; },
    getAttribute() { return ''; },
    closest() { return null; },
    contains(other) { return this.children.some(child => child === other || child.contains?.(other)); }
  };
}

async function run() {
  const chosen = (tagName, name, value, label) => element(tagName, {
    name, id: name, value,
    selectedOptions: [{ textContent: label }],
    options: [{ value, textContent: label }]
  });
  const type = chosen('select', 'logtype', '1187', 'Log Type');
  const subtype = chosen('select', 'subtype', 'GE:ECC', 'ECC Attempt');
  const month = chosen('select', 'logmonth', '8', 'September');
  month.options = [{ value: '8', textContent: 'September' }, { value: '9', textContent: 'October' }];
  const status = chosen('select', 'result', 'no_answer', 'No answer');
  const student = chosen('select', 'studentNumber', '11230898', 'Student name');
  const note = element('input', { type: 'text', id: 'notes', name: 'notes', value: 'private call text' });
  const date = element('input', { type: 'date', id: 'logdate', name: 'logdate', value: '2026-09-14' });
  const controls = [type, subtype, month, status, student, date, note];
  const form = {
    querySelector(query) {
      return query === '#logtype' ? type : query === 'select[name="subtype"]' ? subtype : null;
    },
    querySelectorAll(query) { return query === 'label' ? [] : controls; }
  };
  let host;
  type.closest = () => form;
  type.parentElement = { insertAdjacentElement(_position, node) { host = node; } };
  const document = {
    getElementById(id) { return id === 'logtype' ? type : id === 'ps-settings-capture' ? host : null; },
    createElement,
    querySelectorAll() { return []; }
  };
  function createElement(tag) { return element(tag); }
  let stored;
  let copied;
  const chrome = { storage: { local: {
    async get() { return { powerSchoolSettingsCapturesV1: [] }; },
    async set(data) { stored = data.powerSchoolSettingsCapturesV1; }
  } } };
  const sessionStorage = {
    getItem() { return JSON.stringify({ kind: 'ECC', outcome: 'Attempt', date: '9/14/2026' }); }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'capture.js'), 'utf8');
  vm.runInNewContext(source, {
    location: { pathname: '/teachers/log.html' },
    document, chrome, sessionStorage,
    navigator: { clipboard: { async writeText(value) { copied = value; } } },
    Date, console
  });
  assert(host, 'capture control inserted next to the log form');
  const details = host.children[0];
  const scenario = details.children.find(child => child.tagName === 'LABEL').children[0];
  assert.equal(scenario.value, 'Attempt');
  const button = details.children.find(child => child.tagName === 'BUTTON');
  await button.events.click();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].requestedEccDate, '9/14/2026');
  assert.equal(stored[0].eccOutcome, 'Attempt');
  assert.equal(stored[0].dateControls.length, 2);
  assert.equal(stored[0].dateControls[0].options[1].text, 'October');
  assert.equal(stored[0].otherDropdowns[0].text, 'No answer');
  assert.equal(copied.split('\t').length, 9);
  assert(!JSON.stringify(stored).includes('11230898'), 'student ID excluded');
  assert(!JSON.stringify(stored).includes('private call text'), 'note text excluded');
  assert(!copied.includes('Student name'), 'student selector excluded');
  const copySettings = details.children.find(child =>
    child.tagName === 'BUTTON' && child.textContent === 'Copy Type/Subtype for Settings'
  );
  await copySettings.events.click();
  assert.equal(copied, '1187\tLog Type\tGE:ECC\tECC Attempt');
  console.log('Capture test passed.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
