document.addEventListener('DOMContentLoaded', () => {
    const summaryDetail = document.getElementById('summary-detail');
    const languageSelect = document.getElementById('language-select');
    const btnSave = document.getElementById('btn-save');
    const statusMsg = document.getElementById('status-msg');
    const btnBack = document.getElementById('btn-back');

    // 1. Tarayıcı hafızasındaki mevcut ayarları çek ve ekrana yansıt
    chrome.storage.sync.get({
        summaryDetail: 'full', // Varsayılan değerler
        language: 'tr'
    }, (items) => {
        summaryDetail.value = items.summaryDetail;
        languageSelect.value = items.language;
    });

    // 2. Yeni ayarları kaydet
    btnSave.addEventListener('click', () => {
        chrome.storage.sync.set({
            summaryDetail: summaryDetail.value,
            language: languageSelect.value
        }, () => {
            statusMsg.textContent = "Ayarlar başarıyla kaydedildi!";
            setTimeout(() => { statusMsg.textContent = ""; }, 2000);
        });
    });

    // 3. Ana pop-up ekranına geri dön
    btnBack.addEventListener('click', () => {
        window.location.href = "popup.html";
    });
});
