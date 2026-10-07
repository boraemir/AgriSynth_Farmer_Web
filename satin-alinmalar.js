feather.replace();

const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let allPurchases = [];
let statusFilter = 'all';

const CAT_LABELS = { land:'🌾 Arazi', fruit:'🍎 Meyve/Mahsul', animal:'🐄 Hayvan', tree:'🌳 Ağaç/Fidan', equipment:'🚜 Ekipman', other:'📦 Diğer' };
const STATUS_MAP = {
    pending: { cls:'status-pending', label:'Bekleyen', icon:'clock' },
    completed: { cls:'status-completed', label:'Tamamlandı', icon:'check-circle' },
    cancelled: { cls:'status-cancelled', label:'İptal', icon:'x-circle' }
};

window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return window.location.href = 'index.html';
    currentUser = session.user;
    applyThemeIcon();
    await fetchPurchases();
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

async function fetchPurchases() {
    // Purchases tablosunu çek, satıcı ve listing bilgilerini de al
    const { data, error } = await sb
        .from('purchases')
        .select('*, seller:users!purchases_seller_id_fkey(id, ad, soyad, rol, email, telefon, sehir), listing:listings(title, photos, category, location, price)')
        .eq('buyer_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        // FK ismi farklı olabilir, fallback sorgu dene
        await fetchPurchasesFallback();
        return;
    }
    allPurchases = data || [];
    renderStats();
    renderPurchases();
}

async function fetchPurchasesFallback() {
    // FK ismi çalışmazsa satıcı bilgilerini ayrı çek
    const { data: purchases, error } = await sb
        .from('purchases')
        .select('*')
        .eq('buyer_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        document.getElementById('purchasesContainer').innerHTML =
            '<div class="empty-state"><p>Alışverişler yüklenirken hata oluştu.</p></div>';
        return;
    }

    // Satıcı ID'lerini topla
    const sellerIds = [...new Set((purchases || []).map(p => p.seller_id).filter(Boolean))];
    const listingIds = [...new Set((purchases || []).map(p => p.listing_id).filter(Boolean))];

    let sellersMap = {};
    let listingsMap = {};

    if (sellerIds.length) {
        const { data: sellers } = await sb.from('users').select('id, ad, soyad, rol, email, telefon, sehir').in('id', sellerIds);
        (sellers || []).forEach(s => { sellersMap[s.id] = s; });
    }
    if (listingIds.length) {
        const { data: listings } = await sb.from('listings').select('id, title, photos, category, location, price').in('id', listingIds);
        (listings || []).forEach(l => { listingsMap[l.id] = l; });
    }

    allPurchases = (purchases || []).map(p => ({
        ...p,
        seller: sellersMap[p.seller_id] || null,
        listing: listingsMap[p.listing_id] || null
    }));

    renderStats();
    renderPurchases();
}

function renderStats() {
    const total = allPurchases.length;
    const spent = allPurchases.reduce((s, p) => s + (p.price || 0), 0);
    const pending = allPurchases.filter(p => !p.status || p.status === 'pending').length;
    const completed = allPurchases.filter(p => p.status === 'completed').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statSpent').textContent = spent > 0 ? spent.toLocaleString('tr-TR') + ' ₺' : '0 ₺';
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statCompleted').textContent = completed;
}

function setStatusFilter(val, btn) {
    statusFilter = val;
    document.querySelectorAll('[data-sf]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPurchases();
}

function renderPurchases() {
    const container = document.getElementById('purchasesContainer');

    let filtered = allPurchases;
    if (statusFilter === 'pending') filtered = filtered.filter(p => !p.status || p.status === 'pending');
    else if (statusFilter === 'completed') filtered = filtered.filter(p => p.status === 'completed');
    else if (statusFilter === 'cancelled') filtered = filtered.filter(p => p.status === 'cancelled');

    if (!filtered.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-feather="shopping-bag" style="width:56px;height:56px;"></i>
                <h3>Henüz alışveriş yapılmamış</h3>
                <p>İlan pazarından ürün satın aldığınızda burada görünecek.</p>
                <button class="btn-to-market" onclick="window.location.href='ilan.html'">
                    <i data-feather="shopping-bag" style="width:15px;height:15px;"></i> İlan Pazarına Git
                </button>
            </div>`;
        feather.replace();
        return;
    }

    container.innerHTML = filtered.map(p => {
        const status = p.status || 'pending';
        const sm = STATUS_MAP[status] || STATUS_MAP.pending;
        const dateStr = new Date(p.created_at).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
        const timeStr = new Date(p.created_at).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
        const priceText = p.price ? `${Number(p.price).toLocaleString('tr-TR')} ₺` : null;
        const sellerName = p.seller ? `${p.seller.ad} ${p.seller.soyad}` : (p.seller_name || 'Satıcı');
        const sellerRole = p.seller?.rol || '';
        const catLabel = CAT_LABELS[p.category] || '📦 Diğer';

        // Cover photo from listing
        let coverPhoto = '';
        try {
            const ph = p.listing?.photos ? JSON.parse(p.listing.photos) : [];
            coverPhoto = ph[0] || '';
        } catch(e) {}

        return `
        <div class="purchase-card">
            <div class="purchase-card-top">
                ${coverPhoto
                    ? `<img src="${coverPhoto}" class="purchase-img" alt="${p.title}">`
                    : `<div class="purchase-img-placeholder"><i data-feather="image" style="width:32px;height:32px;opacity:0.3;"></i></div>`
                }
                <div class="purchase-body">
                    <div class="purchase-top-row">
                        <div class="purchase-title">${p.title || p.listing?.title || 'İlan'}</div>
                        ${priceText
                            ? `<div class="purchase-price">${priceText}</div>`
                            : `<div class="purchase-price free">Ücretsiz</div>`
                        }
                    </div>
                    <div class="purchase-meta-row">
                        <div class="purchase-meta-item">
                            <i data-feather="map-pin"></i>
                            ${p.location || p.listing?.location || '—'}
                        </div>
                        <div class="purchase-meta-item">
                            <i data-feather="tag"></i>
                            ${catLabel}
                        </div>
                        <div class="purchase-meta-item">
                            <i data-feather="calendar"></i>
                            ${dateStr} ${timeStr}
                        </div>
                    </div>
                    <span class="purchase-status ${sm.cls}">
                        <i data-feather="${sm.icon}" style="width:11px;height:11px;"></i>
                        ${sm.label}
                    </span>
                </div>
            </div>
            <div class="purchase-footer">
                <div class="seller-row">
                    <div class="seller-avatar">${sellerName.charAt(0).toUpperCase()}</div>
                    <div class="seller-detail">
                        <h5>${sellerName}</h5>
                        <span>${sellerRole === 'ciftci' || sellerRole === 'çiftçi' ? '🌾 Çiftçi' : '👤 Bireysel'}</span>
                    </div>
                </div>
                <div class="footer-actions">
                    <button class="btn-msg" onclick="messageSellerFromPurchase('${p.seller_id || ''}')">
                        <i data-feather="message-circle" style="width:13px;height:13px;"></i> Mesaj
                    </button>
                    <button class="btn-view-listing" onclick="openPurchaseDrawer('${p.id}')">
                        <i data-feather="info" style="width:13px;height:13px;"></i> Detay
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
    feather.replace();
}

function messageSellerFromPurchase(sellerId) {
    if (!sellerId) return;
    window.location.href = `normal-user.html?tab=messages&chatUserId=${sellerId}`;
}

// ── DETAIL DRAWER ──
function openPurchaseDrawer(purchaseId) {
    const p = allPurchases.find(x => x.id === purchaseId);
    if (!p) return;

    const status = p.status || 'pending';
    const sm = STATUS_MAP[status] || STATUS_MAP.pending;
    const dateStr = new Date(p.created_at).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
    const timeStr = new Date(p.created_at).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
    const sellerName = p.seller ? `${p.seller.ad} ${p.seller.soyad}` : (p.seller_name || 'Satıcı');
    const sellerRole = p.seller?.rol || '';
    const priceText = p.price ? `${Number(p.price).toLocaleString('tr-TR')} ₺` : 'Ücretsiz';
    const catLabel = CAT_LABELS[p.category] || '📦 Diğer';

    document.getElementById('drawerBody').innerHTML = `
        <div class="drawer-section">
            <div class="drawer-section-label"><i data-feather="package"></i>Ürün Bilgileri</div>
            <div class="info-grid">
                <div class="info-box">
                    <div class="info-box-label">Ürün Adı</div>
                    <div class="info-box-value">${p.title || '—'}</div>
                </div>
                <div class="info-box">
                    <div class="info-box-label">Tutar</div>
                    <div class="info-box-value" style="color:var(--primary)">${priceText}</div>
                </div>
                <div class="info-box">
                    <div class="info-box-label">Kategori</div>
                    <div class="info-box-value">${catLabel}</div>
                </div>
                <div class="info-box">
                    <div class="info-box-label">Konum</div>
                    <div class="info-box-value">${p.location || '—'}</div>
                </div>
                <div class="info-box">
                    <div class="info-box-label">Tarih</div>
                    <div class="info-box-value">${dateStr}</div>
                </div>
                <div class="info-box">
                    <div class="info-box-label">Saat</div>
                    <div class="info-box-value">${timeStr}</div>
                </div>
                <div class="info-box" style="grid-column:1/-1;">
                    <div class="info-box-label">Durum</div>
                    <div style="margin-top:6px;">
                        <span class="purchase-status ${sm.cls}">
                            <i data-feather="${sm.icon}" style="width:11px;height:11px;"></i> ${sm.label}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div class="drawer-section">
            <div class="drawer-section-label"><i data-feather="user"></i>Satıcı Bilgileri</div>
            <div class="seller-full-card" style="margin-bottom:14px;">
                <div class="seller-full-avatar">${sellerName.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="seller-full-name">${sellerName}</div>
                    <div class="seller-full-role">${sellerRole === 'ciftci' || sellerRole === 'çiftçi' ? '🌾 Çiftçi' : '👤 Bireysel Kullanıcı'}</div>
                </div>
            </div>
            <div class="contact-grid">
                ${p.seller?.email ? `
                <div class="contact-item">
                    <div class="contact-item-icon"><i data-feather="mail" style="width:16px;height:16px;"></i></div>
                    <div>
                        <div class="contact-item-label">E-posta</div>
                        <div class="contact-item-value">${p.seller.email}</div>
                    </div>
                </div>` : ''}
                ${p.seller?.telefon ? `
                <div class="contact-item">
                    <div class="contact-item-icon"><i data-feather="phone" style="width:16px;height:16px;"></i></div>
                    <div>
                        <div class="contact-item-label">Telefon</div>
                        <div class="contact-item-value">${p.seller.telefon}</div>
                    </div>
                </div>` : ''}
                ${p.seller?.sehir ? `
                <div class="contact-item">
                    <div class="contact-item-icon"><i data-feather="map-pin" style="width:16px;height:16px;"></i></div>
                    <div>
                        <div class="contact-item-label">Şehir</div>
                        <div class="contact-item-value">${p.seller.sehir}</div>
                    </div>
                </div>` : ''}
                ${!p.seller?.email && !p.seller?.telefon && !p.seller?.sehir
                    ? '<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:16px;">Satıcı iletişim bilgisi bulunamadı.</div>'
                    : ''}
            </div>
        </div>

        ${p.seller_id ? `
        <div class="drawer-section">
            <div class="drawer-section-label"><i data-feather="zap"></i>Eylemler</div>
            <button class="btn-msg" style="width:100%;justify-content:center;padding:12px;"
                onclick="messageSellerFromPurchase('${p.seller_id}')">
                <i data-feather="message-circle" style="width:15px;height:15px;"></i> Satıcıya Mesaj Gönder
            </button>
        </div>` : ''}
    `;

    feather.replace();
    document.getElementById('drawerOverlay').classList.add('open');
}
function closeDrawer() { document.getElementById('drawerOverlay').classList.remove('open'); }