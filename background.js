'use strict';

// Opens the PowerSchool handoff in a new tab.
// chrome.tabs.create does not require the broad "tabs" permission.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handoffHashes = {
    OPEN_POWERSCHOOL_ECC: 'ecc=',
    OPEN_POWERSCHOOL_SCC: 'scc=',
    OPEN_POWERSCHOOL_DEMOGRAPHICS: 'demographics='
  };
  if (!message || !handoffHashes[message.type]) {
    return;
  }

  const url = String(message.url || '');
  const allowedPrefix = 'https://californiak12.powerschool.com/teachers/home.html#' +
    handoffHashes[message.type];

  if (!url.startsWith(allowedPrefix) || !/^[A-Za-z0-9_-]+$/.test(url.slice(allowedPrefix.length))) {
    sendResponse({ ok: false, error: 'Rejected unexpected URL.' });
    return;
  }

  chrome.tabs.create({ url, active: true })
    .then(() => sendResponse({ ok: true }))
    .catch(error => {
      console.error('[ECC Helper] Could not open PowerSchool tab.', error);
      sendResponse({
        ok: false,
        error: error?.message || String(error)
      });
    });

  // Keep the message channel open for the Promise above.
  return true;
});
