
function extractAndSendText() {
    try {
        // Rapor: Gereksiz HTML gürültüsünden arındırma (DOM Scraper Engine)
        // Sadece anlamlı metin bloklarını seçer
        const selectors = 'p, h1, h2, h3, h4, h5, h6, li, article, section';
        const elements = document.querySelectorAll(selectors);
        
        let cleanedText = Array.from(elements)
            .map(el => el.innerText.trim())
            .filter(text => text.length > 20) // Çok kısa (buton metni vb.) gürültüleri eler
            .join('\n\n');

        if (!cleanedText) return;

        // Rapor: Performans odaklı veri iletimi
        chrome.runtime.sendMessage(
            { action: "SEND_TEXT", text: cleanedText },
            (response) => {
                if (chrome.runtime.lastError) return;
                console.log("EliteDevs Engine: Metin başarıyla iletildi.");
            }
        );
    } catch (error) {
        console.error("DOM Ayıklama Hatası:", error);
    }
}

// Popup'tan gelen mesajları dinler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_TEXT") {
        const selectors = 'p, h1, h2, h3, h4, h5, h6, li, article, section';
        const elements = document.querySelectorAll(selectors);
        
        const cleanedText = Array.from(elements)
            .map(el => el.innerText.trim())
            .filter(text => text.length > 20)
            .join('\n\n');

        // Yanıt olarak metni geri gönderiyoruz
        sendResponse({ text: cleanedText });
    }
    return true; // Asenkron yanıt için gerekli
});
=======
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
