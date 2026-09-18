(() => {
  'use strict';

  const HANDOFF_PREFIX = 'ECC_HANDOFF_V1:';
  // The previously supported sheet remains approved by default.
  const LEGACY_ROSTER_ID = '1wJwz78LkACmNGxrrU6w6zOXy2zBZFeFElWg5PiCbm6g';
  const POWERSCHOOL_BASE =
    'https://californiak12.powerschool.com/teachers/home.html#ecc=';
  const STATUS_ID = 'ecc-helper-status';
  let lastEncoded = '';

  function showStatus(message, error = false) {
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
    badge.style.backgroundColor = error ? '#9c2f2f' : '#217346';
    badge.textContent = message;
  }

  function extractHandoff(text) {
    const value = String(text || '');
    const index = value.indexOf(HANDOFF_PREFIX);
    if (index < 0) return null;
    const afterPrefix = value.slice(index + HANDOFF_PREFIX.length);
    const match = afterPrefix.match(/^([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  }

  function replaceVisibleMarker(node) {
    const friendly = 'Opening PowerSchool ECC log…';
    if (node.nodeType === Node.TEXT_NODE) {
      if (String(node.nodeValue || '').includes(HANDOFF_PREFIX)) {
        node.nodeValue = friendly;
      }
    } else if (node instanceof HTMLElement &&
        node.childElementCount === 0 &&
        String(node.textContent || '').includes(HANDOFF_PREFIX)) {
      node.textContent = friendly;
    }
  }

  function handleCandidate(node) {
    const value = node.nodeType === Node.TEXT_NODE
      ? node.nodeValue
      : node.textContent;
    // Avoid scanning the entire spreadsheet DOM as one string.
    if (typeof value !== 'string' || value.length > 20000) return;
    const encoded = extractHandoff(value);
    if (!encoded || encoded === lastEncoded) return;

    lastEncoded = encoded;
    replaceVisibleMarker(node);
    showStatus('ECC handoff detected; opening PowerSchool…');
    chrome.runtime.sendMessage({
      type: 'OPEN_POWERSCHOOL_ECC',
      url: POWERSCHOOL_BASE + encoded
    }, response => {
      if (chrome.runtime.lastError || !response?.ok) {
        const reason = chrome.runtime.lastError?.message ||
          response?.error || 'Unknown error';
        console.error('[ECC Helper] PowerSchool launch failed:', reason);
        showStatus('ECC handoff detected, but PowerSchool could not open: ' + reason, true);
        return;
      }
      showStatus('PowerSchool tab opened. Review the ECC log before submitting.');
    });
  }

  function scanNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      handleCandidate(node);
      // Sheets may split a toast marker between sibling text nodes.
      if (node.parentElement) handleCandidate(node.parentElement);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.id === STATUS_ID) return;

    // Read the whole small toast as well as its text nodes. A single
    // marker can be split across nested spans in the Sheets interface.
    handleCandidate(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let current;
    while ((current = walker.nextNode())) handleCandidate(current);
  }

  function startWatching() {
    showStatus('ECC Helper active on this sheet.');
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
    if (match[1] === LEGACY_ROSTER_ID || approved.includes(match[1])) {
      startWatching();
    }
  });
})();
