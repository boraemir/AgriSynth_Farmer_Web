feather.replace();

// ── TEMA ──
function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme') || 'light';
    const next = curr === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('AgriSynth-theme', next);
    const btn = document.getElementById('themeToggleBtn');
    btn.setAttribute('data-feather', next === 'light' ? 'moon' : 'sun');
    feather.replace();
    if (weatherChart) weatherChart.update();
}

// ── SUPABASE ──
const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let userNotes = [];
let selectedImages = [];
let weatherChart;

// ── INIT ──
window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) return window.location.href = 'index.html';
    currentUser = session.user;
// Veritabanından ad, soyad ve avatar_url çekiliyor
    const { data: profile }  = await supabaseClient.from('users').select('ad, soyad, avatar_url').eq('id', currentUser.id).single();
    
    if (profile) {
        document.getElementById('userName').innerText = profile.ad + ' ' + profile.soyad;
        document.getElementById('welcomeText').innerText = `Merhaba ${profile.ad}! 👋`;
        
        // --- YENİ EKLENEN FOTOĞRAF KONTROLÜ KISMI ---
        const avatarDiv = document.getElementById('userAvatar');
        const avatarImg = document.getElementById('userAvatarImg');

        if (profile.avatar_url) {
            // Veritabanında fotoğraf varsa:
            avatarDiv.style.display = 'none'; // Harf kutusunu gizle
            avatarImg.src = profile.avatar_url; // Fotoğraf linkini img'ye ver
            avatarImg.style.display = 'block'; // Fotoğrafı görünür yap
        } else {
            // Fotoğraf yoksa:
            avatarDiv.innerText = profile.ad.charAt(0).toUpperCase();
            avatarDiv.style.display = 'flex'; // Harfi göster
            avatarImg.style.display = 'none'; // Fotoğrafı gizle
        }
        // -------------------------------------------
    }

    initHomePage();
    fetchNotes();
    fetchWeather('Istanbul');

    // ── YENİ: BİLDİRİM BADGE YÜKLE ──
    await loadNotifBadge();

    // ── YENİ: REAL-TIME BİLDİRİM DİNLE ──
    supabaseClient
        .channel('notif-badge')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUser.id}`
        }, () => {
            loadNotifBadge();
            showToast('🔔 Yeni bildiriminiz var!', 'success');
        })
        .subscribe();

    // URL parametresi kontrolü
    const urlParams = new URLSearchParams(window.location.search);
    const chatUserId = urlParams.get('chatUserId');
    const openTab = urlParams.get('tab');

    if (chatUserId && openTab === 'messages') {
        window.history.replaceState({}, '', window.location.pathname);
        const msgNavItem = document.querySelector('.nav-item[onclick*="messages-tab"]');
        switchTab('messages-tab', msgNavItem);
        setTimeout(() => msgInitChatFromUrl(chatUserId), 600);
    }
});

// ── YENİ: BİLDİRİM BADGE FONKSİYONU ──
async function loadNotifBadge() {
    try {
        const { count } = await supabaseClient
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);

        const badge = document.getElementById('navNotifBadge');
        const homeCount = document.getElementById('homeNotifCount');

        if (badge) {
            if (count > 0) {
                badge.style.display = 'flex';
                badge.textContent = count > 9 ? '9+' : count;
            } else {
                badge.style.display = 'none';
            }
        }
        if (homeCount) {
            homeCount.textContent = count || 0;
        }
    } catch(e) {
        console.error('Bildirim badge hatası:', e);
    }
}

// ── TOAST ──
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.className = `toast ${type}`;
    document.getElementById('toastIcon').setAttribute('data-feather', type === 'success' ? 'check-circle' : 'alert-circle');
    feather.replace();
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}

function showGlobalError(msg) {
    const box = document.getElementById('apiWarning');
    box.innerHTML = `<i data-feather="alert-circle" style="width:18px;"></i> ${msg}`;
    box.style.display = 'flex'; feather.replace();
}

async function logout() { await supabaseClient.auth.signOut(); window.location.href = 'index.html'; }

function switchTab(tabId, element) {
    document.querySelectorAll('.tab-section').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (element) element.classList.add('active');

    const mainContent = document.getElementById('mainContent');
    if (tabId === 'calendar-tab') {
        mainContent.style.overflow = 'hidden';
        mainContent.style.padding = '0';
        calInitialized = false;
        initCalendarTab();
    } else if (tabId === 'messages-tab') {
        mainContent.style.overflow = 'hidden';
        mainContent.style.padding = '0';
        msgLoadConversations();
    } else {
        mainContent.style.overflow = '';
        mainContent.style.padding = '';
    }
    if (tabId === 'notes-tab') fetchNotes();
}

function switchTabById(tabId) {
    const navItem = [...document.querySelectorAll('.nav-item')].find(el => el.getAttribute('onclick')?.includes(tabId));
    switchTab(tabId, navItem || document.querySelector('.nav-item'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (navItem) navItem.classList.add('active');
}

function initHomePage() {
    const now = new Date();
    const tr_months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const tr_days = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
    document.getElementById('heroDate').textContent =
        `${tr_days[now.getDay()]}, ${now.getDate()} ${tr_months[now.getMonth()]} ${now.getFullYear()}`;

    const month = now.getMonth() + 1;
    let season;
    if (month >= 3 && month <= 5) season = 'ilkbahar';
    else if (month >= 6 && month <= 8) season = 'yaz';
    else if (month >= 9 && month <= 11) season = 'sonbahar';
    else season = 'kis';

    const seasonEl = document.getElementById(`season-${season}`);
    if (seasonEl) {
        seasonEl.style.background = 'rgba(16,185,129,0.1)';
        seasonEl.style.borderColor = 'var(--primary)';
        seasonEl.style.color = 'var(--primary)';
    }

    const tips = {
        ilkbahar: ['İlkbaharda toprak hazırlığı için derin sürüm yapın. Geçen yılın hasat artıklarını toprağa karıştırmak organik maddeyi artırır.','Domates ve biber fidelerini dışarıya almadan önce 1–2 hafta sertleştirme uygulayın.','Meyve ağaçlarında tomurcuk dönemi budaması için en uygun zaman Mart-Nisan aylarıdır.'],
        yaz: ['Sıcak havalarda sulama sabah erken veya akşam üzeri yapılmalı; öğlen sulamak su kaybını artırır.','Yaz aylarında zararlı böceklere dikkat edin. Yaprak altlarını düzenli kontrol edin.','Yazlık sebzelerde gübre uygulamasını çiçeklenme döneminde azaltın; azot fazlalığı meyve tutumunu düşürür.'],
        sonbahar: ['Sonbaharda kış ekimlerine hazırlık için tarlayı sürerek yeşil gübre (mürdümük, fiğ) ekin.','Meyve ağaçlarının kış budamasını sonbahar yaprak dökümünden sonra başlatın.','Depolanacak sebze ve meyveleri hasarı olmayan, sağlıklı olanlardan seçin. Küçük bir çürük tüm depoyu etkiler.'],
        kis: ['Kış aylarında sera koşullarını kontrol edin; gece sıcaklığı 10°C altına düşmemeli.','Bu dönem ekipmanlarınızı bakıma alın. Traktör ve sulama sistemlerini kış öncesi servise gönderin.','Kış, tohumluk seçimi ve sipariş için en uygun dönemdir. Nisan ekiniz için şimdiden planlayın.']
    };
    const seasonTips = tips[season];
    document.getElementById('agriTipText').textContent = seasonTips[now.getDate() % seasonTips.length];
    document.getElementById('heroTemp').textContent = '18°';
    document.getElementById('heroCity').textContent = 'İstanbul';
    document.getElementById('heroWeatherDesc').textContent = 'Açık ve güneşli';
}

function renderUpcomingNotes() {
    const container = document.getElementById('upcomingNotesContainer');
    if (!container) return;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const upcoming = userNotes.filter(n => n.note_date && n.note_time && n.note_date >= todayStr).sort((a, b) => (a.note_date + a.note_time).localeCompare(b.note_date + b.note_time)).slice(0, 5);
    if (!upcoming.length) {
        container.innerHTML = `<div class="upcoming-empty"><i data-feather="calendar" style="width:28px;height:28px;"></i>Yaklaşan takvim notu yok</div>`;
        feather.replace(); return;
    }
    const colorDots = ['#10b981','#8b5cf6','#f59e0b','#3b82f6','#ec4899','#ef4444'];
    const tr_months_short = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    container.innerHTML = upcoming.map(note => {
        const d = new Date(note.note_date + 'T00:00:00');
        const isToday = note.note_date === todayStr;
        const dateLabel = isToday ? 'Bugün' : `${d.getDate()} ${tr_months_short[d.getMonth()]}`;
        return `<div class="upcoming-item" onclick="switchTabById('calendar-tab')">
            <div class="upcoming-dot" style="background:${colorDots[note.color || 0]};"></div>
            <div class="upcoming-info">
                <div class="upcoming-title">${note.title}</div>
                <div class="upcoming-time">${note.note_time ? note.note_time.substring(0,5) : ''}</div>
            </div>
            <span class="upcoming-date-badge">${dateLabel}</span>
        </div>`;
    }).join('');
    feather.replace();
}

function renderRecentNotes() {
    const container = document.getElementById('recentNotesContainer');
    if (!container) return;
    const recent = userNotes.slice(0, 4);
    if (!recent.length) {
        container.innerHTML = `<div class="upcoming-empty"><i data-feather="file-text" style="width:28px;height:28px;"></i>Henüz not eklenmedi</div>`;
        feather.replace(); return;
    }
    container.innerHTML = recent.map(note => `
        <div class="recent-note-item" onclick="switchTabById('notes-tab')">
            <div class="recent-note-title">${note.title}</div>
            <div class="recent-note-preview">${note.content}</div>
        </div>`).join('');
}

// ══════════════════════════════════════════════
//  MESAJLAŞMA SİSTEMİ
// ══════════════════════════════════════════════
let msgCurrentChatId = null;
let msgActiveUser = null;
let msgSubscription = null;
let msgAllConversations = [];

async function msgLoadConversations() {
    const list = document.getElementById('msgConvList');
    list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;"><i data-feather="loader" style="animation:spin 1s linear infinite;width:18px;display:block;margin:0 auto 8px;"></i>Yükleniyor...</div>`;
    feather.replace();

    const { data: chats, error } = await supabaseClient.from('chats').select('id, user1_id, user2_id, created_at').or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`);
    if (error) { list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">Sohbetler yüklenemedi.<br><small>${error.message}</small></div>`; return; }
    if (!chats || chats.length === 0) { list.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted);font-size:13px;">Henüz mesajınız yok.</div>`; return; }

    const otherUserIds = chats.map(c => c.user1_id === currentUser.id ? c.user2_id : c.user1_id);
    const { data: usersData } = await supabaseClient.from('users').select('id, ad, soyad, rol').in('id', [...new Set(otherUserIds)]);
    const usersMap = {};
    (usersData || []).forEach(u => { usersMap[u.id] = u; });

    const enriched = [];
    for (const chat of chats) {
        const otherId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
        const other = usersMap[otherId] || { id: otherId, ad: 'Kullanıcı', soyad: '', rol: '' };
        const { data: lastMsgs } = await supabaseClient.from('messages').select('content, created_at, sender_id').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(1);
        enriched.push({ chat, other, last: lastMsgs?.[0] || null });
    }
    enriched.sort((a, b) => {
        const tA = a.last ? new Date(a.last.created_at).getTime() : new Date(a.chat.created_at).getTime();
        const tB = b.last ? new Date(b.last.created_at).getTime() : new Date(b.chat.created_at).getTime();
        return tB - tA;
    });

    msgAllConversations = chats;
    list.innerHTML = '';
    enriched.forEach(({ chat, other, last }) => {
        const preview = last ? (last.sender_id === currentUser.id ? 'Sen: ' + last.content : last.content) : 'Sohbet başlatıldı';
        const timeStr = last ? new Date(last.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
        const initial = (other.ad || '?').charAt(0).toUpperCase();
        const displayName = `${other.ad} ${other.soyad}`.trim();
        const item = document.createElement('div');
        item.className = `msg-conv-item${msgCurrentChatId === chat.id ? ' active' : ''}`;
        item.dataset.chatId = chat.id;
        item.dataset.name = displayName.toLowerCase();
        item.onclick = () => msgOpenChat(chat.id, other);
        item.innerHTML = `
            <div class="msg-conv-avatar">${initial}</div>
            <div class="msg-conv-info">
                <div class="msg-conv-name"><span>${displayName}</span><span class="msg-conv-time">${timeStr}</span></div>
                <div class="msg-conv-preview">${preview.length > 42 ? preview.substring(0, 42) + '...' : preview}</div>
            </div>`;
        list.appendChild(item);
    });
    feather.replace();
    msgSetupRealtime();
}

function filterConversations() {
    const q = document.getElementById('msgSearchInput').value.toLowerCase();
    document.querySelectorAll('.msg-conv-item').forEach(el => { el.style.display = el.dataset.name.includes(q) ? '' : 'none'; });
}

async function msgOpenChat(chatId, otherUser) {
    msgCurrentChatId = chatId;
    msgActiveUser = otherUser;
    if (window.innerWidth <= 768) { document.getElementById('msgSidebar').classList.add('hidden'); }
    document.getElementById('msgEmptyState').style.display = 'none';
    document.getElementById('msgChatHeader').style.display = 'flex';
    document.getElementById('msgMessages').style.display = 'flex';
    document.getElementById('msgInputWrap').style.display = 'flex';
    document.getElementById('msgActiveAvatar').textContent = (otherUser.ad || '?').charAt(0).toUpperCase();
    document.getElementById('msgActiveName').textContent = `${otherUser.ad} ${otherUser.soyad}`;
    document.getElementById('msgActiveStatus').textContent = otherUser.rol === 'ciftci' || otherUser.rol === 'çiftçi' ? 'Çiftçi' : 'Kullanıcı';
    document.querySelectorAll('.msg-conv-item').forEach(el => { el.classList.toggle('active', el.dataset.chatId === chatId); });
    await msgLoadMessages();
    document.getElementById('msgInput').focus();
}

function msgShowSidebar() { document.getElementById('msgSidebar').classList.remove('hidden'); }

async function msgLoadMessages() {
    if (!msgCurrentChatId) return;
    const container = document.getElementById('msgMessages');
    container.innerHTML = '';
    const { data, error } = await supabaseClient.from('messages').select('*').eq('chat_id', msgCurrentChatId).order('created_at', { ascending: true });
    if (error) return;
    let lastDate = null;
    (data || []).forEach(msg => {
        const msgDate = new Date(msg.created_at).toLocaleDateString('tr-TR');
        if (msgDate !== lastDate) {
            const sep = document.createElement('div');
            sep.className = 'msg-date-sep';
            sep.textContent = msgDate === new Date().toLocaleDateString('tr-TR') ? 'Bugün' : msgDate;
            container.appendChild(sep);
            lastDate = msgDate;
        }
        msgAppend(msg, false);
    });
    msgScrollBottom();
}

function msgAppend(msg, scroll = true) {
    const container = document.getElementById('msgMessages');
    const isMe = msg.sender_id === currentUser.id;
    const time = new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const existing = document.getElementById(`msg-${msg.id}`);
    if (existing) { existing.remove(); }
    const row = document.createElement('div');
    row.className = `msg-row ${isMe ? 'sent' : 'received'}`;
    row.id = `msg-${msg.id}`;
    const actions = isMe ? `
        <div class="msg-actions-wrap">
            <button class="msg-act-btn" onclick="msgPrepEdit('${msg.id}', \`${msg.content.replace(/`/g,'\\`').replace(/'/g,"\\'")}\`)">
                <i data-feather="edit-2" style="width:11px;"></i> Düzenle
            </button>
            <button class="msg-act-btn del" onclick="msgDelete('${msg.id}')">
                <i data-feather="trash-2" style="width:11px;"></i> Sil
            </button>
        </div>` : '';
    row.innerHTML = `
        ${actions}
        <div class="msg-bubble">${msg.content.replace(/\n/g,'<br>')}</div>
        <div class="msg-time">
            ${msg.is_edited ? '<span class="msg-edited">(düzenlendi)</span>' : ''}
            <span>${time}</span>
        </div>`;
    container.appendChild(row);
    feather.replace();
    if (scroll) msgScrollBottom();
}

function msgScrollBottom() { const c = document.getElementById('msgMessages'); if (c) c.scrollTop = c.scrollHeight; }
function msgHandleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); msgSend(); } }
function msgAutoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

async function msgSend() {
    const input = document.getElementById('msgInput');
    const content = input.value.trim();
    const editId = document.getElementById('msgEditId').value;
    if (!content || !msgCurrentChatId) return;
    input.value = ''; input.style.height = 'auto';
    msgCancelEdit();
    if (editId) {
        await supabaseClient.from('messages').update({ content, is_edited: true }).eq('id', editId);
    } else {
        await supabaseClient.from('messages').insert([{ chat_id: msgCurrentChatId, sender_id: currentUser.id, content }]);
        await supabaseClient.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', msgCurrentChatId);
    }
}

function msgPrepEdit(id, content) {
    document.getElementById('msgEditId').value = id;
    document.getElementById('msgInput').value = content;
    document.getElementById('msgInput').focus();
    document.getElementById('msgEditBanner').classList.add('show');
    feather.replace();
}
function msgCancelEdit() { document.getElementById('msgEditId').value = ''; document.getElementById('msgEditBanner').classList.remove('show'); }
async function msgDelete(id) {
    if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
    await supabaseClient.from('messages').delete().eq('id', id);
    const el = document.getElementById(`msg-${id}`); if (el) el.remove();
}

function msgSetupRealtime() {
    if (msgSubscription) supabaseClient.removeChannel(msgSubscription);
    msgSubscription = supabaseClient.channel('msg-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
            const { eventType, new: nw, old: ow } = payload;
            if (eventType === 'INSERT' && nw.chat_id === msgCurrentChatId) msgAppend(nw, true);
            else if (eventType === 'UPDATE' && nw.chat_id === msgCurrentChatId) msgLoadMessages();
            else if (eventType === 'DELETE' && ow.chat_id === msgCurrentChatId) { const el = document.getElementById(`msg-${ow.id}`); if (el) el.remove(); }
            msgLoadConversations();
        }).subscribe();
}

async function msgInitChatFromUrl(targetUserId) {
    if (!currentUser || targetUserId === currentUser.id) return;
    const { data: targetUser, error } = await supabaseClient.from('users').select('id, ad, soyad, rol').eq('id', targetUserId).single();
    if (error || !targetUser) return;
    const id1 = currentUser.id < targetUserId ? currentUser.id : targetUserId;
    const id2 = currentUser.id < targetUserId ? targetUserId : currentUser.id;
    let { data: chat } = await supabaseClient.from('chats').select('*').eq('user1_id', id1).eq('user2_id', id2).maybeSingle();
    if (!chat) {
        const { data: newChat, error: createErr } = await supabaseClient.from('chats').insert([{ user1_id: id1, user2_id: id2 }]).select().single();
        if (createErr) return;
        chat = newChat;
    }
    await msgLoadConversations();
    await msgOpenChat(chat.id, targetUser);
}

// ── NOTLAR ──
async function fetchNotes() {
    const loading = document.getElementById('notesLoading');
    if (loading) loading.style.display = 'flex';
    const { data, error } = await supabaseClient.from('notes').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (loading) loading.style.display = 'none';
    if (error) { console.error(error); return; }
    userNotes = data || [];
    document.getElementById('statNotes').innerText = userNotes.length;
    renderNotes();
    renderUpcomingNotes();
    renderRecentNotes();
}

function renderNotes() {
    const container = document.getElementById('notesContainer');
    if (!userNotes.length) { container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);">Henüz not eklemediniz.</div>'; return; }
    container.innerHTML = userNotes.map(note => {
        const imagesHtml = note.images?.length ? `<div class="note-images">${note.images.map((img, i) => `<div class="note-image-item" onclick="viewImage('${img}')"><img src="${img}" alt="${i+1}"></div>`).join('')}</div>` : '';
        const tagsHtml = note.tags?.length ? `<div class="note-tags">${note.tags.map(t => `<span class="note-tag"><i data-feather="tag"></i>${t}</span>`).join('')}</div>` : '';
        let calBadge = '';
        if (note.note_date && note.note_time) {
            const d = new Date(note.note_date + 'T00:00:00');
            const calLabel = `${d.getDate()} ${CAL_TR_MONTHS[d.getMonth()]} ${d.getFullYear()} – ${note.note_time.substring(0,5)}`;
            calBadge = `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(16,185,129,0.1);color:var(--primary);border:1px solid rgba(16,185,129,0.25);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-bottom:10px;"><i data-feather="calendar" style="width:11px;height:11px;"></i>${calLabel}</span>`;
        }
        return `<div class="note-card">
            <div class="note-header">
                <div class="note-title-section">
                    <div class="note-title"><i data-feather="file-text"></i>${note.title}</div>
                    <div class="note-date"><i data-feather="clock"></i>${new Date(note.created_at).toLocaleDateString('tr-TR')}</div>
                </div>
            </div>
            ${calBadge}${imagesHtml}
            <div class="note-content">${note.content}</div>
            ${tagsHtml}
            <div class="note-footer">
                <button class="btn-edit" onclick="editNote('${note.id}')"><i data-feather="edit-2"></i> Düzenle</button>
                <button class="btn-delete" onclick="deleteNoteItem('${note.id}')"><i data-feather="trash-2"></i> Sil</button>
            </div>
        </div>`;
    }).join('');
    feather.replace();
}

let noteSelectedColor = 0;
function selectNoteColor(c) {
    noteSelectedColor = c;
    document.querySelectorAll('.note-cal-color-dot').forEach(b => b.classList.remove('selected'));
    document.querySelector(`.note-cal-color-dot[data-nc="${c}"]`).classList.add('selected');
}

function openNoteModal() {
    document.getElementById('noteForm').reset();
    document.getElementById('noteId').value = '';
    document.getElementById('noteModalTitle').innerText = 'Yeni Not';
    document.getElementById('noteDate').value = '';
    document.getElementById('noteTime').value = '';
    document.getElementById('noteEndTime').value = '';
    selectedImages = [];
    document.getElementById('imagePreviewContainer').innerHTML = '';
    selectNoteColor(0);
    document.getElementById('noteModalOverlay').classList.add('active');
    feather.replace();
}
function closeNoteModal() { document.getElementById('noteModalOverlay').classList.remove('active'); }

function editNote(id) {
    const note = userNotes.find(n => n.id === id);
    if (!note) return;
    document.getElementById('noteId').value = note.id;
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContent').value = note.content;
    document.getElementById('noteTags').value = note.tags ? note.tags.join(', ') : '';
    document.getElementById('noteDate').value = note.note_date || '';
    document.getElementById('noteTime').value = note.note_time ? note.note_time.substring(0,5) : '';
    document.getElementById('noteEndTime').value = note.end_time ? note.end_time.substring(0,5) : '';
    selectNoteColor(note.color || 0);
    selectedImages = note.images ? note.images.map(img => ({ dataUrl: img })) : [];
    updateImagePreview();
    document.getElementById('noteModalTitle').innerText = 'Notu Düzenle';
    document.getElementById('noteModalOverlay').classList.add('active');
    feather.replace();
}

async function saveNote() {
    const id = document.getElementById('noteId').value;
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    if (!title || !content) { alert('Başlık ve içerik zorunludur!'); return; }
    const tags = document.getElementById('noteTags').value.split(',').map(t => t.trim()).filter(t => t);
    const images = selectedImages.map(img => img.dataUrl);
    const noteDate = document.getElementById('noteDate').value || null;
    const noteTime = document.getElementById('noteTime').value || null;
    const endTime = document.getElementById('noteEndTime').value || null;
    if (noteDate && !noteTime) { alert('Takvime eklemek için saat de girilmelidir!'); document.getElementById('noteTime').focus(); return; }
    const noteData = { title, content, user_id: currentUser.id, images, tags, note_date: noteDate, note_time: noteTime, end_time: endTime, color: noteSelectedColor };
    let error;
    if (id) { const r = await supabaseClient.from('notes').update(noteData).eq('id', id); error = r.error; }
    else    { const r = await supabaseClient.from('notes').insert([noteData]); error = r.error; }
    if (error) { alert('Hata: ' + error.message); return; }
    closeNoteModal();
    fetchNotes();
    if (calInitialized) { await calFetchNotes(); } else { calInitialized = false; }
}

async function deleteNoteItem(id) {
    if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    const { error } = await supabaseClient.from('notes').delete().eq('id', id);
    if (error) { alert('Hata: ' + error.message); return; }
    fetchNotes();
}

function handleImageSelect(event) {
    const files = Array.from(event.target.files);
    if (selectedImages.length + files.length > 5) { alert('En fazla 5 fotoğraf!'); return; }
    files.forEach(file => { const reader = new FileReader(); reader.onload = e => { selectedImages.push({ file, dataUrl: e.target.result }); updateImagePreview(); }; reader.readAsDataURL(file); });
}
function updateImagePreview() {
    document.getElementById('imagePreviewContainer').innerHTML = selectedImages.map((img, i) => `<div class="image-preview-item"><img src="${img.dataUrl}" alt=""><button class="remove-image" onclick="removeImage(${i})"><i data-feather="x"></i></button></div>`).join('');
    feather.replace();
}
function removeImage(i) { selectedImages.splice(i, 1); updateImagePreview(); }
function viewImage(src) { window.open(src, '_blank'); }

// ── HAVA DURUMU ──
async function fetchWeather(query) {
    document.getElementById('weatherLoading').style.display = 'flex';
    document.getElementById('weatherContent').style.display = 'none';
    setTimeout(() => {
        document.getElementById('weatherLocation').innerText = query + ', Türkiye';
        document.getElementById('weatherTemp').innerText = '18°';
        document.getElementById('weatherHumidity').innerText = '65%';
        document.getElementById('weatherWind').innerText = '12 km/s';
        const ctx = document.getElementById('forecastChart').getContext('2d');
        if (weatherChart) weatherChart.destroy();
        weatherChart = new Chart(ctx, { type: 'line', data: { labels: ['Pazartesi','Salı','Çarşamba'], datasets: [{ label: 'Sıcaklık', data: [18,20,17], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
        document.getElementById('weatherLoading').style.display = 'none';
        document.getElementById('weatherContent').style.display = 'block';
        feather.replace();
    }, 800);
}
function searchWeatherCity() { const c = document.getElementById('weatherCityInput').value; if (c) fetchWeather(c); }
function getWeatherLocation() { navigator.geolocation?.getCurrentPosition(p => fetchWeather(`${p.coords.latitude},${p.coords.longitude}`), () => alert('Konum izni verilmedi')); }

// ══════════════════════════════════════════════════
//  TAKVİM FONKSİYONLARI
// ══════════════════════════════════════════════════
let calNotes = [];
let calWeekOffset = 0;
let calSelectedColor = 0;
let calInitialized = false;
let calNowTimer = null;

const CAL_TR_DAYS   = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const CAL_TR_MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function calToDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function calGetWeekDays(offset = 0) {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
    monday.setHours(0,0,0,0);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}

function initCalendarTab() { if (calInitialized) return; calInitialized = true; calFetchNotes(); }

async function calFetchNotes() {
    const loader = document.getElementById('calLoader');
    if (loader) loader.style.display = 'flex';
    const days = calGetWeekDays(calWeekOffset);
    const { data, error } = await supabaseClient.from('notes').select('id, title, content, note_date, note_time, end_time, color').eq('user_id', currentUser.id).gte('note_date', calToDateStr(days[0])).lte('note_date', calToDateStr(days[6])).not('note_date', 'is', null).not('note_time', 'is', null).order('note_time', { ascending: true });
    if (loader) loader.style.display = 'none';
    if (error) { console.error('Takvim notu hatası:', error); return; }
    calNotes = data || [];
    document.getElementById('homeCalCount').innerText = calNotes.length;
    calRenderShell();
    calScrollToNow();
}

function calChangeWeek(dir) { calWeekOffset += dir; calFetchNotes(); }
function calGoToday() { calWeekOffset = 0; calFetchNotes(); }

function calRenderShell() {
    const days = calGetWeekDays(calWeekOffset);
    const today = calToDateStr(new Date());
    const first = days[0], last = days[6];
    document.getElementById('calWeekLabel').innerHTML =
        `${first.getDate()} ${CAL_TR_MONTHS[first.getMonth()]} – ${last.getDate()} ${CAL_TR_MONTHS[last.getMonth()]} ${last.getFullYear()}<span>${calWeekOffset === 0 ? 'Bu Hafta' : calWeekOffset > 0 ? `+${calWeekOffset} hafta` : `${calWeekOffset} hafta`}</span>`;
    const dh = document.getElementById('calDaysHeader');
    dh.innerHTML = '<div class="cal-days-spacer"></div>';
    days.forEach((d, i) => {
        const isToday = calToDateStr(d) === today;
        const dayNotes = calNotes.filter(n => calNormDate(n.note_date) === calToDateStr(d));
        const dots = dayNotes.slice(0, 3).map(() => `<div class="cal-dot"></div>`).join('');
        dh.innerHTML += `<div class="cal-day-cell ${isToday ? 'cal-today' : ''}" onclick="calOpenAddModal('${calToDateStr(d)}', null)">
            <div class="cal-day-name">${CAL_TR_DAYS[i]}</div>
            <div class="cal-day-num">${d.getDate()}</div>
            ${dots ? `<div class="cal-day-dots">${dots}</div>` : ''}
        </div>`;
    });
    const grid = document.getElementById('calGrid');
    grid.innerHTML = '';
    const timeCol = document.createElement('div');
    timeCol.className = 'cal-time-col';
    for (let h = 0; h < 24; h++) {
        const slot = document.createElement('div');
        slot.className = 'cal-time-slot';
        slot.innerHTML = `<span>${String(h).padStart(2,'0')}:00</span>`;
        timeCol.appendChild(slot);
    }
    grid.appendChild(timeCol);
    days.forEach((d) => {
        const dateStr = calToDateStr(d);
        const isToday = dateStr === today;
        const col = document.createElement('div');
        col.className = `cal-col${isToday ? ' cal-today-col' : ''}`;
        for (let h = 0; h < 24; h++) {
            const cell = document.createElement('div');
            cell.className = 'cal-hour-cell';
            cell.addEventListener('click', e => { if (e.target === cell) calOpenAddModal(dateStr, h); });
            col.appendChild(cell);
        }
        calNotes.filter(n => calNormDate(n.note_date) === dateStr).forEach(note => calPlaceBlock(col, note));
        if (isToday) {
            const hourH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cal-hour-h')) || 72;
            const now = new Date();
            const line = document.createElement('div');
            line.className = 'cal-now-line'; line.id = 'calNowLine';
            line.style.top = ((now.getHours() + now.getMinutes() / 60) * hourH) + 'px';
            col.appendChild(line);
            if (calNowTimer) clearInterval(calNowTimer);
            calNowTimer = setInterval(() => {
                const n = new Date();
                const hH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cal-hour-h')) || 72;
                const el = document.getElementById('calNowLine');
                if (el) el.style.top = ((n.getHours() + n.getMinutes() / 60) * hH) + 'px';
            }, 60000);
        }
        grid.appendChild(col);
    });
    feather.replace();
}

function calNormDate(val) { if (!val) return null; return String(val).substring(0, 10); }
function calNormTime(val) { if (!val) return null; return String(val).substring(0, 5); }

function calPlaceBlock(col, note) {
    const timeRaw = calNormTime(note.note_time);
    if (!timeRaw) return;
    const [hh, mm] = timeRaw.split(':').map(Number);
    const hourH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cal-hour-h')) || 72;
    const topPx = (hh + mm / 60) * hourH;
    let durMin = 60;
    if (note.end_time) {
        const endRaw = calNormTime(note.end_time);
        const [eh, em] = endRaw.split(':').map(Number);
        durMin = (eh * 60 + em) - (hh * 60 + mm);
        if (durMin <= 0) durMin = 30;
    }
    const heightPx = Math.max((durMin / 60) * hourH - 4, 28);
    const block = document.createElement('div');
    block.className = `cal-note-block cal-color-${note.color || 0}`;
    block.style.top = topPx + 'px';
    block.style.height = heightPx + 'px';
    const endStr = note.end_time ? ` – ${calNormTime(note.end_time)}` : '';
    block.innerHTML = `<div class="cal-note-title">${note.title}</div><div class="cal-note-time">${timeRaw}${endStr}</div>`;
    block.addEventListener('click', e => { e.stopPropagation(); calOpenDetail(note); });
    col.appendChild(block);
}

function calScrollToNow() {
    const hourH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cal-hour-h')) || 72;
    const scrollTo = Math.max(0, (new Date().getHours() - 1) * hourH);
    setTimeout(() => { const s = document.getElementById('calScroll'); if (s) s.scrollTop = scrollTo; }, 200);
}

function calOpenAddModal(date = null, hour = null) {
    const today = calToDateStr(new Date());
    document.getElementById('calNoteDate').value = date || today;
    document.getElementById('calNoteTime').value = hour !== null ? `${String(hour).padStart(2,'0')}:00` : '';
    document.getElementById('calNoteEndTime').value = hour !== null ? `${String(Math.min(hour+1,23)).padStart(2,'0')}:00` : '';
    document.getElementById('calNoteTitle').value = '';
    document.getElementById('calNoteDesc').value = '';
    calSelectColor(0);
    document.getElementById('calAddModal').classList.add('open');
    setTimeout(() => document.getElementById('calNoteTitle').focus(), 100);
    feather.replace();
}
function calCloseAddModal() { document.getElementById('calAddModal').classList.remove('open'); }
function calSelectColor(c) {
    calSelectedColor = c;
    document.querySelectorAll('.cal-color-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`.cal-color-btn[data-c="${c}"]`).classList.add('selected');
}

async function calSaveNote() {
    const title = document.getElementById('calNoteTitle').value.trim();
    const desc  = document.getElementById('calNoteDesc').value.trim();
    const date  = document.getElementById('calNoteDate').value;
    const time  = document.getElementById('calNoteTime').value;
    const end   = document.getElementById('calNoteEndTime').value;
    if (!title) { document.getElementById('calNoteTitle').focus(); return; }
    if (!date)  { document.getElementById('calNoteDate').focus(); return; }
    if (!time)  { document.getElementById('calNoteTime').focus(); return; }
    const btn = document.getElementById('calSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i data-feather="loader" class="cal-spin" style="width:13px;height:13px;"></i> Kaydediliyor...';
    feather.replace();
    const { error } = await supabaseClient.from('notes').insert([{ user_id: currentUser.id, title, content: desc || title, note_date: date, note_time: time, end_time: end || null, color: calSelectedColor, images: [], tags: [] }]);
    btn.disabled = false;
    btn.innerHTML = '<i data-feather="check" style="width:13px;height:13px;"></i> Kaydet';
    feather.replace();
    if (error) { alert('Hata: ' + error.message); return; }
    calCloseAddModal();
    await calFetchNotes();
}

function calOpenDetail(note) {
    const colorNames = ['Yeşil','Mor','Sarı','Mavi','Pembe','Kırmızı'];
    const t = calNormTime(note.note_time);
    const endT = calNormTime(note.end_time);
    const timeStr = t + (endT ? ` – ${endT}` : '');
    const dateRaw = calNormDate(note.note_date);
    const dateObj = new Date(dateRaw + 'T00:00:00');
    const dateStr = `${dateObj.getDate()} ${CAL_TR_MONTHS[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    const bodyText = note.content && note.content !== note.title ? note.content : null;
    document.getElementById('calDetailCard').innerHTML = `
        <div class="cal-detail-hero cal-color-${note.color || 0}">
            <div class="cal-detail-type">${colorNames[note.color || 0]} · ${dateStr}</div>
            <div class="cal-detail-title">${note.title}</div>
            <div class="cal-detail-time"><i data-feather="clock" style="width:12px;height:12px;"></i> ${timeStr}</div>
        </div>
        ${bodyText ? `<div class="cal-detail-body"><div class="cal-detail-desc">${bodyText}</div></div>` : '<div style="height:12px;"></div>'}
        <div class="cal-detail-footer">
            <button class="cal-btn-delete" onclick="calDeleteNote('${note.id}')"><i data-feather="trash-2" style="width:13px;height:13px;"></i> Sil</button>
            <div style="flex:1;"></div>
            <button class="cal-btn-cancel" onclick="calCloseDetail()" style="cursor:pointer;">Kapat</button>
        </div>`;
    feather.replace();
    document.getElementById('calDetailModal').classList.add('open');
}
function calCloseDetail() { document.getElementById('calDetailModal').classList.remove('open'); }

async function calDeleteNote(id) {
    if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    const { error } = await supabaseClient.from('notes').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) { alert('Silme hatası: ' + error.message); return; }
    calCloseDetail();
    await calFetchNotes();
}

document.getElementById('calAddModal').addEventListener('click', e => { if (e.target === document.getElementById('calAddModal')) calCloseAddModal(); });
document.getElementById('calDetailModal').addEventListener('click', e => { if (e.target === document.getElementById('calDetailModal')) calCloseDetail(); });
document.getElementById('calNoteTitle').addEventListener('keydown', e => { if (e.key === 'Enter') calSaveNote(); });