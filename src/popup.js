chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const activeTab = tabs[0];
  chrome.tabs.sendMessage(
    activeTab.id,
    { action: "GET_ANGULAR_VERSION" },
    (response) => {
      const versionElement = document.getElementById("version");
      if (chrome.runtime.lastError) {
        versionElement.textContent =
          "Error: " + chrome.runtime.lastError.message;
        return;
      }
      if (response && response.version) {
        versionElement.textContent = response.version;
      } else {
        versionElement.textContent = "Not found";
      }
    },
  );
});
