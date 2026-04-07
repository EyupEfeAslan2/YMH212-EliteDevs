(() => {
  const extractPageText = () => {
    if (!document.body) return "";
    return document.body.innerText || "";
  };

  const sendPageText = () => {
    const text = extractPageText().trim();
    if (!text) return;

    chrome.runtime.sendMessage(
      {
        type: "PAGE_TEXT",
        text,
        url: window.location.href,
        title: document.title || "",
      },
      () => {
        // Swallow response; popup can fetch from storage if needed.
      }
    );
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sendPageText, { once: true });
  } else {
    sendPageText();
  }
})();
