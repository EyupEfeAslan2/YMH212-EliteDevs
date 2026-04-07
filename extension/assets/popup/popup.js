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
