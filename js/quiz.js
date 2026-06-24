// js/quiz.js
document.addEventListener('DOMContentLoaded', async () => {
  // Parse URL query code
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (!code) {
    window.location.href = 'index.html';
    return;
  }

  // Get student name
  const studentName = sessionStorage.getItem('studentName');
  if (!studentName) {
    window.showToast('Student details not found. Please register.', 'error');
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('student-name-label').textContent = `Candidate: ${studentName}`;

  let quiz = null;
  let questions = [];
  let currentRound = 1;
  let currentIdx = 0;
  let answers = {};
  let timeLeftSeconds = 0;
  let totalDurationSeconds = 0;
  let timerInterval = null;
  let submitting = false;

  const quizHeaderTitle = document.getElementById('quiz-header-title');
  const timerDisplay = document.getElementById('timer-display');
  const timerProgressBar = document.getElementById('timer-progress-bar');
  const timerIcon = document.getElementById('timer-icon');

  const loaderArea = document.getElementById('loader-area');
  const quizArea = document.getElementById('quiz-area');

  const roundBadge = document.getElementById('round-badge');
  const questionBadge = document.getElementById('question-badge');
  const quizCodeLabel = document.getElementById('quiz-code-label');
  const questionTextDisplay = document.getElementById('question-text-display');
  const optionsContainer = document.getElementById('options-container');

  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const nextBtnText = document.getElementById('next-btn-text');
  const nextBtnIcon = document.getElementById('next-btn-icon');

  // Seeded deterministic random number generator + Fisher-Yates shuffle
  function shuffleQuestions(list, seed) {
    const arr = [...list];
    
    // Create numeric hash from seed string
    let seedVal = 0;
    for (let i = 0; i < seed.length; i++) {
      seedVal = (seedVal << 5) - seedVal + seed.charCodeAt(i);
      seedVal |= 0;
    }

    // Linear Congruential Generator (LCG) parameters
    const m = 2 ** 31 - 1;
    const a = 1103515245;
    const c = 12345;
    let state = seedVal < 0 ? seedVal + m : seedVal;

    const nextRand = () => {
      state = (a * state + c) % m;
      return state / m;
    };

    // Perform Fisher-Yates shuffle using deterministic rand
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
  }

  // Load Quiz Data
  async function loadQuizData() {
    try {
      // 1. Fetch quiz info
      const { data: quizData, error: quizError } = await window.supabaseClient
        .from('quizzes')
        .select('*')
        .eq('access_code', code.toUpperCase())
        .maybeSingle();

      if (quizError) throw quizError;
      if (!quizData) {
        window.showToast('Quiz not found', 'error');
        window.location.href = 'index.html';
        return;
      }

      quiz = quizData;
      quizHeaderTitle.textContent = quiz.title;
      quizCodeLabel.textContent = `Access Code: ${quiz.access_code}`;

      timeLeftSeconds = quiz.duration_minutes * 60;
      totalDurationSeconds = quiz.duration_minutes * 60;

      // 2. Fetch quiz questions
      const { data: questionsJunction, error: questionsError } = await window.supabaseClient
        .from('quiz_questions')
        .select('*, question_bank(*)')
        .eq('quiz_id', quiz.id);

      if (questionsError) throw questionsError;

      let items = (questionsJunction || [])
        .map((item) => item.question_bank)
        .filter(Boolean);

      if (items.length === 0) {
        window.showToast('This quiz has no questions associated with it.', 'error');
        window.location.href = 'index.html';
        return;
      }

      // 3. Shuffle if randomize is true
      if (quiz.is_random) {
        items = shuffleQuestions(items, studentName + quiz.id);
      }

      questions = items;
      
      // Hide loading spinner, show quiz layout
      loaderArea.classList.add('hidden');
      quizArea.classList.remove('hidden');

      // Start timer countdown
      startTimer();
      
      // Render first question
      renderCurrentQuestion();
    } catch (err) {
      console.error('Error loading quiz:', err);
      window.showToast('Failed to load quiz details', 'error');
      window.location.href = 'index.html';
    }
  }

  // Countdown timer clock
  function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timeLeftSeconds--;
      updateTimerDisplay();

      if (timeLeftSeconds <= 0) {
        clearInterval(timerInterval);
        window.showToast("Time's up! Submitting your answers...", 'info');
        triggerSubmission();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const mins = Math.floor(timeLeftSeconds / 60);
    const secs = timeLeftSeconds % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Progress percentage
    const pct = (timeLeftSeconds / totalDurationSeconds) * 100;
    timerProgressBar.style.width = `${pct}%`;

    // Red theme alert if less than 60s
    if (timeLeftSeconds < 60) {
      timerProgressBar.classList.remove('bg-blue-600');
      timerProgressBar.classList.add('bg-rose-500');
      timerDisplay.classList.add('text-rose-600');
      timerIcon.classList.remove('text-slate-600');
      timerIcon.classList.add('text-rose-500', 'animate-pulse');
    }
  }

  // Render question card
  function renderCurrentQuestion() {
    const q = questions[currentIdx];
    
    // Update Badges
    roundBadge.textContent = `Round ${currentRound} of ${quiz.rounds}`;
    questionBadge.textContent = `Question ${currentIdx + 1} of ${questions.length}`;

    // Question Text
    questionTextDisplay.textContent = q.question_text;

    // Options rendering
    const selectedAns = answers[q.id];
    let optionsHtml = '';

    (['A', 'B', 'C', 'D']).forEach((letter) => {
      const optionKey = `option_${letter.toLowerCase()}`;
      const optionText = q[optionKey];
      const isSelected = selectedAns === letter;

      optionsHtml += `
        <button
          type="button"
          onclick="window.selectOption('${letter}')"
          class="w-full flex items-start gap-4 p-4 rounded-xl border text-left transition select-none cursor-pointer ${
            isSelected
              ? 'border-blue-600 bg-blue-50/30 ring-1 ring-blue-600'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }"
        >
          <span
            class="w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
              isSelected
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-slate-300 text-slate-500 bg-slate-50'
            }"
          >
            ${letter}
          </span>
          <span class="text-sm ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}">
            ${escapeHtml(optionText)}
          </span>
        </button>
      `;
    });

    optionsContainer.innerHTML = optionsHtml;

    // Navigation Buttons configuration
    prevBtn.disabled = currentIdx === 0;
    
    const isLastQuestionOfLastRound = currentIdx === questions.length - 1 && currentRound === quiz.rounds;

    if (isLastQuestionOfLastRound) {
      nextBtnText.textContent = 'Submit Quiz';
      nextBtn.className = "inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm cursor-pointer shadow-emerald-100";
      nextBtnIcon.setAttribute('data-lucide', 'send');
    } else if (currentIdx === questions.length - 1) {
      nextBtnText.textContent = 'Next Round';
      nextBtn.className = "inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm cursor-pointer shadow-blue-100";
      nextBtnIcon.setAttribute('data-lucide', 'arrow-right');
    } else {
      nextBtnText.textContent = 'Next Question';
      nextBtn.className = "inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm cursor-pointer shadow-blue-100";
      nextBtnIcon.setAttribute('data-lucide', 'arrow-right');
    }

    window.lucide.createIcons();
  }

  // Handle Option Clicks
  window.selectOption = (letter) => {
    const q = questions[currentIdx];
    answers[q.id] = letter;
    renderCurrentQuestion();
  };

  // Nav: Previous Question
  prevBtn.addEventListener('click', () => {
    if (currentIdx > 0) {
      currentIdx--;
      renderCurrentQuestion();
    }
  });

  // Nav: Next Question / Submit
  nextBtn.addEventListener('click', async () => {
    if (submitting) return;

    const isLastQuestionOfLastRound = currentIdx === questions.length - 1 && currentRound === quiz.rounds;

    if (currentIdx < questions.length - 1) {
      currentIdx++;
      renderCurrentQuestion();
    } else {
      // End of questions list for the round
      if (currentRound < quiz.rounds) {
        currentRound++;
        currentIdx = 0;
        window.showToast(`Round ${currentRound} starting!`, 'info');
        renderCurrentQuestion();
      } else if (isLastQuestionOfLastRound) {
        // Submit Quiz
        triggerSubmission();
      }
    }
  });

  // Score Calculation & Upload
  async function triggerSubmission() {
    if (submitting) return;
    submitting = true;

    if (timerInterval) clearInterval(timerInterval);

    try {
      nextBtnText.textContent = 'Submitting...';
      nextBtn.disabled = true;

      // 1. Calculate Score
      let finalScore = 0;
      questions.forEach((q) => {
        const studentAns = answers[q.id];
        if (studentAns && q.correct_option && studentAns.trim().toUpperCase() === q.correct_option.trim().toUpperCase()) {
          finalScore++;
        }
      });

      // 2. Insert to Supabase student_results
      const { error } = await window.supabaseClient.from('student_results').insert({
        quiz_id: quiz.id,
        student_name: studentName,
        score: finalScore,
        total_questions: questions.length,
      });

      if (error) throw error;

      window.showToast('Quiz completed and submitted successfully!', 'success');

      // 3. Save to sessionStorage
      sessionStorage.setItem('lastScore', finalScore.toString());
      sessionStorage.setItem('lastTotal', questions.length.toString());
      sessionStorage.setItem('lastTitle', quiz.title);

      // Redirect to results
      setTimeout(() => {
        window.location.href = `result.html?code=${quiz.access_code}`;
      }, 800);
    } catch (err) {
      console.error('Error submitting quiz results:', err);
      window.showToast(err.message || 'Failed to submit quiz results', 'error');
      submitting = false;
      nextBtn.disabled = false;
      renderCurrentQuestion();
    }
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start initialization
  loadQuizData();
});
