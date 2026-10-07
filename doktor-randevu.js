feather.replace();

const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let allAppointments = [];
let activeTab = 'pending';

window.addEventListener('DOMContentLoaded', async () => { 
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) { window.location.href = "index.html"; return; }
    currentUser = session.user;
    
    const { data: profile } = await supabaseClient.from('users').select('rol').eq('id', currentUser.id).single();
    if (!profile || profile.rol !== 'doktor') { alert("Yetkisiz giriş!"); window.location.href="index.html"; return; }

    fetchAppointments(); 
});

function switchTab(status, btnElement) {
    activeTab = status;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    renderAppointments();
}

async function fetchAppointments() {
    document.getElementById('loadingStatus').style.display = 'block';
    document.getElementById('appointmentsContainer').innerHTML = '';

    const { data, error } = await supabaseClient
        .from('appointments')
        .select('*, farmer:users!appointments_farmer_id_fkey(ad, soyad, telefon, sehir)')
        .eq('doctor_id', currentUser.id)
        .order('appointment_date', { ascending: true });
    
    document.getElementById('loadingStatus').style.display = 'none';
    if (error) { alert("Hata: " + error.message); return; }
    
    allAppointments = data || [];
    renderAppointments();
}

function renderAppointments() {
    const container = document.getElementById('appointmentsContainer');
    container.innerHTML = '';
    
    const filtered = allAppointments.filter(apt => apt.status === activeTab);

    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted); border:1px dashed var(--border); border-radius:16px;">Bu kategoride randevu bulunmuyor.</div>`;
        return;
    }

    filtered.forEach(apt => {
        const farmerName = apt.farmer ? `${apt.farmer.ad} ${apt.farmer.soyad}` : 'Kullanıcı';
        const farmerPhone = apt.farmer ? apt.farmer.telefon : '-';
        const farmerCity = apt.farmer ? apt.farmer.sehir : 'Belirtilmemiş';
        
        const locText = apt.location_type === 'farm' ? 'Çiftliğe Ziyaret İstendi' : 'Kliniğinize Gelecek';
        const formattedDate = new Date(apt.appointment_date).toLocaleDateString('tr-TR');

        let statusBadge = '';
        if(apt.status === 'pending') statusBadge = '<span class="apt-status status-pending">Onayınızı Bekliyor</span>';
        else if(apt.status === 'approved') statusBadge = '<span class="apt-status status-approved">Onaylandı</span>';
        else if(apt.status === 'rejected') statusBadge = '<span class="apt-status status-rejected">İptal / Reddedildi</span>';

        let animalHTML = '';
        if(apt.animal_details && apt.animal_details.length > 0) {
            apt.animal_details.forEach(a => {
                animalHTML += `<div style="margin-bottom:4px;"><strong>${a.count} Adet ${a.type} (${a.gender})</strong> - Şikayet/İşlem: ${a.illness}</div>`;
            });
        } else { animalHTML = 'Detay girilmemiş.'; }

        let actionHTML = '';
        if(apt.status === 'pending') {
            actionHTML = `
                <button class="btn-danger" onclick="updateStatus('${apt.id}', 'rejected')"><i data-feather="x"></i> Reddet</button>
                <button class="btn-success" onclick="updateStatus('${apt.id}', 'approved')"><i data-feather="check"></i> Onayla</button>
            `;
        } else if(apt.status === 'approved') {
            const waLink = `https://wa.me/90${farmerPhone.replace(/\D/g,'')}`;
            actionHTML = `
                <button class="btn-danger" onclick="updateStatus('${apt.id}', 'rejected')"><i data-feather="slash"></i> İptal Et</button>
                <button class="btn-whatsapp" onclick="window.open('${waLink}', '_blank')"><i data-feather="message-circle"></i> WhatsApp</button>
            `;
        }

        const card = `
            <div class="card">
                <div>${statusBadge}</div>
                <div class="farmer-header">
                    <div class="farmer-avatar">${farmerName.charAt(0).toUpperCase()}</div>
                    <div class="farmer-info">
                        <h3>${farmerName}</h3>
                        <p><i data-feather="map-pin" style="width:12px;"></i> ${farmerCity}</p>
                    </div>
                </div>

                <div class="apt-detail-row"><i data-feather="calendar"></i> <span><strong>Tarih:</strong> ${formattedDate} - ${apt.appointment_time}</span></div>
                <div class="apt-detail-row"><i data-feather="truck"></i> <span><strong>Lokasyon:</strong> ${locText}</span></div>
                <div class="apt-detail-row"><i data-feather="phone"></i> <span><strong>Telefon:</strong> ${farmerPhone}</span></div>
                
                <div class="animal-box">
                    <div style="font-weight:600; margin-bottom:5px; border-bottom:1px solid var(--border); padding-bottom:5px;">Hayvan / Müdahale Detayı</div>
                    ${animalHTML}
                </div>

                ${apt.notes ? `<div style="font-size:12px; color:var(--text-muted); margin-top:10px; line-height:1.5;"><strong>Ek Not:</strong> ${apt.notes}</div>` : ''}

                ${actionHTML ? `<div class="card-actions">${actionHTML}</div>` : ''}
            </div>
        `;
        container.innerHTML += card;
    });
    feather.replace();
}

async function updateStatus(id, newStatus) {
    if(newStatus === 'rejected') {
        if(!confirm("Bu randevu talebini reddetmek / iptal etmek istediğinize emin misiniz?")) return;
    }

    const { error } = await supabaseClient
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

    if (error) {
        alert("İşlem başarısız: " + error.message);
    } else {
        fetchAppointments(); 
    }
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
        // Sitenin içini tamamen sil ve uyarı bas
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