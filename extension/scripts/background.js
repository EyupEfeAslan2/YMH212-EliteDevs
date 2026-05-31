// Background service worker for Sözleşme Özetleyici

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'SEND_TEXT') {
        console.log('EliteDevs: Metin alındı, uzunluk:', message.text.length);
        sendResponse({ status: 'success' });
    }

    if (message.type === 'PAGE_TEXT') {
        // Store page text for later use
        chrome.storage.local.set({
            lastPageText: message.text,
            lastPageUrl: message.url,
            lastPageTitle: message.title
        });
        sendResponse({ status: 'stored' });
    }

    return true;
});