function getAngularVersion() {
  // Logic: Modern Angular apps have a <body> tag and the next child element is the root of the app.
  // We'll check the direct children of the body for the ng-version attribute.
  const bodyChildren = document.body.children;
  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i];
    const version = child.getAttribute("ng-version");
    if (version) {
      return version;
    }
  }

  // Fallback: If not found in direct children, check all elements with ng-version
  const elementWithVersion = document.querySelector("[ng-version]");
  if (elementWithVersion) {
    return elementWithVersion.getAttribute("ng-version");
  }

  return null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_ANGULAR_VERSION") {
    const version = getAngularVersion();
    sendResponse({ version: version });
  }
  return true; // Keep message channel open for async response
});
