document.addEventListener('DOMContentLoaded', () => {
    // === EXPORT CONFIG & STATE ===
    const COLS = [
        { id: 'serial', label: 'Sr. no.', default: true },
        { id: 'date', label: 'date', default: true },
        { id: 'receipt_no', label: 'receipt number', default: true },
        { id: 'building', label: 'building number', default: true },
        { id: 'flat_suffix', label: 'Flat No.', default: true },
        { id: 'owner_type', label: 'Owner / Renter', default: true },
        { id: 'owner', label: 'owner name', default: true },
        { id: 'phone', label: 'Phone number', default: false },
        { id: 'base_fee', label: 'Per Flat Charge/total amount', default: true },
        { id: 'cash', label: 'CASH', default: true },
        { id: 'online', label: 'ONLINE', default: true },
        { id: 'method', label: 'Payment method', default: true },
        { id: 'total', label: 'total payed', default: true },
        { id: 'months', label: 'Payed Months', default: true },
        { id: 'months_count', label: 'Payed Months in number', default: true },
        { id: 'pending_amount', label: 'pending amount', default: true },
        { id: 'remarks', label: 'remarks', default: false }
    ];

    let currentExportData = [];
    let displayedRowsCount = 0;
    const CHUNK_SIZE = 100;

    let selectedCols = JSON.parse(localStorage.getItem('exportCols_v2')) || COLS.map(c => c.id).filter((_, i) => COLS[i].default);

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
                <label class="uc-checkbox-wrap" style="height: auto; padding: 6px 0;">
                    <input type="checkbox" value="${col.id}" class="col-toggle" ${isChecked}>
                    <span class="uc-checkbox-box"></span>
                    <span class="uc-label" style="margin:0; text-transform:none; font-size:12px;">${col.label}</span>
                </label>
            `;
            toggleContainer.insertAdjacentHTML('beforeend', html);
        });

        document.querySelectorAll('.col-toggle').forEach(chk => {
            chk.addEventListener('change', () => {
                selectedCols = Array.from(document.querySelectorAll('.col-toggle:checked')).map(cb => cb.value);
                localStorage.setItem('exportCols_v2', JSON.stringify(selectedCols));
                if(window.UX && window.UX.vibrateLight) window.UX.vibrateLight();
            });
        });
    }

    document.getElementById('reset-cols').onclick = () => {
        localStorage.removeItem('exportCols_v2');
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
        if (parts.length > 1) {
            return { building: parts.slice(0, -1).join(' '), suffix: parts[parts.length - 1] };
        }
        return { building: 'Unknown', suffix: flatNoStr };
    }

    async function compileData() {
        const flats = await DB.fetchFlats();
        const receipts = await DB.fetchReceiptsByDate(dateFrom.value, dateTo.value);
        const hideBlank = document.getElementById('hide-blank-flats').checked;

        currentExportData = [];
        let serialCounter = 1;

        flats.forEach(flat => {
            const flatReceipts = receipts.filter(r => r.flat_no === flat.flat_no);
            const flatParsed = parseFlatDetails(flat.flat_no);

            if (flatReceipts.length === 0) {
                if (!hideBlank) {
                    currentExportData.push({
                        serial: serialCounter++, building: flatParsed.building, flat_suffix: flatParsed.suffix,
                        owner_type: flat.is_rented ? 'Renter' : '', owner: flat.owner_name, phone: flat.phone_number, base_fee: flat.usual_fee,
                        date: '', receipt_no: '', cash: '', online: '', method: '', total: '', months: '', months_count: '', pending_amount: '', remarks: ''
                    });
                }
            } else {
                flatReceipts.forEach(r => {
                    let cash = Number(r.cash_amount) || 0;
                    let online = Number(r.online_amount) || 0;
                    let method = cash > 0 && online > 0 ? 'both' : (cash > 0 ? 'cash' : (online > 0 ? 'online' : ''));

                    currentExportData.push({
                        serial: serialCounter++, building: flatParsed.building, flat_suffix: flatParsed.suffix,
                        owner_type: flat.is_rented ? 'Renter' : '', owner: flat.owner_name, phone: flat.phone_number, base_fee: flat.usual_fee,
                        date: new Date(r.date).toLocaleDateString('en-GB'), receipt_no: r.receipt_no,
                        cash: cash > 0 ? cash : '', online: online > 0 ? online : '', method: method,
                        total: Number(r.total_amount), months: r.months_covered, 
                        months_count: r.months_count, pending_amount: r.pending_amount, remarks: r.remarks || ''
                    });
                });
            }
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

    document.getElementById('btn-load-more').onclick = () => {
        renderNextChunk();
    };

    function renderNextChunk() {
        const tbody = document.getElementById('preview-tbody');
        const activeCols = COLS.filter(c => selectedCols.includes(c.id));
        const chunk = currentExportData.slice(displayedRowsCount, displayedRowsCount + CHUNK_SIZE);
        
        chunk.forEach(row => {
            let tr = '<tr style="border-bottom:1px solid #eee;">';
            activeCols.forEach(c => {
                let val = row[c.id];
                tr += `<td style="padding:8px; white-space:nowrap;">${val !== '' && val !== null ? val : ''}</td>`;
            });
            tr += '</tr>';
            tbody.innerHTML += tr;
        });

        displayedRowsCount += chunk.length;
        const loadMoreBtn = document.getElementById('preview-load-more');
        if (displayedRowsCount < currentExportData.length) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }

    document.getElementById('close-preview-btn').onclick = () => {
        document.getElementById('preview-modal-overlay').classList.add('hidden');
    };

    // === DIRECT & MODAL EXPORTS ===
    async function executeExcelExport() {
        if (typeof ExcelJS === 'undefined') return alert("ExcelJS is loading. Please wait 2 seconds.");
        
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Master Report');
        const activeCols = COLS.filter(c => selectedCols.includes(c.id));

        sheet.columns = activeCols.map(c => ({
            header: c.label,
            key: c.id,
            width: ['owner', 'remarks', 'months'].includes(c.id) ? 20 : 12
        }));

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center' };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        
        currentExportData.forEach(rowData => sheet.addRow(rowData));

        sheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => { cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }; });
            if (rowNumber > 1 && rowNumber % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
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

        const tableColumn = activeCols.map(c => c.label);
        const tableRows = currentExportData.map(row => activeCols.map(c => row[c.id] !== '' ? row[c.id] : '-'));

        doc.setFontSize(14);
        doc.text(`Ledger Master Report (${dateFrom.value} to ${dateTo.value})`, 40, 40);
        
        doc.autoTable({
            head: [tableColumn], body: tableRows, startY: 50,
            styles: { fontSize: 7, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.5 },
            headStyles: { fillColor: [242, 101, 34], textColor: [255,255,255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] }, margin: { top: 40 }
        });

        doc.save(`Ledger_Report_${dateFrom.value}_to_${dateTo.value}.pdf`);
    }

    // Modal Buttons
    document.getElementById('btn-dl-excel').onclick = () => { if(window.UX) UX.playClick(); executeExcelExport(); };
    document.getElementById('btn-dl-pdf').onclick = () => { if(window.UX) UX.playClick(); executePDFExport(); };

    // Direct Bulk Buttons
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
