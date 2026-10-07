// Supabase Yapılandırması (Kendi anahtarlarını buraya koy)
const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    currentUser = session.user;

    // Kullanıcı adını çek
    const { data: profile } = await supabaseClient.from('users').select('ad, soyad').eq('id', currentUser.id).single();
    if (profile) document.getElementById('userName').innerText = `Dr. ${profile.ad} ${profile.soyad}`;

    fetchNotes();
    feather.replace();
});

// Notları Veritabanından Getir
async function fetchNotes() {
    const container = document.getElementById('notesContainer');
    container.innerHTML = '<p>Yükleniyor...</p>';

    const { data, error } = await supabaseClient
        .from('notes')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }

    container.innerHTML = '';
    if (data.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Henüz not eklenmemiş.</p>';
    }

    data.forEach(note => {
        const date = new Date(note.created_at).toLocaleString('tr-TR');
        container.innerHTML += `
            <div class="note-card">
                <div class="note-actions">
                    <button class="btn-icon" onclick="deleteNote('${note.id}')"><i data-feather="trash-2" style="width:16px;"></i></button>
                </div>
                <div class="note-title">${note.title}</div>
                <div class="note-content">${note.content}</div>
                <span class="note-date">${date}</span>
            </div>
        `;
    });
    feather.replace();
}

// Yeni Not Kaydet
async function saveNote() {
    const title = document.getElementById('noteTitle').value;
    const content = document.getElementById('noteContent').value;

    if (!title || !content) { alert("Lütfen tüm alanları doldurun."); return; }

    const { error } = await supabaseClient.from('notes').insert([
        { 
            title: title, 
            content: content, 
            user_id: currentUser.id 
        }
    ]);

    if (error) {
        alert("Hata: " + error.message);
    } else {
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
        fetchNotes();
    }
}

// Not Sil
async function deleteNote(id) {
    if (!confirm("Bu notu silmek istediğinize emin misiniz?")) return;
    
    const { error } = await supabaseClient.from('notes').delete().eq('id', id);
    if (error) alert("Silme hatası: " + error.message);
    else fetchNotes();
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