const DEFAULT_SETTINGS = {
  enabled: true,
  autoOpenSniffies: true,
  armDelaySec: 60,
  opener: "What's good? 😈",
  followUp: "Real talk… tired of fake profiles and scammers on here? 👀"
};

const el = (id) => document.getElementById(id);

async function load() {
  const { pirokaKnottySettings } = await chrome.storage.sync.get("pirokaKnottySettings");
  const settings = { ...DEFAULT_SETTINGS, ...(pirokaKnottySettings || {}) };

  el("enabled").checked = Boolean(settings.enabled);
  el("autoOpenSniffies").checked = Boolean(settings.autoOpenSniffies);
  el("armDelaySec").value = String(settings.armDelaySec || 60);
  el("opener").value = settings.opener || DEFAULT_SETTINGS.opener;
  el("followUp").value = settings.followUp || DEFAULT_SETTINGS.followUp;
}

async function save() {
  const settings = {
    enabled: el("enabled").checked,
    autoOpenSniffies: el("autoOpenSniffies").checked,
    armDelaySec: Math.max(15, Math.min(600, Number(el("armDelaySec").value || 60))),
    opener: el("opener").value.trim() || DEFAULT_SETTINGS.opener,
    followUp: el("followUp").value.trim() || DEFAULT_SETTINGS.followUp
  };

  await chrome.storage.sync.set({ pirokaKnottySettings: settings });
  el("status").textContent = "Saved. Active Sniffies tabs update automatically.";
  setTimeout(() => {
    el("status").textContent = "";
  }, 2200);
}

el("save").addEventListener("click", () => void save());
el("open").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "PIROKA_OPEN_SNIFFIES" });
  window.close();
});

void load();
