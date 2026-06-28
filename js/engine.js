document.addEventListener('DOMContentLoaded', () => {
    // === APP STATE ===
    let flatsData = [];
    let receiptsData = []; // To find active calendar dates and get Serial #
    let selectedSessionDate = new Date();

    // === DOM ELEMENTS ===
    const views = { auth: document.getElementById('auth-view'), hub: document.getElementById('hub-view'), workspace: document.getElementById('workspace-view') };
    const authBtn = document.getElementById('login-btn');
    
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

    // === 1. AUTH & INIT ===
    async function initApp() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) await loadHubData();
        else switchView('auth');
    }
    
    authBtn.addEventListener('click', async () => {
        authBtn.textContent = '...';
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        });
        if (error) { alert("Invalid credentials."); authBtn.textContent = 'Sign In'; }
        else await loadHubData();
    });

    function switchView(viewName) {
        Object.values(views).forEach(v => v.classList.replace('active-view', 'hidden-view'));
        views[viewName].classList.replace('hidden-view', 'active-view');
    }

    // === 2. HUB & CALENDAR LOGIC ===
    async function loadHubData() {
        switchView('hub');
        // Fetch Master Data
        flatsData = await DB.fetchFlats() || [];
        
        // Fetch Receipt metadata for calendar dots and serial number
        const { data: rcpts } = await supabaseClient.from('receipts').select('date, total_amount, serial_no');
        receiptsData = rcpts || [];

        renderCalendar();
        calculateStats();
    }

    function renderCalendar() {
        const now = new Date();
        const year = now.getFullYear(); const month = now.getMonth();
        calHeader.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Get unique dates that have receipts
        const activeDates = new Set(receiptsData.map(r => r.date));
        
        calGrid.innerHTML = '';
        for (let i = 0; i < firstDay; i++) calGrid.innerHTML += `<div></div>`;
        
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            const hasData = activeDates.has(dateStr) ? 'has-data' : '';
            const isToday = i === now.getDate() ? 'selected' : '';
            
            const dayEl = document.createElement('div');
            dayEl.className = `cal-day ${hasData} ${isToday}`;
            dayEl.textContent = i;
            dayEl.onclick = () => openWorkspace(dateStr);
            calGrid.appendChild(dayEl);
        }
    }

    function calculateStats() {
        const todayStr = new Date().toISOString().split('T')[0];
        const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM
        
        let tToday = 0, tMonth = 0;
        receiptsData.forEach(r => {
            if (r.date === todayStr) tToday += Number(r.total_amount);
            if (r.date.startsWith(currentMonthPrefix)) tMonth += Number(r.total_amount);
        });
        statToday.textContent = `₹${tToday}`; statMonth.textContent = `₹${tMonth}`;
    }

    // === 3. WORKSPACE TRANSITION ===
    function openWorkspace(dateStr) {
        selectedSessionDate = new Date(dateStr);
        activeSessionDateDisplay.textContent = formatDate(selectedSessionDate);
        D.dateIn.value = dateStr; D.dateDisp.textContent = formatDate(selectedSessionDate);
        
        // Setup Serial Number
        const nextSerial = receiptsData.length > 0 ? Math.max(...receiptsData.map(r => r.serial_no)) + 1 : 1;
        serialDisplay.textContent = `Entry #${nextSerial}`;

        switchView('workspace');
    }
    document.getElementById('back-to-hub-btn').onclick = () => switchView('hub');

    // === 4. FLAT SEARCH MODAL ===
    D.flatBtn.onclick = () => { searchModal.classList.remove('hidden'); renderFlatList(''); searchInput.focus(); };
    document.getElementById('close-flat-search').onclick = () => searchModal.classList.add('hidden');
    
    searchInput.addEventListener('input', (e) => renderFlatList(e.target.value));

    function renderFlatList(filter) {
        const lowerFilter = filter.toLowerCase();
        const filtered = flatsData.filter(f => 
            f.flat_no.toLowerCase().includes(lowerFilter) || 
            f.owner_name.toLowerCase().includes(lowerFilter)
        );
        
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
        
        searchModal.classList.add('hidden');
        calculateMonths(); // Recalculate if dates are already picked
    }

    // === 5. CUSTOM FORMATTING & MATH LOGIC ===
    function formatDate(dateObj) {
        return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    function formatMonth(dateStr) { // Takes YYYY-MM
        if(!dateStr) return 'MMM YYYY';
        const d = new Date(dateStr + '-01');
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    // Intercept native date/month pickers to update the pretty display overlays
    D.dateIn.addEventListener('change', (e) => { D.dateDisp.textContent = formatDate(new Date(e.target.value)); });
    D.mFromIn.addEventListener('change', (e) => { D.mFromDisp.textContent = formatMonth(e.target.value); calculateMonths(); });
    D.mToIn.addEventListener('change', (e) => { D.mToDisp.textContent = formatMonth(e.target.value); calculateMonths(); });

    // Historical Edit Toggle
    D.toggle.addEventListener('change', (e) => {
        const editMode = e.target.checked;
        D.rcptNo.disabled = !editMode;
        D.rcptNo.placeholder = editMode ? "Enter Rcpt No" : "Auto";
        if (editMode) D.rcptNo.focus();
    });

    // Remarks Counter
    D.remarks.addEventListener('input', (e) => { D.charCount.textContent = `${e.target.value.length}/50`; });

    function calculateMonths() {
        if (!D.mFromIn.value || !D.mToIn.value) return;
        const d1 = new Date(D.mFromIn.value + '-01'); const d2 = new Date(D.mToIn.value + '-01');
        let m = (d2.getFullYear() - d1.getFullYear()) * 12 - d1.getMonth() + d2.getMonth() + 1;
        
        if (m > 0) {
            D.mCalc.textContent = `${m} Months`;
            D.mCalc.className = 'calc-text mt-xs text-success';
            const base = parseFloat(D.baseFee.value) || 0;
            // Leave cash/online at 0 as requested, but we *could* auto-fill online if we wanted.
            calculateTotal();
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

    // === 6. SUBMIT & UPDATE MASTER DATA ===
    form.addEventListener('submit', async () => {
        if (!currentSelectedFlatNo) return alert("Select a flat first.");
        const cashAmt = parseFloat(D.cash.value) || 0;
        const onlineAmt = parseFloat(D.online.value) || 0;
        if (cashAmt + onlineAmt === 0) return alert("Total cannot be zero.");

        document.getElementById('submit-receipt-btn').textContent = "Saving...";

        // 1. Prepare Receipt Payload mapping EXACTLY to Excel format needs
        // Note: 'payment method' is derived logic for excel later (if cash > 0 ? 'Cash' : 'Online')
        // 'bldg number' will be derived during excel generation by splitting flat_no on '-'.
        
        const rPayload = {
            flat_no: currentSelectedFlatNo,
            date: D.dateIn.value,
            months_covered: D.mFromIn.value === D.mToIn.value ? formatMonth(D.mFromIn.value) : `${formatMonth(D.mFromIn.value)} / ${formatMonth(D.mToIn.value)}`,
            cash_amount: cashAmt > 0 ? cashAmt : null, // Keeps 0s blank in DB/Excel as requested
            online_amount: onlineAmt > 0 ? onlineAmt : null,
            remarks: D.remarks.value
        };
        if (D.toggle.checked) rPayload.receipt_no = D.rcptNo.value;

        // 2. Prepare Master Data Update (Saves edited fields)
        const fUpdates = {
            owner_name: D.name.value,
            phone_number: D.phone.value,
            usual_fee: parseFloat(D.baseFee.value),
            is_rented: D.isRented.checked
        };

        try {
            // Run both updates simultaneously
            await DB.updateFlatMaster(currentSelectedFlatNo, fUpdates);
            const inserted = await DB.insertReceipt(rPayload);
            
            // Sync local data so we don't have to reload from DB
            const flatIndex = flatsData.findIndex(f => f.flat_no === currentSelectedFlatNo);
            if(flatIndex > -1) flatsData[flatIndex] = { ...flatsData[flatIndex], ...fUpdates };
            receiptsData.push(inserted); // updates serial count for next entry

            // Show Success Modal
            const prefix = D.isRented.checked ? '(R) ' : '';
            document.getElementById('snapshot-text').textContent = `Rcpt: ${inserted.receipt_no} | ${prefix}${D.name.value} | Total: ₹${inserted.total_amount}`;
            successModal.classList.remove('hidden');
            
        } catch (e) {
            alert("Error saving data.");
            console.error(e);
        } finally {
            document.getElementById('submit-receipt-btn').textContent = "Log Entry";
        }
    });

    // Reset Form
    document.getElementById('modal-next-btn').onclick = () => {
        successModal.classList.add('hidden');
        currentSelectedFlatNo = null;
        D.flatBtn.textContent = "🔍 Search Owner, Flat, or Bldg...";
        D.name.value = ""; D.phone.value = ""; D.baseFee.value = ""; D.isRented.checked = false;
        D.cash.value = ""; D.online.value = ""; D.total.textContent = "₹0";
        D.remarks.value = ""; D.charCount.textContent = "0/50";
        D.mFromIn.value = ""; D.mToIn.value = ""; 
        D.mFromDisp.textContent = "MMM YYYY"; D.mToDisp.textContent = "MMM YYYY"; D.mCalc.textContent = "0 Months";
        
        // Increment UI Serial
        const nextSerial = receiptsData.length > 0 ? Math.max(...receiptsData.map(r => r.serial_no)) + 1 : 1;
        serialDisplay.textContent = `Entry #${nextSerial}`;
    };

    initApp();
});
