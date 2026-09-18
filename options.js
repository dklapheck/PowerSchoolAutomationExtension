'use strict';

const STORAGE_KEY = 'eccApprovedSpreadsheetIds';
const form = document.getElementById('add-sheet');
const input = document.getElementById('sheet-url');
const list = document.getElementById('approved-sheets');
const status = document.getElementById('status');

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
}

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
