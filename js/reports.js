// js/reports.js
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 [Reports] DOMContentLoaded fired');
  
  // Check auth
  console.log('🔐 [Reports] Checking auth...');
  const user = await window.checkAuth();
  
  if (!user) {
    console.error('❌ [Reports] No user found, redirecting...');
    return;
  }
  
  console.log('✅ [Reports] Auth successful');
  window.renderHeader(user);

  let quizzes = [];
  let results = [];
  let filterDate = '';
  let filterTime = '';
  let quizFibShortCountMap = {}; // quizId -> number of FIB/Short Answer questions

  const reportsContainer = document.getElementById('reports-container');
  const studentHistoryModal = document.getElementById('studentHistoryModal');
  const studentHistoryName = document.getElementById('studentHistoryName');
  const studentHistoryTotalQuizzes = document.getElementById('studentHistoryTotalQuizzes');
  const studentHistoryAverage = document.getElementById('studentHistoryAverage');
  const studentHistoryTableBody = document.getElementById('studentHistoryTableBody');
  const closeStudentHistory = document.getElementById('closeStudentHistory');

  // Manual CSV Grading Elements
  const manualCsvInput = document.getElementById('manualCsvInput');
  const btnViewCsvPlain = document.getElementById('btnViewCsvPlain');
  const btnSubmitCsvGrade = document.getElementById('btnSubmitCsvGrade');
  const csvPlainPreview = document.getElementById('csvPlainPreview');
  
  let currentCsvData = null; // Store parsed CSV data for submission
  
  // AI Grading Elements
  const aiGradesPasteInput = document.getElementById('aiGradesPasteInput');
  const btnImportAiGrades = document.getElementById('btnImportAiGrades');
  const aiGradesReviewContainer = document.getElementById('aiGradesReviewContainer');
  const aiGradesReviewTable = document.getElementById('aiGradesReviewTable');

  // Metric elements
  const metricTotalAttended = document.getElementById('metric-total-attended');
  const metricQuizScope = document.getElementById('metric-quiz-scope');
  const metricAverageScore = document.getElementById('metric-average-score');
  const metricAverageScope = document.getElementById('metric-average-scope');
  const metricLatestTime = document.getElementById('metric-latest-time');
  const metricLatestStudent = document.getElementById('metric-latest-student');

  // Load quizzes and results
  async function loadReportData() {
    console.log('📊 [Reports] Initializing report data load...');
    console.log('👤 [Reports] Current user:', user);
    console.log('👤 [Reports] User ID:', user.id);
    
    try {
      reportsContainer.innerHTML = `
        <div class="py-24 flex justify-center items-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      `;

      // 1. Fetch teacher quizzes
      console.log('🔍 [Reports] Fetching teacher quizzes...');
      const { data: quizzesData, error: quizzesError } = await window.supabaseClient
        .from('quizzes')
        .select('id, title, access_code')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (quizzesError) {
        console.error('❌ [Reports] Error fetching quizzes:', quizzesError);
        throw quizzesError;
      }

      quizzes = quizzesData || [];
      console.log('✅ [Reports] Quizzes fetched successfully:', quizzes.length, 'quizzes');

      // 1a. Fetch quiz_questions with question_bank to count FIB/Short Answer per quiz
      if (quizzes.length > 0) {
        const quizIds = quizzes.map(q => q.id);
        const { data: quizQuestions, error: qqError } = await window.supabaseClient
          .from('quiz_questions')
          .select('quiz_id, question_bank(*)')
          .in('quiz_id', quizIds);

        if (qqError) {
          console.warn('⚠️ [Reports] Error fetching quiz questions:', qqError);
        } else {
          // Initialize map with 0 for all quizzes
          quizFibShortCountMap = {};
          quizIds.forEach(id => quizFibShortCountMap[id] = 0);
          
          // Count FIB/Short Answer
          if (quizQuestions) {
            quizQuestions.forEach(qq => {
              if (qq.question_bank) {
                const qType = qq.question_bank.type || 'MCQ';
                if (qType === 'FIB' || qType === 'Short Answer') {
                  quizFibShortCountMap[qq.quiz_id] = (quizFibShortCountMap[qq.quiz_id] || 0) + 1;
                }
              }
            });
          }
          console.log('✅ [Reports] Quiz FIB/Short Answer counts:', quizFibShortCountMap);
        }
      }

      if (quizzes.length === 0) {
        // No quizzes = no results possible
        console.log('ℹ️ [Reports] No quizzes found for this teacher');
        results = [];
        renderEmptyState();
        updateMetrics([]);
        return;
      }

      // 2. Fetch student results
      const teacherQuizIds = quizzes.map((q) => q.id);
      console.log('🔍 [Reports] Teacher quiz IDs:', teacherQuizIds);
      
      // Safety check for empty quiz IDs array
      if (teacherQuizIds.length === 0) {
        console.log('ℹ️ [Reports] No quiz IDs to filter results');
        results = [];
        renderEmptyState();
        updateMetrics([]);
        return;
      }

      console.log('🔍 [Reports] Fetching student results...');
      const { data: resultsData, error: resultsError } = await window.supabaseClient
        .from('student_results')
        .select('*, quizzes(title, access_code)')
        .in('quiz_id', teacherQuizIds)
        .order('completed_at', { ascending: false });

      if (resultsError) {
        console.error('❌ [Reports] Error fetching results:', resultsError);
        throw resultsError;
      }

      results = resultsData || [];
      console.log('✅ [Reports] Results fetched successfully:', results.length, 'results');
      filterAndRender();
    } catch (err) {
      console.error('❌ [Reports] Unhandled error in loadReportData:', err);
      reportsContainer.innerHTML = `
        <div class="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center max-w-md mx-auto">
          <i data-lucide="alert-circle" class="w-10 h-10 text-rose-400 mx-auto mb-3"></i>
          <h3 class="text-base font-bold text-rose-800">Failed to load reports</h3>
          <p class="text-rose-600 text-sm mt-1">${escapeHtml(err.message)}</p>
        </div>
      `;
      window.lucide.createIcons();
    }
  }

  // Filter and Render based on date and time
  function filterAndRender() {
    let filtered = results;

    // Apply date filter only if it's a valid full date
    if (filterDate) {
      const dateParts = filterDate.split('-');
      // Check if we have a valid 4-digit year, 2-digit month, and 2-digit day
      if (dateParts.length === 3 && 
          dateParts[0].length === 4 && 
          !isNaN(parseInt(dateParts[0])) &&
          dateParts[1].length === 2 && 
          !isNaN(parseInt(dateParts[1])) &&
          dateParts[2].length === 2 && 
          !isNaN(parseInt(dateParts[2]))) {
        
        filtered = filtered.filter(r => {
          const completedAt = new Date(r.completed_at);
          const rDate = completedAt.toISOString().split('T')[0]; // YYYY-MM-DD
          return rDate === filterDate;
        });
      }
    }

    // Apply time filter only if it's a valid full time (HH:MM)
    if (filterTime) {
      const timeParts = filterTime.split(':');
      if (timeParts.length === 2 && 
          timeParts[0].length === 2 && 
          !isNaN(parseInt(timeParts[0])) &&
          timeParts[1].length === 2 && 
          !isNaN(parseInt(timeParts[1]))) {
        
        filtered = filtered.filter(r => {
          const completedAt = new Date(r.completed_at);
          const hours = String(completedAt.getHours()).padStart(2, '0');
          const minutes = String(completedAt.getMinutes()).padStart(2, '0');
          const rTime = `${hours}:${minutes}`;
          return rTime === filterTime;
        });
      }
    }

    updateMetrics(filtered);
    renderTable(filtered);
  }

  // Update metrics row
  function updateMetrics(list) {    
    // Total Attended
    metricTotalAttended.textContent = list.length;
    metricQuizScope.textContent = 'All Quizzes';

    // Average Score
    if (list.length === 0) {
      metricAverageScore.textContent = '—';
      metricAverageScope.textContent = 'No data yet';
    } else {
      const sumPct = list.reduce((sum, r) => sum + (r.score / r.total_questions) * 100, 0);
      const avgPct = Math.round(sumPct / list.length);
      metricAverageScore.textContent = `${avgPct}%`;
      metricAverageScope.textContent = 'Across all submissions';
    }

    // Latest Submission
    if (list.length === 0) {
      metricLatestTime.textContent = '—';
      metricLatestStudent.textContent = 'No data yet';
    } else {
      const latest = list[0];
      metricLatestTime.textContent = formatDate(latest.completed_at);
      metricLatestStudent.textContent = latest.student_name;
    }
  }

  // Render submissions table
  function renderTable(list) {
    const scopeName = 'All Quizzes';

    if (list.length === 0) {
      renderEmptyState();
      return;
    }

    let tableHtml = `
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-slide-up">
        <!-- Table title bar -->
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h2 class="text-sm font-bold text-slate-800">
            Student Results — <span class="text-blue-600">${escapeHtml(scopeName)}</span>
          </h2>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-400 mr-2">
              ${list.length} record${list.length !== 1 ? 's' : ''}
            </span>
            <input type="date" id="filterDateInput" class="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" style="width: auto;" value="${filterDate}">
            <input type="time" id="filterTimeInput" class="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" style="width: auto;" value="${filterTime}">
            <button id="btnApplyDateTimeFilter" class="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition cursor-pointer">Filter</button>
            <button id="btnClearDateTimeFilter" class="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer">Clear</button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-100">
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">S.NO</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Quiz</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total Questions</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Percentage</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Grade</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Completed At</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">AI Grading Data</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
    `;

    list.forEach((result, idx) => {
      const pct = Math.round((result.score / result.total_questions) * 100);
      const { grade, colorClass } = getLetterGrade(pct);
      const title = result.quizzes?.title || 'Unknown Quiz';
      const code = result.quizzes?.access_code || '';

      tableHtml += `
        <tr class="hover:bg-slate-50/60 transition-colors duration-100">
          <td class="px-6 py-4 text-slate-400 font-medium text-xs">${idx + 1}</td>
          <td class="px-6 py-4">
            <button
              onclick="window.openStudentHistory('${escapeHtml(result.student_name)}')"
              class="font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2 cursor-pointer transition-colors"
            >
              ${escapeHtml(result.student_name)}
            </button>
          </td>
          <td class="px-6 py-4">
            <span class="block font-medium text-slate-700 max-w-[180px] truncate">
              ${escapeHtml(title)}
            </span>
            <span class="text-[11px] font-mono text-slate-400">
              ${code}
            </span>
          </td>
          <td class="px-6 py-4 text-slate-600 font-medium">${result.total_questions}</td>
          <td class="px-6 py-4">
            <span class="font-bold text-slate-900">${result.score}</span>
            <span class="text-slate-400 font-medium"> / ${result.total_questions}</span>
          </td>
          <td class="px-6 py-4">
            <div class="flex items-center gap-2.5">
              <div class="w-20 bg-slate-100 rounded-full h-1.5 shrink-0">
                <div
                  class="h-full rounded-full ${getProgressColorClass(pct)}"
                  style="width: ${pct}%"
                ></div>
              </div>
              <span class="text-xs font-bold text-slate-700 w-9 shrink-0">${pct}%</span>
            </div>
          </td>
          <td class="px-6 py-4">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-black ${colorClass}">
              ${grade}
            </span>
          </td>
          <td class="px-6 py-4 text-slate-500 text-xs font-medium whitespace-nowrap">
            ${formatDate(result.completed_at)}
          </td>
          <td class="px-6 py-4">
            ${(() => {
              const fibShortCount = quizFibShortCountMap[result.quiz_id] || 0;
              if (fibShortCount === 0) {
                return `<span class="text-xs text-slate-400">Null</span>`;
              } else {
                return `<button
                  class="copy-csv-btn inline-flex items-center justify-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                  data-submission-id="${result.id}"
                  data-student-name="${escapeHtml(result.student_name)}"
                  data-quiz-title="${escapeHtml(title)}"
                >
                  📋 Copy Row CSV
                </button>`;
              }
            })()}
          </td>
        </tr>
      `;
    });

    tableHtml += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    reportsContainer.innerHTML = tableHtml;
  }

  // Render empty state
  function renderEmptyState() {
    reportsContainer.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-2xl p-14 text-center shadow-sm max-w-lg mx-auto animate-slide-up">
        <div class="inline-flex items-center justify-center p-4 bg-slate-50 rounded-2xl mb-4">
          <i data-lucide="bar-chart-3" class="w-8 h-8 text-slate-300"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800">
          No students have completed this quiz yet
        </h3>
        <p class="text-slate-500 text-sm mt-2 max-w-xs mx-auto">
          Once students submit their answers using the access code, their results will appear here.
        </p>
      </div>
    `;
    window.lucide.createIcons();
  }

  // Grade helper
  function getLetterGrade(pct) {
    if (pct >= 80) return { grade: 'A', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (pct >= 60) return { grade: 'B', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (pct >= 40) return { grade: 'C', colorClass: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { grade: 'F', colorClass: 'text-rose-700 bg-rose-50 border-rose-200' };
  }

  function getProgressColorClass(pct) {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 60) return 'bg-blue-500';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  }

  // Date formatter
  function formatDate(iso) {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Open Student History Modal
  window.openStudentHistory = function(studentName) {
    console.log('📊 [Reports] Opening history for student:', studentName);
    
    // Filter results for this student
    const studentResults = results.filter(r => r.student_name === studentName);
    console.log('📊 [Reports] Student results:', studentResults.length, 'attempts');
    
    // Update modal title
    studentHistoryName.textContent = `Student History: ${studentName}`;
    
    // Update summary stats
    studentHistoryTotalQuizzes.textContent = studentResults.length;
    
    if (studentResults.length > 0) {
      const sumPct = studentResults.reduce((sum, r) => sum + (r.score / r.total_questions) * 100, 0);
      const avgPct = Math.round(sumPct / studentResults.length);
      studentHistoryAverage.textContent = `${avgPct}%`;
    } else {
      studentHistoryAverage.textContent = '—';
    }
    
    // Render table body
    let tableBodyHtml = '';
    studentResults.forEach((result, idx) => {
      const pct = Math.round((result.score / result.total_questions) * 100);
      const { grade, colorClass } = getLetterGrade(pct);
      const title = result.quizzes?.title || 'Unknown Quiz';
      const code = result.quizzes?.access_code || '';
      
      tableBodyHtml += `
        <tr class="hover:bg-slate-50/60 transition-colors duration-100">
          <td class="px-4 py-3 text-slate-400 font-medium text-xs">${idx + 1}</td>
          <td class="px-4 py-3">
            <span class="font-semibold text-slate-900">${escapeHtml(result.student_name)}</span>
          </td>
          <td class="px-4 py-3">
            <span class="block font-medium text-slate-700 max-w-[180px] truncate">
              ${escapeHtml(title)}
            </span>
            <span class="text-[11px] font-mono text-slate-400">
              ${code}
            </span>
          </td>
          <td class="px-4 py-3 text-slate-600 font-medium">${result.total_questions}</td>
          <td class="px-4 py-3">
            <span class="font-bold text-slate-900">${result.score}</span>
            <span class="text-slate-400 font-medium"> / ${result.total_questions}</span>
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-2.5">
              <div class="w-20 bg-slate-100 rounded-full h-1.5 shrink-0">
                <div
                  class="h-full rounded-full ${getProgressColorClass(pct)}"
                  style="width: ${pct}%"
                ></div>
              </div>
              <span class="text-xs font-bold text-slate-700 w-9 shrink-0">${pct}%</span>
            </div>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-black ${colorClass}">
              ${grade}
            </span>
          </td>
          <td class="px-4 py-3 text-slate-500 text-xs font-medium whitespace-nowrap">
            ${formatDate(result.completed_at)}
          </td>
        </tr>
      `;
    });
    
    studentHistoryTableBody.innerHTML = tableBodyHtml;
    
    // Show modal
    studentHistoryModal.classList.remove('hidden');
  }

  // Close Student History Modal
  function closeStudentHistoryModal() {
    studentHistoryModal.classList.add('hidden');
  }

  // Add event listeners for closing modal
  closeStudentHistory.addEventListener('click', closeStudentHistoryModal);
  studentHistoryModal.addEventListener('click', (e) => {
    if (e.target === studentHistoryModal) {
      closeStudentHistoryModal();
    }
  });

  // Event delegation for copy CSV buttons
  reportsContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy-csv-btn');
    if (btn) {
      await handleCopyCsv(btn);
    }
  });

  // Event delegation for Apply Filter button
  reportsContainer.addEventListener('click', (e) => {
    if (e.target.id === 'btnApplyDateTimeFilter') {
      const dateInput = document.getElementById('filterDateInput');
      const timeInput = document.getElementById('filterTimeInput');
      filterDate = dateInput ? dateInput.value : '';
      filterTime = timeInput ? timeInput.value : '';
      filterAndRender();
    } else if (e.target.id === 'btnClearDateTimeFilter') {
      filterDate = '';
      filterTime = '';
      filterAndRender();
    }
  });
  
  // View CSV Button Handler
  btnViewCsvPlain.addEventListener('click', () => {
    const rawText = manualCsvInput.value.trim();
    if (!rawText) {
      window.showToast('Please paste CSV text first', 'warning');
      return;
    }

    try {
      // Parse CSV (simple comma split, handle quoted fields if needed)
      const lines = rawText.split('\n');
      if (lines.length < 2) {
        window.showToast('CSV must have at least a header and one data row', 'warning');
        return;
      }

      // Get headers and first data row
      const headers = parseCsvLine(lines[0]);
      const dataRow = parseCsvLine(lines[1]);

      const submissionId = dataRow[headers.indexOf('submission_id')] || '';
      const studentName = dataRow[headers.indexOf('student_name')] || '';
      const quizTitle = dataRow[headers.indexOf('quiz_title')] || '';
      const questionText = dataRow[headers.indexOf('question_text')] || '';
      const studentAnswer = dataRow[headers.indexOf('student_answer')] || '';
      const correctKey = dataRow[headers.indexOf('correct_key')] || '';

      // Store current data for submission
      currentCsvData = {
        submissionId,
        studentName,
        quizTitle,
        questionText,
        studentAnswer,
        correctKey,
        rawText,
        dataRow,
        headers
      };

      // Render preview
      csvPlainPreview.innerHTML = `
        <div class="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4"></i>
            Plain Text Preview
          </h3>
          <div class="text-xs space-y-1.5">
            <p><span class="font-semibold text-slate-600">Student:</span> ${escapeHtml(studentName)}</p>
            <p><span class="font-semibold text-slate-600">Quiz:</span> ${escapeHtml(quizTitle)}</p>
            <p><span class="font-semibold text-slate-600">Question:</span> ${escapeHtml(questionText)}</p>
            <p><span class="font-semibold text-slate-600">Student Answer:</span> ${escapeHtml(studentAnswer)}</p>
            <p><span class="font-semibold text-slate-600">Correct Key:</span> ${escapeHtml(correctKey)}</p>
          </div>
          <div class="pt-2 border-t border-slate-200">
            <label class="text-xs font-semibold text-slate-700 block mb-1.5">Enter Custom Marks (out of 5):</label>
            <input type="number" id="manualMarksGiven" class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" min="0" max="5" placeholder="e.g., 4">
          </div>
        </div>
      `;
      window.lucide.createIcons();

      // Enable Submit button
      btnSubmitCsvGrade.disabled = false;
    } catch (err) {
      console.error('Error parsing CSV:', err);
      window.showToast('Error parsing CSV: ' + err.message, 'error');
    }
  });

  // Submit CSV Grade Button Handler
  btnSubmitCsvGrade.addEventListener('click', async () => {
    if (!currentCsvData) {
      window.showToast('Please view the CSV first', 'warning');
      return;
    }

    const marksInput = document.getElementById('manualMarksGiven');
    const marks = marksInput ? parseInt(marksInput.value, 10) : NaN;

    if (isNaN(marks) || marks < 0 || marks > 5) {
      window.showToast('Please enter valid marks between 0 and 5', 'warning');
      return;
    }

    const originalText = btnSubmitCsvGrade.textContent;
    btnSubmitCsvGrade.disabled = true;
    btnSubmitCsvGrade.textContent = 'Saving...';

    try {
      // 1. Find the student_result_id and update student_responses
      // First get all responses for this submission
      const { data: responses, error: respError } = await window.supabaseClient
        .from('student_responses')
        .select('*')
        .eq('student_result_id', currentCsvData.submissionId);

      if (respError) throw respError;

      if (!responses || responses.length === 0) {
        window.showToast('No responses found for this submission', 'warning');
        return;
      }

      // Find the matching response (by question text)
      const targetResponse = responses.find(r => r.question_text === currentCsvData.questionText);

      if (targetResponse) {
        // Update the specific response
        const { error: updateError } = await window.supabaseClient
          .from('student_responses')
          .update({
            marks_assigned: marks,
            ai_reasoning: 'Manually graded via CSV console'
          })
          .eq('id', targetResponse.id);

        if (updateError) throw updateError;
      } else {
        window.showToast('Question not found in this submission', 'warning');
        return;
      }

      // 2. Recalculate total score for student_result
      const { data: allResponses, error: sumError } = await window.supabaseClient
        .from('student_responses')
        .select('marks_assigned')
        .eq('student_result_id', currentCsvData.submissionId);

      if (sumError) throw sumError;

      const totalScore = allResponses.reduce((sum, r) => sum + (r.marks_assigned || 0), 0);

      const { error: resultUpdateError } = await window.supabaseClient
        .from('student_results')
        .update({ score: totalScore })
        .eq('id', currentCsvData.submissionId);

      if (resultUpdateError) throw resultUpdateError;

      // Success!
      window.showToast(`Successfully updated marks for ${currentCsvData.studentName}!`, 'success');

      // Clear UI
      manualCsvInput.value = '';
      csvPlainPreview.innerHTML = '';
      btnSubmitCsvGrade.disabled = true;
      currentCsvData = null;

      // Reload data
      loadReportData();
    } catch (err) {
      console.error('Error updating grade:', err);
      window.showToast(err.message || 'Failed to update grade', 'error');
    } finally {
      btnSubmitCsvGrade.textContent = originalText;
      btnSubmitCsvGrade.disabled = false;
    }
  });

  // Helper to parse CSV line (handles quotes)
  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
  
  // AI Grading Logic
  let aiGradesData = [];
  
  btnImportAiGrades.addEventListener('click', () => {
    const rawText = aiGradesPasteInput.value.trim();
    if (!rawText) {
      window.showToast('Please paste the graded CSV first', 'warning');
      return;
    }

    btnImportAiGrades.disabled = true;
    const originalText = btnImportAiGrades.textContent;
    btnImportAiGrades.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Parsing...';
    window.lucide.createIcons();

    // PapaParse the pasted CSV text
    Papa.parse(rawText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        aiGradesData = results.data;
        if (aiGradesData.length === 0) {
          window.showToast('No grading rows found in the pasted CSV', 'warning');
          resetAiButton(originalText);
          return;
        }

        // Validate and show review table
        let valid = true;
        let tableHtml = '';
        
        aiGradesData.forEach((row, idx) => {
          const responseId = row['response_id'] || row.responseId || '';
          const marksAssigned = row['marks_assigned'] || row.marksAssigned || '';
          const aiReasoning = row['ai_reasoning'] || row.aiReasoning || '';

          if (!responseId || marksAssigned === '') {
            valid = false;
          }

          tableHtml += `
            <tr>
              <td class="px-3 py-2 font-mono text-slate-700">${escapeHtml(responseId)}</td>
              <td class="px-3 py-2 font-semibold text-slate-900">${escapeHtml(String(marksAssigned))}</td>
              <td class="px-3 py-2 text-slate-600 truncate max-w-xs">${escapeHtml(aiReasoning)}</td>
            </tr>
          `;
        });

        aiGradesReviewTable.innerHTML = tableHtml;
        aiGradesReviewContainer.classList.remove('hidden');
        
        if (!valid) {
          window.showToast('Some rows are missing required fields', 'warning');
        }

        // Change button to "Process Grades"
        btnImportAiGrades.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Process & Update Grades';
        btnImportAiGrades.classList.remove('bg-purple-600', 'hover:bg-purple-700');
        btnImportAiGrades.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
        
        btnImportAiGrades.onclick = processAiGrades;
        btnImportAiGrades.disabled = false;
      },
      error: (err) => {
        console.error('CSV Parsing Error:', err);
        window.showToast('Error parsing pasted CSV input', 'error');
        resetAiButton(originalText);
      }
    });

    function resetAiButton(text) {
      btnImportAiGrades.innerHTML = text;
      btnImportAiGrades.disabled = false;
      btnImportAiGrades.onclick = null;
      btnImportAiGrades.addEventListener('click', initialAiGradesClick);
    }
  });

  // Initial click handler (to be restored after processing)
  function initialAiGradesClick() {
    // This is just to hold the initial click logic
  }
  
  async function processAiGrades() {
    btnImportAiGrades.disabled = true;
    btnImportAiGrades.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Updating Grades...';
    window.lucide.createIcons();

    try {
      const validGrades = [];
      const errors = [];

      aiGradesData.forEach((row, idx) => {
        const rowNum = idx + 2;
        const responseId = (row['response_id'] || row.responseId || '').trim();
        const marksAssignedRaw = row['marks_assigned'] || row.marksAssigned;
        const aiReasoning = (row['ai_reasoning'] || row.aiReasoning || '').trim();

        if (!responseId || marksAssignedRaw === undefined || marksAssignedRaw === null) {
          errors.push(`Row ${rowNum}: Missing response_id or marks_assigned`);
          return;
        }

        const marks = parseInt(marksAssignedRaw, 10);
        if (isNaN(marks)) {
          errors.push(`Row ${rowNum}: Invalid marks_assigned (must be a number)`);
          return;
        }

        validGrades.push({ id: responseId, marks_assigned: marks, ai_reasoning: aiReasoning });
      });

      if (errors.length > 0) {
        window.showToast(`CSV Validation Failed: ${errors[0]}`, 'error');
        throw new Error('Validation failed');
      }

      // Perform bulk update
      const updatePromises = validGrades.map(async (grade) => {
        const { data, error } = await window.supabaseClient
          .from('student_responses')
          .update({
            marks_assigned: grade.marks_assigned,
            ai_reasoning: grade.ai_reasoning
          })
          .eq('id', grade.id)
          .select('student_result_id');
        
        if (error) throw error;
        return data && data[0] ? data[0].student_result_id : null;
      });

      const resultIds = await Promise.all(updatePromises);
      const uniqueResultIds = Array.from(new Set(resultIds.filter((id) => id)));

      // Recalculate totals
      if (uniqueResultIds.length > 0) {
        const sumPromises = uniqueResultIds.map(async (resultId) => {
          const { data: respData, error: respErr } = await window.supabaseClient
            .from('student_responses')
            .select('marks_assigned')
            .eq('student_result_id', resultId);
          
          if (respErr) throw respErr;
          
          if (respData && respData.length > 0) {
            const totalScore = respData.reduce((sum, r) => sum + (r.marks_assigned || 0), 0);
            await window.supabaseClient
              .from('student_results')
              .update({ score: totalScore })
              .eq('id', resultId);
          }
        });
        
        await Promise.all(sumPromises);
      }

      window.showToast(`Successfully imported ${validGrades.length} grades!`, 'success');
      
      // Reset everything
      aiGradesPasteInput.value = '';
      aiGradesReviewContainer.classList.add('hidden');
      aiGradesData = [];
      
      btnImportAiGrades.innerHTML = '<i data-lucide="upload-cloud" class="w-4 h-4"></i> Import AI Grades (CSV)';
      btnImportAiGrades.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
      btnImportAiGrades.classList.add('bg-purple-600', 'hover:bg-purple-700');
      btnImportAiGrades.disabled = false;
      
      loadReportData(); // Reload data to update UI
    } catch (err) {
      console.error('Error updating AI grades:', err);
      window.showToast(err.message || 'Failed to update grades', 'error');
    }
  }

  // Also handle clicks in student history modal
  studentHistoryModal.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy-csv-btn');
    if (btn) {
      await handleCopyCsv(btn);
    }
  });

  // Handle copying CSV for a submission
  async function handleCopyCsv(btn) {
    const submissionId = btn.dataset.submissionId;
    const studentName = btn.dataset.studentName;
    const quizTitle = btn.dataset.quizTitle;

    const originalText = btn.textContent;
    btn.textContent = 'Fetching...';
    btn.disabled = true;

    try {
      // 1. Fetch student_responses for this submission
      const { data: responses, error: respError } = await window.supabaseClient
        .from('student_responses')
        .select('*')
        .eq('student_result_id', submissionId);

      if (respError) throw respError;
      if (!responses || responses.length === 0) {
        window.showToast('No detailed responses found for this submission', 'warning');
        return;
      }

      // Get quiz_id from first response
      const quizId = responses[0].quiz_id;

      // 2. Fetch quiz_questions with question_bank data to get correct_option
      const { data: quizQuestions, error: qqError } = await window.supabaseClient
        .from('quiz_questions')
        .select('*, question_bank(*)')
        .eq('quiz_id', quizId);

      if (qqError) throw qqError;

      // Create a map from question_text to correct_option
      const questionCorrectMap = {};
      if (quizQuestions) {
        quizQuestions.forEach(qq => {
          if (qq.question_bank && qq.question_bank.question_text) {
            questionCorrectMap[qq.question_bank.question_text] = qq.question_bank.correct_option || '';
          }
        });
      }

      // 3. Filter for FIB and Short Answer questions
      const fibShortResponses = responses.filter(r => 
        r.question_type === 'FIB' || r.question_type === 'Short Answer'
      );

      // 4. Prepare CSV
      const csvRows = [
        ['submission_id', 'student_name', 'quiz_title', 'question_text', 'student_answer', 'correct_key', 'assigned_marks', 'ai_reasoning']
      ];

      fibShortResponses.forEach(resp => {
        const correctKey = questionCorrectMap[resp.question_text] || '';
        csvRows.push([
          submissionId,
          studentName,
          quizTitle,
          resp.question_text,
          resp.student_answer,
          correctKey,
          resp.marks_assigned || '',
          resp.ai_reasoning || ''
        ]);
      });

      // 5. Convert to CSV string
      const csvContent = csvRows
        .map((row) =>
          row
            .map((val) => {
              const escaped = (val || '').toString().replace(/"/g, '""');
              return `"${escaped}"`;
            })
            .join(',')
        )
        .join('\n');

      // 6. Copy to clipboard
      await navigator.clipboard.writeText(csvContent);
      window.showToast(`CSV data for ${studentName} copied to clipboard!`, 'success');
    } catch (err) {
      console.error('Error copying CSV:', err);
      window.showToast(err.message || 'Failed to copy CSV', 'error');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }



  // Run initialization
  loadReportData();
});
