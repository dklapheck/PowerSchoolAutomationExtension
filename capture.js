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
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const link = document.createElement('a');
    link.href = SHEET_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'PowerSchool Settings Log';
    details.append(button, copySettings, status, link);
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
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
