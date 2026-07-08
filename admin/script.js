/* ============================================================
   ADMIN PANEL - SCRIPT.JS
   Logika autentikasi, fetch data, render table, dll
   ============================================================ */

// ============================================================
// KONFIGURASI
// ============================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzDQj02zqB64f3Svjj4hux92B-qc-coBRISQqztZncNPaFSCXm5iVN7vtdEBAj2Q_Y/exec';
let allData = [];
let currentFilter = 'all';
let isLoggedIn = false;
let authToken = '';

// ============================================================
// AUTHENTICATION - BACKEND
// ============================================================

/**
 * Cek session di localStorage dan verifikasi ke backend
 */
function checkSession() {
    authToken = localStorage.getItem('admin_token') || '';
    
    if (authToken) {
        verifyToken(authToken);
    } else {
        showLogin();
    }
}

/**
 * Verifikasi token ke backend
 */
function verifyToken(token) {
    fetch(`${SCRIPT_URL}?action=checkSession&token=${encodeURIComponent(token)}`)
        .then(response => response.json())
        .then(result => {
            if (result.result === 'success') {
                isLoggedIn = true;
                showApp();
            } else {
                localStorage.removeItem('admin_token');
                authToken = '';
                showLogin();
            }
        })
        .catch(() => {
            localStorage.removeItem('admin_token');
            authToken = '';
            showLogin();
        });
}

/**
 * Handle login form submission
 */
function handleLogin(event) {
    event.preventDefault();
    
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');
    const errorMsg = document.getElementById('loginError');
    const password = passwordInput.value.trim();
    
    if (!password) {
        errorMsg.textContent = 'Password tidak boleh kosong!';
        errorMsg.classList.add('show');
        return;
    }
    
    loginBtn.disabled = true;
    loginBtn.innerHTML = 'Memeriksa <i class="fa-regular fa-spinner fa-spin"></i>';
    errorMsg.classList.remove('show');
    
    fetch(`${SCRIPT_URL}?action=login&password=${encodeURIComponent(password)}`)
        .then(response => response.json())
        .then(result => {
            if (result.result === 'success') {
                authToken = result.token;
                localStorage.setItem('admin_token', authToken);
                isLoggedIn = true;
                showApp();
                showToast('Selamat datang, Admin!', 'success');
            } else {
                errorMsg.textContent = 'Password salah! Silakan coba lagi.';
                errorMsg.classList.add('show');
                passwordInput.value = '';
                passwordInput.focus();
            }
        })
        .catch(() => {
            errorMsg.textContent = 'Terjadi kesalahan koneksi. Silakan coba lagi.';
            errorMsg.classList.add('show');
        })
        .finally(() => {
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Masuk <i class="fa-regular fa-arrow-right"></i>';
        });
}

/**
 * Handle logout
 */
function handleLogout() {
    if (confirm('Yakin ingin logout?')) {
        localStorage.removeItem('admin_token');
        authToken = '';
        isLoggedIn = false;
        
        fetch(`${SCRIPT_URL}?action=logout`).catch(() => {});
        
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

/**
 * Load dashboard (stats + data)
 */
function loadDashboard() {
    document.getElementById('pageTitle').textContent = 'Dashboard';
    loadStats();
    loadData();
    setActiveNav('dashboard');
}

/**
 * Load semua data
 */
function loadData() {
    currentFilter = 'all';
    document.getElementById('pageTitle').textContent = 'Semua Masukan';
    fetchData();
    setActiveNav('data');
}

/**
 * Load data yang belum dibaca
 */
function loadUnread() {
    currentFilter = 'unread';
    document.getElementById('pageTitle').textContent = 'Belum Dibaca';
    fetchData();
    setActiveNav('unread');
}

/**
 * Set active navigation item
 */
function setActiveNav(page) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (page === 'dashboard') {
        document.querySelector('.nav-item:nth-child(1)').classList.add('active');
    } else if (page === 'data') {
        document.querySelector('.nav-item:nth-child(2)').classList.add('active');
    } else if (page === 'unread') {
        document.querySelector('.nav-item:nth-child(3)').classList.add('active');
    }
}

// ============================================================
// FETCH DATA
// ============================================================

/**
 * Fetch data dari backend
 */
function fetchData() {
    const tableContent = document.getElementById('tableContent');
    tableContent.innerHTML = `<div class="loading"><i class="fa-regular fa-spinner fa-spin"></i><span>Memuat data...</span></div>`;

    fetch(`${SCRIPT_URL}?action=getData&token=${encodeURIComponent(authToken)}`)
        .then(response => response.json())
        .then(result => {
            if (result.code === 'UNAUTHORIZED') {
                handleLogout();
                return;
            }
            
            if (result.result === 'success') {
                allData = result.data || [];
                updateBadges();
                applyFilters();
                loadStats();
            } else {
                tableContent.innerHTML = `<div class="empty-state"><i class="fa-regular fa-triangle-exclamation"></i><p>Gagal memuat data: ${result.error || 'Unknown error'}</p></div>`;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            tableContent.innerHTML = `<div class="empty-state"><i class="fa-regular fa-wifi-slash"></i><p>Gagal terhubung ke server: ${error.message}</p></div>`;
        });
}

/**
 * Refresh data
 */
function refreshData() {
    if (!authToken) {
        handleLogout();
        return;
    }
    showToast('Merefresh data...', 'success');
    fetchData();
}

// ============================================================
// LOAD STATS
// ============================================================

/**
 * Load statistik dari backend
 */
function loadStats() {
    fetch(`${SCRIPT_URL}?action=getStats&token=${encodeURIComponent(authToken)}`)
        .then(response => response.json())
        .then(result => {
            if (result.code === 'UNAUTHORIZED') {
                handleLogout();
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

/**
 * Update badge di sidebar
 */
function updateBadges() {
    const total = allData.length;
    const unread = allData.filter(d => d.Status !== 'Sudah Dibaca').length;
    document.getElementById('totalBadge').textContent = total;
    document.getElementById('unreadBadge').textContent = unread;
}

// ============================================================
// APPLY FILTERS
// ============================================================

/**
 * Apply filter ke data
 */
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

/**
 * Render tabel dengan data
 */
function renderTable(data) {
    const tableContent = document.getElementById('tableContent');

    if (!data || data.length === 0) {
        tableContent.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-inbox"></i>
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
                            <i class="fa-regular fa-eye"></i> Detail
                        </button>
                        ${isUnread ? `<button class="btn-read" onclick="markAsRead(${row.no})">
                            <i class="fa-regular fa-check"></i> Tandai
                        </button>` : ''}
                        <button class="btn-delete" onclick="deleteRow(${row.no})">
                            <i class="fa-regular fa-trash"></i>
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

/**
 * Truncate text dengan max length
 */
function truncateText(text, maxLength) {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * Cari data berdasarkan nomor
 */
function getRowData(no) {
    return allData.find(d => d.no === no) || null;
}

// ============================================================
// VIEW DETAIL
// ============================================================

/**
 * Tampilkan detail data di modal
 */
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

/**
 * Tutup modal detail
 */
function closeDetail() {
    document.getElementById('detailModal').classList.remove('active');
}

// ============================================================
// MARK AS READ
// ============================================================

/**
 * Tandai feedback sebagai sudah dibaca
 */
function markAsRead(no) {
    if (!confirm('Tandai masukan ini sebagai sudah dibaca?')) return;

    fetch(`${SCRIPT_URL}?action=updateStatus&rowNo=${no}&status=Sudah Dibaca&token=${encodeURIComponent(authToken)}`)
        .then(response => response.json())
        .then(result => {
            if (result.code === 'UNAUTHORIZED') {
                handleLogout();
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

/**
 * Hapus feedback
 */
function deleteRow(no) {
    if (!confirm('Yakin ingin menghapus masukan ini? Aksi tidak dapat dibatalkan!')) return;

    fetch(`${SCRIPT_URL}?action=deleteRow&rowNo=${no}&token=${encodeURIComponent(authToken)}`)
        .then(response => response.json())
        .then(result => {
            if (result.code === 'UNAUTHORIZED') {
                handleLogout();
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

/**
 * Export data ke CSV
 */
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
// TOAST NOTIFICATION
// ============================================================

/**
 * Tampilkan toast notification
 */
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
// SIDEBAR TOGGLE (MOBILE)
// ============================================================

/**
 * Toggle sidebar di mobile
 */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    checkSession();
});

// Tutup sidebar saat klik di luar (mobile)
document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburgerBtn');
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
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
