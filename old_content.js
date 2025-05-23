// content.js — Google Slides URL Copier
// Run this script in **all** frames (manifest: "all_frames": true). It
// injects a "Copy URL for Current Slide" button into the Google Slides
// **Share** dialog, even though that dialog lives in a cross‑origin iframe.
// The top frame computes the slide‑specific URL; the iframe requests it
// via postMessage.

(() => {
  /*************************
   * Utility / Debug log   *
   *************************/
  const DEBUG = true; // enabled for debugging
  const log = (...a) => DEBUG && console.log('[Slides‑URL‑Copier]', ...a);

  const MODES = {
    EDIT: 'Edit',      // https://…/edit#slide=…
    PREVIEW: 'Preview' // https://…/preview?rm=minimal&slide=…
  };

  log('Extension initialized, checking if top frame...');

  /**********************
   * Top‑frame logic    *
   **********************/
  if (window.top === window) {
    // We're in the *presentation* page (docs.google.com). Handle requests
    // from the share‑iframe.
    log('Top frame detected - URL:', location.href);

    window.addEventListener('message', evt => {
      const { data, source, origin } = evt;
      if (!data || data.type !== 'REQUEST_SLIDE_URL') return;

      log('Received URL request from iframe:', data);
      const { mode, slideNumber, requestId } = data;
      const url = buildSlideUrl({ mode, slideNumber });
      log('Generated URL for response:', url);

      source?.postMessage({ type: 'SLIDE_URL', url, requestId }, origin);
      log('Sent URL response to iframe with requestId:', requestId);
    });

    /**
     * Build a permalink for the (optionally supplied) slide number.
     * If no slideNumber is provided we try to extract it from the hash.
     */
    function buildSlideUrl({ mode = MODES.EDIT, slideNumber }) {
      log('Building slide URL with mode:', mode, 'slideNumber:', slideNumber);
      const href = location.href;
      const idMatch = href.match(/\/presentation\/d\/([^/]+)/);
      if (!idMatch) {
        log('Could not extract presentation ID from URL');
        return href; // shouldn't happen, but be safe
      }
      const deckId = idMatch[1];
      log('Extracted presentation ID:', deckId);

      // Detect slide from URL if not provided
      if (!slideNumber) {
        log('No slide number provided, attempting to extract from URL');
        const m = href.match(/#slide=(\d+)/);
        slideNumber = m ? m[1] : '0';
        log('Using slide number:', slideNumber);
      }

      let finalUrl;
      if (mode === MODES.PREVIEW) {
        finalUrl = `https://docs.google.com/presentation/d/${deckId}/preview?rm=minimal&slide=${slideNumber}`;
      } else {
        finalUrl = `https://docs.google.com/presentation/d/${deckId}/edit#slide=${slideNumber}`;
      }
      
      log('Final URL generated:', finalUrl);
      return finalUrl;
    }

    log('Top frame initialization complete');
    return; // top‑frame work done
  }

  /*****************************
   * Iframe (share dialog) side *
   *****************************/
  log('Iframe detected - running dialog detection code');

  const pending = new Map(); // requestId → resolver

  window.addEventListener('message', evt => {
    const { data } = evt;
    if (!data || data.type !== 'SLIDE_URL' || !data.requestId) return;
    
    log('Received URL response from top frame:', data);
    const resolve = pending.get(data.requestId);
    if (resolve) {
      log('Resolving promise for requestId:', data.requestId);
      resolve(data.url);
      pending.delete(data.requestId);
    } else {
      log('No pending request found for requestId:', data.requestId);
    }
  });

  // Wait until the share dialog is injected, then add our controls.
  function waitForShareDialog() {
    log('Looking for existing dialog...');
    const dlg = document.querySelector('[role="dialog"]');
    if (dlg) {
      log('Dialog already exists in the DOM');
      return Promise.resolve(dlg);
    }

    log('No dialog found, setting up observer to wait for it');
    return new Promise(resolve => {
      new MutationObserver((muts, obs) => {
        log('DOM mutation detected, checking for dialog');
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) {
              const d = n.matches?.('[role="dialog"]') ? n : n.querySelector?.('[role="dialog"]');
              if (d) {
                log('Dialog found:', d);
                obs.disconnect();
                resolve(d);
                return;
              }
            }
          }
        }
        log('No dialog found in this mutation batch');
      }).observe(document.body, { childList: true, subtree: true });
      log('Dialog observer started');
    });
  }

  (async () => {
    log('Starting async initialization');
    try {
      const dialog = await waitForShareDialog();
      log('Dialog detected, checking if already injected');
      if (dialog.querySelector('.slides‑url‑copier‑container')) {
        log('Button already injected, skipping');
        return;
      }
      log('Proceeding with UI injection');
      injectUI(dialog);
    } catch (err) {
      log('Error during initialization:', err);
    }
  })();

  /*******************
   * UI & behaviour  *
   *******************/
  function injectUI(dialog) {
    log('Injecting controls into dialog:', dialog);

    // Build a small flex column
    const container = document.createElement('div');
    container.className = 'slides‑url‑copier‑container';
    container.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid #e0e0e0;display:flex;flex-direction:column;gap:8px;';
    log('Created container element');

    // Mode select (Edit / Preview)
    const modeLabel = Object.assign(document.createElement('label'), { textContent: 'URL type:', style: 'font-size:12px;display:flex;align-items:center;gap:4px;' });
    const modeSelect = document.createElement('select');
    modeSelect.style = 'font-size:12px;';
    for (const m of Object.values(MODES)) {
      const opt = Object.assign(document.createElement('option'), { value: m, textContent: m });
      modeSelect.appendChild(opt);
    }
    modeLabel.appendChild(modeSelect);
    container.appendChild(modeLabel);
    log('Added mode selector');

    // Optional slide number input
    const slideLabel = Object.assign(document.createElement('label'), { textContent: 'Slide # (optional):', style: 'font-size:12px;display:flex;align-items:center;gap:4px;' });
    const slideInput = Object.assign(document.createElement('input'), { type: 'number', min: 1, style: 'width:60px;' });
    slideLabel.appendChild(slideInput);
    container.appendChild(slideLabel);
    log('Added slide number input');

    // Copy button
    const btn = Object.assign(document.createElement('button'), {
      textContent: 'Copy URL for Current Slide',
      style: 'padding:8px 16px;border:1px solid #dadce0;border-radius:24px;background:transparent;color:#1a73e8;font-size:14px;font-weight:500;cursor:pointer;width:max-content;'
    });
    container.appendChild(btn);
    log('Added copy button');

    // Status line
    const status = Object.assign(document.createElement('div'), { style: 'font-size:12px;min-height:18px;color:#5f6368;' });
    container.appendChild(status);
    log('Added status line');

    // Hover effect
    btn.addEventListener('mouseover', () => (btn.style.backgroundColor = 'rgba(26,115,232,0.04)'));
    btn.addEventListener('mouseout',  () => (btn.style.backgroundColor = 'transparent'));

    btn.addEventListener('click', async () => {
      log('Copy button clicked with mode:', modeSelect.value, 'slideNumber:', slideInput.value);
      try {
        const url = await requestUrl({ mode: modeSelect.value, slideNumber: slideInput.value });
        log('URL received from top frame:', url);
        await navigator.clipboard.writeText(url);
        log('URL copied to clipboard');
        status.textContent = 'Link copied!';
        status.style.color = 'green';
      } catch (err) {
        log('Copy failed', err);
        status.textContent = 'Failed to copy';
        status.style.color = 'red';
      }
      setTimeout(() => (status.textContent = ''), 3000);
    });

    // Attach container just below the dialog's button section (last div with buttons)
    const btnSections = [...dialog.querySelectorAll('div')].filter(d => d.querySelector('button'));
    log('Found', btnSections.length, 'button sections in dialog');
    const anchor = btnSections.pop() || dialog;
    log('Using anchor element for insertion:', anchor);
    anchor.after(container);
    log('Container inserted into dialog');
  }

  /***************************
   * Parent‑URL request util  *
   ***************************/
  function requestUrl({ mode, slideNumber }) {
    log('Requesting URL from top frame mode:', mode, 'slideNumber:', slideNumber);
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(32).slice(2);
      log('Generated requestId:', requestId);
      pending.set(requestId, resolve);
      
      window.parent.postMessage({ type: 'REQUEST_SLIDE_URL', mode, slideNumber, requestId }, '*');
      log('Sent request to parent frame');
      
      // Time‑out fail‑safe
      setTimeout(() => {
        if (pending.has(requestId)) {
          log('Request timed out for requestId:', requestId);
          pending.delete(requestId);
          reject(new Error('Timed‑out waiting for URL'));
        }
      }, 3000);
    });
  }
})(); 