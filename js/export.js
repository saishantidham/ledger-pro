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

    let selectedCols = JSON.parse(localStorage.getItem('exportCols_v14')) || COLS.map(c => c.id).filter((_, i) => COLS[i].default);

    const exportView = document.getElementById('export-view');
    const hubView = document.getElementById('hub-view');
    const toggleContainer = document.getElementById('column-toggles');
    const dateFrom = document.getElementById('export-date-from');
    const dateTo = document.getElementById('export-date-to');
    
    function initExportUI() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        if(dateFrom) dateFrom.value = firstDay.toISOString().split('T')[0];
        if(dateTo) dateTo.value = today.toISOString().split('T')[0];

        if(toggleContainer) {
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
        }

        document.querySelectorAll('.col-toggle').forEach(chk => {
            chk.addEventListener('change', () => {
                selectedCols = Array.from(document.querySelectorAll('.col-toggle:checked')).map(cb => cb.value);
                localStorage.setItem('exportCols_v14', JSON.stringify(selectedCols));
                if(window.UX && window.UX.vibrateLight) window.UX.vibrateLight();
            });
        });
    }

    const resetColsBtn = document.getElementById('reset-cols');
    if(resetColsBtn) resetColsBtn.onclick = () => {
        localStorage.removeItem('exportCols_v14');
        selectedCols = COLS.filter(c => c.default).map(c => c.id);
        initExportUI();
        if(window.UX && window.UX.vibrateLight) window.UX.vibrateLight();
    };

    const viewReportsBtn = document.getElementById('view-reports-btn');
    if(viewReportsBtn) viewReportsBtn.onclick = () => {
        if(window.UX && window.UX.playClick) window.UX.playClick();
        initExportUI();
        if(hubView) hubView.classList.replace('active-view', 'hidden-view');
        if(exportView) exportView.classList.replace('hidden-view', 'active-view');
    };

    const backExportBtn = document.getElementById('back-from-export-btn');
    if(backExportBtn) backExportBtn.onclick = () => {
        if(window.UX && window.UX.playClick) window.UX.playClick();
        if(exportView) exportView.classList.replace('active-view', 'hidden-view');
        if(hubView) hubView.classList.replace('hidden-view', 'active-view');
    };

    function parseFlatDetails(flatNoStr) {
        if (flatNoStr.startsWith('Shop')) return { building: 'Shop', suffix: flatNoStr.split('-')[1] };
        const parts = flatNoStr.split('-');
        if (parts.length > 1) return { building: parts.slice(0, -1).join(' '), suffix: parts[parts.length - 1] };
        return { building: 'Unknown', suffix: flatNoStr };
    }

    async function compileData() {
        const flats = await DB.fetchFlats();
        const fromVal = dateFrom ? dateFrom.value : '';
        const toVal = dateTo ? dateTo.value : '';
        const receipts = await DB.fetchReceiptsByDate(fromVal, toVal);
        
        const hideBlankEl = document.getElementById('hide-blank-flats');
        const hideBlank = hideBlankEl ? hideBlankEl.checked : false;
        
        const sortMethodEl = document.getElementById('export-sort-by');
        const sortMethod = sortMethodEl ? sortMethodEl.value : 'flat';

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

    const genPreviewBtn = document.getElementById('btn-generate-preview');
    if(genPreviewBtn) genPreviewBtn.onclick = async () => {
        if(window.UX && window.UX.playClick) window.UX.playClick();
        genPreviewBtn.textContent = "Fetching Data...";
        try {
            await compileData();
            displayedRowsCount = 0;
            const thead = document.getElementById('preview-thead');
            const tbody = document.getElementById('preview-tbody');
            if(thead) thead.innerHTML = ''; 
            if(tbody) tbody.innerHTML = '';

            const activeCols = COLS.filter(c => selectedCols.includes(c.id));
            let trHead = '<tr>';
            activeCols.forEach(c => trHead += `<th style="padding:8px; text-align:left; border-bottom:2px solid #ddd; white-space:nowrap;">${c.label}</th>`);
            trHead += '</tr>';
            if(thead) thead.innerHTML = trHead;

            renderNextChunk();
            const modalOverlay = document.getElementById('preview-modal-overlay');
            if(modalOverlay) modalOverlay.classList.remove('hidden');

        } catch (e) {
            console.error(e); alert("Failed to compile report.");
        } finally {
            genPreviewBtn.textContent = "Generate Quick Preview";
        }
    };

    const loadMoreBtn = document.getElementById('btn-load-more');
    if(loadMoreBtn) loadMoreBtn.onclick = () => renderNextChunk();

    function renderNextChunk() {
        const tbody = document.getElementById('preview-tbody');
        if(!tbody) return;
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
        const loadMoreContainer = document.getElementById('preview-load-more');
        if(loadMoreContainer) {
            if (displayedRowsCount < currentExportData.length) loadMoreContainer.style.display = 'block';
            else loadMoreContainer.style.display = 'none';
        }
    }

    const closePreviewBtn = document.getElementById('close-preview-btn');
    if(closePreviewBtn) closePreviewBtn.onclick = () => {
        const overlay = document.getElementById('preview-modal-overlay');
        if(overlay) overlay.classList.add('hidden');
    }

    async function executeExcelExport() {
        if (typeof ExcelJS === 'undefined') return alert("ExcelJS is loading. Please wait 2 seconds.");
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Master Report');
        const activeCols = COLS.filter(c => selectedCols.includes(c.id));

        sheet.columns = activeCols.map(c => ({
            header: c.label, key: c.id, width: ['owner', 'remarks', 'months'].includes(c.id) ? 20 : 13
        }));

        // Saffron Corporate Header
        const headerRow = sheet.getRow(1);
        headerRow.height = 24; 
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF26522' } }; 
        
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
        
        const dFromFormat = dateFrom ? dateFrom.value.split('-').reverse().join('-') : 'All';
        const dToFormat = dateTo ? dateTo.value.split('-').reverse().join('-') : 'All';
        link.download = `Ledger_Report_${dFromFormat}_to_${dToFormat}.xlsx`;
        link.click();
    }

    function executePDFExport() {
        if (!window.jspdf) return alert("jsPDF is loading. Please wait 2 seconds.");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'A4' }); 
        const activeCols = COLS.filter(c => selectedCols.includes(c.id));
        
        const totalsCheckbox = document.getElementById('pdf-totals-checkbox');
        const includeTotals = totalsCheckbox ? totalsCheckbox.checked : false;

        const dFromFormat = dateFrom ? dateFrom.value.split('-').reverse().join('/') : 'All';
        const dToFormat = dateTo ? dateTo.value.split('-').reverse().join('/') : 'All';
        
        const titleInput = document.getElementById('pdf-title-input');
        let rawTitle = titleInput ? titleInput.value : "Ledger Master Report ({from-date} to {to-date})";
        let finalTitle = rawTitle.replace('{from-date}', dFromFormat).replace('{to-date}', dToFormat);

        // Safe replace for ₹ to Rs.
        const tableColumn = activeCols.map(c => c.label.replace(/₹/g, 'Rs.'));
        const tableRows = currentExportData.map(row => activeCols.map(c => {
            let val = row[c.id] !== '' && row[c.id] !== null ? String(row[c.id]) : '-';
            return val.replace(/₹/g, 'Rs.'); 
        }));

        if (includeTotals && currentExportData.length > 0) {
            const totalRow = activeCols.map((c, index) => {
                if (index === 0) return 'TOTAL SUMMARY';
                if (['cash', 'online', 'total', 'pending_amount'].includes(c.id)) {
                    const sum = currentExportData.reduce((acc, row) => acc + (Number(row[c.id]) || 0), 0);
                    return `Rs.${sum}`;
                }
                return ''; 
            });
            tableRows.push(totalRow);
        }

        doc.setFontSize(14);
        doc.text(finalTitle, 40, 40);
        
        doc.autoTable({
            head: [tableColumn], body: tableRows, startY: 50, theme: 'grid',
            styles: { fontSize: 7, cellPadding: 5, textColor: [40, 40, 40], font: 'helvetica' }, 
            headStyles: { fillColor: [242, 101, 34], textColor: [255,255,255], fontStyle: 'bold', halign: 'center', valign: 'middle' },
            alternateRowStyles: { fillColor: [249, 250, 251] }, margin: { top: 40, left: 20, right: 20 },
            didParseCell: function(data) {
                if (data.section === 'body' && activeCols[data.column.index].id === 'pending_amount') {
                    let rawVal = data.cell.raw;
                    if (typeof rawVal === 'string') rawVal = rawVal.replace('Rs.', '');
                    let val = parseFloat(rawVal);
                    if (val > 0) { data.cell.styles.textColor = [211, 47, 47]; data.cell.styles.fontStyle = 'bold'; }
                    if (val < 0) { data.cell.styles.textColor = [46, 125, 50]; data.cell.styles.fontStyle = 'bold'; }
                }

                if (data.section === 'body' && includeTotals && data.row.index === tableRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [255, 245, 235]; 
                    data.cell.styles.textColor = [242, 101, 34]; 
                }
            }
        });

        doc.save(`Ledger_Report_${dFromFormat.replace(/\//g,'-')}_to_${dToFormat.replace(/\//g,'-')}.pdf`);
    }

    const btnDlExcel = document.getElementById('btn-dl-excel');
    if(btnDlExcel) btnDlExcel.onclick = () => { if(window.UX) UX.playClick(); executeExcelExport(); };
    
    const btnDlPdf = document.getElementById('btn-dl-pdf');
    if(btnDlPdf) btnDlPdf.onclick = () => { if(window.UX) UX.playClick(); executePDFExport(); };

    const btnDirectExcel = document.getElementById('btn-direct-excel');
    if(btnDirectExcel) btnDirectExcel.onclick = async () => {
        if(window.UX) UX.playClick();
        btnDirectExcel.textContent = "Processing...";
        await compileData();
        await executeExcelExport();
        btnDirectExcel.textContent = "Direct Excel";
    };

    const btnDirectPdf = document.getElementById('btn-direct-pdf');
    if(btnDirectPdf) btnDirectPdf.onclick = async () => {
        if(window.UX) UX.playClick();
        btnDirectPdf.textContent = "Processing...";
        await compileData();
        executePDFExport();
        btnDirectPdf.textContent = "Direct PDF";
    };
});
