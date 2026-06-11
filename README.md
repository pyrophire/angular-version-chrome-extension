# Phire Angular Version Inspector

A Chrome extension to quickly identify the Angular version of the current web page.

## Features
- Detects the Angular version of modern Angular applications (v2+).
- Detects AngularJS (1.x) pages and reports them separately.
- Uses multiple fallback strategies with confidence levels.
- Displays the version in a clear popup.
- Shows runtime hints: likely dev/prod mode, SSR/hydration signals, Zone.js presence.
- Surfaces dependency hints for RxJS, Angular Material, and NgRx.
- Highlights risk warnings for legacy versions and policy baseline mismatches.
- Provides one-click copy options for JSON report, text summary, and issue snippet.
- Provides optional anonymized export mode for safer sharing.
- Includes a cross-window multi-tab dashboard with local/staging/production filtering.
- Auto-refreshes when tab changes or navigation completes.
- Shows toolbar badge with detected major version (for example A17) or NG1 for AngularJS.
- Includes an Angular docs shortcut based on detected major version.
- Adds a DevTools panel for raw diagnostics while debugging.

## Repository Structure
- `src/`: Source files for the extension (manifest, scripts, assets).
- `dist/`: Generated distribution files (zipped extension).

## Development

### Popup Status States
- Scanning active tab
- Angular detected
- AngularJS detected
- Not an Angular page
- Restricted/blocked page (no content script access)

### Loading the Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked**.
4. Select the `src/` folder in this repository.

### Installing from a Release Zip
1. Download `phire-angular-version-extension.zip` from the latest GitHub release.
2. Unzip the file to any local folder.
3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable **Developer mode** (top right toggle).
5. Click **Load unpacked**.
6. Select the unzipped folder.

### Packaging for Release
To create a fresh `.zip` file for the Chrome Web Store:
```bash
npm run package
```
The resulting file will be located at `dist/phire-angular-version-extension.zip`.

### Using the Dashboard and Exports
1. Open the popup on any tab.
2. Use **Re-run Scan** to force a fresh inspection.
3. Use **Filter tabs** to view local/staging/production slices.
4. Enable **Anonymize exports** when sharing externally.
5. Use **Copy JSON**, **Copy Text**, or **Copy Issue Snippet** for bug reports and team sharing.
6. Use **Open Docs** to jump to Angular documentation relevant to the detected version.

### DevTools Panel
1. Open Chrome DevTools on a tab.
2. Open the **Angular Inspector** panel.
3. Click **Refresh Report** to inspect the currently selected page.

## How it Works
The extension uses a content script to inspect the DOM of the active tab. It looks for the `ng-version` attribute on the application's root element (typically found on the child of the `<body>` tag).

## License
ISC
