feather.replace();

const SUPABASE_URL = 'https://chozcpctihufghnzsten.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3pjcGN0aWh1ZmdobnpzdGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzYxNTAsImV4cCI6MjA4ODIxMjE1MH0.r3ZwkAT0RqWHryEolLwcUzsB2Gu-iW3O9fKesyjd6eE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let myFields = [];
let allRecords = []; // DB'den gelen ham liste
let filteredRecords = []; // Filtreye göre filtrelenmiş liste
let chartDataStore = {}; // Tıklama ve tooltip için grafik verisi
let financeChart;

window.addEventListener('DOMContentLoaded', async () => { 
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    currentUser = session.user;
    
    document.getElementById('recDate').valueAsDate = new Date();
    
    await loadFields();
    loadRecords(); 
});

async function loadFields() {
    const { data } = await supabaseClient.from('fields')
        .select('id, field_name, city, tree_types, animal_types')
        .eq('user_id', currentUser.id);
        
    myFields = data || [];
    
    const select = document.getElementById('recField');
    myFields.forEach(f => {
        select.innerHTML += `<option value="${f.id}">${f.field_name} (${f.city})</option>`;
    });
}

// Tarladaki ürünleri çek ve modal select kutusuna yaz
function updateProductOptions() {
    const fieldId = document.getElementById('recField').value;
    const recType = document.getElementById('recType').value;
    const selectEl = document.getElementById('recNameSelect');
    const inputEl = document.getElementById('recNameInput');

    if (recType === 'gider') {
        selectEl.style.display = 'none';
        inputEl.style.display = 'block';
        return;
    }

    selectEl.style.display = 'block';
    inputEl.style.display = 'none';
    selectEl.innerHTML = '<option value="" disabled selected>Ürün Seçiniz...</option>';

    if (!fieldId) return;

    const field = myFields.find(f => f.id === fieldId);
    if (!field) return;

    let items = [];
    if (recType === 'hasat') {
        try { items = JSON.parse(field.tree_types) || []; } catch(e){}
    } else if (recType === 'hayvansal') {
        try { items = JSON.parse(field.animal_types) || []; } catch(e){}
    } else if (recType === 'satis') {
        let t = []; let a = [];
        try { t = JSON.parse(field.tree_types) || []; } catch(e){}
        try { a = JSON.parse(field.animal_types) || []; } catch(e){}
        items = [...t, ...a];
    }

    if (items.length === 0) {
        selectEl.innerHTML = '<option value="" disabled selected>Araziye kayıtlı tür yok</option>';
    } else {
        items.forEach(item => {
            selectEl.innerHTML += `<option value="${item.type}">${item.type}</option>`;
        });
    }
}

function handleTypeChange() {
    const type = document.getElementById('recType').value;
    const amountGroup = document.getElementById('amountGroup');
    
    if(type === 'satis' || type === 'gider') {
        amountGroup.style.display = 'flex';
    } else {
        amountGroup.style.display = 'none';
        document.getElementById('recAmount').value = 0;
    }
    updateProductOptions();
}

// Verileri Çek
async function loadRecords() {
    document.getElementById('loadingStatus').style.display = 'block';
    document.getElementById('recordsList').innerHTML = '';
    
    const { data, error } = await supabaseClient
        .from('yield_records')
        .select('*, fields(field_name)')
        .eq('user_id', currentUser.id)
        .order('record_date', { ascending: false });

    allRecords = data || [];
    document.getElementById('loadingStatus').style.display = 'none';
    
    applyFilter(); // Veriler çekilince direkt filtreye yolla
}

// Zaman Filtresi
function applyFilter() {
    const filterVal = document.getElementById('timeFilter').value;
    const now = new Date();
    
    if (filterVal === 'all') {
        filteredRecords = [...allRecords];
    } else {
        const monthsToSubtract = parseInt(filterVal);
        const limitDate = new Date();
        limitDate.setMonth(now.getMonth() - monthsToSubtract);
        
        filteredRecords = allRecords.filter(r => new Date(r.record_date) >= limitDate);
    }

    renderSummary();
    renderList();
    renderChart(filterVal === 'all' ? 12 : parseInt(filterVal)); // Grafiğe kaç ay çizileceğini gönder
}

function renderSummary() {
    let income = 0; let expense = 0; let production = 0;
    
    filteredRecords.forEach(r => {
        if(r.record_type === 'satis') income += Number(r.amount);
        if(r.record_type === 'gider') expense += Number(r.amount);
        if(r.record_type === 'hasat' || r.record_type === 'hayvansal') production += Number(r.quantity);
    });

    const net = income - expense;

    document.getElementById('totIncome').innerText = new Intl.NumberFormat('tr-TR').format(income) + ' ₺';
    document.getElementById('totExpense').innerText = new Intl.NumberFormat('tr-TR').format(expense) + ' ₺';
    document.getElementById('netProfit').innerText = new Intl.NumberFormat('tr-TR').format(net) + ' ₺';
    document.getElementById('netProfit').style.color = net >= 0 ? 'var(--success)' : 'var(--danger)';
    document.getElementById('totProduction').innerText = new Intl.NumberFormat('tr-TR').format(production);
}

function renderList() {
    const container = document.getElementById('recordsList');
    container.innerHTML = '';

    if(filteredRecords.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Bu dönemde kayıt bulunamadı.</div>`;
        return;
    }

    filteredRecords.forEach(r => {
        let icon, iconBg, iconColor, sign = '', amountColor = 'var(--text-main)';
        
        if(r.record_type === 'hasat') { icon = 'package'; iconBg = 'rgba(16,185,129,0.1)'; iconColor = 'var(--primary)'; }
        else if(r.record_type === 'hayvansal') { icon = 'github'; iconBg = 'rgba(14,165,233,0.1)'; iconColor = 'var(--info)'; }
        else if(r.record_type === 'satis') { icon = 'trending-up'; iconBg = 'rgba(34,197,94,0.1)'; iconColor = 'var(--success)'; sign = '+'; amountColor = 'var(--success)'; }
        else if(r.record_type === 'gider') { icon = 'trending-down'; iconBg = 'rgba(239,68,68,0.1)'; iconColor = 'var(--danger)'; sign = '-'; amountColor = 'var(--danger)'; }

        const fieldName = r.fields ? r.fields.field_name : 'Bilinmeyen Arazi';
        const dateStr = new Date(r.record_date).toLocaleDateString('tr-TR');
        
        let valHtml = '';
        if(r.record_type === 'satis' || r.record_type === 'gider') {
            valHtml = `<div class="rec-amount" style="color:${amountColor}">${sign}${new Intl.NumberFormat('tr-TR').format(r.amount)} ₺</div>`;
        }
        if(r.quantity > 0) {
            valHtml += `<div class="rec-qty">${r.quantity} ${r.unit}</div>`;
        }

        const html = `
            <div class="record-item">
                <div class="rec-left">
                    <div class="rec-icon" style="background:${iconBg}; color:${iconColor};"><i data-feather="${icon}"></i></div>
                    <div class="rec-info">
                        <h4>${r.product_name}</h4>
                        <p>${dateStr} • ${fieldName}</p>
                    </div>
                </div>
                <div class="rec-right">
                    ${valHtml}
                    <button class="btn-danger-outline" style="margin-top:5px;" onclick="deleteRecord('${r.id}')">Sil</button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
    feather.replace();
}

// --- GELİŞMİŞ CHART.JS (Arazilere Göre Tooltip ve Tıklama) ---
function renderChart(monthsToGenerate) {
    chartDataStore = {}; // Global veriyi sıfırla
    
    // X Ekseni (Aylar) oluştur
    for(let i = monthsToGenerate - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = d.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
        
        chartDataStore[key] = { 
            label: label, 
            rawKey: key, // Tıklama olayında DB eşleştirmesi için
            income: 0, 
            expense: 0,
            incomeBreakdown: {}, // Hangi araziden ne kadar gelir geldi
            expenseBreakdown: {} // Hangi araziye ne kadar gider yapıldı
        };
    }

    // Verileri aylara ve arazilere göre dağıt
    allRecords.forEach(r => {
        const d = new Date(r.record_date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        
        if(chartDataStore[key]) {
            const fName = r.fields ? r.fields.field_name : 'Diğer';
            const amt = Number(r.amount);

            if(r.record_type === 'satis') {
                chartDataStore[key].income += amt;
                chartDataStore[key].incomeBreakdown[fName] = (chartDataStore[key].incomeBreakdown[fName] || 0) + amt;
            }
            if(r.record_type === 'gider') {
                chartDataStore[key].expense += amt;
                chartDataStore[key].expenseBreakdown[fName] = (chartDataStore[key].expenseBreakdown[fName] || 0) + amt;
            }
        }
    });

    const labels = Object.values(chartDataStore).map(d => d.label);
    const incomes = Object.values(chartDataStore).map(d => d.income);
    const expenses = Object.values(chartDataStore).map(d => d.expense);
    const rawKeys = Object.values(chartDataStore).map(d => d.rawKey);

    const ctx = document.getElementById('financeChart').getContext('2d');
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const textColor = currentTheme === 'light' ? '#64748b' : '#94a3b8';
    const gridColor = currentTheme === 'light' ? '#e2e8f0' : '#334155';

    if (financeChart) financeChart.destroy();
    
    financeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Gelir (₺)', data: incomes, backgroundColor: '#22c55e', borderRadius: 4, customRawKeys: rawKeys, typeKey: 'satis' },
                { label: 'Gider (₺)', data: expenses, backgroundColor: '#ef4444', borderRadius: 4, customRawKeys: rawKeys, typeKey: 'gider' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { labels: { color: textColor } },
                tooltip: {
                    callbacks: {
                        // Tooltip içinde arazi detaylarını gösterme
                        afterBody: function(tooltipItems) {
                            const item = tooltipItems[0];
                            const isIncome = item.datasetIndex === 0;
                            const key = rawKeys[item.dataIndex];
                            const dataObj = chartDataStore[key];
                            
                            let breakdownObj = isIncome ? dataObj.incomeBreakdown : dataObj.expenseBreakdown;
                            let breakdownStr = [];
                            
                            if (Object.keys(breakdownObj).length > 0) {
                                breakdownStr.push('--- Arazilere Göre ---');
                                for (const [field, val] of Object.entries(breakdownObj)) {
                                    breakdownStr.push(`${field}: ${new Intl.NumberFormat('tr-TR').format(val)} ₺`);
                                }
                            }
                            return breakdownStr;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor } },
                y: { grid: { color: gridColor }, ticks: { color: textColor } }
            },
            // Sütuna tıklandığında detay modülünü aç
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const datasetIndex = elements[0].datasetIndex;
                    const dataIndex = elements[0].index;
                    
                    const targetMonthKey = rawKeys[dataIndex];
                    const targetType = datasetIndex === 0 ? 'satis' : 'gider';
                    const displayMonth = labels[dataIndex];

                    openChartDetail(targetMonthKey, targetType, displayMonth);
                }
            }
        }
    });
}

// Tıklanan Grafiğin Detay Modalı
function openChartDetail(monthKey, type, monthLabel) {
    const tableBody = document.getElementById('cdTableBody');
    const emptyState = document.getElementById('cdEmpty');
    const title = document.getElementById('cdTitle');
    const totalEl = document.getElementById('cdTotal');

    // Başlık ayarı
    const typeText = type === 'satis' ? 'Gelirleri' : 'Giderleri';
    title.innerText = `${monthLabel} ${typeText}`;
    totalEl.style.color = type === 'satis' ? 'var(--success)' : 'var(--danger)';

    // Veriyi filtrele (Sadece o ay ve o türe ait olanlar)
    const detailRecords = allRecords.filter(r => {
        const d = new Date(r.record_date);
        const rKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        return rKey === monthKey && r.record_type === type;
    });

    tableBody.innerHTML = '';
    let totalAmount = 0;

    if (detailRecords.length === 0) {
        tableBody.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        tableBody.style.display = 'table-row-group';
        emptyState.style.display = 'none';

        detailRecords.forEach(r => {
            const fName = r.fields ? r.fields.field_name : 'Belirtilmemiş';
            const dateStr = new Date(r.record_date).toLocaleDateString('tr-TR');
            const amtStr = new Intl.NumberFormat('tr-TR').format(r.amount);
            totalAmount += Number(r.amount);

            tableBody.innerHTML += `
                <tr>
                    <td>${dateStr}</td>
                    <td>${fName}</td>
                    <td>${r.product_name}</td>
                    <td class="dt-amount">${amtStr} ₺</td>
                </tr>
            `;
        });
    }

    totalEl.innerText = `Toplam: ${new Intl.NumberFormat('tr-TR').format(totalAmount)} ₺`;
    document.getElementById('chartDetailModal').classList.add('active');
}

function closeDetailModal() {
    document.getElementById('chartDetailModal').classList.remove('active');
}

// --- ANA MODAL YÖNETİMİ ---
function openModal() {
    document.getElementById('recType').value = 'hasat';
    document.getElementById('recNameInput').value = '';
    document.getElementById('recQty').value = '0';
    document.getElementById('recAmount').value = '0';
    document.getElementById('recNotes').value = '';
    handleTypeChange();
    document.getElementById('recordModal').classList.add('active');
}

function closeModal() { document.getElementById('recordModal').classList.remove('active'); }

async function saveRecord() {
    const fieldId = document.getElementById('recField').value;
    const type = document.getElementById('recType').value;
    const date = document.getElementById('recDate').value;
    
    let name = type === 'gider' ? document.getElementById('recNameInput').value.trim() : document.getElementById('recNameSelect').value;

    const qty = parseFloat(document.getElementById('recQty').value) || 0;
    const unit = document.getElementById('recUnit').value;
    const amount = parseFloat(document.getElementById('recAmount').value) || 0;
    const notes = document.getElementById('recNotes').value.trim();

    if(!fieldId || !date || !name) { alert("Lütfen Arazi, Tarih ve Ürün/İşlem Adı alanlarını doldurun."); return; }
    if((type === 'satis' || type === 'gider') && amount <= 0) { alert("Satış ve gider işlemlerinde Tutar 0'dan büyük olmalıdır."); return; }

    const data = {
        user_id: currentUser.id,
        field_id: fieldId,
        record_type: type,
        product_name: name,
        quantity: qty,
        unit: unit,
        amount: amount,
        record_date: date,
        notes: notes
    };

    const { error } = await supabaseClient.from('yield_records').insert([data]);
    if (error) { alert("Hata: " + error.message); return; }

    closeModal();
    loadRecords();
}

async function deleteRecord(id) {
    if(confirm("Bu kaydı silmek istediğinize emin misiniz?")) {
        await supabaseClient.from('yield_records').delete().eq('id', id);
        loadRecords();
    }
}

// --- NÜKLEER KOD KORUMASI ---
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', function(e) {
    if (e.keyCode===123 || (e.ctrlKey&&e.shiftKey&&(e.keyCode===73||e.keyCode===74||e.keyCode===67)) || (e.ctrlKey&&e.keyCode===85)) { e.preventDefault(); return false; }
});
setInterval(function() { console.clear(); console.log("%cDİKKAT!", "color:red; font-size:40px; font-weight:bold;"); }, 1000);
setInterval(function() {
    const w = window.outerWidth - window.innerWidth > 160; const h = window.outerHeight - window.innerHeight > 160;
    if (w || h) document.body.innerHTML = `<div style="display:flex; height:100vh; width:100vw; background:#0f172a; color:#ef4444; align-items:center; justify-content:center;"><h1>Güvenlik İhlali!</h1></div>`;
}, 500);
setInterval(function() { (function() { return false; }['constructor']('debugger')()); }, 100);