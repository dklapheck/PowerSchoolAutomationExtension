'use strict';

const status = document.getElementById('status');
const sccStatus = document.getElementById('scc-settings');
const forgetScc = document.getElementById('forget-scc');

async function render() {
  const scc = await chrome.storage.local.get({
    sccLogTypeLabel: '',
    sccLogSubtypeLabel: ''
  });
  sccStatus.textContent = scc.sccLogTypeLabel && scc.sccLogSubtypeLabel
    ? 'Remembered fallback: ' + scc.sccLogTypeLabel + ' / ' + scc.sccLogSubtypeLabel
    : 'No SCC fallback selections are remembered.';
}

forgetScc.addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove([
      'sccLogTypeValue',
      'sccLogSubtypeValue',
      'sccLogTypeLabel',
      'sccLogSubtypeLabel'
    ]);
    status.textContent = 'Remembered SCC selections cleared.';
    await render();
  } catch (error) {
    status.textContent = 'Could not clear SCC selections: ' +
      (error?.message || String(error));
  }
});

render().catch(error => {
  status.textContent = 'Could not load SCC settings: ' +
    (error?.message || String(error));
});
