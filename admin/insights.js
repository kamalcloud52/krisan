// Search, date-range filtering, and SVG trend summary for the admin dashboard.
function parseSearchTerms(query) {
    const matches = String(query || '').match(/"[^"]+"|'[^']+'|\S+/g) || [];
    return matches.map(term => term.replace(/^['"]|['"]$/g, '').toLocaleLowerCase('id-ID')).filter(Boolean);
}

function matchesAdvancedSearch(row, query, field) {
    const values = {
        pesan: [row.pesan],
        kategori: [row.kategori],
        perbaikan: [row.perbaikan],
        followup: [row.Balasan, row['Catatan Tindak Lanjut'], row['Status Tindak Lanjut'], row['Status Balasan']]
    };
    const searchable = field === 'all' ? Object.values(values).flat() : (values[field] || Object.values(values).flat());
    const text = searchable.join(' ').toLocaleLowerCase('id-ID');
    return parseSearchTerms(query).every(term => text.includes(term));
}

function withinDateRange(row, fromValue, toValue) {
    if (!fromValue && !toValue) return true;
    const date = row.Timestamp ? new Date(row.Timestamp) : null;
    if (!date || Number.isNaN(date.getTime())) return false;
    if (fromValue) {
        const from = new Date(fromValue + 'T00:00:00');
        if (date < from) return false;
    }
    if (toValue) {
        const to = new Date(toValue + 'T23:59:59.999');
        if (date > to) return false;
    }
    return true;
}

function renderTrendSummary(data) {
    const chart = document.getElementById('trendChart');
    if (!chart) return;
    const count = data.length;
    document.getElementById('trendTotal').textContent = `${count} masukan`;
    const fromValue = document.getElementById('dateFrom').value;
    const toValue = document.getElementById('dateTo').value;
    const validDates = data.map(row => new Date(row.Timestamp)).filter(date => !Number.isNaN(date.getTime()));
    const now = new Date();
    const latestDate = validDates.reduce((latest, date) => Math.max(latest, date.getTime()), now.getTime());
    let end = toValue ? new Date(toValue + 'T23:59:59') : new Date(latestDate);
    let start = fromValue ? new Date(fromValue + 'T00:00:00') : new Date(end);
    if (!fromValue) start.setMonth(start.getMonth() - 5, 1);
    if (fromValue && !toValue) end = new Date(latestDate);
    if (end < start) {
        chart.innerHTML = '<p class="trend-empty">Rentang tanggal tidak valid.</p>';
        return;
    }

    const spanDays = Math.max(1, Math.ceil((end - start) / 86400000));
    const unit = spanDays <= 35 ? 'day' : spanDays <= 140 ? 'week' : spanDays <= 1825 ? 'month' : 'year';
    const bins = [];
    const cursor = new Date(start);
    if (unit === 'day') cursor.setHours(0, 0, 0, 0);
    else if (unit === 'week') {
        cursor.setHours(0, 0, 0, 0);
        cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    } else if (unit === 'year') cursor.setMonth(0, 1), cursor.setHours(0, 0, 0, 0);
    else cursor.setDate(1), cursor.setHours(0, 0, 0, 0);
    while (cursor <= end && bins.length < 60) {
        const binStart = new Date(cursor);
        const next = new Date(cursor);
        if (unit === 'day') next.setDate(next.getDate() + 1);
        else if (unit === 'week') next.setDate(next.getDate() + 7);
        else if (unit === 'year') next.setFullYear(next.getFullYear() + 1);
        else next.setMonth(next.getMonth() + 1);
        bins.push({start:binStart, end:next, count:0});
        cursor.setTime(next.getTime());
    }
    validDates.forEach(date => {
        const bin = bins.find(item => date >= item.start && date < item.end);
        if (bin) bin.count++;
    });
    const label = unit === 'day' ? 'per hari' : unit === 'week' ? 'per minggu' : unit === 'year' ? 'per tahun' : 'per bulan';
    document.getElementById('trendCaption').textContent = `Jumlah masukan ${label}${fromValue || toValue ? ' dalam rentang filter' : ' — 6 bulan terakhir'}`;
    const width = Math.max(560, bins.length * 68), height = 190, left = 34, right = 10, top = 14, bottom = 32;
    const plotHeight = height - top - bottom, plotWidth = width - left - right;
    const max = Math.max(1, ...bins.map(bin => bin.count));
    const grid = [0, 0.5, 1].map(factor => {
        const y = top + plotHeight * factor;
        return `<line class="gridline" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text x="${left-8}" y="${y+4}" text-anchor="end">${Math.round(max*(1-factor))}</text>`;
    }).join('');
    const barWidth = Math.min(34, Math.max(10, plotWidth / bins.length * .5));
    const bars = bins.map((bin, index) => {
        const x = left + (index + .5) * (plotWidth / bins.length) - barWidth / 2;
        const barHeight = bin.count ? Math.max(2, bin.count / max * plotHeight) : 0;
        const y = top + plotHeight - barHeight;
        const labelText = unit === 'year' ? String(bin.start.getFullYear()) : unit === 'month' ? bin.start.toLocaleDateString('id-ID',{month:'short',year:'2-digit'}) : bin.start.toLocaleDateString('id-ID',{day:'numeric',month:'short'});
        return `<g><title>${labelText}: ${bin.count} masukan</title><rect class="bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}"/><text x="${x+barWidth/2}" y="${height-8}" text-anchor="middle">${labelText}</text></g>`;
    }).join('');
    chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Tren ${count} masukan ${label}">${grid}${bars}</svg>`;
}
