'use strict';

const HANDOFF_TAB_DEDUPE_MS = 60000;
const HANDOFF_SESSION_KEY = 'recentPowerSchoolHandoffsV1';
const handoffsInFlight = new Set();
const handoffStorage = chrome.storage.session || chrome.storage.local;

function validHandoff(message) {
  const handoffHashes = {
    OPEN_POWERSCHOOL_ECC: 'ecc=',
    OPEN_POWERSCHOOL_SCC: 'scc=',
    OPEN_POWERSCHOOL_DEMOGRAPHICS: 'demographics='
  };
  if (!message || !handoffHashes[message.type]) return null;

  const url = String(message.url || '');
  const allowedPrefix =
    'https://californiak12.powerschool.com/teachers/home.html#' +
    handoffHashes[message.type];

  if (!url.startsWith(allowedPrefix) ||
      !/^[A-Za-z0-9_-]+$/.test(url.slice(allowedPrefix.length))) {
    return { error: 'Rejected unexpected URL.' };
  }
  return { url };
}

async function readRecentHandoffs() {
  const stored = await handoffStorage.get({ [HANDOFF_SESSION_KEY]: {} });
  const value = stored[HANDOFF_SESSION_KEY];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value : {};
}

async function removeReservation(url, timestamp) {
  try {
    const recent = await readRecentHandoffs();
    if (recent[url] !== timestamp) return;
    delete recent[url];
    await handoffStorage.set({ [HANDOFF_SESSION_KEY]: recent });
  } catch (_) {
    // The original tab-opening error is more useful to the teacher.
  }
}

async function openHandoff(url) {
  if (handoffsInFlight.has(url)) {
    return { ok: true, deduplicated: true };
  }
  handoffsInFlight.add(url);

  let reservedAt = 0;
  try {
    const now = Date.now();
    const recent = await readRecentHandoffs();
    const lastOpenedAt = Number(recent[url] || 0);
    if (lastOpenedAt && now - lastOpenedAt < HANDOFF_TAB_DEDUPE_MS) {
      return { ok: true, deduplicated: true };
    }

    // Reserve before creating the tab. Session storage survives a Manifest V3
    // service-worker restart, unlike a module-level Map.
    for (const [key, value] of Object.entries(recent)) {
      if (now - Number(value || 0) >= HANDOFF_TAB_DEDUPE_MS) delete recent[key];
    }
    reservedAt = now;
    recent[url] = reservedAt;
    await handoffStorage.set({ [HANDOFF_SESSION_KEY]: recent });

    await chrome.tabs.create({ url, active: true });
    return { ok: true };
  } catch (error) {
    if (reservedAt) await removeReservation(url, reservedAt);
    console.error('[ECC Helper] Could not open PowerSchool tab.', error);
    return { ok: false, error: error?.message || String(error) };
  } finally {
    handoffsInFlight.delete(url);
  }
}

// Opens one PowerSchool tab per handoff, even if separate Google Sheets frames
// report it after Edge has restarted this Manifest V3 background worker.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handoff = validHandoff(message);
  if (!handoff) return;
  if (handoff.error) {
    sendResponse({ ok: false, error: handoff.error });
    return;
  }

  openHandoff(handoff.url).then(sendResponse);
  return true;
});
