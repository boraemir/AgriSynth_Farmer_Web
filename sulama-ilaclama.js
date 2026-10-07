feather.replace();

const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

window.addEventListener('DOMContentLoaded', async () => { 
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    currentUser = session.user;
    
    document.getElementById('actDate').valueAsDate = new Date();
    loadData(); 
});

async function loadData() {
    document.getElementById('loadingStatus').style.display = 'block';
    
    // 1. Tarlaları çek (sadece ağaç olanlar)
    const { data: fields } = await supabaseClient.from('fields').select('*').eq('user_id', currentUser.id).gt('tree_count', 0);
    
    // 2. Bu kullanıcının tüm ağaç geçmişini çek
    const { data: activities } = await supabaseClient.from('tree_activities').select('*').eq('user_id', currentUser.id).order('activity_date', { ascending: false });

    renderData(fields || [], activities || []);
}

function renderData(fields, activities) {
    const container = document.getElementById('fieldsContainer');
    container.innerHTML = '';
    document.getElementById('loadingStatus').style.display = 'none';

    if (fields.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); border:1px dashed var(--border); border-radius:16px;">Üzerinde ağaç/mahsul kayıtlı bir araziniz bulunmuyor. Önce panele gidip tarlanıza ağaç ekleyin.</div>`;
        return;
    }

    fields.forEach(field => {
        let trees = [];
        try { trees = JSON.parse(field.tree_types); } catch(e){}
        if(trees.length === 0) return;

        let fieldHtml = `
            <div class="field-group">
                <div class="field-header"><i data-feather="map"></i> ${field.field_name} (${field.city})</div>
        `;

        trees.forEach(tree => {
            // Bu ağaca ait geçmişi bul
            const treeActs = activities.filter(a => a.field_id === field.id && a.tree_type === tree.type);
            
            let historyHtml = '<div style="color:var(--text-muted); font-size:12px;">Henüz işlem kaydı yok.</div>';
            if(treeActs.length > 0) {
                historyHtml = treeActs.map(act => {
                    let badgeClass = act.activity_type === 'Sulama' ? 'bg-sulama' : (act.activity_type === 'İlaçlama' ? 'bg-ilaclama' : 'bg-gubreleme');
                    let nextAction = act.next_action_date ? `<br><span style="color:var(--primary); font-size:11px;">Sonraki İşlem: ${new Date(act.next_action_date).toLocaleDateString('tr-TR')}</span>` : '';
                    return `
                        <div class="history-item">
                            <span class="badge ${badgeClass}">${act.activity_type}</span>
                            <div>
                                <strong>${new Date(act.activity_date).toLocaleDateString('tr-TR')}</strong> - ${act.details || '-'}
                                ${nextAction}
                            </div>
                        </div>
                    `;
                }).join('');
            }

            fieldHtml += `
                <div class="tree-row">
                    <div class="tree-info">
                        <div class="tree-name"><i data-feather="target" style="width:16px;"></i> ${tree.count} Adet ${tree.type}</div>
                        <button class="btn-secondary" onclick="openModal('${field.id}', '${tree.type}')"><i data-feather="plus" style="width:14px;"></i> İşlem Ekle</button>
                    </div>
                    <div class="history-box">
                        <div style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase;">Son İşlemler</div>
                        ${historyHtml}
                    </div>
                </div>
            `;
        });

        fieldHtml += `</div>`;
        container.innerHTML += fieldHtml;
    });
    feather.replace();
}

function openModal(fieldId, treeType) {
    document.getElementById('selectedFieldId').value = fieldId;
    document.getElementById('selectedTreeType').value = treeType;
    document.getElementById('modalTitle').innerText = `${treeType} İçin İşlem`;
    document.getElementById('actDetails').value = '';
    document.getElementById('actNextDate').value = '';
    document.getElementById('actionModal').classList.add('active');
}

function closeModal() { document.getElementById('actionModal').classList.remove('active'); }

async function saveActivity() {
    const data = {
        user_id: currentUser.id,
        field_id: document.getElementById('selectedFieldId').value,
        tree_type: document.getElementById('selectedTreeType').value,
        activity_type: document.getElementById('actType').value,
        activity_date: document.getElementById('actDate').value,
        details: document.getElementById('actDetails').value,
        next_action_date: document.getElementById('actNextDate').value || null
    };

    if(!data.activity_date) return alert("Lütfen tarih seçiniz.");

    const { error } = await supabaseClient.from('tree_activities').insert([data]);
    if (error) { alert("Hata: " + error.message); return; }

    closeModal();
    loadData();
}

// --- NÜKLEER KOD KORUMASI ---
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', function(e) {
    if (e.keyCode===123 || (e.ctrlKey&&e.shiftKey&&(e.keyCode===73||e.keyCode===74||e.keyCode===67)) || (e.ctrlKey&&e.keyCode===85)) { e.preventDefault(); return false; }
});
setInterval(function() {
    console.clear(); console.log("%cDİKKAT!", "color:red; font-size:40px; font-weight:bold;");
}, 1000);
setInterval(function() {
    const w = window.outerWidth - window.innerWidth > 160; const h = window.outerHeight - window.innerHeight > 160;
    if (w || h) document.body.innerHTML = `<div style="display:flex; height:100vh; width:100vw; background:#0f172a; color:#ef4444; align-items:center; justify-content:center;"><h1>Güvenlik İhlali!</h1></div>`;
}, 500);
setInterval(function() { (function() { return false; }['constructor']('debugger')()); }, 100);