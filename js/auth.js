document.addEventListener('DOMContentLoaded', () => {
    const authView = document.getElementById('auth-view');
    const hubView = document.getElementById('hub-view');
    const loader = document.getElementById('global-loader'); // Fetch old loader if it exists
    
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const errorText = document.getElementById('auth-error');
    
    const settingsBtn = document.getElementById('hub-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsSheet = document.getElementById('settings-sheet');
    const logoutBtn = document.getElementById('logout-btn');

    checkUser();

    async function checkUser() {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (session && !error) {
            transitionToHub();
        } else {
            // Instantly kill loader if showing login screen
            if (loader) loader.remove();
        }
    }

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        if(loginBtn) loginBtn.textContent = 'Authenticating...';
        if(errorText) errorText.classList.add('hidden');

        const { error } = await supabaseClient.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value
        });

        if (error) {
            if(errorText) {
                errorText.textContent = 'Invalid credentials.';
                errorText.classList.remove('hidden');
            }
            if(loginBtn) loginBtn.textContent = 'Sign In';
            if(window.UX) window.UX.vibrateError();
        } else {
            if(loginBtn) loginBtn.textContent = 'Sign In';
            if(window.UX) window.UX.playClick();
            transitionToHub();
        }
    });

    logoutBtn?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        if(emailInput) emailInput.value = ''; 
        if(passwordInput) passwordInput.value = '';
        if(settingsSheet) settingsSheet.classList.add('hidden');
        
        if(hubView) hubView.classList.replace('active-view', 'hidden-view');
        if(authView) authView.classList.replace('hidden-view', 'active-view');
    });

    settingsBtn?.addEventListener('click', () => { if(settingsSheet) settingsSheet.classList.remove('hidden'); });
    closeSettingsBtn?.addEventListener('click', () => { if(settingsSheet) settingsSheet.classList.add('hidden'); });

    function transitionToHub() {
        setDynamicGreeting();
        
        // Polling loop: Wait safely for engine.js to fully parse
        let attempts = 0;
        const checkEngine = setInterval(async () => {
            if (typeof window.loadHubData === 'function') {
                clearInterval(checkEngine);
                await window.loadHubData(); // Draws calendar BEFORE showing view
                
                authView.classList.replace('active-view', 'hidden-view');
                hubView.classList.replace('hidden-view', 'active-view');
                
                // Annihilate the loader instantly so there are no flashes
                if (loader) loader.remove(); 
                
            } else if (attempts > 30) {
                clearInterval(checkEngine); // Failsafe
                authView.classList.replace('active-view', 'hidden-view');
                hubView.classList.replace('hidden-view', 'active-view');
                if (loader) loader.remove();
            }
            attempts++;
        }, 50);
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
