/* ============================================================
   ADMIN PANEL - SCRIPT.JS
   Logika autentikasi, fetch data, render table, dll
   ============================================================ */

// ============================================================
// KONFIGURASI
// ============================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzDQj02zqB64f3Svjj4hux92B-qc-coBRISQqztZncNPaFSCXm5iVN7vtdEBAj2Q_Y/exec';
const SESSION_KEY = 'admin_session';

let allData = [];
let currentFilter = 'all';
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
    const password = passwordInput.value.trim();
    
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
    fetch(`${SCRIPT_URL}?action=login&password=${encodeURIComponent(password)}`)
        .then(response => response.json())
        .then(result => {
            console.log('Login response:', result);
            
            if (result.result === 'success') {
                // Buat session
                const session = {
                    token: result.token,
                    expires: Date.now() + (24 * 60 * 60 * 1000) // 24 jam
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
        localStorage.removeItem(SESSION_KEY);
        authToken = '';
        isLoggedIn = false;
        showLogin();
        showToast('Anda telah logout', 'success');
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
    loadStats();
    loadData();
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
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItems = document.querySelectorAll('.nav-item');
    if (page === 'dashboard') {
        if (navItems[0]) navItems[0].classList.add('active');
    } else if (page === 'data') {
        if (navItems[1]) navItems[1].classList.add('active');
    } else if (page === 'unread') {
        if (navItems[2]) navItems[2].classList.add('active');
    }
}

// ============================================================
// FETCH DATA
// ============================================================

function fetchData() {
    const tableContent = document.getElementById('tableContent');
    tableContent.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i><span>Memuat data...</span></div>`;

    fetch(`${SCRIPT_URL}?action=getData&token=${encodeURIComponent(authToken)}`)
        .then(response => response.json())
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
                tableContent.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Gagal memuat data: ${result.error || 'Unknown error'}</p></div>`;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            tableContent.innerHTML = `<div class="empty-state"><i class="fas fa-wifi-slash"></i><p>Gagal terhubung ke server: ${error.message}</p></div>`;
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
    fetch(`${SCRIPT_URL}?action=getStats&token=${encodeURIComponent(authToken)}`)
        .then(response => response.json())
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
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;

    let filtered = allData;

    if (currentFilter === 'unread') {
        filtered = filtered.filter(d => d.Status !== 'Sudah Dibaca');
    }

    if (search) {
        filtered = filtered.filter(d => {
            const pesan = (d.pesan || '').toLowerCase();
            const kategori = (d.kategori || '').toLowerCase();
            const perbaikan = (d.perbaikan || '').toLowerCase();
            return pesan.includes(search) || 
                   kategori.includes(search) || 
                   perbaikan.includes(search);
        });
    }

    if (category) {
        filtered = filtered.filter(d => {
            const kat = d.kategori || '';
            if (category === 'Lainnya') {
                return kat.startsWith('Lainnya:');
            }
            return kat === category;
        });
    }

    if (status) {
        filtered = filtered.filter(d => d.Status === status);
    }

    renderTable(filtered);
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
                    <th style="min-width:150px;">Waktu</th>
                    <th style="min-width:170px;">Aksi</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach((row) => {
        const isUnread = row.Status !== 'Sudah Dibaca';
        const statusLabel = isUnread ? 'Belum Dibaca' : 'Sudah Dibaca';
        const statusClass = isUnread ? 'status-unread' : 'status-read';
        const timestamp = row.Timestamp ? new Date(row.Timestamp).toLocaleString('id-ID') : '-';

        html += `
            <tr>
                <td><span class="row-number">${row.no || '-'}</span></td>
                <td>${truncateText(row.pesan || '', 50)}</td>
                <td>${row.kategori || '-'}</td>
                <td>${truncateText(row.perbaikan || '-', 40)}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td>${timestamp}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-view" onclick="viewDetail(${row.no})">
                            <i class="fas fa-eye"></i> Detail
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
            <div class="value">${row.pesan || '-'}</div>
        </div>
        <div class="detail-item">
            <label>Kategori</label>
            <div class="value">${row.kategori || '-'}</div>
        </div>
        <div class="detail-item">
            <label>Saran Perbaikan</label>
            <div class="value">${row.perbaikan || '-'}</div>
        </div>
        <div class="detail-item">
            <label>Status</label>
            <div class="value">${row.Status || 'Belum Dibaca'}</div>
        </div>
        <div class="detail-item">
            <label>Waktu Dikirim</label>
            <div class="value">${row.Timestamp ? new Date(row.Timestamp).toLocaleString('id-ID') : '-'}</div>
        </div>
    `;

    content.innerHTML = html;
    modal.classList.add('active');
}

function closeDetail() {
    document.getElementById('detailModal').classList.remove('active');
}

// ============================================================
// MARK AS READ
// ============================================================

function markAsRead(no) {
    if (!confirm('Tandai masukan ini sebagai sudah dibaca?')) return;

    fetch(`${SCRIPT_URL}?action=updateStatus&rowNo=${no}&status=Sudah Dibaca&token=${encodeURIComponent(authToken)}`)
        .then(response => response.json())
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

    fetch(`${SCRIPT_URL}?action=deleteRow&rowNo=${no}&token=${encodeURIComponent(authToken)}`)
        .then(response => response.json())
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
    if (!allData || allData.length === 0) {
        showToast('Tidak ada data untuk diexport', 'error');
        return;
    }

    const headers = ['No', 'Timestamp', 'Pesan', 'Kategori', 'Perbaikan', 'Status'];
    let csv = headers.join(',') + '\n';

    allData.forEach((row) => {
        const values = [
            row.no || '',
            row.Timestamp || '',
            `"${(row.pesan || '').replace(/"/g, '""')}"`,
            `"${(row.kategori || '').replace(/"/g, '""')}"`,
            `"${(row.perbaikan || '').replace(/"/g, '""')}"`,
            row.Status || 'Belum Dibaca'
        ];
        csv += values.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `feedback_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showToast('Data berhasil diexport', 'success');
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
    document.getElementById('sidebar').classList.toggle('open');
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
    if (e.key === 'Enter' && !isLoggedIn) {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.dispatchEvent(new Event('submit'));
        }
    }
});
