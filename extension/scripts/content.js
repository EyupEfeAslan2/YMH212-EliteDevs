chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_TEXT") {
    const text = document.body.innerText || "";
    sendResponse({ text: text });
  }
  return true;
});

console.log("EliteDevs Eklentisi: Content script hazır ve mesaj bekliyor.");