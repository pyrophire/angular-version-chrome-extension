# Phire Angular Version Inspector

A Chrome extension to quickly identify the Angular version of the current web page.

## Features
- Detects the Angular version of modern Angular applications (v2+).
- Displays the version in a clear popup.
- Simple and lightweight.

## Repository Structure
- `src/`: Source files for the extension (manifest, scripts, assets).
- `dist/`: Generated distribution files (zipped extension).

## Development

### Loading the Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked**.
4. Select the `src/` folder in this repository.

### Packaging for Release
To create a fresh `.zip` file for the Chrome Web Store:
```bash
npm run package
```
The resulting file will be located at `dist/phire-angular-version-extension.zip`.

## How it Works
The extension uses a content script to inspect the DOM of the active tab. It looks for the `ng-version` attribute on the application's root element (typically found on the child of the `<body>` tag).

## License
ISC
