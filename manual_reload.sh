#!/bin/bash

echo "Simple manual reload script for Chrome extension"
echo "Press Enter to reload the extension each time you make a change"
echo "Press Ctrl+C to exit"
echo ""

while true; do
    read -r
    
    # Trigger extension reload in Chrome
    osascript -e '
      tell application "Google Chrome"
        activate
        tell application "System Events"
          keystroke "r" using {command down, shift down}
        end tell
      end tell
    '
    
    echo "Extension reloaded at $(date)"
done 