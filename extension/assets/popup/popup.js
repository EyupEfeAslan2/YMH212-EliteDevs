const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");

const render = (payload) => {
  if (!payload) {
    statusEl.textContent = "Henüz veri yok.";
    outputEl.textContent = "";
    return;
  }

  if (!payload.ok) {
    statusEl.textContent = "Hata oluştu.";
    outputEl.textContent = payload.error || "Bilinmeyen hata";
    return;
  }

  statusEl.textContent = "Özet hazır.";
  outputEl.textContent = JSON.stringify(payload.data, null, 2);
};

chrome.storage.local.get(["lastSummary"], (result) => {
  render(result.lastSummary || null);
});
