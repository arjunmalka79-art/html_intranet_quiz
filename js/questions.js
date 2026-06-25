// js/questions.js
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  const user = await window.checkAuth();
  if (!user) return;
  window.renderHeader(user);

  let questions = [];
  let selectedTagFilter = 'all';

  const questionsList = document.getElementById('questions-list');
  const questionsSummary = document.getElementById('questions-summary');
  const tagFilter = document.getElementById('tag-filter');

  const toggleAddFormBtn = document.getElementById('toggle-add-form');
  const toggleIcon = document.getElementById('toggle-icon');
  const toggleText = document.getElementById('toggle-text');
  const addFormPanel = document.getElementById('add-form-panel');

  const manualForm = document.getElementById('manual-question-form');
  const cancelFormBtn = document.getElementById('cancel-form-btn');
  const submitQuestionBtn = document.getElementById('submit-question-btn');

  const csvFileInput = document.getElementById('csv-file-input');
  const importCsvBtn = document.getElementById('import-csv-btn');
  const csvPasteInput = document.getElementById('csvPasteInput');
  const toggleModeFile = document.getElementById('toggle-mode-file');
  const toggleModePaste = document.getElementById('toggle-mode-paste');
  const wrapperFileInput = document.getElementById('wrapper-file-input');
  const wrapperPasteInput = document.getElementById('wrapper-paste-input');
  const importBtnText = document.getElementById('import-btn-text');
  const copyAiPromptBtn = document.getElementById('copy-ai-prompt-btn');

  // Toggle form panel
  let showForm = false;
  function toggleForm(forceState) {
    showForm = forceState !== undefined ? forceState : !showForm;
    if (showForm) {
      addFormPanel.classList.remove('hidden');
      toggleText.textContent = 'Hide Form';
      toggleIcon.setAttribute('data-lucide', 'x');
    } else {
      addFormPanel.classList.add('hidden');
      toggleText.textContent = 'Add Question';
      toggleIcon.setAttribute('data-lucide', 'plus');
      manualForm.reset();
      csvFileInput.value = '';
      csvPasteInput.value = '';
      setImportMode('file');
    }
    window.lucide.createIcons();
  }

  let importMode = 'file';
  function setImportMode(mode) {
    importMode = mode;
    if (mode === 'file') {
      toggleModeFile.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
      toggleModeFile.classList.remove('text-slate-600', 'hover:text-slate-900');
      toggleModePaste.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
      toggleModePaste.classList.add('text-slate-600', 'hover:text-slate-900');
      
      wrapperFileInput.classList.remove('hidden');
      wrapperPasteInput.classList.add('hidden');
      
      importBtnText.textContent = 'Process and Import File';
    } else {
      toggleModePaste.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
      toggleModePaste.classList.remove('text-slate-600', 'hover:text-slate-900');
      toggleModeFile.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
      toggleModeFile.classList.add('text-slate-600', 'hover:text-slate-900');
      
      wrapperPasteInput.classList.remove('hidden');
      wrapperFileInput.classList.add('hidden');
      
      importBtnText.textContent = 'Process and Import Text Block';
    }
  }

  toggleModeFile.addEventListener('click', () => setImportMode('file'));
  toggleModePaste.addEventListener('click', () => setImportMode('paste'));

  // Copy AI Prompt feature
  if (copyAiPromptBtn) {
    copyAiPromptBtn.addEventListener('click', async () => {
      const promptText = `Act as an expert school teacher. Create a 5-question quiz for [Class/Subject] on the topic "[Topic]". 

Output ONLY a raw CSV block. Do not include markdown brackets (\`\`\`) or any introductory text.

Use these exact headers in the first row:
type,question,option1,option2,option3,option4,correct_option,subject

Rules:
1. 'type' can be: MCQ, FIB, or Short Answer.
2. For MCQ: Fill in option1 to option4. 'correct_option' must be A, B, C, or D.
3. For FIB & Short Answer: Leave option1, option2, option3, and option4 completely blank. Put the actual text answer inside 'correct_option'.`;

      try {
        await navigator.clipboard.writeText(promptText);
        
        // Visual feedback
        const originalHtml = copyAiPromptBtn.innerHTML;
        copyAiPromptBtn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i> Copied!';
        copyAiPromptBtn.classList.remove('bg-blue-50', 'text-blue-600', 'hover:bg-blue-100');
        copyAiPromptBtn.classList.add('bg-emerald-50', 'text-emerald-600', 'hover:bg-emerald-100');
        window.lucide.createIcons();

        setTimeout(() => {
          copyAiPromptBtn.innerHTML = originalHtml;
          copyAiPromptBtn.classList.remove('bg-emerald-50', 'text-emerald-600', 'hover:bg-emerald-100');
          copyAiPromptBtn.classList.add('bg-blue-50', 'text-blue-600', 'hover:bg-blue-100');
          window.lucide.createIcons();
        }, 2000);
      } catch (err) {
        console.error('Failed to copy prompt:', err);
        window.showToast('Failed to copy prompt to clipboard', 'error');
      }
    });
  }

  toggleAddFormBtn.addEventListener('click', () => toggleForm());
  cancelFormBtn.addEventListener('click', () => toggleForm(false));

  // Fetch Questions
  async function fetchQuestions() {
    try {
      questionsList.innerHTML = `
        <div class="py-16 flex justify-center items-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      `;

      const { data, error } = await window.supabaseClient
        .from('question_bank')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      questions = data || [];
      updateTagDropdown();
      renderQuestions();
    } catch (err) {
      console.error('Error fetching questions:', err);
      window.showToast(err.message || 'Failed to load question bank', 'error');
    }
  }

  // Populate/Update Tag dropdown filter
  function updateTagDropdown() {
    const tags = new Set();
    questions.forEach((q) => {
      if (q.syllabus_tag) tags.add(q.syllabus_tag);
    });

    const sortedTags = Array.from(tags).sort();
    
    // Clear and keep "all" option
    tagFilter.innerHTML = '<option value="all">All Syllabus Tags</option>';
    sortedTags.forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      if (tag === selectedTagFilter) {
        option.selected = true;
      }
      tagFilter.appendChild(option);
    });
  }

  // Render questions
  function renderQuestions() {
    const filtered = selectedTagFilter === 'all' 
      ? questions 
      : questions.filter((q) => q.syllabus_tag === selectedTagFilter);

    // Summary text
    questionsSummary.textContent = `${questions.length} questions registered total. Select a syllabus tag to filter.`;

    if (filtered.length === 0) {
      questionsList.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm">
          <i data-lucide="alert-circle" class="w-12 h-12 text-slate-400 mx-auto mb-3"></i>
          <h3 class="text-lg font-bold text-slate-900">No questions found</h3>
          <p class="text-slate-600 text-sm mt-1 mb-4">
            ${selectedTagFilter !== 'all'
              ? `No questions match the tag "${selectedTagFilter}".`
              : 'Your question bank is empty. Get started by adding a multiple-choice question.'}
          </p>
          ${selectedTagFilter === 'all' ? `
            <button
              id="add-first-btn"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
            >
              Add Your First Question
            </button>
          ` : ''}
        </div>
      `;
      window.lucide.createIcons();
      const addFirstBtn = document.getElementById('add-first-btn');
      if (addFirstBtn) {
        addFirstBtn.addEventListener('click', () => toggleForm(true));
      }
      return;
    }

    let listHtml = '';
    filtered.forEach((q, idx) => {
      listHtml += `
        <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-slate-300 transition duration-150 relative animate-slide-up">
          <div class="flex justify-between items-start gap-4 mb-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                Question #${idx + 1}
              </span>
              <span class="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                <i data-lucide="tag" class="w-3 h-3"></i>
                ${escapeHtml(q.syllabus_tag)}
              </span>
            </div>
            <button
              onclick="window.deleteQuestion('${q.id}')"
              class="text-slate-400 hover:text-rose-600 transition p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
              title="Delete Question"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>

          <p class="text-slate-900 font-semibold mb-4 pr-8">${escapeHtml(q.question_text)}</p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div class="p-3 rounded-xl border text-sm flex gap-2 ${(q.correct_option || '').toUpperCase() === 'A' ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'border-slate-100 bg-slate-50/50 text-slate-700'}">
              <span class="font-bold text-slate-400">A.</span>
              <span>${escapeHtml(q.option_a)}</span>
            </div>
            <div class="p-3 rounded-xl border text-sm flex gap-2 ${(q.correct_option || '').toUpperCase() === 'B' ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'border-slate-100 bg-slate-50/50 text-slate-700'}">
              <span class="font-bold text-slate-400">B.</span>
              <span>${escapeHtml(q.option_b)}</span>
            </div>
            <div class="p-3 rounded-xl border text-sm flex gap-2 ${(q.correct_option || '').toUpperCase() === 'C' ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'border-slate-100 bg-slate-50/50 text-slate-700'}">
              <span class="font-bold text-slate-400">C.</span>
              <span>${escapeHtml(q.option_c)}</span>
            </div>
            <div class="p-3 rounded-xl border text-sm flex gap-2 ${(q.correct_option || '').toUpperCase() === 'D' ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'border-slate-100 bg-slate-50/50 text-slate-700'}">
              <span class="font-bold text-slate-400">D.</span>
              <span>${escapeHtml(q.option_d)}</span>
            </div>
          </div>
 
          <div class="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl w-fit">
            Correct Answer: Option ${(q.correct_option || '').toUpperCase()}
          </div>
        </div>
      `;
    });

    questionsList.innerHTML = listHtml;
    window.lucide.createIcons();
  }

  // Handle filter dropdown changes
  tagFilter.addEventListener('change', () => {
    selectedTagFilter = tagFilter.value;
    renderQuestions();
  });

  // Manual Question creation
  manualForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const syllabusTag = document.getElementById('syllabus-tag').value.trim();
    const questionText = document.getElementById('question-text').value.trim();
    const optionA = document.getElementById('option-a').value.trim();
    const optionB = document.getElementById('option-b').value.trim();
    const optionC = document.getElementById('option-c').value.trim();
    const optionD = document.getElementById('option-d').value.trim();
    const correctOption = document.getElementById('correct-option').value;

    if (!syllabusTag || !questionText || !optionA || !optionB || !optionC || !optionD) {
      window.showToast('Please fill out all fields', 'error');
      return;
    }

    submitQuestionBtn.disabled = true;
    submitQuestionBtn.textContent = 'Saving...';

    try {
      const { error } = await window.supabaseClient.from('question_bank').insert({
        teacher_id: user.id,
        syllabus_tag: syllabusTag,
        question_text: questionText,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_option: correctOption,
      });

      if (error) throw error;

      window.showToast('Question added successfully!', 'success');
      toggleForm(false);
      fetchQuestions();
    } catch (err) {
      console.error('Error saving question:', err);
      window.showToast(err.message || 'Failed to add question', 'error');
    } finally {
      submitQuestionBtn.disabled = false;
      submitQuestionBtn.textContent = 'Save Question';
    }
  });

  // Delete Question handler
  window.deleteQuestion = async (id) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await window.supabaseClient
        .from('question_bank')
        .delete()
        .eq('id', id)
        .eq('teacher_id', user.id);

      if (error) throw error;

      window.showToast('Question deleted successfully', 'success');
      // Update local state and redraw
      questions = questions.filter((q) => q.id !== id);
      updateTagDropdown();
      renderQuestions();
    } catch (err) {
      console.error('Error deleting question:', err);
      window.showToast(err.message || 'Failed to delete question', 'error');
    }
  };

  // Consolidated CSV Ingestion Process
  async function processCSVData(parsedData, sourceName) {
    if (parsedData.length === 0) {
      window.showToast(`No data found in ${sourceName}.`, 'error');
      return;
    }

    // Inspect schema dynamically
    let hasType = false;
    let hasChapter = false;
    let hasTopic = false;
    let hasExplanation = false;

    try {
      const { error } = await window.supabaseClient.from('question_bank').select('type').limit(1);
      hasType = !error;
    } catch(e){}
    try {
      const { error } = await window.supabaseClient.from('question_bank').select('chapter').limit(1);
      hasChapter = !error;
    } catch(e){}
    try {
      const { error } = await window.supabaseClient.from('question_bank').select('topic').limit(1);
      hasTopic = !error;
    } catch(e){}
    try {
      const { error } = await window.supabaseClient.from('question_bank').select('explanation').limit(1);
      hasExplanation = !error;
    } catch(e){}

    const validRows = [];
    const errors = [];

    parsedData.forEach((row, index) => {
      const rowNum = index + 2; // header is row 1
      const qTypeRaw = row['type'];
      const question = row['question'];
      const opt1 = row['option1'];
      const opt2 = row['option2'];
      const opt3 = row['option3'];
      const opt4 = row['option4'];
      const correctOption = row['correct_option'];
      const subject = row['subject'];

      if (!question || !correctOption) {
        errors.push(`Row ${rowNum}: Missing required fields (question or correct_option).`);
        return;
      }

      // Determine type: default to MCQ
      let qType = 'MCQ';
      if (qTypeRaw && qTypeRaw.trim()) {
        const t = qTypeRaw.trim().toUpperCase();
        if (t === 'FIB' || t === 'FILL IN THE BLANK') {
          qType = 'FIB';
        } else if (t === 'SHORT ANSWER' || t === 'SA' || t === 'SHORTANSWER') {
          qType = 'Short Answer';
        } else {
          qType = 'MCQ';
        }
      }

      // Check MCQ requirements
      if (qType === 'MCQ') {
        if (!opt1 || !opt2 || !opt3 || !opt4) {
          errors.push(`Row ${rowNum}: MCQ type requires option1 through option4.`);
          return;
        }
        const correct = correctOption.trim().toUpperCase();
        if (correct !== 'A' && correct !== 'B' && correct !== 'C' && correct !== 'D') {
          errors.push(`Row ${rowNum}: MCQ correct_option must be A, B, C, or D.`);
          return;
        }
      }

      const correctVal = correctOption.trim().toLowerCase();
      const syllabusTag = (subject && subject.trim()) ? subject.trim() : 'General';

      const mappedRow = {
        teacher_id: user.id,
        syllabus_tag: syllabusTag,
        question_text: question.trim(),
        correct_option: correctVal
      };

      if (hasType) {
        mappedRow.type = qType;
      }

      if (qType === 'MCQ') {
        mappedRow.option_a = opt1.trim();
        mappedRow.option_b = opt2.trim();
        mappedRow.option_c = opt3.trim();
        mappedRow.option_d = opt4.trim();
      } else {
        mappedRow.option_a = null;
        mappedRow.option_b = null;
        mappedRow.option_c = null;
        mappedRow.option_d = null;
      }

      // Conditional schema fields
      if (hasChapter && 'chapter' in row) {
        mappedRow.chapter = row['chapter'] ? row['chapter'].trim() : null;
      }
      if (hasTopic && 'topic' in row) {
        mappedRow.topic = row['topic'] ? row['topic'].trim() : null;
      }
      if (hasExplanation) {
        if ('correct_answer_logic' in row) {
          mappedRow.explanation = row['correct_answer_logic'] ? row['correct_answer_logic'].trim() : null;
        } else if ('explanation' in row) {
          mappedRow.explanation = row['explanation'] ? row['explanation'].trim() : null;
        }
      }

      validRows.push(mappedRow);
    });

    if (errors.length > 0) {
      alert(`CSV Validation Failed:\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? '\n...and more' : ''}`);
      window.showToast('Failed to validate CSV structure.', 'error');
      return;
    }

    try {
      const { error } = await window.supabaseClient
        .from('question_bank')
        .insert(validRows);

      if (error) throw error;

      alert(`Successfully imported ${validRows.length} questions!`);
      window.showToast(`Successfully imported ${validRows.length} questions!`, 'success');
      
      // Reset inputs
      csvFileInput.value = '';
      csvPasteInput.value = '';
      toggleForm(false);
      fetchQuestions();
    } catch (err) {
      console.error('Error bulk importing questions:', err);
      alert(err.message || 'Failed to import CSV questions.');
      window.showToast(err.message || 'Failed to import CSV questions.', 'error');
    }
  }

  // Unified Import Button Click Listener
  importCsvBtn.addEventListener('click', () => {
    if (importMode === 'file') {
      const file = csvFileInput.files[0];
      if (!file) {
        window.showToast('Please select a CSV file first.', 'error');
        return;
      }

      importCsvBtn.disabled = true;
      const originalHtml = importCsvBtn.innerHTML;
      importCsvBtn.textContent = 'Parsing...';

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
        complete: async (results) => {
          await processCSVData(results.data, file.name);
          resetImportBtn(originalHtml);
        },
        error: (err) => {
          console.error('CSV Parsing Error:', err);
          window.showToast('Error parsing CSV file.', 'error');
          resetImportBtn(originalHtml);
        }
      });
    } else {
      // Paste Mode
      const rawText = csvPasteInput.value.trim();
      if (!rawText) {
        alert('Please paste some CSV data first.');
        return;
      }

      // Strip markdown code block wrapping (like ```csv ... ```)
      const cleanedText = rawText.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();

      importCsvBtn.disabled = true;
      const originalHtml = importCsvBtn.innerHTML;
      importCsvBtn.textContent = 'Parsing...';

      Papa.parse(cleanedText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
        complete: async (results) => {
          await processCSVData(results.data, 'pasted text');
          resetImportBtn(originalHtml);
        },
        error: (err) => {
          console.error('CSV Parsing Error:', err);
          alert('Error parsing CSV input. Please check console.');
          resetImportBtn(originalHtml);
        }
      });
    }
  });

  function resetImportBtn(originalHtml) {
    importCsvBtn.disabled = false;
    importCsvBtn.innerHTML = originalHtml;
    window.lucide.createIcons();
  }

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

  // Initialize page data
  fetchQuestions();
});
