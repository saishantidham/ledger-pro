document.addEventListener('DOMContentLoaded', () => {
    const authView = document.getElementById('auth-view');
    const hubView = document.getElementById('hub-view');
    const loader = document.getElementById('global-loader');
    
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const errorText = document.getElementById('auth-error');
    
    const settingsBtn = document.getElementById('hub-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsSheet = document.getElementById('settings-sheet');
    const logoutBtn = document.getElementById('logout-btn');

    // Startup Check
    checkUser();

    async function checkUser() {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (session && !error) {
            transitionToHub();
        } else {
            hideLoader();
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        loginBtn.textContent = 'Authenticating...';
        errorText.classList.add('hidden');

        const { error } = await supabaseClient.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value
        });

        if (error) {
            errorText.textContent = 'Invalid credentials.';
            errorText.classList.remove('hidden');
            loginBtn.textContent = 'Sign In';
            if(window.UX) window.UX.vibrateError();
        } else {
            loginBtn.textContent = 'Sign In';
            if(window.UX) window.UX.playClick();
            transitionToHub();
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        emailInput.value = ''; passwordInput.value = '';
        settingsSheet.classList.add('hidden');
        
        hubView.classList.replace('active-view', 'hidden-view');
        authView.classList.replace('hidden-view', 'active-view');
    });

    // Settings Toggle Logic
    settingsBtn.addEventListener('click', () => settingsSheet.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsSheet.classList.add('hidden'));

    async function transitionToHub() {
        authView.classList.replace('active-view', 'hidden-view');
        hubView.classList.replace('hidden-view', 'active-view');
        setDynamicGreeting();
        
        // Let the UI breathe, then load heavy data
        setTimeout(async () => {
            if(typeof window.loadHubData === 'function') {
                await window.loadHubData(); // Triggers engine.js
            }
            hideLoader();
        }, 100);
    }

    function hideLoader() {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 400);
    }

    function setDynamicGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good Evening';
        if (hour >= 5 && hour < 12) greeting = 'Good Morning';
        else if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
        
        const greetingEl = document.getElementById('greeting-text');
        if(greetingEl) greetingEl.textContent = `${greeting},`;
    }
});
