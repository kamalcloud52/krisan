/* ============================================================
   ADMIN PANEL - SCRIPT.JS
   Logika autentikasi, fetch data, render table, dll
   ============================================================ */

// ============================================================
// KONFIGURASI
// ============================================================
const SCRIPT_URL = window.FEEDBACK_API_URL;
const SESSION_KEY = 'admin_session';

function apiRequest(action, params = {}) {
    const body = new URLSearchParams({ action, ...params });
    return fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body }).then(response => response.json());
}

function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

let allData = [];
let filteredData = [];
let currentFilter = 'all';
let activeFollowUpNo = null;
let isLoggedIn = false;
let authToken = '';

// ============================================================
// AUTHENTICATION
// ============================================================

/**
 * Cek session di localStorage
 */
function checkSession() {
    const sessionData = localStorage.getItem(SESSION_KEY);
    
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            const now = Date.now();
            
            // Cek apakah session masih valid (belum expired)
            if (session.expires && session.expires > now) {
                authToken = session.token;
                isLoggedIn = true;
                showApp();
                return;
            } else {
                // Session expired
                localStorage.removeItem(SESSION_KEY);
            }
        } catch (e) {
            localStorage.removeItem(SESSION_KEY);
        }
    }
    
    showLogin();
}

/**
 * Handle login form submission
 */
function handleLogin(event) {
    event.preventDefault();
    
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const errorMsg = document.getElementById('loginError');
    const errorText = document.getElementById('errorText');
    const password = passwordInput.value;
    
    // Reset error
    errorMsg.classList.remove('show');
    
    if (!password) {
        errorText.textContent = 'Password tidak boleh kosong!';
        errorMsg.classList.add('show');
        passwordInput.focus();
        return;
    }
    
    // Disable button
    loginBtn.disabled = true;
    loginBtnText.textContent = 'Memeriksa';
    loginBtn.querySelector('i').className = 'fas fa-spinner fa-spin';
    
    // Kirim ke backend
    apiRequest('login', { password })
        .then(result => {
            console.log('Login response:', result);
            
            if (result.result === 'success') {
                // Buat session
                const session = {
                    token: result.token,
                    expires: result.expires || Date.now() + (6 * 60 * 60 * 1000)
                };
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                authToken = result.token;
                isLoggedIn = true;
                
                showApp();
                showToast('Selamat datang, Admin!', 'success');
            } else {
                errorText.textContent = result.message || 'Password salah! Silakan coba lagi.';
                errorMsg.classList.add('show');
                passwordInput.value = '';
                passwordInput.focus();
            }
        })
        .catch(error => {
            console.error('Login error:', error);
            errorText.textContent = 'Terjadi kesalahan koneksi. Silakan coba lagi.';
            errorMsg.classList.add('show');
        })
        .finally(() => {
            // Enable button
            loginBtn.disabled = false;
            loginBtnText.textContent = 'Masuk';
            loginBtn.querySelector('i').className = 'fas fa-arrow-right';
        });
}

/**
 * Handle logout
 */
function handleLogout() {
    if (confirm('Yakin ingin logout?')) {
        apiRequest('logout', { token: authToken }).catch(error => console.error('Logout error:', error)).finally(() => {
            localStorage.removeItem(SESSION_KEY);
            authToken = '';
            isLoggedIn = false;
            showLogin();
            showToast('Anda telah logout', 'success');
        });
    }
}

/**
 * Tampilkan halaman login
 */
function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appContent').classList.remove('visible');
    document.getElementById('appContent').style.display = 'none';
    
    // Reset form login
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.value = '';
        setTimeout(() => passwordInput.focus(), 100);
    }
}

/**
 * Tampilkan aplikasi utama
 */
function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    document.getElementById('appContent').classList.add('visible');
    loadDashboard();
}

// ============================================================
// LOAD FUNCTIONS
// ============================================================

function loadDashboard() {
    document.getElementById('pageTitle').textContent = 'Dashboard';
    currentFilter = 'all';
    fetchData();
    setActiveNav('dashboard');
}

function loadData() {
    currentFilter = 'all';
    document.getElementById('pageTitle').textContent = 'Semua Masukan';
    fetchData();
    setActiveNav('data');
}

function loadUnread() {
    currentFilter = 'unread';
    document.getElementById('pageTitle').textContent = 'Belum Dibaca';
    fetchData();
    setActiveNav('unread');
}

function setActiveNav(page) {
    document.querySelectorAll('.nav-item').forEach(el => { el.classList.remove('active'); el.removeAttribute('aria-current'); });
    const navItems = document.querySelectorAll('.nav-item');
    if (page === 'dashboard') {
        if (navItems[0]) { navItems[0].classList.add('active'); navItems[0].setAttribute('aria-current', 'page'); }
    } else if (page === 'data') {
        if (navItems[1]) { navItems[1].classList.add('active'); navItems[1].setAttribute('aria-current', 'page'); }
    } else if (page === 'unread') {
        if (navItems[2]) { navItems[2].classList.add('active'); navItems[2].setAttribute('aria-current', 'page'); }
    }
}

// ============================================================
// FETCH DATA
// ============================================================

function fetchData() {
    const tableContent = document.getElementById('tableContent');
    tableContent.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i><span>Memuat data...</span></div>`;

    apiRequest('getData', { token: authToken })
        .then(result => {
            if (result.code === 'UNAUTHORIZED') {
                localStorage.removeItem(SESSION_KEY);
                authToken = '';
                isLoggedIn = false;
                showLogin();
                showToast('Session tidak valid, silakan login ulang', 'error');
                return;
            }
            
            if (result.result === 'success') {
                allData = result.data || [];
                updateBadges();
                applyFilters();
                loadStats();
            } else {
                tableContent.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Gagal memuat data: ${escapeHtml(result.error || result.message || 'Unknown error')}</p></div>`;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            tableContent.innerHTML = `<div class="empty-state"><i class="fas fa-wifi-slash"></i><p>Gagal terhubung ke server: ${escapeHtml(error.message)}</p></div>`;
        });
}

function refreshData() {
    if (!authToken) {
        localStorage.removeItem(SESSION_KEY);
        showLogin();
        return;
    }
    showToast('Merefresh data...', 'success');
    fetchData();
}

// ============================================================
// LOAD STATS
// ============================================================

function loadStats() {
    apiRequest('getStats', { token: authToken })
        .then(result => {
            if (result.code === 'UNAUTHORIZED') {
                localStorage.removeItem(SESSION_KEY);
                authToken = '';
                isLoggedIn = false;
                showLogin();
                return;
            }
            
            if (result.result === 'success') {
                const stats = result.stats;
                document.getElementById('statTotal').textContent = stats.total || 0;
                document.getElementById('statUnread').textContent = stats.unread || 0;
                document.getElementById('statRead').textContent = stats.read || 0;
                document.getElementById('statCategories').textContent = Object.keys(stats.byCategory || {}).length || 0;
                
                document.getElementById('totalBadge').textContent = stats.total || 0;
                document.getElementById('unreadBadge').textContent = stats.unread || 0;
            }
        })
        .catch(console.error);
}

function updateBadges() {
    const total = allData.length;
    const unread = allData.filter(d => d.Status !== 'Sudah Dibaca').length;
    document.getElementById('totalBadge').textContent = total;
    document.getElementById('unreadBadge').textContent = unread;
}

// ============================================================
// APPLY FILTERS
// ============================================================

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const searchField = document.getElementById('searchField').value;
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;
    const followUpStatus = document.getElementById('followUpFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    let filtered = allData;

    if (currentFilter === 'unread') {
        filtered = filtered.filter(d => d.Status !== 'Sudah Dibaca');
    }

    if (search) filtered = filtered.filter(row => matchesAdvancedSearch(row, search, searchField));
    filtered = filtered.filter(row => withinDateRange(row, dateFrom, dateTo));

    if (category) {
        filtered = filtered.filter(d => {
            const kat = d.kategori || '';
            if (category === 'Lainnya') {
                return kat === 'Lainnya' || kat.startsWith('Lainnya:');
            }
            return kat === category;
        });
    }

    if (status) {
        filtered = filtered.filter(d => (d.Status === 'Sudah Dibaca' ? 'Sudah Dibaca' : 'Belum Dibaca') === status);
    }
    if (followUpStatus) filtered = filtered.filter(row => (row['Status Tindak Lanjut'] || 'Baru') === followUpStatus);

    filteredData = filtered;
    document.getElementById('resultsCount').textContent = `${filtered.length} dari ${allData.length} masukan`;
    renderTrendSummary(filtered);
    renderTable(filtered);
}

function clearFilters() {
    ['searchInput','searchField','categoryFilter','statusFilter','followUpFilter','dateFrom','dateTo'].forEach(id => {
        const input = document.getElementById(id);
        if (input.tagName === 'SELECT') input.selectedIndex = 0;
        else input.value = '';
    });
    currentFilter = 'all';
    setActiveNav('data');
    applyFilters();
}

// ============================================================
// RENDER TABLE
// ============================================================

function renderTable(data) {
    const tableContent = document.getElementById('tableContent');

    if (!data || data.length === 0) {
        tableContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Tidak ada data yang ditemukan</p>
            </div>
        `;
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th style="width:50px;">No</th>
                    <th style="min-width:200px;">Pesan</th>
                    <th style="min-width:120px;">Kategori</th>
                    <th style="min-width:150px;">Saran Perbaikan</th>
                    <th style="min-width:100px;">Status</th>
                    <th style="min-width:150px;">Tindak lanjut</th>
                    <th style="min-width:150px;">Waktu</th>
                    <th style="min-width:210px;">Aksi</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach((row) => {
        const isUnread = row.Status !== 'Sudah Dibaca';
        const statusLabel = isUnread ? 'Belum Dibaca' : 'Sudah Dibaca';
        const statusClass = isUnread ? 'status-unread' : 'status-read';
        const timestamp = row.Timestamp ? new Date(row.Timestamp).toLocaleString('id-ID') : '-';
        const followUp = row['Status Tindak Lanjut'] || 'Baru';
        const replyStatus = row['Status Balasan'] === 'Terkirim' ? 'Balasan terkirim' : (row.Balasan ? 'Draft balasan' : 'Belum dibalas');

        html += `
            <tr>
                <td><span class="row-number">${row.no || '-'}</span></td>
                <td>${escapeHtml(truncateText(row.pesan || '', 50))}</td>
                <td>${escapeHtml(row.kategori || '-')}</td>
                <td>${escapeHtml(truncateText(row.perbaikan || '-', 40))}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td><span class="followup-badge">${escapeHtml(followUp)}</span><br><small>${escapeHtml(replyStatus)}</small></td>
                <td>${timestamp}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-view" onclick="viewDetail(${row.no})">
                            <i class="fas fa-eye"></i> Detail
                        </button>
                        <button class="btn-followup" onclick="openFollowUp(${row.no})" aria-label="Balas atau tindak lanjuti masukan ${row.no}">
                            <i class="fas fa-reply"></i> Tindak lanjut
                        </button>
                        ${isUnread ? `<button class="btn-read" onclick="markAsRead(${row.no})">
                            <i class="fas fa-check"></i> Tandai
                        </button>` : ''}
                        <button class="btn-delete" onclick="deleteRow(${row.no})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    tableContent.innerHTML = html;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function truncateText(text, maxLength) {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function getRowData(no) {
    return allData.find(d => d.no === no) || null;
}

// ============================================================
// VIEW DETAIL
// ============================================================

function viewDetail(no) {
    const row = getRowData(no);
    if (!row) {
        showToast('Data tidak ditemukan', 'error');
        return;
    }

    const modal = document.getElementById('detailModal');
    const content = document.getElementById('detailContent');

    let html = `
        <div class="detail-item">
            <label>Pesan / Saran</label>
            <div class="value">${escapeHtml(row.pesan || '-')}</div>
        </div>
        <div class="detail-item">
            <label>Kategori</label>
            <div class="value">${escapeHtml(row.kategori || '-')}</div>
        </div>
        <div class="detail-item">
            <label>Saran Perbaikan</label>
            <div class="value">${escapeHtml(row.perbaikan || '-')}</div>
        </div>
        <div class="detail-item">
            <label>Status</label>
            <div class="value">${escapeHtml(row.Status || 'Belum Dibaca')}</div>
        </div>
        <div class="detail-item">
            <label>Waktu Dikirim</label>
            <div class="value">${escapeHtml(row.Timestamp ? new Date(row.Timestamp).toLocaleString('id-ID') : '-')}</div>
        </div>
        <div class="detail-item"><label>Status tindak lanjut</label><div class="value">${escapeHtml(row['Status Tindak Lanjut'] || 'Baru')}</div></div>
        <div class="detail-item"><label>Balasan</label><div class="value">${escapeHtml(row.Balasan || 'Belum ada balasan')}</div></div>
        <div class="detail-item"><label>Status balasan</label><div class="value">${escapeHtml(row['Status Balasan'] || 'Belum ada balasan')}</div></div>
        <div class="detail-item"><label>Catatan internal</label><div class="value">${escapeHtml(row['Catatan Tindak Lanjut'] || '-')}</div></div>
    `;

    content.innerHTML = html;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('[role="dialog"]').focus();
}

function openFollowUp(no) {
    const row = getRowData(no);
    if (!row) return showToast('Masukan tidak ditemukan', 'error');
    activeFollowUpNo = no;
    document.getElementById('followUpStatus').value = row['Status Tindak Lanjut'] || 'Baru';
    document.getElementById('replyDraft').value = row.Balasan || '';
    document.getElementById('followUpNotes').value = row['Catatan Tindak Lanjut'] || '';
    document.getElementById('followUpTicketInfo').textContent = 'Balasan yang dipublikasikan bisa dicek pengirim lewat halaman “Cek balasan” menggunakan kode tiket anonim.';
    const replyStatus = row['Status Balasan'] === 'Terkirim' ? 'Balasan sudah dipublikasikan dan dapat dilihat dengan kode tiket.' : 'Balasan belum dipublikasikan.';
    document.getElementById('replyActions').textContent = replyStatus;
    const modal = document.getElementById('followUpModal');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('[role="dialog"]').focus();
}

function closeFollowUp() {
    const modal = document.getElementById('followUpModal');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    activeFollowUpNo = null;
}

function saveFollowUp(publishReply = false) {
    if (!activeFollowUpNo) return;
    if (publishReply && !confirm('Publikasikan balasan ini? Pengirim dapat membacanya dengan kode tiket.')) return;
    const button = document.getElementById('saveFollowUpBtn');
    const publishButton = document.getElementById('publishReplyBtn');
    const reply = document.getElementById('replyDraft').value.trim();
    if (publishReply && !reply) return showToast('Tulis balasan sebelum memublikasikannya.', 'error');
    const existingRow = getRowData(activeFollowUpNo);
    const replyStatus = publishReply ? 'Terkirim' : (existingRow && existingRow['Status Balasan'] === 'Terkirim' && reply === (existingRow.Balasan || '') ? 'Terkirim' : (reply ? 'Draft' : 'Belum ada balasan'));
    button.disabled = true;
    publishButton.disabled = true;
    button.textContent = publishReply ? 'Memublikasikan…' : 'Menyimpan…';
    apiRequest('updateFollowUp', {
        rowNo: String(activeFollowUpNo),
        followUpStatus: document.getElementById('followUpStatus').value,
        reply,
        notes: document.getElementById('followUpNotes').value.trim(),
        replyStatus,
        token: authToken
    }).then(result => {
        if (result.code === 'UNAUTHORIZED') {
            localStorage.removeItem(SESSION_KEY);
            authToken = '';
            isLoggedIn = false;
            showLogin();
            throw new Error('Sesi admin berakhir. Silakan login kembali.');
        }
        if (result.result !== 'success') throw new Error(result.error || result.message || 'Perubahan gagal disimpan.');
        showToast(publishReply ? 'Balasan dipublikasikan.' : 'Tindak lanjut tersimpan.', 'success');
        closeFollowUp();
        fetchData();
    }).catch(error => showToast(error.message, 'error')).finally(() => {
        button.disabled = false;
        publishButton.disabled = false;
        button.textContent = 'Simpan draft';
        publishButton.textContent = 'Publikasikan balasan';
    });
}

function closeDetail() {
    const modal = document.getElementById('detailModal');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

// ============================================================
// MARK AS READ
// ============================================================

function markAsRead(no) {
    if (!confirm('Tandai masukan ini sebagai sudah dibaca?')) return;

    apiRequest('updateStatus', { rowNo: String(no), status: 'Sudah Dibaca', token: authToken })
        .then(result => {
            if (result.code === 'UNAUTHORIZED') {
                localStorage.removeItem(SESSION_KEY);
                authToken = '';
                isLoggedIn = false;
                showLogin();
                return;
            }
            
            if (result.result === 'success') {
                showToast('Berhasil ditandai sudah dibaca', 'success');
                refreshData();
            } else {
                showToast('Gagal update status: ' + (result.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Terjadi kesalahan: ' + error.message, 'error');
        });
}

// ============================================================
// DELETE ROW
// ============================================================

function deleteRow(no) {
    if (!confirm('Yakin ingin menghapus masukan ini? Aksi tidak dapat dibatalkan!')) return;

    apiRequest('deleteRow', { rowNo: String(no), token: authToken })
        .then(result => {
            if (result.code === 'UNAUTHORIZED') {
                localStorage.removeItem(SESSION_KEY);
                authToken = '';
                isLoggedIn = false;
                showLogin();
                return;
            }
            
            if (result.result === 'success') {
                showToast('Data berhasil dihapus', 'success');
                refreshData();
            } else {
                showToast('Gagal menghapus data: ' + (result.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Terjadi kesalahan: ' + error.message, 'error');
        });
}

// ============================================================
// EXPORT DATA
// ============================================================

function exportData() {
    if (!filteredData || filteredData.length === 0) {
        showToast('Tidak ada data untuk diexport', 'error');
        return;
    }

    const headers = ['No', 'Timestamp', 'Pesan', 'Kategori', 'Perbaikan', 'Status Baca', 'Status Tindak Lanjut', 'Status Balasan', 'Balasan', 'Catatan Tindak Lanjut'];
    let csv = headers.join(',') + '\n';

    filteredData.forEach((row) => {
        const values = [
            row.no || '',
            csvCell(row.Timestamp || ''),
            csvCell(row.pesan || ''),
            csvCell(row.kategori || ''),
            csvCell(row.perbaikan || ''),
            csvCell(row.Status || 'Belum Dibaca'),
            csvCell(row['Status Tindak Lanjut'] || 'Baru'),
            csvCell(row['Status Balasan'] || 'Belum ada balasan'),
            csvCell(row.Balasan || ''),
            csvCell(row['Catatan Tindak Lanjut'] || '')
        ];
        csv += values.join(',') + '\n';
    });

    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `feedback_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showToast(`${filteredData.length} masukan hasil filter diexport`, 'success');
}

function csvCell(value) {
    const safe = String(value).replace(/^[\s\u0000-\u001f]*([=+\-@])/u, "'$1");
    return `"${safe.replace(/"/g, '""')}"`;
}

// ============================================================
// TOAST
// ============================================================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================

function toggleSidebar() {
    const isOpen = document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('hamburgerBtn').setAttribute('aria-expanded', String(isOpen));
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Login form submit
document.addEventListener('DOMContentLoaded', function() {
    // Cek session
    checkSession();
    
    // Setup login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

// Tutup sidebar saat klik di luar (mobile)
document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburgerBtn');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    }
});

// Shortcut Enter untuk login
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeDetail();
        closeFollowUp();
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('hamburgerBtn').setAttribute('aria-expanded', 'false');
    }
});
