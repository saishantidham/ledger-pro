document.addEventListener('DOMContentLoaded', () => {
    const authView = document.getElementById('auth-view');
    const hubView = document.getElementById('hub-view');
    const workspaceView = document.getElementById('workspace-view');

    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const errorText = document.getElementById('auth-error');

    const settingsBtn = document.getElementById('hub-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsSheet = document.getElementById('settings-sheet');
    const logoutBtn = document.getElementById('logout-btn');

    const startSessionBtn = document.getElementById('start-session-btn');
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    const sessionDatePicker = document.getElementById('session-date-picker');
    const activeSessionDateDisplay = document.getElementById('active-session-date');
    const actualFormDate = document.getElementById('receipt-date'); 

    if (sessionDatePicker) {
        sessionDatePicker.valueAsDate = new Date();
    }

    checkUser();

    async function checkUser() {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (session && !error) {
            showHub();
        } else {
            showAuth();
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // JavaScript-level block
        
        loginBtn.textContent = 'Signing In...';
        errorText.classList.add('hidden');
        errorText.textContent = ''; 

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                errorText.textContent = 'Invalid credentials. Please check your email and password.';
            } else {
                errorText.textContent = error.message;
            }
            errorText.classList.remove('hidden');
            loginBtn.textContent = 'Sign In';
        } else {
            loginBtn.textContent = 'Sign In';
            showHub();
        }
    });

    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (!error) {
            emailInput.value = '';
            passwordInput.value = '';
            closeSettings();
            showAuth();
        }
    });

    function showAuth() {
        hubView.className = 'view hidden-view';
        workspaceView.className = 'view hidden-view';
        authView.className = 'view active-view';
    }

    function showHub() {
        authView.className = 'view hidden-view';
        workspaceView.className = 'view hidden-view';
        hubView.className = 'view active-view';
        
        setDynamicGreeting();
        setFinancialYear();
    }

    startSessionBtn.addEventListener('click', () => {
        if (!sessionDatePicker.value) return; 
        
        activeSessionDateDisplay.textContent = `Date: ${sessionDatePicker.value}`;
        
        if (actualFormDate) {
            actualFormDate.value = sessionDatePicker.value;
            actualFormDate.disabled = true; 
        }

        hubView.className = 'view hidden-view';
        workspaceView.className = 'view active-view';
    });

    backToHubBtn.addEventListener('click', () => {
        workspaceView.className = 'view hidden-view';
        hubView.className = 'view active-view';
    });

    settingsBtn.addEventListener('click', () => {
        settingsSheet.classList.remove('hidden');
        setTimeout(() => settingsSheet.classList.add('visible'), 10);
    });

    closeSettingsBtn.addEventListener('click', closeSettings);
    
    settingsSheet.addEventListener('click', (e) => {
        if (e.target === settingsSheet) closeSettings();
    });

    function closeSettings() {
        settingsSheet.classList.remove('visible');
        setTimeout(() => settingsSheet.classList.add('hidden'), 300); 
    }

    function setDynamicGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good Evening';
        
        if (hour >= 5 && hour < 12) greeting = 'Good Morning';
        else if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
        
        const greetingEl = document.getElementById('greeting-text');
        if(greetingEl) greetingEl.textContent = `${greeting},`;
    }

    function setFinancialYear() {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); 
        
        let startYear, endYear;
        if (currentMonth >= 3) { 
            startYear = currentYear;
            endYear = currentYear + 1;
        } else { 
            startYear = currentYear - 1;
            endYear = currentYear;
        }
        
        const fyEl = document.getElementById('financial-year');
        if(fyEl) fyEl.textContent = `FY ${startYear.toString().slice(-2)}-${endYear.toString().slice(-2)}`;
    }
});
