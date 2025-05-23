#!/bin/bash

echo "This script automatically reloads the Chrome extension for Google Slides."
echo "Make sure Chrome is running and the extension is loaded in developer mode."
echo "Press Ctrl+C to exit."
echo ""

# Use the provided extension ID
EXTENSION_ID="fokbcpofpfkjnboebfbbpegnhhnklgfo"

echo "Using extension ID: $EXTENSION_ID"

# Check if fswatch is installed
if ! command -v fswatch &> /dev/null; then
    echo "fswatch is not installed. This is needed to watch for file changes."
    echo "To install fswatch, run: brew install fswatch"
    echo ""
    echo "If you don't have Homebrew installed, run this first:"
    echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    echo ""
    echo "Do you want to continue with manual reload instead? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Continuing with manual reload. Press Enter to reload the extension after making changes."
        
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
    else
        exit 1
    fi
else
    echo "Watching for changes..."
    
    # Watch for changes to content.js and styles.css
    while true; do
        fswatch -1 content.js styles.css
        
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
        sleep 1
    done
fi 