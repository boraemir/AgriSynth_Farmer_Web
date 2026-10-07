feather.replace();

const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let userRole = '';
let allListings = [];
let typeFilter = 'all';
let catFilter = 'all';
let selectedPhotos = [];
let currentDetailListing = null;
let currentSlide = 0;
let pendingPurchaseListing = null;

// KATEGORİ İSİMLERİNE VETERİNER EKLENDİ
const CAT_LABELS = { land:'🌾 Arazi', fruit:'🍎 Meyve/Mahsul', animal:'🐄 Hayvan', tree:'🌳 Ağaç/Fidan', equipment:'🚜 Ekipman', veteriner:'🩺 Veteriner / Sağlık', other:'📦 Diğer' };

// ── INIT ──
window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return window.location.href = 'index.html';
    currentUser = session.user;

    try {
        const { data: prof } = await sb.from('users').select('rol').eq('id', currentUser.id).single();
        userRole = (prof?.rol || '').toLowerCase();
        localStorage.setItem('AgriSynth-role', userRole);
    } catch(e) {}

    applyThemeIcon();
    await fetchListings();
    await loadNotifBadge(); // 🔔 Bildirim sayısını yükle
});

function goBack() {
    const r = localStorage.getItem('AgriSynth-role') || '';
    window.location.href = (r === 'ciftci' || r === 'çiftçi') ? 'ciftci.html' : 'normal-user.html';
}

// ── THEME ──
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

// ── BİLDİRİM BADGE ──
async function loadNotifBadge() {
    try {
        const { count } = await sb
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);
        const badge = document.getElementById('notifBadge');
        if (badge && count > 0) {
            badge.style.display = 'flex';
            badge.textContent = count > 9 ? '9+' : count;
        }
    } catch(e) {}
}

// ── FETCH ──
async function fetchListings() {
    showSkeletons();

    const { data: listings, error } = await sb
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Listings error:', error);
        showToast('İlanlar yüklenemedi: ' + error.message, 'error');
        document.getElementById('listingsContainer').innerHTML =
            `<div class="empty-state">
                <i data-feather="alert-circle" style="width:40px;height:40px;"></i>
                <h3>Yüklenemedi</h3>
                <p>${error.message}</p>
             </div>`;
        feather.replace();
        return;
    }

    if (!listings || listings.length === 0) {
        allListings = [];
        updateCounts();
        applyFilters();
        return;
    }

    const userIds = [...new Set(listings.map(l => l.user_id).filter(Boolean))];
    let usersMap = {};

    if (userIds.length) {
        const { data: usersData } = await sb
            .from('users')
            .select('id, ad, soyad, rol')
            .in('id', userIds);
        (usersData || []).forEach(u => { usersMap[u.id] = u; });
    }

    allListings = listings.map(l => ({
        ...l,
        users: usersMap[l.user_id] || null
    }));

    updateCounts();
    applyFilters();
}

function showSkeletons() {
    const c = document.getElementById('listingsContainer');
    c.innerHTML = `<div class="skeleton-grid">${Array(6).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-body">
                <div class="skeleton-line price"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
            </div>
        </div>`).join('')}</div>`;
}

function updateCounts() {
    document.getElementById('count-all').textContent = allListings.length;
    document.getElementById('count-sell').textContent = allListings.filter(l => l.listing_type === 'sell').length;
    document.getElementById('count-buy').textContent = allListings.filter(l => l.listing_type === 'buy').length;
    document.getElementById('count-mine').textContent = allListings.filter(l => l.user_id === currentUser.id).length;
}

// ── FILTERS ──
function setTypeFilter(val, btn) {
    typeFilter = val;
    document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
}
function setCatFilter(val, btn) {
    catFilter = val;
    document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
}

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const priceMin = parseFloat(document.getElementById('priceMin').value) || 0;
    const priceMax = parseFloat(document.getElementById('priceMax').value) || Infinity;
    const sort = document.getElementById('sortSelect').value;

    let filtered = allListings;

    if (typeFilter === 'sell') filtered = filtered.filter(l => l.listing_type === 'sell');
    else if (typeFilter === 'buy') filtered = filtered.filter(l => l.listing_type === 'buy');
    else if (typeFilter === 'mine') filtered = filtered.filter(l => l.user_id === currentUser.id);

    if (catFilter !== 'all') filtered = filtered.filter(l => l.category === catFilter);

    if (search) filtered = filtered.filter(l =>
        (l.title || '').toLowerCase().includes(search) ||
        (l.description || '').toLowerCase().includes(search) ||
        (l.location || '').toLowerCase().includes(search)
    );

    filtered = filtered.filter(l => {
        if (!l.price) return true;
        return l.price >= priceMin && l.price <= priceMax;
    });

    if (sort === 'oldest') filtered = [...filtered].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sort === 'price-asc') filtered = [...filtered].sort((a,b) => (a.price||0) - (b.price||0));
    else if (sort === 'price-desc') filtered = [...filtered].sort((a,b) => (b.price||0) - (a.price||0));

    document.getElementById('resultCount').textContent = filtered.length;
    renderListings(filtered);
}

// ── RENDER ──
function renderListings(items) {
    const c = document.getElementById('listingsContainer');
    if (!items.length) {
        c.innerHTML = `<div class="empty-state">
            <i data-feather="inbox" style="width:56px;height:56px;"></i>
            <h3>İlan bulunamadı</h3>
            <p>Filtrelerinizi değiştirerek tekrar deneyin.</p>
        </div>`;
        feather.replace(); return;
    }

    c.innerHTML = `<div class="listings-grid">${items.map(item => {
        const isMine = item.user_id === currentUser.id;
        const photos = safeParsePhotos(item.photos);
        const cover = photos[0] || '';
        const priceHtml = item.price
            ? `<div class="card-price">${Number(item.price).toLocaleString('tr-TR')} ₺</div>`
            : `<div class="card-price no-price">Fiyat belirtilmemiş</div>`;
        const sellerName = item.users ? `${item.users.ad} ${item.users.soyad}` : 'Kullanıcı';
        const dateStr = new Date(item.created_at).toLocaleDateString('tr-TR', {day:'numeric',month:'short',year:'numeric'});

        return `
        <div class="listing-card ${isMine ? 'is-mine' : ''}" onclick="openDetail('${item.id}')">
            <div class="card-img-wrap">
                ${cover
                    ? `<img src="${cover}" class="card-img" alt="${item.title}" loading="lazy">`
                    : `<div class="card-img-placeholder"><i data-feather="image" style="width:40px;height:40px;"></i><span>Fotoğraf yok</span></div>`
                }
                <span class="card-type-badge ${item.listing_type === 'sell' ? 'badge-sell' : 'badge-buy'}">${item.listing_type === 'sell' ? 'Satılık' : 'Aranıyor'}</span>
                <span class="card-category-badge">${CAT_LABELS[item.category] || '📦'}</span>
                ${photos.length > 1 ? `<div class="card-img-count"><i data-feather="image" style="width:10px;height:10px;"></i>${photos.length}</div>` : ''}
            </div>
            <div class="card-body">
                ${priceHtml}
                <div class="card-title">${item.title}</div>
                <div class="card-location"><i data-feather="map-pin" style="width:12px;height:12px;"></i>${item.location}</div>
            </div>
            <div class="card-footer">
                <div class="card-seller">
                    <div class="seller-mini-avatar">${sellerName.charAt(0).toUpperCase()}</div>
                    <span class="seller-mini-name">${sellerName}</span>
                </div>
                <span class="card-date">${dateStr}</span>
            </div>
            ${isMine ? `
            <div class="card-my-actions">
                <button class="btn-edit-sm" onclick="event.stopPropagation();openEditModal('${item.id}')">
                    <i data-feather="edit-2" style="width:12px;height:12px;"></i> Düzenle
                </button>
                <button class="btn-delete-sm" onclick="event.stopPropagation();deleteListing('${item.id}')">
                    <i data-feather="trash-2" style="width:12px;height:12px;"></i>
                </button>
            </div>` : ''}
        </div>`;
    }).join('')}</div>`;
    feather.replace();
}

// ── DETAIL MODAL ──
function openDetail(id) {
    const item = allListings.find(l => l.id === id);
    if (!item) return;
    currentDetailListing = item;
    currentSlide = 0;

    const photos = safeParsePhotos(item.photos);
    const isMine = item.user_id === currentUser.id;
    const sellerName = item.users ? `${item.users.ad} ${item.users.soyad}` : 'Kullanıcı';
    const sellerRole = item.users?.rol || '';
    const priceText = item.price ? `${Number(item.price).toLocaleString('tr-TR')} ₺` : 'Fiyat belirtilmemiş';
    const dateStr = new Date(item.created_at).toLocaleDateString('tr-TR', {day:'numeric',month:'long',year:'numeric'});

    const photoHtml = photos.length
        ? photos.map((p, i) => `<div class="photo-slide ${i===0?'active':''}" id="slide-${i}"><img src="${p}" alt="Fotoğraf ${i+1}"></div>`).join('')
        : `<div class="photo-no-img"><i data-feather="image" style="width:48px;height:48px;"></i><span style="font-size:13px;">Fotoğraf yok</span></div>`;

    const dotsHtml = photos.length > 1
        ? `<div class="slider-nav">${photos.map((_,i) => `<div class="slider-dot ${i===0?'active':''}" onclick="goToSlide(${i})"></div>`).join('')}</div>` : '';

    const arrowsHtml = photos.length > 1
        ? `<button class="slider-prev" onclick="prevSlide()"><i data-feather="chevron-left" style="width:16px;height:16px;"></i></button>
           <button class="slider-next" onclick="nextSlide()"><i data-feather="chevron-right" style="width:16px;height:16px;"></i></button>` : '';

    const actionsHtml = isMine
        ? `<button class="btn-close-detail" onclick="closeDetailModal();openEditModal('${item.id}')"><i data-feather="edit-2" style="width:14px;height:14px;"></i> Düzenle</button>
           <button class="btn-close-detail" onclick="closeDetailModal()">Kapat</button>`
        : `<button class="btn-close-detail" onclick="closeDetailModal()">Kapat</button>
           <button class="btn-contact" onclick="contactSeller('${item.user_id}')">
               <i data-feather="message-circle" style="width:15px;height:15px;"></i> Mesaj Gönder
           </button>
           ${item.listing_type === 'sell' ? `<button class="btn-purchase" onclick="openPurchaseModal('${item.id}')">
               <i data-feather="shopping-cart" style="width:15px;height:15px;"></i> Satın Al
           </button>` : ''}`;

    document.getElementById('detailInner').innerHTML = `
        <div class="photo-section">
            <div class="photo-slider" id="photoSlider">
                ${photoHtml}
                ${dotsHtml}
                ${arrowsHtml}
            </div>
        </div>
        <div class="detail-info">
            <div class="detail-type-row">
                <span class="detail-badge ${item.listing_type}">${item.listing_type === 'sell' ? 'Satılık' : 'Aranıyor'}</span>
                <span class="detail-badge cat">${CAT_LABELS[item.category] || '📦 Diğer'}</span>
            </div>
            <div class="detail-price ${!item.price ? 'no-price' : ''}">${priceText}</div>
            <div class="detail-title">${item.title}</div>
            <div class="detail-location"><i data-feather="map-pin" style="width:14px;height:14px;"></i>${item.location}</div>

            <div class="detail-meta-grid">
                <div class="detail-meta-box">
                    <div class="detail-meta-label">İlan Tarihi</div>
                    <div class="detail-meta-value">${dateStr}</div>
                </div>
                <div class="detail-meta-box">
                    <div class="detail-meta-label">Kategori</div>
                    <div class="detail-meta-value">${CAT_LABELS[item.category] || 'Diğer'}</div>
                </div>
            </div>

            ${item.description ? `
            <div class="detail-section-label"><i data-feather="align-left" style="width:13px;height:13px;"></i>Açıklama</div>
            <div class="detail-desc">${item.description}</div>
            <div class="detail-divider"></div>` : ''}

            <div class="detail-section-label"><i data-feather="user" style="width:13px;height:13px;"></i>İlan Sahibi</div>
            <div class="seller-card">
                <div class="seller-avatar-lg">${sellerName.charAt(0).toUpperCase()}</div>
                <div class="seller-info">
                    <h4>${sellerName}</h4>
                    <span>${sellerRole === 'ciftci' || sellerRole === 'çiftçi' ? 'Çiftçi' : 'Bireysel Kullanıcı'}</span>
                </div>
            </div>

            <div class="detail-actions">${actionsHtml}</div>
        </div>`;

    feather.replace();
    document.getElementById('detailModal').classList.add('open');
}

function closeDetailModal() { document.getElementById('detailModal').classList.remove('open'); }
function handleDetailOverlayClick(e) { if (e.target === document.getElementById('detailModal')) closeDetailModal(); }

function goToSlide(i) {
    const photos = safeParsePhotos(currentDetailListing?.photos);
    if (!photos.length) return;
    document.querySelectorAll('.photo-slide').forEach((s,idx) => s.classList.toggle('active', idx === i));
    document.querySelectorAll('.slider-dot').forEach((d,idx) => d.classList.toggle('active', idx === i));
    currentSlide = i;
}
function nextSlide() {
    const photos = safeParsePhotos(currentDetailListing?.photos);
    goToSlide((currentSlide + 1) % photos.length);
}
function prevSlide() {
    const photos = safeParsePhotos(currentDetailListing?.photos);
    goToSlide((currentSlide - 1 + photos.length) % photos.length);
}

// ── CONTACT ──
function contactSeller(userId) {
    closeDetailModal();
    window.location.href = `normal-user.html?tab=messages&chatUserId=${userId}`;
}

// ── PURCHASE MODAL ──
function openPurchaseModal(listingId) {
    const item = allListings.find(l => l.id === listingId);
    if (!item) return;
    pendingPurchaseListing = item;
    document.getElementById('confirmProductName').textContent = item.title;
    document.getElementById('confirmProductPrice').textContent = item.price ? `${Number(item.price).toLocaleString('tr-TR')} ₺` : 'Fiyat belirtilmemiş';
    closeDetailModal();
    document.getElementById('purchaseModal').classList.add('open');
    feather.replace();
}
function closePurchaseModal() {
    document.getElementById('purchaseModal').classList.remove('open');
    pendingPurchaseListing = null;
}

// ── CONFIRM PURCHASE ──
async function confirmPurchase() {
    if (!pendingPurchaseListing) return;
    const btn = document.getElementById('confirmPurchaseBtn');
    btn.disabled = true;
    btn.innerHTML = '<i data-feather="loader" style="width:14px;height:14px;"></i> Kaydediliyor...';
    feather.replace();

    // 1) purchases tablosuna kaydet
    const { data: purchase, error } = await sb.from('purchases').insert([{
        buyer_id: currentUser.id,
        listing_id: pendingPurchaseListing.id,
        seller_id: pendingPurchaseListing.user_id,
        title: pendingPurchaseListing.title,
        price: pendingPurchaseListing.price || 0,
        category: pendingPurchaseListing.category,
        location: pendingPurchaseListing.location,
        status: 'pending'
    }]).select().single();

    if (error) {
        btn.disabled = false;
        btn.innerHTML = '<i data-feather="check" style="width:15px;height:15px;"></i> Satın Al';
        feather.replace();
        showToast('Satın alma kaydedilemedi: ' + error.message, 'error');
        return;
    }

    // 2) Alıcının adını çek
    const { data: buyerData } = await sb
        .from('users').select('ad, soyad')
        .eq('id', currentUser.id).single();
    const buyerName = buyerData ? `${buyerData.ad} ${buyerData.soyad}` : 'Bir kullanıcı';

    // 3) Satıcıya bildirim gönder
    await sb.from('notifications').insert([{
        user_id: pendingPurchaseListing.user_id,
        type: 'purchase_request',
        title: '🛒 Yeni Satın Alma Talebi',
        message: `${buyerName}, "${pendingPurchaseListing.title}" ilanınızı satın almak istiyor.`,
        data: {
            purchase_id: purchase.id,
            listing_id: pendingPurchaseListing.id,
            listing_title: pendingPurchaseListing.title,
            buyer_id: currentUser.id,
            buyer_name: buyerName,
            price: pendingPurchaseListing.price || 0
        }
    }]);

    btn.disabled = false;
    btn.innerHTML = '<i data-feather="check" style="width:15px;height:15px;"></i> Satın Al';
    feather.replace();
    closePurchaseModal();
    showToast('Talebiniz iletildi! Satıcı onaylayacak.', 'success');
}

// ── VETERİNER / SAĞLIK DİNAMİK ALAN FONKSİYONLARI ──
function toggleVetSection() {
    const category = document.getElementById('fCategory').value;
    const vetSection = document.getElementById('vetSection');
    if (category === 'veteriner') {
        vetSection.style.display = 'block';
    } else {
        vetSection.style.display = 'none';
    }
}

function addAdAnimalRow() {
    const container = document.getElementById('adAnimalContainer');
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.innerHTML = `
        <input type="text" class="fi vet-type" placeholder="Tür (Örn: İnek)" style="flex:2; padding:8px 10px;">
        <input type="number" class="fi vet-count" placeholder="Adet" style="flex:1; padding:8px 10px;">
        <select class="fi vet-gender" style="flex:1.5; padding:8px 10px;">
            <option>Farketmez</option>
            <option>Erkek</option>
            <option>Dişi</option>
        </select>
        <button type="button" onclick="this.parentElement.remove()" style="background:transparent; border:1px solid var(--danger); color:var(--danger); border-radius:8px; padding:0 10px; cursor:pointer; display:flex; align-items:center;">
            <i data-feather="x" style="width:14px;height:14px;"></i>
        </button>
    `;
    container.appendChild(row);
    feather.replace();
}

// ── ADD / EDIT MODAL ──
function openAddModal() {
    document.getElementById('editId').value = '';
    document.getElementById('fType').value = 'sell';
    document.getElementById('fCategory').value = 'land';
    document.getElementById('fTitle').value = '';
    document.getElementById('fPrice').value = '';
    document.getElementById('fLocation').value = '';
    document.getElementById('fDesc').value = '';
    
    // Veteriner ayarlarını sıfırla
    document.getElementById('fComplaint').value = '';
    document.getElementById('adAnimalContainer').innerHTML = '';
    addAdAnimalRow();
    toggleVetSection();

    selectedPhotos = [];
    document.getElementById('photoPreviewRow').innerHTML = '';
    document.getElementById('formModalTitle').textContent = 'Yeni İlan Ver';
    document.getElementById('formModal').classList.add('open');
    feather.replace();
}

function openEditModal(id) {
    const item = allListings.find(l => l.id === id);
    if (!item) return;
    document.getElementById('editId').value = item.id;
    document.getElementById('fType').value = item.listing_type;
    document.getElementById('fCategory').value = item.category;
    document.getElementById('fTitle').value = item.title;
    document.getElementById('fPrice').value = item.price || '';
    document.getElementById('fLocation').value = item.location;
    document.getElementById('fDesc').value = item.description || '';
    
    toggleVetSection(); // Eğer eski ilan zaten veteriner ilanıysa kutu açılsın
    
    const existingPhotos = safeParsePhotos(item.photos);
    selectedPhotos = existingPhotos.map(url => ({ dataUrl: url, file: null }));
    renderPhotoPreview();
    document.getElementById('formModalTitle').textContent = 'İlanı Düzenle';
    document.getElementById('formModal').classList.add('open');
    feather.replace();
}

function closeFormModal() { document.getElementById('formModal').classList.remove('open'); }
function handleFormOverlayClick(e) { if (e.target === document.getElementById('formModal')) closeFormModal(); }

function handlePhotoSelect(e) {
    const files = Array.from(e.target.files);
    const remaining = 5 - selectedPhotos.length;
    files.slice(0, remaining).forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            selectedPhotos.push({ dataUrl: ev.target.result, file });
            renderPhotoPreview();
        };
        reader.readAsDataURL(file);
    });
    e.target.value = '';
}
function renderPhotoPreview() {
    document.getElementById('photoPreviewRow').innerHTML = selectedPhotos.map((p, i) => `
        <div class="photo-preview-item">
            <img src="${p.dataUrl}" alt="">
            <button class="photo-remove" onclick="removePhoto(${i})">×</button>
        </div>`).join('');
}
function removePhoto(i) { selectedPhotos.splice(i, 1); renderPhotoPreview(); }

async function saveListing() {
    const title = document.getElementById('fTitle').value.trim();
    const location = document.getElementById('fLocation').value.trim();
    if (!title || !location) { showToast('Başlık ve konum zorunludur', 'error'); return; }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i data-feather="loader" style="width:14px;height:14px;animation:spin 1s linear infinite;"></i> Kaydediliyor...';
    feather.replace();

    let finalDesc = document.getElementById('fDesc').value.trim();
    
    // EĞER KATEGORİ VETERİNER İSE BİLGİLERİ AÇIKLAMANIN BAŞINA EKLE
    if (document.getElementById('fCategory').value === 'veteriner') {
        const animals = [];
        document.querySelectorAll('#adAnimalContainer > div').forEach(row => {
            const type = row.querySelector('.vet-type').value.trim();
            const count = row.querySelector('.vet-count').value.trim();
            const gender = row.querySelector('.vet-gender').value;
            if (type) animals.push(`• ${type} (${count || 'Belirtilmedi'} adet) - ${gender}`);
        });
        const complaint = document.getElementById('fComplaint').value.trim();

        let vetInfo = '';
        if (animals.length > 0) vetInfo += `🚨 Müdahale Gereken Hayvanlar:\n${animals.join('\n')}\n\n`;
        if (complaint) vetInfo += `📝 Hastalık / Şikayet / Notlar:\n${complaint}\n\n`;

        if (vetInfo) {
            finalDesc = `${vetInfo}────────────────────\nEk Açıklama:\n${finalDesc}`;
        }
    }

    const photosJson = JSON.stringify(selectedPhotos.map(p => p.dataUrl));
    const editId = document.getElementById('editId').value;
    const payload = {
        user_id: currentUser.id,
        listing_type: document.getElementById('fType').value,
        category: document.getElementById('fCategory').value,
        title,
        price: parseFloat(document.getElementById('fPrice').value) || null,
        location,
        description: finalDesc || null,
        photos: photosJson
    };

    let error;
    if (editId) {
        const r = await sb.from('listings').update(payload).eq('id', editId).eq('user_id', currentUser.id);
        error = r.error;
    } else {
        const r = await sb.from('listings').insert([payload]);
        error = r.error;
    }

    btn.disabled = false;
    btn.innerHTML = '<i data-feather="check" style="width:14px;height:14px;"></i> Kaydet';
    feather.replace();

    if (error) { showToast('Hata: ' + error.message, 'error'); return; }
    closeFormModal();
    showToast(editId ? 'İlan güncellendi' : 'İlan yayınlandı!', 'success');
    await fetchListings();
}

async function deleteListing(id) {
    if (!confirm('Bu ilanı silmek istediğinize emin misiniz?')) return;
    const { error } = await sb.from('listings').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) { showToast('Silme hatası: ' + error.message, 'error'); return; }
    showToast('İlan silindi', 'success');
    await fetchListings();
}

// ── HELPERS ──
function safeParsePhotos(val) {
    if (!val) return [];
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    document.getElementById('toastMsg').textContent = msg;
    t.className = `toast ${type}`;
    icon.setAttribute('data-feather', type === 'success' ? 'check-circle' : 'alert-circle');
    feather.replace();
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
}