document.addEventListener('DOMContentLoaded', () => {
    // === EXPORT CONFIG & STATE ===
    const COLS = [
        { id: 'serial', label: 'Sr. No.', default: true },
        { id: 'date', label: 'Date', default: true },
        { id: 'receipt_no', label: 'Receipt No.', default: true },
        { id: 'flat_no', label: 'Flat No.', default: true },
        { id: 'owner', label: 'Owner/Renter', default: true },
        { id: 'phone', label: 'Phone', default: false },
        { id: 'base_fee', label: 'Per Flat Charge', default: true },
        { id: 'cash', label: 'Cash', default: true },
        { id: 'online', label: 'Online', default: true },
        { id: 'total', label: 'Total Paid', default: true },
        { id: 'months', label: 'Months Covered', default: true },
        { id: 'remarks', label: 'Remarks', default: false }
    ];

    let currentExportData = [];
    let selectedCols = JSON.parse(localStorage.getItem('exportCols_v1')) || COLS.map(c => c.id).filter((_, i) => COLS[i].default);

    // === DOM ELEMENTS ===
    const exportView = document.getElementById('export-view');
    const hubView = document.getElementById('hub-view');
    const toggleContainer = document.getElementById('column-toggles');
    const dateFrom = document.getElementById('export-date-from');
    const dateTo = document.getElementById('export-date-to');
    
    // === INITIALIZATION ===
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
                localStorage.setItem('exportCols_v1', JSON.stringify(selectedCols));
                if(window.UX && window.UX.vibrateLight) window.UX.vibrateLight();
            });
        });
    }

    document.getElementById('reset-cols').onclick = () => {
        localStorage.removeItem('exportCols_v1');
        selectedCols = COLS.filter(c => c.default).map(c => c.id);
        initExportUI();
        if(window.UX && window.UX.vibrateLight) window.UX.vibrateLight();
    };

    // === NAVIGATION ===
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

    // === DATA MERGING LOGIC ===
    document.getElementById('btn-generate-preview').onclick = async () => {
        if(window.UX && window.UX.playClick) window.UX.playClick();
        const btn = document.getElementById('btn-generate-preview');
        btn.textContent = "Fetching Data...";
        
        try {
            // Fetch raw arrays independently to avoid join errors
            const flats = await DB.fetchFlats();
            const receipts = await DB.fetchReceiptsByDate(dateFrom.value, dateTo.value);

            currentExportData = [];
            let serialCounter = 1;

            flats.forEach(flat => {
                const flatReceipts = receipts.filter(r => r.flat_no === flat.flat_no);

                if (flatReceipts.length === 0) {
                    currentExportData.push({
                        serial: serialCounter++, flat_no: flat.flat_no, owner: flat.owner_name,
                        phone: flat.phone_number, base_fee: flat.usual_fee,
                        date: '', receipt_no: '', cash: 0, online: 0, total: 0, months: '', remarks: ''
                    });
                } else {
                    flatReceipts.forEach(r => {
                        currentExportData.push({
                            // FIXED: Using flat object directly
                            serial: serialCounter++, flat_no: flat.flat_no, owner: flat.owner_name,
                            phone: flat.phone_number, base_fee: flat.usual_fee,
                            date: new Date(r.date).toLocaleDateString('en-GB'), receipt_no: r.receipt_no,
                            cash: Number(r.cash_amount), online: Number(r.online_amount), 
                            total: Number(r.total_amount), months: r.months_covered, remarks: r.remarks || ''
                        });
                    });
                }
            });

            renderPreviewTable();
            document.getElementById('preview-modal-overlay').classList.remove('hidden');

        } catch (e) {
            console.error(e);
            alert("Failed to compile report. Check console for details.");
        } finally {
            btn.textContent = "Generate Preview";
        }
    };

    document.getElementById('close-preview-btn').onclick = () => {
        document.getElementById('preview-modal-overlay').classList.add('hidden');
    };

    // === RENDER HTML PREVIEW ===
    function renderPreviewTable() {
        const thead = document.getElementById('preview-thead');
        const tbody = document.getElementById('preview-tbody');
        thead.innerHTML = ''; tbody.innerHTML = '';

        const activeCols = COLS.filter(c => selectedCols.includes(c.id));
        let trHead = '<tr>';
        activeCols.forEach(c => trHead += `<th style="padding:8px; text-align:left; border-bottom:2px solid #ddd; white-space:nowrap;">${c.label}</th>`);
        trHead += '</tr>';
        thead.innerHTML = trHead;

        const previewLimit = currentExportData.slice(0, 100);
        previewLimit.forEach(row => {
            let tr = '<tr style="border-bottom:1px solid #eee;">';
            activeCols.forEach(c => {
                let val = row[c.id];
                if (['cash', 'online', 'total', 'base_fee'].includes(c.id) && val > 0) val = `₹${val}`;
                tr += `<td style="padding:8px; white-space:nowrap;">${val || '-'}</td>`;
            });
            tr += '</tr>';
            tbody.innerHTML += tr;
        });

        if (currentExportData.length > 100) {
            tbody.innerHTML += `<tr><td colspan="${activeCols.length}" style="text-align:center; padding:12px; color:#888;">... showing first 100 rows. Export to see all ${currentExportData.length} entries.</td></tr>`;
        }
    }

    // === EXCEL GENERATION ===
    document.getElementById('btn-dl-excel').onclick = async () => {
        if(window.UX && window.UX.playClick) window.UX.playClick();
        
        if (typeof ExcelJS === 'undefined') {
            alert("ExcelJS library is missing or loading slowly. Try again in a moment.");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Master Report');
        const activeCols = COLS.filter(c => selectedCols.includes(c.id));

        sheet.columns = activeCols.map(c => ({
            header: c.label,
            key: c.id,
            width: ['owner', 'remarks', 'months'].includes(c.id) ? 20 : 12
        }));

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };

        currentExportData.forEach(rowData => {
            sheet.addRow(rowData);
        });

        const lastRowIdx = currentExportData.length + 1;
        const footerRowIdx = lastRowIdx + 1;
        const footerRow = sheet.getRow(footerRowIdx);
        
        footerRow.getCell(1).value = "TOTAL";
        footerRow.font = { bold: true };

        activeCols.forEach((col, index) => {
            const colLetter = sheet.getColumn(index + 1).letter;
            if (['cash', 'online', 'total'].includes(col.id)) {
                footerRow.getCell(index + 1).value = {
                    formula: `SUM(${colLetter}2:${colLetter}${lastRowIdx})`
                };
                footerRow.getCell(index + 1).numFmt = '₹#,##0.00';
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Ledger_Report_${dateFrom.value}_to_${dateTo.value}.xlsx`;
        link.click();
    };

    // === PDF GENERATION ===
    document.getElementById('btn-dl-pdf').onclick = () => {
        if(window.UX && window.UX.playClick) window.UX.playClick();
        
        if (!window.jspdf) {
            alert("jsPDF library is missing or loading slowly. Try again in a moment.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' }); 
        const activeCols = COLS.filter(c => selectedCols.includes(c.id));

        const tableColumn = activeCols.map(c => c.label);
        const tableRows = [];

        currentExportData.forEach(row => {
            const rowData = activeCols.map(c => {
                let val = row[c.id];
                return (['cash', 'online', 'total', 'base_fee'].includes(c.id) && val > 0) ? `Rs.${val}` : (val || '-');
            });
            tableRows.push(rowData);
        });

        doc.setFontSize(14);
        doc.text(`Ledger Master Report (${dateFrom.value} to ${dateTo.value})`, 14, 15);
        
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [242, 101, 34] },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            margin: { top: 20 }
        });

        doc.save(`Ledger_Report_${dateFrom.value}_to_${dateTo.value}.pdf`);
    };
});
