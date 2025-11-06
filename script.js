// 社團列表
const clubs = [
    "舞蹈賞析與實作",
    "武術社",
    "排球社",
    "未來科學社",
    "手作點心社",
    "捲紙藝術社",
    "溫馨小棧社",
    "嗡嗡社",
    "樂樂棒",
    "心靈電影欣賞社",
    "桌遊社",
    "科學探究社",
    "木球社",
    "童軍服務團",
    "遊戲與應用程式開發社"
];

// 已選志願順序
let selectedClubs = [];

// DOM 元素
const clubsGrid = document.getElementById('clubsGrid');
const selectedList = document.getElementById('selectedList');
const selectedCount = document.getElementById('selectedCount');
const warningMessage = document.getElementById('warningMessage');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const studentClassInput = document.getElementById('studentClass');
const studentSeatInput = document.getElementById('studentSeat');
const studentNameInput = document.getElementById('studentName');
const studentIdInput = document.getElementById('studentId');
const resultModal = document.getElementById('resultModal');
const closeModal = document.getElementById('closeModal');
const confirmBtn = document.getElementById('confirmBtn');
const downloadReportBtn = document.getElementById('downloadReportBtn');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminModal = document.getElementById('adminModal');
const closeAdminModal = document.getElementById('closeAdminModal');
const capacitiesForm = document.getElementById('capacitiesForm');
const saveCapacitiesBtn = document.getElementById('saveCapacitiesBtn');
const exportAllSubmissionsBtn = document.getElementById('exportAllSubmissionsBtn');
const runAssignmentBtn = document.getElementById('runAssignmentBtn');
const downloadAssignmentBtn = document.getElementById('downloadAssignmentBtn');
const uploadLocalBackupsBtn = document.getElementById('uploadLocalBackupsBtn');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const connectionStatus = document.getElementById('connectionStatus');
const modalBody = document.getElementById('modalBody');

// 儲存提交的資料供報表使用
let submittedData = null;
let isAdmin = false;
let allSubmissions = [];
let assignmentResult = null;

// 後端設定：填入你部署完成的 Google Apps Script Web App URL
// 例如：https://script.google.com/macros/s/XXXXX/exec
const BACKEND_URL = 'https://script.google.com/a/macros/dcjh.tn.edu.tw/s/AKfycbyQrW45dmGMqzXBxh0cN_zIoMlEgfacknpr69z-ynCqFzYePMzjuF8m3b5QO8jF6hQwmA/exec';

// 管理員密碼（前端驗證，後端也會再次驗證）
const ADMIN_PASSWORD = 'admin2025';

// 關閉 modal 的統一函數
function closeModalWindow() {
    resultModal.style.display = 'none';
}

// 初始化
function init() {
    renderClubs();
    updateSelectionInfo();
    // 優先從後端載入，失敗再用本機備援
    loadSubmissionsFromBackend()
        .catch(() => loadAllSubmissions());
    ensureDefaultCapacities();
    
    // 事件監聽
    submitBtn.addEventListener('click', handleSubmit);
    clearBtn.addEventListener('click', handleClear);
    
    closeModal.addEventListener('click', closeModalWindow);
    confirmBtn.addEventListener('click', closeModalWindow);
    // 預設隱藏下載按鈕，僅管理員可見
    downloadReportBtn.classList.add('hidden');
    downloadReportBtn.addEventListener('click', () => {
        if (!isAdmin) {
            alert('僅限後臺管理員下載報表');
            return;
        }
        generateXLSXReport();
    });
    
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', () => {
            const code = prompt('請輸入管理員驗證碼');
            if (code === ADMIN_PASSWORD) {
                isAdmin = true;
                alert('管理員登入成功');
                downloadReportBtn.classList.remove('hidden');
                // 開啟管理員面板
                openAdminPanel();
            } else {
                alert('驗證碼錯誤');
            }
        });
    }

    if (closeAdminModal) {
        closeAdminModal.addEventListener('click', closeAdminPanel);
        adminModal.addEventListener('click', (e) => {
            if (e.target === adminModal) closeAdminPanel();
        });
    }

    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', testBackendConnection);
    }

    if (saveCapacitiesBtn) {
        saveCapacitiesBtn.addEventListener('click', saveCapacities);
    }

    if (exportAllSubmissionsBtn) {
        exportAllSubmissionsBtn.addEventListener('click', async () => {
            // 重新同步一次後端資料（若有設定）
            if (BACKEND_URL) {
                try { await loadSubmissionsFromBackend(); } catch {}
            } else {
                loadAllSubmissions();
            }
            exportSubmissionsExcel();
        });
    }

    if (runAssignmentBtn) {
        runAssignmentBtn.addEventListener('click', async () => {
            // 重新同步一次後端資料（若有設定）
            if (BACKEND_URL) {
                try { await loadSubmissionsFromBackend(); } catch {}
            } else {
                loadAllSubmissions();
            }
            const capacities = getCapacitiesFromForm();
            assignmentResult = assignClubs(allSubmissions, capacities);
            alert('分發完成，共分發 ' + assignmentResult.assignedCount + ' 位學生');
        });
    }

    if (downloadAssignmentBtn) {
        downloadAssignmentBtn.addEventListener('click', downloadAssignmentExcel);
    }

    if (uploadLocalBackupsBtn) {
        uploadLocalBackupsBtn.addEventListener('click', async () => {
            if (!isAdmin) return alert('未授權');
            if (!BACKEND_URL) return alert('尚未設定後端 URL');
            try {
                await uploadLocalBackupsToBackend();
            } catch (e) {
                alert('上傳過程發生錯誤：' + e.message);
            }
        });
    }
    
    // 點擊 modal 外部關閉（阻止事件冒泡）
    resultModal.addEventListener('click', (e) => {
        if (e.target === resultModal) {
            closeModalWindow();
        }
    });
    
    // 阻止 modal-content 的點擊事件冒泡
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // ESC 鍵關閉 modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && resultModal.style.display === 'block') {
            closeModalWindow();
        }
    });
}

// 渲染社團列表
function renderClubs() {
    clubsGrid.innerHTML = '';
    clubs.forEach(club => {
        const clubItem = document.createElement('div');
        clubItem.className = 'club-item';
        clubItem.textContent = club;
        
        // 檢查是否已選
        if (selectedClubs.includes(club)) {
            clubItem.classList.add('selected');
        }
        
        // 如果已選滿15個且未選中，則禁用
        if (selectedClubs.length >= 15 && !selectedClubs.includes(club)) {
            clubItem.classList.add('disabled');
        }
        
        clubItem.addEventListener('click', () => handleClubClick(club, clubItem));
        clubsGrid.appendChild(clubItem);
    });
}

// 處理社團點擊
function handleClubClick(club, clubItem) {
    // 如果已選滿且未選中，則不允許點擊
    if (selectedClubs.length >= 15 && !selectedClubs.includes(club)) {
        return;
    }
    
    if (selectedClubs.includes(club)) {
        // 移除志願
        selectedClubs = selectedClubs.filter(c => c !== club);
        clubItem.classList.remove('selected');
    } else {
        // 添加志願
        if (selectedClubs.length < 15) {
            selectedClubs.push(club);
            clubItem.classList.add('selected');
        }
    }
    
    renderSelectedList();
    renderClubs(); // 重新渲染以更新禁用狀態
    updateSelectionInfo();
}

// 渲染已選志願列表
function renderSelectedList() {
    if (selectedClubs.length === 0) {
        selectedList.innerHTML = '<p class="empty-message">尚未選擇任何社團</p>';
        return;
    }
    
    selectedList.innerHTML = '';
    selectedClubs.forEach((club, index) => {
        const item = document.createElement('div');
        item.className = 'selected-item';
        item.innerHTML = `
            <span class="rank">${index + 1}</span>
            <span class="club-name">${club}</span>
            <button class="remove-btn" data-club="${club}">移除</button>
        `;
        
        const removeBtn = item.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => {
            selectedClubs = selectedClubs.filter(c => c !== club);
            renderSelectedList();
            renderClubs();
            updateSelectionInfo();
        });
        
        selectedList.appendChild(item);
    });
}

// 更新選擇資訊
function updateSelectionInfo() {
    selectedCount.textContent = selectedClubs.length;
    
    if (selectedClubs.length < 8) {
        warningMessage.textContent = `至少需要填寫 8 個志願（目前：${selectedClubs.length} 個）`;
        warningMessage.className = 'warning';
        submitBtn.disabled = true;
    } else if (selectedClubs.length >= 8 && selectedClubs.length <= 15) {
        warningMessage.textContent = `✓ 已符合要求（${selectedClubs.length} 個志願）`;
        warningMessage.className = 'success';
        submitBtn.disabled = false;
    }
}

// 處理提交
function handleSubmit() {
    // 驗證所有欄位
    const studentClass = studentClassInput.value.trim();
    const studentSeat = studentSeatInput.value.trim();
    const name = studentNameInput.value.trim();
    const id = studentIdInput.value.trim();
    
    if (!studentClass) {
        alert('請輸入班級');
        studentClassInput.focus();
        return;
    }
    
    if (!studentSeat) {
        alert('請輸入座號');
        studentSeatInput.focus();
        return;
    }
    
    if (!name) {
        alert('請輸入姓名');
        studentNameInput.focus();
        return;
    }
    
    if (!id) {
        alert('請輸入學號');
        studentIdInput.focus();
        return;
    }
    
    // 驗證志願數量
    if (selectedClubs.length < 8) {
        alert('至少需要填寫 8 個社團志願');
        return;
    }
    
    if (selectedClubs.length > 15) {
        alert('最多只能填寫 15 個社團志願');
        return;
    }
    
    // 顯示結果
    showResult(studentClass, studentSeat, name, id);
}

// 顯示提交結果
function showResult(studentClass, studentSeat, name, id) {
    let html = `
        <div style="margin-bottom: 20px;">
            <p><strong>班級：</strong>${studentClass}</p>
            <p><strong>座號：</strong>${studentSeat}</p>
            <p><strong>姓名：</strong>${name}</p>
            <p><strong>學號：</strong>${id}</p>
        </div>
        <div>
            <h3 style="margin-bottom: 15px; color: #667eea;">志願順序：</h3>
    `;
    
    selectedClubs.forEach((club, index) => {
        html += `
            <div class="confirmation-item">
                <strong>第 ${index + 1} 志願：</strong>${club}
            </div>
        `;
    });
    
    html += '</div>';
    
    modalBody.innerHTML = html;
    resultModal.style.display = 'block';
    
    // 儲存提交的資料供報表使用
    submittedData = {
        class: studentClass,
        seat: studentSeat,
        name: name,
        id: id,
        clubs: [...selectedClubs],
        submitTime: new Date().toLocaleString('zh-TW')
    };
    
    // 送到後端；若未設定或失敗，退回本機備援
    submitToBackend(submittedData)
        .then(() => {
            console.log('已送出後端並紀錄：', submittedData);
        })
        .catch(() => {
            saveSubmission(submittedData);
            console.warn('後端提交失敗，已改存本機備援');
        });
}

// 下載報表
function generateXLSXReport() {
    if (!submittedData) {
        alert('沒有可下載的資料');
        return;
    }
    if (typeof XLSX === 'undefined') {
        alert('載入 Excel 函式庫失敗，請重新整理頁面');
        return;
    }
    // 建立工作簿與工作表
    const workbook = XLSX.utils.book_new();
    // 基本資料
    const infoSheetData = [
        ['社團志願選填結果報表'],
        ['填寫時間', submittedData.submitTime],
        ['班級', submittedData.class],
        ['座號', submittedData.seat],
        ['姓名', submittedData.name],
        ['學號', submittedData.id],
        [],
        ['志願順序', '社團名稱']
    ];
    submittedData.clubs.forEach((club, idx) => {
        infoSheetData.push([`第${idx + 1}志願`, club]);
    });
    const ws = XLSX.utils.aoa_to_sheet(infoSheetData);
    XLSX.utils.book_append_sheet(workbook, ws, '選填結果');
    // 下載
    const filename = `社團志願選填_${submittedData.name}_${submittedData.id}.xlsx`;
    XLSX.writeFile(workbook, filename);
}

// ===== 本機儲存與管理員功能 =====
async function loadSubmissionsFromBackend() {
    if (!BACKEND_URL) throw new Error('未設定 BACKEND_URL');
    const url = BACKEND_URL + '?action=list&password=' + encodeURIComponent(ADMIN_PASSWORD);
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('後端讀取失敗');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    // 後端回傳格式需為陣列，每筆含 class, seat, name, id, clubs(array), submitTime
    allSubmissions = Array.isArray(data) ? data : [];
}

async function submitToBackend(entry) {
    if (!BACKEND_URL) throw new Error('未設定 BACKEND_URL');
    const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', payload: entry })
    });
    if (!res.ok) throw new Error('後端提交失敗');
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    return result;
}

async function testBackendConnection() {
    if (!BACKEND_URL) {
        connectionStatus.textContent = '❌ 未設定後端URL';
        connectionStatus.style.color = '#dc3545';
        return;
    }
    
    connectionStatus.textContent = '⏳ 測試連線中...';
    connectionStatus.style.color = '#ffc107';
    testConnectionBtn.disabled = true;
    
    try {
        // 測試讀取功能
        const url = BACKEND_URL + '?action=test&password=' + encodeURIComponent(ADMIN_PASSWORD);
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (data.ok) {
            connectionStatus.textContent = '✅ 後端連線正常';
            connectionStatus.style.color = '#28a745';
            
            // 同時測試讀取資料
            try {
                await loadSubmissionsFromBackend();
                connectionStatus.textContent += `（已載入 ${allSubmissions.length} 筆資料）`;
            } catch (e) {
                console.warn('讀取資料失敗:', e);
            }
        } else {
            throw new Error('後端回應異常');
        }
    } catch (error) {
        connectionStatus.textContent = '❌ 連線失敗：' + error.message;
        connectionStatus.style.color = '#dc3545';
    } finally {
        testConnectionBtn.disabled = false;
    }
}
function loadAllSubmissions() {
    try {
        const raw = localStorage.getItem('club7_submissions');
        allSubmissions = raw ? JSON.parse(raw) : [];
    } catch (e) {
        allSubmissions = [];
    }
}

function saveSubmission(entry) {
    loadAllSubmissions();
    allSubmissions.push(entry);
    localStorage.setItem('club7_submissions', JSON.stringify(allSubmissions));
}

async function uploadLocalBackupsToBackend() {
    // 讀取本機備援
    loadAllSubmissions();
    if (!allSubmissions || allSubmissions.length === 0) {
        alert('本機沒有可上傳的備援資料');
        return;
    }

    const total = allSubmissions.length;
    let success = 0;
    let failed = 0;
    const successIds = new Set();

    // 逐筆上傳，避免同時大量請求
    for (const entry of allSubmissions) {
        try {
            await submitToBackend(entry);
            success += 1;
            successIds.add(String(entry.id));
        } catch (e) {
            // 可能因學號重複（已存在於雲端），算作成功同步
            if ((e.message || '').includes('已提交') || (e.message || '').includes('duplicate')) {
                success += 1;
                successIds.add(String(entry.id));
            } else {
                failed += 1;
            }
        }
    }

    // 移除已成功同步的本機項目
    if (success > 0) {
        const remaining = allSubmissions.filter(e => !successIds.has(String(e.id)));
        localStorage.setItem('club7_submissions', JSON.stringify(remaining));
        allSubmissions = remaining;
    }

    alert(`上傳完成：成功 ${success} 筆，失敗 ${failed} 筆（共 ${total} 筆）`);
}

function openAdminPanel() {
    if (!isAdmin) {
        alert('未授權');
        return;
    }
    populateCapacitiesForm();
    adminModal.style.display = 'block';
}

function closeAdminPanel() {
    adminModal.style.display = 'none';
}

function ensureDefaultCapacities() {
    if (!localStorage.getItem('club7_capacities')) {
        const defaults = {};
        clubs.forEach(c => { defaults[c] = 30; });
        localStorage.setItem('club7_capacities', JSON.stringify(defaults));
    }
}

function getSavedCapacities() {
    try {
        return JSON.parse(localStorage.getItem('club7_capacities')) || {};
    } catch {
        return {};
    }
}

function populateCapacitiesForm() {
    const caps = getSavedCapacities();
    capacitiesForm.innerHTML = '';
    clubs.forEach(club => {
        const wrap = document.createElement('div');
        wrap.className = 'capacity-item';
        const label = document.createElement('label');
        label.textContent = club;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.value = caps[club] != null ? caps[club] : 30;
        input.dataset.club = club;
        wrap.appendChild(label);
        wrap.appendChild(input);
        capacitiesForm.appendChild(wrap);
    });
}

function getCapacitiesFromForm() {
    const result = {};
    const inputs = capacitiesForm.querySelectorAll('input[type="number"]');
    inputs.forEach(inp => {
        const club = inp.dataset.club;
        const val = Math.max(0, parseInt(inp.value || '0', 10));
        result[club] = val;
    });
    return result;
}

function saveCapacities() {
    const caps = getCapacitiesFromForm();
    localStorage.setItem('club7_capacities', JSON.stringify(caps));
    alert('已儲存社團人數上限');
}

function exportSubmissionsExcel() {
    if (!isAdmin) return alert('未授權');
    loadAllSubmissions();
    if (allSubmissions.length === 0) return alert('目前沒有提交資料');
    const wb = XLSX.utils.book_new();
    const rows = [['班級','座號','姓名','學號','填寫時間','志願1','志願2','志願3','志願4','志願5','志願6','志願7','志願8','志願9','志願10','志願11','志願12','志願13','志願14','志願15']];
    allSubmissions.forEach(s => {
        const row = [s.class, s.seat, s.name, s.id, s.submitTime];
        for (let i=0;i<15;i++) row.push(s.clubs[i] || '');
        rows.push(row);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '已填名單');
    XLSX.writeFile(wb, 'club_7_已填名單.xlsx');
}

// 多輪志願分發（1→15 輪），每輪為當輪志願，先到先分，額滿跳過
function assignClubs(submissions, capacities) {
    // 初始化容量（複製避免汙染設定）
    const remaining = { ...capacities };
    const assigned = [];
    const unassigned = new Set(submissions.map((_, idx) => idx));

    // 15 輪抽籤：每輪針對各社團，從該輪志願的候選名單中抽籤直到額滿
    for (let round = 0; round < 15; round++) {
        // 先彙整本輪各社團候選者
        const candidatesByClub = {};
        unassigned.forEach((idx) => {
            const pref = submissions[idx].clubs[round];
            if (!pref) return;
            if (!candidatesByClub[pref]) candidatesByClub[pref] = [];
            candidatesByClub[pref].push(idx);
        });

        // 針對每個社團進行抽籤（如超過剩餘名額）
        Object.keys(candidatesByClub).forEach((club) => {
            const capacityLeft = Math.max(0, remaining[club] ?? 0);
            if (capacityLeft === 0) return;
            const pool = candidatesByClub[club];
            if (pool.length === 0) return;

            let winners = [];
            if (pool.length <= capacityLeft) {
                winners = pool.slice();
            } else {
                // 隨機洗牌後取前 capacityLeft 位
                const shuffled = pool.slice();
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                winners = shuffled.slice(0, capacityLeft);
            }

            winners.forEach((idx) => {
                assigned.push({
                    class: submissions[idx].class,
                    seat: submissions[idx].seat,
                    name: submissions[idx].name,
                    id: submissions[idx].id,
                    assignedClub: club,
                    assignedByRound: round + 1,
                });
                unassigned.delete(idx);
            });
            remaining[club] = capacityLeft - winners.length;
        });
    }

    const unassignedList = Array.from(unassigned).map((i) => submissions[i]);
    return { assigned, unassigned: unassignedList, assignedCount: assigned.length, remaining };
}

function downloadAssignmentExcel() {
    if (!isAdmin) return alert('未授權');
    if (!assignmentResult) return alert('尚未執行分發');
    const wb = XLSX.utils.book_new();

    const aRows = [['班級','座號','姓名','學號','分發社團','分發志願序']];
    assignmentResult.assigned.forEach(r => {
        aRows.push([r.class, r.seat, r.name, r.id, r.assignedClub, r.assignedByRound]);
    });
    const wsAssigned = XLSX.utils.aoa_to_sheet(aRows);
    XLSX.utils.book_append_sheet(wb, wsAssigned, '分發結果');

    const uRows = [['班級','座號','姓名','學號']];
    assignmentResult.unassigned.forEach(s => {
        uRows.push([s.class, s.seat, s.name, s.id]);
    });
    const wsUnassigned = XLSX.utils.aoa_to_sheet(uRows);
    XLSX.utils.book_append_sheet(wb, wsUnassigned, '未分發');

    const cRows = [['社團','剩餘名額']];
    Object.keys(assignmentResult.remaining).forEach(club => {
        cRows.push([club, assignmentResult.remaining[club]]);
    });
    const wsRemain = XLSX.utils.aoa_to_sheet(cRows);
    XLSX.utils.book_append_sheet(wb, wsRemain, '剩餘名額');

    XLSX.writeFile(wb, 'club_7_分發結果.xlsx');
}

// 處理清除
function handleClear() {
    if (selectedClubs.length === 0) {
        return;
    }
    
    if (confirm('確定要清除所有已選志願嗎？')) {
        selectedClubs = [];
        renderSelectedList();
        renderClubs();
        updateSelectionInfo();
    }
}

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', init);

