document.addEventListener('DOMContentLoaded', () => {
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const errorText = document.getElementById('auth-error');

    // Check for existing session on load
    checkUser();

    async function checkUser() {
        const { data: { session } } = await supabase.auth.getSession();
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

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            errorText.textContent = error.message;
            errorText.classList.remove('hidden');
            btn.textContent = 'Authenticate';
        } else {
            btn.textContent = 'Authenticate';
            showDashboard();
        }
    });

    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            document.getElementById('email').value = '';
            document.getElementById('password').value = '';
            showAuth();
        }
    });

    function showDashboard() {
        authView.classList.remove('active-view');
        authView.classList.add('hidden-view');
        dashboardView.classList.remove('hidden-view');
        dashboardView.classList.add('active-view');
        setFinancialYear();
    }

    function showAuth() {
        dashboardView.classList.remove('active-view');
        dashboardView.classList.add('hidden-view');
        authView.classList.remove('hidden-view');
        authView.classList.add('active-view');
    }

    function setFinancialYear() {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed (0 = Jan, 3 = April)
        
        let startYear, endYear;
        if (currentMonth >= 3) { // April or later
            startYear = currentYear;
            endYear = currentYear + 1;
        } else { // Jan, Feb, March
            startYear = currentYear - 1;
            endYear = currentYear;
        }
        
        document.getElementById('financial-year').textContent = `FY ${startYear.toString().slice(-2)}-${endYear.toString().slice(-2)}`;
    }
});
