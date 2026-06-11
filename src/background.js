/**
 * Sends a framework report request to a tab.
 *
 * @param {number} tabId - Browser tab identifier
 * @returns {Promise<object | null>} Report object or null on failure
 */
function requestFrameworkReport(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { action: "GET_FRAMEWORK_REPORT" },
      (response) => {
        if (
          chrome.runtime.lastError ||
          !response ||
          response.ok !== true ||
          !response.report
        ) {
          resolve(null);
          return;
        }
        resolve(response.report);
      },
    );
  });
}

/**
 * Converts a semantic framework report into compact badge text.
 *
 * @param {object} report - Framework report object
 * @returns {string} Badge text for toolbar icon
 */
function getBadgeText(report) {
  const detection = report && report.detection ? report.detection : null;
  if (!detection) {
    return "";
  }

  if (detection.framework === "angular" && detection.majorVersion) {
    return `A${detection.majorVersion}`;
  }
  if (detection.framework === "angularjs") {
    return "NG1";
  }
  return "";
}

/**
 * Sets badge text and color for a tab.
 *
 * @param {number} tabId - Browser tab identifier
 * @param {string} text - Badge text content
 * @returns {Promise<void>} Completion promise
 */
async function setBadge(tabId, text) {
  await chrome.action.setBadgeText({ tabId, text });

  if (!text) {
    return;
  }

  const isLegacy = text === "NG1";
  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: isLegacy ? "#B91C1C" : "#0F766E",
  });
}

/**
 * Updates the extension badge for a specific tab.
 *
 * @param {number | undefined} tabId - Browser tab identifier
 * @returns {Promise<void>} Completion promise
 */
async function updateBadgeForTab(tabId) {
  if (typeof tabId !== "number") {
    return;
  }

  try {
    const report = await requestFrameworkReport(tabId);
    const badgeText = report ? getBadgeText(report) : "";
    await setBadge(tabId, badgeText);
  } catch (_error) {
    await setBadge(tabId, "");
  }
}

/**
 * Registers listeners for badge refresh on navigation and activation.
 *
 * @returns {void}
 */
function registerBadgeListeners() {
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await updateBadgeForTab(activeInfo.tabId);
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
      await updateBadgeForTab(tabId);
    }
  });
}

registerBadgeListeners();
