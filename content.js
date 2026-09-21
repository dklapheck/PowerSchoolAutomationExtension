(() => {
  'use strict';

  // ============================================================
  // PowerSchool Helper v3
  //
  // Security / behavior:
  // - Runs only on PowerSchool teacher pages.
  // - Reads no cookies or passwords.
  // - Makes no outside network requests.
  // - ECC payload is removed from the URL immediately and kept
  //   only in PowerSchool sessionStorage during navigation.
  // - ECC and SCC workflows NEVER click Submit.
  // ============================================================

  const SONOMA_CODE = 'CAVA-SO';
  const SONOMA_NAME = 'California Virtual Academies @ Sonoma';

  const OR010_SECTION_ID = '37151';
  const OR010_SECTION_NAME =
    'OR010SYNA02-ORN010 Online Learning 6-12-S1SHA15HR';

  const OR010_PENDING_KEY = 'ps_or010_pending';
  const OR010_ATTEMPT_KEY = 'ps_or010_switch_attempts';
  const OR010_BUTTON_ID = 'ps-or010-homeroom-button';

  const ECC_STORAGE_KEY = 'ps_ecc_workflow_payload_v1';
  const ECC_BUTTON_ID = 'ps-ecc-status-button';
  const ECC_MAX_STEPS = 12;
  const SCC_TYPE_KEY = 'sccLogTypeValue';
  const SCC_SUBTYPE_KEY = 'sccLogSubtypeValue';
  const SCC_TYPE_LABEL_KEY = 'sccLogTypeLabel';
  const SCC_SUBTYPE_LABEL_KEY = 'sccLogSubtypeLabel';

  const ERROR_PANEL_ID = 'ps-helper-error-panel';
  const ERROR_STORAGE_KEY = 'ps_helper_last_error_v1';
  let eccWorkflowRunning = false;
  let signInObserver = null;

  // PowerSchool ECC form values discovered on the live form.
  const ECC_LOG_TYPE_VALUE = '1187';   // Student Contact
  const ECC_SUBTYPE_VALUE = 'GE:ECC';  // GE:ECC Enduring Con. Call
  const ECC_NOTE_SELECTOR = 'textarea[name="UF-008009-1"]';

  // ============================================================
  // GENERAL HELPERS
  // ============================================================

  function normalize(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function waitFor(getter, timeout = 10000, interval = 100) {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      const timer = setInterval(() => {
        let result = null;

        try {
          result = getter();
        } catch (_) {
          // Keep waiting.
        }

        if (result) {
          clearInterval(timer);
          resolve(result);
          return;
        }

        if (Date.now() - start >= timeout) {
          clearInterval(timer);
          reject(
            new Error('Timed out waiting for the PowerSchool page.')
          );
        }
      }, interval);
    });
  }

  function fireEvents(element) {
    element.dispatchEvent(
      new Event('input', { bubbles: true })
    );

    element.dispatchEvent(
      new Event('change', { bubbles: true })
    );
  }

  function showPersistentError(title, message) {
    const record = {
      title: String(title || 'PowerSchool Helper Error'),
      message: String(message || 'Unknown error'),
      time: new Date().toLocaleString()
    };

    sessionStorage.setItem(
      ERROR_STORAGE_KEY,
      JSON.stringify(record)
    );

    let panel = document.getElementById(ERROR_PANEL_ID);

    if (!panel) {
      panel = document.createElement('div');
      panel.id = ERROR_PANEL_ID;

      Object.assign(panel.style, {
        position: 'fixed',
        left: '16px',
        bottom: '16px',
        zIndex: '2147483647',
        width: 'min(620px, calc(100vw - 32px))',
        maxHeight: '45vh',
        overflow: 'auto',
        padding: '12px',
        border: '2px solid #9c2f2f',
        borderRadius: '8px',
        background: '#fff7f7',
        color: '#222',
        fontFamily: 'Arial, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
      });

      document.body.appendChild(panel);
    }

    panel.innerHTML = '';

    const heading = document.createElement('div');
    heading.textContent = record.title + ' · ' + record.time;
    Object.assign(heading.style, {
      fontWeight: '700',
      marginBottom: '8px',
      color: '#8b1f1f'
    });

    const text = document.createElement('pre');
    text.textContent = record.message;
    Object.assign(text.style, {
      whiteSpace: 'pre-wrap',
      userSelect: 'text',
      margin: '0 0 10px 0',
      fontFamily: 'Consolas, monospace',
      fontSize: '12px'
    });

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy error';
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          record.title + '\n' + record.time + '\n\n' + record.message
        );
        copy.textContent = 'Copied';
      } catch (_) {
        text.focus?.();
        window.getSelection()?.selectAllChildren(text);
      }
    };

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Dismiss';
    close.style.marginLeft = '8px';
    close.onclick = () => {
      sessionStorage.removeItem(ERROR_STORAGE_KEY);
      panel.remove();
    };

    panel.appendChild(heading);
    panel.appendChild(text);
    panel.appendChild(copy);
    panel.appendChild(close);
  }

  function restorePersistentError() {
    const raw = sessionStorage.getItem(ERROR_STORAGE_KEY);
    if (!raw) return;

    try {
      const record = JSON.parse(raw);
      showPersistentError(record.title, record.message);
    } catch (_) {
      sessionStorage.removeItem(ERROR_STORAGE_KEY);
    }
  }

  // ============================================================
  // SCHOOL PICKER
  // ============================================================

  function getSchoolPicker() {
    return document.getElementById(
      'school_picker_teacherSchoolPicker_toggle_btn'
    );
  }

  function currentSchoolIsSonoma() {
    const picker = getSchoolPicker();

    if (!picker) return false;

    const text = normalize(picker.textContent);

    return (
      text.includes(SONOMA_CODE) ||
      text.includes(SONOMA_NAME)
    );
  }

  async function switchToSonoma() {
    const picker = await waitFor(
      () => getSchoolPicker()
    );

    if (picker.getAttribute('aria-expanded') !== 'true') {
      picker.click();
    }

    const sonomaOption = await waitFor(() => {
      const options = [
        ...document.querySelectorAll('li[role="menuitem"]')
      ];

      return (
        options.find(item =>
          normalize(item.textContent).includes(SONOMA_CODE)
        ) ||
        options.find(item =>
          normalize(item.textContent).includes(SONOMA_NAME)
        )
      );
    });

    console.log(
      '[PowerSchool Helper] Switching to Sonoma:',
      normalize(sonomaOption.textContent)
    );

    sonomaOption.click();
  }

  // ============================================================
  // OR010 HOMEROOM SHORTCUT
  // ============================================================

  function alreadyOnOR010() {
    const label = [
      ...document.querySelectorAll('b')
    ].find(
      el => normalize(el.textContent) === 'Teacher Section:'
    );

    if (!label || !label.nextElementSibling) {
      return false;
    }

    return normalize(
      label.nextElementSibling.textContent
    ).includes(OR010_SECTION_NAME);
  }

  function getOR010Button() {
    return document.getElementById(OR010_BUTTON_ID);
  }

  function setOR010Button(text, disabled = false) {
    const button = getOR010Button();

    if (!button) return;

    button.textContent = text;
    button.disabled = disabled;
    button.style.opacity = disabled ? '0.72' : '1';
    button.style.cursor = disabled ? 'wait' : 'pointer';
  }

  function clearOR010Pending() {
    sessionStorage.removeItem(OR010_PENDING_KEY);
    sessionStorage.removeItem(OR010_ATTEMPT_KEY);
  }

  function submitOR010Search() {
    clearOR010Pending();

    setOR010Button('Opening OR010…', true);

    const fields = {
      timeframe: 'Current',
      teacherSectionID: OR010_SECTION_ID,
      selectedSectionIds: OR010_SECTION_ID,
      sectionName: OR010_SECTION_NAME,
      from: 'ds'
    };

    const form = document.createElement('form');

    form.method = 'POST';
    form.action = '/teachers/studentSearchResults.html';
    form.style.display = 'none';

    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input');

      input.type = 'hidden';
      input.name = name;
      input.value = value;

      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }

  async function continueOR010Workflow() {
    try {
      if (alreadyOnOR010()) {
        clearOR010Pending();
        setOR010Button('OR010 Homeroom ✓');
        return;
      }

      setOR010Button('Checking school…', true);

      await waitFor(
        () => getSchoolPicker()
      );

      if (currentSchoolIsSonoma()) {
        submitOR010Search();
        return;
      }

      const attempts =
        Number(
          sessionStorage.getItem(OR010_ATTEMPT_KEY) || '0'
        ) + 1;

      sessionStorage.setItem(
        OR010_ATTEMPT_KEY,
        String(attempts)
      );

      if (attempts > 3) {
        throw new Error(
          'Could not switch PowerSchool to Sonoma.'
        );
      }

      setOR010Button('Switching to Sonoma…', true);
      await switchToSonoma();

    } catch (error) {
      clearOR010Pending();
      setOR010Button('OR010: Could not open');

      console.error('[PowerSchool OR010]', error);

      showPersistentError(
        'OR010 shortcut could not finish',
        error?.message || String(error)
      );
    }
  }

  function createOR010Button() {
    if (document.getElementById(OR010_BUTTON_ID)) {
      return;
    }

    const button = document.createElement('button');

    button.id = OR010_BUTTON_ID;
    button.type = 'button';
    button.textContent = alreadyOnOR010()
      ? 'OR010 Homeroom ✓'
      : 'Open OR010 Homeroom';

    Object.assign(button.style, {
      position: 'fixed',
      left: '16px',
      top: '16px',
      zIndex: '2147483646',
      minHeight: '40px',
      padding: '9px 13px',
      border: '1px solid #174a75',
      borderRadius: '6px',
      background: '#1d5f91',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontWeight: '700',
      cursor: 'pointer',
      boxShadow: '0 2px 7px rgba(0,0,0,0.25)'
    });

    button.addEventListener('click', () => {
      sessionStorage.setItem(OR010_PENDING_KEY, 'yes');
      sessionStorage.setItem(OR010_ATTEMPT_KEY, '0');
      continueOR010Workflow();
    });

    document.body.appendChild(button);
  }

  // ============================================================
  // ECC PAYLOAD
  // ============================================================

  function decodeBase64Url(text) {
    let base64 = text
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    while (base64.length % 4) {
      base64 += '=';
    }

    const binary = atob(base64);

    const bytes = Uint8Array.from(
      binary,
      c => c.charCodeAt(0)
    );

    return new TextDecoder().decode(bytes);
  }

  function importPowerSchoolPayloadFromHash() {
    const hash = location.hash || '';
    const handoff = [
      { marker: '#demographics=', kind: 'DEMOGRAPHICS' },
      { marker: '#scc=', kind: 'SCC' },
      { marker: '#ecc=', kind: 'ECC' }
    ].find(candidate => hash.startsWith(candidate.marker));
    if (!handoff) return null;

    const kind = handoff.kind;
    const encoded = hash.slice(handoff.marker.length);

    // Remove the student/note payload from the visible URL immediately.
    history.replaceState(
      null,
      document.title,
      location.pathname + location.search
    );

    try {
      const payload = JSON.parse(
        decodeBase64Url(encoded)
      );

      const studentNumber = String(
        payload.studentNumber || ''
      ).trim();

      const date = String(
        payload.date || ''
      ).trim();

      const note = String(
        payload.note || ''
      ).trim();

      if (!/^\d+$/.test(studentNumber)) {
        throw new Error(
          'Invalid or missing student number.'
        );
      }

      if (kind !== 'DEMOGRAPHICS' && !note) {
        throw new Error(
          'The ' + kind + ' note is empty.'
        );
      }

      const state = {
        kind,
        studentNumber,
        date,
        note,
        outcome: String(payload.outcome || '').trim(),
        settings: payload.settings && typeof payload.settings === 'object'
          ? {
              typeValue: String(payload.settings.typeValue || '').trim(),
              subtypeValue: String(payload.settings.subtypeValue || '').trim(),
              extraDropdowns: Array.isArray(payload.settings.extraDropdowns)
                ? payload.settings.extraDropdowns : [],
              dateField: String(payload.settings.dateField || '').trim(),
              tagLabel: String(payload.settings.tagLabel || '').trim()
            }
          : null,
        stepCount: 0,
        startedAt: Date.now()
      };

      if (kind !== 'DEMOGRAPHICS') {
        // Keep only non-student form context for the temporary settings capture.
        // The note and student number remain in the short-lived workflow state.
        sessionStorage.setItem('ps_form_capture_context_v1', JSON.stringify({
          kind,
          date: kind === 'ECC' ? date : '',
          outcome: kind === 'SCC' ? state.outcome :
            (state.outcome === 'ECC Attempt' || /\[Attempt\]/.test(note))
              ? 'Attempt' : 'Conversation'
        }));
      }

      sessionStorage.setItem(
        ECC_STORAGE_KEY,
        JSON.stringify(state)
      );

      return state;

    } catch (error) {
      console.error(
        '[PowerSchool ' + kind + '] Could not read handoff payload.',
        error
      );

      showPersistentError(
        kind + ' handoff from Google Sheets could not be read',
        error?.message || String(error)
      );

      return null;
    }
  }

  function loadECCState() {
    const raw = sessionStorage.getItem(ECC_STORAGE_KEY);

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_) {
      sessionStorage.removeItem(ECC_STORAGE_KEY);
      return null;
    }
  }

  function saveECCState(state) {
    sessionStorage.setItem(
      ECC_STORAGE_KEY,
      JSON.stringify(state)
    );
  }

  function clearECCState() {
    sessionStorage.removeItem(ECC_STORAGE_KEY);
  }

  function getWorkflowLabel(kind) {
    return kind === 'DEMOGRAPHICS' ? 'Demographics' : kind;
  }

  // ============================================================
  // ECC STATUS BUTTON — TOP LEFT
  // ============================================================

  function getECCButton() {
    return document.getElementById(ECC_BUTTON_ID);
  }

  function setECCButton(text, mode = 'working') {
    let button = getECCButton();

    if (!button) {
      button = document.createElement('button');

      button.id = ECC_BUTTON_ID;
      button.type = 'button';

      Object.assign(button.style, {
        position: 'fixed',
        left: '16px',
        top: '64px',
        zIndex: '2147483647',
        minHeight: '40px',
        padding: '9px 13px',
        border: '1px solid #555',
        borderRadius: '6px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontWeight: '700',
        boxShadow: '0 2px 7px rgba(0,0,0,0.25)'
      });

      document.body.appendChild(button);
    }

    button.textContent = text;

    if (mode === 'ready') {
      button.style.background = '#217346';
      button.style.cursor = 'default';
      button.disabled = true;

    } else if (mode === 'setup') {
      button.style.background = '#174a75';
      button.style.cursor = 'pointer';
      button.disabled = false;

    } else if (mode === 'error') {
      button.style.background = '#9c2f2f';
      button.style.cursor = 'pointer';
      button.disabled = false;

    } else {
      button.style.background = '#6b5a16';
      button.style.cursor = 'wait';
      button.disabled = true;
    }
  }

  function failECC(message) {
    const kind = getWorkflowLabel(loadECCState()?.kind || 'ECC');
    console.error('[PowerSchool ' + kind + ']', message);

    clearECCState();
    setECCButton(kind + ' automation stopped', 'error');

    const button = getECCButton();

    if (button) {
      button.onclick = () => button.remove();
    }

    showPersistentError(
      kind + ' automation stopped before submitting anything',
      message + '\n\nYou can continue manually in PowerSchool.'
    );
  }

  // ============================================================
  // STUDENT SEARCH
  // ============================================================

  function submitStudentNumberSearch(studentNumber) {
    const form = document.createElement('form');

    form.method = 'POST';
    form.action = '/teachers/studentSearchResults.html';
    form.style.display = 'none';

    const fields = {
      studentPrefLast: '',
      studentPrefFirst: '',
      stunum: studentNumber,
      gradeLevel: '',
      timeframe: 'Current',
      from: 'ds'
    };

    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input');

      input.type = 'hidden';
      input.name = name;
      input.value = value;

      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }

  function findStudentRow(studentNumber) {
    return [
      ...document.querySelectorAll('tr')
    ].find(row =>
      normalize(row.textContent).includes(studentNumber)
    ) || null;
  }

  function findStudentInfoLink(row) {
    if (!row) return null;

    const links = [
      ...row.querySelectorAll('a[href]')
    ];

    return (
      links.find(a =>
        normalize(a.textContent)
          .toLowerCase()
          .includes('view student info')
      ) ||
      links.find(a =>
        /studentpages|student\.html|frn=/i.test(
          a.getAttribute('href') || ''
        )
      ) ||
      links[0] ||
      null
    );
  }

  function getStudentLogSummaryUrl(studentLink) {
    if (!studentLink) return null;

    try {
      const url = new URL(
        studentLink.getAttribute('href') || studentLink.href,
        location.origin
      );

      const frn = url.searchParams.get('frn');
      const sectionId = url.searchParams.get('sectionid');

      if (!frn || !/^\d+$/.test(frn)) {
        return null;
      }

      const target = new URL(
        '/teachers/studentpages/stride_log_summary.html',
        location.origin
      );

      target.searchParams.set('frn', frn);

      if (sectionId) {
        target.searchParams.set('sectionid', sectionId);
      }

      return target.pathname + target.search;

    } catch (_) {
      return null;
    }
  }

  // ============================================================
  // STUDENT SCREEN -> LOG ENTRIES FALLBACK
  // ============================================================

  function getLogEntriesUrl() {
    const screenPicker = document.querySelector(
      'select[name="page"]'
    );

    if (!screenPicker) {
      return null;
    }

    const logOption = [
      ...screenPicker.options
    ].find(option =>
      normalize(option.textContent) === 'Log Entries'
    );

    return logOption?.value || null;
  }

  function getDemographicsScreen() {
    const screenPicker = document.querySelector(
      'select[name="page"]'
    );
    if (!screenPicker) return null;

    const option = [
      ...screenPicker.options
    ].find(candidate =>
      normalize(candidate.textContent).toLowerCase() === 'demographics'
    );
    if (!option) return null;

    const selected = screenPicker.selectedOptions?.[0] ||
      screenPicker.options[screenPicker.selectedIndex];
    return {
      isCurrent: selected === option ||
        normalize(selected?.textContent).toLowerCase() === 'demographics',
      url: option.value || ''
    };
  }

  // ============================================================
  // LOG ENTRIES -> NEW LOG
  // ============================================================

  function getNewLogUrl() {
    const newLogLink = document.querySelector(
      'a#btnNew[href*="/teachers/log.html"]'
    );

    if (
      newLogLink &&
      newLogLink.getAttribute('href')
    ) {
      return newLogLink.getAttribute('href');
    }

    // Fallback if PowerSchool changes the element ID.
    const fallback = [
      ...document.querySelectorAll('a[href]')
    ].find(a => {
      const text = normalize(a.textContent);
      const href = a.getAttribute('href') || '';

      return (
        text === 'New' &&
        href.includes('/teachers/log.html') &&
        href.includes('studentfrn=')
      );
    });

    return fallback?.getAttribute('href') || null;
  }

  // ============================================================
  // FILL ECC OR STUDENT CONNECTION CALL LOG
  // ============================================================

  async function getSccSelections(logType, manualOnly = false) {
    if (!manualOnly) {
      // Compatibility for older Apps Script handoffs without Settings values.
      const saved = await chrome.storage.local.get({
        [SCC_TYPE_KEY]: '',
        [SCC_SUBTYPE_KEY]: ''
      });
      if (saved[SCC_TYPE_KEY] && saved[SCC_SUBTYPE_KEY]) {
        return {
          typeValue: saved[SCC_TYPE_KEY],
          subtypeValue: saved[SCC_SUBTYPE_KEY],
          manual: false
        };
      }
    }

    // The first time, the teacher chooses this school's SCC options in
    // PowerSchool. Do not guess values from ECC or from another school.
    setECCButton('SCC: choose Type & Subtype, then click here', 'setup');
    return new Promise(resolve => {
      getECCButton().onclick = () => {
        const subtype = document.querySelector('select[name="subtype"]');
        const typeOption = logType.selectedOptions[0];
        const subtypeOption = subtype?.selectedOptions[0];
        if (!logType.value || !subtype?.value ||
            typeOption?.disabled || subtypeOption?.disabled) {
          showPersistentError('SCC selections needed',
            'Choose the Student Connection Call Log Type and Subtype in PowerSchool, then click the blue SCC button.');
          return;
        }
        getECCButton().onclick = null;
        resolve({
          typeValue: logType.value,
          subtypeValue: subtype.value,
          manual: true
        });
      };
    });
  }

  function selectExtraDropdowns(logType, extraDropdowns) {
    const scope = logType.closest?.('form') || document;
    for (const entry of extraDropdowns) {
      const name = String(entry?.name || '');
      const value = String(entry?.value || '');
      if (!/^[A-Za-z0-9_:-]{1,80}$/.test(name) || !value ||
          /student|pupil|person|parent|guardian|contact|teacher|staff|school|section|course|email|phone|address|frn|date|month|day|year|calendar|time/i.test(name)) {
        throw new Error('An additional dropdown in Settings has an unsupported field name.');
      }
      const target = [...scope.querySelectorAll('select')].find(select =>
        (select.name === name || select.id === name) &&
        select !== logType && select.name !== 'subtype'
      );
      if (!target || ![...target.options].some(option => option.value === value)) {
        throw new Error('PowerSchool dropdown ' + name + ' or its configured choice is unavailable.');
      }
      target.value = value;
      fireEvents(target);
      if (target.value !== value) throw new Error('PowerSchool did not accept dropdown ' + name + '.');
    }
  }

  function comparableDate(value) {
    const text = String(value || '').trim();
    let match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (match) {
      return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    }
    match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
  }

  function setConfiguredLogDate(logType, fieldName, requestedDate) {
    const name = String(fieldName || '').trim();
    const expected = comparableDate(requestedDate);
    if (!/^[A-Za-z0-9_:-]{1,80}$/.test(name) || !expected) {
      throw new Error('The configured PowerSchool log-date field or requested date is invalid.');
    }

    const scope = logType.closest?.('form') || document;
    const matches = [...scope.querySelectorAll('input, select')].filter(control =>
      control.id === name || control.name === name
    );
    if (matches.length !== 1) {
      throw new Error('PowerSchool log-date field ' + name +
        (matches.length ? ' is ambiguous.' : ' is unavailable.'));
    }

    const control = matches[0];
    const value = String(control.type || '').toLowerCase() === 'date'
      ? expected : String(requestedDate).trim();
    control.value = value;
    fireEvents(control);
    if (comparableDate(control.value) !== expected) {
      throw new Error('PowerSchool did not accept the requested log date.');
    }
  }

  function labelForControl(control, scope) {
    if (control.labels?.length) return normalize(control.labels[0].textContent);
    if (control.id) {
      const label = [...scope.querySelectorAll('label')].find(item =>
        item.htmlFor === control.id || item.getAttribute?.('for') === control.id
      );
      if (label) return normalize(label.textContent);
    }
    return normalize(control.getAttribute?.('aria-label'));
  }

  function tagLabelMatches(visibleText, configuredLabel) {
    const visible = normalize(visibleText);
    const configured = normalize(configuredLabel);
    if (visible === configured) return true;

    const attempt = /^Attempt\s+([1-6])$/i.exec(configured);
    if (!attempt) return false;
    const visibleAttempt = /^Attempt\s+([1-6])(?:\s*\([^)]+\))?$/i.exec(visible);
    return !!visibleAttempt && visibleAttempt[1] === attempt[1];
  }

  async function selectConfiguredTag(logType, configuredLabel) {
    const label = normalize(configuredLabel);
    if (!label) return;
    const scope = logType.closest?.('form') || document;
    const matches = [];

    for (const select of scope.querySelectorAll('select')) {
      for (const option of select.options || []) {
        if (tagLabelMatches(option.textContent, label)) {
          matches.push({
            choose() { select.value = option.value; fireEvents(select); },
            selected() { return select.value === option.value; }
          });
        }
      }
    }

    for (const control of scope.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
      if (tagLabelMatches(labelForControl(control, scope), label)) {
        matches.push({
          choose() { if (!control.checked) control.click(); },
          selected() { return !!control.checked; }
        });
      }
    }

    for (const option of scope.querySelectorAll('[role="option"], [role="menuitemcheckbox"]')) {
      if (tagLabelMatches(option.textContent, label)) {
        matches.push({
          choose() { option.click(); },
          selected() {
            const state = option.getAttribute?.('aria-selected') ??
              option.getAttribute?.('aria-checked');
            return state == null || state === 'true';
          }
        });
      }
    }

    if (matches.length !== 1) {
      throw new Error('PowerSchool tag "' + label + '" ' +
        (matches.length ? 'is ambiguous.' : 'is unavailable.'));
    }
    matches[0].choose();
    await wait(100);
    if (!matches[0].selected()) {
      throw new Error('PowerSchool did not accept tag "' + label + '".');
    }
  }

  async function fillECCLog(state) {
    const kind = state.kind === 'SCC' ? 'SCC' : 'ECC';
    setECCButton(
      `Preparing ${kind} log · ${state.studentNumber}`
    );

    const logType = await waitFor(
      () => document.getElementById('logtype')
    );

    const settings = state.settings;
    const configured = settings?.typeValue && settings?.subtypeValue;
    let selections;
    if (configured) {
      selections = { typeValue: settings.typeValue, subtypeValue: settings.subtypeValue, manual: false };
    } else if (kind === 'SCC') {
      selections = await getSccSelections(logType, !!settings);
    } else if (settings) {
      throw new Error('Set both ECC Log Type and Subtype values in Instructions and Settings.');
    } else {
      selections = { typeValue: ECC_LOG_TYPE_VALUE, subtypeValue: ECC_SUBTYPE_VALUE, manual: false };
    }

    if (!selections.manual) {
      if (![...logType.options].some(option => option.value === selections.typeValue)) {
        throw new Error(kind + ' Log Type is unavailable. ' +
          (settings ? 'Update the value in Instructions and Settings.' :
            kind === 'SCC' ? 'Clear saved SCC selections in Extension options and choose again.' : 'Nothing was overwritten.'));
      }
      logType.value = selections.typeValue;
      fireEvents(logType);
      // PowerSchool may rebuild/update dependent fields.
      await wait(500);
    }

    const subtype = await waitFor(
      () => document.querySelector('select[name="subtype"]')
    );
    if (![...subtype.options].some(option => option.value === selections.subtypeValue)) {
      throw new Error(kind + ' Log Subtype is unavailable. ' +
        (settings ? 'Update the value in Instructions and Settings.' :
          kind === 'SCC' ? 'Clear saved SCC selections in Extension options and choose again.' : 'Nothing was overwritten.'));
    }
    subtype.value = selections.subtypeValue;
    fireEvents(subtype);

    if (settings?.extraDropdowns?.length) {
      await wait(300);
      selectExtraDropdowns(logType, settings.extraDropdowns);
    }

    if (settings?.dateField && state.date) {
      setConfiguredLogDate(logType, settings.dateField, state.date);
    }

    if (settings?.tagLabel) {
      await selectConfiguredTag(logType, settings.tagLabel);
    }

    if (logType.value !== selections.typeValue || subtype.value !== selections.subtypeValue) {
      throw new Error('PowerSchool did not accept the expected ' + kind + ' Log Type/Subtype.');
    }

    // Give the subtype's Log Entry Text template time to populate.
    const noteBox = await waitFor(
      () => document.querySelector(ECC_NOTE_SELECTOR)
    );

    let templatedNoteBox = noteBox;

    if (kind === 'ECC') {
      try {
        templatedNoteBox = await waitFor(
          () => {
            const box = document.querySelector(ECC_NOTE_SELECTOR);

            return (
              box && /\bNote\b/.test(String(box.value || ''))
                ? box
                : null
            );
          },
          5000,
          100
        );
      } catch (_) {
        templatedNoteBox = noteBox;
      }
    } else {
      await wait(500);
      templatedNoteBox = document.querySelector(ECC_NOTE_SELECTOR) || noteBox;
    }

    const originalLogText = String(
      templatedNoteBox.value || ''
    );

    // ECC requires its known Note placeholder. SCC preserves any other
    // PowerSchool template text and appends the call note for review.
    if (kind === 'ECC' && !/\bNote\b/.test(originalLogText)) {
      throw new Error(
        'The Log Entry Text did not contain the expected "Note" placeholder. ' +
        'Nothing was overwritten.'
      );
    }

    templatedNoteBox.value = /\bNote\b/.test(originalLogText)
      ? originalLogText.replace(/\bNote\b/, state.note)
      : (originalLogText.trim()
        ? originalLogText.trimEnd() + '\n\n' + state.note
        : state.note);

    fireEvents(templatedNoteBox);

    // A subtype change may rebuild the controls or reset the note field.
    await wait(200);
    if (logType.value !== selections.typeValue ||
        document.querySelector('select[name="subtype"]')?.value !== selections.subtypeValue ||
        !String(document.querySelector(ECC_NOTE_SELECTOR)?.value || '').includes(state.note)) {
      throw new Error('PowerSchool changed the ' + kind + ' log after it was prepared. Review the form manually.');
    }

    if (kind === 'SCC' && selections.manual) {
      await chrome.storage.local.set({
        [SCC_TYPE_KEY]: selections.typeValue,
        [SCC_SUBTYPE_KEY]: selections.subtypeValue,
        [SCC_TYPE_LABEL_KEY]: logType.selectedOptions[0]?.textContent?.trim() || '',
        [SCC_SUBTYPE_LABEL_KEY]: subtype.selectedOptions[0]?.textContent?.trim() || ''
      });
    }

    const selectedLogType =
      logType.selectedOptions[0]?.textContent?.trim() || '';

    const selectedSubtype =
      subtype.selectedOptions[0]?.textContent?.trim() || '';

    console.log('[PowerSchool ' + kind + '] Prepared:', {
      studentNumber: state.studentNumber,
      date: state.date,
      logType: selectedLogType,
      subtype: selectedSubtype
    });

    // Clear student/note payload before teacher review.
    clearECCState();

    templatedNoteBox.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    templatedNoteBox.focus();

    setECCButton(
      kind + ' ready — review & Submit',
      'ready'
    );

    // IMPORTANT: Never click btnSubmit here.
  }

  // ============================================================
  // MAIN ECC WORKFLOW
  // ============================================================

  function pauseForPowerSchoolSignIn(kind) {
    setECCButton(
      kind + ' saved — sign in; this tab will continue automatically',
      'setup'
    );

    const button = getECCButton();
    if (button) button.onclick = () => continueECCWorkflow();
    if (signInObserver) return;

    signInObserver = new MutationObserver(() => {
      if (!getSchoolPicker()) return;
      signInObserver.disconnect();
      signInObserver = null;
      // Let the current DOM mutation finish before resuming the workflow.
      setTimeout(() => continueECCWorkflow(), 0);
    });
    signInObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // Cover the narrow race where the authenticated shell appeared between
    // the initial check and observer installation.
    if (getSchoolPicker()) {
      signInObserver.disconnect();
      signInObserver = null;
      setTimeout(() => continueECCWorkflow(), 0);
    }
  }

  async function continueECCWorkflow() {
    if (eccWorkflowRunning) return;
    eccWorkflowRunning = true;

    try {
    const state = loadECCState();

    if (!state) {
      return;
    }

    const kind = state.kind === 'DEMOGRAPHICS'
      ? 'DEMOGRAPHICS'
      : state.kind === 'SCC' ? 'SCC' : 'ECC';
    const workflowLabel = getWorkflowLabel(kind);
    const path = location.pathname.toLowerCase();
    const isWorkflowPage =
      path.endsWith('/teachers/log.html') ||
      path.includes('/teachers/studentpages/') ||
      path.endsWith('/teachers/studentsearchresults.html');

    // A handoff can arrive at the PowerSchool sign-in screen. Do not count
    // sign-in redirects as workflow steps or clear the payload after the old
    // 10-second page timeout. Wait for the authenticated teacher shell, while
    // sessionStorage carries the handoff through same-tab navigation.
    if (!isWorkflowPage && !getSchoolPicker()) {
      pauseForPowerSchoolSignIn(workflowLabel);
      return;
    }

    state.stepCount = Number(state.stepCount || 0) + 1;
    saveECCState(state);

    if (state.stepCount > ECC_MAX_STEPS) {
      failECC('Too many navigation steps occurred.');
      return;
    }

    try {
      console.log('[PowerSchool ECC] Continuing workflow:', {
        path: location.pathname,
        studentNumber: state.studentNumber,
        step: state.stepCount
      });

      // --------------------------------------------------------
      // 1. CREATE NEW LOG FORM
      // --------------------------------------------------------
      if (path.endsWith('/teachers/log.html')) {
        if (kind === 'DEMOGRAPHICS') {
          throw new Error('PowerSchool opened a log form instead of student Demographics.');
        }
        setECCButton(
          `${kind} · ${state.studentNumber} · preparing log`
        );

        await fillECCLog(state);
        return;
      }

      // --------------------------------------------------------
      // 2. LOG ENTRIES SUMMARY -> NEW
      // --------------------------------------------------------
      if (
        kind !== 'DEMOGRAPHICS' &&
        path.includes(
          '/teachers/studentpages/stride_log_summary.html'
        )
      ) {
        setECCButton(
          `${kind} · ${state.studentNumber} · finding New`
        );

        const newLogUrl = await waitFor(
          () => getNewLogUrl(),
          10000,
          100
        );

        console.log(
          '[PowerSchool ECC] New Log URL:',
          newLogUrl
        );

        setECCButton(
          `${kind} · ${state.studentNumber} · opening New Log`
        );

        location.assign(newLogUrl);
        return;
      }

      // --------------------------------------------------------
      // 3. ANY STUDENT SCREEN FALLBACK
      // Contacts, Demographics, etc.
      // --------------------------------------------------------
      if (path.includes('/teachers/studentpages/')) {
        if (kind === 'DEMOGRAPHICS') {
          setECCButton(
            `Demographics · ${state.studentNumber} · opening screen`
          );

          const demographics = await waitFor(
            () => getDemographicsScreen(),
            10000,
            100
          );
          if (demographics.isCurrent) {
            clearECCState();
            setECCButton('Demographics open — review student information', 'ready');
            return;
          }
          if (!demographics.url) {
            throw new Error('PowerSchool did not provide a Demographics screen URL.');
          }

          location.assign(demographics.url);
          return;
        }

        setECCButton(
          `${kind} · ${state.studentNumber} · finding Log Entries`
        );

        const logEntriesUrl = await waitFor(
          () => getLogEntriesUrl(),
          10000,
          100
        );

        console.log(
          '[PowerSchool ECC] Log Entries URL:',
          logEntriesUrl
        );

        setECCButton(
          `${kind} · ${state.studentNumber} · opening Log Entries`
        );

        location.assign(logEntriesUrl);
        return;
      }

      // --------------------------------------------------------
      // 4. STUDENT SEARCH RESULTS
      // Prefer direct Log Entries navigation so PowerSchool's
      // remembered Contacts screen is bypassed completely.
      // --------------------------------------------------------
      if (
        path.endsWith('/teachers/studentsearchresults.html')
      ) {
        setECCButton(
          `${kind} · ${state.studentNumber} · finding student`
        );

        const row = await waitFor(
          () => findStudentRow(state.studentNumber),
          10000,
          100
        );

        const studentLink = findStudentInfoLink(row);

        if (!studentLink) {
          throw new Error(
            'The correct student was found, but PowerSchool did not expose a student-information link.'
          );
        }

        if (kind === 'DEMOGRAPHICS') {
          setECCButton(
            `Demographics · ${state.studentNumber} · opening student`
          );
          location.assign(studentLink.href);
          return;
        }

        const directLogUrl = getStudentLogSummaryUrl(studentLink);

        if (directLogUrl) {
          console.log(
            '[PowerSchool ECC] Direct Log Entries URL:',
            directLogUrl
          );

          setECCButton(
            `${kind} · ${state.studentNumber} · opening Log Entries`
          );

          location.assign(directLogUrl);
          return;
        }

        // Safe fallback: force same-tab navigation so sessionStorage
        // survives. Do not use studentLink.click().
        setECCButton(
          `${kind} · ${state.studentNumber} · opening student`
        );

        location.assign(studentLink.href);
        return;
      }

      // --------------------------------------------------------
      // 5. BEFORE SEARCHING: ENSURE SONOMA
      // --------------------------------------------------------
      setECCButton(
          `${kind} · ${state.studentNumber} · checking Sonoma`
      );

      await waitFor(
        () => getSchoolPicker(),
        10000,
        100
      );

      if (!currentSchoolIsSonoma()) {
        setECCButton(
          `${kind} · ${state.studentNumber} · switching to Sonoma`
        );

        await switchToSonoma();
        return; // PowerSchool reloads.
      }

      // --------------------------------------------------------
      // 6. SEARCH BY STUDENT NUMBER
      // --------------------------------------------------------
      setECCButton(
          `${kind} · ${state.studentNumber} · searching student`
      );

      submitStudentNumberSearch(state.studentNumber);

    } catch (error) {
      failECC(
        error?.message || String(error)
      );
    }
    } finally {
      eccWorkflowRunning = false;
    }
  }

  // ============================================================
  // STARTUP
  // ============================================================

  const isTeacherPage = location.pathname.toLowerCase()
    .startsWith('/teachers/');

  if (isTeacherPage) {
    createOR010Button();
    restorePersistentError();

    if (
      sessionStorage.getItem(OR010_PENDING_KEY) === 'yes'
    ) {
      continueOR010Workflow();
    }
  }

  importPowerSchoolPayloadFromHash();

  // PowerSchool may redirect an unauthenticated teacher request to /public/.
  // Capture the hash there before the login form removes it. The same tab's
  // sessionStorage survives the sign-in round trip back to /teachers/.
  if (!isTeacherPage) {
    const pending = loadECCState();
    if (pending) {
      const kind = getWorkflowLabel(pending.kind || 'ECC');
      setECCButton(
        kind + ' handoff saved — sign in to continue'
      );
    }
    return;
  }

  if (loadECCState()) {
    continueECCWorkflow();
  }
})();
