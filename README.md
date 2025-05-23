# Google Slides Current Slide URL Copier

A Chrome extension that adds a "Copy URL for Current Slide" button to the Google Slides share menu.

## Features

- Adds a button below the existing "Copy link" button in the Google Slides share menu
- Allows switching between "Edit Mode" and "Preview Mode" URLs
- Provides an option to specify a custom slide number
- Copies the URL to the clipboard and shows a confirmation message
- Integrates seamlessly with Google Slides' native UI

## Installation

1. Download or clone this repository to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension is now installed and ready to use

## Usage

1. Open a Google Slides presentation
2. Click the "Share" button in the top-right corner
3. Look for the "Copy URL for Current Slide" button below the "Copy link" button
4. Select your preferred URL mode (Edit or Preview)
5. Optionally enter a specific slide number, or leave blank to use the current slide
6. Click the button to copy the URL to your clipboard

## URL Formats

- **Edit Mode**: `https://docs.google.com/presentation/d/[deck_id]/edit?slide=0#slide=[slide_number]`
- **Preview Mode**: `https://docs.google.com/presentation/d/[deck_id]/preview?rm=minimal&slide=[slide_number]`

## Requirements

- Google Chrome browser
- Access to Google Slides presentations

## Troubleshooting

If the extension cannot detect the current slide:
1. Make sure you are on the slide you want to share
2. Try refreshing the page
3. Manually enter the slide number in the input field

## License

This project is licensed under the MIT License - see the LICENSE file for details. 