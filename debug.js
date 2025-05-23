/**
 * Debug script for Google Slides Current Slide URL Copier
 * 
 * Copy and paste this entire script into the Chrome DevTools console
 * when you have the Google Slides share dialog open.
 * Test
 */

(function() {
  // Test function to inject the button
  function testInjectButton() {
    console.log('Testing button injection...');
    
    // Try various selectors (from most specific to most general)
    const selectors = [
      // The specific selector provided by the user
      "#c690 > div > div > div > div > div > div.asdCEb > div > div:nth-child(2) > div > div:nth-child(2) > div > div > div > div:nth-child(3) > div > div > div.IRwzcb",
      // More general selectors that might work
      ".IRwzcb",
      ".asdCEb div:has(.tP8Ief)",
      "[data-share-client-type] div:has(button:contains('Copy link'))",
      // Last resort - any dialog with copy link
      "[role='dialog']:contains('Copy link')"
    ];
    
    let container = null;
    
    // Try each selector in order
    for (const selector of selectors) {
      try {
        console.log(`Trying selector: ${selector}`);
        container = document.querySelector(selector);
        if (container) {
          console.log(`Found container with selector: ${selector}`, container);
          break;
        }
      } catch (error) {
        console.warn(`Error with selector "${selector}":`, error);
      }
    }
    
    if (!container) {
      console.error('Container not found with predefined selectors. Trying alternative methods...');
      
      // Try to find by looking for the "Copy link" button
      const buttons = Array.from(document.querySelectorAll('button'));
      const copyLinkButtons = buttons.filter(btn => btn.textContent.includes('Copy link'));
      
      if (copyLinkButtons.length > 0) {
        console.log('Found "Copy link" button:', copyLinkButtons[0]);
        
        // First try to get a parent with class IRwzcb
        let parent = copyLinkButtons[0].parentElement;
        let irwzcbParent = null;
        
        while (parent) {
          if (parent.classList.contains('IRwzcb')) {
            irwzcbParent = parent;
            break;
          }
          parent = parent.parentElement;
        }
        
        if (irwzcbParent) {
          console.log('Found IRwzcb parent container:', irwzcbParent);
          container = irwzcbParent;
        } else {
          // If no IRwzcb parent, use the direct parent
          console.log('Using direct parent of Copy link button');
          container = copyLinkButtons[0].parentElement;
        }
      } else {
        // Last resort - try to find any dialog
        const dialogs = document.querySelectorAll('[role="dialog"]');
        if (dialogs.length > 0) {
          console.log(`Found ${dialogs.length} dialogs, using the first one as container`);
          container = dialogs[0];
        }
      }
    }
    
    if (container) {
      // Show information about the found container
      console.log(`Container found: ${container.tagName}.${Array.from(container.classList).join('.')}`);
      console.log('Parent structure:', getParentChain(container));
      
      // Create and add the button
      createButton(container);
      
      // For easier debugging, add a global reference
      window.debugContainer = container;
      console.log('Container is available as "debugContainer" variable');
    } else {
      console.error('No suitable container found. Make sure the share dialog is open.');
      alert('Could not find a suitable container for the button. Make sure the share dialog is open.');
    }
  }
  
  // Helper function to get a readable description of the parent chain
  function getParentChain(element, maxDepth = 5) {
    const chain = [];
    let current = element;
    let depth = 0;
    
    while (current && depth < maxDepth) {
      const classes = Array.from(current.classList).join('.');
      const entry = {
        tag: current.tagName.toLowerCase(),
        classes: classes ? `.${classes}` : '',
        id: current.id ? `#${current.id}` : '',
        role: current.getAttribute('role') || ''
      };
      
      chain.push(`${entry.tag}${entry.id}${entry.classes}${entry.role ? `[role="${entry.role}"]` : ''}`);
      current = current.parentElement;
      depth++;
    }
    
    return chain;
  }
  
  // Create and inject the button
  function createButton(container) {
    // Check if button already exists
    if (document.getElementById('debug-slide-url-button')) {
      console.log('Debug button already exists, removing it first');
      document.getElementById('debug-slide-url-button').parentElement.remove();
    }
    
    // Create container for all our elements
    const customContainer = document.createElement('div');
    customContainer.style.marginTop = '16px';
    customContainer.style.padding = '12px';
    customContainer.style.borderTop = '1px solid #e0e0e0';
    customContainer.style.display = 'flex';
    customContainer.style.flexDirection = 'column';
    customContainer.style.gap = '12px';
    
    // Create button
    const button = document.createElement('button');
    button.id = 'debug-slide-url-button';
    button.textContent = 'Copy URL for Current Slide (Debug)';
    button.style.backgroundColor = 'transparent';
    button.style.border = '1px solid #dadce0';
    button.style.borderRadius = '24px';
    button.style.padding = '8px 16px';
    button.style.fontFamily = '"Google Sans", Roboto, sans-serif';
    button.style.fontSize = '14px';
    button.style.color = '#1a73e8';
    button.style.cursor = 'pointer';
    button.style.alignSelf = 'flex-start';
    
    // Create status message element
    const statusMessage = document.createElement('div');
    statusMessage.id = 'debug-status-message';
    statusMessage.style.fontFamily = 'Roboto, sans-serif';
    statusMessage.style.fontSize = '14px';
    statusMessage.style.height = '20px';
    
    // Add click handler
    button.addEventListener('click', () => {
      const currentUrl = window.location.href;
      console.log('Current URL:', currentUrl);
      
      const deckIdMatch = currentUrl.match(/\/presentation\/d\/([^/]+)/);
      const deckId = deckIdMatch ? deckIdMatch[1] : 'unknown';
      console.log('Deck ID:', deckId);
      
      // Try to get slide number from various sources
      let slideNumber = '0';
      
      // First try #slide=id pattern
      const slideIdMatch = currentUrl.match(/#slide=id\.([^_]+(?:_\d+)+)/);
      if (slideIdMatch) {
        console.log('Found slide ID in URL:', slideIdMatch[1]);
      }
      
      // Then try #slide=number pattern
      const slideNumberMatch = currentUrl.match(/#slide=(\d+)/);
      if (slideNumberMatch) {
        slideNumber = slideNumberMatch[1];
        console.log('Found slide number in URL:', slideNumber);
      }
      
      // Create the URL
      const url = `https://docs.google.com/presentation/d/${deckId}/edit?slide=0#slide=${slideNumber}`;
      console.log('Generated URL:', url);
      
      // Copy to clipboard
      navigator.clipboard.writeText(url).then(() => {
        statusMessage.textContent = 'URL copied!';
        statusMessage.style.color = '#1e8e3e';
        console.log('URL copied to clipboard');
        
        setTimeout(() => {
          statusMessage.textContent = '';
        }, 3000);
      }).catch(err => {
        console.error('Error copying URL:', err);
        statusMessage.textContent = 'Error copying URL';
        statusMessage.style.color = '#d93025';
      });
    });
    
    // Add everything to the container
    customContainer.appendChild(button);
    customContainer.appendChild(statusMessage);
    
    // Try different ways to add the button to the container
    let added = false;
    
    // Method 1: Try to append as child
    try {
      container.appendChild(customContainer);
      console.log('Button added as child');
      added = true;
    } catch (error) {
      console.warn('Could not add as child:', error);
      
      // Method 2: Try to add after the container
      try {
        container.after(customContainer);
        console.log('Button added after container');
        added = true;
      } catch (error2) {
        console.warn('Could not add after container:', error2);
        
        // Method 3: Try parent element
        if (container.parentElement) {
          try {
            container.parentElement.appendChild(customContainer);
            console.log('Button added to parent element');
            added = true;
          } catch (error3) {
            console.warn('Could not add to parent element:', error3);
          }
        }
      }
    }
    
    if (!added) {
      // Last resort - add to body
      document.body.appendChild(customContainer);
      console.log('Button added to body (last resort)');
      customContainer.style.position = 'fixed';
      customContainer.style.bottom = '10px';
      customContainer.style.right = '10px';
      customContainer.style.backgroundColor = 'white';
      customContainer.style.zIndex = '9999';
      customContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      customContainer.style.borderRadius = '8px';
    }
  }
  
  // Run the test
  testInjectButton();
  
  console.log('To try again, call testInjectButton() function');
  window.testInjectButton = testInjectButton;
})(); 