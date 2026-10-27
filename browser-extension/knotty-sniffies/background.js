const DEFAULT_SETTINGS = {
  enabled: true,
  autoOpenSniffies: true,
  armDelaySec: 60,
  opener: "What's good? 😈",
  followUp: "Real talk… tired of fake profiles and scammers on here? 👀"
};

async function ensureDefaults() {
  const { pirokaKnottySettings } = await chrome.storage.sync.get("pirokaKnottySettings");
  if (!pirokaKnottySettings) {
    await chrome.storage.sync.set({ pirokaKnottySettings: DEFAULT_SETTINGS });
    return DEFAULT_SETTINGS;
  }

  const merged = { ...DEFAULT_SETTINGS, ...pirokaKnottySettings };
  await chrome.storage.sync.set({ pirokaKnottySettings: merged });
  return merged;
}

async function maybeOpenSniffies() {
  const settings = await ensureDefaults();
  if (!settings.enabled || !settings.autoOpenSniffies) return;

  const tabs = await chrome.tabs.query({
    url: ["https://sniffies.com/*", "https://*.sniffies.com/*"]
  });

  if (!tabs.length) {
    await chrome.tabs.create({ url: "https://sniffies.com/" });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaults();
});

chrome.runtime.onStartup.addListener(() => {
  void maybeOpenSniffies();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PIROKA_OPEN_SNIFFIES") {
    void chrome.tabs.create({ url: "https://sniffies.com/" }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "PIROKA_GET_DEFAULTS") {
    void ensureDefaults().then((settings) => sendResponse({ ok: true, settings }));
    return true;
  }

  return false;
});
