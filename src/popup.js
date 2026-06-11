const MINIMUM_SUPPORTED_MAJOR = 17;
const state = {
  activeReport: null,
  allTabReports: [],
};

/**
 * Wraps chrome.tabs.query in a Promise.
 *
 * @param {chrome.tabs.QueryInfo} queryInfo - Query options for tab lookup
 * @returns {Promise<chrome.tabs.Tab[]>} Matching tabs
 */
function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tabs);
    });
  });
}

/**
 * Sends a framework report request to a tab.
 *
 * @param {number} tabId - Browser tab id
 * @returns {Promise<{ ok: boolean, report?: object, error?: string }>} Content script response
 */
function requestFrameworkReport(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { action: "GET_FRAMEWORK_REPORT" },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (!response || !response.ok) {
          resolve({
            ok: false,
            error:
              (response && response.error) ||
              "No response from content script.",
          });
          return;
        }
        resolve({ ok: true, report: response.report });
      },
    );
  });
}

/**
 * Sets the top status text and style based on state.
 *
 * @param {string} message - Status message to display
 * @param {"ok" | "warn" | "danger" | "subtle"} tone - Visual tone class
 * @returns {void}
 */
function setStatus(message, tone) {
  const statusNode = document.getElementById("status");
  statusNode.textContent = message;
  statusNode.className = `status ${tone}`;
}

/**
 * Classifies environment type based on host.
 *
 * @param {string} host - Page host
 * @returns {"local" | "development" | "test" | "production" | "other"} Environment classification
 */
function classifyEnvironment(host) {
  const normalizedHost = (host || "").toLowerCase();
  if (!normalizedHost) {
    return "other";
  }
  if (
    normalizedHost.includes("localhost") ||
    normalizedHost.startsWith("127.") ||
    normalizedHost.endsWith(".local")
  ) {
    return "local";
  }
  if (normalizedHost.startsWith("dev-")) {
    return "development";
  }
  if (normalizedHost.startsWith("test-")) {
    return "test";
  }
  if (normalizedHost.includes("chrome") || normalizedHost.includes("newtab")) {
    return "other";
  }
  return "production";
}

/**
 * Builds warning and guidance lines for the active report.
 *
 * @param {object} report - Framework report from content script
 * @returns {string[]} User-facing warning messages
 */
function buildWarnings(report) {
  const warnings = [];
  const framework = report.detection.framework;
  const major = report.detection.majorVersion;
  const userAgent =
    report.diagnostics && report.diagnostics.userAgent
      ? report.diagnostics.userAgent
      : "";
  const chromeVersionMatch = /Chrome\/(\d+)/.exec(userAgent);
  const chromeMajor = chromeVersionMatch
    ? Number.parseInt(chromeVersionMatch[1], 10)
    : null;

  if (framework === "not-angular") {
    warnings.push(
      "No Angular markers were found. This page may use another framework.",
    );
  }

  if (framework === "angularjs") {
    warnings.push(
      "AngularJS (1.x) detected. Consider migration if this is not expected.",
    );
  }

  if (
    framework === "angular" &&
    typeof major === "number" &&
    major < MINIMUM_SUPPORTED_MAJOR
  ) {
    warnings.push(
      `Angular ${major} appears below policy baseline ${MINIMUM_SUPPORTED_MAJOR}.`,
    );
    warnings.push("Review update guidance: https://angular.dev/update-guide");
  }

  if (
    framework === "angular" &&
    typeof major === "number" &&
    major < 15 &&
    typeof chromeMajor === "number" &&
    chromeMajor >= 120
  ) {
    warnings.push(
      `Potential compatibility risk: Angular ${major} on Chrome ${chromeMajor}.`,
    );
  }

  if (!report.runtime.hasZoneJs && framework !== "not-angular") {
    warnings.push(
      "Zone.js was not detected. This can be valid in zoneless setups, but verify expected behavior.",
    );
  }

  if (report.runtime.isLikelyDev) {
    warnings.push(
      "Development-mode signals found (window.ng hooks). Production builds should typically hide these.",
    );
  }

  return warnings;
}

/**
 * Creates a concise dependency summary string.
 *
 * @param {object} dependencies - Dependency hints from report
 * @returns {string} Comma-separated dependency summary
 */
function summarizeDependencies(dependencies) {
  const labels = [];
  if (dependencies.rxjs) {
    labels.push(`RxJS: ${dependencies.rxjs}`);
  }
  if (dependencies.angularMaterial) {
    labels.push("Angular Material");
  }
  if (dependencies.ngrx) {
    labels.push("NgRx");
  }
  return labels.length > 0 ? labels.join(", ") : "None detected";
}

/**
 * Renders the active tab report into the popup.
 *
 * @param {object} report - Framework report
 * @returns {void}
 */
function renderActiveReport(report) {
  state.activeReport = report;
  const framework = report.detection.framework;
  const version = report.detection.version || "n/a";
  const confidence = report.detection.confidence;
  const environment = classifyEnvironment(report.page.host);

  document.getElementById("version").textContent =
    framework === "not-angular" ? "n/a" : version;
  document.getElementById("frameworkLine").textContent =
    `Framework: ${framework} | Confidence: ${confidence} | Env: ${environment}`;
  document.getElementById("pageLine").textContent =
    `Page: ${report.page.host}${report.page.path}`;

  const modeValue = report.runtime.isLikelyDev
    ? "Development-like"
    : report.runtime.isLikelyProd
      ? "Production-like"
      : "Unknown";
  document.getElementById("modeValue").textContent = modeValue;
  document.getElementById("ssrValue").textContent = report.runtime
    .isLikelySsrOrHydration
    ? "Likely"
    : "Not detected";
  document.getElementById("zoneValue").textContent = report.runtime.hasZoneJs
    ? "Detected"
    : "Not detected";
  document.getElementById("depsValue").textContent = summarizeDependencies(
    report.dependencies,
  );

  const warnings = buildWarnings(report);
  const warningsList = document.getElementById("warnings");
  warningsList.innerHTML = "";

  if (warnings.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No high-priority concerns detected.";
    warningsList.appendChild(item);
  } else {
    for (const warning of warnings) {
      const item = document.createElement("li");
      item.textContent = warning;
      warningsList.appendChild(item);
    }
  }

  if (framework === "not-angular") {
    setStatus("Scan completed: not an Angular page", "warn");
  } else if (framework === "angularjs") {
    setStatus("Scan completed: AngularJS detected", "warn");
  } else {
    setStatus("Scan completed: Angular detected", "ok");
  }
}

/**
 * Builds a human-readable report summary for copy/export workflows.
 *
 * @param {object} report - Framework report
 * @returns {string} Multi-line plain text summary
 */
function buildTextSummary(report) {
  return [
    `Framework: ${report.detection.framework}`,
    `Version: ${report.detection.version || "n/a"}`,
    `Confidence: ${report.detection.confidence}`,
    `Page: ${report.page.url}`,
    `Mode: ${report.runtime.isLikelyDev ? "development-like" : "production-like"}`,
    `SSR/Hydration: ${report.runtime.isLikelySsrOrHydration ? "likely" : "not detected"}`,
    `Zone.js: ${report.runtime.hasZoneJs ? "detected" : "not detected"}`,
    `Dependencies: ${summarizeDependencies(report.dependencies)}`,
    `Root Elements: ${report.diagnostics.rootElementCount}`,
    `Scanned At: ${report.scannedAt}`,
  ].join("\n");
}

/**
 * Returns a report copy with URL and host anonymized.
 *
 * @param {object} report - Report to anonymize
 * @returns {object} Cloned anonymized report
 */
function anonymizeReport(report) {
  const clone = JSON.parse(JSON.stringify(report));
  if (clone.page) {
    clone.page.url = "redacted://redacted";
    clone.page.host = "redacted";
    clone.page.path = "/redacted";
  }
  return clone;
}

/**
 * Gets report for export based on anonymize toggle state.
 *
 * @returns {object | null} Export-ready report
 */
function getExportReport() {
  if (!state.activeReport) {
    return null;
  }
  const shouldAnonymize =
    document.getElementById("anonymizeToggle")?.checked === true;
  return shouldAnonymize
    ? anonymizeReport(state.activeReport)
    : state.activeReport;
}

/**
 * Builds a markdown snippet suitable for issue reports.
 *
 * @param {object} report - Framework report
 * @returns {string} Markdown content for ticket/comment usage
 */
function buildIssueSnippet(report) {
  return [
    "### Angular Inspector Report",
    "",
    `- Framework: ${report.detection.framework}`,
    `- Version: ${report.detection.version || "n/a"}`,
    `- Confidence: ${report.detection.confidence}`,
    `- URL: ${report.page.url}`,
    `- Mode: ${report.runtime.isLikelyDev ? "development-like" : "production-like"}`,
    `- SSR/Hydration: ${report.runtime.isLikelySsrOrHydration ? "likely" : "not detected"}`,
    `- Zone.js: ${report.runtime.hasZoneJs ? "detected" : "not detected"}`,
    `- Dependencies: ${summarizeDependencies(report.dependencies)}`,
    `- Strategies: ${(report.detection.strategies || []).join(", ") || "none"}`,
    `- Scanned At: ${report.scannedAt}`,
  ].join("\n");
}

/**
 * Copies text to clipboard and updates status.
 *
 * @param {string} text - Text to copy
 * @param {string} successLabel - Status label for successful copy
 * @returns {Promise<void>} Completion promise
 */
async function copyText(text, successLabel) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(successLabel, "ok");
  } catch (error) {
    console.error("Clipboard write failed.", error);
    setStatus(
      "Clipboard write failed. Copy permission may be blocked.",
      "danger",
    );
  }
}

/**
 * Scans the active tab and refreshes the primary report section.
 *
 * @returns {Promise<void>} Completion promise
 */
async function refreshActiveTabReport() {
  setStatus("Scanning active tab...", "subtle");
  document.getElementById("version").textContent = "...";

  try {
    const tabs = await queryTabs({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0 || typeof tabs[0].id !== "number") {
      throw new Error("No active tab found.");
    }

    const response = await requestFrameworkReport(tabs[0].id);
    if (!response.ok || !response.report) {
      throw new Error(response.error || "No report available.");
    }

    renderActiveReport(response.report);
  } catch (error) {
    console.error("Active tab scan failed.", error);
    state.activeReport = null;
    setStatus(
      "Scan failed: content script unavailable on this page.",
      "danger",
    );
    document.getElementById("version").textContent = "n/a";
    document.getElementById("frameworkLine").textContent =
      "Framework: unavailable";
    document.getElementById("pageLine").textContent =
      "Page: restricted or unsupported";
  }
}

/**
 * Scans all tabs in the current window and renders a dashboard list.
 *
 * @returns {Promise<void>} Completion promise
 */
async function refreshTabsDashboard() {
  const tabsSummary = document.getElementById("tabsSummary");
  const tabsList = document.getElementById("tabsList");
  const selectedFilter = document.getElementById("envFilter").value;

  tabsSummary.textContent = "Scanning tabs...";
  tabsList.innerHTML = "";

  const tabs = await queryTabs({});
  let visibleCount = 0;

  for (const tab of tabs) {
    if (typeof tab.id !== "number") {
      continue;
    }

    const response = await requestFrameworkReport(tab.id);
    if (!response.ok || !response.report) {
      continue;
    }

    const report = response.report;
    const environment = classifyEnvironment(report.page.host);
    if (selectedFilter !== "all" && environment !== selectedFilter) {
      continue;
    }

    visibleCount += 1;
    const item = document.createElement("div");
    item.className = "tab-item";

    const titleNode = document.createElement("strong");
    titleNode.textContent = report.page.title;
    item.appendChild(titleNode);

    const frameworkNode = document.createElement("span");
    frameworkNode.textContent = `Framework: ${report.detection.framework} | Version: ${report.detection.version || "n/a"}`;
    item.appendChild(frameworkNode);

    const pageNode = document.createElement("span");
    pageNode.textContent = `${environment.toUpperCase()} | ${report.page.host}${report.page.path}`;
    item.appendChild(pageNode);

    tabsList.appendChild(item);
  }

  tabsSummary.textContent = `Showing ${visibleCount} scanned tab(s) with filter: ${selectedFilter}.`;
}

/**
 * Attaches click and change handlers for popup controls.
 *
 * @returns {void}
 */
function wireControls() {
  document.getElementById("refreshBtn").addEventListener("click", async () => {
    await refreshActiveTabReport();
    await refreshTabsDashboard();
  });

  document.getElementById("copyJsonBtn").addEventListener("click", async () => {
    const exportReport = getExportReport();
    if (!exportReport) {
      setStatus("No report available to copy yet.", "warn");
      return;
    }
    await copyText(
      JSON.stringify(exportReport, null, 2),
      "JSON copied to clipboard.",
    );
  });

  document.getElementById("copyTextBtn").addEventListener("click", async () => {
    const exportReport = getExportReport();
    if (!exportReport) {
      setStatus("No report available to copy yet.", "warn");
      return;
    }
    await copyText(
      buildTextSummary(exportReport),
      "Text report copied to clipboard.",
    );
  });

  document
    .getElementById("copyIssueBtn")
    .addEventListener("click", async () => {
      const exportReport = getExportReport();
      if (!exportReport) {
        setStatus("No report available to copy yet.", "warn");
        return;
      }
      await copyText(
        buildIssueSnippet(exportReport),
        "Issue snippet copied to clipboard.",
      );
    });

  document.getElementById("openDocsBtn").addEventListener("click", async () => {
    const report = state.activeReport;
    const major =
      report && report.detection ? report.detection.majorVersion : null;
    const docsUrl =
      typeof major === "number"
        ? `https://angular.dev/guide/releases#v${major}`
        : "https://angular.dev";
    await chrome.tabs.create({ url: docsUrl });
  });

  document.getElementById("envFilter").addEventListener("change", async () => {
    await refreshTabsDashboard();
  });
}

/**
 * Registers tab event listeners so popup auto-refreshes while open.
 *
 * @returns {void}
 */
function wireAutoRefresh() {
  chrome.tabs.onActivated.addListener(async () => {
    await refreshActiveTabReport();
  });

  chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || !tab.active) {
      return;
    }
    await refreshActiveTabReport();
    await refreshTabsDashboard();
  });
}

/**
 * Initializes popup state and kicks off initial scan.
 *
 * @returns {Promise<void>} Initialization completion
 */
async function initializePopup() {
  wireControls();
  wireAutoRefresh();
  await refreshActiveTabReport();
  await refreshTabsDashboard();
}

initializePopup().catch((error) => {
  console.error("Popup initialization failed.", error);
  setStatus("Initialization failed. Re-open popup and retry.", "danger");
});
