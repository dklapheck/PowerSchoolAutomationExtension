'use strict';

// Opens the PowerSchool handoff in a new tab.
// chrome.tabs.create does not require the broad "tabs" permission.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'OPEN_POWERSCHOOL_ECC') {
    return;
  }

  const url = String(message.url || '');
  const allowedPrefix =
    'https://californiak12.powerschool.com/teachers/home.html#ecc=';

  if (!url.startsWith(allowedPrefix)) {
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
