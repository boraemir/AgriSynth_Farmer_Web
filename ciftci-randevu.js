feather.replace();

const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let farmerProfile = null; // Çiftçinin kendi isim-soyisim profil bilgisi
let allDoctors = [];
let myAppointments = [];
let currentView = 'doctors'; 

window.addEventListener('DOMContentLoaded', async () => { 
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) { window.location.href = "index.html"; return; }
    currentUser = session.user;

    // Çiftçinin (kullanıcının) isim bilgisini alalım, Email'de lazım olacak
    const { data: fData } = await supabaseClient.from('users').select('*').eq('id', currentUser.id).single();
    if(fData) farmerProfile = fData;
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('aptDate').setAttribute('min', today);

    loadData(); 
});

// ŞIK TOAST BİLDİRİM FONKSİYONU
function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconStr = 'info';
    if(type === 'success') iconStr = 'check-circle';
    if(type === 'error') iconStr = 'alert-triangle';

    toast.innerHTML = `
        <i data-feather="${iconStr}"></i>
        <span>${msg}</span>
    `;
    
    container.appendChild(toast);
    feather.replace();
    
    setTimeout(() => { toast.classList.add('show'); }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.remove(); }, 400);
    }, 3500);
}

function switchView(view, btnElement) {
    currentView = view;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    
    document.getElementById('searchBoxContainer').style.display = view === 'doctors' ? 'flex' : 'none';
    document.getElementById('searchInput').value = ''; 

    loadData();
}

async function loadData() {
    document.getElementById('loadingStatus').style.display = 'block';
    document.getElementById('contentContainer').innerHTML = '';

    if(currentView === 'doctors') {
        await fetchDoctors();
    } else {
        await fetchMyAppointments();
    }
    document.getElementById('loadingStatus').style.display = 'none';
}

// --- DOKTORLARI ÇEKME VE LİSTELEME ---
async function fetchDoctors() {
    const { data: users, error } = await supabaseClient
        .from('users')
        .select('id, ad, soyad, sehir, telefon, email') // EMAIL SÜTUNU EKLENDİ
        .eq('rol', 'doktor');
    
    if (error) { showToast("Sistem hatası: " + error.message, "error"); return; }
    
    const { data: listings } = await supabaseClient
        .from('listings')
        .select('*')
        .eq('category', 'veteriner')
        .eq('listing_type', 'sell');

    allDoctors = users.map(user => {
        const profile = listings.find(l => l.user_id === user.id) || {};
        return { ...user, profile: profile };
    });
    
    renderDoctors(allDoctors);
}

function renderDoctors(doctorsArray) {
    const container = document.getElementById('contentContainer');
    container.innerHTML = '';

    if (doctorsArray.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:var(--text-muted); background:var(--surface); border:1px dashed var(--border); border-radius:24px;">
            <i data-feather="search" style="width:48px;height:48px;opacity:0.3;margin-bottom:15px;"></i>
            <h3 style="font-size:18px; font-weight:600; color:var(--text-main); margin-bottom:5px;">Doktor Bulunamadı</h3>
            <p style="font-size:14px;">Aradığınız kritere uygun doktor bulunamadı.</p>
        </div>`;
        feather.replace();
        return;
    }

    doctorsArray.forEach(doc => {
        const attr = doc.profile.attributes || {};
        const expertise = attr.expertise || 'Genel Veteriner';
        const clinic = attr.clinic || 'Bağımsız Çalışıyor';
        const docDataStr = encodeURIComponent(JSON.stringify(doc));

        const card = `
            <div class="card">
                <div class="doc-header">
                    <div class="doc-avatar">${doc.ad.charAt(0).toUpperCase()}</div>
                    <div class="doc-info">
                        <h3>Dr. ${doc.ad} ${doc.soyad}</h3>
                        <p style="color:var(--primary); font-weight:600; font-size:12px; margin-top:2px;">${expertise}</p>
                        <p style="margin-top:4px;"><i data-feather="map-pin" style="width:12px;"></i> ${doc.sehir || 'Belirtilmemiş'}</p>
                    </div>
                </div>
                <div class="card-body">
                    <div style="font-size:13px; color:var(--text-main); display:flex; align-items:center; gap:8px; font-weight:500;">
                        <i data-feather="home" style="width:16px; color:var(--text-muted);"></i> ${clinic}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-secondary" style="flex:1;" onclick="openProfileModal('${docDataStr}')">Profili İncele</button>
                    <button class="btn-primary" style="flex:1;" onclick="openModal('${doc.id}', '${doc.ad} ${doc.soyad}')">Randevu Al</button>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
    feather.replace();
}

function filterDoctors() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allDoctors.filter(doc => {
        const name = (doc.ad + " " + doc.soyad).toLowerCase();
        const city = (doc.sehir || "").toLowerCase();
        const expertise = ((doc.profile.attributes && doc.profile.attributes.expertise) || "").toLowerCase();
        return name.includes(query) || city.includes(query) || expertise.includes(query);
    });
    renderDoctors(filtered);
}

// --- PROFİL MODALI ---
function openProfileModal(encodedData) {
    const doc = JSON.parse(decodeURIComponent(encodedData));
    const attr = doc.profile.attributes || {};
    const priceText = doc.profile.price ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(doc.profile.price) : 'Belirtilmemiş';

    document.getElementById('profName').innerText = `Dr. ${doc.ad} ${doc.soyad}`;
    document.getElementById('profAvatar').innerText = doc.ad.charAt(0).toUpperCase();
    document.getElementById('profCity').innerText = doc.sehir || 'Şehir Belirtilmemiş';
    
    document.getElementById('profExp').innerText = attr.expertise || 'Genel Veteriner';
    document.getElementById('profTime').innerText = attr.experience || 'Belirtilmemiş';
    document.getElementById('profClinic').innerText = attr.clinic || 'Bağımsız';
    document.getElementById('profPrice').innerText = priceText;

    document.getElementById('profDesc').innerText = doc.profile.description || 'Doktor henüz detaylı bir hizmet açıklaması girmemiş.';

    const aptBtn = document.getElementById('btnProfileToApt');
    aptBtn.onclick = function() {
        closeProfileModal();
        openModal(doc.id, `${doc.ad} ${doc.soyad}`);
    };

    feather.replace();
    document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() { document.getElementById('profileModal').classList.remove('active'); }

// --- RANDEVULARIMI ÇEKME VE LİSTELEME ---
async function fetchMyAppointments() {
    const { data, error } = await supabaseClient
        .from('appointments')
        .select('*, doctor:doctor_id(ad, soyad, telefon)')
        .eq('farmer_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    if (error) { showToast("Sistem hatası: " + error.message, "error"); return; }
    myAppointments = data || [];

    const container = document.getElementById('contentContainer');
    if (myAppointments.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:80px 20px; color:var(--text-muted); background:var(--surface); border:1px dashed var(--border); border-radius:24px;">
            <i data-feather="calendar" style="width:56px;height:56px;opacity:0.3;margin-bottom:15px;"></i>
            <h3 style="font-size:18px; font-weight:600; color:var(--text-main); margin-bottom:5px;">Randevunuz Yok</h3>
            <p style="font-size:14px;">Henüz hiçbir doktordan randevu almadınız.</p>
        </div>`;
        feather.replace();
        return;
    }

    myAppointments.forEach(apt => {
        let statusHtml = '';
        let statusClass = '';
        if(apt.status === 'pending') { statusHtml = '<i data-feather="clock" style="width:12px;"></i> Bekliyor'; statusClass = 'status-pending'; }
        else if(apt.status === 'approved') { statusHtml = '<i data-feather="check" style="width:12px;"></i> Onaylandı'; statusClass = 'status-approved'; }
        else if(apt.status === 'rejected') { statusHtml = '<i data-feather="x" style="width:12px;"></i> İptal Edildi'; statusClass = 'status-rejected'; }

        const docName = apt.doctor ? `Dr. ${apt.doctor.ad} ${apt.doctor.soyad}` : 'Silinmiş Hesap';
        const locText = apt.location_type === 'farm' ? 'Çiftliğinize Gelecek' : 'Kliniğe Gideceksiniz';
        const locIcon = apt.location_type === 'farm' ? 'truck' : 'home';

        let animalStr = "Detay Yok";
        if(apt.animal_details && apt.animal_details.length > 0) {
            animalStr = apt.animal_details.map(a => `${a.count}x ${a.type}`).join(', ');
        }

        const card = `
            <div class="card ${statusClass}">
                <div class="card-header-block" style="padding:15px 20px; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="font-size:16px; font-weight:700; color:var(--text-main); margin:0;">${docName}</h3>
                    <span class="apt-status badge-${apt.status}" style="margin:0;">${statusHtml}</span>
                </div>
                <div class="card-body">
                    <div class="apt-detail-row">
                        <span class="apt-detail-label"><i data-feather="calendar"></i> Tarih</span>
                        <span class="apt-detail-value" style="color:var(--primary);">${new Date(apt.appointment_date).toLocaleDateString('tr-TR')} - ${apt.appointment_time}</span>
                    </div>
                    <div class="apt-detail-row">
                        <span class="apt-detail-label"><i data-feather="${locIcon}"></i> Konum</span>
                        <span class="apt-detail-value">${locText}</span>
                    </div>
                    <div class="apt-detail-row" style="border:none;">
                        <span class="apt-detail-label"><i data-feather="activity"></i> Müdahale</span>
                        <span class="apt-detail-value">${animalStr}</span>
                    </div>
                    ${apt.notes ? `<div style="font-size:12px; color:var(--text-muted); margin-top:10px; padding:12px; background:var(--surface-hover); border-radius:8px;"><strong>Notunuz:</strong> ${apt.notes}</div>` : ''}
                </div>
                <div class="card-actions" style="grid-template-columns: 1fr;">
                    <button class="btn-secondary" style="color:var(--danger); border-color:var(--danger); background:transparent;" onclick="deleteAppointment('${apt.id}')" title="Randevuyu Sil">
                        <i data-feather="trash-2" style="width:14px;"></i> Bu Kaydı Sil
                    </button>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
    feather.replace();
}

// --- RANDEVU FORMU İŞLEMLERİ ---
function selectLocation(type) {
    document.getElementById('loc-farm').classList.remove('selected');
    document.getElementById('loc-clinic').classList.remove('selected');
    document.getElementById(`loc-${type}`).classList.add('selected');
    document.getElementById('appointmentLocation').value = type;
}

function addAnimalRow() {
    const container = document.getElementById('animalContainer');
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
        <div style="flex:1; min-width:150px; display:flex; flex-direction:column; gap:8px;">
            <input type="text" class="form-input apt-animal-type" placeholder="Tür (Örn: İnek, Koyun)" required>
            <input type="text" class="form-input apt-animal-illness" placeholder="Hastalık / Şikayet / İşlem" required>
        </div>
        <div style="display:flex; gap:10px;">
            <input type="number" class="form-input apt-animal-count" placeholder="Adet" style="width:80px;" required>
            <select class="form-select apt-animal-gender" style="width:110px;">
                <option value="Farketmez">Cinsiyet</option>
                <option value="Erkek">Erkek</option>
                <option value="Dişi">Dişi</option>
            </select>
            <button type="button" class="btn-remove" onclick="this.parentElement.parentElement.remove()"><i data-feather="trash-2" style="width:16px;"></i></button>
        </div>
    `;
    container.appendChild(row); 
    feather.replace();
}

function openModal(docId, docName) {
    document.getElementById('appointmentForm').reset();
    document.getElementById('selectedDoctorId').value = docId;
    document.getElementById('modalTitle').innerText = `Randevu Al - Dr. ${docName}`;
    
    selectLocation('farm'); 
    document.getElementById('animalContainer').innerHTML = '';
    addAnimalRow(); 
    
    document.getElementById('appointmentModal').classList.add('active');
}

function closeModal() { document.getElementById('appointmentModal').classList.remove('active'); }

// --- GÜNCELLENMİŞ VE ÇAKIŞMA KONTROLLÜ KAYIT İŞLEMİ + EMAILJS BİLDİRİMİ ---
async function saveAppointment() {
    const docId = document.getElementById('selectedDoctorId').value;
    const date = document.getElementById('aptDate').value;
    const time = document.getElementById('aptTime').value;
    const loc = document.getElementById('appointmentLocation').value;
    const notes = document.getElementById('aptNotes').value;

    if(!date || !time) { showToast("Lütfen tarih ve saat seçiniz.", "error"); return; }

    // 1. HAYVAN BİLGİLERİNİ DOĞRULA
    let animalDetails = [];
    let isValid = true;
    document.querySelectorAll('#animalContainer .dynamic-row').forEach(row => {
        const type = row.querySelector('.apt-animal-type').value;
        const illness = row.querySelector('.apt-animal-illness').value;
        const count = row.querySelector('.apt-animal-count').value;
        const gender = row.querySelector('.apt-animal-gender').value;
        
        if(!type || !illness || !count) isValid = false;
        else animalDetails.push({ type, illness, count, gender });
    });

    if(!isValid || animalDetails.length === 0) {
        showToast("Lütfen hayvan türü, şikayet ve adet kısımlarını eksiksiz doldurun.", "info"); return;
    }

    // 2. BUTONU BEKLEME DURUMUNA AL
    const saveBtn = document.getElementById('saveAptBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-feather="loader" style="animation: spin 1s linear infinite;"></i> Kontrol ediliyor...';
    feather.replace();

    // 3. DOUBLE-BOOKING (ÇAKIŞMA) KONTROLÜ
    const { data: clashData, error: clashErr } = await supabaseClient
        .from('appointments')
        .select('id')
        .eq('doctor_id', docId)
        .eq('appointment_date', date)
        .eq('appointment_time', time)
        .in('status', ['pending', 'approved']); // Onaylı veya Bekleyen varsa izin verme!

    if (clashErr) {
        showToast("Sistem hatası: " + clashErr.message, "error");
        resetButton(saveBtn);
        return;
    }

    // EĞER ÇAKIŞMA VARSA İŞLEMİ İPTAL ET VE UYAR
    if (clashData && clashData.length > 0) {
        showToast("⚠️ Bu doktorun seçilen tarih ve saatte randevusu bulunmaktadır. Lütfen farklı bir saat seçin.", "error");
        resetButton(saveBtn);
        return;
    }

    // 4. ÇAKIŞMA YOKSA VERİTABANINA KAYDET
    const dataToSave = {
        farmer_id: currentUser.id,
        doctor_id: docId,
        appointment_date: date,
        appointment_time: time,
        location_type: loc,
        animal_details: animalDetails,
        notes: notes,
        status: 'pending' 
    };

    const { error } = await supabaseClient.from('appointments').insert([dataToSave]);
    
    if (error) { 
        showToast("Randevu alınamadı: " + error.message, "error"); 
        resetButton(saveBtn);
        return; 
    }

    // --- 5. EMAILJS İLE DOKTORA BİLDİRİM GÖNDER ---
    const selectedDoctor = allDoctors.find(d => d.id === docId);
    
    if (selectedDoctor && selectedDoctor.email) {
        const farmerFullName = farmerProfile ? (farmerProfile.ad + ' ' + farmerProfile.soyad) : 'Bir Çiftçi';
        
        const emailParams = {
            to_email: selectedDoctor.email, // Doktorun sistemdeki gerçek e-postası
            to_name: selectedDoctor.ad + ' ' + selectedDoctor.soyad,
            farmer_name: farmerFullName,
            apt_date: date,
            apt_time: time
        };

        // template_lhoccjn ve service_5dd3nnx (Sizin verdiğiniz servis ID ve Şablon)
        emailjs.send('service_5dd3nnx', 'template_lhoccjn', emailParams)
            .then(function(response) {
                console.log('Doktora bildirim maili başarıyla gönderildi!', response.status, response.text);
            }, function(error) {
                console.log('Mail gönderme başarısız oldu...', error);
            });
    }
    // --------------------------------------------------

    showToast("Randevu talebiniz başarıyla doktora iletildi!", "success");
    resetButton(saveBtn);
    closeModal();
    
    const myBtn = document.querySelectorAll('.tab-btn')[1];
    switchView('my_appointments', myBtn);
}

function resetButton(btn) {
    btn.disabled = false;
    btn.innerHTML = '<i data-feather="check"></i> Randevuyu Onayla';
    feather.replace();
}

async function deleteAppointment(id) {
    if(confirm("Bu randevu talebini tamamen silmek istediğinize emin misiniz?")) {
        const { error } = await supabaseClient.from('appointments').delete().eq('id', id);
        if(error) { showToast("Hata: " + error.message, "error"); return; }
        showToast("Kayıt başarıyla silindi.");
        loadData();
    }
}

// --- AĞIRLAŞTIRILMIŞ GÜVENLİK VE KONSOL ENGELLEME ---
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', function(e) {
    if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && e.keyCode === 73) || (e.ctrlKey && e.shiftKey && e.keyCode === 74) || (e.ctrlKey && e.shiftKey && e.keyCode === 67) || (e.ctrlKey && e.keyCode === 85)) {
        e.preventDefault(); return false;
    }
});
/*
setInterval(function() {
    console.clear();
    console.log("%cDİKKAT!", "color: red; font-size: 40px; font-weight: bold; text-shadow: 2px 2px 0 #000;");
    console.log("%cBu sistem AgriSynth güvenlik protokolleri ile korunmaktadır. İzinsiz erişim denemesi kaydediliyor.", "font-size: 16px; font-weight: bold;");
}, 1000);

const detectDevTools = function() {
    const widthThreshold = window.outerWidth - window.innerWidth > 160;
    const heightThreshold = window.outerHeight - window.innerHeight > 160;
    if (widthThreshold || heightThreshold) {
        document.body.innerHTML = `
            <div style="display:flex; height:100vh; width:100vw; background:#0f172a; color:#ef4444; align-items:center; justify-content:center; flex-direction:column; font-family:sans-serif;">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:20px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <h1 style="font-size:24px; font-weight:bold;">Güvenlik İhlali Tespit Edildi</h1>
                <p style="color:#94a3b8; margin-top:10px;">Geliştirici araçlarını kapatıp sayfayı yenileyin.</p>
            </div>`;
    }
};
setInterval(detectDevTools, 500);
setInterval(function() { (function() { return false; }['constructor']('debugger')()); }, 100);
*/