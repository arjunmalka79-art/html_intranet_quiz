// js/auth.js
// Initialize Supabase Client
if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
  console.error("Supabase config (config.js) is missing or not loaded!");
}

window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// Custom Toast notification system
window.showToast = function(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full sm:w-auto px-4 sm:px-0';
    document.body.appendChild(container);
  }

  const toastId = 'toast-' + Math.random().toString(36).substring(2, 9);
  
  let borderBgClass = 'border-slate-200 bg-slate-50 text-slate-900';
  let iconHtml = '<i data-lucide="info" class="w-5 h-5 text-blue-600"></i>';
  if (type === 'success') {
    borderBgClass = 'border-emerald-100 bg-emerald-50 text-emerald-900';
    iconHtml = '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-600"></i>';
  } else if (type === 'error') {
    borderBgClass = 'border-rose-100 bg-rose-50 text-rose-900';
    iconHtml = '<i data-lucide="alert-circle" class="w-5 h-5 text-rose-600"></i>';
  }

  const toastEl = document.createElement('div');
  toastEl.id = toastId;
  toastEl.className = `flex items-start gap-3 p-4 rounded-xl shadow-lg border animate-slide-up bg-white ${borderBgClass}`;
  toastEl.innerHTML = `
    <span class="mt-0.5">${iconHtml}</span>
    <div class="flex-1 text-sm font-medium pr-2">${message}</div>
    <button onclick="document.getElementById('${toastId}').remove()" class="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-lg hover:bg-slate-100">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;
  container.appendChild(toastEl);
  if (window.lucide) {
    window.lucide.createIcons();
  }

  setTimeout(() => {
    const el = document.getElementById(toastId);
    if (el) el.remove();
  }, 4000);
};

// Check Auth State on DOMContentLoaded
window.checkAuth = async function(requiredRole = 'teacher') {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  const user = session ? session.user : null;
  const path = window.location.pathname;
  const isLoginPage = path.includes('login.html');
  const isTeacherPage = path.includes('dashboard.html') || 
                        path.includes('questions.html') || 
                        path.includes('create.html') || 
                        path.includes('reports.html');

  if (isTeacherPage) {
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
  }

  if (isLoginPage) {
    if (user) {
      window.location.href = 'dashboard.html';
      return null;
    }
  }

  return user;
};

// Expose standard Header render logic
window.renderHeader = function(user) {
  const headerContainer = document.getElementById('header-container');
  if (!headerContainer) return;

  const userEmail = user ? user.email : '';
  const initial = userEmail ? userEmail.split('@')[0] : '';

  headerContainer.innerHTML = `
    <header class="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <a href="index.html" class="flex items-center gap-2">
              <span class="p-2 bg-blue-50 rounded-xl text-blue-600">
                <i data-lucide="book-open" class="w-6 h-6"></i>
              </span>
              <span class="text-xl font-bold text-blue-600 tracking-tight">
                Quiz Platform
              </span>
            </a>
          </div>

          <div class="flex items-center gap-4" id="header-auth-section">
            ${user ? `
              <div class="flex items-center gap-4">
                <span class="text-sm font-medium text-slate-600 hidden sm:inline-block truncate max-w-[200px]">
                  ${userEmail}
                </span>
                <button
                  id="logout-btn"
                  class="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200 cursor-pointer"
                >
                  <i data-lucide="log-out" class="w-4 h-4 text-slate-500"></i>
                  Logout
                </button>
              </div>
            ` : `
              <a
                href="login.html"
                class="inline-flex items-center gap-1.5 px-4 py-2 border border-transparent rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200 shadow-sm shadow-blue-100"
              >
                <i data-lucide="log-in" class="w-4 h-4"></i>
                Teacher Login
              </a>
            `}
          </div>
        </div>
      </div>
    </header>
  `;

  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Bind logout action
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.supabaseClient.auth.signOut();
      window.location.href = 'login.html';
    });
  }
};
