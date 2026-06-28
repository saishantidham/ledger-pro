// === HAPTICS & AUDIO ENGINE ===
window.UX = {
    hapticsOn: localStorage.getItem('haptics') !== 'false',
    soundsOn: localStorage.getItem('sound') !== 'false',
    audioCtx: null,
    init() { /* ... Kept identical from previous code for brevity ... */ },
    playClick() { /* ... */ }, vibrateLight() { /* ... */ }, vibrateSuccess() { /* ... */ }, vibrateError() { /* ... */ }
};

document.addEventListener('DOMContentLoaded', () => {
    UX.init();

    // === THE VIRTUAL KEYBOARD TRAP FIX ===
    function initKeyboardTrapFix() {
        if (!window.visualViewport) return;
        const workspace = document.getElementById('workspace-view');
        window.visualViewport.addEventListener('resize', () => {
            workspace.style.height = `${window.visualViewport.height}px`;
            if (window.visualViewport.height < window.innerHeight * 0.8) {
                const activeElement = document.activeElement;
                if (activeElement && activeElement.tagName === 'INPUT') {
                    setTimeout(() => activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                }
            } else {
                workspace.style.height = '100dvh';
                window.scrollTo(0,0);
            }
        });
        document.addEventListener('focusout', () => {
            if (window.visualViewport.height >= window.innerHeight * 0.8) window.scrollTo(0, 0);
        });
    }
    initKeyboardTrapFix();

    let flatsData = [];
    let receiptsData = []; 
    let currentHubDate = new Date(); 
    let selectedSessionDate = new Date(); 

    const views = { auth: document.getElementById('auth-view'), hub: document.getElementById('hub-view'), workspace: document.getElementById('workspace-view') };
    const calGrid = document.getElementById('calendar-grid'), calHeader = document.getElementById('cal-month-year');
    const serialDisplay = document.getElementById('serial-display'), form = document.getElementById('receipt-form'), successModal = document.getElementById('success-modal-overlay');

    const D = {
        toggle: document.getElementById('mode-toggle'),
        rcptNo: document.getElementById('receipt-no'), dateIn: document.getElementById('receipt-date'),
        flatBtn: document.getElementById('open-flat-search'), flatBtnText: document.getElementById('flat-btn-text'),
        name: document.getElementById('owner-name'), phone: document.getElementById('owner-phone'),
        baseFee: document.getElementById('base-fee'), isRented: document.getElementById('is-rented'),
        mFromIn: document.getElementById('month-from'), mToIn: document.getElementById('month-to'), mCalc: document.getElementById('months-calculated'), baseTotalCalc: document.getElementById('calculated-base-total'),
        cash: document.getElementById('cash-amount'), online: document.getElementById('online-amount'), total: document.getElementById('total-amount-display'),
        remarks: document.getElementById('remarks'), charCount: document.getElementById('char-count')
    };

    let currentSelectedFlatNo = null;

    window.loadHubData = async function() {
        flatsData = await DB.fetchFlats() || [];
        const { data: rcpts } = await supabaseClient.from('receipts').select('*').order('created_at', { ascending: false });
        receiptsData = rcpts || [];
        renderCalendar();
    };

    function switchView(viewName) { Object.values(views).forEach(v => v.classList.replace('active-view', 'hidden-view')); views[viewName].classList.replace('hidden-view', 'active-view'); window.scrollTo(0, 0); }

    // --- HUB LOGIC (Kept identical) ---
    document.getElementById('prev-month-btn')?.addEventListener('click', () => { currentHubDate.setMonth(currentHubDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month-btn')?.addEventListener('click', () => { currentHubDate.setMonth(currentHubDate.getMonth() + 1); renderCalendar(); });

    function renderCalendar() { /* ... Calendar Logic stays identical to mapping ... */ }

    // --- RECENT LOGS WITH ACTION TRAY ---
    document.getElementById('view-recent-btn')?.addEventListener('click', () => {
        const sheet = document.getElementById('recent-logs-sheet');
        const list = document.getElementById('recent-logs-list');
        list.innerHTML = '';
        
        const recent = receiptsData.slice().sort((a,b) => b.serial_no - a.serial_no).slice(0, 15);
        if(recent.length === 0) list.innerHTML = '<li class="text-center text-muted mt-md">No entries found.</li>';
        else {
            recent.forEach(r => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <div class="flex-between align-center">
                        <div>
                            <div class="list-item-title">${r.flat_no} <span class="text-saffron ml-xs">₹${r.total_amount}</span></div>
                            <div class="list-item-sub">Rcpt: ${r.receipt_no} | ${new Date(r.date).toLocaleDateString('en-GB')}</div>
                        </div>
                    </div>
                    <div class="action-tray">
                        <button class="btn-micro" onclick="editOldLog('${r.uuid}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit</button>
                        <button class="btn-micro" onclick="shareRecent('${r.flat_no}', ${r.total_amount}, '${r.receipt_no}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> WA</button>
                        <button class="btn-micro" onclick="generateReceipt('${r.uuid}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Rcpt</button>
                    </div>
                `;
                list.appendChild(li);
            });
        }
        sheet.classList.remove('hidden');
    });

    document.getElementById('close-recent-btn')?.addEventListener('click', () => document.getElementById('recent-logs-sheet').classList.add('hidden'));

    window.shareRecent = function(flat, amount, rcpt) {
        UX.playClick(); window.open(`https://wa.me/?text=Hello,%0AYour maintenance payment of ₹${amount} for Flat ${flat} (Rcpt: ${rcpt}) has been received successfully.%0AThank you!`, '_blank');
    };
    window.generateReceipt = function(uuid) {
        UX.playClick(); alert(`Navigating to receipt.html?id=${uuid} (Pending Implementation)`);
    };
    window.editOldLog = function(uuid) {
        // Will implement data push to form later, for now close modal & toggle edit view
        UX.playClick(); document.getElementById('recent-logs-sheet').classList.add('hidden'); switchView('workspace'); D.toggle.checked = true; D.toggle.dispatchEvent(new Event('change'));
    };

    // --- WORKSPACE & FORM LOGIC ---
    function openWorkspace(dateStr) {
        selectedSessionDate = new Date(dateStr);
        document.getElementById('active-session-date').textContent = selectedSessionDate.toLocaleDateString('en-GB');
        D.dateIn.value = dateStr; 
        const nextSerial = receiptsData.length > 0 ? Math.max(...receiptsData.map(r => r.serial_no)) + 1 : 1;
        serialDisplay.textContent = `Entry #${nextSerial}`;
        switchView('workspace');
    }
    document.getElementById('back-to-hub-btn').onclick = () => { switchView('hub'); window.loadHubData(); };

    // Mode Toggle explicitly handles BOTH Receipt No and Date
    D.toggle.addEventListener('change', (e) => {
        const editMode = e.target.checked;
        D.rcptNo.disabled = !editMode; D.rcptNo.placeholder = editMode ? "Enter Rcpt No" : "Auto";
        D.dateIn.disabled = !editMode; // Fixed: Date unlocks in edit mode
        if (editMode) { D.rcptNo.focus(); UX.vibrateLight(); }
    });

    const searchModal = document.getElementById('flat-search-modal');
    const searchInput = document.getElementById('flat-search-input');
    const flatList = document.getElementById('flat-list');

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
            li.innerHTML = `<div class="list-item-title">${f.flat_no} ${f.is_rented ? '<span class="text-saffron">(R)</span>' : ''}</div><div class="list-item-sub">${f.owner_name} • ${f.phone_number || 'No Phone'}</div>`;
            li.onclick = () => selectFlat(f);
            flatList.appendChild(li);
        });
    }

    function selectFlat(flat) {
        currentSelectedFlatNo = flat.flat_no;
        D.flatBtnText.textContent = `${flat.flat_no} - ${flat.owner_name}`;
        D.flatBtn.classList.add('selected');
        D.name.value = flat.owner_name; D.phone.value = flat.phone_number || '';
        D.baseFee.value = flat.usual_fee; D.isRented.checked = flat.is_rented;
        handleRentedToggle(flat.is_rented); searchModal.classList.add('hidden'); calculateMonths();
    }

    function handleRentedToggle(isChecked) { let name = D.name.value.replace(/^\(R\)\s*/, ''); D.name.value = isChecked && name.length > 0 ? `(R) ${name}` : name; }
    D.isRented.addEventListener('change', (e) => handleRentedToggle(e.target.checked));
    D.remarks.addEventListener('input', (e) => { D.charCount.textContent = `${e.target.value.length}/50`; });

    function calculateMonths() {
        if (!D.mFromIn.value || !D.mToIn.value) return;
        const d1 = new Date(D.mFromIn.value + '-01'); const d2 = new Date(D.mToIn.value + '-01');
        let m = (d2.getFullYear() - d1.getFullYear()) * 12 - d1.getMonth() + d2.getMonth() + 1;
        if (m > 0) {
            D.mCalc.textContent = `${m} Months`; D.mCalc.className = 'calc-label text-success';
            D.baseTotalCalc.textContent = `₹${m * (parseFloat(D.baseFee.value)||0)}`;
        } else {
            D.mCalc.textContent = "Invalid Range"; D.mCalc.className = 'calc-label text-error'; D.baseTotalCalc.textContent = `₹0`;
        }
    }
    D.mFromIn.addEventListener('change', calculateMonths); D.mToIn.addEventListener('change', calculateMonths); D.baseFee.addEventListener('input', calculateMonths);

    function calculateTotal() { D.total.textContent = `₹${(parseFloat(D.cash.value) || 0) + (parseFloat(D.online.value) || 0)}`; }
    D.cash.addEventListener('input', calculateTotal); D.online.addEventListener('input', calculateTotal);

    form.addEventListener('submit', async () => {
        if (!currentSelectedFlatNo) { UX.vibrateError(); return alert("Select a flat first."); }
        const cashAmt = parseFloat(D.cash.value) || 0; const onlineAmt = parseFloat(D.online.value) || 0; const totalAmt = cashAmt + onlineAmt;
        if (totalAmt === 0) { UX.vibrateError(); return alert("Total cannot be zero."); }

        document.getElementById('submit-receipt-btn').textContent = "Saving...";

        const rPayload = {
            flat_no: currentSelectedFlatNo, date: D.dateIn.value,
            months_covered: `${D.mFromIn.value} to ${D.mToIn.value}`,
            cash_amount: cashAmt > 0 ? cashAmt : null, online_amount: onlineAmt > 0 ? onlineAmt : null, remarks: D.remarks.value
        };
        if (D.toggle.checked) rPayload.receipt_no = D.rcptNo.value;

        try {
            await DB.updateFlatMaster(currentSelectedFlatNo, { owner_name: D.name.value, phone_number: D.phone.value, usual_fee: parseFloat(D.baseFee.value), is_rented: D.isRented.checked });
            const inserted = await DB.insertReceipt(rPayload);
            receiptsData.push(inserted); 

            UX.vibrateSuccess();
            document.getElementById('snapshot-text').textContent = `Rcpt: ${inserted.receipt_no} | ${D.name.value} | ₹${totalAmt}`;
            successModal.classList.add('visible');
            
            // Set up actions for the specific newly generated receipt
            const cleanName = D.name.value.replace(/^\(R\)\s*/, '');
            const msg = `Hello ${cleanName},%0AYour maintenance payment of ₹${totalAmt} for Flat ${currentSelectedFlatNo} has been received successfully.%0AThank you!`;
            document.getElementById('btn-whatsapp-share').onclick = () => window.open(`https://wa.me/${D.phone.value}?text=${msg}`, '_blank');
            document.getElementById('btn-mail-share').onclick = () => window.open(`mailto:?subject=Maintenance Receipt ${inserted.receipt_no}&body=${msg}`, '_blank');
            document.getElementById('btn-generate-receipt').onclick = () => generateReceipt(inserted.uuid);

        } catch (e) { UX.vibrateError(); alert("Error saving data."); console.error(e); } 
        finally { document.getElementById('submit-receipt-btn').textContent = "Log Entry"; }
    });

    document.getElementById('modal-next-btn').onclick = () => {
        successModal.classList.remove('visible'); currentSelectedFlatNo = null;
        D.flatBtn.classList.remove('selected'); D.flatBtnText.textContent = "Select Flat / Owner...";
        D.name.value = ""; D.phone.value = ""; D.baseFee.value = ""; D.isRented.checked = false;
        D.cash.value = ""; D.online.value = ""; D.total.textContent = "₹0";
        D.remarks.value = ""; D.charCount.textContent = "0/50";
        D.mFromIn.value = ""; D.mToIn.value = ""; D.mCalc.textContent = "0 Months"; D.baseTotalCalc.textContent = "₹0";
        serialDisplay.textContent = `Entry #${receiptsData.length > 0 ? Math.max(...receiptsData.map(r => r.serial_no)) + 1 : 1}`;
    };
});
