document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('receipt-form');
    if (!form) return;

    const DOM = {
        modeToggle: document.getElementById('mode-toggle'),
        receiptNo: document.getElementById('receipt-no'),
        receiptDate: document.getElementById('receipt-date'),
        flatSelect: document.getElementById('flat-select'),
        ownerName: document.getElementById('owner-name'),
        ownerPhone: document.getElementById('owner-phone'),
        monthFrom: document.getElementById('month-from'),
        monthTo: document.getElementById('month-to'),
        monthsCalculated: document.getElementById('months-calculated'),
        usualFeeDisplay: document.getElementById('usual-fee-display'),
        usualFeeHidden: document.getElementById('usual-fee'),
        cashAmount: document.getElementById('cash-amount'),
        onlineAmount: document.getElementById('online-amount'),
        totalAmountDisplay: document.getElementById('total-amount-display'),
        remarks: document.getElementById('remarks'),
        submitBtn: document.getElementById('submit-receipt-btn')
    };

    let flatsData = [];

    // ==========================================
    // 1. DELAYED DATA FETCHING
    // ==========================================
    window.initFormEngine = async function() {
        if (flatsData.length > 0) return; 
        
        DOM.flatSelect.innerHTML = '<option value="" disabled selected>Loading flats...</option>';
        flatsData = await DB.fetchFlats();
        
        DOM.flatSelect.innerHTML = '<option value="" disabled selected>Select a flat...</option>';
        flatsData.forEach(flat => {
            const opt = document.createElement('option');
            opt.value = flat.flat_no;
            opt.textContent = `${flat.flat_no} - ${flat.owner_name} ${flat.is_rented ? '(R)' : ''}`;
            DOM.flatSelect.appendChild(opt);
        });
    };

    // ==========================================
    // 2. TOGGLE: LIVE VS HISTORICAL MODE
    // ==========================================
    DOM.modeToggle.addEventListener('change', (e) => {
        const isHistorical = e.target.checked;
        if (isHistorical) {
            DOM.receiptNo.disabled = false;
            DOM.receiptNo.placeholder = "Enter past receipt no.";
            DOM.receiptDate.disabled = false; 
            DOM.receiptNo.focus();
        } else {
            DOM.receiptNo.disabled = true;
            DOM.receiptNo.value = "";
            DOM.receiptNo.placeholder = "Auto-generated (Live)";
            
            const sessionDate = document.getElementById('session-date-picker').value;
            DOM.receiptDate.value = sessionDate;
            DOM.receiptDate.disabled = true;
        }
    });

    // ==========================================
    // 3. SMART FLAT SELECTOR
    // ==========================================
    DOM.flatSelect.addEventListener('change', (e) => {
        const selectedFlat = flatsData.find(f => f.flat_no === e.target.value);
        if (selectedFlat) {
            DOM.ownerName.value = selectedFlat.owner_name;
            DOM.ownerPhone.value = selectedFlat.phone_number || '';
            DOM.usualFeeHidden.value = selectedFlat.usual_fee;
            DOM.usualFeeDisplay.textContent = selectedFlat.usual_fee;
            calculateMonthsAndFees();
        }
    });

    // ==========================================
    // 4. MULTI-MONTH CALCULATOR & MATH
    // ==========================================
    function calculateMonthsAndFees() {
        const fromVal = DOM.monthFrom.value;
        const toVal = DOM.monthTo.value;

        if (!fromVal || !toVal) return;
        
        const d1 = new Date(fromVal + '-01');
        const d2 = new Date(toVal + '-01');
        
        let months = (d2.getFullYear() - d1.getFullYear()) * 12;
        months -= d1.getMonth();
        months += d2.getMonth();
        months += 1; 

        if (months > 0) {
            DOM.monthsCalculated.textContent = `${months} Month${months > 1 ? 's' : ''}`;
            DOM.monthsCalculated.style.color = 'var(--color-success)';
            
            const baseFee = parseFloat(DOM.usualFeeHidden.value);
            if (!isNaN(baseFee)) {
                DOM.onlineAmount.value = months * baseFee;
                DOM.cashAmount.value = 0;
                calculateTotal();
            }
        } else {
            DOM.monthsCalculated.textContent = "Invalid Range";
            DOM.monthsCalculated.style.color = 'var(--color-error)';
        }
    }

    function calculateTotal() {
        const cash = parseFloat(DOM.cashAmount.value) || 0;
        const online = parseFloat(DOM.onlineAmount.value) || 0;
        DOM.totalAmountDisplay.textContent = `₹${cash + online}`;
    }

    DOM.monthFrom.addEventListener('change', calculateMonthsAndFees);
    DOM.monthTo.addEventListener('change', calculateMonthsAndFees);
    DOM.cashAmount.addEventListener('input', calculateTotal);
    DOM.onlineAmount.addEventListener('input', calculateTotal);

    // ==========================================
    // 5. DATABASE INSERTION & SUCCESS MODAL
    // ==========================================
    const modalOverlay = document.getElementById('success-modal-overlay');
    const snapshotText = document.getElementById('snapshot-text');
    const btnNext = document.getElementById('modal-next-btn');
    
    // Store latest payload for Export step later
    window.lastLoggedReceipt = null; 

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!DOM.flatSelect.value) {
            alert("Please select a flat.");
            return;
        }

        const cash = parseFloat(DOM.cashAmount.value) || 0;
        const online = parseFloat(DOM.onlineAmount.value) || 0;
        
        if (cash + online === 0) {
            alert("Total amount cannot be zero.");
            return;
        }

        DOM.submitBtn.textContent = "Processing...";
        DOM.submitBtn.disabled = true;

        const payload = {
            flat_no: DOM.flatSelect.value,
            date: DOM.receiptDate.value,
            months_covered: `${DOM.monthFrom.value} to ${DOM.monthTo.value}`,
            cash_amount: cash,
            online_amount: online,
            remarks: DOM.remarks.value
        };

        if (DOM.modeToggle.checked) {
            payload.receipt_no = DOM.receiptNo.value;
        }

        try {
            // Push to Supabase Ledger
            const insertedData = await DB.insertReceipt(payload);
            
            window.lastLoggedReceipt = insertedData;

            const flatName = flatsData.find(f => f.flat_no === insertedData.flat_no)?.owner_name.split(' ')[0] || '';
            snapshotText.textContent = `[Rcpt: ${insertedData.receipt_no}] | Flat: ${insertedData.flat_no} | ${flatName} | Total: ₹${insertedData.total_amount}`;

            // Trigger Glass Modal
            modalOverlay.classList.remove('hidden');
            setTimeout(() => modalOverlay.classList.add('visible'), 10);
            
        } catch (error) {
            alert("Failed to log receipt. Check console for details.");
            console.error(error);
        } finally {
            DOM.submitBtn.textContent = "Log Receipt";
            DOM.submitBtn.disabled = false;
        }
    });

    // Reset Form for Next Entry
    btnNext.addEventListener('click', () => {
        modalOverlay.classList.remove('visible');
        setTimeout(() => modalOverlay.classList.add('hidden'), 400);
        
        DOM.cashAmount.value = "0";
        DOM.onlineAmount.value = "0";
        DOM.totalAmountDisplay.textContent = "₹0";
        DOM.remarks.value = "";
        DOM.monthFrom.value = "";
        DOM.monthTo.value = "";
        DOM.monthsCalculated.textContent = "0 Months";
        DOM.monthsCalculated.style.color = "inherit";
        DOM.flatSelect.value = "";
        DOM.ownerName.value = "";
        DOM.ownerPhone.value = "";
        DOM.usualFeeHidden.value = "";
        DOM.usualFeeDisplay.textContent = "0";
        
        if (DOM.modeToggle.checked) {
            DOM.receiptNo.value = "";
            DOM.receiptNo.focus();
        }
    });
});
