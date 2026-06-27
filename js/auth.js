document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements: Views
    const authView = document.getElementById('auth-view');
    const hubView = document.getElementById('hub-view');
    const workspaceView = document.getElementById('workspace-view');

    // 2. DOM Elements: Auth & Login
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const errorText = document.getElementById('auth-error');

    // 3. DOM Elements: Settings Bottom Sheet
    const settingsBtn = document.getElementById('hub-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsSheet = document.getElementById('settings-sheet');
    const logoutBtn = document.getElementById('logout-btn');

    // 4. DOM Elements: Navigation & Session Context
    const startSessionBtn = document.getElementById('start-session-btn');
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    const sessionDatePicker = document.getElementById('session-date-picker');
    const activeSessionDateDisplay = document.getElementById('active-session-date');
    const actualFormDate = document.getElementById('receipt-date'); // Inside the form engine

    // Initialize: Set date picker default to today
    if (sessionDatePicker) {
        sessionDatePicker.valueAsDate = new Date();
    }

    // Check for existing session on app load
    checkUser();

    // ==========================================
    // CORE AUTHENTICATION LOGIC
    // ==========================================
    async function checkUser() {
        // supabaseClient is initialized in config.js
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            showHub();
        } else {
            showAuth();
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        loginBtn.textContent = 'Signing In...';
        errorText.classList.add('hidden');
        errorText.textContent = ''; 

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value
        });

        if (error) {
            // Friendly error trapping
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

    // ==========================================
    // VIEW ROUTING & TRANSITIONS
    // ==========================================
    function showAuth() {
        hubView.className = 'view hidden-view';
        workspaceView.className = 'view hidden-view';
        authView.className = 'view active-view';
    }

    function showHub() {
        authView.className = 'view hidden-view';
        workspaceView.className = 'view hidden-view';
        hubView.className = 'view active-view';
        
        // Refresh dynamic data upon entering the hub
        setDynamicGreeting();
        setFinancialYear();
    }

    // Transition from Hub to Workspace
    startSessionBtn.addEventListener('click', () => {
        if (!sessionDatePicker.value) return; 
        
        // Pass the chosen date context to the Workspace header
        activeSessionDateDisplay.textContent = `Date: ${sessionDatePicker.value}`;
        
        // Bind the chosen date to the actual hidden form input in engine.js
        if (actualFormDate) {
            actualFormDate.value = sessionDatePicker.value;
            // Lock the date field in Live Mode to prevent accidental changes
            actualFormDate.disabled = true; 
        }

        // Trigger Fluent fade-in animation
        hubView.className = 'view hidden-view';
        workspaceView.className = 'view active-view';
    });

    // Transition back to Hub
    backToHubBtn.addEventListener('click', () => {
        workspaceView.className = 'view hidden-view';
        hubView.className = 'view active-view';
    });

    // ==========================================
    // SETTINGS DRAWER (GLASSMORPHISM)
    // ==========================================
    settingsBtn.addEventListener('click', () => {
        settingsSheet.classList.remove('hidden');
        // Small delay ensures display block applies before opacity transition
        setTimeout(() => settingsSheet.classList.add('visible'), 10);
    });

    closeSettingsBtn.addEventListener('click', closeSettings);
    
    // Close sheet if clicking on the dark blurred background overlay
    settingsSheet.addEventListener('click', (e) => {
        if (e.target === settingsSheet) closeSettings();
    });

    function closeSettings() {
        settingsSheet.classList.remove('visible');
        setTimeout(() => settingsSheet.classList.add('hidden'), 300); // Wait for CSS transition
    }

    // ==========================================
    // DYNAMIC UI HELPERS
    // ==========================================
    function setDynamicGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good Evening';
        
        if (hour >= 5 && hour < 12) greeting = 'Good Morning';
        else if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
        
        document.getElementById('greeting-text').textContent = `${greeting},`;
    }

    function setFinancialYear() {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0 = Jan, 3 = April
        
        let startYear, endYear;
        // Indian Financial Year runs April 1st - March 31st
        if (currentMonth >= 3) { 
            startYear = currentYear;
            endYear = currentYear + 1;
        } else { 
            startYear = currentYear - 1;
            endYear = currentYear;
        }
        
        document.getElementById('financial-year').textContent = `FY ${startYear.toString().slice(-2)}-${endYear.toString().slice(-2)}`;
    }
});
