feather.replace();
        
// Tema kontrolü
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

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
            <div style="display:flex; height:100vh; width:100vw; background:#0b0f1a; color:#ef4444; align-items:center; justify-content:center; flex-direction:column; font-family:sans-serif;">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:20px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <h1 style="font-size:24px; font-weight:bold;">Güvenlik İhlali Tespit Edildi</h1>
                <p style="color:#9ca3af; margin-top:10px;">Geliştirici araçlarını kapatıp sayfayı yenileyin.</p>
            </div>
        `;
    }
};
setInterval(detectDevTools, 500);

// 5. SON DARBE: Debugger Tuzağı
setInterval(function() {
    (function() { return false; }['constructor']('debugger')());
}, 100);