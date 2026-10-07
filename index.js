// Supabase Bağlantısı
const supabaseUrl = 'https://chozcpctihufghnzsten.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// DARK MODE TOGGLE LOGIC
function toggleTheme() {
    const htmlClasses = document.documentElement.classList;
    const themeIcon = document.getElementById('themeIcon');
    const themeIconMobile = document.getElementById('themeIconMobile');
    
    if (htmlClasses.contains('dark')) {
        htmlClasses.remove('dark');
        localStorage.setItem('theme', 'light');
        if(themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
        if(themeIconMobile) themeIconMobile.classList.replace('fa-sun', 'fa-moon');
    } else {
        htmlClasses.add('dark');
        localStorage.setItem('theme', 'dark');
        if(themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
        if(themeIconMobile) themeIconMobile.classList.replace('fa-moon', 'fa-sun');
    }
}

// INIT THEME ICON ON LOAD
window.addEventListener('DOMContentLoaded', () => {
    const isDark = document.documentElement.classList.contains('dark');
    const themeIcon = document.getElementById('themeIcon');
    const themeIconMobile = document.getElementById('themeIconMobile');
    if (isDark) {
        if(themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
        if(themeIconMobile) themeIconMobile.classList.replace('fa-moon', 'fa-sun');
    }
});

// Scroll Navbar
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (window.scrollY > 20) { 
        nav.classList.add('shadow-md'); 
        if(document.documentElement.classList.contains('dark')) {
            nav.style.background = 'rgba(15, 23, 42, 0.95)';
        } else {
            nav.style.background = 'rgba(255, 255, 255, 0.9)';
        }
    } else { 
        nav.classList.remove('shadow-md'); 
        nav.style.background = ''; // Resets to CSS class style
    }
});

// MOBİL MENÜ ANİMASYONU
function toggleMobileMenu() { 
    const menu = document.getElementById('mobile-menu');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        setTimeout(() => {
            menu.classList.add('opacity-100', 'translate-y-0');
            menu.classList.remove('opacity-0', '-translate-y-4');
        }, 10);
    } else {
        menu.classList.remove('opacity-100', 'translate-y-0');
        menu.classList.add('opacity-0', '-translate-y-4');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300); // Transition süresi kadar bekle
    }
}

function openModal(mode) {
    const modal = document.getElementById('authModal');
    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden'; 
    toggleAuthMode(mode);
}

function closeModal() {
    const modal = document.getElementById('authModal');
    modal.classList.add('hidden'); 
    modal.classList.remove('flex');
    document.body.style.overflow = 'auto'; 
    document.getElementById('authMessage').classList.add('hidden');
}

document.getElementById('authModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

function toggleAuthMode(mode) {
    document.getElementById('authMessage').classList.add('hidden');
    const loginContainer = document.getElementById('loginFormContainer');
    const registerContainer = document.getElementById('registerFormContainer');
    const forgotContainer = document.getElementById('forgotPasswordFormContainer');
    
    // Tüm formları gizle
    loginContainer.classList.add('hidden');
    registerContainer.classList.add('hidden');
    if(forgotContainer) forgotContainer.classList.add('hidden');

    // İstenen formu göster
    if(mode === 'login') {
        loginContainer.classList.remove('hidden');
    } else if (mode === 'register') {
        registerContainer.classList.remove('hidden');
    } else if (mode === 'forgot') {
        forgotContainer.classList.remove('hidden');
    }
}

function showMessage(msg, isError = false) {
    const msgBox = document.getElementById('authMessage');
    msgBox.classList.remove('hidden', 'bg-red-50', 'text-red-600', 'border-red-200', 'dark:bg-red-900/30', 'dark:border-red-800', 'bg-emerald-50', 'text-emerald-600', 'border-emerald-200', 'dark:bg-emerald-900/30', 'dark:border-emerald-800');
    
    if (isError) {
        msgBox.classList.add('bg-red-50', 'text-red-600', 'border-red-200', 'dark:bg-red-900/30', 'dark:border-red-800');
    } else {
        msgBox.classList.add('bg-emerald-50', 'text-emerald-600', 'border-emerald-200', 'dark:bg-emerald-900/30', 'dark:border-emerald-800');
    }
    msgBox.innerHTML = `<i class="fa-solid ${isError ? 'fa-circle-exclamation' : 'fa-circle-check'} mr-2 text-lg align-middle"></i> ${msg}`;
    const modalContent = document.querySelector('.glass-modal');
    if(modalContent) modalContent.scrollTop = 0;
}

// KAYIT VE E-POSTA GÖNDERİMİ
async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('btnRegister');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Oluşturuluyor...'; 
    btn.disabled = true;

    const username = document.getElementById('regUsername').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const realEmail = document.getElementById('regEmail').value.trim();
    
    const userData = {
        ad: document.getElementById('regAd').value,
        soyad: document.getElementById('regSoyad').value,
        tc_kimlik: document.getElementById('regTc').value,
        telefon: document.getElementById('regTelefon').value,
        sehir: document.getElementById('regSehir').value,
        rol: document.getElementById('regRol').value,
        email: realEmail, 
        sifre: password 
    };

    try {
        // Supabase Kullanıcı Oluşturma
        const { data, error } = await supabaseClient.auth.signUp({
            email: realEmail,
            password: password,
        });

        if (error) {
            showMessage('Kayıt başarısız: E-posta adresi sistemde zaten mevcut olabilir.', true);
            return;
        }

        if (data && data.user) {
            const { error: dbError } = await supabaseClient.from('users').insert([{
                id: data.user.id,
                username: username,
                ...userData
            }]);

            if (dbError) {
                showMessage('Hata: Profil detayları kaydedilemedi.', true);
            } else {
                // --- EMAILJS İLE HOŞ GELDİN MAİLİ GÖNDERME ---
                const emailParams = {
                    to_name: userData.ad + ' ' + userData.soyad,
                    to_email: userData.email, 
                };

                emailjs.send('service_5dd3nnx', 'template_ugtfjc4', emailParams)
                    .then(function(response) {
                        console.log('Mail başarıyla gönderildi!', response.status, response.text);
                    }, function(error) {
                        console.log('Mail gönderme başarısız...', error);
                    });

                showMessage('Kayıt Başarılı! Sisteme yönlendiriliyorsunuz...');
                document.getElementById('registerForm').reset();
                
                setTimeout(() => {
                    toggleAuthMode('login');
                    document.getElementById('loginEmail').value = realEmail; 
                }, 2000);
            }
        }
    } catch (err) {
        showMessage('Beklenmeyen bir hata oluştu.', true);
    } finally {
        btn.innerHTML = originalText; btn.disabled = false;
    }
}

// GİRİŞ VE VERİTABANINA LOG KAYDI İŞLEMİ
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Giriş Yapılıyor...'; 
    btn.disabled = true;

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        // E-posta ve şifre ile giriş
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            showMessage('Hatalı giriş. E-posta adresi veya şifrenizi kontrol edin.', true);
        } else if (data && data.user) {
            showMessage('Giriş başarılı! Profiliniz yükleniyor...');
            
            // --- GİRİŞ LOGU (KAYIT) İŞLEMİ BAŞLANGICI ---
            // Kimin ne zaman log yaptığını veritabanına kaydediyoruz
            const { error: logError } = await supabaseClient
                .from('login_logs')
                .insert([
                    { 
                        user_id: data.user.id, 
                        email: email, 
                        login_time: new Date().toISOString() 
                    }
                ]);
                
            if (logError) {
                console.error('Log kaydı oluşturulurken hata:', logError);
            }
            // --- GİRİŞ LOGU (KAYIT) İŞLEMİ BİTİŞİ ---

            const { data: profileData } = await supabaseClient
                .from('users').select('rol').eq('id', data.user.id).single();

            setTimeout(() => {
                closeModal();
                if (profileData && profileData.rol === 'ciftci') {
                    window.location.href = 'ciftci.html';
                } else if (profileData && profileData.rol === 'doktor') {
                    window.location.href = 'doktor.html';
                } else if (profileData && profileData.rol === 'user') {
                    window.location.href = 'normal-user.html';
                } else {
                    window.location.href = 'normal-user.html';
                }
            }, 1500);
        }
    } catch (err) {
        showMessage('Beklenmeyen bir hata oluştu.', true);
    } finally {
        btn.innerHTML = originalText; btn.disabled = false;
    }
}

// ŞİFREMİ UNUTTUM / SIFIRLAMA İŞLEMİ
async function handleForgotPassword(e) {
    e.preventDefault();
    const btn = document.getElementById('btnForgot');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Gönderiliyor...'; 
    btn.disabled = true;

    const email = document.getElementById('forgotEmail').value.trim();

    try {
        // Şifre sıfırlama linki gönderme
        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://sifre-yenileme.vercel.app/', 
        });

        if (error) {
            if(error.status === 429) {
                showMessage('Çok fazla istek gönderdiniz. Lütfen birkaç dakika sonra tekrar deneyin.', true);
            } else {
                showMessage('Hata: E-posta adresi sistemde bulunamadı veya geçersiz.', true);
            }
        } else {
            showMessage('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi!');
            document.getElementById('forgotForm').reset();
        }
    } catch (err) {
        showMessage('Beklenmeyen bir hata oluştu.', true);
    } finally {
        btn.innerHTML = originalText; 
        btn.disabled = false;
    }
}

// --- GÜVENLİK VE KONSOL ENGELLEME ---
document.addEventListener('contextmenu', event => event.preventDefault());

document.addEventListener('keydown', function(e) {
    if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') || 
        (e.ctrlKey && e.shiftKey && e.key === 'J') || 
        (e.ctrlKey && e.shiftKey && e.key === 'C') || 
        (e.ctrlKey && e.key === 'U')
    ) {
        e.preventDefault();
        return false;
    }
});
