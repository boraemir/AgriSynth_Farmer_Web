feather.replace();

// --------------------------------------------------------
// AYARLAR VE API BİLGİLERİ
// --------------------------------------------------------
const GROQ_API_KEY = '';
const GROQ_URL = '';

const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SYSTEM_PROMPT = "Sen AgriSynth platformunun uzman, profesyonel ve yardımsever yapay zeka asistanısın. Görevin çiftçilere, yetiştiricilere ve veterinerlere tarım, hayvancılık, bitki hastalıkları, gübreleme ve sürü yönetimi konularında net, bilimsel ve anlaşılır Türkçe cevaplar vermektir. Karmaşık terimleri basitçe açıkla.";

let currentUser = null;
let activeChatId = null;
let savedChats = []; 

// --------------------------------------------------------
// BAŞLANGIÇ YÜKLEMELERİ
// --------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => { 
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) { window.location.href = "index.html"; return; }
    currentUser = session.user;
    
    const { data: profile } = await supabaseClient.from('users').select('rol').eq('id', currentUser.id).single();
    if (profile && profile.rol === 'doktor') {
        document.querySelector('.back-panel-btn').setAttribute('href', 'doktor.html');
    }

    loadLocalHistory();
});

// --------------------------------------------------------
// LOCAL STORAGE (JSON) YÖNETİMİ
// --------------------------------------------------------
function getStorageKey() {
    return `AgriSynth_ai_${currentUser.id}`;
}

function loadLocalHistory() {
    const historyStr = localStorage.getItem(getStorageKey());
    if(historyStr) {
        savedChats = JSON.parse(historyStr);
    } else {
        savedChats = [];
    }
    renderSidebarChats();
}

function saveToLocalStorage() {
    localStorage.setItem(getStorageKey(), JSON.stringify(savedChats));
    renderSidebarChats();
}

function renderSidebarChats() {
    const listEl = document.getElementById('chatHistoryList');
    listEl.innerHTML = '';
    
    if(savedChats.length === 0) return;

    [...savedChats].reverse().forEach(chat => {
        const div = document.createElement('div');
        div.className = `history-item ${activeChatId === chat.id ? 'active' : ''}`;
        div.onclick = () => loadChatMessages(chat.id);
        
        div.innerHTML = `
            <div class="history-title"><i data-feather="message-square" style="width:14px;"></i> <span>${chat.title}</span></div>
            <div class="history-actions">
                <button class="action-btn" onclick="event.stopPropagation(); renameChat('${chat.id}', '${chat.title}')"><i data-feather="edit-2" style="width:12px;"></i></button>
                <button class="action-btn delete" onclick="event.stopPropagation(); deleteChat('${chat.id}')"><i data-feather="trash-2" style="width:12px;"></i></button>
            </div>
        `;
        listEl.appendChild(div);
    });
    feather.replace();
}

function startNewChat() {
    activeChatId = null;
    document.getElementById('messagesContainer').innerHTML = document.getElementById('emptyState').outerHTML;
    document.getElementById('emptyState').style.display = 'flex';
    
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    if(window.innerWidth <= 768) closeSidebarOnMobile();
}

function loadChatMessages(chatId) {
    activeChatId = chatId;
    document.getElementById('emptyState').style.display = 'none';
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    renderSidebarChats(); 
    if(window.innerWidth <= 768) closeSidebarOnMobile();

    const currentChat = savedChats.find(c => c.id === chatId);
    if(currentChat && currentChat.messages) {
        currentChat.messages.forEach(msg => {
            appendMessageUI(msg.role, msg.content);
        });
    }
    scrollToBottom();
}

function renameChat(id, oldTitle) {
    const newTitle = prompt("Sohbetin yeni adını girin:", oldTitle);
    if(newTitle && newTitle.trim() !== "") {
        const chat = savedChats.find(c => c.id === id);
        if(chat) {
            chat.title = newTitle.trim();
            saveToLocalStorage();
        }
    }
}

function deleteChat(id) {
    if(confirm("Bu sohbeti cihazınızdan tamamen silmek istediğinize emin misiniz?")) {
        savedChats = savedChats.filter(c => c.id !== id);
        saveToLocalStorage();
        if(activeChatId === id) startNewChat();
    }
}

// --------------------------------------------------------
// MESAJ GÖNDERME VE GROQ API BAĞLANTISI
// --------------------------------------------------------
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function closeSidebarOnMobile() { document.getElementById('sidebar').classList.remove('open'); }

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight < 200 ? textarea.scrollHeight : 200) + 'px';
}

function handleEnter(e) {
    if(e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
}

async function handleSend() {
    const inputEl = document.getElementById('userInput');
    const text = inputEl.value.trim();
    const btn = document.getElementById('sendBtn');

    if(!text) return;

    let currentChat = savedChats.find(c => c.id === activeChatId);
    
    if(!currentChat) {
        const title = text.length > 30 ? text.substring(0, 30) + "..." : text;
        currentChat = {
            id: 'chat_' + Date.now(),
            title: title,
            messages: []
        };
        savedChats.push(currentChat);
        activeChatId = currentChat.id;
    }

    document.getElementById('emptyState').style.display = 'none';
    appendMessageUI('user', text);
    
    currentChat.messages.push({ role: 'user', content: text });
    saveToLocalStorage();

    inputEl.value = ''; inputEl.style.height = 'auto';
    scrollToBottom();

    inputEl.disabled = true; btn.disabled = true;
    const loadingId = addLoadingUI();
    scrollToBottom();

    const apiContext = currentChat.messages.map(m => ({ role: m.role, content: m.content }));

    try {
        // MODEL İSMİ DÜZELTİLDİ (llama-3.3-70b-versatile)
        const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile', 
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...apiContext
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Groq API Hatası:", errorData);
            throw new Error(errorData.error?.message || `HTTP Hatası: ${response.status}`);
        }

        const data = await response.json();
        const aiResponseText = data.choices[0].message.content;

        document.getElementById(loadingId).remove();
        appendMessageUI('assistant', aiResponseText);
        scrollToBottom();

        currentChat.messages.push({ role: 'assistant', content: aiResponseText });
        saveToLocalStorage();

    } catch (error) {
        document.getElementById(loadingId).remove();
        console.error("Tam Hata Çıktısı:", error);
        appendMessageUI('assistant', `⚠️ **Bir Hata Oluştu:** ${error.message}`);
        scrollToBottom();
    } finally {
        inputEl.disabled = false; btn.disabled = false; inputEl.focus();
    }
}

// --------------------------------------------------------
// UI YARDIMCI FONKSİYONLARI
// --------------------------------------------------------
function appendMessageUI(role, content) {
    const container = document.getElementById('messagesContainer');
    const isUser = role === 'user';
    
    const avatarHtml = isUser 
        ? `<div class="avatar user">U</div>` 
        : `<div class="avatar ai"><i data-feather="cpu" style="width:20px;"></i></div>`;
    
    const formattedContent = content.replace(/\n/g, '<br>');

    const html = `
        <div class="message-row ${isUser ? '' : 'ai'}">
            <div class="message-content">
                ${avatarHtml}
                <div class="text-content">${formattedContent}</div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    feather.replace();
}

function addLoadingUI() {
    const id = 'loading-' + Date.now();
    const container = document.getElementById('messagesContainer');
    const html = `
        <div class="message-row ai" id="${id}">
            <div class="message-content">
                <div class="avatar ai"><i data-feather="cpu" style="width:20px;"></i></div>
                <div class="text-content" style="display:flex; align-items:center;">
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    feather.replace();
    return id;
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// --- AĞIRLAŞTIRILMIŞ GÜVENLİK VE KONSOL ENGELLEME ---

// 1. Sağ Tıklamayı Tamamen Engelle
document.addEventListener('contextmenu', event => event.preventDefault());

// 2. Klavye Kısayollarını Engelle (F12, Ctrl+U, Inspect vb.)
document.addEventListener('keydown', function(e) {
    if (
        e.keyCode === 123 || // F12
        (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
        (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
        (e.ctrlKey && e.shiftKey && e.keyCode === 67) || // Ctrl+Shift+C
        (e.ctrlKey && e.keyCode === 85) // Ctrl+U
    ) {
        e.preventDefault();
        return false;
    }
});

// 3. Konsola mesaj bırak ve temizle
setInterval(function() {
    console.clear();
    console.log("%cDİKKAT!", "color: red; font-size: 40px; font-weight: bold; text-shadow: 2px 2px 0 #000;");
    console.log("%cBu sistem AgriSynth güvenlik protokolleri ile korunmaktadır. İzinsiz erişim denemesi kaydediliyor.", "font-size: 16px; font-weight: bold;");
}, 1000);

// 4. NÜKLEER SEÇENEK: Geliştirici Araçları (DevTools) Açıldığını Boyuttan Algılama
const detectDevTools = function() {
    const widthThreshold = window.outerWidth - window.innerWidth > 160;
    const heightThreshold = window.outerHeight - window.innerHeight > 160;
    
    if (widthThreshold || heightThreshold) {
        document.body.innerHTML = `
            <div style="display:flex; height:100vh; width:100vw; background:#0f172a; color:#ef4444; align-items:center; justify-content:center; flex-direction:column; font-family:sans-serif;">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:20px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <h1 style="font-size:24px; font-weight:bold;">Güvenlik İhlali Tespit Edildi</h1>
                <p style="color:#94a3b8; margin-top:10px;">Geliştirici araçlarını kapatıp sayfayı yenileyin.</p>
            </div>
        `;
    }
};
setInterval(detectDevTools, 500);

// 5. SON DARBE: Debugger Tuzağı
setInterval(function() {
    (function() { return false; }['constructor']('debugger')());
}, 100);
