document.addEventListener('DOMContentLoaded', () => {
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginForm = document.getElementById('login-form');
    const errorText = document.getElementById('auth-error');

    // Settings Drawer Elements
    const settingsBtn = document.getElementById('settings-toggle-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsSheet = document.getElementById('settings-sheet');
    const logoutBtn = document.getElementById('logout-btn');

    checkUser();

    async function checkUser() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            showDashboard();
        } else {
            showAuth();
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('login-btn');

        btn.textContent = 'Authenticating...';
        errorText.classList.add('hidden');

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            errorText.textContent = error.message.includes('Invalid') ? 'Invalid credentials.' : error.message;
            errorText.classList.remove('hidden');
            btn.textContent = 'Authenticate';
        } else {
            btn.textContent = 'Authenticate';
            showDashboard();
        }
    });

    // Settings Drawer Logic
    settingsBtn.addEventListener('click', () => {
        settingsSheet.classList.remove('hidden');
        // Small delay to allow display:block to apply before animating opacity
        setTimeout(() => settingsSheet.classList.add('visible'), 10);
    });

    closeSettingsBtn.addEventListener('click', closeSettings);
    
    // Close if clicking on the blurred background overlay
    settingsSheet.addEventListener('click', (e) => {
        if (e.target === settingsSheet) closeSettings();
    });

    function closeSettings() {
        settingsSheet.classList.remove('visible');
        setTimeout(() => settingsSheet.classList.add('hidden'), 300); // Wait for animation
    }

    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (!error) {
            document.getElementById('email').value = '';
            document.getElementById('password').value = '';
            closeSettings();
            showAuth();
        }
    });

    function showDashboard() {
        authView.classList.remove('active-view');
        authView.classList.add('hidden-view');
        dashboardView.classList.remove('hidden-view');
        dashboardView.classList.add('active-view');
        
        setDynamicGreeting();
        setFinancialYear();
    }

    function showAuth() {
        dashboardView.classList.remove('active-view');
        dashboardView.classList.add('hidden-view');
        authView.classList.remove('hidden-view');
        authView.classList.add('active-view');
    }

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
        const currentMonth = today.getMonth(); 
        
        let startYear, endYear;
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
