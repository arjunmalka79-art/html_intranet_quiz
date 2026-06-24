// js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and save user session info
  const user = await window.checkAuth();
  if (!user) return; // checkAuth will redirect
  window.renderHeader(user);

  let quizzes = [];
  const searchInput = document.getElementById('search-quizzes');
  const contentArea = document.getElementById('content-area');

  // Fetch quizzes
  async function fetchQuizzes() {
    try {
      contentArea.innerHTML = `
        <div class="py-24 flex flex-col justify-center items-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p class="text-slate-500 text-sm">Loading active quizzes...</p>
        </div>
      `;

      const { data, error } = await window.supabaseClient
        .from('quizzes')
        .select('*, profiles(full_name, email)')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      quizzes = data || [];
      renderQuizzes(quizzes);
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      renderError(err.message || 'Failed to load quizzes');
    }
  }

  // Render Quizzes Grid
  function renderQuizzes(list) {
    if (list.length === 0) {
      const isSearching = searchInput.value.trim() !== '';
      contentArea.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-sm animate-slide-up">
          <span class="inline-flex p-4 bg-blue-50 rounded-2xl text-blue-600 mb-4">
            <i data-lucide="book-open" class="w-8 h-8"></i>
          </span>
          <h3 class="text-lg font-bold text-slate-900">
            ${isSearching ? 'No matching quizzes found' : 'Create your first quiz'}
          </h3>
          <p class="text-slate-600 text-sm mt-2 mb-6 max-w-sm mx-auto">
            ${isSearching
              ? 'Try checking the spelling or search for a different quiz title.'
              : 'Create quizzes from your global question bank, define rounds, timing, and share codes with students.'}
          </p>
          ${!isSearching ? `
            <div class="flex justify-center gap-3">
              <a
                href="questions.html"
                class="px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition"
              >
                Go to Question Bank
              </a>
              <a
                href="create.html"
                class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-sm shadow-blue-100"
              >
                Create Quiz
              </a>
            </div>
          ` : ''}
        </div>
      `;
      window.lucide.createIcons();
      return;
    }

    let gridHtml = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;

    list.forEach((quiz) => {
      const formattedDate = new Date(quiz.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const teacherName = quiz.profiles?.full_name || quiz.profiles?.email?.split('@')[0] || 'Teacher';
      const copyBtnId = `copy-btn-${quiz.id}`;

      gridHtml += `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between h-full group animate-slide-up">
          <div>
            <div class="flex justify-between items-start gap-4 mb-3">
              <h3 class="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                ${escapeHtml(quiz.title)}
              </h3>
              <button
                id="${copyBtnId}"
                onclick="window.copyAccessCode('${quiz.access_code}', '${copyBtnId}')"
                class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-xs font-semibold text-slate-600 hover:text-blue-700 transition-all cursor-pointer shrink-0"
                title="Copy Access Code"
              >
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span>${quiz.access_code}</span>
              </button>
            </div>

            <!-- Badges -->
            <div class="flex flex-wrap gap-2 mb-6">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-100">
                ${quiz.rounds} ${quiz.rounds === 1 ? 'Round' : 'Rounds'}
              </span>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border bg-cyan-50 text-cyan-700 border-cyan-100">
                ${quiz.question_count} ${quiz.question_count === 1 ? 'Question' : 'Questions'}
              </span>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-100">
                ${quiz.duration_minutes} min
              </span>
              ${quiz.is_random ? `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border bg-slate-100 text-slate-700 border-slate-200">
                  <i data-lucide="shuffle" class="w-3 h-3"></i>
                  Random
                </span>
              ` : ''}
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-1.5 font-medium text-slate-700">
                <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i>
                <span>By ${escapeHtml(teacherName)}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                <span>Created: ${formattedDate}</span>
              </div>
            </div>
            
            <div class="flex items-center gap-1 text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform duration-200">
              <span>Active</span>
              <i data-lucide="play" class="w-3 h-3 fill-current"></i>
            </div>
          </div>
        </div>
      `;
    });

    gridHtml += `</div>`;
    contentArea.innerHTML = gridHtml;
    window.lucide.createIcons();
  }

  // Render Error
  function renderError(message) {
    contentArea.innerHTML = `
      <div class="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center max-w-lg mx-auto">
        <i data-lucide="alert-circle" class="w-12 h-12 text-rose-500 mx-auto mb-3"></i>
        <h3 class="text-lg font-semibold text-rose-900">Failed to load quizzes</h3>
        <p class="text-rose-700 text-sm mt-1 mb-4">${escapeHtml(message)}</p>
        <button
          id="retry-btn"
          class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    `;
    window.lucide.createIcons();
    document.getElementById('retry-btn').addEventListener('click', fetchQuizzes);
  }

  // Real-time Search Handler
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      renderQuizzes(quizzes);
      return;
    }
    const filtered = quizzes.filter(
      (q) => q.title.toLowerCase().includes(query) || q.access_code.toLowerCase().includes(query)
    );
    renderQuizzes(filtered);
  });

  // Global helper for copying code
  window.copyAccessCode = async (code, btnId) => {
    try {
      await navigator.clipboard.writeText(code);
      const btn = document.getElementById(btnId);
      btn.innerHTML = `
        <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600 animate-pulse"></i>
        <span class="text-emerald-700">Copied</span>
      `;
      window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = `
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          <span>${code}</span>
        `;
        window.lucide.createIcons();
      }, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Helper function to escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run initialization
  fetchQuizzes();
});
