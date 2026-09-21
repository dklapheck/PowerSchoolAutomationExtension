// Temporary, teacher-initiated recorder for PowerSchool's school-specific log form.
// Only selected form settings are retained; student IDs and note text are excluded.
(() => {
  'use strict';

  if (!location.pathname.toLowerCase().endsWith('/teachers/log.html')) return;

  const KEY = 'powerSchoolSettingsCapturesV1';
  const CONTEXT_KEY = 'ps_form_capture_context_v1';
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1_MpkySxTB6BYBB8In3ELRUsH2XpGjaeipMXxxGQb0To/edit#gid=435380773';
  const PRIVATE_FIELD = /student|pupil|person|parent|guardian|contact|teacher|staff|school|section|course|email|phone|address|frn|studentnumber|studentid|student_id/i;
  const DATE_FIELD = /date|month|day|year|calendar|time/i;

  function clean(value, limit = 120) {
    return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim().slice(0, limit);
  }

  function description(control, scope) {
    const label = control.labels?.[0] ||
      (control.id && [...scope.querySelectorAll('label')].find(item => item.htmlFor === control.id)) ||
      control.closest('label');
    return {
      id: clean(control.id, 80),
      name: clean(control.name, 80),
      label: clean(label?.textContent || control.getAttribute('aria-label') || '', 80)
    };
  }

  function isPrivate(field) {
    return PRIVATE_FIELD.test([field.id, field.name, field.label].join(' '));
  }

  function dateContext(control, scope) {
    const candidates = [];
    const add = value => {
      const text = clean(value, 160);
      if (text && DATE_FIELD.test(text) && !PRIVATE_FIELD.test(text)) {
        candidates.push(text);
      }
    };

    add(control.labels?.[0]?.textContent);
    add(control.getAttribute('aria-label'));
    add(control.getAttribute('placeholder'));
    add(control.getAttribute('title'));

    const labelledBy = clean(control.getAttribute('aria-labelledby'), 160);
    for (const id of labelledBy.split(/\s+/).filter(Boolean)) {
      add(document.getElementById(id)?.textContent);
    }

    const cell = control.closest('td, th');
    add(cell?.previousElementSibling?.textContent);
    add(cell?.textContent);
    add(control.parentElement?.previousElementSibling?.textContent);
    add(control.parentElement?.textContent);

    const row = control.closest('tr');
    if (row && cell) {
      for (const item of row.children || []) {
        if (item === cell) break;
        add(item.textContent);
      }
    }

    return candidates[0] || '';
  }

  function dateFieldMap(scope, host) {
    const fields = [];
    const seen = new Set();
    for (const control of scope.querySelectorAll('input, select')) {
      if (host.contains(control)) continue;
      const inputType = clean(control.type || '', 40).toLowerCase();
      if (['hidden', 'button', 'submit', 'reset'].includes(inputType)) continue;

      const field = description(control, scope);
      const label = dateContext(control, scope) || field.label;
      const dateText = [field.id, field.name, field.label, label, inputType].join(' ');
      if (!DATE_FIELD.test(dateText) && !['date', 'datetime-local', 'time'].includes(inputType)) {
        continue;
      }
      const safeField = { ...field, label };
      if (isPrivate(safeField) || (!field.id && !field.name)) continue;

      const key = [control.tagName, field.id, field.name].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      fields.push({
        label: clean(label, 160),
        id: field.id,
        name: field.name,
        tagName: clean(control.tagName, 20),
        inputType: inputType || clean(control.tagName, 20).toLowerCase()
      });
    }
    return fields;
  }

  function attemptTagMap(scope, host) {
    const tags = [];
    const seen = new Set();
    const parseAttempt = value =>
      /^Attempt\s+([1-6])(?:\s*\(([^)]+)\))?$/i.exec(clean(value, 80));
    const add = item => {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        tags.push(item);
      }
    };

    for (const select of scope.querySelectorAll('select')) {
      if (host.contains(select)) continue;
      for (const option of select.options || []) {
        const label = clean(option.textContent, 80);
        const parsed = parseAttempt(label);
        if (!parsed) continue;
        add({
          label,
          canonicalLabel: 'Attempt ' + parsed[1],
          code: clean(parsed[2], 80),
          value: clean(option.value, 120),
          controlId: clean(select.id, 80),
          controlName: clean(select.name, 80),
          controlType: 'select'
        });
      }
    }

    for (const control of scope.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
      if (host.contains(control)) continue;
      const label = clean(control.labels?.[0]?.textContent ||
        description(control, scope).label, 80);
      const parsed = parseAttempt(label);
      if (!parsed) continue;
      add({
        label,
        canonicalLabel: 'Attempt ' + parsed[1],
        code: clean(parsed[2], 80),
        value: clean(control.value, 120),
        controlId: clean(control.id, 80),
        controlName: clean(control.name, 80),
        controlType: clean(control.type, 40)
      });
    }

    for (const option of scope.querySelectorAll('[role="option"], [role="menuitemcheckbox"]')) {
      if (host.contains(option)) continue;
      const label = clean(option.textContent, 80);
      const parsed = parseAttempt(label);
      if (!parsed) continue;
      add({
        label,
        canonicalLabel: 'Attempt ' + parsed[1],
        code: clean(parsed[2], 80),
        value: clean(option.getAttribute('data-value'), 120),
        controlId: clean(option.id, 80),
        controlName: '',
        controlType: clean(option.getAttribute('role'), 40)
      });
    }
    return tags;
  }

  function selected(control) {
    return {
      value: clean(control.value),
      text: clean(control.selectedOptions?.[0]?.textContent)
    };
  }

  function snapshot(scope, host) {
    const logType = scope.querySelector('#logtype');
    const subtype = scope.querySelector('select[name="subtype"]');
    if (!logType?.value || !subtype?.value) {
      throw new Error('Choose a Log Type and Subtype before capturing.');
    }

    const dateControls = [];
    const otherDropdowns = [];
    for (const control of scope.querySelectorAll('select, input[type="date"], input[type="text"]')) {
      if (host.contains(control) || control === logType || control === subtype) continue;
      const field = description(control, scope);
      if (isPrivate(field)) continue;
      const isDate = DATE_FIELD.test([field.id, field.name, field.label].join(' ')) ||
        control.type === 'date';
      if (control.tagName === 'SELECT') {
        const item = { ...field, ...selected(control) };
        if (isDate) {
          // Calendar selectors often use coded values; retain their permitted choices.
          item.options = [...control.options].slice(0, 150).map(option => ({
            value: clean(option.value), text: clean(option.textContent)
          }));
          dateControls.push(item);
        } else {
          otherDropdowns.push(item);
        }
      } else if (isDate && /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(control.value.trim())) {
        // Never record arbitrary free text, even in a date-labelled input.
        dateControls.push({ ...field, value: clean(control.value), inputType: control.type });
      }
    }
    return { logType: selected(logType), subtype: selected(subtype), dateControls, otherDropdowns };
  }

  function row(record) {
    return [
      record.capturedAt,
      record.workflow,
      record.eccOutcome,
      record.requestedEccDate,
      `${record.logType.text} [${record.logType.value}]`,
      `${record.subtype.text} [${record.subtype.value}]`,
      JSON.stringify(record.dateControls),
      JSON.stringify(record.otherDropdowns),
      JSON.stringify(record)
    ].map(value => clean(value, 50000)).join('\t');
  }

  function readContext() {
    try {
      const context = JSON.parse(sessionStorage.getItem(CONTEXT_KEY) || '{}');
      return context && typeof context === 'object' ? context : {};
    } catch (_) { return {}; }
  }

  function install() {
    const logType = document.getElementById('logtype');
    if (!logType || document.getElementById('ps-settings-capture')) return !!logType;
    const scope = logType.closest('form') || document;
    const host = document.createElement('div');
    host.id = 'ps-settings-capture';
    host.style.cssText = 'margin:12px 0;padding:10px;border:1px solid #777;background:#f7f9fc;color:#202124;max-width:560px;font:14px Arial,sans-serif;';

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Capture PowerSchool settings (temporary tool)';
    summary.style.cursor = 'pointer';
    details.append(summary);

    const instructions = document.createElement('p');
    instructions.textContent = 'Select the correct Type, Subtype and date in PowerSchool first. Capture reads the form; it does not submit it.';
    details.append(instructions);

    const scenarioLabel = document.createElement('label');
    scenarioLabel.textContent = 'Call scenario ';
    const scenario = document.createElement('select');
    for (const [value, label] of [
      ['SCC Success', 'SCC Success'], ['SCC Attempt', 'SCC Attempt'],
      ['Conversation', 'ECC Conversation (successful)'],
      ['Attempt', 'ECC Attempt (unsuccessful)']
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      scenario.append(option);
    }
    const context = readContext();
    scenario.value = context.kind === 'SCC'
      ? context.outcome === 'SCC Attempt' ? 'SCC Attempt' : 'SCC Success' :
      context.outcome === 'Attempt' ? 'Attempt' : 'Conversation';
    scenarioLabel.append(scenario);
    details.append(scenarioLabel);

    const dateLabel = document.createElement('label');
    dateLabel.textContent = ' Requested ECC date ';
    const dateInput = document.createElement('input');
    dateInput.type = 'text';
    dateInput.placeholder = 'e.g. 9/18/2026';
    dateInput.value = clean(context.date || '', 32);
    dateInput.style.cssText = 'width:115px;margin:8px;';
    dateLabel.append(dateInput);
    details.append(dateLabel);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Capture selected settings';
    const copySettings = document.createElement('button');
    copySettings.type = 'button';
    copySettings.textContent = 'Copy Type/Subtype for Settings';
    copySettings.style.marginLeft = '8px';
    const copyDateFields = document.createElement('button');
    copyDateFields.type = 'button';
    copyDateFields.textContent = 'Copy Date Field Map';
    copyDateFields.style.marginLeft = '8px';
    const copyAttemptTags = document.createElement('button');
    copyAttemptTags.type = 'button';
    copyAttemptTags.textContent = 'Copy Attempt Tag Map';
    copyAttemptTags.style.marginLeft = '8px';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const link = document.createElement('a');
    link.href = SHEET_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'PowerSchool Settings Log';
    details.append(button, copySettings, copyDateFields, copyAttemptTags, status, link);
    host.append(details);
    logType.parentElement.insertAdjacentElement('afterend', host);

    button.addEventListener('click', async () => {
      try {
        const settings = snapshot(scope, host);
        const isScc = scenario.value.startsWith('SCC ');
        const outcome = isScc ? '' : scenario.value;
        const record = {
          schemaVersion: 1,
          capturedAt: new Date().toISOString(),
          workflow: isScc ? scenario.value : 'ECC',
          eccOutcome: outcome,
          requestedEccDate: outcome ? clean(dateInput.value, 32) : '',
          ...settings
        };
        const stored = await chrome.storage.local.get({ [KEY]: [] });
        const previous = Array.isArray(stored[KEY]) ? stored[KEY] : [];
        await chrome.storage.local.set({ [KEY]: [...previous, record].slice(-20) });
        try {
          await navigator.clipboard.writeText(row(record));
          status.textContent = 'Saved and copied. Paste into the next empty row of PowerSchool Settings Log. If pasting splits incorrectly, use Extension options to copy this row again.';
        } catch (_) {
          status.textContent = 'Saved. Open Extension options and use Copy row, then paste into PowerSchool Settings Log.';
        }
      } catch (error) {
        status.textContent = 'Could not capture: ' + (error?.message || String(error));
      }
    });
    copySettings.addEventListener('click', async () => {
      try {
        const settings = snapshot(scope, host);
        await navigator.clipboard.writeText([
          settings.logType.value, settings.logType.text,
          settings.subtype.value, settings.subtype.text
        ].map(value => clean(value)).join('\t'));
        status.textContent = 'Copied four cells. Paste into column B of the matching row in Instructions and Settings (SCC Success row 35, SCC Attempt 36, ECC Conversation 37, ECC Attempt 38).';
      } catch (error) {
        status.textContent = 'Could not copy Settings cells: ' + (error?.message || String(error));
      }
    });
    copyDateFields.addEventListener('click', async () => {
      try {
        const fields = dateFieldMap(scope, host);
        if (!fields.length) {
          throw new Error('No date-labelled PowerSchool controls were found.');
        }
        const result = 'DATE_FIELD_MAP_V1:' + JSON.stringify({
          schemaVersion: 1,
          capturedAt: new Date().toISOString(),
          scenario: scenario.value,
          dateFields: fields
        });
        await navigator.clipboard.writeText(result);
        status.textContent = 'Copied ' + fields.length +
          ' date-field identifier(s). Paste into the Notes column of the next empty PowerSchool Settings Log row. No entered values were copied.';
      } catch (error) {
        status.textContent = 'Could not copy date fields: ' + (error?.message || String(error));
      }
    });
    copyAttemptTags.addEventListener('click', async () => {
      try {
        const tags = attemptTagMap(scope, host);
        if (!tags.length) {
          throw new Error('No Attempt 1–6 tag options were found. Select the SCC Attempt Type/Subtype first.');
        }
        const result = 'ATTEMPT_TAG_MAP_V1:' + JSON.stringify({
          schemaVersion: 1,
          capturedAt: new Date().toISOString(),
          scenario: scenario.value,
          attemptTags: tags
        });
        await navigator.clipboard.writeText(result);
        status.textContent = 'Copied ' + tags.length +
          ' Attempt tag option(s). Paste into the Notes column of another empty PowerSchool Settings Log row.';
      } catch (error) {
        status.textContent = 'Could not copy Attempt tags: ' + (error?.message || String(error));
      }
    });
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
