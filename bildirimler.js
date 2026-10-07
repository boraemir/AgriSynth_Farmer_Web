feather.replace();

const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let allNotifs = [];
let currentTab = 'all';

window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return window.location.href = 'index.html';
    currentUser = session.user;
    applyThemeIcon();
    await loadNotifs();

    // Gerçek zamanlı dinle
    sb.channel('notifs')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUser.id}`
        }, () => loadNotifs())
        .subscribe();
});

function goBack() {
    const r = localStorage.getItem('AgriSynth-role') || '';
    window.location.href = (r === 'ciftci' || r === 'çiftçi') ? 'ciftci.html' : 'normal-user.html';
}

function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme') || 'light';
    const next = curr === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('AgriSynth-theme', next);
    applyThemeIcon();
}

function applyThemeIcon() {
    const t = document.documentElement.getAttribute('data-theme') || 'light';
    document.getElementById('themeIcon').setAttribute('data-feather', t === 'dark' ? 'sun' : 'moon');
    feather.replace();
}

async function loadNotifs() {
    showSkeletons();
    const { data, error } = await sb
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) { showToast('Yüklenemedi: ' + error.message, 'error'); return; }
    allNotifs = data || [];
    renderNotifs();
}

function showSkeletons() {
    document.getElementById('notifList').innerHTML = Array(3).fill(0).map(() => `
        <div class="skeleton-notif" style="margin-bottom:14px;">
            <div class="skel-line" style="height:18px;width:55%;"></div>
            <div class="skel-line" style="height:14px;width:80%;"></div>
            <div class="skel-line" style="height:14px;width:40%;"></div>
        </div>`).join('');
}

function setTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderNotifs();
}

function renderNotifs() {
    let items = allNotifs;
    if (currentTab === 'unread') items = items.filter(n => !n.is_read);
    if (currentTab === 'purchase_request') items = items.filter(n => n.type === 'purchase_request');

    const container = document.getElementById('notifList');

    if (!items.length) {
        container.innerHTML = `<div class="empty-state">
            <div class="emoji">🔔</div>
            <h3>Bildirim yok</h3>
            <p>Henüz bu kategoride bildiriminiz bulunmuyor.</p>
        </div>`;
        return;
    }

    container.innerHTML = `<div class="notif-list">${items.map(n => renderNotifCard(n)).join('')}</div>`;
    feather.replace();
}

function renderNotifCard(n) {
    const d = n.data || {};
    const dateStr = new Date(n.created_at).toLocaleString('tr-TR', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const iconMap = {
        purchase_request: { emoji: '🛒', cls: 'purchase' },
        purchase_approved: { emoji: '✅', cls: 'approved' },
        purchase_rejected: { emoji: '❌', cls: 'rejected' },
        info: { emoji: 'ℹ️', cls: 'info' }
    };
    const icon = iconMap[n.type] || iconMap.info;

    let actionsHtml = '';

    if (n.type === 'purchase_request' && d.purchase_id) {
        // Eğer bu bildirime daha önceden onay/red verildiyse "status" anahtarı kayıtlıdır.
        if (d.status === 'completed' || d.status === 'cancelled') {
            const st = d.status;
            actionsHtml = `
                <div class="notif-product-box">
                    <div>
                        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;">İlan</div>
                        <div class="notif-product-name">${d.listing_title || '—'}</div>
                    </div>
                    <div class="notif-product-price">${d.price ? Number(d.price).toLocaleString('tr-TR') + ' ₺' : 'Fiyat yok'}</div>
                </div>
                <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
                    <strong style="color:var(--text-main);">Alıcı:</strong> ${d.buyer_name || '—'}
                </div>
                <div class="notif-actions">
                    <span class="status-chip ${st === 'completed' ? 'completed' : 'cancelled'}">
                        ${st === 'completed' ? '✅ Onaylandı' : '❌ Reddedildi'}
                    </span>
                    ${!n.is_read ? `<button class="btn-mark-read" onclick="markRead('${n.id}')">Okundu işaretle</button>` : ''}
                </div>`;
        } else {
            // Henüz cevap verilmemişse Butonları göster
            actionsHtml = `
                <div class="notif-product-box">
                    <div>
                        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;">İlan</div>
                        <div class="notif-product-name">${d.listing_title || '—'}</div>
                    </div>
                    <div class="notif-product-price">${d.price ? Number(d.price).toLocaleString('tr-TR') + ' ₺' : 'Fiyat yok'}</div>
                </div>
                <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
                    <strong style="color:var(--text-main);">Alıcı:</strong> ${d.buyer_name || '—'}
                </div>
                <div class="notif-actions" id="actions-${n.id}">
                    <button class="btn-approve" onclick="handlePurchase('${n.id}', 'completed')">
                        <i data-feather="check" style="width:14px;height:14px;"></i> Onayla
                    </button>
                    <button class="btn-reject" onclick="handlePurchase('${n.id}', 'cancelled')">
                        <i data-feather="x" style="width:14px;height:14px;"></i> Reddet
                    </button>
                    <button class="btn-msg" onclick="sendMsgToBuyer('${d.buyer_id}')">
                        <i data-feather="message-circle" style="width:14px;height:14px;"></i> Mesaj Gönder
                    </button>
                </div>`;
        }
    } else if (n.type === 'purchase_approved' || n.type === 'purchase_rejected') {
        const st = n.type === 'purchase_approved' ? 'completed' : 'cancelled';
        actionsHtml = `
            <div class="notif-actions">
                <span class="status-chip ${st === 'completed' ? 'completed' : 'cancelled'}">
                    ${st === 'completed' ? '✅ Onaylandı' : '❌ Reddedildi'}
                </span>
                ${!n.is_read ? `<button class="btn-mark-read" onclick="markRead('${n.id}')">Okundu işaretle</button>` : ''}
            </div>`;
    } else {
        actionsHtml = !n.is_read
            ? `<div class="notif-actions"><button class="btn-mark-read" onclick="markRead('${n.id}')">Okundu işaretle</button></div>`
            : '';
    }

    return `
    <div class="notif-card ${!n.is_read ? 'unread' : ''}" id="notif-${n.id}">
        ${!n.is_read ? '<div class="unread-dot"></div>' : ''}
        <div class="notif-top">
            <div class="notif-icon ${icon.cls}">${icon.emoji}</div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-msg">${n.message || ''}</div>
                <div class="notif-meta">
                    <span class="notif-meta-item">
                        <i data-feather="clock" style="width:12px;height:12px;"></i>${dateStr}
                    </span>
                </div>
            </div>
        </div>
        ${actionsHtml}
    </div>`;
}

// ── SATIN ALMA ONAYLA / REDDET GÜNCELLENDİ ──
async function handlePurchase(notifId, newStatus) {
    // Tüm notif listesinden o anki bildirimi buluyoruz (XSS açıklarını tamamen engeller)
    const notif = allNotifs.find(n => n.id === notifId);
    if (!notif) return;
    
    const d = notif.data || {};
    const isApprove = newStatus === 'completed';
    const actionsEl = document.getElementById(`actions-${notifId}`);
    
    if (actionsEl) {
        actionsEl.querySelectorAll('button').forEach(b => b.disabled = true);
    }

    // 1) purchases tablosunda status güncelle
    const { error: pErr } = await sb
        .from('purchases')
        .update({ status: newStatus })
        .eq('id', d.purchase_id);

    if (pErr) {
        showToast('Güncelleme hatası: ' + pErr.message, 'error');
        if (actionsEl) actionsEl.querySelectorAll('button').forEach(b => b.disabled = false);
        return;
    }

    // 2) EĞER ONAYLANDIYSA İLANI SİL
    if (isApprove && d.listing_id) {
        await sb.from('listings').delete().eq('id', d.listing_id);
    }

    // 3) Bildirimi okundu işaretle ve DATA içine status ekle ki ekranda "Onaylandı/Reddedildi" yazsın
    const newData = { ...d, status: newStatus };
    await sb.from('notifications')
        .update({ is_read: true, data: newData })
        .eq('id', notifId);

    // 4) Alıcıya sonuç bildirimi gönder
    const notifType = isApprove ? 'purchase_approved' : 'purchase_rejected';
    const notifTitle = isApprove ? '✅ Satın Alma Onaylandı!' : '❌ Satın Alma Reddedildi';
    const notifMsg = isApprove
        ? `"${d.listing_title}" için satın alma talebiniz satıcı tarafından onaylandı.`
        : `"${d.listing_title}" için satın alma talebiniz satıcı tarafından reddedildi.`;

    await sb.from('notifications').insert([{
        user_id: d.buyer_id,
        type: notifType,
        title: notifTitle,
        message: notifMsg,
        data: { purchase_id: d.purchase_id, listing_title: d.listing_title }
    }]);

    showToast(isApprove ? 'Talep onaylandı, ilan silindi!' : 'Talep reddedildi.', isApprove ? 'success' : 'error');
    
    // Değişikliğin anında ekrana yansıması için listeyi baştan yükle
    await loadNotifs();
}

// ── OKUNDU İŞARETLE ──
async function markRead(notifId) {
    await sb.from('notifications').update({ is_read: true }).eq('id', notifId);
    await loadNotifs();
}

// ── MESAJ GÖNDER (alıcı sayfasına yönlendir) ──
function sendMsgToBuyer(buyerId) {
    const r = localStorage.getItem('AgriSynth-role') || '';
    const base = (r === 'ciftci' || r === 'çiftçi') ? 'ciftci.html' : 'normal-user.html';
    window.location.href = `${base}?tab=messages&chatUserId=${buyerId}`;
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.className = `toast ${type}`;
    document.getElementById('toastIcon').setAttribute('data-feather', type === 'success' ? 'check-circle' : 'alert-circle');
    feather.replace();
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}