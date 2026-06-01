const API_BASE = 'http://127.0.0.1:8000';

// DOM elements
const btnTheme = document.getElementById('btn-theme');
const btnSettings = document.getElementById('btn-settings');
const settingsPanel = document.getElementById('settings-panel');
const apiKeyInput = document.getElementById('api-key-input');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingsStatus = document.getElementById('settings-status');
const connectionStatus = document.getElementById('connection-status');

const btnSummarize = document.getElementById('btn-summarize');
const btnText = document.querySelector('.btn-text');
const loader = document.getElementById('loader');
const statusMessage = document.getElementById('status-message');

const resultsSection = document.getElementById('results-section');
const gaugeNeedle = document.getElementById('gauge-needle');
const scoreValue = document.getElementById('score-value');
const scoreLabel = document.getElementById('score-label');
const summaryText = document.getElementById('summary-text');
const criticalSection = document.getElementById('critical-section');
const criticalText = document.getElementById('critical-text');
const policyList = document.getElementById('policy-list');
const btnCopy = document.getElementById('btn-copy');

const chatSection = document.getElementById('chat-section');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');

// State
let currentContractText = '';
let currentSummaryData = null;
let isApiKeyConfigured = false;
let isBackendReachable = false;

// ---- Theme Management ----

function setTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-mode');
        // Set sun icon SVG
        btnTheme.innerHTML = `
            <svg class="icon-svg theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
        `;
    } else {
        document.body.classList.remove('light-mode');
        // Set moon icon SVG
        btnTheme.innerHTML = `
            <svg class="icon-svg theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
        `;
    }
}

// Toggle theme
btnTheme.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light-mode');
    const newTheme = isLight ? 'dark' : 'light';
    setTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
});

// ---- Connection Status Indicator ----

function updateConnectionIndicator(state) {
    // state: 'checking', 'connected', 'no-key', 'disconnected'
    connectionStatus.className = 'connection-status';
    connectionStatus.textContent = ''; // clear emojis

    switch (state) {
        case 'checking':
            connectionStatus.title = 'Bağlantı kontrol ediliyor...';
            connectionStatus.classList.add('checking');
            break;
        case 'connected':
            connectionStatus.title = 'Bağlı — API anahtarı ayarlı';
            connectionStatus.classList.add('connected');
            break;
        case 'no-key':
            connectionStatus.title = 'Backend bağlı — API anahtarı gerekli';
            connectionStatus.classList.add('no-key');
            break;
        case 'disconnected':
            connectionStatus.title = 'Backend sunucusuna bağlanılamıyor';
            connectionStatus.classList.add('disconnected');
            break;
    }
}

// ---- Startup Flow ----

async function checkBackendStatus() {
    updateConnectionIndicator('checking');

    try {
        const response = await fetch(`${API_BASE}/api/config-status`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        isBackendReachable = true;
        isApiKeyConfigured = data.initialized === true;

        if (isApiKeyConfigured) {
            updateConnectionIndicator('connected');
            btnSummarize.disabled = false;
            hideStatus();
        } else {
            updateConnectionIndicator('no-key');
            btnSummarize.disabled = true;
            settingsPanel.classList.remove('hidden');
            setStatus('API anahtarı ayarlanmamış. Lütfen aşağıdan Gemini API anahtarınızı girin.', true);
        }
    } catch (e) {
        console.error('Backend bağlantı hatası:', e);
        isBackendReachable = false;
        isApiKeyConfigured = false;
        updateConnectionIndicator('disconnected');
        btnSummarize.disabled = true;
        setStatus('Backend sunucusuna bağlanılamıyor. Sunucunun çalıştığından emin olun (localhost:8000).', true);
    }
}

// Run startup check
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved theme
    chrome.storage.local.get(['theme'], (result) => {
        if (result.theme) {
            setTheme(result.theme);
        } else {
            setTheme('dark');
        }
    });

    // Load saved API key from chrome storage
    chrome.storage.local.get(['geminiApiKey'], async (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            // Try sending saved API key to backend first
            await sendApiKeyToBackend(result.geminiApiKey);
        }
        // Then check backend status
        await checkBackendStatus();
    });
});


// ---- Settings Management ----

btnSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
});

btnSaveSettings.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showSettingsStatus('API anahtarı boş olamaz!', true);
        return;
    }

    // Save to chrome storage
    chrome.storage.local.set({ geminiApiKey: apiKey });

    // Send to backend
    const success = await sendApiKeyToBackend(apiKey);
    if (success) {
        showSettingsStatus('Kaydedildi!');
        // Re-check backend status to update UI
        await checkBackendStatus();
    } else {
        showSettingsStatus('Backend\'e gönderilemedi. Sunucunun çalıştığından emin olun.', true);
    }
});

async function sendApiKeyToBackend(apiKey) {
    try {
        const response = await fetch(`${API_BASE}/api/set-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey })
        });
        return response.ok;
    } catch (e) {
        console.error('Backend bağlantı hatası:', e);
        return false;
    }
}

function showSettingsStatus(msg, isError = false) {
    settingsStatus.textContent = msg;
    settingsStatus.style.color = isError ? 'var(--color-red)' : 'var(--color-green)';
    settingsStatus.classList.add('visible');
    setTimeout(() => settingsStatus.classList.remove('visible'), 3000);
}

// ---- Status & Loading ----

function setStatus(msg, isError = false) {
    statusMessage.textContent = msg;
    statusMessage.classList.remove('hidden', 'error');
    if (isError) statusMessage.classList.add('error');
}

function hideStatus() {
    statusMessage.classList.add('hidden');
}

function setLoading(loading) {
    btnSummarize.disabled = loading;
    btnText.textContent = loading ? 'Analiz Ediliyor...' : 'Bu Sayfayı Özetle';
    loader.classList.toggle('hidden', !loading);
}

// ---- Gauge & Results ----

function updateGauge(score) {
    // Score is 1-10, needle goes from -90deg (0) to +90deg (10)
    const angle = (score / 10) * 180 - 90;
    gaugeNeedle.style.transform = `rotate(${angle}deg)`;
    scoreValue.textContent = score;

    // Color based on score
    let color;
    if (score <= 3) {
        color = 'var(--color-green)';
    } else if (score <= 6) {
        color = 'var(--color-yellow)';
    } else {
        color = 'var(--color-red)';
    }
    scoreValue.style.color = color;
    gaugeNeedle.style.backgroundColor = color;
}

function renderResults(data) {
    // data = { summary_stats: { risk_score, overall_summary, critical_highlight }, analysis_segments: [...] }
    const stats = data.summary_stats;
    const segments = data.analysis_segments || [];

    // Update gauge
    updateGauge(stats.risk_score);

    // Update summary
    summaryText.textContent = stats.overall_summary;

    // Critical highlight
    if (stats.critical_highlight) {
        criticalText.textContent = stats.critical_highlight;
        criticalSection.classList.remove('hidden');
    } else {
        criticalSection.classList.add('hidden');
    }

    // Policy items
    policyList.innerHTML = '';
    segments.forEach(seg => {
        const li = document.createElement('li');
        li.className = `policy-item ${seg.risk_level}`;
        li.innerHTML = `
            <span class="dot"></span>
            <div class="text-content">
                <p class="item-text">${seg.text}</p>
                <p class="item-reason">${seg.reason}</p>
            </div>
        `;
        policyList.appendChild(li);
    });

    // Show results and chat
    resultsSection.classList.remove('hidden');
    chatSection.classList.remove('hidden');
    hideStatus();
}

// ---- Summarize Flow ----

btnSummarize.addEventListener('click', () => {
    // Double-check API key status before attempting
    if (!isApiKeyConfigured) {
        settingsPanel.classList.remove('hidden');
        setStatus('Önce API anahtarınızı ayarlayın.', true);
        return;
    }

    setLoading(true);
    hideStatus();
    resultsSection.classList.add('hidden');
    chatSection.classList.add('hidden');

    // Get text from active tab via content.js
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
            setStatus('Aktif sekme bulunamadı.', true);
            setLoading(false);
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_TEXT' }, async (response) => {
            if (chrome.runtime.lastError || !response || !response.text) {
                setStatus('Sayfa içeriği okunamadı. Sayfayı yenileyip tekrar deneyin.', true);
                setLoading(false);
                return;
            }

            currentContractText = response.text;
            setStatus('Yapay zeka analiz ediyor...');

            try {
                const apiResponse = await fetch(`${API_BASE}/summarize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: currentContractText,
                        url: tabs[0].url,
                        title: tabs[0].title
                    })
                });

                if (!apiResponse.ok) {
                    const errData = await apiResponse.json().catch(() => ({}));
                    throw new Error(errData.detail || `Sunucu hatası: ${apiResponse.status}`);
                }

                const data = await apiResponse.json();

                if (data.error) {
                    setStatus(data.message || 'Bir hata oluştu.', true);
                    setLoading(false);
                    return;
                }

                currentSummaryData = data;
                renderResults(data);
                setLoading(false);
                btnText.textContent = 'Tekrar Özetle';

            } catch (error) {
                console.error('API hatası:', error);
                if (error.message.includes('API anahtarı') || error.message.includes('API key')) {
                    setStatus('API anahtarı geçersiz veya süresi dolmuş. Lütfen Ayarlar\'dan yeni bir anahtar girin.', true);
                    settingsPanel.classList.remove('hidden');
                    isApiKeyConfigured = false;
                    updateConnectionIndicator('no-key');
                } else if (error.message.includes('Failed to fetch')) {
                    setStatus('Backend sunucusuna bağlanılamadı. Sunucunun çalıştığından emin olun (localhost:8000).', true);
                    updateConnectionIndicator('disconnected');
                } else {
                    setStatus(error.message, true);
                }
                setLoading(false);
            }
        });
    });
});

// ---- Copy ----

btnCopy.addEventListener('click', () => {
    if (!currentSummaryData) return;

    const stats = currentSummaryData.summary_stats;
    const segments = currentSummaryData.analysis_segments || [];

    let copyText = `Risk Skoru: ${stats.risk_score}/10\n\n`;
    copyText += `Özet: ${stats.overall_summary}\n\n`;
    if (stats.critical_highlight) {
        copyText += `Kritik Madde: ${stats.critical_highlight}\n\n`;
    }
    copyText += `Politika Analizi:\n`;
    segments.forEach(seg => {
        const label = seg.risk_level === 'red' ? '[Kritik]' : seg.risk_level === 'yellow' ? '[Orta]' : '[Düşük]';
        copyText += `${label} ${seg.text} — ${seg.reason}\n`;
    });

    navigator.clipboard.writeText(copyText).then(() => {
        const btnCopySpan = btnCopy.querySelector('span');
        if (btnCopySpan) {
            const original = btnCopySpan.textContent;
            btnCopySpan.textContent = 'Kopyalandı!';
            setTimeout(() => { btnCopySpan.textContent = original; }, 2000);
        }
    });
});


// ---- Chat ----

function addChatBubble(text, type) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${type}`;
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return bubble;
}

async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message || !currentContractText) return;

    chatInput.value = '';
    btnSend.disabled = true;

    addChatBubble(message, 'user');
    const loadingBubble = addChatBubble('Düşünüyor...', 'assistant loading');

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contract_text: currentContractText,
                message: message
            })
        });

        const data = await response.json();
        loadingBubble.remove();

        if (response.ok) {
            addChatBubble(data.response, 'assistant');
        } else {
            addChatBubble('Yanıt alınamadı. Lütfen tekrar deneyin.', 'assistant');
        }
    } catch (error) {
        loadingBubble.remove();
        addChatBubble('Sunucuya bağlanılamadı.', 'assistant');
    }

    btnSend.disabled = false;
}

btnSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});
