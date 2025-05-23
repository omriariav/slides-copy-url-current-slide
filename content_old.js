// Constants
const MODES = {
  EDIT: 'Edit Mode',
  PREVIEW: 'Preview Mode'
};

// Initialize the extension
function initExtension() {
  console.log('[Slides URL Copier] Extension initialized');
  
  // Listen for clicks on the Share button
  document.addEventListener('click', function(event) {
    if (!event.target) return;
    
    // Check if the clicked element or its parent contains "Share" text
    const target = event.target;
    const isShareButton = 
      (target.textContent?.includes('Share') || 
       target.innerText?.includes('Share') ||
       target.parentElement?.textContent?.includes('Share'));
    
    if (isShareButton) {
      console.log('[Slides URL Copier] Share button clicked');
      
      // Wait for the dialog to open and the "Copy link" element to appear
      const checkForCopyLink = () => {
        const copyLinkElements = Array.from(document.querySelectorAll('button, span'))
          .filter(el => el.textContent?.includes('Copy link'));
        
        if (copyLinkElements.length > 0) {
          console.log('[Slides URL Copier] Found "Copy link" element');
          const copyLinkElement = copyLinkElements[0];
          
          // Check if our button already exists to avoid duplicates
          if (!document.getElementById('copy-slide-url-button')) {
            injectCopyButton(copyLinkElement.parentElement);
          }
        } else {
          // Retry in 100ms if not found
          setTimeout(checkForCopyLink, 100);
        }
      };
      
      // Start checking for the Copy link button
      setTimeout(checkForCopyLink, 200);
    }
  });
  
  // Also watch for dialog elements (as a backup method)
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node.getAttribute('role') === 'dialog' || node.querySelector?.('[role="dialog"]'))) {
            
            // Check if our button already exists
            if (!document.getElementById('copy-slide-url-button')) {
              // Wait a moment for the dialog contents to be fully rendered
              setTimeout(() => {
                const copyLinkElements = Array.from(document.querySelectorAll('button, span'))
                  .filter(el => el.textContent?.includes('Copy link'));
                
                if (copyLinkElements.length > 0) {
                  injectCopyButton(copyLinkElements[0].parentElement);
                }
              }, 200);
            }
          }
        }
      }
    }
  });
  
  // Start observing the document body
  observer.observe(document.body, { childList: true, subtree: true });
}

// Create and inject our custom button
function injectCopyButton(container) {
  if (!container) return;
  console.log('[Slides URL Copier] Adding button next to "Copy link"');
  
  // Create our custom elements
  const customContainer = document.createElement('div');
  customContainer.className = 'copy-slide-url-container';
  
  // Create the copy button
  const copyButton = document.createElement('button');
  copyButton.id = 'copy-slide-url-button';
  copyButton.className = 'copy-slide-url-button';
  copyButton.textContent = 'Copy URL for Current Slide';
  copyButton.setAttribute('aria-label', 'Copy URL for current slide');
  
  // Create mode selector
  const modeContainer = document.createElement('div');
  modeContainer.className = 'mode-selector-container';
  
  const modeLabel = document.createElement('span');
  modeLabel.textContent = 'URL Type:';
  modeLabel.className = 'mode-label';
  
  const modeSelector = document.createElement('select');
  modeSelector.id = 'url-mode-selector';
  modeSelector.className = 'url-mode-selector';
  
  // Add options to the mode selector
  Object.values(MODES).forEach(mode => {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode;
    modeSelector.appendChild(option);
  });
  
  modeContainer.appendChild(modeLabel);
  modeContainer.appendChild(modeSelector);
  
  // Create slide number input
  const slideContainer = document.createElement('div');
  slideContainer.className = 'slide-input-container';
  
  const slideLabel = document.createElement('span');
  slideLabel.textContent = 'Slide Number (optional):';
  slideLabel.className = 'slide-label';
  
  const slideInput = document.createElement('input');
  slideInput.type = 'number';
  slideInput.id = 'slide-number-input';
  slideInput.className = 'slide-number-input';
  slideInput.min = '1';
  slideInput.placeholder = 'Current slide';
  
  slideContainer.appendChild(slideLabel);
  slideContainer.appendChild(slideInput);
  
  // Create status message element
  const statusMessage = document.createElement('div');
  statusMessage.id = 'copy-status-message';
  statusMessage.className = 'copy-status-message';
  
  // Add everything to the container
  customContainer.appendChild(copyButton);
  customContainer.appendChild(modeContainer);
  customContainer.appendChild(slideContainer);
  customContainer.appendChild(statusMessage);
  
  // Try to add the button in the DOM
  try {
    // Try to insert after the container (sibling)
    container.after(customContainer);
  } catch (error) {
    try {
      // Try to append as a child
      container.appendChild(customContainer);
    } catch (error2) {
      try {
        // Try parent's parent as a last resort
        const parent = container.parentElement;
        if (parent) {
          parent.appendChild(customContainer);
        }
      } catch (error3) {
        console.error('[Slides URL Copier] Failed to add button:', error3);
      }
    }
  }
  
  // Add event listener to the copy button
  copyButton.addEventListener('click', handleCopyButtonClick);
}

// Function to handle the copy button click
async function handleCopyButtonClick() {
  try {
    const url = await generateSlideUrl();
    await navigator.clipboard.writeText(url);
    showStatusMessage('Link copied!', 'success');
  } catch (error) {
    console.error('[Slides URL Copier] Error:', error);
    showStatusMessage('Unable to copy link. ' + error.message, 'error');
  }
}

// Function to generate the URL for the current slide
async function generateSlideUrl() {
  const currentUrl = window.location.href;
  
  const mode = document.getElementById('url-mode-selector').value;
  
  // Extract the deck ID from the URL
  const deckIdMatch = currentUrl.match(/\/presentation\/d\/([^/]+)/);
  if (!deckIdMatch) {
    throw new Error('Unable to detect presentation ID');
  }
  const deckId = deckIdMatch[1];
  
  // Get slide number from input or detect from URL
  let slideNumber = document.getElementById('slide-number-input').value;
  
  if (!slideNumber) {
    // Try to extract the slide number from the URL
    slideNumber = await detectCurrentSlideNumber();
  }
  
  // Generate the appropriate URL based on the selected mode
  if (mode === MODES.EDIT) {
    return `https://docs.google.com/presentation/d/${deckId}/edit?slide=0#slide=${slideNumber}`;
  } else { // Preview mode
    return `https://docs.google.com/presentation/d/${deckId}/preview?rm=minimal&slide=${slideNumber}`;
  }
}

// Function to detect the current slide number
async function detectCurrentSlideNumber() {
  // Try to get the slide number from the URL - simplest approach first
  const currentUrl = window.location.href;
  
  // Check for #slide=number pattern
  const simpleMatch = currentUrl.match(/#slide=(\d+)/);
  if (simpleMatch) {
    return simpleMatch[1];
  }
  
  // Try to extract slide ID if present
  const slideIdMatch = currentUrl.match(/#slide=id\.([^&]+)/);
  if (slideIdMatch) {
    // We found the slide ID, but we'll return 0 as a simple fallback
  }
  
  // Default to slide 0
  return 0;
}

// Function to show status messages
function showStatusMessage(message, type) {
  const statusElement = document.getElementById('copy-status-message');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `copy-status-message ${type}`;
    
    // Clear the message after a few seconds
    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'copy-status-message';
    }, 3000);
  }
}

// Start the extension
initExtension(); 