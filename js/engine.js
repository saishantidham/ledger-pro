document.addEventListener('DOMContentLoaded', () => {
    // === APP STATE ===
    let flatsData = [];
    let receiptsData = []; 
    let currentHubDate = new Date(); // Tracks what month the calendar is viewing
    let selectedSessionDate = new Date(); // The physical receipt date chosen

    // === DOM ELEMENTS ===
    const views = { auth: document.getElementById('auth-view'), hub: document.getElementById('hub-view'), workspace: document.getElementById('workspace-view') };
    
    // Hub
    const calGrid = document.getElementById('calendar-grid');
    const calHeader = document.getElementById('cal-month-year');
    const activeSessionDateDisplay = document.getElementById('active-session-date');
    const statToday = document.getElementById('stat-today');
    const statMonth = document.getElementById('stat-month');
    
    // Workspace Form
    const serialDisplay = document.getElementById('serial-display');
    const form = document.getElementById('receipt-form');
    const D = {
        toggle: document.getElementById('mode-toggle'),
        rcptNo: document.getElementById('receipt-no'),
        dateIn: document.getElementById('receipt-date'), dateDisp: document.getElementById('display-date'),
        flatBtn: document.getElementById('open-flat-search'),
        name: document.getElementById('owner-name'), phone: document.getElementById('owner-phone'),
        baseFee: document.getElementById('base-fee'), isRented: document.getElementById('is-rented'),
        mFromIn: document.getElementById('month-from'), mFromDisp: document.getElementById('display-month-from'),
        mToIn: document.getElementById('month-to'), mToDisp: document.getElementById('display-month-to'),
        mCalc: document.getElementById('months-calculated'),
        cash: document.getElementById('cash-amount'), online: document.getElementById('online-amount'),
        total: document.getElementById('total-amount-display'),
        remarks: document.getElementById('remarks'), charCount: document.getElementById('char-count')
    };

    // Modals
    const searchModal = document.getElementById('flat-search-modal');
    const searchInput = document.getElementById('flat-search-input');
    const flatList = document.getElementById('flat-list');
    const successModal = document.getElementById('success-modal-overlay');

    let currentSelectedFlatNo = null;

    // === EXPORT ENGINE INITIALIZATION FOR AUTH.JS ===
    window.loadHubData = async function() {
        switchView('hub');
        flatsData = await DB.fetchFlats() || [];
        const { data: rcpts } = await supabaseClient.from('receipts').select('date, total_amount, serial_no');
        receiptsData = rcpts || [];
        renderCalendar();
    }

    function switchView(viewName) {
        Object.values(views).forEach(v => v.classList.replace('active-view', 'hidden-view'));
        views[viewName].classList.replace('hidden-view', 'active-view');
    }

    // === HUB & CALENDAR LOGIC ===
    
    // Calendar Navigation
    document.getElementById('prev-month-btn').addEventListener('click', () => {
        currentHubDate.setMonth(currentHubDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('next-month-btn').addEventListener('click', () => {
        currentHubDate.setMonth(currentHubDate.getMonth() + 1);
        renderCalendar();
    });

    function renderCalendar() {
        const year = currentHubDate.getFullYear(); 
        const month = currentHubDate.getMonth();
        calHeader.textContent = currentHubDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const activeDates = new Set(receiptsData.map(r => r.date));
        
        calGrid.innerHTML = '';
        for (let i = 0; i < firstDay; i++) calGrid.innerHTML += `<div></div>`;
        
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            const hasData = activeDates.has(dateStr) ? 'has-data' : '';
            
            // Only show 'selected' if it matches today's actual date visually
            const today = new Date();
            const isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) ? 'selected' : '';
            
            const dayEl = document.createElement('div');
            dayEl.className = `cal-day ${hasData} ${isToday}`;
            dayEl.textContent = i;
            dayEl.onclick = () => openWorkspace(dateStr);
            calGrid.appendChild(dayEl);
        }
        calculateStats(year, month);
    }

    function calculateStats(year, month) {
        const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;
        const todayStr = new Date().toISOString().split('T')[0];
        
        let tToday = 0, tMonth = 0;
        receiptsData.forEach(r => {
            if (r.date === todayStr) tToday += Number(r.total_amount);
            if (r.date.startsWith(monthPrefix)) tMonth += Number(r.total_amount);
        });
        statToday.textContent = `₹${tToday}`; 
        statMonth.textContent = `₹${tMonth}`;
    }

    // === WORKSPACE TRANSITION ===
    function openWorkspace(dateStr) {
        selectedSessionDate = new Date(dateStr);
        activeSessionDateDisplay.textContent = formatDate(selectedSessionDate);
        D.dateIn.value = dateStr; 
        D.dateDisp.textContent = formatDate(selectedSessionDate);
        
        const nextSerial = receiptsData.length > 0 ? Math.max(...receiptsData.map(r => r.serial_no)) + 1 : 1;
        serialDisplay.textContent = `Entry #${nextSerial}`;
        switchView('workspace');
    }
    document.getElementById('back-to-hub-btn').onclick = () => { switchView('hub'); loadHubData(); }; // Reload stats on return

    // === FLAT SEARCH MODAL ===
    D.flatBtn.onclick = () => { searchModal.classList.remove('hidden'); renderFlatList(''); searchInput.focus(); };
    document.getElementById('close-flat-search').onclick = () => searchModal.classList.add('hidden');
    searchInput.addEventListener('input', (e) => renderFlatList(e.target.value));

    function renderFlatList(filter) {
        const lowerFilter = filter.toLowerCase();
        const filtered = flatsData.filter(f => f.flat_no.toLowerCase().includes(lowerFilter) || f.owner_name.toLowerCase().includes(lowerFilter));
        flatList.innerHTML = '';
        filtered.forEach(f => {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `<div class="list-item-title">${f.flat_no} ${f.is_rented ? '<span class="text-saffron">(R)</span>' : ''}</div>
                            <div class="list-item-sub">${f.owner_name} • ${f.phone_number || 'No Phone'}</div>`;
            li.onclick = () => selectFlat(f);
            flatList.appendChild(li);
        });
    }

    function selectFlat(flat) {
        currentSelectedFlatNo = flat.flat_no;
        D.flatBtn.innerHTML = `<span class="text-saffron bold-val px-1 rounded">${flat.flat_no}</span> Selected`;
        D.name.value = flat.owner_name;
        D.phone.value = flat.phone_number || '';
        D.baseFee.value = flat.usual_fee;
        D.isRented.checked = flat.is_rented;
        
        // Trigger live rented formatting
        handleRentedToggle(flat.is_rented);
        
        searchModal.classList.add('hidden');
        calculateMonths();
    }

    // === CUSTOM FORMATTING & LIVE UI LOGIC ===
    function formatDate(dateObj) { return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    function formatMonth(dateStr) {
        if(!dateStr) return 'MMM YYYY';
        const d = new Date(dateStr + '-01');
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    // Intercept native pickers
    D.dateIn.addEventListener('change', (e) => { 
        selectedSessionDate = new Date(e.target.value);
        D.dateDisp.textContent = formatDate(selectedSessionDate); 
        activeSessionDateDisplay.textContent = formatDate(selectedSessionDate);
    });
    D.mFromIn.addEventListener('change', (e) => { D.mFromDisp.textContent = formatMonth(e.target.value); calculateMonths(); });
    D.mToIn.addEventListener('change', (e) => { D.mToDisp.textContent = formatMonth(e.target.value); calculateMonths(); });

    // Live (R) Rented Toggle Visual Fix
    function handleRentedToggle(isChecked) {
        let name = D.name.value.replace(/^\(R\)\s*/, ''); 
        D.name.value = isChecked && name.length > 0 ? `(R) ${name}` : name;
    }
    D.isRented.addEventListener('change', (e) => handleRentedToggle(e.target.checked));

    D.toggle.addEventListener('change', (e) => {
        const editMode = e.target.checked;
        D.rcptNo.disabled = !editMode;
        D.rcptNo.placeholder = editMode ? "Enter Rcpt No" : "Auto";
        if (editMode) D.rcptNo.focus();
    });

    D.remarks.addEventListener('input', (e) => { D.charCount.textContent = `${e.target.value.length}/50`; });

    function calculateMonths() {
        if (!D.mFromIn.value || !D.mToIn.value) return;
        const d1 = new Date(D.mFromIn.value + '-01'); const d2 = new Date(D.mToIn.value + '-01');
        let m = (d2.getFullYear() - d1.getFullYear()) * 12 - d1.getMonth() + d2.getMonth() + 1;
        
        if (m > 0) {
            D.mCalc.textContent = `${m} Months`;
            D.mCalc.className = 'calc-text mt-xs text-success';
        } else {
            D.mCalc.textContent = "Invalid Range"; D.mCalc.className = 'calc-text mt-xs text-error';
        }
    }

    function calculateTotal() {
        const total = (parseFloat(D.cash.value) || 0) + (parseFloat(D.online.value) || 0);
        D.total.textContent = `₹${total}`;
    }
    D.cash.addEventListener('input', calculateTotal);
    D.online.addEventListener('input', calculateTotal);

    // === SUBMIT & UPDATE ===
    form.addEventListener('submit', async () => {
        if (!currentSelectedFlatNo) return alert("Select a flat first.");
        const cashAmt = parseFloat(D.cash.value) || 0;
        const onlineAmt = parseFloat(D.online.value) || 0;
        const totalAmt = cashAmt + onlineAmt;
        if (totalAmt === 0) return alert("Total cannot be zero.");

        document.getElementById('submit-receipt-btn').textContent = "Saving...";

        const rPayload = {
            flat_no: currentSelectedFlatNo,
            date: D.dateIn.value,
            months_covered: D.mFromIn.value === D.mToIn.value ? formatMonth(D.mFromIn.value) : `${formatMonth(D.mFromIn.value)} / ${formatMonth(D.mToIn.value)}`,
            cash_amount: cashAmt > 0 ? cashAmt : null,
            online_amount: onlineAmt > 0 ? onlineAmt : null,
            remarks: D.remarks.value
        };
        if (D.toggle.checked) rPayload.receipt_no = D.rcptNo.value;

        const fUpdates = {
            owner_name: D.name.value,
            phone_number: D.phone.value,
            usual_fee: parseFloat(D.baseFee.value),
            is_rented: D.isRented.checked
        };

        try {
            await DB.updateFlatMaster(currentSelectedFlatNo, fUpdates);
            const inserted = await DB.insertReceipt(rPayload);
            
            const flatIndex = flatsData.findIndex(f => f.flat_no === currentSelectedFlatNo);
            if(flatIndex > -1) flatsData[flatIndex] = { ...flatsData[flatIndex], ...fUpdates };
            receiptsData.push(inserted); 

            // Setup and trigger Success Modal
            document.getElementById('snapshot-text').textContent = `Rcpt: ${inserted.receipt_no} | ${D.name.value} | Total: ₹${totalAmt}`;
            successModal.classList.add('visible');
            
            // Set up WhatsApp Button
            document.getElementById('btn-whatsapp-share').onclick = () => {
                const cleanName = D.name.value.replace(/^\(R\)\s*/, '');
                const msg = `Hello ${cleanName},%0AYour maintenance payment of ₹${totalAmt} for Flat ${currentSelectedFlatNo} has been received successfully.%0AThank you!`;
                window.open(`https://wa.me/${D.phone.value}?text=${msg}`, '_blank');
            };

        } catch (e) {
            alert("Error saving data.");
            console.error(e);
        } finally {
            document.getElementById('submit-receipt-btn').textContent = "Log Entry";
        }
    });

    // Reset Form for next entry
    document.getElementById('modal-next-btn').onclick = () => {
        successModal.classList.remove('visible');
        currentSelectedFlatNo = null;
        D.flatBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span>Search Owner, Flat, or Bldg...</span>`;
        D.name.value = ""; D.phone.value = ""; D.baseFee.value = ""; D.isRented.checked = false;
        D.cash.value = ""; D.online.value = ""; D.total.textContent = "₹0";
        D.remarks.value = ""; D.charCount.textContent = "0/50";
        D.mFromIn.value = ""; D.mToIn.value = ""; 
        D.mFromDisp.textContent = "MMM YYYY"; D.mToDisp.textContent = "MMM YYYY"; D.mCalc.textContent = "0 Months";
        
        const nextSerial = receiptsData.length > 0 ? Math.max(...receiptsData.map(r => r.serial_no)) + 1 : 1;
        serialDisplay.textContent = `Entry #${nextSerial}`;
    };
});
