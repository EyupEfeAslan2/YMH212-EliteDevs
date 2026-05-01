document.addEventListener('DOMContentLoaded', () => {
    
    const btnClose = document.getElementById('btn-close');
    const btnCopy = document.getElementById('btn-copy');
    const btnSettings = document.getElementById('btn-settings');
    const needle = document.querySelector('.gauge-needle');
    const scoreElement = document.querySelector('.score');
    const summaryElement = document.querySelector('.summary-section p');
    const policyListElement = document.querySelector('.policy-list');

    btnClose.addEventListener('click', () => {
        window.close();
    });

    btnCopy.addEventListener('click', () => {
        const summaryText = summaryElement.innerText;
        navigator.clipboard.writeText(summaryText).then(() => {
            const originalIcon = btnCopy.innerText;
            btnCopy.innerText = "✅";
            setTimeout(() => {
                btnCopy.innerText = originalIcon;
            }, 1500);
        });
    });

    btnSettings.addEventListener('click', () => {
        alert("Ayarlar sayfası daha sonra eklenecektir.");
    });

    function updateUI(data) {
        scoreElement.innerText = data.score.toFixed(1);
        const angle = (data.score / 10) * 180 - 90;
        needle.style.transform = `rotate(${angle}deg)`;
        summaryElement.innerText = data.summary;
        policyListElement.innerHTML = '';
        data.policies.forEach(policy => {
            const li = document.createElement('li');
            li.className = `policy-item ${policy.status}`;
            li.innerHTML = `
                <span class="dot"></span>
                <p>${policy.text}</p>
            `;
            policyListElement.appendChild(li);
        });
    }

    async function analyzeContract(text) {
        summaryElement.innerText = "Analiz ediliyor.. Lütfen bekleyin.";
        try {
            const response = await fetch('http://localhost:8000/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: text,
                    title: "Web Sayfası" 
                })
            });
            const data = await response.json();
            const normalizedData = {
                score: data.risk_score / 10,
                summary: data.summary_points.join(' '),
                policies: data.risks.map(r => ({ status: "red", text: r }))
            };
            updateUI(normalizedData);
        } catch (error) {
            console.error("Hata:", error);
            summaryElement.innerText = "Sunucuya bağlanılamadı.";
        }
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "GET_TEXT" }, (response) => {
            if (response && response.text) {
                analyzeContract(response.text);
            } else {
                summaryElement.innerText = "Analiz edilecek metin bulunamadı.";
            }
        });
    });

});