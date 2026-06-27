document.addEventListener('DOMContentLoaded', async () => {
    // Only run if we are on the dashboard
    if (!document.getElementById('receipt-form')) return;

    const DOM = {
        modeToggle: document.getElementById('mode-toggle'),
        receiptNo: document.getElementById('receipt-no'),
        date: document.getElementById('receipt-date'),
        flatSelect: document.getElementById('flat-select'),
        editFlatBtn: document.getElementById('edit-flat-btn'),
        ownerName: document.getElementById('owner-name'),
        ownerPhone: document.getElementById('owner-phone'),
        usualFee: document.getElementById('usual-fee'),
        isRented: document.getElementById('is-rented'),
        monthFrom: document.getElementById('month-from'),
        monthTo: document.getElementById('month-to'),
        monthsCalcText: document.getElementById('months-calculated'),
        cashAmt: document.getElementById('cash-amount'),
        onlineAmt: document.getElementById('online-amount'),
        totalDisplay: document.getElementById('total-amount-display')
    };

    let flatsData = [];
    let isEditingMaster = false;

    // Set Default Date to Today
    DOM.date.valueAsDate = new Date();

    // 1. Dual Mode Toggle Logic
    DOM.modeToggle.addEventListener('change', (e) => {
        const isHistorical = e.target.checked;
        if (isHistorical) {
            DOM.receiptNo.disabled = false;
            DOM.receiptNo.placeholder = "Enter old receipt no.";
            DOM.receiptNo.focus();
        } else {
            DOM.receiptNo.disabled = true;
            DOM.receiptNo.value = "";
            DOM.receiptNo.placeholder = "Auto-generated";
        }
    });

    // 2. Load and Handle Flats
    flatsData = await DB.fetchFlats();
    DOM.flatSelect.innerHTML = '<option value="" disabled selected>Select a flat...</option>';
    flatsData.forEach(flat => {
        const opt = document.createElement('option');
        opt.value = flat.flat_no;
        opt.textContent = `${flat.flat_no} - ${flat.owner_name}`;
        DOM.flatSelect.appendChild(opt);
    });

    DOM.flatSelect.addEventListener('change', (e) => {
        const selectedFlat = flatsData.find(f => f.flat_no === e.target.value);
        if (selectedFlat) {
            DOM.ownerName.value = selectedFlat.owner_name;
            DOM.ownerPhone.value = selectedFlat.phone_number || '';
            DOM.usualFee.value = selectedFlat.usual_fee;
            DOM.isRented.checked = selectedFlat.is_rented;
            
            // Lock fields when changing flats
            setMasterFieldsState(true);
            isEditingMaster = false;
        }
    });

    // 3. Edit Master Data Toggle
    DOM.editFlatBtn.addEventListener('click', () => {
        if (!DOM.flatSelect.value) return; // No flat selected
        isEditingMaster = !isEditingMaster;
        setMasterFieldsState(!isEditingMaster);
        if (isEditingMaster) DOM.ownerName.focus();
    });

    function setMasterFieldsState(disabled) {
        DOM.ownerName.disabled = disabled;
        DOM.ownerPhone.disabled = disabled;
        DOM.usualFee.disabled = disabled;
        DOM.isRented.disabled = disabled;
        DOM.editFlatBtn.style.color = disabled ? 'var(--color-text-main)' : 'var(--color-saffron)';
    }

    // 4. Multi-Month Calculator Logic
    function calculateMonths() {
        if (!DOM.monthFrom.value || !DOM.monthTo.value) return;
        
        const d1 = new Date(DOM.monthFrom.value + '-01');
        const d2 = new Date(DOM.monthTo.value + '-01');
        
        let months = (d2.getFullYear() - d1.getFullYear()) * 12;
        months -= d1.getMonth();
        months += d2.getMonth();
        months += 1; // Inclusive

        if (months > 0) {
            DOM.monthsCalcText.textContent = `Total: ${months} Month${months > 1 ? 's' : ''}`;
            DOM.monthsCalcText.style.color = 'var(--color-success)';
            
            // Auto-calculate expected fee if master data exists
            if (DOM.usualFee.value) {
                const expected = months * parseFloat(DOM.usualFee.value);
                // Defaulting to online payment for convenience
                DOM.onlineAmt.value = expected;
                DOM.cashAmt.value = 0;
                calculateTotal();
            }
        } else {
            DOM.monthsCalcText.textContent = "Invalid date range";
            DOM.monthsCalcText.style.color = 'var(--color-error)';
        }
    }

    DOM.monthFrom.addEventListener('change', calculateMonths);
    DOM.monthTo.addEventListener('change', calculateMonths);

    // 5. Financial Math
    function calculateTotal() {
        const cash = parseFloat(DOM.cashAmt.value) || 0;
        const online = parseFloat(DOM.onlineAmt.value) || 0;
        DOM.totalDisplay.textContent = `₹${cash + online}`;
    }

    DOM.cashAmt.addEventListener('input', calculateTotal);
    DOM.onlineAmt.addEventListener('input', calculateTotal);
});
