(() => {
  'use strict';

  // This content script runs ONLY on the specific 2Roster ORN spreadsheet
  // listed in manifest.json. It watches for the short-lived Apps Script
  // handoff toast, then asks the extension service worker to open PowerSchool.

  const HANDOFF_PREFIX = 'ECC_HANDOFF_V1:';
  const POWERSCHOOL_BASE =
    'https://californiak12.powerschool.com/teachers/home.html#ecc=';

  let lastEncoded = '';

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
      const text = node.nodeValue || '';
      const index = text.indexOf(HANDOFF_PREFIX);
      if (index >= 0) {
        node.nodeValue = friendly;
      }
      return;
    }

    if (node instanceof HTMLElement) {
      // Prefer replacing only a small leaf element rather than a large
      // Sheets container. This makes the handoff toast human-readable.
      if (node.childElementCount === 0 &&
          String(node.textContent || '').includes(HANDOFF_PREFIX)) {
        node.textContent = friendly;
      }
    }
  }

  function handleCandidate(node) {
    const text =
      node.nodeType === Node.TEXT_NODE
        ? node.nodeValue
        : node.textContent;

    const encoded = extractHandoff(text);

    if (!encoded || encoded === lastEncoded) {
      return;
    }

    lastEncoded = encoded;
    replaceVisibleMarker(node);

    const url = POWERSCHOOL_BASE + encoded;

    chrome.runtime.sendMessage(
      {
        type: 'OPEN_POWERSCHOOL_ECC',
        url
      },
      response => {
        if (chrome.runtime.lastError) {
          console.error(
            '[ECC Helper] PowerSchool launch failed:',
            chrome.runtime.lastError.message
          );
          return;
        }

        if (!response?.ok) {
          console.error(
            '[ECC Helper] PowerSchool launch failed:',
            response?.error || 'Unknown error'
          );
        }
      }
    );
  }

  function scanNode(node) {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      handleCandidate(node);
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      // Inspect the actual text nodes first so we can replace the encoded
      // handoff marker with the friendly visible message before opening PS.
      const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT
      );

      let current;
      while ((current = walker.nextNode())) {
        handleCandidate(current);
      }

      // Leaf elements sometimes receive their text in one mutation.
      if (node.childElementCount === 0) {
        handleCandidate(node);
      }
    }
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        scanNode(mutation.target);
      }

      for (const node of mutation.addedNodes) {
        scanNode(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // Catch a handoff toast that appeared just before the observer started.
  scanNode(document.body);
})();