// js/result.js
document.addEventListener('DOMContentLoaded', async () => {
  // Render header (no auth required — students view this)
  const user = await window.checkAuth();
  window.renderHeader(user);

  // Pull results from sessionStorage
  const rawScore = sessionStorage.getItem('lastScore');
  const rawTotal = sessionStorage.getItem('lastTotal');
  const rawTitle = sessionStorage.getItem('lastTitle');
  const studentName = sessionStorage.getItem('studentName');

  // If no result data, redirect back home
  if (rawScore === null || rawTotal === null) {
    window.location.href = 'index.html';
    return;
  }

  const score = parseInt(rawScore, 10);
  const total = parseInt(rawTotal, 10);
  const quizTitle = rawTitle || 'Quiz';
  const name = studentName || 'Student';

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  // Populate DOM
  document.getElementById('congrats-text').textContent =
    `Congratulations ${name}, your responses have been registered.`;
  document.getElementById('quiz-title-display').textContent = quizTitle;
  document.getElementById('score-display').textContent = score;
  document.getElementById('total-display').textContent = `out of ${total}`;
  document.getElementById('pct-display').textContent = `${percentage}%`;

  // Progress bar color and feedback message
  const pctBar = document.getElementById('pct-bar');
  const feedbackText = document.getElementById('feedback-text');

  if (percentage >= 70) {
    pctBar.classList.add('bg-emerald-500');
    feedbackText.textContent = 'Fantastic job! You demonstrated a strong grasp of the material.';
  } else if (percentage >= 40) {
    pctBar.classList.add('bg-amber-500');
    feedbackText.textContent = 'Good effort! Review the questions to improve further.';
  } else {
    pctBar.classList.add('bg-rose-500');
    feedbackText.textContent = 'Keep studying! Practice makes perfect.';
  }

  // Animate bar width after a short delay to allow CSS transitions to run
  setTimeout(() => {
    pctBar.style.width = `${percentage}%`;
  }, 200);

  // Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Return / Take Another Quiz button
  const returnBtn = document.getElementById('return-btn');
  returnBtn.addEventListener('click', () => {
    // Clear temporary session data
    sessionStorage.removeItem('lastScore');
    sessionStorage.removeItem('lastTotal');
    sessionStorage.removeItem('lastTitle');
    window.location.href = 'index.html';
  });
});
