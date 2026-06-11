/**
 * Registers the Angular Inspector panel in Chrome DevTools.
 *
 * @returns {void}
 */
function registerPanel() {
  chrome.devtools.panels.create(
    "Angular Inspector",
    "icon16.png",
    "devtools-panel.html",
  );
}

registerPanel();
