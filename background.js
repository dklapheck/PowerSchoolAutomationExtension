'use strict';

// Opens the PowerSchool handoff in a new tab.
// chrome.tabs.create does not require the broad "tabs" permission.
// Duplicate frame reports arrive nearly simultaneously. Keep this window short
// so a teacher can intentionally retry the same handoff a few seconds later.
const HANDOFF_OPEN_DEDUPE_MS = 3000;
const HANDOFF_OPEN_STORAGE_KEY = 'recentPowerSchoolHandoffs';
const recentHandoffs = new Map();
let recentHandoffsLoaded = null;

function loadRecentHandoffs_() {
  if (recentHandoffsLoaded) return recentHandoffsLoaded;
  recentHandoffsLoaded = chrome.storage.session
    .get({ [HANDOFF_OPEN_STORAGE_KEY]: [] })
    .then(settings => {
      const now = Date.now();
      const saved = Array.isArray(settings[HANDOFF_OPEN_STORAGE_KEY])
        ? settings[HANDOFF_OPEN_STORAGE_KEY] : [];
      saved.forEach(entry => {
        if (entry && typeof entry.key === 'string' &&
            now - Number(entry.at) < HANDOFF_OPEN_DEDUPE_MS) {
          recentHandoffs.set(entry.key, Number(entry.at));
        }
      });
    });
  return recentHandoffsLoaded;
}

function saveRecentHandoffs_() {
  const now = Date.now();
  const entries = Array.from(recentHandoffs.entries())
    .filter(([, at]) => now - at < HANDOFF_OPEN_DEDUPE_MS)
    .slice(-100)
    .map(([key, at]) => ({ key, at }));
  return chrome.storage.session.set({ [HANDOFF_OPEN_STORAGE_KEY]: entries });
}

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

  const handoffKey = message.type + '\n' + url;
  loadRecentHandoffs_()
    .then(() => {
      const now = Date.now();
      const previous = recentHandoffs.get(handoffKey) || 0;
      if (recentHandoffs.has(handoffKey) &&
          now - previous < HANDOFF_OPEN_DEDUPE_MS) {
        return { duplicate: true };
      }

      // Set the in-memory guard before the first await so simultaneous reports
      // from Google Sheets frames cannot race and open separate tabs.
      recentHandoffs.set(handoffKey, now);
      return saveRecentHandoffs_()
        .then(() => chrome.tabs.create({ url, active: true }))
        .then(() => ({ duplicate: false }));
    })
    .then(result => sendResponse({ ok: true, duplicate: result.duplicate }))
    .catch(error => {
      recentHandoffs.delete(handoffKey);
      saveRecentHandoffs_().catch(() => {});
      console.error('[ECC Helper] Could not open PowerSchool tab.', error);
      sendResponse({
        ok: false,
        error: error?.message || String(error)
      });
    });

  // Keep the message channel open for the Promise above.
  return true;
});
