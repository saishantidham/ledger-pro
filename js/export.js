document.addEventListener('DOMContentLoaded', () => {
    const COLS = [
        { id: 'serial', label: 'Sr. No.', default: true },
        { id: 'date', label: 'Date', default: true },
        { id: 'receipt_no', label: 'Receipt No.', default: true },
        { id: 'building', label: 'Building', default: true },
        { id: 'flat_suffix', label: 'Flat No.', default: true },
        { id: 'owner_type', label: 'Occupant', default: true },
        { id: 'owner', label: 'Name', default: true },
        { id: 'phone', label: 'Phone', default: false },
        { id: 'base_fee', label: 'Base Fee (₹)', default: true },
        { id: 'cash', label: 'Cash (₹)', default: true },
        { id: 'online', label: 'Online (₹)', default: true },
        { id: 'method', label: 'Method', default: true },
        { id: 'total', label: 'Total Paid (₹)', default: true },
        { id: 'months', label: 'Months Covered', default: true },
        { id: 'months_count', label: 'Months Count', default: true },
        { id: 'pending_amount', label: 'Pending (₹)', default: true },
        { id: 'remarks', label: 'Remarks', default: false }
    ];

    let currentExportData = [];
    let displayedRowsCount = 0;
    const CHUNK_SIZE = 100;

    let selectedCols = JSON.parse(localStorage.getItem('exportCols_v11')) || COLS.map(c => c.id).filter((_, i) => COLS[i].default);

    const exportView = document.getElementById('export-view');
    const hubView = document.getElementById('hub-view');
    const toggleContainer = document.getElementById('column-toggles');
    const dateFrom = document.getElementById('export-date-from');
    const dateTo = document.getElementById('export-date-to');
    
    function initExportUI() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        dateFrom.value = firstDay.toISOString().split('T')[0];
        dateTo.value = today.toISOString().split('T')[0];

        toggleContainer.innerHTML = '';
        COLS.forEach(col => {
            const isChecked = selectedCols.includes(col.id) ? 'checked' : '';
            const html = `
                <label class="uc-checkbox-wrap">
                    <input type="checkbox" value="${col.id}" class="col-toggle" ${isChecked}>
                    <span class="uc-checkbox-box"></span>
                    <span class="uc-label" style="margin:0; text-transform:none;">${col.label}</span>
                </label>
            `;
            toggleContainer.insertAdjacentHTML('beforeend', html);
        });

        document.querySelectorAll('.col-toggle').forEach(chk => {
            chk.addEventListener('change', () => {
                selectedCols = Array.from(document.querySelectorAll('.col-toggle:checked')).map(cb => cb.value);
                localStorage.setItem('exportCols_v11', JSON.stringify(selectedCols));
                if(window.UX && window.UX.vibrateLight) window.UX.vibrateLight();
            });
        });
    }

    document.getElementById('reset-cols').onclick = () => {
        localStorage.removeItem('exportCols_v11');
        selectedCols = COLS.filter(c => c.default).map(c => c.id);
        initExportUI();
        if(window.UX && window.UX.vibrateLight) window.UX.vibrateLight();
    };

    document.getElementById('view-reports-btn').onclick = () => {
        if(window.UX && window.UX.playClick) window.UX.playClick();
        initExportUI();
        hubView.classList.replace('active-view', 'hidden-view');
        exportView.classList.replace('hidden-view', 'active-view');
    };

    document.getElementById('back-from-export-btn').onclick = () => {
        if(window.UX && window.UX.playClick) window.UX.playClick();
        exportView.classList.replace('active-view', 'hidden-view');
        hubView.classList.replace('hidden-view', 'active-view');
    };

    function parseFlatDetails(flatNoStr) {
        if (flatNoStr.startsWith('Shop')) return { building: 'Shop', suffix: flatNoStr.split('-')[1] };
        const parts = flatNoStr.split('-');
        if (parts.length > 1) return { building: parts.slice(0, -1).join(' '), suffix: parts[parts.length - 1] };
        return { building: 'Unknown', suffix: flatNoStr };
    }

    async function compileData() {
        const flats = await DB.fetchFlats();
        const receipts = await DB.fetchReceiptsByDate(dateFrom.value, dateTo.value);
        const hideBlank = document.getElementById('hide-blank-flats').checked;
        const sortMethod = document.getElementById('export-sort-by').value;

        let rawData = [];

        flats.forEach(flat => {
            const flatReceipts = receipts.filter(r => r.flat_no === flat.flat_no);
            const flatParsed = parseFlatDetails(flat.flat_no);

            if (flatReceipts.length === 0) {
                if (!hideBlank) {
                    rawData.push({
                        building: flatParsed.building, flat_suffix: flatParsed.suffix,
                        owner_type: flat.is_rented ? 'Renter' : 'Owner',
                        owner: flat.owner_name, phone: flat.phone_number, base_fee: flat.usual_fee,
                        date: '', receipt_no: '', cash: '', online: '', method: '', total: '', months: '', months_count: '', pending_amount: '', remarks: '',
                        rawDate: new Date(0), rawRcpt: 0 
                    });
                }
            } else {
                flatReceipts.forEach(r => {
                    let cash = Number(r.cash_amount) || 0;
                    let online = Number(r.online_amount) || 0;
                    let method = cash > 0 && online > 0 ? 'Both' : (cash > 0 ? 'Cash' : (online > 0 ? 'Online' : ''));

                    rawData.push({
                        building: flatParsed.building, flat_suffix: flatParsed.suffix,
                        owner_type: flat.is_rented ? 'Renter' : 'Owner',
                        owner: flat.owner_name, phone: flat.phone_number, base_fee: flat.usual_fee,
                        date: new Date(r.date).toLocaleDateString('en-GB'), receipt_no: r.receipt_no,
                        cash: cash > 0 ? cash : '', online: online > 0 ? online : '', method: method,
                        total: Number(r.total_amount), months: r.months_covered, 
                        months_count: r.months_count, pending_amount: Number(r.pending_amount) || 0, remarks: r.remarks || '',
                        rawDate: new Date(r.date), rawRcpt: parseInt(r.receipt_no) || 0
                    });
                });
            }
        });

        rawData.sort((a, b) => {
            if (sortMethod === 'date') {
                if (a.rawDate.getTime() !== b.rawDate.getTime()) return a.rawDate - b.rawDate;
                return a.rawRcpt - b.rawRcpt;
            }
            if (sortMethod === 'receipt') {
                if (a.rawRcpt !== b.rawRcpt) return a.rawRcpt - b.rawRcpt;
                return a.rawDate - b.rawDate;
            }
            return 0; 
        });

        currentExportData = rawData.map((row, index) => {
            row.serial = index + 1;
            return row;
        });
    }

    document.getElementById('btn-generate-preview').onclick = async () => {
        if(window.UX && window.UX.playClick) window.UX.playClick();
        const btn = document.getElementById('btn-generate-preview');
        btn.textContent = "Fetching Data...";
        try {
            await compileData();
            displayedRowsCount = 0;
            const thead = document.getElementById('preview-thead');
            const tbody = document.getElementById('preview-tbody');
            thead.innerHTML = ''; tbody.innerHTML = '';

            const activeCols = COLS.filter(c => selectedCols.includes(c.id));
            let trHead = '<tr>';
            activeCols.forEach(c => trHead += `<th style="padding:8px; text-align:left; border-bottom:2px solid #ddd; white-space:nowrap;">${c.label}</th>`);
            trHead += '</tr>';
            thead.innerHTML = trHead;

            renderNextChunk();
            document.getElementById('preview-modal-overlay').classList.remove('hidden');

        } catch (e) {
            console.error(e); alert("Failed to compile report.");
        } finally {
            btn.textContent = "Generate Quick Preview";
        }
    };

    document.getElementById('btn-load-more').onclick = () => renderNextChunk();

    function renderNextChunk() {
        const tbody = document.getElementById('preview-tbody');
        const activeCols = COLS.filter(c => selectedCols.includes(c.id));
        const chunk = currentExportData.slice(displayedRowsCount, displayedRowsCount + CHUNK_SIZE);
        
        chunk.forEach(row => {
            let tr = '<tr style="border-bottom:1px solid #eee;">';
            activeCols.forEach(c => {
                let val = row[c.id];
                if (c.id === 'pending_amount' && val !== '') {
                    if (val > 0) val = `<span style="color: #D32F2F; font-weight: bold;">₹${val}</span>`;
                    else if (val < 0) val = `<span style="color: #2E7D32; font-weight: bold;">+₹${Math.abs(val)} (Adv)</span>`;
                    else val = '₹0';
                }
                tr += `<td style="padding:8px; white-space:nowrap;">${val !== '' && val !== null ? val : ''}</td>`;
            });
            tr += '</tr>';
            tbody.innerHTML += tr;
        });

        displayedRowsCount += chunk.length;
        const loadMoreBtn = document.getElementById('preview-load-more');
        if (displayedRowsCount < currentExportData.length) loadMoreBtn.style.display = 'block';
        else loadMoreBtn.style.display = 'none';
    }

    document.getElementById('close-preview-btn').onclick = () => document.getElementById('preview-modal-overlay').classList.add('hidden');

    async function executeExcelExport() {
        if (typeof ExcelJS === 'undefined') return alert("ExcelJS is loading. Please wait 2 seconds.");
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Master Report');
        const activeCols = COLS.filter(c => selectedCols.includes(c.id));

        sheet.columns = activeCols.map(c => ({
            header: c.label, key: c.id, width: ['owner', 'remarks', 'months'].includes(c.id) ? 20 : 13
        }));

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center' };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        
        currentExportData.forEach(rowData => {
            const row = sheet.addRow(rowData);
            if (selectedCols.includes('pending_amount')) {
                const cell = row.getCell('pending_amount');
                if (cell.value > 0) { cell.font = { color: { argb: 'FFD32F2F' }, bold: true }; } 
                else if (cell.value < 0) { cell.font = { color: { argb: 'FF2E7D32' }, bold: true }; } 
            }
        });

        sheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => { cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }; });
            if (rowNumber > 1 && rowNumber % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
        });

        const lastRowIdx = currentExportData.length + 1;
        const footerRow = sheet.getRow(lastRowIdx + 1);
        footerRow.getCell(1).value = "TOTAL";
        footerRow.font = { bold: true };
        
        activeCols.forEach((col, index) => {
            const colLetter = sheet.getColumn(index + 1).letter;
            if (['cash', 'online', 'total', 'pending_amount'].includes(col.id)) {
                footerRow.getCell(index + 1).value = { formula: `SUM(${colLetter}2:${colLetter}${lastRowIdx})` };
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Ledger_Report_${dateFrom.value}_to_${dateTo.value}.xlsx`;
        link.click();
    }

    function executePDFExport() {
        if (!window.jspdf) return alert("jsPDF is loading. Please wait 2 seconds.");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'A4' }); 
        const activeCols = COLS.filter(c => selectedCols.includes(c.id));

        // CRITICAL FIX: Replace '₹' with 'Rs.' purely for the PDF generation so Helvetica renders smoothly without falling back to Courier.
        const tableColumn = activeCols.map(c => c.label.replace(/₹/g, 'Rs.'));
        const tableRows = currentExportData.map(row => activeCols.map(c => {
            let val = row[c.id] !== '' && row[c.id] !== null ? String(row[c.id]) : '-';
            return val.replace(/₹/g, 'Rs.'); 
        }));

        doc.setFontSize(14);
        doc.text(`Ledger Master Report (${dateFrom.value} to ${dateTo.value})`, 40, 40);
        
        doc.autoTable({
            head: [tableColumn], body: tableRows, startY: 50, theme: 'grid',
            styles: { fontSize: 7, cellPadding: 5, textColor: [40, 40, 40], font: 'helvetica' }, // Added cellPadding: 5
            // Ensure headers are vertically middle-aligned so the orange background looks clean
            headStyles: { fillColor: [242, 101, 34], textColor: [255,255,255], fontStyle: 'bold', halign: 'center', valign: 'middle' },
            alternateRowStyles: { fillColor: [249, 250, 251] }, margin: { top: 40, left: 20, right: 20 },
            didParseCell: function(data) {
                if (data.section === 'body' && activeCols[data.column.index].id === 'pending_amount') {
                    let val = parseFloat(data.cell.raw);
                    if (val > 0) { data.cell.styles.textColor = [211, 47, 47]; data.cell.styles.fontStyle = 'bold'; }
                    if (val < 0) { data.cell.styles.textColor = [46, 125, 50]; data.cell.styles.fontStyle = 'bold'; }
                }
            }
        });

        doc.save(`Ledger_Report_${dateFrom.value}_to_${dateTo.value}.pdf`);
    }

    document.getElementById('btn-dl-excel').onclick = () => { if(window.UX) UX.playClick(); executeExcelExport(); };
    document.getElementById('btn-dl-pdf').onclick = () => { if(window.UX) UX.playClick(); executePDFExport(); };

    document.getElementById('btn-direct-excel').onclick = async () => {
        if(window.UX) UX.playClick();
        const btn = document.getElementById('btn-direct-excel');
        btn.textContent = "Processing...";
        await compileData();
        await executeExcelExport();
        btn.textContent = "Direct Excel";
    };

    document.getElementById('btn-direct-pdf').onclick = async () => {
        if(window.UX) UX.playClick();
        const btn = document.getElementById('btn-direct-pdf');
        btn.textContent = "Processing...";
        await compileData();
        executePDFExport();
        btn.textContent = "Direct PDF";
    };
});
