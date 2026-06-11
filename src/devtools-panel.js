/**
 * Sets panel status text.
 *
 * @param {string} value - Status message
 * @returns {void}
 */
function setStatus(value) {
  const statusNode = document.getElementById("status");
  if (statusNode) {
    statusNode.textContent = value;
  }
}

/**
 * Renders report JSON in output pane.
 *
 * @param {object | null} report - Framework report object
 * @returns {void}
 */
function renderReport(report) {
  const output = document.getElementById("reportOutput");
  if (!output) {
    return;
  }

  if (!report) {
    output.textContent =
      "No report found. Ensure the page is reloadable and not a restricted Chrome page.";
    return;
  }

  output.textContent = JSON.stringify(report, null, 2);
}

/**
 * Requests report for the currently inspected tab.
 *
 * @returns {Promise<object | null>} Report object or null on failure
 */
function requestInspectedTabReport() {
  return new Promise((resolve) => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    if (typeof tabId !== "number") {
      resolve(null);
      return;
    }

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
 * Refreshes the panel report.
 *
 * @returns {Promise<void>} Completion promise
 */
async function refreshPanel() {
  setStatus("Scanning inspected tab...");
  const report = await requestInspectedTabReport();
  renderReport(report);
  setStatus(report ? "Scan complete." : "Scan unavailable for this page.");
}

/**
 * Wires panel controls and navigation hooks.
 *
 * @returns {void}
 */
function initializePanel() {
  const refreshButton = document.getElementById("refreshBtn");
  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      void refreshPanel();
    });
  }

  chrome.devtools.network.onNavigated.addListener(() => {
    void refreshPanel();
  });

  void refreshPanel();
}

initializePanel();
