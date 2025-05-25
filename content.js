// Google Slides Current Slide URL Copier - Enhanced Version
// Inspired by Grammarly's injection strategies

(() => {
  const DEBUG = false;
  const PRODUCTION = true; // Set to true before uploading to Chrome Store
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
      log('⚠️ Extension already initialized, skipping duplicate initialization');
      return;
    }
    
    log('🚀 Main initialization starting...');
    
    // Set up message handling between frames
    if (!state.isInIframe) {
      // Main frame - set up message handler for iframe communication
      setupMainFrameMessageHandler();
    }
    
    // Different initialization based on frame type
    if (state.isShareIframe) {
      // We're in the share iframe - Quick Actions menu not available here
      log('🎯 Share iframe detected - Quick Actions menu not available');
    } else if (!state.isInIframe) {
      // We're in the main frame - set up Quick Actions menu
      log('🎯 Main frame detected - setting up Quick Actions menu');
      
      waitForSlidesReady()
        .then(() => {
          log('Google Slides ready in main frame');
          state.isReady = true;
          
          // Set up slide change monitoring
          monitorSlideChanges();
          
          // Set up Quick Actions menu detection
          setupQuickActionsMenuDetection();
          
          // Proactive menu injection
          scanForExistingQuickActionsMenu();
          
          // Delayed scan for menu injection
          setTimeout(() => {
            if (!state.quickActionsInjected) {
              log('🔄 Delayed scan for Quick Actions menu...');
              scanForExistingQuickActionsMenu();
            }
          }, 1000);
        })
        .catch(err => {
          log('Error during initialization:', err);
        });
    } else {
      // We're in some other iframe - just monitor
      verboseLog('🔍 Other iframe detected - monitoring only');
    }
    
    // Mark as initialized
    state.isInitialized = true;
    log('✅ Extension initialized');
  }
  
  /**
   * Setup message handler in main frame to respond to iframe requests
   */
  function setupMainFrameMessageHandler() {
    log('📡 Setting up main frame message handler...');
    
    window.addEventListener('message', (event) => {
      // Only handle messages from our iframe
      if (event.data && event.data.type === 'GET_SLIDE_URL') {
        log('📨 Received slide URL request from iframe:', event.data);
        
        try {
          // Use the requested mode and export format
          const url = buildSlideUrl({ 
            mode: event.data.mode || 'EDIT',
            exportFormat: event.data.exportFormat || null
          });
          
          log('📤 Sending slide URL to iframe:', url);
          
          // Send URL back to iframe
          event.source.postMessage({
            type: 'SLIDE_URL_RESPONSE',
            url: url,
            mode: event.data.mode || 'EDIT',
            exportFormat: event.data.exportFormat || null
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
              // Dialog detection removed - focusing on Quick Actions menu only
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
    // Basic checks for Google Slides
    const hasPresentation = /\/presentation\/d\//.test(location.href);
    const hasSlideElements = document.querySelector('[role="main"]') || 
                             document.querySelector('.punch-present-edit-mode') ||
                             document.querySelector('#docs-chrome');
    
    return hasPresentation && hasSlideElements;
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
            // Dialog detection removed - focusing on Quick Actions menu only
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
   * Enhanced URL building - supports edit, demo, presentation, mobile modes and export formats
   */
  function buildSlideUrl({ mode = 'EDIT', exportFormat = null } = {}) {
    log('Building slide URL with mode:', mode, 'export:', exportFormat);
    
    const href = location.href;
    const idMatch = href.match(/\/presentation\/d\/([^/]+)/);
    
    if (!idMatch) {
      log('Could not extract presentation ID from URL');
      return href;
    }
    
    const presentationId = idMatch[1];
    let slideNumber = getCurrentSlideId();
    
    log('Presentation ID:', presentationId, 'Slide ID:', slideNumber);
    
    let finalUrl;
    
    if (exportFormat) {
      // Export formats - downloads the current slide
      finalUrl = `https://docs.google.com/presentation/d/${presentationId}/export?format=${exportFormat}&slide=${slideNumber}`;
    } else {
      // Viewing modes
      switch (mode) {
        case 'DEMO':
          finalUrl = `https://docs.google.com/presentation/d/${presentationId}/edit?rm=demo#slide=id.${slideNumber}`;
          break;
        case 'PRESENT':
          finalUrl = `https://docs.google.com/presentation/d/${presentationId}/present#slide=id.${slideNumber}`;
          break;
        case 'MOBILE':
          finalUrl = `https://docs.google.com/presentation/d/${presentationId}/mobilepresent#slide=id.${slideNumber}`;
          break;
        case 'EDIT':
        default:
          finalUrl = `https://docs.google.com/presentation/d/${presentationId}/edit#slide=id.${slideNumber}`;
          break;
      }
    }
    
    log('Final URL generated:', finalUrl);
    return finalUrl;
  }
  
  /**
   * Set up quick actions menu detection - Main feature
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
   * Inject multiple slide options into quick actions menu
   */
  function injectCurrentSlideOption(menu) {
    log('🚀 Injecting multiple slide options into quick actions menu...');
    
    // Check if we've already injected
    if (state.quickActionsInjected) {
      log('ℹ️ Quick actions options already injected, skipping...');
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
    
    log('✅ Found "Copy link" menu item, creating slide options...');
    
    // Check if our options already exist (double-check)
    const existingOption = menu.querySelector('#current-slide-copy-option');
    if (existingOption) {
      log('ℹ️ Current slide options already exist in DOM, marking as injected');
      state.quickActionsInjected = true;
      return;
    }
    
    // Create multiple menu items
    const menuOptions = [
      { id: 'current-slide-copy-option', text: 'Copy current slide link', mode: 'EDIT' },
      { id: 'current-slide-demo-option', text: 'Copy current slide demo link', mode: 'DEMO' },
      { id: 'current-slide-present-option', text: 'Copy current slide presentation link', mode: 'PRESENT' },
      { id: 'current-slide-mobile-option', text: 'Copy current slide mobile link', mode: 'MOBILE' },
      { id: 'current-slide-export-png', text: 'Export current slide as PNG', exportFormat: 'png' },
      { id: 'current-slide-export-pdf', text: 'Export current slide as PDF', exportFormat: 'pdf' }
    ];
    
    let lastInsertedItem = copyLinkItem;
    
    // Create and insert each menu item
    for (const option of menuOptions) {
      const menuItem = createQuickActionsMenuItem(option);
      lastInsertedItem.insertAdjacentElement('afterend', menuItem);
      lastInsertedItem = menuItem;
    }
    
    // Mark as injected
    state.quickActionsInjected = true;
    
    log('✅ All slide options injected successfully - will not inject again');
  }

  /**
   * Create menu item for quick actions with appropriate icon
   */
  function createQuickActionsMenuItem(option) {
    // Create the main menu item container
    const menuItem = document.createElement('div');
    menuItem.className = 'goog-menuitem scb-sqa-menuitem';
    menuItem.setAttribute('role', 'menuitem');
    menuItem.setAttribute('aria-disabled', 'false');
    menuItem.id = option.id;
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
    textDiv.textContent = option.text;
    
    // Create icon container
    const iconContainer = document.createElement('div');
    if (option.exportFormat) {
      // For export options, use minimal container styling
      iconContainer.className = '';
    } else {
      // For copy options, use Google's standard icon container classes
      iconContainer.className = 'goog-menuitem-icon scb-sqa-copy-link-icon-container';
    }
    iconContainer.style.userSelect = 'none';
    
    // Create icon for each option type
    const icon = document.createElement('div');
    icon.style.userSelect = 'none';
    
    if (option.exportFormat) {
      // Use Google's download icon structure for export options
      icon.className = 'docs-icon goog-inline-block goog-menuitem-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.style.userSelect = 'none !important';
      icon.style.opacity = '1 !important';
      icon.innerHTML = `
        <div class="docs-icon-img-container docs-icon-img docs-icon-editors-ia-download" style="user-select: none;opacity: 1;">
        </div>
      `;
    } else {
      // Use Google's original sprite class for copy options
      icon.className = 'scb-sqa-sprite apps-share-sprite scb-sqa-copy-link-icon';
      icon.innerHTML = '&nbsp;';
    }
    
    // Assemble the structure
    iconContainer.appendChild(icon);
    innerContent.appendChild(textDiv);
    innerContent.appendChild(iconContainer);
    content.appendChild(innerContent);
    menuItem.appendChild(content);
    
    // Add click handler
    menuItem.addEventListener('click', createQuickActionsClickHandler(textDiv, option.mode, option.exportFormat));
    
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
  function createQuickActionsClickHandler(textElement, mode, exportFormat) {
    return async (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      log('🔗 Quick actions option clicked:', { mode, exportFormat });
      
      try {
        let url;
        
        if (state.isShareIframe) {
          // We're in iframe, need to communicate with main frame
          url = await requestSlideUrlFromMainFrame(mode, exportFormat);
        } else {
          // We're in main frame, can get URL directly
          url = buildSlideUrl({ mode: mode, exportFormat: exportFormat });
        }
        
        if (exportFormat) {
          // For exports, open the download URL in a new tab
          window.open(url, '_blank');
          showLinkCopiedTooltip(`${exportFormat.toUpperCase()} export started`);
          log('✅ Export started successfully:', url);
        } else {
          // For copy actions, copy to clipboard
          await navigator.clipboard.writeText(url);
          showLinkCopiedTooltip('Link copied');
          log('✅ Link copied successfully:', url);
        }
        
        // Let Google handle menu closing naturally instead of forcing it
        // This prevents interference with Google's internal state management
        
      } catch (error) {
        log('❌ Error handling quick actions option:', error);
        showLinkCopiedTooltip('Error occurred');
      }
    };
  }

  /**
   * Promise-based iframe communication
   */
  function requestSlideUrlFromMainFrame(mode = 'EDIT', exportFormat = null) {
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
        mode: mode,
        exportFormat: exportFormat
      }, '*');
    });
  }

  /**
   * Show Google-style black tooltip with customizable message
   */
  function showLinkCopiedTooltip(message = 'Link copied') {
    // Remove any existing tooltip first
    const existingTooltip = document.getElementById('slide-url-copied-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    // Create the tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = 'slide-url-copied-tooltip';
    tooltip.textContent = message;
    
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
    
    log('📢 Showed tooltip:', message);
  }

  // Start initialization
  earlyInit();
})();
