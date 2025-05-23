// Google Slides Current Slide URL Copier
// This script adds a persistent button at the top of Google Slides
// to copy the URL for the current slide

(() => {
  const DEBUG = true;
  const log = (...args) => DEBUG && console.log('[SlideURLCopier]', ...args);

  // URL generation modes
  const MODES = {
    EDIT: 'Edit',      // https://docs.google.com/presentation/d/ID/edit#slide=id.XX
    PREVIEW: 'Preview' // https://docs.google.com/presentation/d/ID/preview?rm=minimal&slide=XX
  };
  
  // Only run in the main window (not in iframes)
  if (window.self !== window.top) {
    log('Not in top frame, exiting');
    return;
  }
  
  log('Extension initialized in top frame:', location.href);
  
  // Wait for the page to fully load
  window.addEventListener('load', () => {
    log('Page loaded, adding button');
    addCopyButton();
  });
  
  /**
   * Adds a floating button to the top of the screen
   */
  function addCopyButton() {
    // Create container for our button
    const container = document.createElement('div');
    container.className = 'slide-url-copier-container';
    container.style.cssText = `
      position: fixed;
      top: 15px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      background: white;
      padding: 6px 10px;
      border-radius: 24px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
      font-size: 14px;
    `;
    
    // Create mode toggle
    const modeSelect = document.createElement('select');
    modeSelect.style.cssText = `
      border: none;
      background: transparent;
      font-size: 14px;
      color: #444;
      cursor: pointer;
      outline: none;
      padding: 0 4px;
    `;
    
    // Add options for our modes
    for (const [key, value] of Object.entries(MODES)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = value;
      modeSelect.appendChild(option);
    }
    
    // Create the copy button
    const button = document.createElement('button');
    button.textContent = 'Copy Slide URL';
    button.style.cssText = `
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 18px;
      padding: 6px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    
    // Hover effect
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = '#1765cc';
    });
    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = '#1a73e8';
    });
    
    // Status indicator for feedback
    const status = document.createElement('span');
    status.style.cssText = `
      opacity: 0;
      transition: opacity 0.3s;
      color: #1e8e3e;
      font-size: 13px;
      white-space: nowrap;
    `;
    
    // Add elements to container
    container.appendChild(modeSelect);
    container.appendChild(button);
    container.appendChild(status);
    
    // Add click handler
    button.addEventListener('click', async () => {
      try {
        const mode = modeSelect.value;
        const url = buildSlideUrl({ mode });
        
        log('Generated URL:', url);
        await navigator.clipboard.writeText(url);
        
        // Show success message
        status.textContent = 'Copied!';
        status.style.opacity = '1';
        
        // Hide after 2 seconds
        setTimeout(() => {
          status.style.opacity = '0';
        }, 2000);
        
      } catch (err) {
        log('Error copying URL:', err);
        status.textContent = 'Failed to copy';
        status.style.color = '#d93025';
        status.style.opacity = '1';
        
        setTimeout(() => {
          status.style.opacity = '0';
        }, 2000);
      }
    });
    
    // Add container to page
    document.body.appendChild(container);
    log('Button added to page');
  }
  
  /**
   * Build a permalink for the current slide
   */
  function buildSlideUrl({ mode = 'EDIT' }) {
    log('Building slide URL with mode:', mode);
    
    // Get presentation ID from URL
    const href = location.href;
    const idMatch = href.match(/\/presentation\/d\/([^/]+)/);
    
    if (!idMatch) {
      log('Could not extract presentation ID from URL');
      return href; // Fallback to current URL
    }
    
    const presentationId = idMatch[1];
    log('Extracted presentation ID:', presentationId);
    
    // Extract current slide number from URL hash
    let slideNumber = '0';
    // First check for format with "id." prefix
    const slideMatch = href.match(/#slide=id\.?([^&]+)/);
    
    if (slideMatch) {
      slideNumber = slideMatch[1];
      log('Extracted slide ID from URL:', slideNumber);
    } else {
      // Try alternate format (numeric slide)
      const altMatch = href.match(/#slide=(\d+)/);
      if (altMatch) {
        slideNumber = altMatch[1];
        log('Extracted slide number from URL:', slideNumber);
      }
    }
    
    // Build the appropriate URL based on mode
    let finalUrl;
    if (mode === 'PREVIEW') {
      // Preview mode uses g.XX or numeric value in the query parameter
      if (slideNumber.match(/^g[a-zA-Z0-9_-]+$/)) {
        // If it's a Google-generated ID (starts with 'g'), use as is
        finalUrl = `https://docs.google.com/presentation/d/${presentationId}/preview?rm=minimal&slide=id.${slideNumber}`;
      } else if (!isNaN(parseInt(slideNumber))) {
        // If it's a numeric slide, use without id. prefix
        finalUrl = `https://docs.google.com/presentation/d/${presentationId}/preview?rm=minimal&slide=${slideNumber}`;
      } else {
        // For other formats, include the id. prefix
        finalUrl = `https://docs.google.com/presentation/d/${presentationId}/preview?rm=minimal&slide=id.${slideNumber}`;
      }
    } else {
      // Edit mode always uses #slide=id.XX format
      finalUrl = `https://docs.google.com/presentation/d/${presentationId}/edit#slide=id.${slideNumber}`;
    }
    
    log('Final URL generated:', finalUrl);
    return finalUrl;
  }
})();
