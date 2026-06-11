/**
 * Safely reads a nested property from window using a path array.
 *
 * @param {string[]} pathSegments - Ordered path segments, e.g. ['ng', 'probe']
 * @returns {unknown} Property value when present, otherwise undefined
 */
function readWindowPath(pathSegments) {
  try {
    let current = window;
    for (const segment of pathSegments) {
      if (!current || typeof current !== "object" || !(segment in current)) {
        return undefined;
      }
      current = current[segment];
    }
    return current;
  } catch (_error) {
    return undefined;
  }
}

/**
 * Attempts to detect modern Angular version via ng-version attributes.
 *
 * @returns {{ version: string | null, strategies: string[], rootCount: number }}
 * Detection details including version and strategy trace
 */
function detectModernAngularVersion() {
  const strategies = [];
  let rootCount = 0;

  if (document.body && document.body.children) {
    const bodyChildren = document.body.children;
    for (let index = 0; index < bodyChildren.length; index += 1) {
      const child = bodyChildren[index];
      const version = child.getAttribute("ng-version");
      if (version) {
        strategies.push("body-child-ng-version");
        return { version, strategies, rootCount: 1 };
      }
    }
  }

  const allVersionNodes = document.querySelectorAll("[ng-version]");
  rootCount = allVersionNodes.length;
  if (allVersionNodes.length > 0) {
    const firstVersion = allVersionNodes[0].getAttribute("ng-version");
    strategies.push("any-node-ng-version");
    return { version: firstVersion, strategies, rootCount };
  }

  return { version: null, strategies, rootCount };
}

/**
 * Attempts to detect AngularJS version and root nodes.
 *
 * @returns {{ version: string | null, strategies: string[], rootCount: number }}
 * AngularJS detection output
 */
function detectAngularJsVersion() {
  const strategies = [];
  const angularGlobal = readWindowPath(["angular"]);

  if (angularGlobal && typeof angularGlobal === "object") {
    const full = angularGlobal.version && angularGlobal.version.full;
    if (typeof full === "string" && full.trim().length > 0) {
      strategies.push("window-angular-version-full");
      const roots = document.querySelectorAll(
        "[ng-app], [data-ng-app], .ng-scope",
      );
      return { version: full.trim(), strategies, rootCount: roots.length };
    }
  }

  const ngAppNodes = document.querySelectorAll("[ng-app], [data-ng-app]");
  if (ngAppNodes.length > 0) {
    strategies.push("ng-app-marker");
    return { version: null, strategies, rootCount: ngAppNodes.length };
  }

  return { version: null, strategies, rootCount: 0 };
}

/**
 * Determines whether runtime signals indicate potential SSR or hydration.
 *
 * @returns {{ isLikelySsrOrHydration: boolean, signals: string[] }} SSR/hydration heuristic result
 */
function detectSsrHydrationSignals() {
  const signals = [];

  if (document.querySelector("[ng-server-context]")) {
    signals.push("ng-server-context-attribute");
  }
  if (
    document.querySelector(
      "script[id*='transfer-state'], script[id*='ng-state']",
    )
  ) {
    signals.push("transfer-state-script");
  }
  if (document.querySelector("[ngh], [ng-version][ngh]")) {
    signals.push("hydration-marker-ngh");
  }

  return {
    isLikelySsrOrHydration: signals.length > 0,
    signals,
  };
}

/**
 * Tries to infer production or development mode from known global hooks.
 *
 * @returns {{ isLikelyDev: boolean, isLikelyProd: boolean, signals: string[] }} Runtime mode guess
 */
function detectRuntimeMode() {
  const signals = [];
  const ngProbe = readWindowPath(["ng", "probe"]);
  const ngGetComponent = readWindowPath(["ng", "getComponent"]);

  const isLikelyDev =
    typeof ngProbe === "function" || typeof ngGetComponent === "function";
  if (typeof ngProbe === "function") {
    signals.push("window-ng-probe");
  }
  if (typeof ngGetComponent === "function") {
    signals.push("window-ng-getComponent");
  }

  const isLikelyProd = !isLikelyDev;
  if (isLikelyProd) {
    signals.push("no-devtools-hooks-detected");
  }

  return { isLikelyDev, isLikelyProd, signals };
}

/**
 * Detects runtime/dependency hints from scripts and globals.
 *
 * @returns {{ rxjs: string | null, angularMaterial: boolean, ngrx: boolean }} Dependency hints
 */
function detectDependencyHints() {
  const scripts = Array.from(document.querySelectorAll("script[src]"));
  const scriptSources = scripts.map((scriptElement) =>
    scriptElement.src.toLowerCase(),
  );

  const rxjsFromWindow = readWindowPath(["rxjs", "version"]);
  const rxjsFromScript = scriptSources.find((source) =>
    source.includes("rxjs"),
  );
  const rxjs =
    typeof rxjsFromWindow === "string"
      ? rxjsFromWindow
      : rxjsFromScript
        ? "detected"
        : null;

  const angularMaterial = scriptSources.some(
    (source) =>
      source.includes("@angular/material") ||
      source.includes("angular-material"),
  );
  const ngrx = scriptSources.some(
    (source) => source.includes("@ngrx") || source.includes("ngrx"),
  );

  return { rxjs, angularMaterial, ngrx };
}

/**
 * Computes a confidence label based on detection strength.
 *
 * @param {string[]} strategies - Strategy trace used during detection
 * @param {string | null} version - Detected version string
 * @returns {"high" | "medium" | "low"} Confidence level
 */
function getConfidenceLevel(strategies, version) {
  if (version && strategies.length > 0) {
    return "high";
  }
  if (strategies.length > 0) {
    return "medium";
  }
  return "low";
}

/**
 * Builds a full framework inspection report for the current page.
 *
 * @returns {object} Structured diagnostics report for popup and badge logic
 */
function buildFrameworkReport() {
  const modernAngular = detectModernAngularVersion();
  const angularJs = detectAngularJsVersion();
  const runtimeMode = detectRuntimeMode();
  const ssrHydration = detectSsrHydrationSignals();
  const dependencies = detectDependencyHints();

  let framework = "not-angular";
  let version = null;
  let strategies = [];
  let rootElementCount = 0;

  if (modernAngular.version) {
    framework = "angular";
    version = modernAngular.version;
    strategies = modernAngular.strategies;
    rootElementCount = modernAngular.rootCount;
  } else if (angularJs.version || angularJs.rootCount > 0) {
    framework = "angularjs";
    version = angularJs.version;
    strategies = angularJs.strategies;
    rootElementCount = angularJs.rootCount;
  }

  const confidence = getConfidenceLevel(strategies, version);
  const majorVersion =
    version && /^\d+/.test(version) ? Number.parseInt(version, 10) : null;

  return {
    scannedAt: new Date().toISOString(),
    page: {
      title: document.title || "(untitled)",
      url: window.location.href,
      host: window.location.host,
      path: window.location.pathname,
    },
    detection: {
      framework,
      version,
      majorVersion,
      confidence,
      strategies,
      notFoundReason:
        framework === "not-angular"
          ? "No Angular or AngularJS runtime markers were found."
          : null,
    },
    runtime: {
      isLikelyDev: runtimeMode.isLikelyDev,
      isLikelyProd: runtimeMode.isLikelyProd,
      modeSignals: runtimeMode.signals,
      hasZoneJs: typeof readWindowPath(["Zone"]) !== "undefined",
      isLikelySsrOrHydration: ssrHydration.isLikelySsrOrHydration,
      ssrSignals: ssrHydration.signals,
    },
    dependencies,
    diagnostics: {
      rootElementCount,
      hasNgGlobal: typeof readWindowPath(["ng"]) !== "undefined",
      hasAngularJsGlobal: typeof readWindowPath(["angular"]) !== "undefined",
      userAgent: navigator.userAgent,
    },
  };
}

/**
 * Returns only the version string for backwards compatibility with existing popup logic.
 *
 * @returns {string | null} Angular or AngularJS version when available
 */
function getAngularVersion() {
  const report = buildFrameworkReport();
  return report.detection.version;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  try {
    if (!request || typeof request !== "object") {
      sendResponse({ ok: false, error: "Invalid request payload." });
      return true;
    }

    if (request.action === "GET_FRAMEWORK_REPORT") {
      const report = buildFrameworkReport();
      sendResponse({ ok: true, report });
      return true;
    }

    if (request.action === "GET_ANGULAR_VERSION") {
      const version = getAngularVersion();
      sendResponse({ ok: true, version });
      return true;
    }
  } catch (error) {
    sendResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown content script error.",
    });
    return true;
  }

  sendResponse({ ok: false, error: "Unsupported action." });
  return true;
});
