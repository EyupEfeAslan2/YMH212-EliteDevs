chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "SEND_TEXT") {
        console.log("Metin başarıyla alındı!");
        console.log("Gelen metin uzunluğu:", message.text.length);
        
        sendResponse({ 
            status: "success", 
            detail: "Metin ulaştı." 
        });
    }
    return true;
});