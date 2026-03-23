const SUMMARIZE_URL = "http://localhost:8000/summarize";

const storeLastResult = async (payload) => {
  try {
    await chrome.storage.local.set({ lastSummary: payload });
  } catch (err) {
    // No-op: storage is optional for the MVP.
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "PAGE_TEXT") return;

  fetch(SUMMARIZE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: message.text,
      url: message.url,
      title: message.title,
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Backend error: ${res.status} ${body}`.trim());
      }
      return res.json();
    })
    .then(async (data) => {
      await storeLastResult({
        ok: true,
        data,
        source: {
          url: message.url,
          title: message.title,
        },
        receivedAt: new Date().toISOString(),
      });
      sendResponse({ ok: true, data });
    })
    .catch(async (err) => {
      await storeLastResult({
        ok: false,
        error: String(err),
        source: {
          url: message.url,
          title: message.title,
        },
        receivedAt: new Date().toISOString(),
      });
      sendResponse({ ok: false, error: String(err) });
    });

  return true;
});
