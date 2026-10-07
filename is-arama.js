function applyThemeIcon() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const el = document.getElementById('themeIcon');
    if (el) { el.setAttribute('data-feather', theme === 'dark' ? 'sun' : 'moon'); feather.replace(); }
}
feather.replace();
applyThemeIcon();

function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme') || 'light';
    const next = curr === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('AgriSynth-theme', next);
    applyThemeIcon();
}

const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let userRole = 'user';
let allJobs = [];
let myJobs = [];
let allApplications = [];
let jobFilter = 'all';

window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) return window.location.href = 'index.html';
    currentUser = session.user;
    let name = 'Kullanıcı';
    try {
        const { data: profile, error: profileError } = await supabaseClient.from('users').select('ad, soyad, rol').eq('id', currentUser.id).single();
        if (profile && !profileError) {
            name = `${profile.ad || ''} ${profile.soyad || ''}`.trim() || name;
            userRole = (profile.rol || '').toLowerCase();
        } else {
            name = currentUser.email?.split('@')[0] || name;
        }
    } catch(e) { name = currentUser.email?.split('@')[0] || name; }

    document.getElementById('userName').innerText = name;
    document.getElementById('userAvatar').innerText = name.charAt(0).toUpperCase();

    if (userRole === 'ciftci' || userRole === 'çiftçi') {
        document.getElementById('navMyAppsTab').style.display = 'none';
    } else {
        document.getElementById('navEmployerTab').style.display = 'none';
        document.getElementById('btnPostJob').style.display = 'none';
    }
    fetchJobs();
});

function returnToDashboard() {
    if (userRole === 'ciftci' || userRole === 'çiftçi') window.location.href = 'ciftci.html';
    else window.location.href = 'normal-user.html';
}

function switchTab(tabId, element) {
    document.querySelectorAll('.tab-section').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
    if (tabId === 'jobs-tab') fetchJobs();
    if (tabId === 'employer-tab') fetchEmployerDashboard();
    if (tabId === 'myapps-tab') fetchMyApplications();
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ── İŞ ARAMA ──
async function fetchJobs() {
    document.getElementById('jobsLoading').style.display = 'flex';
    document.getElementById('jobsContainer').innerHTML = '';
    const { data, error } = await supabaseClient.from('jobs').select('*, users (ad, soyad)').order('created_at', { ascending: false });
    document.getElementById('jobsLoading').style.display = 'none';
    if (error) return alert("İlanlar çekilirken hata oluştu.");
    allJobs = data || [];
    renderJobs();
}

function renderJobs() {
    const container = document.getElementById('jobsContainer');
    const searchVal = document.getElementById('jobSearch').value.toLowerCase();
    let filtered = allJobs;
    if (jobFilter !== 'all') filtered = filtered.filter(j => j.job_type === jobFilter);
    if (searchVal) {
        filtered = filtered.filter(j =>
            (j.title||'').toLowerCase().includes(searchVal) ||
            (j.company_name||'').toLowerCase().includes(searchVal) ||
            (j.skills && j.skills.join(' ').toLowerCase().includes(searchVal))
        );
    }
    if (filtered.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">Arama kriterlerinize uygun ilan bulunamadı.</div>';
        return;
    }
    const typeMap = { fulltime:'Tam Zamanlı', parttime:'Yarı Zamanlı', seasonal:'Mevsimlik', intern:'Staj' };
    container.innerHTML = filtered.map(job => {
        const posterName = job.users ? `${job.users.ad} ${job.users.soyad}` : 'Kullanıcı';
        const createdDate = new Date(job.created_at).toLocaleDateString('tr-TR');
        const logoLetter = (job.company_name || 'Ş').charAt(0).toUpperCase();
        const jobType = typeMap[job.job_type] || job.job_type;
        const deadline = job.deadline ? new Date(job.deadline).toLocaleDateString('tr-TR') : null;
        return `
        <div class="job-card">
            <div class="job-card-banner"></div>
            <div class="job-card-inner">
                <div class="job-company-row">
                    <div class="job-logo">${logoLetter}</div>
                    <div class="job-company-details">
                        <div class="job-company-name">${job.company_name}</div>
                        <div class="job-poster-line"><i data-feather="user" style="width:10px;height:10px;"></i>${posterName}</div>
                    </div>
                    <span class="job-type-badge">${jobType}</span>
                </div>
                <div class="job-title-new">${job.title}</div>
                <div class="job-desc-new">${job.description}</div>
                <div class="job-meta-row">
                    <span class="job-meta-pill"><i data-feather="map-pin"></i> ${job.location}</span>
                    <span class="job-meta-pill"><i data-feather="calendar"></i> ${createdDate}</span>
                    ${job.salary_range ? `<span class="job-meta-pill salary">₺ ${job.salary_range}</span>` : ''}
                    ${deadline ? `<span class="job-meta-pill"><i data-feather="clock"></i> Son: ${deadline}</span>` : ''}
                </div>
            </div>
            <div class="job-card-footer">
                <button class="job-apply-btn" onclick="applyToJob('${job.id}')">
                    <i data-feather="send" style="width:14px;height:14px;"></i> Başvur
                </button>
                <button class="job-detail-btn" onclick="openJobDetail('${job.id}')" title="Detay">
                    <i data-feather="info" style="width:16px;height:16px;"></i>
                </button>
            </div>
        </div>`;
    }).join('');
    feather.replace();
}

document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', e => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        jobFilter = e.target.getAttribute('data-filter');
        renderJobs();
    });
});
document.getElementById('jobSearch').addEventListener('input', renderJobs);
function applyJobFilters() { renderJobs(); }

function openJobDetail(jobId, fromEmployer = false) {
    let job = allJobs.find(j => j.id === jobId);
    if (!job && myJobs.length > 0) job = myJobs.find(j => j.id === jobId);
    if (!job) return;

    const typeMap = { fulltime:'Tam Zamanlı', parttime:'Yarı Zamanlı', seasonal:'Mevsimlik', intern:'Staj' };
    const deadlineStr = job.deadline ? new Date(job.deadline).toLocaleDateString('tr-TR') : 'Belirtilmemiş';
    const posterName = job.users ? `${job.users.ad} ${job.users.soyad}` : 'Kullanıcı';
    const logoLetter = (job.company_name || 'Ş').charAt(0).toUpperCase();
    const jobType = typeMap[job.job_type] || job.job_type;
    const createdDate = new Date(job.created_at).toLocaleDateString('tr-TR');
    const skillsHtml = (job.skills && job.skills.length > 0)
        ? job.skills.map(s => `<span class="jdm-skill-tag">${s}</span>`).join('')
        : '<span style="font-size:13px;color:var(--text-muted);">Özel bir yetenek belirtilmemiş.</span>';

    // ── FOOTER: İşveren kendi ilanını görüyorsa sadece Kapat
    //            Normal kullanıcı görüyorsa: Başvur + Mesaj Gönder + Kapat
    let footerHtml = '';
    if (fromEmployer) {
        footerHtml = `<button class="jdm-close-text-btn" onclick="closeModal('jobDetailModal')">Kapat</button>`;
    } else {
        // Kendi ilanıysa mesaj butonu gösterme
        const isOwn = job.user_id === currentUser?.id;
        footerHtml = `
            <button class="jdm-close-text-btn" onclick="closeModal('jobDetailModal')">Kapat</button>
            ${!isOwn ? `
            <button class="jdm-msg-btn" onclick="startChatWithPoster('${job.user_id}')">
                <i data-feather="message-circle" style="width:15px;height:15px;"></i> Mesaj Gönder
            </button>` : ''}
            <button class="jdm-apply-btn" onclick="applyToJob('${job.id}')">
                <i data-feather="send" style="width:15px;height:15px;"></i> Başvur
            </button>`;
    }

    document.getElementById('jobDetailModalContent').innerHTML = `
        <div class="jdm-hero">
            <div class="jdm-hero-particles"></div>
            <div class="jdm-hero-top">
                <div class="jdm-logo">${logoLetter}</div>
                <div class="jdm-hero-info">
                    <div class="jdm-company"><i data-feather="building" style="width:12px;height:12px;"></i>${job.company_name}</div>
                    <div class="jdm-title">${job.title}</div>
                    <div class="jdm-poster"><i data-feather="user" style="width:11px;height:11px;"></i>İlanı veren: ${posterName}</div>
                </div>
                <button class="jdm-close-btn" onclick="closeModal('jobDetailModal')"><i data-feather="x" style="width:16px;height:16px;"></i></button>
            </div>
            <div class="jdm-hero-pills">
                <span class="jdm-pill"><i data-feather="map-pin"></i> ${job.location}</span>
                <span class="jdm-pill accent"><i data-feather="briefcase"></i> ${jobType}</span>
                ${job.salary_range ? `<span class="jdm-pill accent"><i data-feather="tag"></i> ₺ ${job.salary_range}</span>` : ''}
                <span class="jdm-pill"><i data-feather="calendar"></i> ${createdDate}</span>
            </div>
        </div>
        <div class="jdm-body">
            <div class="jdm-section">
                <div class="jdm-section-title"><i data-feather="align-left"></i> İş Tanımı</div>
                <div class="jdm-desc-text">${job.description}</div>
            </div>
            <div class="jdm-section">
                <div class="jdm-section-title"><i data-feather="check-circle"></i> Aranan Nitelikler</div>
                <div class="jdm-skills-wrap">${skillsHtml}</div>
            </div>
            <div class="jdm-section">
                <div class="jdm-section-title"><i data-feather="info"></i> Detaylar</div>
                <div class="jdm-info-grid">
                    <div class="jdm-info-box"><div class="jdm-info-label"><i data-feather="clock"></i> Son Başvuru</div><div class="jdm-info-value">${deadlineStr}</div></div>
                    <div class="jdm-info-box"><div class="jdm-info-label"><i data-feather="briefcase"></i> Çalışma Tipi</div><div class="jdm-info-value">${jobType}</div></div>
                    <div class="jdm-info-box"><div class="jdm-info-label"><i data-feather="map-pin"></i> Konum</div><div class="jdm-info-value">${job.location}</div></div>
                    <div class="jdm-info-box"><div class="jdm-info-label"><i data-feather="message-square"></i> İletişim</div><div class="jdm-info-value" style="font-size:13px;font-weight:500;">${job.instructions || 'Sistem üzerinden başvurun'}</div></div>
                </div>
            </div>
        </div>
        <div class="jdm-footer">${footerHtml}</div>`;

    feather.replace();
    document.getElementById('jobDetailModal').classList.add('active');
}

// ── MESAJ GÖNDER: ilan sahibiyle sohbet başlat ──
async function startChatWithPoster(posterUserId) {
    if (!posterUserId || posterUserId === currentUser?.id) return;

    closeModal('jobDetailModal');

    // Chat kaydı oluştur / bul
    const id1 = currentUser.id < posterUserId ? currentUser.id : posterUserId;
    const id2 = currentUser.id < posterUserId ? posterUserId : currentUser.id;

    let { data: chat } = await supabaseClient
        .from('chats')
        .select('*')
        .eq('user1_id', id1)
        .eq('user2_id', id2)
        .maybeSingle();

    if (!chat) {
        const { data: newChat, error } = await supabaseClient
            .from('chats')
            .insert([{ user1_id: id1, user2_id: id2 }])
            .select()
            .single();
        if (error) { alert('Sohbet başlatılamadı: ' + error.message); return; }
        chat = newChat;
    }

    // Kullanıcı paneline yönlendir — mesajlar sekmesini aç ve direkt sohbete gir
    window.location.href = `normal-user.html?tab=messages&chatUserId=${posterUserId}`;
}

async function applyToJob(jobId) {
    const job = allJobs.find(j => j.id === jobId) || myJobs.find(j => j.id === jobId);
    if (job && job.user_id === currentUser.id) return alert("Kendi ilanınıza başvuramazsınız!");
    if (!confirm("Bu ilana başvurmak istediğinize emin misiniz?")) return;
    const { error } = await supabaseClient.from('applications').insert([{ job_id: jobId, applicant_id: currentUser.id, status: 'pending' }]);
    if (error) {
        if (error.code === '23505') alert("Bu ilana zaten başvurdunuz.");
        else alert("Başvuru sırasında hata oluştu: " + error.message);
    } else {
        closeModal('jobDetailModal');
        alert("Başvurunuz başarıyla işverene iletildi!");
    }
}

// ── BAŞVURULARIM ──
async function fetchMyApplications() {
    const loader = document.getElementById('myAppsLoading');
    const container = document.getElementById('myAppsContainer');
    loader.style.display = 'flex'; container.innerHTML = '';
    const { data, error } = await supabaseClient
        .from('applications')
        .select('id, status, created_at, jobs (title, company_name, location, job_type, salary_range, deadline)')
        .eq('applicant_id', currentUser.id)
        .order('created_at', { ascending: false });
    loader.style.display = 'none';
    if (error) return alert("Başvurularınız yüklenirken bir hata oluştu.");
    if (!data || data.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;"><div style="width:64px;height:64px;border-radius:20px;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;"><i data-feather="inbox" style="color:var(--primary);width:28px;height:28px;"></i></div><div style="font-size:16px;font-weight:600;margin-bottom:6px;color:var(--text-main);">Henüz başvuru yapılmadı</div></div>`;
        feather.replace(); return;
    }
    const typeMap = { fulltime:'Tam Zamanlı', parttime:'Yarı Zamanlı', seasonal:'Mevsimlik', intern:'Staj' };
    const statusConfig = { pending:{cls:'pending',label:'Değerlendiriliyor',steps:1}, accepted:{cls:'accepted',label:'Kabul Edildi',steps:3}, rejected:{cls:'rejected',label:'Reddedildi',steps:3} };
    container.innerHTML = data.map(app => {
        const job = app.jobs || {};
        const companyInitial = (job.company_name||'Ş').charAt(0).toUpperCase();
        const sc = statusConfig[app.status] || statusConfig.pending;
        const deadline = job.deadline ? new Date(job.deadline).toLocaleDateString('tr-TR') : 'Belirtilmemiş';
        const appDate = new Date(app.created_at).toLocaleDateString('tr-TR');
        const appTime = new Date(app.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'});
        const jobType = typeMap[job.job_type] || '—';
        const stepsHtml = [0,1,2].map(i => { let cls='myapp-step'; if(i<sc.steps) cls+=app.status==='rejected'?' done rejected':' done'; return `<div class="${cls}"></div>`; }).join('');
        return `
        <div class="myapp-card">
            <div class="myapp-card-top">
                <div class="myapp-company-icon">${companyInitial}</div>
                <div class="myapp-card-info">
                    <div class="myapp-job-title">${job.title||'Bilinmeyen İlan'}</div>
                    <div class="myapp-company-name">${job.company_name||'Bilinmeyen Şirket'}</div>
                    <div class="myapp-status-row"><span class="myapp-badge ${sc.cls}"><span class="myapp-badge-dot"></span>${sc.label}</span></div>
                </div>
            </div>
            <div class="myapp-divider"></div>
            <div class="myapp-card-meta">
                <div class="myapp-meta-item"><div class="myapp-meta-icon"><i data-feather="map-pin"></i></div><div><div class="myapp-meta-label">Konum</div><div class="myapp-meta-value">${job.location||'—'}</div></div></div>
                <div class="myapp-meta-item"><div class="myapp-meta-icon"><i data-feather="briefcase"></i></div><div><div class="myapp-meta-label">Çalışma Tipi</div><div class="myapp-meta-value">${jobType}</div></div></div>
                <div class="myapp-meta-item"><div class="myapp-meta-icon" style="font-size:13px;font-weight:700;color:var(--primary);">₺</div><div><div class="myapp-meta-label">Maaş</div><div class="myapp-meta-value">${job.salary_range||'Belirtilmemiş'}</div></div></div>
                <div class="myapp-meta-item"><div class="myapp-meta-icon"><i data-feather="calendar"></i></div><div><div class="myapp-meta-label">Son Başvuru</div><div class="myapp-meta-value">${deadline}</div></div></div>
            </div>
            <div class="myapp-card-footer">
                <div class="myapp-progress-bar-wrap"><div class="myapp-progress-steps">${stepsHtml}</div><div class="myapp-step-label"><span>Başvuruldu</span><span>İnceleniyor</span><span>Sonuç</span></div></div>
                <div class="myapp-date">${appDate} ${appTime}</div>
            </div>
        </div>`;
    }).join('');
    feather.replace();
}

// ── İŞVEREN PANELİ ──
async function fetchEmployerDashboard() {
    const loader = document.getElementById('applicantsLoading');
    loader.style.display = 'flex'; document.getElementById('applicantsContainer').innerHTML = '';
    const { data: myJobsData, error: jobsError } = await supabaseClient.from('jobs').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (jobsError) return console.error(jobsError);
    myJobs = myJobsData || [];
    document.getElementById('empActiveJobs').innerText = myJobs.length;
    const jobsContainer = document.getElementById('myJobsContainer');
    if (myJobs.length === 0) {
        jobsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);grid-column:1/-1;">Aktif ilanınız bulunmuyor.</div>';
        loader.style.display = 'none'; document.getElementById('applicantsContainer').innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-muted);">İlanlarınıza henüz başvuru yapılmamış.</div>'; return;
    }
    const typeMap = { fulltime:'Tam Zamanlı', parttime:'Yarı Zamanlı', seasonal:'Mevsimlik', intern:'Staj' };
    jobsContainer.innerHTML = myJobs.map(job => {
        const deadline = job.deadline ? new Date(job.deadline).toLocaleDateString('tr-TR') : null;
        const jobType = typeMap[job.job_type] || job.job_type;
        return `<div class="employer-job-card"><div class="emp-job-title-row"><div><div class="emp-job-title">${job.title}</div><div class="emp-job-company">${job.company_name}</div></div></div><div class="emp-job-meta"><span class="emp-meta-pill"><i data-feather="map-pin"></i> ${job.location}</span><span class="emp-meta-pill"><i data-feather="briefcase"></i> ${jobType}</span>${job.salary_range?`<span class="emp-meta-pill">₺ ${job.salary_range}</span>`:''}${deadline?`<span class="emp-meta-pill"><i data-feather="clock"></i> ${deadline}</span>`:''}</div><div class="emp-job-actions"><button class="emp-btn-view" onclick="openJobDetail('${job.id}',true)"><i data-feather="eye" style="width:13px;height:13px;"></i> Detay</button><button class="emp-btn-delete" onclick="deleteJob('${job.id}')"><i data-feather="trash-2" style="width:14px;height:14px;"></i></button></div></div>`;
    }).join('');
    const myJobIds = myJobs.map(j => j.id);
    const { data: appsData, error: appsError } = await supabaseClient.from('applications').select('id, status, created_at, job_id, jobs (title), users (ad, soyad, email, telefon, sehir)').in('job_id', myJobIds).order('created_at', { ascending: false });
    loader.style.display = 'none';
    if (appsError) return alert("Başvurular yüklenirken hata oluştu: " + appsError.message);
    allApplications = appsData || [];
    document.getElementById('empTotalApps').innerText = allApplications.length;
    document.getElementById('empNewApps').innerText = allApplications.filter(a => a.status === 'pending').length;
    feather.replace();
    if (allApplications.length === 0) { document.getElementById('applicantsContainer').innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-muted);">İlanlarınıza henüz başvuru yapılmamış.</div>'; return; }
    const container = document.getElementById('applicantsContainer');
    container.innerHTML = allApplications.map(app => {
        const applicantName = `${app.users?.ad||''} ${app.users?.soyad||''}`.trim() || 'Aday';
        const initial = applicantName.charAt(0).toUpperCase();
        const jobTitle = app.jobs?.title || 'İlan';
        let statusHtml = '', actionBtns = '';
        if (app.status === 'pending') {
            statusHtml = `<span class="status-badge status-pending">Yeni Bekliyor</span>`;
            actionBtns = `<button class="btn-icon" style="color:var(--info);border-color:var(--info)" onclick="openApplicantDetail('${app.id}')"><i data-feather="search"></i></button><button class="btn-icon" style="color:#22c55e;border-color:#22c55e" onclick="updateAppStatus('${app.id}','accepted')"><i data-feather="check"></i></button><button class="btn-icon" style="color:var(--danger);border-color:var(--danger)" onclick="updateAppStatus('${app.id}','rejected')"><i data-feather="x"></i></button>`;
        } else {
            statusHtml = `<span class="status-badge ${app.status==='accepted'?'status-accepted':'status-rejected'}">${app.status==='accepted'?'Kabul Edildi':'Reddedildi'}</span>`;
            actionBtns = `<button class="btn-icon" style="color:var(--info);border-color:var(--info)" onclick="openApplicantDetail('${app.id}')"><i data-feather="search"></i></button>`;
        }
        return `<div class="applicant-item"><div class="applicant-info"><div class="applicant-avatar">${initial}</div><div><div style="font-weight:600;color:var(--text-main);">${applicantName}</div><div style="font-size:12px;color:var(--text-muted);">Başvuru: <strong>${jobTitle}</strong> • ${new Date(app.created_at).toLocaleDateString('tr-TR')}</div></div></div><div style="display:flex;align-items:center;gap:15px;">${statusHtml}<div class="action-btns">${actionBtns}</div></div></div>`;
    }).join('');
    feather.replace();
}

async function deleteJob(jobId) {
    if (!confirm("Bu ilanı silmek istediğinize emin misiniz?\n\nDİKKAT: Bu ilana yapılan tüm başvurular da kalıcı olarak silinecektir!")) return;
    const { error } = await supabaseClient.from('jobs').delete().eq('id', jobId);
    if (error) alert("İlan silinirken bir hata oluştu: " + error.message);
    else { alert("İlan ve bağlı başvurular başarıyla silindi."); fetchEmployerDashboard(); }
}

function openApplicantDetail(appId) {
    const app = allApplications.find(a => a.id === appId); if (!app) return;
    const user = app.users || {};
    const fullName = `${user.ad||''} ${user.soyad||''}`.trim() || 'Bilinmeyen Aday';
    document.getElementById('applicantModalBody').innerHTML = `<div class="applicant-profile-header"><div class="applicant-profile-avatar">${fullName.charAt(0).toUpperCase()}</div><div><h3 style="font-size:20px;font-weight:700;">${fullName}</h3><p style="font-size:13px;color:var(--text-muted);">Başvuru: ${new Date(app.created_at).toLocaleDateString('tr-TR')}</p></div></div><h4 style="font-size:15px;margin-bottom:12px;">İletişim Bilgileri</h4><div class="applicant-contact-grid"><div class="contact-box"><i data-feather="mail"></i><div class="label">E-Posta</div><div class="value">${user.email||'Eklenmemiş'}</div></div><div class="contact-box"><i data-feather="phone"></i><div class="label">Telefon</div><div class="value">${user.telefon||'Eklenmemiş'}</div></div><div class="contact-box"><i data-feather="map-pin"></i><div class="label">Yaşadığı Yer</div><div class="value">${user.sehir||'Belirtilmemiş'}</div></div></div>`;
    feather.replace();
    document.getElementById('applicantDetailModal').classList.add('active');
}

async function updateAppStatus(appId, newStatus) {
    if (!confirm(newStatus === 'accepted' ? 'Adayı kabul etmek istediğinize emin misiniz?' : 'Adayı reddetmek istediğinize emin misiniz?')) return;
    const { error } = await supabaseClient.from('applications').update({ status: newStatus }).eq('id', appId);
    if (error) alert("Durum güncellenirken hata oluştu: " + error.message);
    else fetchEmployerDashboard();
}

function openJobModal() { document.getElementById('jobForm').reset(); document.getElementById('addJobModal').classList.add('active'); }

async function saveJob() {
    const title = document.getElementById('jTitle').value.trim();
    const company = document.getElementById('jCompany').value.trim();
    const type = document.getElementById('jType').value;
    const location = document.getElementById('jLocation').value.trim();
    const salary = document.getElementById('jSalary').value.trim();
    const desc = document.getElementById('jDesc').value.trim();
    const deadline = document.getElementById('jDeadline').value || null;
    const skillsStr = document.getElementById('jSkills').value;
    const instructions = document.getElementById('jInstructions').value.trim();
    if (!title || !company || !location || !desc) return alert("Lütfen zorunlu alanları doldurun.");
    const skillsArray = skillsStr ? skillsStr.split(',').map(s => s.trim()).filter(s => s) : [];
    const btn = document.getElementById('saveJobBtn');
    btn.disabled = true; btn.innerText = 'Yayınlanıyor...';
    const { error } = await supabaseClient.from('jobs').insert([{ user_id: currentUser.id, title, company_name: company, job_type: type, location, salary_range: salary || null, description: desc, deadline, skills: skillsArray, instructions }]);
    btn.disabled = false; btn.innerText = 'İlanı Yayınla';
    if (error) alert("İlan eklenirken hata oluştu: " + error.message);
    else { closeModal('addJobModal'); alert("İş ilanı başarıyla yayınlandı!"); if (document.getElementById('employer-tab').classList.contains('active')) fetchEmployerDashboard(); else fetchJobs(); }
}

async function logout() { await supabaseClient.auth.signOut(); window.location.href = 'index.html'; }