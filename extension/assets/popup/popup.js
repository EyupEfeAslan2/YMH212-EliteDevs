
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
=======
const btn = document.getElementById("summarize-btn");
const btnText = document.querySelector(".btn-text");
const loader = document.querySelector(".loader");
const statusBox = document.getElementById("status");
const resultContainer = document.getElementById("result-container");

const uiRiskScore = document.getElementById("risk-score");
const uiRiskLabel = document.getElementById("risk-label");
const uiSummary = document.getElementById("summary-points");
const uiRisks = document.getElementById("risk-points");
const uiNotes = document.getElementById("note-points");

const setStatus = (msg, isError = false) => {
  statusBox.textContent = msg;
  statusBox.style.color = isError ? "var(--danger)" : "var(--text-main)";
  statusBox.classList.remove("hidden");
};

const hideStatus = () => {
  statusBox.classList.add("hidden");
};

const fillList = (ulElement, items) => {
  ulElement.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Bulunamadı.";
    li.style.color = "var(--text-muted)";
    ulElement.appendChild(li);
    return;
  }
  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    ulElement.appendChild(li);
  });
};

const renderResult = (payload) => {
  if (!payload) return;

  if (!payload.ok) {
    setStatus(payload.error || "Bir hata oluştu.", true);
    return;
  }

  const data = payload.data;
  if (!data) return;

  hideStatus();
  
  // Risk Skoru Renklendirmesi
  const score = data.risk_score || 0;
  uiRiskScore.textContent = score;
  let color = "var(--success)";
  let label = "Düşük Risk";
  
  if (score > 33) {
    color = "var(--warning)";
    label = "Orta Risk";
  }
  if (score > 66) {
    color = "var(--danger)";
    label = "Yüksek Risk";
  }

  uiRiskScore.style.color = color;
  uiRiskLabel.textContent = label;
  uiRiskLabel.style.color = color;

  // Listeleri doldur
  fillList(uiSummary, data.summary_points);
  fillList(uiRisks, data.risks);
  fillList(uiNotes, data.notes);

  resultContainer.classList.remove("hidden");
};

// Sayfa yüklendiğinde eski sonucu göster (varsa)
chrome.storage.local.get(["lastSummary"], (result) => {
  if (result.lastSummary) {
    renderResult(result.lastSummary);
  }
});

btn.addEventListener("click", () => {
  btn.disabled = true;
  btnText.textContent = "Analiz Ediliyor...";
  loader.classList.remove("hidden");
  hideStatus();
  resultContainer.classList.add("hidden");
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    
    // content script'ten metni iste
    chrome.tabs.sendMessage(activeTab.id, { action: "GET_TEXT" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.text) {
        setStatus("Sayfa içeriği okunamadı. Lütfen sayfayı yenileyip eklentiyi tekrar açın.", true);
        btn.disabled = false;
        btnText.textContent = "Bu Sayfayı Özetle";
        loader.classList.add("hidden");
        return;
      }
      
      const text = response.text;
      
      // background.js'e gönderip API çağrısını başlat
      chrome.runtime.sendMessage({
        type: "PAGE_TEXT",
        text: text,
        url: activeTab.url,
        title: activeTab.title
      }, (apiResponse) => {
        btn.disabled = false;
        btnText.textContent = "Tekrar Özetle";
        loader.classList.add("hidden");
        
        if (chrome.runtime.lastError) {
          setStatus("Arka plan servisi ile iletişim kurulamadı.", true);
          return;
        }
        
        renderResult(apiResponse);
      });
    });
  });
});
