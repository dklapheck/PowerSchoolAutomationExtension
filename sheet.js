(() => {
  'use strict';

  const HANDOFFS = [
    {
      prefix: 'ECC_HANDOFF_V1:',
      kind: 'ECC',
      messageType: 'OPEN_POWERSCHOOL_ECC',
      hash: 'ecc='
    },
    {
      prefix: 'SCC_HANDOFF_V1:',
      kind: 'SCC',
      messageType: 'OPEN_POWERSCHOOL_SCC',
      hash: 'scc='
    },
    {
      prefix: 'DEMOGRAPHICS_HANDOFF_V1:',
      kind: 'Demographics',
      messageType: 'OPEN_POWERSCHOOL_DEMOGRAPHICS',
      hash: 'demographics='
    }
  ];
  // Trusted roster workbooks remain approved by default. Teachers may add
  // other roster IDs through the extension options page.
  const DEFAULT_APPROVED_ROSTER_IDS = new Set([
    '1wJwz78LkACmNGxrrU6w6zOXy2zBZFeFElWg5PiCbm6g',
    '1_MpkySxTB6BYBB8In3ELRUsH2XpGjaeipMXxxGQb0To'
  ]);
  const POWERSCHOOL_BASE =
    'https://californiak12.powerschool.com/teachers/home.html#';
  const STATUS_ID = 'ecc-helper-status';
  const HANDOFF_DEDUPE_MS = 1500;
  const ELEMENT_NODE = 1;
  const TEXT_NODE = 3;
  const SHOW_TEXT = 4;
  const TOAST_SELECTORS = [
    '.docs-toast-msg',
    '[role="alert"]',
    '[aria-live="assertive"]',
    '[aria-live="polite"]'
  ];
  let lastHandoffKey = '';
  let lastHandoffAt = 0;

  function showError(message) {
    let badge = document.getElementById(STATUS_ID);
    if (!badge) {
      badge = document.createElement('div');
      badge.id = STATUS_ID;
      badge.setAttribute('role', 'status');
      Object.assign(badge.style, {
        position: 'fixed',
        right: '12px',
        bottom: '12px',
        zIndex: '2147483646',
        maxWidth: '320px',
        padding: '8px 12px',
        borderRadius: '6px',
        color: '#fff',
        font: '13px/1.4 Arial, sans-serif',
        boxShadow: '0 2px 7px rgba(0,0,0,.25)',
        pointerEvents: 'none'
      });
      document.body.appendChild(badge);
    }
    badge.style.backgroundColor = '#9c2f2f';
    badge.textContent = message;
  }

  function extractHandoff(text) {
    const value = String(text || '');
    for (const handoff of HANDOFFS) {
      const index = value.indexOf(handoff.prefix);
      if (index < 0) continue;
      const afterPrefix = value.slice(index + handoff.prefix.length);
      const match = afterPrefix.match(/^([A-Za-z0-9_-]+)/);
      if (match) return { ...handoff, encoded: match[1] };
    }
    return null;
  }

  function replaceVisibleMarker(node) {
    if (!node || typeof node.nodeType !== 'number') return;
    const handoff = extractHandoff(node.nodeType === TEXT_NODE
      ? node.nodeValue : node.textContent);
    if (!handoff) return;
    const friendly = 'Opening PowerSchool ' + handoff.kind + ' log…';
    if (node.nodeType === TEXT_NODE) {
      if (String(node.nodeValue || '').includes(handoff.prefix)) {
        node.nodeValue = friendly;
      }
    } else if (node.nodeType === ELEMENT_NODE &&
        node.childElementCount === 0 &&
        String(node.textContent || '').includes(handoff.prefix)) {
      node.textContent = friendly;
    }
  }

  function handleCandidate(node) {
    if (!node || typeof node.nodeType !== 'number') return;
    const value = node.nodeType === TEXT_NODE
      ? node.nodeValue
      : node.textContent;
    // Avoid scanning the entire spreadsheet DOM as one string.
    if (typeof value !== 'string' || value.length > 20000) return;
    const handoff = extractHandoff(value);
    if (!handoff) return;

    const handoffKey = handoff.kind + handoff.encoded;
    const now = Date.now();
    if (handoffKey === lastHandoffKey &&
        now - lastHandoffAt < HANDOFF_DEDUPE_MS) return;

    // A Sheets toast can be reported through several nested DOM mutations.
    // Suppress that brief burst, but allow the teacher to retry the exact
    // same handoff after the toast is shown again.
    lastHandoffKey = handoffKey;
    lastHandoffAt = now;
    replaceVisibleMarker(node);
    chrome.runtime.sendMessage({
      type: handoff.messageType,
      url: POWERSCHOOL_BASE + handoff.hash + handoff.encoded
    }, response => {
      if (chrome.runtime.lastError || !response?.ok) {
        const reason = chrome.runtime.lastError?.message ||
          response?.error || 'Unknown error';
        console.error('[PowerSchool Helper] PowerSchool launch failed:', reason);
        showError(handoff.kind + ' handoff detected, but PowerSchool could not open: ' + reason);
        return;
      }
    });
  }

  function scanNode(node) {
    if (!node) return;
    if (node.nodeType === TEXT_NODE) {
      handleCandidate(node);
      // Sheets may split a toast marker between sibling text nodes.
      if (node.parentElement) handleCandidate(node.parentElement);
      return;
    }
    if (node.nodeType !== ELEMENT_NODE || node.id === STATUS_ID) return;

    // Read the whole small toast as well as its text nodes. A single
    // marker can be split across nested spans in the Sheets interface.
    handleCandidate(node);
    const walker = document.createTreeWalker(node, SHOW_TEXT);
    let current;
    while ((current = walker.nextNode())) handleCandidate(current);
  }

  function startWatching() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') scanNode(mutation.target);
        for (const node of mutation.addedNodes) {
          scanNode(node);
          if (node.parentElement && node.parentElement.id !== STATUS_ID) {
            handleCandidate(node.parentElement);
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
    scanNode(document.body);

    // Google Sheets sometimes renders its toast inside an existing live
    // region or editor frame, which produces no useful added-node mutation
    // in the top page. Poll only the small known toast/live regions as a
    // fallback; background.js deduplicates messages reported by two frames.
    const scanToastRegions = () => {
      if (typeof document.querySelectorAll !== 'function') return;
      for (const selector of TOAST_SELECTORS) {
        for (const node of document.querySelectorAll(selector)) scanNode(node);
      }
    };
    scanToastRegions();
    if (typeof setInterval === 'function') setInterval(scanToastRegions, 250);
  }

  const match = location.pathname.match(
    /^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/|$)/
  );
  if (!match) return;
  chrome.storage.local.get({ eccApprovedSpreadsheetIds: [] }, settings => {
    if (chrome.runtime.lastError) {
      console.error('[ECC Helper] Could not read approved sheets.',
        chrome.runtime.lastError.message);
      return;
    }
    const approved = Array.isArray(settings.eccApprovedSpreadsheetIds)
      ? settings.eccApprovedSpreadsheetIds : [];
    if (DEFAULT_APPROVED_ROSTER_IDS.has(match[1]) || approved.includes(match[1])) {
      startWatching();
    }
  });
})();
