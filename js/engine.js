// === HAPTICS & AUDIO ENGINE (Native Web Audio API) ===
window.UX = {
    hapticsOn: localStorage.getItem('haptics') !== 'false',
    soundsOn: localStorage.getItem('sound') !== 'false',
    audioCtx: null,

    init() {
        const tHaptics = document.getElementById('toggle-haptics');
        const tSounds = document.getElementById('toggle-sounds');
        if(tHaptics) {
            tHaptics.checked = this.hapticsOn;
            tHaptics.onchange = (e) => { this.hapticsOn = e.target.checked; localStorage.setItem('haptics', this.hapticsOn); }
        }
        if(tSounds) {
            tSounds.checked = this.soundsOn;
            tSounds.onchange = (e) => { this.soundsOn = e.target.checked; localStorage.setItem('sound', this.soundsOn); }
        }

        document.addEventListener('click', (e) => {
            const isClickable = e.target.tagName === 'BUTTON' || e.target.closest('.icon-btn') || e.target.closest('.cal-day');
            if (isClickable) { this.playClick(); this.vibrateLight(); }
        }, { capture: true });
    },

    playClick() {
        if(!this.soundsOn) return;
        try {
            if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain); gain.connect(this.audioCtx.destination);
            
            osc.type = 'sine'; osc.frequency.setValueAtTime(600, this.audioCtx.currentTime); 
            gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);
            
            osc.start(this.audioCtx.currentTime); osc.stop(this.audioCtx.currentTime + 0.05);
        } catch(e) { console.warn("Audio block:", e); }
    },
    vibrateLight() { if(this.hapticsOn && navigator.vibrate) navigator.vibrate([15]); },
    vibrateSuccess() { if(this.hapticsOn && navigator.vibrate) navigator.vibrate([30, 50, 30]); },
    vibrateError() { if(this.hapticsOn && navigator.vibrate) navigator.vibrate([50, 50, 50]); }
};

document.addEventListener('DOMContentLoaded', () => {
    UX.init();

    function initKeyboardTrapFix() {
        if (!window.visualViewport) return;
        const workspace = document.getElementById('workspace-view');
        
        window.visualViewport.addEventListener('resize', () => {
            workspace.style.height = `${window.visualViewport.height}px`;
            if (window.visualViewport.height < window.innerHeight * 0.8) {
                const activeElement = document.activeElement;
                if (activeElement && activeElement.tagName === 'INPUT') {
                    setTimeout(() => { activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
                }
            } else {
                workspace.style.height = '100dvh'; window.scrollTo(0,0);
            }
        });
        document.addEventListener('focusout', () => { if (window.visualViewport.height >= window.innerHeight * 0.8) { window.scrollTo(0, 0); } });
    }
    initKeyboardTrapFix();

    let flatsData = [];
    let receiptsData = []; 
    let currentHubDate = new Date(); 
    let selectedSessionDate = new Date(); 
    let currentCalculatedMonths = 0; 

    const views = { auth: document.getElementById('auth-view'), hub: document.getElementById('hub-view'), workspace: document.getElementById('workspace-view') };
    const calGrid = document.getElementById('calendar-grid');
    const calHeader = document.getElementById('cal-month-year');
    const activeSessionDateDisplay = document.getElementById('active-session-date');
    const serialDisplay = document.getElementById('serial-display');
    const form = document.getElementById('receipt-form');
    const successModal = document.getElementById('success-modal-overlay');

    const D = {
        toggle: document.getElementById('mode-toggle'),
        rcptNo: document.getElementById('receipt-no'), dateIn: document.getElementById('receipt-date'), 
        flatBtn: document.getElementById('open-flat-search'), flatBtnText: document.getElementById('flat-btn-text'),
        name: document.getElementById('owner-name'), phone: document.getElementById('owner-phone'),
        baseFee: document.getElementById('base-fee'), isRented: document.getElementById('is-rented'),
        mFromIn: document.getElementById('month-from'), mFromDisp: document.getElementById('display-month-from'),
        mToIn: document.getElementById('month-to'), mToDisp: document.getElementById('display-month-to'),
        mCalc: document.getElementById('months-calculated'), baseTotalCalc: document.getElementById('calculated-base-total'),
        cash: document.getElementById('cash-amount'), online: document.getElementById('online-amount'),
        total: document.getElementById('total-amount-display'),
        remarks: document.getElementById('remarks'), charCount: document.getElementById('char-count')
    };

    let currentSelectedFlatNo = null;

    const waMsgInput = document.getElementById('wa-default-msg');
    const defaultTemplate = "Hello {name},\nYour maintenance payment of ₹{amount} for Flat {flat} (Rcpt: {rcpt}) has been received successfully.\nReceipt: {link}\nThank you!";
    
    if(waMsgInput) {
        waMsgInput.value = localStorage.getItem('waTemplate') || defaultTemplate;
        waMsgInput.addEventListener('input', (e) => localStorage.setItem('waTemplate', e.target.value));
    }

    function buildWhatsAppMsg(name, amount, flat, rcpt, uuid) {
        let template = localStorage.getItem('waTemplate') || defaultTemplate;
        const basePath = window.location.origin + window.location.pathname.replace('index.html', '');
        const receiptLink = `${basePath}receipt.html?id=${uuid}`;
        
        return encodeURIComponent(
            template.replace('{name}', name).replace('{amount}', amount).replace('{flat}', flat).replace('{rcpt}', rcpt).replace('{link}', receiptLink)
        );
    }

    function updateNextReceiptPlaceholder() {
        if (!receiptsData || receiptsData.length === 0) {
            D.rcptNo.placeholder = "Auto (14000)";
            return;
        }
        let max = 0;
        receiptsData.forEach(r => {
            let num = parseInt(r.receipt_no);
            if (!isNaN(num) && num > max) max = num;
        });
        D.rcptNo.placeholder = max > 0 ? `Auto (${max + 1})` : "Auto (14000)";
    }

    window.loadHubData = async function() {
        try {
            flatsData = await DB.fetchFlats() || [];
            const { data: rcpts, error } = await supabaseClient.from('receipts')
                .select('*')
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            receiptsData = rcpts || [];
            updateNextReceiptPlaceholder();
            renderCalendar();

            const nextSerial = receiptsData.length > 0 ? Math.max(...receiptsData.map(r => Number(r.serial_no) || 0)) + 1 : 1;
            if (serialDisplay) serialDisplay.textContent = `Entry #${nextSerial}`;
        } catch (err) {
            console.error("Database fetch error:", err);
        }
    };

    function switchView(viewName) {
        Object.values(views).forEach(v => v.classList.replace('active-view', 'hidden-view'));
        views[viewName].classList.replace('hidden-view', 'active-view');
        window.scrollTo(0, 0);
    }

    document.getElementById('hub-settings-btn').addEventListener('click', () => {
        UX.playClick(); document.getElementById('settings-sheet').classList.remove('hidden');
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
        UX.playClick(); document.getElementById('settings-sheet').classList.add('hidden');
    });

    document.getElementById('prev-month-btn')?.addEventListener('click', () => { currentHubDate.setMonth(currentHubDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month-btn')?.addEventListener('click', () => { currentHubDate.setMonth(currentHubDate.getMonth() + 1); renderCalendar(); });

    function renderCalendar() {
        if(!calGrid) return;
        const year = currentHubDate.getFullYear(); const month = currentHubDate.getMonth();
        calHeader.textContent = currentHubDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const activeDates = new Set(receiptsData.map(r => r.date));
        
        calGrid.innerHTML = '';
        for (let i = 0; i < firstDay; i++) calGrid.innerHTML += `<div></div>`;
        
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            const hasData = activeDates.has(dateStr) ? 'has-data' : '';
            const isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) ? 'selected' : '';
            
            const dayEl = document.createElement('div');
            dayEl.className = `cal-day ${hasData} ${isToday}`;
            dayEl.textContent = i;
            dayEl.onclick = () => openWorkspace(dateStr); 
            calGrid.appendChild(dayEl);
        }
        
        let tToday = 0, tMonth = 0;
        const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;
        const todayStr = today.toISOString().split('T')[0];
        
        receiptsData.forEach(r => {
            if (r.date === todayStr) tToday += Number(r.total_amount || 0);
            if (r.date.startsWith(monthPrefix)) tMonth += Number(r.total_amount || 0);
        });
        document.getElementById('stat-today').textContent = `₹${tToday}`; 
        document.getElementById('stat-month').textContent = `₹${tMonth}`;
    }

    document.getElementById('view-recent-btn')?.addEventListener('click', () => {
        const sheet = document.getElementById('recent-logs-sheet');
        const list = document.getElementById('recent-logs-list');
        list.innerHTML = '';
        
        const recent = receiptsData.slice().sort((a,b) => b.serial_no - a.serial_no).slice(0, 15);
        if(recent.length === 0) {
            list.innerHTML = '<li class="text-center text-muted mt-md">No entries found.</li>';
        } else {
            recent.forEach(r => {
                let pendingStr = "";
                let pAmt = Number(r.pending_amount);
                if (pAmt > 0) pendingStr = `<span style="color:#D32F2F; font-size:10px;">Due: ₹${pAmt}</span>`;
                if (pAmt < 0) pendingStr = `<span style="color:#2E7D32; font-size:10px;">Adv: ₹${Math.abs(pAmt)}</span>`;

                const li = document.createElement('li');
                li.className = 'list-item flex-between align-center';
                li.innerHTML = `
                    <div style="flex: 1;">
                        <div class="list-item-title">${r.flat_no} <span class="text-saffron font-semibold ml-xs">₹${r.total_amount || 0}</span></div>
                        <div class="list-item-sub" style="display:flex; justify-content:space-between; padding-right: 1rem;">
                            <span>Rcpt: ${r.receipt_no} | ${new Date(r.date).toLocaleDateString('en-GB')}</span>
                            ${pendingStr}
                        </div>
                        <div class="action-tray">
                            <button class="btn-micro" onclick="editOldLog('${r.uuid}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit</button>
                            <button class="btn-micro" onclick="shareRecent('${r.flat_no}', ${r.total_amount || 0}, '${r.receipt_no}', '${r.uuid}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> WA</button>
                            <button class="btn-micro" onclick="generateReceipt('${r.uuid}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Rcpt</button>
                        </div>
                    </div>
                `;
                list.appendChild(li);
            });
        }
        sheet.classList.remove('hidden');
    });

    document.getElementById('close-recent-btn')?.addEventListener('click', () => { document.getElementById('recent-logs-sheet').classList.add('hidden'); });

    // === WHATSAPP SHARE FIX ===
    window.shareRecent = function(flat, amount, rcpt, uuid) {
        UX.playClick();
        const flatData = flatsData.find(f => f.flat_no === flat);
        const ownerName = flatData ? flatData.owner_name.replace(/^\(R\)\s*/, '') : 'Resident';
        const msg = buildWhatsAppMsg(ownerName, amount, flat, rcpt, uuid);
        
        let waLink = `https://wa.me/?text=${msg}`; // Fallback general share
        
        if (flatData && flatData.phone_number) {
            let phone = flatData.phone_number.replace(/\D/g, ''); // Remove spaces/symbols
            if (phone.length === 10) phone = '91' + phone; // Add India code
            if (phone.length > 5) waLink = `https://wa.me/${phone}?text=${msg}`; // Direct user share
        }
        window.open(waLink, '_blank');
    };

    window.generateReceipt = function(uuid) {
        UX.playClick(); window.open(`receipt.html?id=${uuid}`, '_blank');
    };

    window.editOldLog = function(uuid) {
        UX.playClick(); document.getElementById('recent-logs-sheet').classList.add('hidden'); switchView('workspace'); D.toggle.checked = true; D.toggle.dispatchEvent(new Event('change'));
    };

    function openWorkspace(dateStr) {
        selectedSessionDate = new Date(dateStr);
        activeSessionDateDisplay.textContent = selectedSessionDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        D.dateIn.value = dateStr; 
        
        updateNextReceiptPlaceholder();
        switchView('workspace');
    }
    document.getElementById('back-to-hub-btn').onclick = () => { switchView('hub'); window.loadHubData(); };

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
            li.innerHTML = `<div class="list-item-title">${f.flat_no} ${f.is_rented ? '<span class="text-saffron">(R)</span>' : ''}</div>
                            <div class="list-item-sub">${f.owner_name} • ${f.phone_number || 'No Phone'}</div>`;
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

    function formatMonthStr(dateStr) {
        if(!dateStr) return 'MMM YYYY';
        return new Date(dateStr + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    D.dateIn.addEventListener('change', (e) => { 
        selectedSessionDate = new Date(e.target.value);
        activeSessionDateDisplay.textContent = selectedSessionDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    });

    function handleRentedToggle(isChecked) {
        let name = D.name.value.replace(/^\(R\)\s*/, ''); 
        D.name.value = isChecked && name.length > 0 ? `(R) ${name}` : name;
    }
    D.isRented.addEventListener('change', (e) => handleRentedToggle(e.target.checked));

    D.toggle.addEventListener('change', (e) => {
        const editMode = e.target.checked;
        D.rcptNo.disabled = !editMode;
        if (editMode) {
            D.rcptNo.placeholder = "Enter Rcpt No";
            D.rcptNo.focus();
            UX.vibrateLight();
        } else {
            updateNextReceiptPlaceholder();
        }
        D.dateIn.disabled = !editMode;
    });

    D.remarks.addEventListener('input', (e) => { D.charCount.textContent = `${e.target.value.length}/50`; });

    function calculateMonths() {
        if (!D.mFromIn.value || !D.mToIn.value) {
            currentCalculatedMonths = 0;
            D.mCalc.textContent = "0 Months";
            D.baseTotalCalc.textContent = "₹0";
            return;
        }
        const d1 = new Date(D.mFromIn.value + '-01'); 
        const d2 = new Date(D.mToIn.value + '-01');
        
        let m = (d2.getFullYear() - d1.getFullYear()) * 12 - d1.getMonth() + d2.getMonth() + 1;
        
        const fee = parseFloat(D.baseFee.value) || 0;

        if (m > 0) {
            currentCalculatedMonths = m;
            D.mCalc.textContent = `${m} Months`; 
            D.mCalc.className = 'calc-label text-success';
            D.baseTotalCalc.textContent = `₹${m * fee}`;
        } else {
            currentCalculatedMonths = 0;
            D.mCalc.textContent = "Invalid Range"; 
            D.mCalc.className = 'calc-label text-error'; 
            D.baseTotalCalc.textContent = `₹0`;
        }
    }
    
    D.mFromIn.addEventListener('change', (e) => { D.mFromDisp.textContent = formatMonthStr(e.target.value); D.mFromDisp.classList.remove('text-muted'); calculateMonths(); }); 
    D.mToIn.addEventListener('change', (e) => { D.mToDisp.textContent = formatMonthStr(e.target.value); D.mToDisp.classList.remove('text-muted'); calculateMonths(); });
    D.baseFee.addEventListener('input', calculateMonths);

    function calculateTotal() { D.total.textContent = `₹${(parseFloat(D.cash.value) || 0) + (parseFloat(D.online.value) || 0)}`; }
    D.cash.addEventListener('input', calculateTotal); D.online.addEventListener('input', calculateTotal);

    form.addEventListener('submit', async () => {
        if (!currentSelectedFlatNo) { UX.vibrateError(); return alert("Select a flat first."); }
        const cashAmt = parseFloat(D.cash.value) || 0; 
        const onlineAmt = parseFloat(D.online.value) || 0; 
        const totalAmt = cashAmt + onlineAmt;
        if (totalAmt === 0) { UX.vibrateError(); return alert("Total cannot be zero."); }

        let actualMonthsCount = currentCalculatedMonths > 0 ? currentCalculatedMonths : 1;
        const baseFee = parseFloat(D.baseFee.value) || 0;
        const expectedTotal = actualMonthsCount * baseFee;
        const pendingAmt = expectedTotal - totalAmt; 

        document.getElementById('submit-receipt-btn').textContent = "Saving...";

        const rPayload = {
            flat_no: currentSelectedFlatNo, date: D.dateIn.value,
            months_covered: (D.mFromIn.value && D.mToIn.value) ? `${formatMonthStr(D.mFromIn.value)} to ${formatMonthStr(D.mToIn.value)}` : 'N/A',
            months_count: actualMonthsCount,
            pending_amount: pendingAmt,
            cash_amount: cashAmt, online_amount: onlineAmt, remarks: D.remarks.value
        };
        if (D.toggle.checked && D.rcptNo.value) rPayload.receipt_no = D.rcptNo.value;

        try {
            await DB.updateFlatMaster(currentSelectedFlatNo, { owner_name: D.name.value, phone_number: D.phone.value, usual_fee: parseFloat(D.baseFee.value), is_rented: D.isRented.checked });
            const inserted = await DB.insertReceipt(rPayload);
            receiptsData.push(inserted); 

            UX.vibrateSuccess();
            document.getElementById('snapshot-text').textContent = `Rcpt: ${inserted.receipt_no} | ${D.name.value} | ₹${totalAmt}`;
            successModal.classList.remove('hidden');
            successModal.classList.add('visible');
            
            const cleanName = D.name.value.replace(/^\(R\)\s*/, '');
            const msg = buildWhatsAppMsg(cleanName, totalAmt, currentSelectedFlatNo, inserted.receipt_no, inserted.uuid);
            
            // === WHATSAPP SUBMIT SHARE FIX ===
            let waPhone = D.phone.value.replace(/\D/g, '');
            if (waPhone.length === 10) waPhone = '91' + waPhone;
            const waLink = waPhone.length > 5 ? `https://wa.me/${waPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
            
            document.getElementById('btn-whatsapp-share').onclick = () => window.open(waLink, '_blank');
            // =================================

            document.getElementById('btn-mail-share').onclick = () => window.open(`mailto:?subject=Maintenance Receipt ${inserted.receipt_no}&body=${msg}`, '_blank');
            document.getElementById('btn-generate-receipt').onclick = () => generateReceipt(inserted.uuid);

        } catch (e) { 
            UX.vibrateError(); 
            alert("Error saving data. Make sure you are logged in."); 
            console.error(e); 
        } 
        finally { 
            document.getElementById('submit-receipt-btn').textContent = "Log Entry"; 
            updateNextReceiptPlaceholder(); 
        }
    });

    document.getElementById('modal-next-btn').onclick = async () => {
        successModal.classList.add('hidden');
        successModal.classList.remove('visible');
        
        currentSelectedFlatNo = null;
        currentCalculatedMonths = 0;
        D.flatBtn.classList.remove('selected'); D.flatBtnText.textContent = "Select Flat / Owner...";
        D.name.value = ""; D.phone.value = ""; D.baseFee.value = ""; D.isRented.checked = false;
        D.cash.value = ""; D.online.value = ""; D.total.textContent = "₹0";
        D.remarks.value = ""; D.charCount.textContent = "0/50";
        D.mFromIn.value = ""; D.mToIn.value = ""; 
        D.mFromDisp.textContent = "MMM YYYY"; D.mFromDisp.classList.add('text-muted');
        D.mToDisp.textContent = "MMM YYYY"; D.mToDisp.classList.add('text-muted');
        D.mCalc.textContent = "0 Months"; D.baseTotalCalc.textContent = "₹0";
        
        if (D.toggle.checked) { 
            D.toggle.checked = false; 
            D.toggle.dispatchEvent(new Event('change')); 
        }
        
        const formContainer = document.querySelector('.ultra-compact-form');
        if (formContainer) formContainer.scrollTo({ top: 0, behavior: 'smooth' });

        await window.loadHubData();
    };

    let deferredPrompt;
    const installBtn = document.getElementById('install-app-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if(installBtn) installBtn.classList.remove('hidden');
    });

    if(installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            UX.playClick();
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') installBtn.classList.add('hidden');
            deferredPrompt = null;
        });
    }

    window.addEventListener('appinstalled', () => {
        if(installBtn) installBtn.classList.add('hidden');
        deferredPrompt = null;
    });
});
