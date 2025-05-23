// Self-executing function to find share dialog elements
(function() {
    console.log("=== SLIDES SHARE DIALOG DETECTION QUERY ===");
    
    // Find dialogs
    const dialogs = document.querySelectorAll('[role="dialog"]');
    console.log(`Found ${dialogs.length} dialog(s) in the DOM`);
    
    // Test each dialog
    dialogs.forEach((dialog, index) => {
      console.log(`\n----- DIALOG ${index + 1} -----`);
      console.log("Dialog element:", dialog);
      
      // Text content check
      const text = dialog.textContent || '';
      const hasShareText = text.includes('Share');
      const hasAccessText = text.includes('with access');
      console.log(`Contains "Share" text: ${hasShareText}`);
      console.log(`Contains "with access" text: ${hasAccessText}`);
      
      // Check for specific heading
      console.log("\n-- HEADING CHECKS --");
      
      // Test different selectors for the Share heading
      const headingSelectors = [
        'h2.zv7tnb', 
        'h2#Pnsjpd', 
        'h2[aria-label^="Share"]',
        'h2:contains("Share")',  // jQuery-style selector, won't work directly
        'h1, h2, h3'  // Any heading
      ];
      
      headingSelectors.forEach(selector => {
        try {
          const elements = dialog.querySelectorAll(selector);
          console.log(`Selector "${selector}": ${elements.length} elements found`);
          if (elements.length > 0) {
            Array.from(elements).forEach((el, i) => {
              console.log(`  Element ${i+1}: `, el);
              console.log(`  Text content: "${el.textContent}"`);
              console.log(`  Contains "Share": ${el.textContent.includes('Share')}`);
            });
          }
        } catch (e) {
          console.log(`Selector "${selector}" error:`, e.message);
        }
      });
      
      // Find all headings with "Share" text
      const allHeadings = dialog.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const shareHeadings = Array.from(allHeadings).filter(h => h.textContent.includes('Share'));
      console.log(`\nAll headings with "Share" text:`, shareHeadings);
      
      // Check for "with access" elements
      console.log("\n-- ACCESS CHECKS --");
      
      // Test different selectors for the access text
      const accessSelectors = [
        'div.ifDqI', 
        'div[aria-hidden="true"]',
        'div.XQE5Vb'  // Another class to try
      ];
      
      accessSelectors.forEach(selector => {
        try {
          const elements = dialog.querySelectorAll(selector);
          console.log(`Selector "${selector}": ${elements.length} elements found`);
          if (elements.length > 0) {
            Array.from(elements).forEach((el, i) => {
              console.log(`  Element ${i+1}: `, el);
              console.log(`  Text content: "${el.textContent}"`);
              console.log(`  Contains "with access": ${el.textContent.includes('with access')}`);
            });
          }
        } catch (e) {
          console.log(`Selector "${selector}" error:`, e.message);
        }
      });
      
      // Find all divs with "with access" text
      const allDivs = dialog.querySelectorAll('div');
      const accessDivs = Array.from(allDivs).filter(div => div.textContent.includes('with access'));
      console.log(`\nAll divs with "with access" text:`, accessDivs);
      if (accessDivs.length > 0) {
        console.log("First parent:", accessDivs[0].parentElement);
        console.log("Second parent:", accessDivs[0].parentElement?.parentElement);
        console.log("Third parent:", accessDivs[0].parentElement?.parentElement?.parentElement);
      }
      
      // Find potential injection points
      console.log("\n-- POTENTIAL INJECTION POINTS --");
      const buttonSections = Array.from(dialog.querySelectorAll('div')).filter(div => div.querySelectorAll('button').length > 0);
      console.log(`Found ${buttonSections.length} sections with buttons`);
      if (buttonSections.length > 0) {
        console.log("Last button section:", buttonSections[buttonSections.length - 1]);
      }
      
      // Common container classes
      const containers = dialog.querySelectorAll('.IRwzcb, .asdCEb, [role="group"]');
      console.log(`Found ${containers.length} common container elements`);
      if (containers.length > 0) {
        console.log("Last container:", containers[containers.length - 1]);
      }
    });
  })();