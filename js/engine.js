// === HAPTICS & AUDIO ENGINE ===
window.UX = {
    hapticsOn: localStorage.getItem('haptics') !== 'false',
    soundsOn: localStorage.getItem('sound') !== 'false',
    // Tiny base64 blip sound to avoid loading external assets
    popSound: new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'), 
    
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
        // Attach click sounds to all buttons globally
        document.addEventListener('click', (e) => {
            if(e.target.tagName === 'BUTTON' || e.target.closest('.icon-btn')) {
                this.playClick();
                this.vibrateLight();
            }
        });
    },
    playClick() { if(this.soundsOn) { this.popSound.currentTime = 0; this.popSound.play().catch(()=>{}); } },
    vibrateLight() { if(this.hapticsOn && navigator.vibrate) navigator.vibrate(20); },
    vibrateSuccess() { if(this.hapticsOn && navigator.vibrate) navigator.vibrate([30, 50, 30]); },
    vibrateError() { if(this.hapticsOn && navigator.vibrate) navigator.vibrate([50, 50, 50]); }
};

document.addEventListener('DOMContentLoaded', () => {
    UX.init();

    let flatsData = [];
    let receiptsData = []; 
    let currentHubDate = new Date(); 

    const views = { auth: document.getElementById('auth-view'), hub: document.getElementById('hub-view'), workspace: document.getElementById('workspace-view') };
    const calGrid = document.getElementById('calendar-grid');
    const calHeader = document.getElementById('cal-month-year');
    
    // EXPORTED FOR AUTH.JS
    window.loadHubData = async function() {
        document.getElementById('loader-text').textContent = "Syncing ledger...";
        flatsData = await DB.fetchFlats() || [];
        const { data: rcpts } = await supabaseClient.from('receipts').select('date, total_amount, serial_no, receipt_no, flat_no').order('created_at', { ascending: false });
        receiptsData = rcpts || [];
        renderCalendar();
    };

    function switchView(viewName) {
        Object.values(views).forEach(v => v.classList.replace('active-view', 'hidden-view'));
        views[viewName].classList.replace('hidden-view', 'active-view');
        window.scrollTo(0, 0);
    }

    // --- CALENDAR LOGIC ---
    document.getElementById('prev-month-btn')?.addEventListener('click', () => {
        currentHubDate.setMonth(currentHubDate.getMonth() - 1); renderCalendar();
    });
    document.getElementById('next-month-btn')?.addEventListener('click', () => {
        currentHubDate.setMonth(currentHubDate.getMonth() + 1); renderCalendar();
    });

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
            dayEl.onclick = () => { UX.playClick(); openWorkspace(dateStr); };
            calGrid.appendChild(dayEl);
        }
        
        // Update Stats
        let tToday = 0, tMonth = 0;
        const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;
        const todayStr = today.toISOString().split('T')[0];
        
        receiptsData.forEach(r => {
            if (r.date === todayStr) tToday += Number(r.total_amount);
            if (r.date.startsWith(monthPrefix)) tMonth += Number(r.total_amount);
        });
        document.getElementById('stat-today').textContent = `₹${tToday}`; 
        document.getElementById('stat-month').textContent = `₹${tMonth}`;
    }

    // --- WORKSPACE & SUBMISSION LOGIC ---
    // (Keep your existing workspace, calculation, and submit event listeners here. 
    // They are perfectly fine. Just add UX.vibrateSuccess() inside the form submit success block).
    
    document.getElementById('back-to-hub-btn').onclick = () => { 
        UX.playClick(); switchView('hub'); window.loadHubData(); 
    };
});
