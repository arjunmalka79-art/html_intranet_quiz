// js/reports.js
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  const user = await window.checkAuth();
  if (!user) return;
  window.renderHeader(user);

  let quizzes = [];
  let results = [];
  let selectedQuizId = 'all';

  const quizFilter = document.getElementById('quiz-filter');
  const reportsContainer = document.getElementById('reports-container');

  // Metric elements
  const metricTotalAttended = document.getElementById('metric-total-attended');
  const metricQuizScope = document.getElementById('metric-quiz-scope');
  const metricAverageScore = document.getElementById('metric-average-score');
  const metricAverageScope = document.getElementById('metric-average-scope');
  const metricLatestTime = document.getElementById('metric-latest-time');
  const metricLatestStudent = document.getElementById('metric-latest-student');

  // Load quizzes and results
  async function loadReportData() {
    try {
      reportsContainer.innerHTML = `
        <div class="py-24 flex justify-center items-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      `;

      // 1. Fetch teacher quizzes
      const { data: quizzesData, error: quizzesError } = await window.supabaseClient
        .from('quizzes')
        .select('id, title, access_code')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (quizzesError) throw quizzesError;

      quizzes = quizzesData || [];
      populateQuizFilter();

      if (quizzes.length === 0) {
        // No quizzes = no results possible
        results = [];
        renderEmptyState();
        updateMetrics([]);
        return;
      }

      // 2. Fetch student results
      const teacherQuizIds = quizzes.map((q) => q.id);
      const { data: resultsData, error: resultsError } = await window.supabaseClient
        .from('student_results')
        .select('*, quizzes(title, access_code)')
        .in('quiz_id', teacherQuizIds)
        .order('completed_at', { ascending: false });

      if (resultsError) throw resultsError;

      results = resultsData || [];
      filterAndRender();
    } catch (err) {
      console.error('Error loading reports:', err);
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

  // Populate Filter Select
  function populateQuizFilter() {
    quizFilter.innerHTML = '<option value="all">All Quizzes</option>';
    quizzes.forEach((q) => {
      const option = document.createElement('option');
      option.value = q.id;
      option.textContent = `${q.title} (${q.access_code})`;
      quizFilter.appendChild(option);
    });
  }

  // Filter and Render based on dropdown selection
  function filterAndRender() {
    const filtered = selectedQuizId === 'all'
      ? results
      : results.filter((r) => r.quiz_id === selectedQuizId);

    updateMetrics(filtered);
    renderTable(filtered);
  }

  // Update metrics row
  function updateMetrics(list) {
    const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId);
    const scopeName = selectedQuiz ? selectedQuiz.title : 'All Quizzes';
    
    // Total Attended
    metricTotalAttended.textContent = list.length;
    metricQuizScope.textContent = scopeName;

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
    const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId);
    const scopeName = selectedQuiz ? selectedQuiz.title : 'All Quizzes';

    if (list.length === 0) {
      renderEmptyState();
      return;
    }

    let tableHtml = `
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-slide-up">
        <!-- Table title bar -->
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-sm font-bold text-slate-800">
            Student Results — <span class="text-blue-600">${escapeHtml(scopeName)}</span>
          </h2>
          <span class="text-xs font-semibold text-slate-400">
            ${list.length} record${list.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-100">
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Quiz</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total Questions</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Percentage</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Grade</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Completed At</th>
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
            <span class="font-semibold text-slate-900">${escapeHtml(result.student_name)}</span>
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

  // Handle filter change
  quizFilter.addEventListener('change', () => {
    selectedQuizId = quizFilter.value;
    filterAndRender();
  });

  // AI Grading Sheet Workflow
  const btnExportAi = document.getElementById('btn-export-ai');
  const btnImportAiGrades = document.getElementById('btn-import-ai-grades');
  const aiGradesPasteInput = document.getElementById('ai-grades-paste-input');

  // 1. Export Responses for AI
  btnExportAi.addEventListener('click', async () => {
    if (selectedQuizId === 'all') {
      alert('Please select a specific quiz from the dropdown filter to export responses.');
      return;
    }

    btnExportAi.disabled = true;
    const originalHtml = btnExportAi.innerHTML;
    btnExportAi.textContent = 'Fetching...';

    try {
      // Fetch responses for this quiz
      const { data, error } = await window.supabaseClient
        .from('student_responses')
        .select('*')
        .eq('quiz_id', selectedQuizId)
        .order('student_name', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('not find the table')) {
          throw new Error("The 'student_responses' table does not exist in your Supabase database. Please execute the updated SQL script in supabase_schema.sql first.");
        }
        throw error;
      }

      if (!data || data.length === 0) {
        alert('No detailed responses found for this quiz. Note: responses are only tracked for new quiz submissions completed after this feature was added.');
        return;
      }

      // Convert responses to CSV
      // Headers: response_id, student_name, question_text, student_answer, question_type
      const csvRows = [
        ['response_id', 'student_name', 'question_text', 'student_answer', 'question_type']
      ];

      data.forEach((r) => {
        csvRows.push([
          r.id,
          r.student_name,
          r.question_text,
          r.student_answer,
          r.question_type || 'MCQ'
        ]);
      });

      // Escape fields and join with CSV format
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

      // Download trigger
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId);
      const quizTitle = selectedQuiz ? selectedQuiz.title.replace(/[^a-z0-9]/gi, '_') : 'Quiz';
      link.setAttribute('download', `Responses_${quizTitle}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.showToast('Exported student responses successfully!', 'success');
    } catch (err) {
      console.error('Error exporting responses:', err);
      alert(err.message || 'Failed to export responses. Check console for details.');
    } finally {
      btnExportAi.disabled = false;
      btnExportAi.innerHTML = originalHtml;
      window.lucide.createIcons();
    }
  });

  // 2. Import AI Grades Paste Box
  btnImportAiGrades.addEventListener('click', () => {
    const rawText = aiGradesPasteInput.value.trim();
    if (!rawText) {
      alert('Please paste the graded CSV first.');
      return;
    }

    btnImportAiGrades.disabled = true;
    const originalHtml = btnImportAiGrades.innerHTML;
    btnImportAiGrades.textContent = 'Parsing...';

    // PapaParse the pasted CSV text
    Papa.parse(rawText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: async (results) => {
        const rows = results.data;
        if (rows.length === 0) {
          alert('No grading rows found in the pasted CSV.');
          resetImportBtn();
          return;
        }

        const validGrades = [];
        const errors = [];

        rows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const responseId = row['response_id'];
          const marksAssignedRaw = row['marks_assigned'];
          const aiReasoning = row['ai_reasoning'] || '';

          if (!responseId || marksAssignedRaw === undefined || marksAssignedRaw === null) {
            errors.push(`Row ${rowNum}: Missing response_id or marks_assigned.`);
            return;
          }

          const marks = parseInt(marksAssignedRaw, 10);
          if (isNaN(marks)) {
            errors.push(`Row ${rowNum}: Invalid marks_assigned (must be a number).`);
            return;
          }

          validGrades.push({
            id: responseId.trim(),
            marks_assigned: marks,
            ai_reasoning: aiReasoning.trim()
          });
        });

        if (errors.length > 0) {
          alert(`CSV Validation Failed:\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? '\n...and more' : ''}`);
          resetImportBtn();
          return;
        }

        btnImportAiGrades.textContent = 'Updating Database...';

        try {
          // Perform bulk update of student_responses in Supabase
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
          
          // Get unique student result IDs to update overall scores
          const uniqueResultIds = Array.from(new Set(resultIds.filter((id) => id)));

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

          alert(`Successfully imported grades for ${validGrades.length} responses! Student total scores have been recalculated.`);
          window.showToast(`Imported ${validGrades.length} grades successfully!`, 'success');
          
          aiGradesPasteInput.value = '';
          loadReportData(); // reload UI list to display the new grades
        } catch (err) {
          console.error('Error updating AI grades:', err);
          alert(err.message || 'Failed to update grades. Check console for details.');
        } finally {
          resetImportBtn();
        }
      },
      error: (err) => {
        console.error('CSV Parsing Error:', err);
        alert('Error parsing pasted CSV input. Make sure it has valid headers.');
        resetImportBtn();
      }
    });

    function resetImportBtn() {
      btnImportAiGrades.disabled = false;
      btnImportAiGrades.innerHTML = originalHtml;
      window.lucide.createIcons();
    }
  });

  // Run initialization
  loadReportData();
});
