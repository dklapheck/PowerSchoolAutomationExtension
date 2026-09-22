'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
const NOTE = 'On 9/18/2026, spoke with parent.';

function fixture({
  kind = 'SCC', stored = {}, sessionStored = {},
  original = 'PowerSchool header', settings, outcome, attemptNumber,
  pathname = '/teachers/log.html', search = '', hash,
  pageOptions = [], pageValue = '', date = '9/18/2026',
  authenticatedInitially = false
} = {}) {
  const elements = new Map();
  const session = new Map(Object.entries(sessionStored));
  const storage = { ...stored };
  const assignments = [];
  const consoleEntries = [];
  const body = { appendChild(el) { if (el.id) elements.set(el.id, el); } };
  let submits = 0;
  let authenticated = authenticatedInitially;
  let signInObserver = null;
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
  const pagePicker = makeSelect(pageOptions || []);
  pagePicker.value = pageValue;
  const tagSelect = makeSelect([
    ['', 'Choose Tag'], ['attempt_1', 'Attempt 1 (34)'], ['attempt_2', 'Attempt 2 (35)']
  ]);
  tagSelect.name = 'tag';
  const dateInput = makeElement();
  dateInput.id = 'entryLogDate';
  dateInput.name = 'UF-008005-1';
  dateInput.type = 'text';
  dateInput.value = '';
  const incidentDate = makeElement();
  incidentDate.id = '';
  incidentDate.name = 'UF-008019-1';
  incidentDate.type = 'text';
  incidentDate.value = '';
  const actionDate = makeElement();
  actionDate.id = '';
  actionDate.name = 'UF-008041-1';
  actionDate.type = 'text';
  actionDate.value = '';
  const noteBox = makeElement();
  noteBox.value = original;
  const schoolPicker = { textContent: 'CAVA-SO' };
  const document = {
    body, documentElement: {}, title: 'New Log',
    getElementById: id => id === 'logtype' ? logType :
      id === 'entryLogDate' ? dateInput :
      id === 'school_picker_teacherSchoolPicker_toggle_btn' && authenticated
        ? schoolPicker : elements.get(id) ?? null,
    querySelector: selector => selector === 'select[name="subtype"]'
      ? subtype : selector === 'textarea[name="UF-008009-1"]' ? noteBox
        : selector === 'select[name="page"]' && pageOptions !== null ? pagePicker : null,
    querySelectorAll: selector => selector === 'input, select'
      ? [logType, subtype, pagePicker, tagSelect, dateInput, incidentDate, actionDate]
      : selector === 'select' ? [logType, subtype, pagePicker, tagSelect]
        : [],
    createElement: () => makeElement()
  };
  const encoded = Buffer.from(JSON.stringify({
    v: 1, studentNumber: '12345678', date, note: NOTE, settings, outcome, attemptNumber
  })).toString('base64url');
  const locationHash = typeof hash === 'string'
    ? hash : '#' + kind.toLowerCase() + '=' + encoded;
  const browserLocation = new URL(pathname + search + locationHash,
    'https://californiak12.powerschool.com');
  browserLocation.assign = url => assignments.push(url);
  class FakeObserver {
    constructor(callback) { this.callback = callback; signInObserver = this; }
    observe() {}
    disconnect() {}
  }
  const context = vm.createContext({
    document, location: browserLocation,
    history: { replaceState(_state, _title, url) {
      browserLocation.href = new URL(url, browserLocation.href).href;
    } },
    sessionStorage: {
      getItem: key => session.get(key) ?? null,
      setItem: (key, value) => session.set(key, String(value)),
      removeItem: key => session.delete(key)
    },
    chrome: { storage: { local: {
      get: async defaults => ({ ...defaults, ...storage }),
      set: async values => Object.assign(storage, values),
      remove: async keys => {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
      }
    } } },
    Event: class { constructor(type) { this.type = type; } },
    MutationObserver: FakeObserver,
    URL, TextDecoder, Uint8Array, atob, setInterval, clearInterval, setTimeout,
    console: {
      log: (...args) => consoleEntries.push(args),
      error: (...args) => consoleEntries.push(args)
    }
  });
  vm.runInContext(source, context);
  return {
    logType, subtype, noteBox, dateInput, incidentDate, actionDate,
    tagSelect, storage, session, assignments, consoleEntries,
    completeSignIn() {
      authenticated = true;
      signInObserver?.callback([]);
    },
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
  assert.equal(JSON.stringify(env.consoleEntries).includes('12345678'), false);
  assert.equal(JSON.stringify(env.consoleEntries).includes(NOTE), false);
});

test('handoff survives the public sign-in page and resumes after login', async () => {
  const login = fixture({ pathname: '/public/home.html' });
  await waitFor(() => login.button);
  const pending = login.session.get('ps_ecc_workflow_payload_v1');
  assert.ok(pending);
  assert.ok(login.storage.ps_pending_handoff_v1);
  assert.match(login.button.textContent, /handoff saved.*sign in/i);

  const resumed = fixture({
    hash: '',
    sessionStored: { ps_ecc_workflow_payload_v1: pending },
    stored: {
      sccLogTypeValue: 'SCC_TYPE',
      sccLogSubtypeValue: 'SCC_PARENT'
    }
  });
  await waitFor(() => resumed.button?.textContent === 'SCC ready — review & Submit');
  assert.equal(resumed.noteBox.value, 'PowerSchool header\n\n' + NOTE);
  assert.equal(resumed.session.has('ps_ecc_workflow_payload_v1'), false);
});

test('handoff resumes after SSO loses tab sessionStorage', async () => {
  const pending = {
    kind: 'DEMOGRAPHICS', requestId: 'request-123', studentNumber: '12345678',
    date: '', note: '', outcome: '', attemptNumber: null, settings: null,
    stepCount: 0, startedAt: Date.now()
  };
  const env = fixture({
    hash: '',
    pathname: '/teachers/home.html',
    authenticatedInitially: true,
    stored: {
      ps_pending_handoff_v1: { savedAt: Date.now(), state: pending }
    }
  });
  await waitFor(() => env.submits === 1);
  assert.ok(env.session.has('ps_ecc_workflow_payload_v1'));
  assert.equal('ps_pending_handoff_v1' in env.storage, false);
});

test('expired SSO recovery backup is discarded', async () => {
  const pending = {
    kind: 'DEMOGRAPHICS', requestId: 'request-123', studentNumber: '12345678',
    date: '', note: '', outcome: '', attemptNumber: null, settings: null,
    stepCount: 0, startedAt: Date.now() - (31 * 60 * 1000)
  };
  const env = fixture({
    hash: '',
    pathname: '/teachers/home.html',
    authenticatedInitially: true,
    stored: {
      ps_pending_handoff_v1: {
        savedAt: Date.now() - (31 * 60 * 1000),
        state: pending
      }
    }
  });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(env.submits, 0);
  assert.equal(env.session.has('ps_ecc_workflow_payload_v1'), false);
  assert.equal('ps_pending_handoff_v1' in env.storage, false);
});

test('teacher login page keeps the handoff pending until sign-in completes', async () => {
  const env = fixture({ pathname: '/teachers/home.html' });
  await waitFor(() => env.button);
  assert.ok(env.session.get('ps_ecc_workflow_payload_v1'));
  assert.match(env.button.textContent, /sign in.*continue automatically/i);
  assert.equal(env.submits, 0);

  env.completeSignIn();
  await waitFor(() => env.submits === 1);
  assert.ok(env.session.get('ps_ecc_workflow_payload_v1'));
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

test('Settings handoff overrides remembered SCC choices', async () => {
  const env = fixture({
    stored: { sccLogTypeValue: '1187', sccLogSubtypeValue: 'GE:ECC' },
    outcome: 'SCC Attempt',
    attemptNumber: 2,
    settings: {
      typeValue: 'SCC_TYPE', subtypeValue: 'SCC_PARENT', extraDropdowns: [],
      dateFields: ['entryLogDate', 'UF-008019-1', 'UF-008041-1'],
      tagMap: { 2: 'Attempt 2 (35)' }, tagLabel: ''
    }
  });
  await waitFor(() => env.button?.textContent === 'SCC ready — review & Submit');
  assert.equal(env.logType.value, 'SCC_TYPE');
  assert.equal(env.subtype.value, 'SCC_PARENT');
  assert.equal(env.dateInput.value, '9/18/2026');
  assert.equal(env.incidentDate.value, '9/18/2026');
  assert.equal(env.actionDate.value, '9/18/2026');
  assert.equal(env.tagSelect.value, 'attempt_2');
  assert.equal(env.submits, 0);
});

test('blank SCC Settings prompt manual choices despite remembered selections', async () => {
  const env = fixture({
    stored: { sccLogTypeValue: '1187', sccLogSubtypeValue: 'GE:ECC' },
    settings: { typeValue: '', subtypeValue: '', extraDropdowns: [] }
  });
  await waitFor(() => env.button?.textContent.includes('choose Type & Subtype'));
  assert.equal(env.noteBox.value, 'PowerSchool header');
  assert.equal(env.submits, 0);
});

test('unavailable configured choice leaves ECC note untouched', async () => {
  const env = fixture({ kind: 'ECC', original: 'Contact: Note',
    settings: { typeValue: '1187', subtypeValue: 'old_subtype', extraDropdowns: [] }
  });
  await waitFor(() => env.button?.textContent === 'ECC automation stopped');
  assert.equal(env.noteBox.value, 'Contact: Note');
  assert.equal(env.submits, 0);
});

test('demographics handoff opens the Demographics option from a student screen', async () => {
  const env = fixture({
    kind: 'DEMOGRAPHICS',
    pathname: '/teachers/studentpages/contacts.html',
    pageOptions: [
      ['/teachers/studentpages/contacts.html?frn=123', 'Contacts'],
      ['/teachers/studentpages/demographics.html?frn=123', 'Demographics']
    ],
    pageValue: '/teachers/studentpages/contacts.html?frn=123'
  });
  await waitFor(() => env.assignments.length === 1);
  assert.equal(env.assignments[0],
    '/teachers/studentpages/demographics.html?frn=123');
  assert.ok(env.session.has('ps_ecc_workflow_payload_v1'));
  assert.equal(env.submits, 0);
});

test('demographics handoff finishes without opening or editing a log', async () => {
  const demographicsUrl = '/teachers/studentpages/demographics.html?frn=123';
  const env = fixture({
    kind: 'DEMOGRAPHICS',
    pathname: '/teachers/studentpages/demographics.html',
    pageOptions: [[demographicsUrl, 'Demographics']],
    pageValue: demographicsUrl
  });
  await waitFor(() =>
    env.button?.textContent === 'Demographics open — review student information'
  );
  assert.equal(env.assignments.length, 0);
  assert.equal(env.session.has('ps_ecc_workflow_payload_v1'), false);
  assert.equal(env.noteBox.value, 'PowerSchool header');
  assert.equal(env.submits, 0);
});

test('demographics route finishes even when the screen picker reports another page', async () => {
  const demographicsUrl = '/teachers/studentpages/demographics.html?frn=123';
  const env = fixture({
    kind: 'DEMOGRAPHICS',
    pathname: '/teachers/studentpages/demographics.html',
    pageOptions: [
      ['/teachers/studentpages/contacts.html?frn=123', 'Contacts'],
      [demographicsUrl, 'Demographics']
    ],
    pageValue: '/teachers/studentpages/contacts.html?frn=123'
  });
  await waitFor(() =>
    env.button?.textContent === 'Demographics open — review student information'
  );
  assert.equal(env.assignments.length, 0);
  assert.equal(env.session.has('ps_ecc_workflow_payload_v1'), false);
});

const WORKFLOW_KEY = 'ps_ecc_workflow_payload_v1';
const READY_DEMOGRAPHICS = 'Demographics open — review student information';
const CONTACTS_URL = '/teachers/studentpages/contacts.html?frn=123';
const CUSTOM_DEMOGRAPHICS_URL = '/teachers/studentpages/custom_student_info.html?frn=123&sectionid=456';
const SCREEN_OPTIONS = [[CONTACTS_URL, 'Contacts'], [CUSTOM_DEMOGRAPHICS_URL, 'Demographics']];

test('custom Demographics URL is recognized with a stale picker and reordered query', async () => {
  const env = fixture({
    kind: 'DEMOGRAPHICS',
    pathname: '/teachers/studentpages/custom_student_info.html',
    search: '?sectionid=456&frn=123',
    pageOptions: [[CONTACTS_URL, 'Contacts'],
      ['custom_student_info.html?frn=123&sectionid=456#details', 'Demographics']],
    pageValue: CONTACTS_URL
  });
  await waitFor(() => env.button?.textContent === READY_DEMOGRAPHICS);
  assert.deepEqual(env.assignments, []);
  assert.equal(env.session.has(WORKFLOW_KEY), false);
  assert.equal(env.submits, 0);
});

test('standard Demographics page finishes without a screen picker', async () => {
  const env = fixture({
    kind: 'DEMOGRAPHICS', pathname: '/teachers/studentpages/demographics.html',
    pageOptions: null
  });
  await waitFor(() => env.button?.textContent === READY_DEMOGRAPHICS);
  assert.deepEqual(env.assignments, []);
  assert.equal(env.session.has(WORKFLOW_KEY), false);
});

test('a stale Demographics selection on Contacts does not falsely report success', async () => {
  const env = fixture({
    kind: 'DEMOGRAPHICS', pathname: '/teachers/studentpages/contacts.html',
    search: '?frn=123', pageOptions: SCREEN_OPTIONS, pageValue: CUSTOM_DEMOGRAPHICS_URL
  });
  await waitFor(() => env.assignments.length === 1);
  assert.notEqual(env.button?.textContent, READY_DEMOGRAPHICS);
});

test('Demographics navigation completes across documents and refresh does not restart it', async () => {
  const first = fixture({
    kind: 'DEMOGRAPHICS', pathname: '/teachers/studentpages/contacts.html',
    search: '?frn=123', pageOptions: SCREEN_OPTIONS, pageValue: CONTACTS_URL
  });
  await waitFor(() => first.assignments.length === 1);
  const arrived = fixture({
    hash: '', pathname: '/teachers/studentpages/custom_student_info.html',
    search: '?frn=123&sectionid=456', pageOptions: null,
    sessionStored: Object.fromEntries(first.session), stored: first.storage
  });
  await waitFor(() => arrived.button?.textContent === READY_DEMOGRAPHICS);
  assert.deepEqual(arrived.assignments, []);
  assert.equal(arrived.session.has(WORKFLOW_KEY), false);
  assert.equal('ps_pending_handoff_v1' in arrived.storage, false);
  assert.equal(arrived.noteBox.value, 'PowerSchool header');
  assert.equal(arrived.submits, 0);

  const refreshed = fixture({
    hash: '', pathname: '/teachers/studentpages/custom_student_info.html',
    search: '?frn=123&sectionid=456', pageOptions: SCREEN_OPTIONS, pageValue: CONTACTS_URL,
    sessionStored: Object.fromEntries(arrived.session), stored: arrived.storage
  });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(refreshed.assignments, []);
  assert.equal(refreshed.submits, 0);
  assert.equal(refreshed.button, undefined);
});

for (const destination of ['contacts', 'home', 'wrong-student']) {
  test('Demographics redirect to ' + destination + ' stops instead of navigating again', async () => {
    const first = fixture({
      kind: 'DEMOGRAPHICS', pathname: '/teachers/studentpages/contacts.html',
      search: '?frn=123', pageOptions: SCREEN_OPTIONS, pageValue: CONTACTS_URL
    });
    await waitFor(() => first.assignments.length === 1);
    const returned = fixture({
      hash: '',
      pathname: destination === 'home' ? '/teachers/home.html'
        : destination === 'wrong-student' ? '/teachers/studentpages/custom_student_info.html'
          : '/teachers/studentpages/contacts.html',
      search: destination === 'wrong-student' ? '?frn=999&sectionid=456' : '?frn=123',
      authenticatedInitially: true, pageOptions: SCREEN_OPTIONS, pageValue: CONTACTS_URL,
      sessionStored: Object.fromEntries(first.session), stored: first.storage
    });
    await waitFor(() => returned.button?.textContent === 'Demographics automation stopped');
    assert.deepEqual(returned.assignments, []);
    assert.equal(returned.submits, 0);
    assert.equal(returned.session.has(WORKFLOW_KEY), false);
    assert.equal('ps_pending_handoff_v1' in returned.storage, false);
    assert.match(returned.session.get('ps_helper_last_error_v1'), /reload loop/i);

    const refreshed = fixture({
      hash: '', pathname: '/teachers/home.html', authenticatedInitially: true,
      sessionStored: Object.fromEntries(returned.session), stored: returned.storage
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(refreshed.assignments, []);
    assert.equal(refreshed.submits, 0);
  });
}
