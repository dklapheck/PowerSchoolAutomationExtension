'use strict';

const STORAGE_KEY = 'eccApprovedSpreadsheetIds';
const form = document.getElementById('add-sheet');
const input = document.getElementById('sheet-url');
const list = document.getElementById('approved-sheets');
const status = document.getElementById('status');
const sccStatus = document.getElementById('scc-settings');
const forgetScc = document.getElementById('forget-scc');
const captureList = document.getElementById('captures');
const CAPTURE_KEY = 'powerSchoolSettingsCapturesV1';

function captureRow(record) {
  const clean = value => String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
  return [
    record.capturedAt, record.workflow, record.eccOutcome, record.requestedEccDate,
    `${record.logType.text} [${record.logType.value}]`,
    `${record.subtype.text} [${record.subtype.value}]`,
    JSON.stringify(record.dateControls), JSON.stringify(record.otherDropdowns),
    JSON.stringify(record)
  ].map(clean).join('\t');
}

function sheetIdFromUrl(text) {
  let url;
  try { url = new URL(text.trim()); }
  catch (_) { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null;
  const match = url.pathname.match(
    /^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/|$)/
  );
  return match ? match[1] : null;
}

async function getApproved() {
  const data = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function render() {
  const ids = await getApproved();
  list.replaceChildren();
  for (const id of ids) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(id) + '/edit';
    link.textContent = link.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove approved sheet ' + id);
    remove.addEventListener('click', async () => {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEY]: (await getApproved()).filter(value => value !== id)
        });
        status.textContent = 'Sheet removed. Refresh its open tab.';
        await render();
      } catch (error) {
        status.textContent = 'Could not remove this sheet: ' + (error?.message || String(error));
      }
    });

    item.append(link, remove);
    list.append(item);
  }
  if (!ids.length) {
    const item = document.createElement('li');
    item.textContent = 'No additional sheets approved.';
    list.append(item);
  }
  const scc = await chrome.storage.local.get({ sccLogTypeLabel: '', sccLogSubtypeLabel: '' });
  sccStatus.textContent = scc.sccLogTypeLabel && scc.sccLogSubtypeLabel
    ? 'Saved: ' + scc.sccLogTypeLabel + ' / ' + scc.sccLogSubtypeLabel
    : 'No SCC selections saved yet.';

  const data = await chrome.storage.local.get({ [CAPTURE_KEY]: [] });
  const captures = Array.isArray(data[CAPTURE_KEY]) ? data[CAPTURE_KEY] : [];
  captureList.replaceChildren();
  for (const capture of captures.slice().reverse()) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = [capture.capturedAt, capture.workflow, capture.eccOutcome,
      capture.logType?.text, capture.subtype?.text].filter(Boolean).join(' · ');
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy row';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(captureRow(capture));
        status.textContent = 'Copied one row. Paste into the next empty row of PowerSchool Settings Log.';
      } catch (error) {
        status.textContent = 'Clipboard failed: ' + (error?.message || String(error));
      }
    });
    const copySettings = document.createElement('button');
    copySettings.type = 'button';
    copySettings.textContent = 'Copy Settings cells';
    copySettings.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText([
          capture.logType.value, capture.logType.text,
          capture.subtype.value, capture.subtype.text
        ].map(value => String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim()).join('\t'));
        status.textContent = 'Copied B:E values. Paste into the matching workflow row in Instructions and Settings.';
      } catch (error) {
        status.textContent = 'Clipboard failed: ' + (error?.message || String(error));
      }
    });
    item.append(label, copy, copySettings);
    captureList.append(item);
  }
  if (!captures.length) {
    const item = document.createElement('li');
    item.textContent = 'No form settings captured yet.';
    captureList.append(item);
  }
}

forgetScc.addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove([
      'sccLogTypeValue', 'sccLogSubtypeValue', 'sccLogTypeLabel', 'sccLogSubtypeLabel'
    ]);
    status.textContent = 'SCC selections cleared. Choose them on the next PowerSchool SCC log.';
    await render();
  } catch (error) {
    status.textContent = 'Could not clear SCC selections: ' + (error?.message || String(error));
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const id = sheetIdFromUrl(input.value);
  if (!id) {
    status.textContent = 'Paste a Google Sheets URL from docs.google.com.';
    return;
  }
  try {
    const ids = await getApproved();
    if (!ids.includes(id)) await chrome.storage.local.set({ [STORAGE_KEY]: [...ids, id] });
    input.value = '';
    status.textContent = 'Sheet approved. Refresh its open tab before trying ECC again.';
    await render();
  } catch (error) {
    status.textContent = 'Could not save this sheet: ' + (error?.message || String(error));
  }
});

render().catch(error => {
  status.textContent = 'Could not load approved sheets: ' + (error?.message || String(error));
});
