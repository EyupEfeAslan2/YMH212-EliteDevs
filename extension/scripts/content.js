function extractAndSendText() {
    try {
        const pageText = document.body.innerText;
        if (!pageText || pageText.trim() === "") return;

        chrome.runtime.sendMessage(
            { action: "SEND_TEXT", text: pageText },
            (response) => {
                if (chrome.runtime.lastError) return;
                console.log("Arka plandan gelen yanıt:", response);
            }
        );
    } catch (error) {
        console.error("Metin çekme hatası:", error);
    }
}
extractAndSendText();