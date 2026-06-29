document.addEventListener('DOMContentLoaded', () => {
    const authView = document.getElementById('auth-view');
    const hubView = document.getElementById('hub-view');
    
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
        }
        // If not logged in, auth-view stays active natively.
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

    settingsBtn?.addEventListener('click', () => {
        if(settingsSheet) settingsSheet.classList.remove('hidden');
    });
    
    closeSettingsBtn?.addEventListener('click', () => {
        if(settingsSheet) settingsSheet.classList.add('hidden');
    });

    function transitionToHub() {
        authView.classList.replace('active-view', 'hidden-view');
        hubView.classList.replace('hidden-view', 'active-view');
        setDynamicGreeting();
        
        // THE FIX: Silently check every 50ms until the engine script is parsed and ready, 
        // then fetch the database and draw the calendar instantly. No visible loaders!
        let attempts = 0;
        const checkEngine = setInterval(async () => {
            if (typeof window.loadHubData === 'function') {
                clearInterval(checkEngine);
                await window.loadHubData();
            } else if (attempts > 20) {
                clearInterval(checkEngine); // Failsafe to stop checking after 1 second
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
