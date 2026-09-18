(() => {
  'use strict';

  // ============================================================
  // PowerSchool OR010 + ECC Helper v3
  //
  // Security / behavior:
  // - Runs only on PowerSchool teacher pages.
  // - Reads no cookies or passwords.
  // - Makes no outside network requests.
  // - ECC payload is removed from the URL immediately and kept
  //   only in PowerSchool sessionStorage during navigation.
  // - The ECC workflow NEVER clicks Submit.
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

      window.alert(
        'The OR010 shortcut could not finish.\n\n' +
        (error?.message || String(error))
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

  function importECCPayloadFromHash() {
    const hash = location.hash || '';
    const marker = '#ecc=';

    if (!hash.startsWith(marker)) {
      return null;
    }

    const encoded = hash.slice(marker.length);

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

      if (!note) {
        throw new Error(
          'The ECC note is empty.'
        );
      }

      const state = {
        studentNumber,
        date,
        note,
        stepCount: 0,
        startedAt: Date.now()
      };

      sessionStorage.setItem(
        ECC_STORAGE_KEY,
        JSON.stringify(state)
      );

      return state;

    } catch (error) {
      console.error(
        '[PowerSchool ECC] Could not read ECC payload.',
        error
      );

      window.alert(
        'The ECC handoff from Google Sheets could not be read.\n\n' +
        (error?.message || String(error))
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
    console.error('[PowerSchool ECC]', message);

    clearECCState();
    setECCButton('ECC automation stopped', 'error');

    const button = getECCButton();

    if (button) {
      button.onclick = () => button.remove();
    }

    window.alert(
      'The ECC automation stopped before submitting anything.\n\n' +
      message +
      '\n\nYou can continue manually in PowerSchool.'
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
  // FILL ECC LOG
  // ============================================================

  async function fillECCLog(state) {
    setECCButton(
      `Preparing ECC log · ${state.studentNumber}`
    );

    const logType = await waitFor(
      () => document.getElementById('logtype')
    );

    logType.value = ECC_LOG_TYPE_VALUE;
    fireEvents(logType);

    // PowerSchool may rebuild/update dependent fields.
    await wait(500);

    const subtype = await waitFor(
      () => document.querySelector('select[name="subtype"]')
    );

    subtype.value = ECC_SUBTYPE_VALUE;
    fireEvents(subtype);

    // Give the subtype's Log Entry Text template time to populate.
    const noteBox = await waitFor(
      () => document.querySelector(ECC_NOTE_SELECTOR)
    );

    let templatedNoteBox = null;

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

    const originalLogText = String(
      templatedNoteBox.value || ''
    );

    // Preserve PowerSchool's template. Replace ONLY the first standalone
    // literal "Note" placeholder with the ECC Note from the sheet.
    if (!/\bNote\b/.test(originalLogText)) {
      throw new Error(
        'The Log Entry Text did not contain the expected "Note" placeholder. ' +
        'Nothing was overwritten.'
      );
    }

    templatedNoteBox.value = originalLogText.replace(
      /\bNote\b/,
      state.note
    );

    fireEvents(templatedNoteBox);

    if (
      logType.value !== ECC_LOG_TYPE_VALUE ||
      subtype.value !== ECC_SUBTYPE_VALUE
    ) {
      throw new Error(
        'PowerSchool did not accept the expected ECC Log Type/Subtype.'
      );
    }

    const selectedLogType =
      logType.selectedOptions[0]?.textContent?.trim() || '';

    const selectedSubtype =
      subtype.selectedOptions[0]?.textContent?.trim() || '';

    console.log('[PowerSchool ECC] Prepared:', {
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
      'ECC ready — review & Submit',
      'ready'
    );

    // IMPORTANT: Never click btnSubmit here.
  }

  // ============================================================
  // MAIN ECC WORKFLOW
  // ============================================================

  async function continueECCWorkflow() {
    const state = loadECCState();

    if (!state) {
      return;
    }

    state.stepCount = Number(state.stepCount || 0) + 1;
    saveECCState(state);

    if (state.stepCount > ECC_MAX_STEPS) {
      failECC('Too many navigation steps occurred.');
      return;
    }

    try {
      const path = location.pathname.toLowerCase();

      console.log('[PowerSchool ECC] Continuing workflow:', {
        path: location.pathname,
        studentNumber: state.studentNumber,
        step: state.stepCount
      });

      // --------------------------------------------------------
      // 1. CREATE NEW LOG FORM
      // --------------------------------------------------------
      if (path.endsWith('/teachers/log.html')) {
        setECCButton(
          `ECC · ${state.studentNumber} · preparing log`
        );

        await fillECCLog(state);
        return;
      }

      // --------------------------------------------------------
      // 2. LOG ENTRIES SUMMARY -> NEW
      // --------------------------------------------------------
      if (
        path.includes(
          '/teachers/studentpages/stride_log_summary.html'
        )
      ) {
        setECCButton(
          `ECC · ${state.studentNumber} · finding New`
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
          `ECC · ${state.studentNumber} · opening New Log`
        );

        location.assign(newLogUrl);
        return;
      }

      // --------------------------------------------------------
      // 3. ANY STUDENT SCREEN FALLBACK
      // Contacts, Demographics, etc.
      // --------------------------------------------------------
      if (path.includes('/teachers/studentpages/')) {
        setECCButton(
          `ECC · ${state.studentNumber} · finding Log Entries`
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
          `ECC · ${state.studentNumber} · opening Log Entries`
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
          `ECC · ${state.studentNumber} · finding student`
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

        const directLogUrl = getStudentLogSummaryUrl(studentLink);

        if (directLogUrl) {
          console.log(
            '[PowerSchool ECC] Direct Log Entries URL:',
            directLogUrl
          );

          setECCButton(
            `ECC · ${state.studentNumber} · opening Log Entries`
          );

          location.assign(directLogUrl);
          return;
        }

        // Safe fallback: force same-tab navigation so sessionStorage
        // survives. Do not use studentLink.click().
        setECCButton(
          `ECC · ${state.studentNumber} · opening student`
        );

        location.assign(studentLink.href);
        return;
      }

      // --------------------------------------------------------
      // 5. BEFORE SEARCHING: ENSURE SONOMA
      // --------------------------------------------------------
      setECCButton(
        `ECC · ${state.studentNumber} · checking Sonoma`
      );

      await waitFor(
        () => getSchoolPicker(),
        10000,
        100
      );

      if (!currentSchoolIsSonoma()) {
        setECCButton(
          `ECC · ${state.studentNumber} · switching to Sonoma`
        );

        await switchToSonoma();
        return; // PowerSchool reloads.
      }

      // --------------------------------------------------------
      // 6. SEARCH BY STUDENT NUMBER
      // --------------------------------------------------------
      setECCButton(
        `ECC · ${state.studentNumber} · searching student`
      );

      submitStudentNumberSearch(state.studentNumber);

    } catch (error) {
      failECC(
        error?.message || String(error)
      );
    }
  }

  // ============================================================
  // STARTUP
  // ============================================================

  createOR010Button();

  if (
    sessionStorage.getItem(OR010_PENDING_KEY) === 'yes'
  ) {
    continueOR010Workflow();
  }

  importECCPayloadFromHash();

  if (loadECCState()) {
    continueECCWorkflow();
  }
})();