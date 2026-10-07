feather.replace();

// TEMA YÖNETİMİ
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('AgriSynth-theme', newTheme);
    document.getElementById('themeToggleBtn').setAttribute('data-feather', newTheme === 'light' ? 'moon' : 'sun');
    feather.replace();
}
const initTheme = document.documentElement.getAttribute('data-theme') || 'light';
document.getElementById('themeToggleBtn').setAttribute('data-feather', initTheme === 'light' ? 'moon' : 'sun');
feather.replace();

const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let userRole = null;

// DOKTOR DEĞİŞKENLERİ
let allVetListings = [];
let currentView = 'requests'; 
let selectedImages = [];
let targetUserIdForChat = null;

// RANDEVU DEĞİŞKENLERİ
let currentApptView = 'pending';
let allAppointments = []; // EKLENDİ (Randevuları tutmak için)

// CHAT DEĞİŞKENLERİ
let msgCurrentChatId = null;
let msgActiveUser = null;
let msgSubscription = null;
let msgAllConversations = [];

// NOTLAR VE TAKVİM DEĞİŞKENLERİ
let userNotes = [];
let noteSelectedImages = [];
let noteSelectedColor = 0;

let calNotes = []; 
let calWeekOffset = 0;
let calSelectedColor = 0;
let calInitialized = false;
let calNowTimer = null;
const CAL_TR_DAYS   = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const CAL_TR_MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

// ANA SAYFA İNİT
function initHomePage() {
    const now = new Date();
    const tr_months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const tr_days = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
    document.getElementById('heroDate').textContent = `${tr_days[now.getDay()]}, ${now.getDate()} ${tr_months[now.getMonth()]} ${now.getFullYear()}`;

    const month = now.getMonth() + 1;
    let season;
    if (month >= 3 && month <= 5) season = 'ilkbahar';
    else if (month >= 6 && month <= 8) season = 'yaz';
    else if (month >= 9 && month <= 11) season = 'sonbahar';
    else season = 'kis';

    // Vet Tips
    const tips = {
        ilkbahar: 'İlkbaharda hayvanların aşı takvimini ve parazit mücadelelerini kontrol etmeyi unutmayın.',
        yaz: 'Sıcak havalarda barınak havalandırmalarına ve hayvanların su tüketimine özellikle dikkat edilmelidir.',
        sonbahar: 'Sonbahar aylarında kışa hazırlık olarak solunum yolu hastalıklarına karşı önlemler alınmalıdır.',
        kis: 'Kış aylarında soğuk stresi ve yeni doğan yavruların üşümemesi için ısıtma sistemleri kontrol edilmelidir.'
    };
    document.getElementById('agriTipText').textContent = tips[season];

    fetchData('Istanbul'); 
}

// HAVA DURUMU (Ana sayfa Widget için)
const API_KEY = "5509f10af3d54f32a06191838260303"; 
async function fetchData(query) {
    try {
        const response = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${query}&days=1&aqi=no&lang=tr`);
        if (!response.ok) throw new Error("Hava durumu servisi yanıt vermiyor.");
        const data = await response.json();
        
        document.getElementById('heroTemp').textContent = `${Math.round(data.current.temp_c)}°`;
        document.getElementById('heroCity').textContent = data.location.name;
        document.getElementById('heroWeatherDesc').textContent = data.current.condition.text;
    } catch (error) {
        console.log("Hava durumu çekilemedi: ", error);
        document.getElementById('heroWeatherDesc').textContent = "Veri alınamadı";
    }
}

// TAB GEÇİŞ
function switchTab(tabId, element) {
    document.querySelectorAll('.tab-section').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (element) element.classList.add('active');

    const mainContent = document.getElementById('mainContent');
    if (tabId === 'calendar-tab' || tabId === 'messages-tab') {
        mainContent.style.overflow = 'hidden';
        mainContent.style.padding = '0';
        if (tabId === 'calendar-tab') {
            calInitialized = false;
            initCalendarTab();
        } else {
            msgLoadConversations();
        }
    } else {
        mainContent.style.overflow = '';
        mainContent.style.padding = '0 30px 40px 30px'; 
        if (tabId === 'requests-tab') fetchListings();
        if (tabId === 'notes-tab') fetchNotes();
        if (tabId === 'appointments-tab') loadAppointments();
    }
}

function switchTabById(tabId) {
    const navItem = [...document.querySelectorAll('.nav-item')].find(el => el.getAttribute('onclick')?.includes(tabId));
    switchTab(tabId, navItem || document.querySelector('.nav-item'));
}
window.addEventListener('DOMContentLoaded', async () => { 
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) { window.location.href = "index.html"; return; }
    currentUser = session.user;
    
    // 1. BURAYI DÜZELTTİK: 'profil_foto' yerine 'avatar_url' yazdık
    const { data: profile, error: profileError } = await supabaseClient.from('users').select('ad, soyad, rol, avatar_url').eq('id', currentUser.id).single();
    
    // Olası bir hatada sonsuz yükleme ekranında kalmaması için:
    if (profileError) {
        console.error("Kullanıcı verisi çekilemedi:", profileError.message);
        document.getElementById('userName').innerText = "Bilgiler alınamadı";
        return; 
    }

    if (profile) {
        if(profile.rol !== 'doktor') { alert("Yetkisiz giriş!"); window.location.href="index.html"; return; }
        userRole = profile.rol;
        document.getElementById('welcomeText').innerText = `Merhaba, Dr. ${profile.ad}! 👋`;
        document.getElementById('userName').innerText = `Dr. ${profile.ad} ${profile.soyad}`;
        
        // 2. BURAYI DÜZELTTİK: profile.avatar_url olarak kontrol ediyoruz
        const avatarDiv = document.getElementById('userAvatar');
        if (profile.avatar_url && profile.avatar_url.trim() !== '') {
            avatarDiv.innerHTML = ''; 
            avatarDiv.style.backgroundImage = `url('${profile.avatar_url}')`;
            avatarDiv.style.backgroundSize = 'cover';
            avatarDiv.style.backgroundPosition = 'center';
            avatarDiv.style.backgroundColor = 'transparent'; 
        } else {
            avatarDiv.innerText = profile.ad.charAt(0).toUpperCase();
            avatarDiv.style.backgroundImage = 'none';
        }
        
        // Yeni eklenen profil formunu doldur
        const nameInput = document.getElementById('profileNameInput');
        const emailInput = document.getElementById('profileEmailInput');
        if (nameInput) nameInput.value = `${profile.ad} ${profile.soyad}`;
        if (emailInput) emailInput.value = currentUser.email;
    }

    initHomePage();
    fetchListings(); 
    msgLoadConversations(); 
    fetchNotes();
    
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

async function logout() { await supabaseClient.auth.signOut(); window.location.href = "index.html"; }

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.className = `toast ${type}`;
    document.getElementById('toastIcon').setAttribute('data-feather', type === 'success' ? 'check-circle' : 'alert-circle');
    feather.replace();
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}

/* ================= DOKTOR İLAN FONKSİYONLARI ================= */
function openFormModal() {
    document.getElementById('listingForm').reset();
    document.getElementById('listingId').value = "";
    document.getElementById('formModalTitle').innerText = "Hizmet Profilini Yayınla";
    selectedImages = [];
    updateImagePreview();
    document.getElementById('formModal').classList.add('active');
}

function closeFormModal() { document.getElementById('formModal').classList.remove('active'); }
function closeDetailModal() { document.getElementById('detailModal').classList.remove('active'); }
function handleFormOverlayClick(e) { if (e.target === document.getElementById('formModal')) closeFormModal(); }
function handleDetailOverlayClick(e) { if (e.target === document.getElementById('detailModal')) closeDetailModal(); }

function switchView(view, btnElement) {
    currentView = view;
    document.querySelectorAll('#requests-tab .sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    renderListings();
}

async function fetchListings() {
    if(document.getElementById('requests-tab').classList.contains('active')){
        document.getElementById('loadingStatus').style.display = 'block';
    }
    document.getElementById('listingsContainer').innerHTML = '';

    const { data: listings, error: listingError } = await supabaseClient
        .from('listings')
        .select('*')
        .eq('category', 'veteriner') 
        .order('created_at', { ascending: false });
    
    if (listingError) return;

    if (!listings || listings.length === 0) {
        allVetListings = [];
        renderListings();
        document.getElementById('loadingStatus').style.display = 'none';
        return;
    }

    const userIds = [...new Set(listings.map(l => l.user_id))];
    const { data: usersData } = await supabaseClient.from('users').select('id, ad, soyad, rol').in('id', userIds);

    const usersMap = {};
    (usersData || []).forEach(u => { usersMap[u.id] = u; });

    allVetListings = listings.map(listing => ({
        ...listing,
        users: usersMap[listing.user_id] || null
    }));

    // İstatistikleri Güncelle (Ana Sayfa)
    const farmerRequests = allVetListings.filter(l => l.users && l.users.rol === 'ciftci').length;
    const myListings = allVetListings.filter(l => l.user_id === currentUser.id).length;
    document.getElementById('statRequests').innerText = farmerRequests;
    document.getElementById('statMyListings').innerText = myListings;

    document.getElementById('loadingStatus').style.display = 'none';
    renderListings();
}

function renderListings() {
    const container = document.getElementById('listingsContainer');
    container.innerHTML = '';
    
    let displayListings = [];
    if(currentView === 'requests') {
        displayListings = allVetListings.filter(l => l.users && l.users.rol === 'ciftci');
    } else {
        displayListings = allVetListings.filter(l => l.user_id === currentUser.id);
    }

    if (displayListings.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px; color:var(--text-muted); border:1px dashed var(--border); border-radius:16px;">
            <i data-feather="inbox" style="width:48px;height:48px;opacity:0.5;margin-bottom:10px;"></i>
            <p>Bu sekmede gösterilecek kayıt bulunamadı.</p>
        </div>`;
        feather.replace();
        return;
    }

    displayListings.forEach(item => {
        const isMine = item.user_id === currentUser.id;
        let photosArr = []; try { photosArr = item.photos ? JSON.parse(item.photos) : []; } catch(e){}
        const coverPhoto = photosArr.length > 0 ? photosArr[0] : '';

        let typeLabel, typeColor, bgBadge;
        if(item.users && item.users.rol === 'ciftci') {
            typeLabel = 'Müdahale Talebi'; typeColor = 'var(--danger)'; bgBadge = 'rgba(239, 68, 68, 0.85)';
        } else {
            typeLabel = 'Uzman Hizmeti'; typeColor = 'var(--primary)'; bgBadge = 'var(--primary)';
        }

        const priceText = item.price ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.price) : 'Bütçe/Fiyat Belirtilmemiş';
        const ownerName = item.users ? `${item.users.ad} ${item.users.soyad}` : 'Kullanıcı';

        const cardHtml = `
            <div class="field-card" onclick="showDetail('${item.id}')">
                <div class="carousel-container">
                    ${coverPhoto ? `<img src="${coverPhoto}" class="carousel-slide active">` : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--text-muted);"><i data-feather="image" style="width:40px;height:40px;opacity:0.3;"></i></div>`}
                    <div class="badge-type" style="position:absolute; top:12px; left:12px; background:${bgBadge}; color:white; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; z-index:10;">${typeLabel}</div>
                </div>
                <div class="field-card-header" style="flex-direction:column;">
                    <div class="field-card-title" style="width:100%;">
                        <h3 title="${item.title}">${item.title}</h3>
                        <p><i data-feather="map-pin" style="width:12px;"></i> ${item.location}</p>
                    </div>
                    <div style="color: ${typeColor}; font-weight: 700; font-size: 16px; margin-top:8px;">${priceText}</div>
                </div>
                <div class="field-card-body" style="padding-bottom:10px;">
                    <div class="field-stat" style="border:none;">
                        <span><i data-feather="user" style="width:14px;"></i> ${(item.users && item.users.rol==='ciftci') ? 'Çiftçi: ' : 'Dr. '}${ownerName}</span> 
                        <span style="font-size:11px; font-weight:400;">${new Date(item.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                </div>
                ${isMine ? `
                <div class="field-actions">
                    <button class="btn-edit" onclick="event.stopPropagation(); editListing('${item.id}')"><i data-feather="edit-2" style="width:14px;"></i> Düzenle</button>
                    <button class="btn-danger" onclick="event.stopPropagation(); deleteListing('${item.id}')"><i data-feather="trash-2" style="width:14px;"></i> Sil</button>
                </div>` : ''}
            </div>
        `;
        container.innerHTML += cardHtml;
    });
    feather.replace();
}

function showDetail(id) {
    const item = allVetListings.find(l => l.id === id);
    if(!item) return;

    let photosArr = []; try { photosArr = item.photos ? JSON.parse(item.photos) : []; } catch(e){}
    const photoContainer = document.getElementById('detailPhotos');
    photoContainer.innerHTML = '';
    if(photosArr.length > 0) {
        photosArr.forEach((src, idx) => { photoContainer.innerHTML += `<img src="${src}" class="detail-img ${idx === 0 ? 'active' : ''}">`; });
    } else {
        photoContainer.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);"><i data-feather="image" style="width:50px;height:50px;opacity:0.5;"></i></div>`;
    }

    document.getElementById('detailPrice').innerText = item.price ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.price) : 'Fiyat Belirtilmemiş';
    document.getElementById('detailTitle').innerText = item.title;
    document.getElementById('detailLocation').innerText = item.location;
    document.getElementById('detailDesc').innerText = item.description || 'Açıklama girilmemiş.';
    
    const badge = document.getElementById('detailTypeBadge');
    const isFarmerRequest = (item.users && item.users.rol === 'ciftci');
    
    badge.innerText = isFarmerRequest ? 'Çiftçi Talebi' : 'Uzman Profili';
    badge.style.background = isFarmerRequest ? 'var(--danger)' : 'var(--primary)';
    document.getElementById('detailPrice').style.color = isFarmerRequest ? 'var(--danger)' : 'var(--primary)';

    const attrBox = document.getElementById('detailAttributes');
    attrBox.innerHTML = '';
    const addAttr = (label, val) => { if(val) attrBox.innerHTML += `<div class="attr-item"><span class="attr-label">${label}</span><span class="attr-value">${val}</span></div>`; };

    const attr = item.attributes || {};
    
    if(isFarmerRequest) {
        let vetAnimalsStr = "";
        if(attr.vet_animals && attr.vet_animals.length > 0) {
            vetAnimalsStr = attr.vet_animals.map(a => `${a.count} Adet ${a.type} (${a.gender})`).join(', ');
        }
        addAttr("Hastalık Bildirimi", vetAnimalsStr);
        addAttr("Özel Notlar / Şikayet", attr.vet_notes);
    } else {
        addAttr("Uzmanlık Alanı", attr.expertise);
        addAttr("Klinik Adı", attr.clinic);
        addAttr("Deneyim", attr.experience);
    }

    const ownerName = item.users ? `${item.users.ad} ${item.users.soyad}` : 'Kullanıcı';
    document.getElementById('ownerLabel').innerText = isFarmerRequest ? 'Çiftçi / Talep Eden' : 'Uzman Hekim';
    document.getElementById('detailOwnerName').innerText = isFarmerRequest ? ownerName : `Dr. ${ownerName}`;
    document.getElementById('detailOwnerInitial').innerText = ownerName.charAt(0).toUpperCase();
    document.getElementById('detailOwnerDate').innerText = `Yayın: ${new Date(item.created_at).toLocaleDateString('tr-TR')}`;

    targetUserIdForChat = item.user_id;
    
    const chatBtn = document.getElementById('chatBtn');
    if (item.user_id === currentUser.id) chatBtn.style.display = 'none';
    else chatBtn.style.display = 'flex';

    feather.replace();
    document.getElementById('detailModal').classList.add('active');
}

function startChatWrapper() {
    if(!targetUserIdForChat) { alert("Kullanıcı bulunamadı."); return; }
    if(targetUserIdForChat === currentUser.id) { alert("Kendi profilinize mesaj gönderemezsiniz."); return; }
    closeDetailModal();
    const msgNavItem = document.querySelector('.nav-item[onclick*="messages-tab"]');
    switchTab('messages-tab', msgNavItem);
    msgInitChatFromUrl(targetUserIdForChat);
}

function handleImageSelect(event) {
    const files = Array.from(event.target.files);
    if (selectedImages.length + files.length > 3) { showToast('En fazla 3 fotoğraf ekleyebilirsiniz!', 'error'); return; }
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => { selectedImages.push({ file, dataUrl: e.target.result }); updateImagePreview(); };
        reader.readAsDataURL(file);
    });
}
function updateImagePreview() {
    document.getElementById('photoPreviewContainer').innerHTML = selectedImages.map((img, i) => `
        <div class="image-preview-item"><img src="${img.dataUrl}" alt=""><button type="button" class="remove-image" onclick="removeImage(${i})"><i data-feather="x"></i></button></div>`).join('');
    feather.replace();
}
function removeImage(i) { selectedImages.splice(i, 1); updateImagePreview(); }

function editListing(id) {
    const item = allVetListings.find(l => l.id === id);
    if(!item) return;

    document.getElementById('listingId').value = item.id;
    document.getElementById('formModalTitle').innerText = "Hizmet Profilini Güncelle";
    document.getElementById('listingTitle').value = item.title;
    document.getElementById('listingPrice').value = item.price || '';
    document.getElementById('listingLocation').value = item.location;
    document.getElementById('listingDesc').value = item.description || '';

    const attr = item.attributes || {};
    document.getElementById('attr_expertise').value = attr.expertise || 'Karma';
    document.getElementById('attr_experience').value = attr.experience || '';
    document.getElementById('attr_clinic').value = attr.clinic || '';

    const existingPhotos = item.photos ? JSON.parse(item.photos) : [];
    selectedImages = existingPhotos.map(url => ({ dataUrl: url, file: null }));
    updateImagePreview();
    document.getElementById('formModal').classList.add('active');
}

async function saveListing() {
    const id = document.getElementById('listingId').value;
    const title = document.getElementById('listingTitle').value;
    const location = document.getElementById('listingLocation').value;
    
    if(!title || !location) { showToast("Lütfen başlık ve konum alanlarını doldurun.", "error"); return; }

    let attributes = {
        expertise: document.getElementById('attr_expertise').value,
        experience: document.getElementById('attr_experience').value,
        clinic: document.getElementById('attr_clinic').value
    };

    const photosJson = JSON.stringify(selectedImages.map(p => p.dataUrl));
    const dataToSave = {
        user_id: currentUser.id,
        listing_type: 'sell', 
        category: 'veteriner',
        title: title,
        description: document.getElementById('listingDesc').value,
        price: parseFloat(document.getElementById('listingPrice').value) || null,
        location: location,
        attributes: attributes,
        photos: photosJson
    };

    let error;
    if(id) {
        const res = await supabaseClient.from('listings').update(dataToSave).eq('id', id);
        error = res.error;
    } else {
        const res = await supabaseClient.from('listings').insert([dataToSave]);
        error = res.error;
    }
    if (error) { showToast("Hata: " + error.message, "error"); return; }
    
    closeFormModal();
    fetchListings(); 
    showToast(id ? 'İlan güncellendi!' : 'İlan başarıyla yayınlandı!');
}

async function deleteListing(id) {
    if(confirm("İlanınızı kaldırmak istediğinize emin misiniz?")) {
        const { error } = await supabaseClient.from('listings').delete().eq('id', id);
        if(error) { showToast("Silinemedi: " + error.message, "error"); return; }
        fetchListings();
        showToast("İlan silindi.");
    }
}

/* ================= RANDEVU YÖNETİMİ ================= */
function switchApptView(view, btnElement) {
    currentApptView = view;
    document.querySelectorAll('#appointments-tab .sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    loadAppointments();
}

async function loadAppointments() {
    const container = document.getElementById('apptsContainer');
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;"><i data-feather="loader" style="animation:spin 1s linear infinite;"></i></div>';
    feather.replace();

    try {
        const { data: allData, error: allErr } = await supabaseClient
            .from('appointments')
            .select('*, users!farmer_id(ad, soyad, telefon)')
            .eq('doctor_id', currentUser.id)
            .order('appointment_date', { ascending: true });
        
        if(allErr) throw allErr;
        allAppointments = allData || [];

        const data = allAppointments.filter(a => a.status === currentApptView);

        container.innerHTML = '';
        if(!data || data.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px; color:var(--text-muted); border:1px dashed var(--border); border-radius:16px;">
                <i data-feather="calendar" style="width:48px;height:48px;opacity:0.5;margin-bottom:10px;"></i>
                <p>Bu sekmede gösterilecek randevu bulunamadı.</p>
            </div>`;
            feather.replace();
            return;
        }

        data.forEach(appt => {
            const patientName = appt.users ? `${appt.users.ad} ${appt.users.soyad}` : 'Kullanıcı';
            const farmerPhone = appt.users ? appt.users.telefon : '-';
            const dateStr = new Date(appt.appointment_date).toLocaleDateString('tr-TR');
            const timeStr = appt.appointment_time ? appt.appointment_time.substring(0,5) : '00:00';
            const locText = appt.location_type === 'farm' ? 'Çiftliğe Çağırıyor' : 'Kliniğe Gelecek';
            const locIcon = appt.location_type === 'farm' ? 'truck' : 'home';
            
            let animalHTML = '';
            if(appt.animal_details && appt.animal_details.length > 0) {
                appt.animal_details.forEach(a => {
                    animalHTML += `
                        <div style="margin-bottom:6px; border-left: 2px solid var(--primary); padding-left:10px;">
                            <div style="font-weight:600; color:var(--text-main); font-size:13px;">${a.count} Adet ${a.type} <span style="font-weight:400; color:var(--text-muted); font-size:11px;">(${a.gender})</span></div>
                            <div style="color:var(--text-muted); font-size:12px;">Şikayet: ${a.illness}</div>
                        </div>`;
                });
            } else { animalHTML = '<div style="color:var(--text-muted); font-size:12px;">Detay girilmemiş.</div>'; }

            let actionHtml = '';
            if(currentApptView === 'pending') {
                actionHtml = `
                    <div class="field-actions">
                        <button class="btn-primary" onclick="updateApptStatus('${appt.id}', 'approved')"><i data-feather="check" style="width:14px;"></i> Onayla</button>
                        <button class="btn-danger" style="background:transparent;border:1px solid var(--danger);" onclick="updateApptStatus('${appt.id}', 'rejected')"><i data-feather="x" style="width:14px;"></i> Reddet</button>
                    </div>
                `;
            } else if(currentApptView === 'approved') {
                const waLink = farmerPhone !== '-' ? `https://wa.me/90${farmerPhone.replace(/\D/g,'')}` : '#';
                actionHtml = `
                    <div class="field-actions" style="justify-content:space-between; align-items:center;">
                        <button class="btn-primary" style="background:#25D366; width:auto;" onclick="window.open('${waLink}', '_blank')"><i data-feather="message-circle" style="width:14px;"></i> WhatsApp</button>
                        <button class="btn-secondary" style="width:auto;color:var(--danger);border-color:var(--danger);" onclick="updateApptStatus('${appt.id}', 'rejected')">İptal Et</button>
                    </div>
                `;
            }

            container.innerHTML += `
                <div class="field-card">
                    <div class="field-card-header" style="flex-direction:column; background:var(--surface-hover);">
                        <div style="display:flex;justify-content:space-between;width:100%;margin-bottom:8px;">
                            <span style="font-weight:700;font-size:14px;color:var(--primary);"><i data-feather="calendar" style="width:14px;"></i> ${dateStr}</span>
                            <span style="font-weight:700;font-size:14px;color:var(--text-main);"><i data-feather="clock" style="width:14px;"></i> ${timeStr}</span>
                        </div>
                        <h3 style="font-size:16px; margin:0;"><i data-feather="user" style="width:14px;"></i> ${patientName}</h3>
                        <p style="margin-top:6px;"><i data-feather="${locIcon}" style="width:12px;"></i> ${locText}</p>
                    </div>
                    <div class="field-card-body" style="padding-bottom:15px;">
                        <div style="font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">Müdahale Detayı</div>
                        ${animalHTML}
                        
                        ${appt.notes ? `
                        <div style="font-size:12px; color:var(--text-main); margin-top:10px; background:rgba(245,158,11,0.05); padding:10px; border-radius:8px; border-left:3px solid var(--warning);">
                            <strong>Ek Not:</strong> ${appt.notes}
                        </div>` : ''}
                    </div>
                    ${actionHtml}
                </div>
            `;
        });
        feather.replace();
        document.getElementById('statAppointments').innerText = allAppointments.filter(a => a.status === 'approved').length;
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">Randevular veritabanından çekilemedi.</div>`;
    }
}

async function updateApptStatus(id, newStatus) {
    const targetApt = allAppointments.find(a => a.id === id);

    if (newStatus === 'approved') {
        const clash = allAppointments.find(a => 
            a.id !== id && 
            a.status === 'approved' && 
            a.appointment_date === targetApt.appointment_date && 
            a.appointment_time === targetApt.appointment_time
        );

        if (clash) {
            showToast("⚠️ Bu tarih ve saatte zaten onaylanmış bir randevunuz bulunuyor!", "error");
            return; 
        }
    }

    const isApproved = newStatus === 'approved';
    if(!confirm(`Bu randevuyu ${isApproved ? 'onaylamak' : 'reddetmek/iptal etmek'} istediğinize emin misiniz?`)) return;
    
    const { error } = await supabaseClient.from('appointments').update({ status: newStatus }).eq('id', id);
    
    if(error) { showToast("Hata: " + error.message, "error"); return; }
    
    showToast(isApproved ? "Randevu onaylandı ve takvime eklendi!" : "Randevu iptal edildi.");
    loadAppointments(); 
    
    if(calInitialized) calFetchNotes(); 
}

/* ================= NOTLARIM SİSTEMİ ================= */
function selectNoteColor(c) {
    noteSelectedColor = c;
    document.querySelectorAll('#noteColorPicker .note-cal-color-dot').forEach(b => b.classList.remove('selected'));
    document.querySelector(`#noteColorPicker .note-cal-color-dot[data-nc="${c}"]`).classList.add('selected');
}

function openNoteModal() {
    document.getElementById('noteForm').reset();
    document.getElementById('noteId').value = '';
    document.getElementById('noteModalTitle').innerText = 'Yeni Not Ekle';
    noteSelectedImages = [];
    document.getElementById('imagePreviewContainer').innerHTML = '';
    selectNoteColor(0);
    document.getElementById('noteModalOverlay').classList.add('active');
    feather.replace();
}

function closeNoteModal() { document.getElementById('noteModalOverlay').classList.remove('active'); }

function handleNoteImageSelect(event) {
    const files = Array.from(event.target.files);
    if (noteSelectedImages.length + files.length > 5) { showToast('En fazla 5 fotoğraf ekleyebilirsiniz!', 'error'); return; }
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => { noteSelectedImages.push({ file, dataUrl: e.target.result }); updateNoteImagePreview(); };
        reader.readAsDataURL(file);
    });
}

function updateNoteImagePreview() {
    document.getElementById('imagePreviewContainer').innerHTML = noteSelectedImages.map((img, i) => `
        <div class="image-preview-item"><img src="${img.dataUrl}" alt=""><button type="button" class="remove-image" onclick="removeNoteImage(${i})"><i data-feather="x"></i></button></div>`).join('');
    feather.replace();
}
function removeNoteImage(i) { noteSelectedImages.splice(i, 1); updateNoteImagePreview(); }

async function fetchNotes() {
    if(!currentUser) return;
    const loading = document.getElementById('notesLoading');
    if (loading) loading.style.display = 'flex';
    
    const { data, error } = await supabaseClient.from('notes').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    
    if (loading) loading.style.display = 'none';
    if (error) return;
    userNotes = data || [];
    renderNotes();
}

function renderNotes() {
    const container = document.getElementById('notesContainer');
    if (!userNotes.length) { 
        container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);border:1px dashed var(--border);border-radius:16px;">
            <i data-feather="file-text" style="width:48px;height:48px;opacity:0.5;margin-bottom:10px;"></i>
            <p>Henüz kişisel not eklemediniz.</p>
        </div>`; 
        feather.replace();
        return; 
    }
    container.innerHTML = userNotes.map(note => {
        const imagesHtml = note.images?.length ? `<div class="note-images">${note.images.map((img, i) => `<div class="note-image-item"><img src="${img}" alt="${i+1}"></div>`).join('')}</div>` : '';
        
        let calBadge = '';
        if (note.note_date && note.note_time) {
            const d = new Date(note.note_date + 'T00:00:00');
            const calLabel = `${d.getDate()} ${CAL_TR_MONTHS[d.getMonth()]} ${d.getFullYear()} – ${note.note_time.substring(0,5)}`;
            calBadge = `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(14,165,233,0.1);color:var(--primary);border:1px solid rgba(14,165,233,0.25);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-bottom:10px;">
                <i data-feather="calendar" style="width:11px;height:11px;"></i>${calLabel}
            </span>`;
        }
        return `
        <div class="note-card">
            <div class="note-header">
                <div class="note-title-section">
                    <div class="note-title"><i data-feather="bookmark"></i>${note.title}</div>
                    <div class="note-date"><i data-feather="clock" style="width:12px;"></i>${new Date(note.created_at).toLocaleDateString('tr-TR')}</div>
                </div>
            </div>
            ${calBadge}
            ${imagesHtml}
            <div class="note-content">${note.content}</div>
            <div class="note-footer">
                <button class="btn-edit" onclick="editNote('${note.id}')"><i data-feather="edit-2" style="width:14px;"></i> Düzenle</button>
                <button class="btn-danger" style="background:transparent;border:1px solid var(--danger);" onclick="deleteNoteItem('${note.id}')"><i data-feather="trash-2" style="width:14px;"></i> Sil</button>
            </div>
        </div>`;
    }).join('');
    feather.replace();
}

function editNote(id) {
    const note = userNotes.find(n => n.id === id);
    if (!note) return;
    document.getElementById('noteId').value = note.id;
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContent').value = note.content;
    document.getElementById('noteDate').value = note.note_date || '';
    document.getElementById('noteTime').value = note.note_time ? note.note_time.substring(0,5) : '';
    document.getElementById('noteEndTime').value = note.end_time ? note.end_time.substring(0,5) : '';
    selectNoteColor(note.color || 0);
    
    noteSelectedImages = note.images ? note.images.map(img => ({ dataUrl: img })) : [];
    updateNoteImagePreview();
    
    document.getElementById('noteModalTitle').innerText = 'Notu Düzenle';
    document.getElementById('noteModalOverlay').classList.add('active');
}

async function saveNote() {
    const id      = document.getElementById('noteId').value;
    const title   = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    if (!title || !content) { showToast('Başlık ve içerik zorunludur!', 'error'); return; }

    const images   = noteSelectedImages.map(img => img.dataUrl);
    const noteDate = document.getElementById('noteDate').value || null;
    const noteTime = document.getElementById('noteTime').value || null;
    const endTime  = document.getElementById('noteEndTime').value || null;

    if (noteDate && !noteTime) { showToast('Takvime eklemek için saat de girilmelidir!', 'error'); document.getElementById('noteTime').focus(); return; }

    const noteData = {
        title, content, user_id: currentUser.id, images,
        note_date: noteDate, note_time: noteTime, end_time: endTime,
        color: typeof noteSelectedColor !== 'undefined' ? noteSelectedColor : 0
    };

    let error;
    if (id) { const r = await supabaseClient.from('notes').update(noteData).eq('id', id); error = r.error; }
    else    { const r = await supabaseClient.from('notes').insert([noteData]);              error = r.error; }

    if (error) { showToast('Hata: ' + error.message, 'error'); return; }
    closeNoteModal();
    fetchNotes();
    showToast('Not başarıyla kaydedildi.');
    
    if (calInitialized) calFetchNotes(); 
}

async function deleteNoteItem(id) {
    if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    const { error } = await supabaseClient.from('notes').delete().eq('id', id);
    if (error) { showToast('Hata: ' + error.message, 'error'); return; }
    fetchNotes();
    showToast('Not silindi.');
    if (calInitialized) calFetchNotes();
}

/* ================= CHAT FONKSİYONLARI ================= */

async function msgLoadConversations() {
    const list = document.getElementById('msgConvList');

    const { data: chats, error } = await supabaseClient
        .from('chats')
        .select('id, user1_id, user2_id, created_at')
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`);

    if (error) {
        list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">Sohbetler yüklenemedi.<br><small>${error.message}</small></div>`;
        return;
    }

    if (!chats || chats.length === 0) {
        list.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted);font-size:13px;">Henüz mesajınız yok.</div>`;
        document.getElementById('homeMessageCount').innerText = '0';
        return;
    }

    document.getElementById('homeMessageCount').innerText = chats.length; 
    
    const otherUserIds = chats.map(c => c.user1_id === currentUser.id ? c.user2_id : c.user1_id);

    const { data: usersData } = await supabaseClient
        .from('users')
        .select('id, ad, soyad, rol')
        .in('id', [...new Set(otherUserIds)]);

    const usersMap = {};
    (usersData || []).forEach(u => { usersMap[u.id] = u; });

    const enriched = [];
    for (const chat of chats) {
        const otherId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
        const other = usersMap[otherId] || { id: otherId, ad: 'Kullanıcı', soyad: '', rol: '' };

        const { data: lastMsgs } = await supabaseClient
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1);

        const last = lastMsgs?.[0] || null;
        enriched.push({ chat, other, last });
    }

    enriched.sort((a, b) => {
        const tA = a.last ? new Date(a.last.created_at).getTime() : new Date(a.chat.created_at).getTime();
        const tB = b.last ? new Date(b.last.created_at).getTime() : new Date(b.chat.created_at).getTime();
        return tB - tA;
    });

    msgAllConversations = chats;
    list.innerHTML = '';

    enriched.forEach(({ chat, other, last }) => {
        const preview = last
            ? (last.sender_id === currentUser.id ? 'Sen: ' + last.content : last.content)
            : 'Sohbet başlatıldı';
        const timeStr = last
            ? new Date(last.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            : '';
        const initial = (other.ad || '?').charAt(0).toUpperCase();
        const displayName = `${other.rol === 'doktor' ? 'Dr. ' : ''}${other.ad} ${other.soyad}`.trim();

        const item = document.createElement('div');
        item.className = `msg-conv-item${msgCurrentChatId === chat.id ? ' active' : ''}`;
        item.dataset.chatId = chat.id;
        item.dataset.name = displayName.toLowerCase();
        item.onclick = () => msgOpenChat(chat.id, other);
        item.innerHTML = `
            <div class="msg-conv-avatar">${initial}</div>
            <div class="msg-conv-info">
                <div class="msg-conv-name">
                    <span>${displayName}</span>
                    <span class="msg-conv-time">${timeStr}</span>
                </div>
                <div class="msg-conv-preview">${preview.length > 42 ? preview.substring(0, 42) + '...' : preview}</div>
            </div>`;
        list.appendChild(item);
    });

    feather.replace();
    msgSetupRealtime();
}

function filterConversations() {
    const q = document.getElementById('msgSearchInput').value.toLowerCase();
    document.querySelectorAll('.msg-conv-item').forEach(el => {
        el.style.display = el.dataset.name.includes(q) ? '' : 'none';
    });
}

async function msgOpenChat(chatId, otherUser) {
    msgCurrentChatId = chatId;
    msgActiveUser = otherUser;

    if (window.innerWidth <= 768) { document.getElementById('msgSidebar').classList.add('hidden'); }

    document.getElementById('msgEmptyState').style.display = 'none';
    document.getElementById('msgChatHeader').style.display = 'flex';
    document.getElementById('msgMessages').style.display = 'flex';
    document.getElementById('msgInputWrap').style.display = 'flex';

    const initial = (otherUser.ad || '?').charAt(0).toUpperCase();
    document.getElementById('msgActiveAvatar').textContent = initial;
    document.getElementById('msgActiveName').textContent = `${otherUser.rol === 'doktor' ? 'Dr. ' : ''}${otherUser.ad} ${otherUser.soyad}`;
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

    const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('chat_id', msgCurrentChatId)
        .order('created_at', { ascending: true });

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

function msgScrollBottom() {
    const c = document.getElementById('msgMessages');
    if (c) c.scrollTop = c.scrollHeight;
}

function msgHandleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); msgSend(); }
}

function msgAutoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

async function msgSend() {
    const input = document.getElementById('msgInput');
    const content = input.value.trim();
    const editId = document.getElementById('msgEditId').value;
    if (!content || !msgCurrentChatId) return;

    input.value = ''; input.style.height = 'auto'; msgCancelEdit();

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

function msgCancelEdit() {
    document.getElementById('msgEditId').value = '';
    document.getElementById('msgEditBanner').classList.remove('show');
}

async function msgDelete(id) {
    if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
    await supabaseClient.from('messages').delete().eq('id', id);
    const el = document.getElementById(`msg-${id}`);
    if (el) el.remove();
}

function msgSetupRealtime() {
    if (msgSubscription) supabaseClient.removeChannel(msgSubscription);
    msgSubscription = supabaseClient.channel('msg-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
            const { eventType, new: nw, old: ow } = payload;
            if (eventType === 'INSERT' && nw.chat_id === msgCurrentChatId) { msgAppend(nw, true); } 
            else if (eventType === 'UPDATE' && nw.chat_id === msgCurrentChatId) { msgLoadMessages(); } 
            else if (eventType === 'DELETE' && ow.chat_id === msgCurrentChatId) {
                const el = document.getElementById(`msg-${ow.id}`); if (el) el.remove();
            }
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
        if (createErr) return; chat = newChat;
    }

    await msgLoadConversations();
    await msgOpenChat(chat.id, targetUser);
}

/* ================= TAKVİM FONKSİYONLARI ================= */
function calToDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function calGetWeekDays(offset = 0) {
    const now = new Date();
    const day = now.getDay() || 7; 
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1 + offset * 7);
    monday.setHours(0,0,0,0);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}

function initCalendarTab() {
    if (calInitialized) return;
    calInitialized = true;
    calFetchNotes();
}

async function calFetchNotes() {
    const loader = document.getElementById('calLoader');
    if (loader) loader.style.display = 'flex';
    const days = calGetWeekDays(calWeekOffset);
    
    // 1. Kişisel Notları Çek
    const { data: notesData } = await supabaseClient
        .from('notes')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('note_date', calToDateStr(days[0]))
        .lte('note_date', calToDateStr(days[6]))
        .not('note_date', 'is', null)
        .not('note_time', 'is', null);

    // 2. Onaylanmış Randevuları Çek
    let apptsData = [];
    try {
        const { data } = await supabaseClient
            .from('appointments')
            .select('*, users!farmer_id(ad, soyad)')
            .eq('doctor_id', currentUser.id)
            .in('status', ['approved'])
            .gte('appointment_date', calToDateStr(days[0]))
            .lte('appointment_date', calToDateStr(days[6]));
        if(data) apptsData = data;
    } catch(e) {}

    if (loader) loader.style.display = 'none';

    calNotes = [];
    
    if(notesData) {
        notesData.forEach(n => {
            calNotes.push({
                type: 'note', id: n.id, title: n.title, content: n.content,
                note_date: n.note_date, note_time: n.note_time, end_time: n.end_time,
                color: n.color || 0, raw: n
            });
        });
    }

    if(apptsData) {
        apptsData.forEach(a => {
            const patientName = a.users ? `${a.users.ad} ${a.users.soyad}` : 'Kullanıcı';
            calNotes.push({
                type: 'appointment', id: a.id, title: `Randevu: ${patientName}`,
                content: a.notes || 'Şikayet belirtilmemiş.',
                note_date: a.appointment_date, note_time: a.appointment_time, end_time: null,
                color: 3, 
                raw: a
            });
        });
    }

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
        `${first.getDate()} ${CAL_TR_MONTHS[first.getMonth()]} – ${last.getDate()} ${CAL_TR_MONTHS[last.getMonth()]} ${last.getFullYear()}` +
        `<span>${calWeekOffset === 0 ? 'Bu Hafta' : calWeekOffset > 0 ? `+${calWeekOffset} hafta` : `${calWeekOffset} hafta`}</span>`;

    const dh = document.getElementById('calDaysHeader');
    dh.innerHTML = '<div class="cal-days-spacer"></div>';
    days.forEach((d, i) => {
        const isToday = calToDateStr(d) === today;
        const dayNotes = calNotes.filter(n => calNormDate(n.note_date) === calToDateStr(d));
        const dots = dayNotes.slice(0, 3).map(() => `<div class="cal-dot"></div>`).join('');
        dh.innerHTML += `
            <div class="cal-day-cell ${isToday ? 'cal-today' : ''}" onclick="calOpenAddModal('${calToDateStr(d)}', null)">
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
            line.className = 'cal-now-line';
            line.id = 'calNowLine';
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

function calNormDate(val) { return val ? String(val).substring(0, 10) : null; }
function calNormTime(val) { return val ? String(val).substring(0, 5) : null; }

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
    } else if (note.type === 'appointment') {
        durMin = 45; 
    }
    const heightPx = Math.max((durMin / 60) * hourH - 4, 28);

    const block = document.createElement('div');
    if(note.type === 'appointment') {
        block.className = `cal-note-block cal-color-${note.color}`;
        block.style.borderLeft = '3px solid var(--success)';
    } else {
        block.className = `cal-note-block cal-color-${note.color || 0}`;
    }
    
    block.style.top = topPx + 'px';
    block.style.height = heightPx + 'px';
    const endStr = note.end_time ? ` – ${calNormTime(note.end_time)}` : '';
    block.innerHTML = `
        <div class="cal-note-title">${note.title}</div>
        <div class="cal-note-time">${timeRaw}${endStr}</div>`;
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
    document.querySelectorAll('#calColorPicker .cal-color-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`#calColorPicker .cal-color-btn[data-c="${c}"]`).classList.add('selected');
}

async function calSaveFastNote() {
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

    const { error } = await supabaseClient.from('notes').insert([{
        user_id: currentUser.id, title, content: desc || title,
        note_date: date, note_time: time, end_time: end || null,
        color: calSelectedColor, images: [], tags: []
    }]);

    btn.disabled = false;
    btn.innerHTML = '<i data-feather="check" style="width:13px;height:13px;"></i> Kaydet';
    feather.replace();

    if (error) { showToast('Hata: ' + error.message, 'error'); return; }
    calCloseAddModal();
    fetchNotes(); 
    await calFetchNotes();
    showToast('Takvim notu eklendi.');
}

function calOpenDetail(note) {
    const colorNames = ['Genel','Toplantı','Ameliyat','Kontrol','Özel','Acil'];
    const t = calNormTime(note.note_time);
    const endT = calNormTime(note.end_time);
    const timeStr = t + (endT ? ` – ${endT}` : '');
    const dateRaw = calNormDate(note.note_date);
    const dateObj = new Date(dateRaw + 'T00:00:00');
    const dateStr = `${dateObj.getDate()} ${CAL_TR_MONTHS[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    const bodyText = note.content && note.content !== note.title ? note.content : null;

    let footerHtml = '';
    if(note.type === 'note') {
        footerHtml = `
        <button class="cal-btn-delete" onclick="calDeleteNote('${note.id}')">
            <i data-feather="trash-2" style="width:13px;height:13px;"></i> Sil
        </button>
        <div style="flex:1;"></div>
        <button class="cal-btn-cancel" onclick="calCloseDetail()" style="cursor:pointer;">Kapat</button>`;
    } else {
        footerHtml = `
        <div style="flex:1; font-size:11px; color:var(--text-muted); display:flex; align-items:center;">
            <i data-feather="info" style="width:12px; margin-right:4px;"></i> Yönetmek için Randevularım sekmesine gidin.
        </div>
        <button class="cal-btn-cancel" onclick="calCloseDetail()" style="cursor:pointer;">Kapat</button>`;
    }

    document.getElementById('calDetailCard').innerHTML = `
        <div class="cal-detail-hero cal-color-${note.color || 0}">
            <div class="cal-detail-type">${note.type === 'appointment' ? 'Onaylı Randevu' : colorNames[note.color || 0]} · ${dateStr}</div>
            <div class="cal-detail-title">${note.title}</div>
            <div class="cal-detail-time"><i data-feather="clock" style="width:12px;height:12px;"></i> ${timeStr}</div>
        </div>
        ${bodyText ? `<div class="cal-detail-body"><div class="cal-detail-desc">${bodyText}</div></div>` : '<div style="height:12px;"></div>'}
        <div class="cal-detail-footer">${footerHtml}</div>`;
    feather.replace();
    document.getElementById('calDetailModal').classList.add('open');
}
function calCloseDetail() { document.getElementById('calDetailModal').classList.remove('open'); }

async function calDeleteNote(id) {
    if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    const { error } = await supabaseClient.from('notes').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) { showToast('Silme hatası: ' + error.message, 'error'); return; }
    calCloseDetail();
    fetchNotes(); 
    await calFetchNotes();
    showToast('Takvim notu silindi.');
}

/* ================= AĞIRLAŞTIRILMIŞ GÜVENLİK (TEK KOPYA) ================= */
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', function(e) {
    if ( e.keyCode === 123 || (e.ctrlKey && e.shiftKey && e.keyCode === 73) || (e.ctrlKey && e.shiftKey && e.keyCode === 74) || (e.ctrlKey && e.shiftKey && e.keyCode === 67) || (e.ctrlKey && e.keyCode === 85) ) {
        e.preventDefault(); return false;
    }
});
setInterval(function() { console.clear(); }, 1000);
setInterval(function() { (function() { return false; }['constructor']('debugger')()); }, 100);