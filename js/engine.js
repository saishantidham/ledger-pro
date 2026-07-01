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
        } catch(e) {}
    },
    vibrateLight() { if(this.hapticsOn && navigator.vibrate) navigator.vibrate([15]); },
    vibrateSuccess() { if(this.hapticsOn && navigator.vibrate) navigator.vibrate([30, 50, 30]); },
    vibrateError() { if(this.hapticsOn && navigator.vibrate) navigator.vibrate([50, 50, 50]); }
};

document.addEventListener('DOMContentLoaded', () => {
    UX.init();

    history.pushState(null, document.title, location.href);
    window.addEventListener('popstate', function (event) {
        let overlayHandled = false;
        const overlays = document.querySelectorAll('.bottom-sheet-overlay:not(.hidden), .modal-overlay.visible');
        
        if (overlays.length > 0) {
            overlays.forEach(m => { m.classList.add('hidden'); m.classList.remove('visible'); });
            overlayHandled = true;
        } else {
            const workspace = document.getElementById('workspace-view');
            const exportView = document.getElementById('export-view');
            if (workspace && workspace.classList.contains('active-view') || (exportView && exportView.classList.contains('active-view'))) {
                switchView('hub');
                overlayHandled = true;
            }
        }
        history.pushState(null, document.title, location.href);
    });

    function initKeyboardTrapFix() {
        if (!window.visualViewport) return;
        const workspace = document.getElementById('workspace-view');
        if(!workspace) return;
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
        document.addEventListener('focusout', () => { if (window.visualViewport.height >= window.innerHeight * 0.8) window.scrollTo(0, 0); });
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
    const serialDisplay = document.getElementById('serial-display');
    const activeSessionDateDisplay = document.getElementById('active-session-date');
    const form = document.getElementById('receipt-form');
    const successModal = document.getElementById('success-modal-overlay');

    const D = {
        toggle: document.getElementById('mode-toggle'), rcptNo: document.getElementById('receipt-no'), dateIn: document.getElementById('receipt-date'), 
        flatBtn: document.getElementById('open-flat-search'), flatBtnText: document.getElementById('flat-btn-text'),
        name: document.getElementById('owner-name'), phone: document.getElementById('owner-phone'),
        baseFee: document.getElementById('base-fee'), isRented: document.getElementById('is-rented'),
        mFromIn: document.getElementById('month-from'), mFromDisp: document.getElementById('display-month-from'),
        mToIn: document.getElementById('month-to'), mToDisp: document.getElementById('display-month-to'),
        mCalc: document.getElementById('months-calculated'), baseTotalCalc: document.getElementById('calculated-base-total'),
        cash: document.getElementById('cash-amount'), online: document.getElementById('online-amount'),
        total: document.getElementById('total-amount-display'), remarks: document.getElementById('remarks'), charCount: document.getElementById('char-count')
    };

    let currentSelectedFlatNo = null;

    const defaultTemplate = "Hello {name},\nYour maintenance payment of ₹{amount} for Flat {flat} (Rcpt: {rcpt}) has been received successfully.\nReceipt: {link}\nThank you!";
    const waMsgInput = document.getElementById('wa-default-msg');
    if(waMsgInput) {
        waMsgInput.value = localStorage.getItem('waTemplate') || defaultTemplate;
        waMsgInput.addEventListener('input', (e) => localStorage.setItem('waTemplate', e.target.value));
    }

    function buildWhatsAppMsg(name, amount, flat, rcpt, uuid) {
        let template = localStorage.getItem('waTemplate') || defaultTemplate;
        const basePath = window.location.origin + window.location.pathname.replace('index.html', '');
        return encodeURIComponent(template.replace('{name}', name).replace('{amount}', amount).replace('{flat}', flat).replace('{rcpt}', rcpt).replace('{link}', `${basePath}receipt.html?id=${uuid}`));
    }

    function getNextRcptStr() {
        if (!receiptsData || receiptsData.length === 0) return "14000";
        let max = 0;
        receiptsData.forEach(r => { let num = parseInt(r.receipt_no); if (!isNaN(num) && num > max) max = num; });
        return max > 0 ? (max + 1).toString() : "14000";
    }

    function updateNextReceiptPlaceholder() {
        if(D.rcptNo) D.rcptNo.placeholder = `Auto (${getNextRcptStr()})`;
    }

    window.loadHubData = async function() {
        try {
            flatsData = await DB.fetchFlats() || [];
            const { data: rcpts, error } = await supabaseClient.from('receipts').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            receiptsData = rcpts || [];
            updateNextReceiptPlaceholder();
            renderCalendar();
            const nextSerial = receiptsData.length > 0 ? Math.max(...receiptsData.map(r => Number(r.serial_no) || 0)) + 1 : 1;
            if (serialDisplay) serialDisplay.textContent = `Entry #${nextSerial}`;
        } catch (err) { console.error(err); }
    };

    function switchView(viewName) {
        Object.values(views).forEach(v => { if(v) v.classList.replace('active-view', 'hidden-view'); });
        if(views[viewName]) views[viewName].classList.replace('hidden-view', 'active-view');
        window.scrollTo(0, 0);
    }

    const hubSettingsBtn = document.getElementById('hub-settings-btn');
    if(hubSettingsBtn) hubSettingsBtn.addEventListener('click', () => { UX.playClick(); document.getElementById('settings-sheet').classList.remove('hidden'); });
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    if(closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => { UX.playClick(); document.getElementById('settings-sheet').classList.add('hidden'); });

    document.getElementById('prev-month-btn')?.addEventListener('click', () => { currentHubDate.setMonth(currentHubDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month-btn')?.addEventListener('click', () => { currentHubDate.setMonth(currentHubDate.getMonth() + 1); renderCalendar(); });

    function renderCalendar() {
        if(!calGrid) return;
        const year = currentHubDate.getFullYear(); const month = currentHubDate.getMonth();
        if(calHeader) calHeader.textContent = currentHubDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
        const statToday = document.getElementById('stat-today');
        const statMonth = document.getElementById('stat-month');
        if(statToday) statToday.textContent = `₹${tToday}`; 
        if(statMonth) statMonth.textContent = `₹${tMonth}`;
    }

    const viewRecentBtn = document.getElementById('view-recent-btn');
    if(viewRecentBtn) viewRecentBtn.addEventListener('click', () => {
        const sheet = document.getElementById('recent-logs-sheet');
        const list = document.getElementById('recent-logs-list');
        list.innerHTML = '';
        
        const recent = receiptsData.slice().sort((a,b) => b.serial_no - a.serial_no).slice(0, 15);
        if(recent.length === 0) list.innerHTML = '<li class="text-center text-muted mt-md">No entries found.</li>';
        else {
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

    window.shareRecent = function(flat, amount, rcpt, uuid) {
        UX.playClick();
        const flatData = flatsData.find(f => f.flat_no === flat);
        const ownerName = flatData ? flatData.owner_name.replace(/^\(R\)\s*/, '') : 'Resident';
        const msg = buildWhatsAppMsg(ownerName, amount, flat, rcpt, uuid);
        let waLink = `https://wa.me/?text=${msg}`;
        if (flatData && flatData.phone_number) {
            let phone = flatData.phone_number.replace(/\D/g, ''); 
            if (phone.length === 10) phone = '91' + phone; 
            if (phone.length > 5) waLink = `https://wa.me/${phone}?text=${msg}`; 
        }
        window.open(waLink, '_blank');
    };

    window.generateReceipt = function(uuid) { UX.playClick(); window.open(`receipt.html?id=${uuid}`, '_blank'); };
    window.editOldLog = function(uuid) { 
        UX.playClick(); 
        const sheet = document.getElementById('recent-logs-sheet');
        if(sheet) sheet.classList.add('hidden'); 
        switchView('workspace'); 
        if(D.toggle) {
            D.toggle.checked = true; 
            D.toggle.dispatchEvent(new Event('change')); 
        }
    };

    function openWorkspace(dateStr) {
        selectedSessionDate = new Date(dateStr);
        if(activeSessionDateDisplay) activeSessionDateDisplay.textContent = selectedSessionDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        if(D.dateIn) D.dateIn.value = dateStr; 
        updateNextReceiptPlaceholder();
        switchView('workspace');
    }
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    if(backToHubBtn) backToHubBtn.onclick = () => { switchView('hub'); window.loadHubData(); };

    const searchModal = document.getElementById('flat-search-modal');
    const searchInput = document.getElementById('flat-search-input');
    const flatList = document.getElementById('flat-list');

    if(D.flatBtn) D.flatBtn.onclick = () => { if(searchModal) searchModal.classList.remove('hidden'); renderFlatList(''); if(searchInput) searchInput.focus(); };
    const closeFlatSearch = document.getElementById('close-flat-search');
    if(closeFlatSearch) closeFlatSearch.onclick = () => { if(searchModal) searchModal.classList.add('hidden'); };
    if(searchInput) searchInput.addEventListener('input', (e) => renderFlatList(e.target.value));

    function renderFlatList(filter) {
        if(!flatList) return;
        const cleanFilter = filter.toLowerCase().replace(/[-\s_]/g, '');
        const filterNoZeros = cleanFilter.replace(/0/g, '');

        const filtered = flatsData.filter(f => {
            const fClean = f.flat_no.toLowerCase().replace(/[-\s_]/g, '');
            const oClean = f.owner_name.toLowerCase().replace(/[-\s_]/g, '');
            if (fClean.includes(cleanFilter) || oClean.includes(cleanFilter)) return true;
            if (filterNoZeros.length > 0 && fClean.replace(/0/g, '').includes(filterNoZeros)) return true;
            return false;
        });

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
        if(D.flatBtnText) D.flatBtnText.textContent = `${flat.flat_no} - ${flat.owner_name}`;
        if(D.flatBtn) D.flatBtn.classList.add('selected');
        if(D.name) D.name.value = flat.owner_name; 
        if(D.phone) D.phone.value = flat.phone_number || '';
        if(D.baseFee) D.baseFee.value = flat.usual_fee; 
        if(D.isRented) D.isRented.checked = flat.is_rented;
        handleRentedToggle(flat.is_rented); 
        if(searchModal) searchModal.classList.add('hidden'); 
        calculateMonths();
    }

    function formatMonthStr(dateStr) {
        if(!dateStr) return 'MMM YYYY';
        return new Date(dateStr + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    if(D.dateIn) D.dateIn.addEventListener('change', (e) => { 
        selectedSessionDate = new Date(e.target.value);
        if(activeSessionDateDisplay) activeSessionDateDisplay.textContent = selectedSessionDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    });

    function handleRentedToggle(isChecked) {
        if(!D.name) return;
        let name = D.name.value.replace(/^\(R\)\s*/, ''); 
        D.name.value = isChecked && name.length > 0 ? `(R) ${name}` : name;
    }
    if(D.isRented) D.isRented.addEventListener('change', (e) => handleRentedToggle(e.target.checked));

    if(D.toggle) D.toggle.addEventListener('change', (e) => {
        const editMode = e.target.checked;
        if(D.rcptNo) {
            D.rcptNo.disabled = !editMode;
            if (editMode) {
                D.rcptNo.placeholder = "Enter Rcpt No";
                D.rcptNo.focus();
                UX.vibrateLight();
            } else {
                updateNextReceiptPlaceholder();
            }
        }
        if(D.dateIn) D.dateIn.disabled = !editMode;
    });

    if(D.remarks) D.remarks.addEventListener('input', (e) => { if(D.charCount) D.charCount.textContent = `${e.target.value.length}/50`; });

    function calculateMonths() {
        if (!D.mFromIn || !D.mToIn || !D.mCalc || !D.baseTotalCalc) return;
        if (!D.mFromIn.value || !D.mToIn.value) {
            currentCalculatedMonths = 0; D.mCalc.textContent = "0 Months"; D.baseTotalCalc.textContent = "₹0"; return;
        }
        const d1 = new Date(D.mFromIn.value + '-01'); const d2 = new Date(D.mToIn.value + '-01');
        let m = (d2.getFullYear() - d1.getFullYear()) * 12 - d1.getMonth() + d2.getMonth() + 1;
        const fee = parseFloat(D.baseFee ? D.baseFee.value : 0) || 0;

        if (m > 0) {
            currentCalculatedMonths = m; D.mCalc.textContent = `${m} Months`; D.mCalc.className = 'calc-label text-success'; D.baseTotalCalc.textContent = `₹${m * fee}`;
        } else {
            currentCalculatedMonths = 0; D.mCalc.textContent = "Invalid Range"; D.mCalc.className = 'calc-label text-error'; D.baseTotalCalc.textContent = `₹0`;
        }
    }
    
    if(D.mFromIn) D.mFromIn.addEventListener('change', (e) => { if(D.mFromDisp) { D.mFromDisp.textContent = formatMonthStr(e.target.value); D.mFromDisp.classList.remove('text-muted'); } calculateMonths(); }); 
    if(D.mToIn) D.mToIn.addEventListener('change', (e) => { if(D.mToDisp) { D.mToDisp.textContent = formatMonthStr(e.target.value); D.mToDisp.classList.remove('text-muted'); } calculateMonths(); });
    if(D.baseFee) D.baseFee.addEventListener('input', calculateMonths);

    function calculateTotal() { if(D.total) D.total.textContent = `₹${(parseFloat(D.cash ? D.cash.value : 0) || 0) + (parseFloat(D.online ? D.online.value : 0) || 0)}`; }
    if(D.cash) D.cash.addEventListener('input', calculateTotal); 
    if(D.online) D.online.addEventListener('input', calculateTotal);

    if(form) form.addEventListener('submit', async () => {
        if (!currentSelectedFlatNo) { UX.vibrateError(); return alert("Select a flat first."); }
        const cashAmt = parseFloat(D.cash.value) || 0; 
        const onlineAmt = parseFloat(D.online.value) || 0; 
        const totalAmt = cashAmt + onlineAmt;
        if (totalAmt === 0) { UX.vibrateError(); return alert("Total cannot be zero."); }

        let actualMonthsCount = currentCalculatedMonths > 0 ? currentCalculatedMonths : 1;
        const baseFee = parseFloat(D.baseFee.value) || 0;
        const expectedTotal = actualMonthsCount * baseFee;
        const pendingAmt = expectedTotal - totalAmt; 

        const submitBtn = document.getElementById('submit-receipt-btn');
        if(submitBtn) submitBtn.textContent = "Saving...";

        // NEW: Smart Single Month Formatting Logic
        let mFromVal = D.mFromIn.value;
        let mToVal = D.mToIn.value;
        let finalMonthsCovered = 'N/A';
        
        if (mFromVal && mToVal) {
            if (mFromVal === mToVal) {
                finalMonthsCovered = formatMonthStr(mFromVal); 
            } else {
                finalMonthsCovered = `${formatMonthStr(mFromVal)} to ${formatMonthStr(mToVal)}`;
            }
        }

        const rPayload = {
            flat_no: currentSelectedFlatNo, date: D.dateIn.value,
            months_covered: finalMonthsCovered,
            months_count: actualMonthsCount, pending_amount: pendingAmt,
            cash_amount: cashAmt, online_amount: onlineAmt, remarks: D.remarks.value
        };
        
        rPayload.receipt_no = (D.toggle && D.toggle.checked && D.rcptNo && D.rcptNo.value) ? D.rcptNo.value : getNextRcptStr();

        try {
            await DB.updateFlatMaster(currentSelectedFlatNo, { owner_name: D.name.value, phone_number: D.phone.value, usual_fee: parseFloat(D.baseFee.value), is_rented: D.isRented.checked });
            const inserted = await DB.insertReceipt(rPayload);
            receiptsData.push(inserted); 

            UX.vibrateSuccess();
            const snapText = document.getElementById('snapshot-text');
            if(snapText) snapText.textContent = `Rcpt: ${inserted.receipt_no} | ${D.name.value} | ₹${totalAmt}`;
            if(successModal) {
                successModal.classList.remove('hidden');
                successModal.classList.add('visible');
            }
            
            const cleanName = D.name.value.replace(/^\(R\)\s*/, '');
            const msg = buildWhatsAppMsg(cleanName, totalAmt, currentSelectedFlatNo, inserted.receipt_no, inserted.uuid);
            
            let waPhone = D.phone.value.replace(/\D/g, '');
            if (waPhone.length === 10) waPhone = '91' + waPhone;
            const waLink = waPhone.length > 5 ? `https://wa.me/${waPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
            
            const waShare = document.getElementById('btn-whatsapp-share');
            if(waShare) waShare.onclick = () => window.open(waLink, '_blank');
            const mailShare = document.getElementById('btn-mail-share');
            if(mailShare) mailShare.onclick = () => window.open(`mailto:?subject=Maintenance Receipt ${inserted.receipt_no}&body=${msg}`, '_blank');
            const genRcptBtn = document.getElementById('btn-generate-receipt');
            if(genRcptBtn) genRcptBtn.onclick = () => generateReceipt(inserted.uuid);

        } catch (e) { 
            UX.vibrateError(); 
            alert("Error saving data. Make sure you are logged in."); 
            console.error(e); 
        } 
        finally { 
            if(submitBtn) submitBtn.textContent = "Log Entry"; 
            updateNextReceiptPlaceholder(); 
        }
    });

    const modalNextBtn = document.getElementById('modal-next-btn');
    if(modalNextBtn) modalNextBtn.onclick = async () => {
        if(successModal) {
            successModal.classList.add('hidden');
            successModal.classList.remove('visible');
        }
        
        currentSelectedFlatNo = null; currentCalculatedMonths = 0;
        if(D.flatBtn) D.flatBtn.classList.remove('selected'); 
        if(D.flatBtnText) D.flatBtnText.textContent = "Select Flat / Owner...";
        if(D.name) D.name.value = ""; 
        if(D.phone) D.phone.value = ""; 
        if(D.baseFee) D.baseFee.value = ""; 
        if(D.isRented) D.isRented.checked = false;
        if(D.cash) D.cash.value = ""; 
        if(D.online) D.online.value = ""; 
        if(D.total) D.total.textContent = "₹0";
        if(D.remarks) D.remarks.value = ""; 
        if(D.charCount) D.charCount.textContent = "0/50";
        if(D.mFromIn) D.mFromIn.value = ""; 
        if(D.mToIn) D.mToIn.value = ""; 
        if(D.mFromDisp) { D.mFromDisp.textContent = "MMM YYYY"; D.mFromDisp.classList.add('text-muted'); }
        if(D.mToDisp) { D.mToDisp.textContent = "MMM YYYY"; D.mToDisp.classList.add('text-muted'); }
        if(D.mCalc) D.mCalc.textContent = "0 Months"; 
        if(D.baseTotalCalc) D.baseTotalCalc.textContent = "₹0";
        
        if (D.toggle && D.toggle.checked) { D.toggle.checked = false; D.toggle.dispatchEvent(new Event('change')); }
        const formContainer = document.querySelector('.ultra-compact-form');
        if (formContainer) formContainer.scrollTo({ top: 0, behavior: 'smooth' });

        await window.loadHubData();
    };

    let deferredPrompt; const installBtn = document.getElementById('install-app-btn');
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if(installBtn) installBtn.classList.remove('hidden'); });
    if(installBtn) { installBtn.addEventListener('click', async () => { if (!deferredPrompt) return; UX.playClick(); deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') installBtn.classList.add('hidden'); deferredPrompt = null; }); }
    window.addEventListener('appinstalled', () => { if(installBtn) installBtn.classList.add('hidden'); deferredPrompt = null; });
});
