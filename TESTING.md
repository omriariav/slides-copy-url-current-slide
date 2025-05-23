# Testing and Debugging Guide

This document provides steps to test and debug the Google Slides Current Slide URL Copier extension.

## Loading the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" using the toggle in the top-right corner
3. Click "Load unpacked" and select the folder containing all the extension files
4. The extension should appear in the list with its icon

## Testing in Google Slides

1. Open a Google Slides presentation (any presentation will work)
2. Click the "Share" button in the top-right corner
3. Look for the "Copy URL for Current Slide" button below the "Copy link" button
4. If the button doesn't appear, follow the debugging steps below

## Debugging Using Chrome DevTools

### Method 1: Debug the Extension

1. On the Chrome extensions page (`chrome://extensions/`), click "Details" for the extension
2. Scroll down and click "service worker" under "Inspect views"
3. In the DevTools window that opens, go to the "Console" tab
4. Look for any error messages or debug logs

### Method 2: Debug on the Google Slides Page

1. Open a Google Slides presentation
2. Right-click anywhere on the page and select "Inspect" (or press Cmd+Option+I on Mac, Ctrl+Shift+I on Windows)
3. In DevTools, go to the "Console" tab
4. Look for logs with the prefix `[Google Slides URL Copier]`
5. Check for any error messages

### Method 3: Using the Debug Script

If the extension isn't working properly, you can try using the debug script:

1. Open a Google Slides presentation and open the share dialog
2. Open DevTools (right-click > Inspect)
3. Go to the "Console" tab
4. Copy and paste the entire contents of the `debug.js` file into the console
5. Press Enter to run the script
6. The script will try to add a debug button and will log helpful information
7. If successful, you'll see a "Copy URL for Current Slide (Debug)" button

## Common Issues and Solutions

### Button Not Showing Up

1. **Issue**: The selector for the share dialog might have changed.
   **Solution**: Try the debug script to find the correct selector.

2. **Issue**: The mutation observer isn't detecting the share dialog.
   **Solution**: Try refreshing the page or reopening the share dialog.

3. **Issue**: Content script permissions issue.
   **Solution**: Make sure the manifest.json has the correct permissions and matches.

### Error When Copying URL

1. **Issue**: Unable to detect the current slide.
   **Solution**: Try manually entering a slide number in the input field.

2. **Issue**: Clipboard permission issue.
   **Solution**: Make sure the manifest.json includes the "clipboardWrite" permission.

## Testing Different Scenarios

1. **Different slide types**: Test with regular slides, section headers, and any special slide types
2. **URL formats**: Test both Edit and Preview modes
3. **Manual slide number**: Enter a custom slide number and verify it works
4. **Different Google Slides themes**: Light and dark themes (if available)
5. **RTL language support**: Change your Google interface to a right-to-left language if possible

## Reporting Issues

When reporting issues, please include:

1. A screenshot of the share dialog
2. The console logs from DevTools
3. The URL of the Google Slides presentation (if it's public)
4. Steps to reproduce the issue

## Quick Fix: Manual Selector Update

If you've identified a new selector for the share dialog, you can manually update the `content.js` file:

1. Find the line with `const specificContainer = document.querySelector("#c690 > div > div > div > div > div > div.asdCEb > div > div:nth-child(2) > div > div:nth-child(2) > div > div > div > div:nth-child(3) > div > div > div.IRwzcb");`
2. Replace it with the new selector
3. Reload the extension in Chrome 