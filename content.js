// Google Slides Current Slide URL Copier - Enhanced Version
// Inspired by Grammarly's injection strategies

(() => {
  const DEBUG = true;
  const PRODUCTION = false; // Set to true before uploading to Chrome Store
  const VERBOSE_LOGGING = false; // Set to true for detailed logging
  
  // Production-aware logging
  const log = (...args) => {
    if (PRODUCTION) {
      // In production: only log errors and critical functionality
      const message = args.join(' ');
      if (message.includes('❌') || message.includes('Error') || message.includes('✅ Current slide URL copied')) {
        console.log('[SlideURLCopier]', ...args);
      }
    } else if (DEBUG) {
      // In development: log everything
      console.log('[SlideURLCopier]', ...args);
    }
  };
  
  const verboseLog = (...args) => {
    if (!PRODUCTION && VERBOSE_LOGGING) {
      console.log('[SlideURLCopier-VERBOSE]', ...args);
    }
  };
  
  // Extension configuration
  const CONFIG = {
    FEATURE_FLAGS: {
      ENHANCED_DETECTION: true,
      AUTO_UPDATE_ON_SLIDE_CHANGE: true,
      IFRAME_DETECTION: true
    }
  };

  // URL generation - edit mode only
  const URL_MODE = 'EDIT';
  
  // State management
  const state = {
    isInitialized: false,
    currentSlideId: null,
    isReady: false,
    isInIframe: window.self !== window.top,
    isShareIframe: false,
    frameType: 'unknown',
    lastLogTime: 0,
    loggedElements: new Map(), // For timestamp tracking to prevent log spam
    isInjecting: false, // Flag to prevent concurrent injections
    quickActionsInjected: false, // Flag to prevent re-injection of quick actions option
    fallbackCheckDone: false // Flag to ensure fallback check is only done once
  };
  
  // Throttling function to prevent log spam
  function throttleLog(key, func, delay = 2000) {
    const now = Date.now();
    
    // FIX: Check if this specific key was recently logged
    const keyLastTime = state.loggedElements.get(key) || 0;
    
    if ((now - keyLastTime) > delay) {
      state.lastLogTime = now;
      
      // FIX: Store timestamp for this specific key
      state.loggedElements.set(key, now);
      
      func();
    }
  }
  
  // Detect frame context
  function detectFrameContext() {
    const url = window.location.href;
    state.isInIframe = window.self !== window.top;
    
    if (state.isInIframe) {
      if (url.includes('/drivesharing/driveshare')) {
        state.isShareIframe = true;
        state.frameType = 'share-iframe';
        log('🔍 DETECTED: Share iframe context');
      } else if (url.includes('docs.google.com')) {
        state.frameType = 'docs-iframe';
        verboseLog('🔍 DETECTED: Docs iframe context');
      } else {
        state.frameType = 'other-iframe';
        verboseLog('🔍 DETECTED: Other iframe context');
      }
    } else {
      state.frameType = 'main-frame';
      log('🔍 DETECTED: Main frame context');
    }
  }
  
  log('Extension initialized, checking environment...');
  
  // Detect frame context first
  detectFrameContext();
  
  // Early initialization - similar to Grammarly's document_start approach
  function earlyInit() {
    verboseLog('Early initialization started in', state.frameType);
    
    // Set up early DOM monitoring
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        verboseLog('DOM loaded, proceeding with main initialization');
        mainInit();
      });
    } else {
      verboseLog('DOM already loaded, proceeding immediately');
      mainInit();
    }
    
    // Monitor for slide changes only in main frame
    if (!state.isInIframe && CONFIG.FEATURE_FLAGS.AUTO_UPDATE_ON_SLIDE_CHANGE) {
      monitorSlideChanges();
    }
  }
  
  // Main initialization
  function mainInit() {
    if (state.isInitialized) {
      verboseLog('Already initialized, skipping');
      return;
    }
    
    state.isInitialized = true;
    log('Main initialization started in', state.frameType);
    
    // Set up iframe communication in main frame
    if (!state.isInIframe) {
      setupMainFrameMessageHandler();
    }
    
    // Set up efficient event-driven share button detection
    if (DEBUG) {
      setupShareButtonClickDetection();
      
      // Set up quick actions menu detection - NEW FEATURE
      setupQuickActionsMenuDetection();
      
      // Immediately scan for existing quick actions menus and inject our option
      scanForExistingQuickActionsMenu();
      
      // Immediately scan for existing dialogs
      if (!PRODUCTION) {
        verboseLog('🔍 IMMEDIATE SCAN - Checking for existing dialogs in', state.frameType);
        const existingDialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"], .docs-dialog, .modal');
        if (existingDialogs.length > 0) {
          log('Found existing dialogs:', existingDialogs.length);
          // Only log first dialog to avoid spam
          if (existingDialogs[0]) {
            logDialogElement('🎯 EXISTING DIALOG (immediate)', existingDialogs[0], 'immediate scan');
          }
        }
      }
    }
    
    // Different initialization based on frame type
    if (state.isShareIframe) {
      // We're in the share iframe - focus on dialog detection
      log('🎯 Share iframe detected - monitoring for share dialogs');
      setupShareIframeMonitoring();
    } else if (!state.isInIframe) {
      // We're in the main frame - just wait for slides to be ready and monitor
      waitForSlidesReady()
        .then(() => {
          log('Google Slides ready in main frame');
          state.isReady = true;
        })
        .catch(err => {
          log('Error during initialization:', err);
        });
    } else {
      // We're in some other iframe - just monitor
      verboseLog('🔍 Other iframe detected - monitoring only');
    }
  }
  
  /**
   * Setup message handler in main frame to respond to iframe requests
   */
  function setupMainFrameMessageHandler() {
    log('📡 Setting up main frame message handler...');
    
    window.addEventListener('message', (event) => {
      // Only handle messages from our iframe
      if (event.data && event.data.type === 'GET_SLIDE_URL') {
        log('📨 Received slide URL request from iframe (edit mode only):', event.data);
        
        try {
          // Always use edit mode
          const url = buildSlideUrl({ mode: 'EDIT' });
          
          log('📤 Sending slide URL to iframe:', url);
          
          // Send URL back to iframe
          event.source.postMessage({
            type: 'SLIDE_URL_RESPONSE',
            url: url,
            mode: 'EDIT'
          }, event.origin);
          
        } catch (error) {
          log('❌ Error generating slide URL:', error);
          
          // Send error response
          event.source.postMessage({
            type: 'SLIDE_URL_RESPONSE',
            error: error.message,
            url: location.href // Fallback to current URL
          }, event.origin);
        }
      }
    });
  }
  
  /**
   * Setup monitoring specifically for the share iframe
   */
  function setupShareIframeMonitoring() {
    log('🎯 Setting up share iframe monitoring');
    
    // Enhanced dialog detection for share iframe (throttled)
    const shareObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // More selective detection in share iframe
            const elementKey = `${node.tagName}-${node.className}-${node.getAttribute ? node.getAttribute('jsname') : ''}`;
            
            throttleLog(elementKey, () => {
              detectAndLogDialogs(node);
            }, 3000);
          }
        });
      });
    });
    
    shareObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false // Reduce attribute monitoring
    });
    
    // Much less frequent scanning in share iframe
    setInterval(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs.length > 0) {
        log('🔍 SHARE IFRAME SCAN - Found dialogs:', dialogs.length);
        // Only analyze the first dialog to avoid spam
        if (dialogs[0] && !state.loggedElements.has('main-dialog-analyzed')) {
          logDialogElement('🎯 MAIN SHARE DIALOG', dialogs[0], 'periodic scan');
          state.loggedElements.set('main-dialog-analyzed', Date.now());
        }
      }
    }, 10000); // Reduced to every 10 seconds
  }
  
  /**
   * Wait for Google Slides interface to be ready
   * Uses MutationObserver similar to Grammarly's approach
   */
  function waitForSlidesReady() {
    return new Promise((resolve) => {
      // Check if already ready
      if (isSlidesReady()) {
        log('Slides already ready');
        resolve();
        return;
      }
      
      log('Waiting for Slides to be ready...');
      
      const observer = new MutationObserver((mutations) => {
        if (isSlidesReady()) {
          log('Slides became ready');
          observer.disconnect();
          resolve();
        }
        
        // Log any dialog elements that appear
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              detectAndLogDialogs(node);
            }
          });
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'id']
      });
      
      // Fallback timeout
      setTimeout(() => {
        log('Timeout waiting for Slides, proceeding anyway');
        observer.disconnect();
        resolve();
      }, 10000);
    });
  }
  
  /**
   * Check if Google Slides interface is ready
   */
  function isSlidesReady() {
    // Look for key Google Slides UI elements
    const indicators = [
      '#docs-chrome',
      '[role="main"]',
      '.punch-present-edit-mode',
      '.app-switcher-button'
    ];
    
    return indicators.some(selector => document.querySelector(selector));
  }
  
  /**
   * Detect and log dialog elements
   */
  function detectAndLogDialogs(element) {
    // Look for dialog-related elements
    const dialogSelectors = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      '.docs-dialog',
      '.modal',
      '.popup',
      '[aria-modal="true"]',
      '.share-client-ActionBarView',
      '.share-client-ShareDialog',
      '.docs-material-dialog'
    ];

    dialogSelectors.forEach(selector => {
      // Check if the element itself matches
      if (element.matches && element.matches(selector)) {
        logDialogElement('🎯 DIALOG DETECTED', element, selector);
      }
      
      // Check for child elements that match
      const dialogElements = element.querySelectorAll ? element.querySelectorAll(selector) : [];
      dialogElements.forEach(dialogEl => {
        const elementKey = `dialog-${dialogEl.tagName}-${dialogEl.className}`;
        throttleLog(elementKey, () => {
          logDialogElement('🎯 DIALOG DETECTED', dialogEl, selector);
        }, 5000);
      });
    });

    // Check for share-related elements with specific patterns (but allow multiple detections)
    if (element.textContent && element.textContent.includes('Share')) {
      log('🎯 SHARE TEXT DETECTED in element:', {
        tagName: element.tagName,
        className: element.className,
        jsname: element.getAttribute('jsname'),
        id: element.id,
        textContent: element.textContent.substring(0, 100) + '...'
      });
      
      // FIX: Improve throttling for share dialog detection
      // Create a unique key that includes more context
      const shareElementKey = `share-dialog-${element.tagName}-${element.className}-${Date.now()}`;
      
      // Use shorter throttling time and allow re-detection
      throttleLog(shareElementKey, () => {
        findShareDialogAndAnalyzeButtons(element);
      }, 500); // Reduced to 500ms for more responsive detection
    }

    // Reduce interesting element logging
    if (VERBOSE_LOGGING && element.className && typeof element.className === 'string') {
      const interestingClasses = [
        'share', 'dialog', 'modal', 'popup', 'overlay', 'menu', 
        'button', 'input', 'textarea', 'select', 'form'
      ];
      
      const hasInterestingClass = interestingClasses.some(cls => 
        element.className.toLowerCase().includes(cls)
      );
      
      if (hasInterestingClass) {
        logInterestingElement('🔍 INTERESTING ELEMENT', element);
      }
    }
  }
  
  /**
   * Find the parent dialog element and analyze all buttons within it
   */
  function findShareDialogAndAnalyzeButtons(shareElement) {
    log('🔍 SEARCHING FOR PARENT DIALOG...');
    
    // Traverse up the DOM tree to find parent with role="dialog"
    let currentElement = shareElement;
    let dialogParent = null;
    let levels = 0;
    
    while (currentElement && currentElement !== document.body && levels < 20) {
      log(`  Level ${levels}: ${currentElement.tagName}`, {
        className: currentElement.className,
        role: currentElement.getAttribute ? currentElement.getAttribute('role') : null,
        jsname: currentElement.getAttribute ? currentElement.getAttribute('jsname') : null,
        id: currentElement.id
      });
      
      if (currentElement.getAttribute && currentElement.getAttribute('role') === 'dialog') {
        dialogParent = currentElement;
        log(`🎯 FOUND DIALOG PARENT at level ${levels}:`, {
          tagName: dialogParent.tagName,
          className: dialogParent.className,
          jsname: dialogParent.getAttribute('jsname'),
          id: dialogParent.id
        });
        break;
      }
      
      currentElement = currentElement.parentElement;
      levels++;
    }
    
    if (!dialogParent) {
      log('❌ No parent dialog found within 20 levels');
      return;
    }
    
    // Now find and log ALL buttons within the dialog
    analyzeDialogButtons(dialogParent);
  }
  
  /**
   * Analyze all buttons within the dialog
   */
  function analyzeDialogButtons(dialogElement) {
    log('🔘 ANALYZING ALL BUTTONS IN SHARE DIALOG:');
    
    // Find all button elements
    const buttonSelectors = [
      'button',
      '[role="button"]',
      'input[type="button"]',
      'input[type="submit"]',
      '[type="button"]'
    ];
    
    const allButtons = [];
    buttonSelectors.forEach(selector => {
      const buttons = dialogElement.querySelectorAll(selector);
      buttons.forEach(btn => {
        if (!allButtons.includes(btn)) {
          allButtons.push(btn);
        }
      });
    });
    
    log(`📊 FOUND ${allButtons.length} BUTTONS IN SHARE DIALOG:`);
    
    let copyLinkButton = null;
    
    allButtons.forEach((button, index) => {
      const buttonInfo = {
        index: index + 1,
        tagName: button.tagName,
        type: button.type,
        className: button.className,
        jsname: button.getAttribute('jsname'),
        id: button.id,
        role: button.getAttribute('role'),
        ariaLabel: button.getAttribute('aria-label'),
        title: button.title,
        textContent: button.textContent ? button.textContent.trim() : '',
        innerHTML: button.innerHTML ? button.innerHTML.substring(0, 200) + '...' : '',
        disabled: button.disabled,
        style: button.style.cssText ? button.style.cssText.substring(0, 100) + '...' : '',
        allClasses: button.classList ? Array.from(button.classList) : [],
        allAttributes: getElementAttributes(button),
        parentInfo: {
          tagName: button.parentElement ? button.parentElement.tagName : null,
          className: button.parentElement ? button.parentElement.className : null,
          jsname: button.parentElement ? button.parentElement.getAttribute('jsname') : null
        }
      };
      
      log(`  🔘 BUTTON #${index + 1}:`, buttonInfo);
      
      // Check if this is the "Copy link" button
      const buttonText = button.textContent.toLowerCase().trim();
      if (buttonText.includes('copy') && buttonText.includes('link')) {
        copyLinkButton = button;
        log(`    🎯 FOUND COPY LINK BUTTON:`, {
          element: button,
          textContent: button.textContent.trim(),
          target: 'This is where we will inject our button!'
        });
      }
      
      // Special attention to buttons with specific text content
      if (buttonText.includes('copy') || buttonText.includes('link') || buttonText.includes('share') || buttonText.includes('done')) {
        log(`    ⭐ SPECIAL BUTTON - "${buttonText}":`, {
          element: button,
          possibleTarget: 'This might be where we can inject our button'
        });
      }
    });
    
    // When share dialog detected, show our overlay button (which works!)
    log('🧪 SHARE DIALOG DETECTED - SHOWING OVERLAY BUTTON');
    
    // FIX: Always remove existing button first to ensure clean state
    const existingButton = document.getElementById('slide-url-copy-button-overlay');
    if (existingButton) {
      log('🧹 Removing existing overlay button for clean re-injection');
      existingButton.remove();
    }
    
    // Create new overlay button
    injectTestButton();
    
    // Set up dialog close detection to reset state
    setupDialogCloseDetection();
  }
  
  /**
   * Create the main overlay button positioned next to Copy link button
   */
  function createTestButton() {
    const button = document.createElement('button');
    
    // Set basic attributes
    button.id = 'slide-url-copy-button-overlay';
    button.className = 'slide-url-overlay-button';
    button.setAttribute('data-testid', 'slide-url-copy-button-overlay');
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', 'Copy URL for current slide');
    button.textContent = '📎 Copy Slide URL';
    
    // Apply Google-style button appearance
    button.style.cssText = `
      position: fixed !important;
      z-index: 999999 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #1a73e8 !important;
      border: 1px solid #747775 !important;
      border-radius: 24px !important;
      font-family: 'Google Sans', Roboto, Arial, sans-serif !important;
      font-size: .875rem !important;
      font-weight: 500 !important;
      height: 40px !important;
      padding: 0 20px !important;
      box-shadow: none !important;
      cursor: pointer !important;
      outline: none !important;
      gap: 8px !important;
      transition: border-color 0.2s, color 0.2s, background 0.2s !important;
    `;
    button.innerHTML = `
      <span class="slide-url-overlay-button-text" style="color:#1a73e8;">Copy current slide link</span>
    `;
    
    // Add Google-style hover effect
    if (!document.head.querySelector('[data-slide-url-overlay-hover-style]')) {
      const style = document.createElement('style');
      style.setAttribute('data-slide-url-overlay-hover-style', 'true');
      style.textContent = `
        #slide-url-copy-button-overlay {
          background: #fff !important;
        }
        #slide-url-copy-button-overlay:hover {
          background: rgba(11, 87, 208, 0.09) !important;
        }
        .slide-url-overlay-button {
          background: #fff !important;
        }
        .slide-url-overlay-button:hover {
          background: rgba(11, 87, 208, 0.09) !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    return button;
  }
  
  /**
   * Position the overlay button next to the Copy link button
   */
  function positionOverlayButton(overlayButton) {
    // Find the Copy link button across all frames
    let copyLinkButton = null;
    
    // Try to find in current frame first
    copyLinkButton = Array.from(document.querySelectorAll('button')).find(btn => 
      btn.textContent.toLowerCase().includes('copy') && btn.textContent.toLowerCase().includes('link')
    );
    
    if (!copyLinkButton) {
      log('❌ Copy link button not found for positioning');
      // Fallback to center positioning
      overlayButton.style.top = '50%';
      overlayButton.style.left = '50%';
      overlayButton.style.transform = 'translate(-50%, -50%)';
      return;
    }
    
    // Get the position of the Copy link button
    const copyLinkRect = copyLinkButton.getBoundingClientRect();
    
    // Calculate position for our button (to the right of Copy link button)
    const buttonGap = 8; // 8px gap between buttons
    const leftPosition = copyLinkRect.right + buttonGap;
    const topPosition = copyLinkRect.top;
    
    // Position our button
    overlayButton.style.left = `${leftPosition}px`;
    overlayButton.style.top = `${topPosition}px`;
    overlayButton.style.transform = 'none'; // Remove center transform
    
    log('📍 Positioned overlay button next to Copy link:', {
      copyLinkPosition: {
        left: copyLinkRect.left,
        top: copyLinkRect.top,
        right: copyLinkRect.right,
        bottom: copyLinkRect.bottom,
        width: copyLinkRect.width,
        height: copyLinkRect.height
      },
      overlayPosition: {
        left: leftPosition,
        top: topPosition
      }
    });
    
    // Verify button is visible in viewport
    const overlayRect = overlayButton.getBoundingClientRect();
    const isInViewport = overlayRect.left >= 0 && 
                        overlayRect.top >= 0 && 
                        overlayRect.right <= window.innerWidth && 
                        overlayRect.bottom <= window.innerHeight;
    
    if (!isInViewport) {
      log('⚠️ Button positioned outside viewport, adjusting...');
      
      // If button goes off screen to the right, position it to the left of Copy link
      if (overlayRect.right > window.innerWidth) {
        const leftPosition = copyLinkRect.left - overlayRect.width - buttonGap;
        overlayButton.style.left = `${Math.max(0, leftPosition)}px`;
        log('📍 Repositioned to left of Copy link button');
      }
      
      // If button goes off screen vertically, adjust
      if (overlayRect.bottom > window.innerHeight) {
        const topPosition = window.innerHeight - overlayRect.height - 10;
        overlayButton.style.top = `${Math.max(0, topPosition)}px`;
        log('📍 Repositioned vertically to stay in viewport');
      }
    }
  }
  
  /**
   * Show the main overlay button positioned next to Copy link button
   */
  function injectTestButton() {
    // Prevent concurrent injections
    if (state.isInjecting) {
      log('⚠️ Injection already in progress, skipping...');
      return;
    }
    
    state.isInjecting = true;
    log('🎯 SHOWING SLIDE URL OVERLAY BUTTON NEXT TO COPY LINK...');
    
    // Remove ALL existing overlay buttons (use more thorough cleanup)
    const existingButtons = document.querySelectorAll('#slide-url-copy-button-overlay, .slide-url-overlay-button');
    if (existingButtons.length > 0) {
      log(`🧹 Removing ${existingButtons.length} existing overlay button(s)`);
      existingButtons.forEach(btn => btn.remove());
    }
    
    // Create the overlay button
    const overlayButton = createTestButton();
    
    // Add click handler
    overlayButton.addEventListener('click', createButtonClickHandler(overlayButton));
    
    // Inject to body first (for positioning calculation)
    document.body.appendChild(overlayButton);
    
    // Position it next to the Copy link button
    positionOverlayButton(overlayButton);
    
    log('✅ OVERLAY BUTTON POSITIONED NEXT TO COPY LINK:', {
      buttonElement: overlayButton,
      buttonProperties: {
        id: overlayButton.id,
        textContent: overlayButton.textContent,
        position: {
          left: overlayButton.style.left,
          top: overlayButton.style.top
        }
      }
    });
    
    // Monitor for dialog movement/resize and reposition accordingly
    let repositionTimer;
    const repositionButton = () => {
      clearTimeout(repositionTimer);
      repositionTimer = setTimeout(() => {
        if (overlayButton.parentNode) {
          positionOverlayButton(overlayButton);
        }
      }, 100); // Debounce repositioning
    };
    
    // Listen for window resize and scroll
    window.addEventListener('resize', repositionButton);
    window.addEventListener('scroll', repositionButton);
    
    // Add click-outside to dismiss (but not immediate)
    const dismissOnClickOutside = (event) => {
      if (event.target !== overlayButton && !overlayButton.contains(event.target)) {
        overlayButton.remove();
        window.removeEventListener('resize', repositionButton);
        window.removeEventListener('scroll', repositionButton);
        document.removeEventListener('click', dismissOnClickOutside);
        state.isInjecting = false; // Reset flag
        log('🎯 Overlay button dismissed by click outside');
      }
    };
    
    // Add slight delay before enabling click-outside
    setTimeout(() => {
      document.addEventListener('click', dismissOnClickOutside);
    }, 1000);
    
    // Add Google-style hover effect if not already present
    if (!document.head.querySelector('[data-slide-url-overlay-hover-style]')) {
      const style = document.createElement('style');
      style.setAttribute('data-slide-url-overlay-hover-style', 'true');
      style.textContent = `
        #slide-url-copy-button-overlay:hover {
          background: rgba(11, 87, 208, 0.09) !important;
        }
        .slide-url-overlay-button:hover {
          background: rgba(11, 87, 208, 0.09) !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Reset injection flag after setup is complete
    state.isInjecting = false;
    
    return overlayButton;
  }
  
  /**
   * Analyze text content within share dialog elements
   */
  function analyzeShareDialogText(element) {
    log('📝 SHARE DIALOG TEXT ANALYSIS for:', {
      tagName: element.tagName,
      className: element.className,
      jsname: element.getAttribute('jsname'),
      id: element.id
    });
    
    // Find all text-containing elements within this element
    const textElements = [];
    
    // Get all descendant elements
    const allDescendants = element.querySelectorAll('*');
    
    allDescendants.forEach((descendant, index) => {
      const textContent = descendant.textContent ? descendant.textContent.trim() : '';
      if (textContent.length > 0) {
        // Check for specific keywords
        const hasShare = textContent.toLowerCase().includes('share');
        const hasWithAccess = textContent.toLowerCase().includes('with access');
        const hasAccess = textContent.toLowerCase().includes('access');
        const hasWith = textContent.toLowerCase().includes('with');
        
        if (hasShare || hasWithAccess || hasAccess || hasWith) {
          textElements.push({
            index: index,
            tagName: descendant.tagName,
            className: descendant.className,
            jsname: descendant.getAttribute('jsname'),
            id: descendant.id,
            textContent: textContent,
            hasShare: hasShare,
            hasWithAccess: hasWithAccess,
            hasAccess: hasAccess,
            hasWith: hasWith,
            element: descendant
          });
        }
      }
    });
    
    log('📋 TEXT ELEMENTS WITH KEYWORDS:', textElements.length);
    textElements.forEach((textEl, index) => {
      const keywords = [];
      if (textEl.hasShare) keywords.push('SHARE');
      if (textEl.hasWithAccess) keywords.push('WITH ACCESS');
      if (textEl.hasAccess) keywords.push('ACCESS');
      if (textEl.hasWith) keywords.push('WITH');
      
      log(`  📄 Text Element #${index + 1} [${keywords.join(', ')}]:`, {
        tagName: textEl.tagName,
        className: textEl.className,
        jsname: textEl.jsname,
        id: textEl.id,
        textContent: textEl.textContent,
        element: textEl.element
      });
    });
    
    // Also analyze direct text nodes
    analyzeTextNodes(element);
    
    // Look for specific share dialog patterns
    const sharePatterns = [
      /share\s+['"][^'"]*['"]?/i,
      /with\s+access/i,
      /can\s+(view|edit|comment)/i,
      /get\s+link/i,
      /copy\s+link/i,
      /share\s+with\s+people/i
    ];
    
    const fullText = element.textContent;
    sharePatterns.forEach((pattern, index) => {
      const match = fullText.match(pattern);
      if (match) {
        log(`🎯 SHARE PATTERN #${index + 1} FOUND:`, {
          pattern: pattern.toString(),
          match: match[0],
          fullMatch: match
        });
      }
    });
  }
  
  /**
   * Analyze text nodes specifically
   */
  function analyzeTextNodes(element) {
    log('📝 TEXT NODES ANALYSIS:');
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          return node.textContent.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text.length > 0) {
        textNodes.push({
          text: text,
          parentTag: node.parentNode.tagName,
          parentClass: node.parentNode.className,
          parentJsName: node.parentNode.getAttribute ? node.parentNode.getAttribute('jsname') : null,
          parentId: node.parentNode.id,
          hasKeywords: /share|access|with|link|copy|get/i.test(text)
        });
      }
    }
    
    log(`📄 FOUND ${textNodes.length} TEXT NODES:`);
    textNodes.forEach((textNode, index) => {
      if (textNode.hasKeywords) {
        log(`  🎯 Text Node #${index + 1} [KEYWORDS]:`, textNode);
      } else {
        log(`  📝 Text Node #${index + 1}:`, textNode);
      }
    });
  }
  
  /**
   * Log detailed information about a dialog element
   */
  function logDialogElement(prefix, element, selector) {
    const dialogInfo = {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      jsname: element.getAttribute('jsname'),
      role: element.getAttribute('role'),
      ariaLabel: element.getAttribute('aria-label'),
      ariaModal: element.getAttribute('aria-modal'),
      textContent: element.textContent ? element.textContent.substring(0, 200) + '...' : '',
      innerHTML: element.innerHTML ? element.innerHTML.substring(0, 300) + '...' : '',
      element: element
    };
    
    log(`${prefix} (${selector}):`, dialogInfo);
    
    // Special detailed logging for role="dialog" elements
    if (element.getAttribute('role') === 'dialog') {
      log('🎯 DIALOG ROLE DETECTED - Enhanced Details:', {
        'Class Attribute': element.className,
        'JSName Attribute': element.getAttribute('jsname'),
        'All Classes': element.classList ? Array.from(element.classList) : [],
        'All Attributes': getElementAttributes(element),
        'Data Attributes': getDataAttributes(element)
      });
    }
    
    // Log all child elements
    logDialogChildren(element);
  }
  
  /**
   * Get all attributes of an element
   */
  function getElementAttributes(element) {
    const attrs = {};
    if (element.attributes) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attrs[attr.name] = attr.value;
      }
    }
    return attrs;
  }
  
  /**
   * Get all data attributes of an element
   */
  function getDataAttributes(element) {
    const dataAttrs = {};
    if (element.attributes) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        if (attr.name.startsWith('data-')) {
          dataAttrs[attr.name] = attr.value;
        }
      }
    }
    return dataAttrs;
  }
  
  /**
   * Log all children of a dialog element (simplified)
   */
  function logDialogChildren(dialogElement) {
    verboseLog('📋 DIALOG CHILDREN:');
    
    if (!VERBOSE_LOGGING) {
      // Simplified logging - just count elements
      const buttons = dialogElement.querySelectorAll('button, [role="button"]');
      const inputs = dialogElement.querySelectorAll('input, textarea, select');
      const textElements = dialogElement.querySelectorAll('span, div, p');
      
      log(`📊 DIALOG SUMMARY: ${buttons.length} buttons, ${inputs.length} inputs, ${textElements.length} text elements`);
      
      // Log key elements only
      buttons.forEach((btn, index) => {
        if (index < 3) { // Only first 3 buttons
          log(`  🔘 BUTTON #${index + 1}:`, {
            tagName: btn.tagName,
            className: btn.className,
            jsname: btn.getAttribute('jsname'),
            textContent: btn.textContent ? btn.textContent.trim().substring(0, 50) : ''
          });
        }
      });
      
      return;
    }
    
    // Full detailed logging (only if VERBOSE_LOGGING is true)
    const allChildren = dialogElement.querySelectorAll('*');
    let buttonCount = 0;
    let inputCount = 0;
    let textCount = 0;
    
    allChildren.forEach((child, index) => {
      const info = {
        index: index,
        tagName: child.tagName,
        id: child.id,
        className: child.className,
        jsname: child.getAttribute('jsname'),
        type: child.type,
        role: child.getAttribute('role'),
        ariaLabel: child.getAttribute('aria-label'),
        placeholder: child.placeholder,
        value: child.value,
        textContent: child.textContent ? child.textContent.trim().substring(0, 100) : '',
        href: child.href
      };
      
      // Count different types
      if (child.tagName === 'BUTTON' || child.type === 'button' || child.getAttribute('role') === 'button') {
        buttonCount++;
        verboseLog(`  🔘 BUTTON #${buttonCount}:`, {
          ...info,
          'All Classes': child.classList ? Array.from(child.classList) : [],
          'JSName': child.getAttribute('jsname'),
          'All Attributes': getElementAttributes(child)
        });
      } else if (child.tagName === 'INPUT' || child.tagName === 'TEXTAREA' || child.tagName === 'SELECT') {
        inputCount++;
        verboseLog(`  📝 INPUT #${inputCount}:`, {
          ...info,
          'All Classes': child.classList ? Array.from(child.classList) : [],
          'JSName': child.getAttribute('jsname')
        });
      } else if (child.tagName === 'SPAN' || child.tagName === 'DIV' || child.tagName === 'P') {
        if (child.textContent && child.textContent.trim().length > 0) {
          textCount++;
          verboseLog(`  📄 TEXT #${textCount}:`, {
            ...info,
            'All Classes': child.classList ? Array.from(child.classList) : [],
            'JSName': child.getAttribute('jsname')
          });
        }
      }
    });
    
    verboseLog(`📊 DIALOG SUMMARY: ${buttonCount} buttons, ${inputCount} inputs, ${textCount} text elements, ${allChildren.length} total children`);
    
    // Special scan for elements with jsname attributes
    const jsNameElements = dialogElement.querySelectorAll('[jsname]');
    if (jsNameElements.length > 0) {
      verboseLog('🏷️  ELEMENTS WITH JSNAME:', jsNameElements.length);
      jsNameElements.forEach((el, index) => {
        if (index < 5) { // Only first 5 elements
          verboseLog(`  JSName Element #${index + 1}:`, {
            tagName: el.tagName,
            jsname: el.getAttribute('jsname'),
            className: el.className,
            id: el.id,
            textContent: el.textContent ? el.textContent.trim().substring(0, 50) + '...' : '',
            element: el
          });
        }
      });
    }
  }
  
  /**
   * Log interesting elements that might be relevant
   */
  function logInterestingElement(prefix, element) {
    log(`${prefix}:`, {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      textContent: element.textContent ? element.textContent.substring(0, 100) + '...' : '',
      element: element
    });
  }
  
  /**
   * Monitor slide changes using URL hash changes and MutationObserver
   */
  function monitorSlideChanges() {
    log('Setting up slide change monitoring');
    
    let lastSlideId = getCurrentSlideId();
    
    // Monitor URL changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      handlePotentialSlideChange();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      handlePotentialSlideChange();
    };
    
    window.addEventListener('popstate', handlePotentialSlideChange);
    window.addEventListener('hashchange', handlePotentialSlideChange);
    
    // Also monitor DOM changes that might indicate slide changes OR dialog appearances
    const slideObserver = new MutationObserver((mutations) => {
      // Check if the current slide indicator changed
      const currentSlideId = getCurrentSlideId();
      if (currentSlideId !== lastSlideId) {
        lastSlideId = currentSlideId;
        handleSlideChange(currentSlideId);
      }
      
      // Log any new dialog elements
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            detectAndLogDialogs(node);
          }
        });
      });
    });
    
    // FIX: Ensure we have a valid target before observing
    const findValidTarget = () => {
      // Try multiple selectors to find a valid target
      const targets = [
        document.querySelector('[role="main"]'),
        document.querySelector('#docs-chrome'),
        document.querySelector('.punch-present-edit-mode'),
        document.body,
        document.documentElement
      ];
      
      return targets.find(target => target && target.nodeType === Node.ELEMENT_NODE);
    };
    
    const targetElement = findValidTarget();
    
    if (targetElement) {
      log('Setting up MutationObserver on:', targetElement.tagName, targetElement.className);
      slideObserver.observe(targetElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-selected', 'data-slide-id', 'role', 'aria-modal']
      });
    } else {
      log('⚠️ Could not find valid target for MutationObserver, using fallback approach');
      // Fallback: Just monitor for URL changes
    }
    
    function handlePotentialSlideChange() {
      setTimeout(() => {
        const currentSlideId = getCurrentSlideId();
        if (currentSlideId !== lastSlideId) {
          lastSlideId = currentSlideId;
          handleSlideChange(currentSlideId);
        }
      }, 100);
    }
    
    function handleSlideChange(slideId) {
      log('Slide changed to:', slideId);
      state.currentSlideId = slideId;
    }
  }
  
  /**
   * Get current slide ID from URL or DOM
   */
  function getCurrentSlideId() {
    // Try URL hash first
    const href = location.href;
    let slideMatch = href.match(/#slide=id\.?([^&]+)/);
    
    if (slideMatch) {
      return slideMatch[1];
    }
    
    // Try numeric format
    slideMatch = href.match(/#slide=(\d+)/);
    if (slideMatch) {
      return slideMatch[1];
    }
    
    // Fallback to DOM detection
    const activeSlide = document.querySelector('[aria-selected="true"]');
    if (activeSlide) {
      const slideId = activeSlide.getAttribute('data-slide-id') || 
                     activeSlide.getAttribute('id') ||
                     '0';
      return slideId;
    }
    
    return '0';
  }
  
  /**
   * Enhanced URL building - edit mode only
   */
  function buildSlideUrl({ mode = 'EDIT' } = {}) {
    log('Building slide URL (edit mode only)');
    
    const href = location.href;
    const idMatch = href.match(/\/presentation\/d\/([^/]+)/);
    
    if (!idMatch) {
      log('Could not extract presentation ID from URL');
      return href;
    }
    
    const presentationId = idMatch[1];
    let slideNumber = getCurrentSlideId();
    
    log('Presentation ID:', presentationId, 'Slide ID:', slideNumber);
    
    // Always generate edit URL
    const finalUrl = `https://docs.google.com/presentation/d/${presentationId}/edit#slide=id.${slideNumber}`;
    
    log('Final URL generated:', finalUrl);
    return finalUrl;
  }
  
  /**
   * Enhanced button state management following Grammarly's patterns
   */
  function updateButtonState(button, state, message = null) {
    const textSpan = button.querySelector('.slide-url-overlay-button-text');
    if (!textSpan) return;
    if (state === 'success') {
      textSpan.innerHTML = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Copied!&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
      ;
      setTimeout(() => {
        textSpan.textContent = 'Copy current slide link';
      }, 2000);
    } else {
      textSpan.textContent = 'Copy current slide link';
    }
  }
  
  /**
   * Enhanced button click handler with better error handling
   */
  function createButtonClickHandler(button) {
    return async (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      log('🔗 Copy slide URL button clicked!');
      updateButtonState(button, 'loading');
      
      try {
        let url;
        
        if (state.isShareIframe) {
          // We're in iframe, need to communicate with main frame
          url = await requestSlideUrlFromMainFrame();
        } else {
          // We're in main frame, can get URL directly
          url = buildSlideUrl({ mode: 'EDIT' });
        }
        
        await navigator.clipboard.writeText(url);
        updateButtonState(button, 'success');
        
        // Show Google-style "Link copied" tooltip
        showLinkCopiedTooltip();
        
        log('✅ Slide URL copied successfully:', url);
        
      } catch (error) {
        log('❌ Error copying slide URL:', error);
        updateButtonState(button, 'error', 'Copy failed');
      }
    };
  }
  
  /**
   * Promise-based iframe communication
   */
  function requestSlideUrlFromMainFrame() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for slide URL'));
      }, 5000);
      
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'SLIDE_URL_RESPONSE') {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.url);
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      window.parent.postMessage({
        type: 'GET_SLIDE_URL',
        mode: 'EDIT'
      }, '*');
    });
  }
  
  /**
   * Simplified dialog close detection - just clean up overlay button when needed
   */
  function setupDialogCloseDetection() {
    log('📋 Setting up simple dialog close detection...');
    
    // Simple cleanup when dialog is removed
    const dialogObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if a dialog was removed
            const isDialog = node.matches && (
              node.matches('[role="dialog"]') || 
              node.matches('[role="alertdialog"]')
            );
            
            // Or if it contains dialogs
            const containsDialog = node.querySelectorAll && 
              node.querySelectorAll('[role="dialog"], [role="alertdialog"]').length > 0;
              
            if (isDialog || containsDialog) {
              log('🚪 Share dialog closed - cleaning up overlay button');
              
              // Just remove overlay button - no need for complex state management
              const overlayButton = document.getElementById('slide-url-copy-button-overlay');
              if (overlayButton) {
                overlayButton.remove();
                log('✅ Overlay button removed - ready for next share button click');
              }
              
              // Reset injection flag and clean up this observer
              state.isInjecting = false;
              dialogObserver.disconnect();
            }
          }
        });
      });
    });
    
    // Observe for dialog removal
    dialogObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * Set up event-driven share button click detection - much more efficient!
   */
  function setupShareButtonClickDetection() {
    log('🎯 Setting up share button click detection...');
    
    // Listen for clicks on the document
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if clicked element matches share button criteria
      if (target && 
          target.tagName === 'DIV' && 
          target.getAttribute('role') === 'button' && 
          target.getAttribute('aria-label') && 
          target.getAttribute('aria-label').startsWith('Share')) {
        
        log('🎯 SHARE BUTTON CLICKED!', {
          element: target,
          ariaLabel: target.getAttribute('aria-label'),
          className: target.className
        });
        
        // Wait for the share dialog to appear
        waitForShareDialog();
      }
    }, true); // Use capture phase to catch the event early
    
    log('✅ Share button click detection set up');
  }
  
  /**
   * Wait for share dialog to appear after share button click
   */
  function waitForShareDialog() {
    log('⏳ Waiting for share dialog to appear...');
    
    let attempts = 0;
    let dialogFound = false; // Flag to prevent continued checking
    const maxAttempts = 20; // Check for 2 seconds
    
    const checkForDialog = () => {
      // Don't continue if we already found and processed a dialog
      if (dialogFound) {
        return;
      }
      
      attempts++;
      
      // Look for dialog elements
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      
      if (dialogs.length > 0) {
        log('✅ Share dialog detected!', dialogs.length, 'dialogs found');
        
        // Find the dialog with share-related content
        const shareDialog = Array.from(dialogs).find(dialog => {
          const text = dialog.textContent.toLowerCase();
          return text.includes('share') || text.includes('copy link') || text.includes('get link');
        });
        
        if (shareDialog) {
          log('🎯 Found share dialog with relevant content');
          dialogFound = true; // Set flag to stop further checking
          
          // Process the share dialog
          setTimeout(() => {
            analyzeDialogButtons(shareDialog);
          }, 200); // Small delay to ensure dialog is fully rendered
          
          return;
        }
        
        // If we found dialogs but none with share content, try a more lenient check
        if (dialogs.length > 0) {
          log('🎯 Found dialog(s) but no share content detected, processing first dialog');
          dialogFound = true; // Set flag to stop further checking
          
          setTimeout(() => {
            analyzeDialogButtons(dialogs[0]);
          }, 200);
          
          return;
        }
      }
      
      // Continue checking if not found and haven't exceeded max attempts
      if (attempts < maxAttempts) {
        setTimeout(checkForDialog, 100);
      } else {
        log('⚠️ Share dialog not found after', maxAttempts, 'attempts');
      }
    };
    
    // Start checking
    setTimeout(checkForDialog, 100); // Small initial delay
  }

  /**
   * Set up quick actions menu detection - NEW FEATURE
   */
  function setupQuickActionsMenuDetection() {
    log('🎯 Setting up quick actions menu detection...');
    
    // Listen for clicks on the quick actions menu button
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if clicked element is the quick actions menu button or its parent
      const quickActionsButton = target.closest('#scb-quick-actions-menu-button') || 
                                 (target.id === 'scb-quick-actions-menu-button' ? target : null);
      
      if (quickActionsButton) {
        log('🎯 QUICK ACTIONS MENU BUTTON CLICKED!', {
          element: quickActionsButton,
          id: quickActionsButton.id
        });
        
        // Update current slide ID for when user clicks our option
        const newSlideId = getCurrentSlideId();
        if (newSlideId !== state.currentSlideId) {
          state.currentSlideId = newSlideId;
          log('📍 Updated current slide ID to:', newSlideId);
        }
        
        // One-time fallback check: if option not injected and we haven't checked before
        if (!state.quickActionsInjected && !state.fallbackCheckDone) {
          log('🔧 Fallback check: option not injected, attempting injection...');
          state.fallbackCheckDone = true; // Mark that we've done the fallback check
          waitForQuickActionsMenu();
        } else if (state.quickActionsInjected && !state.fallbackCheckDone) {
          // Option was injected but let's verify it's actually in the DOM (one-time check)
          setTimeout(() => {
            const menu = document.querySelector('.goog-menu.scb-sqa-menu.goog-menu.scb-sqa-menu-vertical[role="menu"]');
            if (menu && menu.style.visibility === 'visible') {
              const existingOption = menu.querySelector('#current-slide-copy-option');
              if (!existingOption) {
                log('🔧 Fallback check: option missing from DOM, re-injecting...');
                state.quickActionsInjected = false; // Reset flag to allow re-injection
                injectCurrentSlideOption(menu);
              } else {
                log('✅ Fallback check: option confirmed in DOM');
              }
            }
            state.fallbackCheckDone = true; // Mark that we've done the fallback check
          }, 100);
        }
      }
    }, true); // Use capture phase to catch the event early
    
    log('✅ Quick actions menu detection set up');
  }

  /**
   * Scan for existing quick actions menu and inject our option immediately
   */
  function scanForExistingQuickActionsMenu() {
    log('🔍 Scanning for existing quick actions menu...');
    
    // Initialize current slide ID
    state.currentSlideId = getCurrentSlideId();
    log('📍 Initialized current slide ID to:', state.currentSlideId);
    
    // Look for the quick actions menu that might already exist
    const menu = document.querySelector('.goog-menu.scb-sqa-menu.goog-menu.scb-sqa-menu-vertical[role="menu"]');
    
    if (menu) {
      log('✅ Found existing quick actions menu, injecting option immediately...');
      injectCurrentSlideOption(menu);
    } else {
      log('ℹ️ No existing quick actions menu found, will try again after delay...');
      
      // Try again after a short delay in case the menu loads shortly after document ready
      setTimeout(() => {
        const delayedMenu = document.querySelector('.goog-menu.scb-sqa-menu.goog-menu.scb-sqa-menu-vertical[role="menu"]');
        if (delayedMenu) {
          log('✅ Found quick actions menu after delay, injecting option...');
          injectCurrentSlideOption(delayedMenu);
        } else {
          log('ℹ️ Still no quick actions menu found, will inject when user clicks');
        }
      }, 1000); // Try again after 1 second
    }
  }

  /**
   * Wait for quick actions menu to appear and inject our option
   */
  function waitForQuickActionsMenu() {
    log('⏳ Waiting for quick actions menu to appear...');
    
    let attempts = 0;
    let menuFound = false;
    const maxAttempts = 20; // Check for 2 seconds
    
    const checkForMenu = () => {
      if (menuFound) {
        return;
      }
      
      attempts++;
      
      // Look for the quick actions menu
      const menu = document.querySelector('.goog-menu.scb-sqa-menu.goog-menu.scb-sqa-menu-vertical[role="menu"]');
      
      if (menu && menu.style.visibility === 'visible') {
        log('✅ Quick actions menu detected!');
        menuFound = true;
        
        // Process the menu to inject our option
        setTimeout(() => {
          injectCurrentSlideOption(menu);
        }, 100); // Small delay to ensure menu is fully rendered
        
        return;
      }
      
      // Continue checking if not found and haven't exceeded max attempts
      if (attempts < maxAttempts) {
        setTimeout(checkForMenu, 100);
      } else {
        log('⚠️ Quick actions menu not found after', maxAttempts, 'attempts');
      }
    };
    
    // Start checking
    setTimeout(checkForMenu, 50); // Small initial delay
  }

  /**
   * Inject "Copy current slide link" option into quick actions menu
   */
  function injectCurrentSlideOption(menu) {
    log('🚀 Injecting current slide option into quick actions menu...');
    
    // Check if we've already injected
    if (state.quickActionsInjected) {
      log('ℹ️ Quick actions option already injected, skipping...');
      return;
    }
    
    // Find the "Copy link" menu item
    const menuItems = menu.querySelectorAll('.goog-menuitem.scb-sqa-menuitem[role="menuitem"]');
    let copyLinkItem = null;
    
    for (const item of menuItems) {
      const text = item.textContent.toLowerCase();
      if (text.includes('copy link') && !text.includes('time')) {
        copyLinkItem = item;
        break;
      }
    }
    
    if (!copyLinkItem) {
      log('❌ Could not find "Copy link" menu item');
      return;
    }
    
    log('✅ Found "Copy link" menu item, creating current slide option...');
    
    // Check if our option already exists (double-check)
    const existingOption = menu.querySelector('#current-slide-copy-option');
    if (existingOption) {
      log('ℹ️ Current slide option already exists in DOM, marking as injected');
      state.quickActionsInjected = true;
      return;
    }
    
    // Create new menu item for current slide
    const currentSlideItem = createQuickActionsMenuItem();
    
    // Insert after the "Copy link" item
    copyLinkItem.insertAdjacentElement('afterend', currentSlideItem);
    
    // Mark as injected
    state.quickActionsInjected = true;
    
    log('✅ Current slide option injected successfully - will not inject again');
  }

  /**
   * Create the "Copy current slide link" menu item for quick actions
   */
  function createQuickActionsMenuItem() {
    // Create the main menu item container
    const menuItem = document.createElement('div');
    menuItem.className = 'goog-menuitem scb-sqa-menuitem';
    menuItem.setAttribute('role', 'menuitem');
    menuItem.setAttribute('aria-disabled', 'false');
    menuItem.id = 'current-slide-copy-option';
    menuItem.style.userSelect = 'none';
    
    // Create menu item content
    const content = document.createElement('div');
    content.className = 'goog-menuitem-content';
    content.style.userSelect = 'none';
    
    // Create inner content structure
    const innerContent = document.createElement('div');
    innerContent.className = 'scb-sqa-menuitem-content apps-menuitem';
    innerContent.style.userSelect = 'none';
    
    // Create text element
    const textDiv = document.createElement('div');
    textDiv.style.userSelect = 'none';
    textDiv.textContent = 'Copy current slide link';
    
    // Create icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'goog-menuitem-icon scb-sqa-copy-link-icon-container';
    iconContainer.style.userSelect = 'none';
    
    // Create icon
    const icon = document.createElement('div');
    icon.className = 'scb-sqa-sprite apps-share-sprite scb-sqa-copy-link-icon';
    icon.style.userSelect = 'none';
    icon.innerHTML = '&nbsp;';
    
    // Assemble the structure
    iconContainer.appendChild(icon);
    innerContent.appendChild(textDiv);
    innerContent.appendChild(iconContainer);
    content.appendChild(innerContent);
    menuItem.appendChild(content);
    
    // Add click handler
    menuItem.addEventListener('click', createQuickActionsClickHandler(textDiv));
    
    // Add hover effects
    menuItem.addEventListener('mouseenter', () => {
      menuItem.classList.add('goog-menuitem-highlight');
    });
    
    menuItem.addEventListener('mouseleave', () => {
      menuItem.classList.remove('goog-menuitem-highlight');
    });
    
    return menuItem;
  }

  /**
   * Create click handler for quick actions menu item
   */
  function createQuickActionsClickHandler(textElement) {
    return async (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      log('🔗 Quick actions copy current slide button clicked!');
      
      try {
        let url;
        
        if (state.isShareIframe) {
          // We're in iframe, need to communicate with main frame
          url = await requestSlideUrlFromMainFrame();
        } else {
          // We're in main frame, can get URL directly
          url = buildSlideUrl({ mode: 'EDIT' });
        }
        
        await navigator.clipboard.writeText(url);
        
        log('✅ Current slide URL copied successfully from quick actions:', url);
        
        // Show Google-style "Link copied" tooltip
        showLinkCopiedTooltip();
        
        // Let Google handle menu closing naturally instead of forcing it
        // This prevents interference with Google's internal state management
        
      } catch (error) {
        log('❌ Error copying current slide URL from quick actions:', error);
      }
    };
  }

  /**
   * Show Google-style black tooltip with "Link copied" message
   */
  function showLinkCopiedTooltip() {
    // Remove any existing tooltip first
    const existingTooltip = document.getElementById('slide-url-copied-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    // Create the tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = 'slide-url-copied-tooltip';
    tooltip.textContent = 'Link copied';
    
    // Apply Google-style tooltip styling
    tooltip.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: #202124 !important;
      color: #ffffff !important;
      font-family: 'Google Sans', Roboto, Arial, sans-serif !important;
      font-size: 14px !important;
      font-weight: 400 !important;
      line-height: 1.4 !important;
      padding: 15px !important;
      border-radius: 5px !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24) !important;
      z-index: 10000000 !important;
      pointer-events: none !important;
      opacity: 0 !important;
      transition: opacity 0.15s ease-in-out !important;
      white-space: nowrap !important;
    `;
    
    // Add to page
    document.body.appendChild(tooltip);
    
    // Fade in
    setTimeout(() => {
      tooltip.style.opacity = '1';
    }, 10);
    
    // Fade out and remove after 2 seconds
    setTimeout(() => {
      tooltip.style.opacity = '0';
      setTimeout(() => {
        if (tooltip.parentNode) {
          tooltip.remove();
        }
      }, 200); // Wait for fade out animation
    }, 2000);
    
    log('📢 Showed "Link copied" tooltip');
  }

  // Start initialization
  earlyInit();
})();
