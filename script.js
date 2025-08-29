document.addEventListener('DOMContentLoaded', () => {
    // --- DOM References ---
    const analyzeButton = document.getElementById('analyze-button');
    const buttonText = document.getElementById('button-text');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resumeInput = document.getElementById('resume-text');
    const resumeFileInput = document.getElementById('resume-file');
    const jobDescriptionInput = document.getElementById('job-description');
    const dropZone = document.getElementById('drop-zone');
    const uploadPrompt = document.getElementById('upload-prompt');
    const filePreview = document.getElementById('file-preview');
    const fileNameEl = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file');
    const alertModal = document.getElementById('alert-modal');
    const modalMessage = document.getElementById('modal-message');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const resultsSection = document.getElementById('results-section');
    const skeletonLoader = document.getElementById('skeleton-loader');
    const resultsContent = document.getElementById('results-content');
    
    // Result elements
    const matchProgressCircle = document.getElementById('match-progress-circle');
    const atsProgressCircle = document.getElementById('ats-progress-circle');
    const matchScoreEl = document.getElementById('match-score');
    const atsScoreEl = document.getElementById('ats-score');
    const matchFeedbackEl = document.getElementById('match-feedback');
    const atsFeedbackEl = document.getElementById('ats-feedback');
    const missingKeywordsEl = document.getElementById('missing-keywords');
    const actionVerbsEl = document.getElementById('action-verbs');
    const suggestionsListEl = document.getElementById('suggestions-list');
    const quantifyListEl = document.getElementById('quantify-list');
    const interviewQuestionsListEl = document.getElementById('interview-questions-list');
    
    // New Features Elements
    const generateCoverLetterBtn = document.getElementById('generate-cover-letter-btn');
    const coverLetterSection = document.getElementById('cover-letter-section');
    const coverLetterLoader = document.getElementById('cover-letter-loader');
    const coverLetterContent = document.getElementById('cover-letter-content');
    const coverLetterOutput = document.getElementById('cover-letter-output');
    const copyCoverLetterBtn = document.getElementById('copy-cover-letter-btn');
    const copyBtnText = document.getElementById('copy-btn-text');

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    // --- Initial Animation ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.will-animate').forEach(el => observer.observe(el));


    // --- Event Listeners ---
    analyzeButton.addEventListener('click', async () => {
        const resumeText = resumeInput.value.trim();
        const jobText = jobDescriptionInput.value.trim();
        if (!resumeText) {
            showModal('Please upload your resume file first.');
            return;
        }
        
        setLoading(true, 'analyze');
        try {
            const data = await analyzeResumeWithAPI(resumeText, jobText);
            if (data) displayResults(data);
        } catch (error) {
            showModal(error.message || "An unknown error occurred during analysis.");
        } finally {
            setLoading(false, 'analyze');
        }
    });

    generateCoverLetterBtn.addEventListener('click', async () => {
        const resumeText = resumeInput.value.trim();
        const jobText = jobDescriptionInput.value.trim();
        if (!resumeText) {
            showModal('Resume text is missing.');
            return;
        }
        
        setLoading(true, 'cover-letter');
        try {
            const coverLetterText = await generateCoverLetterAPI(resumeText, jobText);
            coverLetterOutput.textContent = coverLetterText;
        } catch (error) {
            showModal(error.message || "Could not generate cover letter.");
        } finally {
            setLoading(false, 'cover-letter');
        }
    });

    copyCoverLetterBtn.addEventListener('click', () => {
        const textarea = document.createElement('textarea');
        textarea.value = coverLetterOutput.textContent;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            copyBtnText.textContent = 'Copied!';
            setTimeout(() => { copyBtnText.textContent = 'Copy Text'; }, 2000);
        } catch (err) {
            showModal('Failed to copy text.');
        }
        document.body.removeChild(textarea);
    });


    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    dropZone.addEventListener('click', () => resumeFileInput.click());
    resumeFileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });
    removeFileBtn.addEventListener('click', (e) => { e.stopPropagation(); resetUpload(); });
    closeModalBtn.addEventListener('click', () => {
        const modalContent = alertModal.firstElementChild;
        modalContent.classList.remove('animate-scale-in');
        modalContent.classList.add('animate-scale-out');
        modalContent.addEventListener('animationend', () => {
            alertModal.classList.add('hidden');
            alertModal.classList.remove('flex');
        }, { once: true });
    });

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            });
            button.classList.add('active');
            button.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            
            tabPanels.forEach(panel => panel.classList.add('hidden'));
            document.getElementById(`${button.dataset.tab}-content`).classList.remove('hidden');
        });
    });

    // --- API Functions ---
    const API_KEY = "AIzaSyAIiswpG0eMIFMVfQv658Hfp6iY9_UdygM"; // Environment handles this
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;
    
    async function analyzeResumeWithAPI(resumeText, jobDescriptionText) {
        const responseSchema = {
            type: "OBJECT", properties: {
                "jobMatchScore": { "type": "NUMBER", "description": "Score 0-100 on resume's match to job. If no job, general quality score." },
                "missingKeywords": { "type": "ARRAY", "description": "5-7 important keywords from job description missing in resume. Empty if no job.", "items": { "type": "STRING" } },
                "atsFriendlinessScore": { "type": "NUMBER", "description": "Score 0-100 on ATS-friendliness of format/content." },
                "actionVerbs": { "type": "ARRAY", "description": "4-5 strong action verbs found.", "items": { "type": "STRING" } },
                "suggestions": { "type": "ARRAY", "description": "3-4 concise, actionable improvement suggestions, tailored to job if provided.", "items": { "type": "STRING" } },
                "quantifySuggestions": { "type": "ARRAY", "description": "2-3 suggestions for quantifying achievements.", "items": { "type": "OBJECT", "properties": { "original": { "type": "STRING" }, "suggested": { "type": "STRING" } } } },
                "interviewQuestions": { "type": "ARRAY", "description": "3-4 likely interview questions based on resume and job.", "items": { "type": "STRING" } }
            }, required: ["jobMatchScore", "missingKeywords", "atsFriendlinessScore", "actionVerbs", "suggestions", "quantifySuggestions", "interviewQuestions"]
        };
        const systemPrompt = `You are a world-class career coach. Analyze the resume, using the job description for context if provided. Your response MUST be a JSON object strictly adhering to the schema. Be critical and provide honest, constructive feedback.`;
        const userQuery = `Resume:\n${resumeText}\n\nJob Description:\n${jobDescriptionText || "Not provided."}`;
        const payload = { contents: [{ parts: [{ text: userQuery }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema } };
        
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) { const err = await response.json(); throw new Error(`API error: ${err.error?.message || response.statusText}`); }
        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) throw new Error("Invalid API response.");
        return JSON.parse(jsonText);
    }
    
    async function generateCoverLetterAPI(resumeText, jobDescriptionText) {
        const systemPrompt = `You are a professional career writer. Using the following resume and job description, write a concise, professional, and compelling cover letter. The tone should be confident but not arrogant. Structure it in 3-4 paragraphs.`;
        const userQuery = `Generate a cover letter based on this.\n\nResume:\n${resumeText}\n\nJob Description:\n${jobDescriptionText || "A general professional position."}`;
        const payload = { contents: [{ parts: [{ text: userQuery }] }], systemInstruction: { parts: [{ text: systemPrompt }] } };
        
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) { const err = await response.json(); throw new Error(`API error: ${err.error?.message || response.statusText}`); }
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Could not generate cover letter text.");
        return text;
    }

    // --- File Handling ---
    async function handleFile(file) {
        if (!file) return;
        const validTypes = ['.txt', '.pdf', '.doc', '.docx'];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        if (!validTypes.includes(fileExt)) {
            showModal('Invalid file type. Please use .txt, .pdf, or .docx.');
            return;
        }
        showFilePreview(file.name);
        try {
            let text = '';
            if (fileExt === '.txt') text = await file.text();
            else if (fileExt === '.pdf') text = await extractTextFromPdf(file);
            else if (fileExt === '.docx') text = await extractTextFromDocx(file);
            resumeInput.value = text;
        } catch (error) {
            resetUpload();
            showModal(`Error processing file: ${error.message}`);
        }
    }
    
    const extractTextFromPdf = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        return fullText;
    };

    const extractTextFromDocx = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value;
    };
    
    // --- UI Helper Functions ---
    const showFilePreview = (fileName) => {
        uploadPrompt.classList.add('hidden');
        filePreview.classList.remove('hidden'); filePreview.classList.add('flex');
        fileNameEl.textContent = fileName;
    };

    const resetUpload = () => {
        resumeInput.value = ''; resumeFileInput.value = '';
        filePreview.classList.add('hidden'); filePreview.classList.remove('flex');
        uploadPrompt.classList.remove('hidden');
    };

    const showModal = (message) => {
        modalMessage.textContent = message;
        alertModal.classList.remove('hidden');
        alertModal.classList.add('flex');
        const modalContent = alertModal.firstElementChild;
        modalContent.classList.remove('animate-scale-out');
        modalContent.classList.add('animate-scale-in');
    };
    
    const setLoading = (isLoading, type) => {
        if (type === 'analyze') {
            buttonText.classList.toggle('hidden', isLoading);
            loadingSpinner.classList.toggle('hidden', !isLoading);
            analyzeButton.disabled = isLoading;
            
            if (isLoading) {
                resultsSection.classList.remove('hidden');
                skeletonLoader.classList.remove('hidden');
                resultsContent.classList.add('hidden');
                generateCoverLetterBtn.classList.add('hidden');
                coverLetterSection.classList.add('hidden');
            } else {
                skeletonLoader.classList.add('hidden');
                resultsContent.classList.remove('hidden');
            }
        } else if (type === 'cover-letter') {
            generateCoverLetterBtn.disabled = isLoading;
            coverLetterSection.classList.remove('hidden');
            if (isLoading) {
                coverLetterLoader.classList.remove('hidden');
                coverLetterContent.classList.add('hidden');
            } else {
                coverLetterLoader.classList.add('hidden');
                coverLetterContent.classList.remove('hidden');
            }
        }
    };
    
    const setProgress = (circle, percent) => {
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    };

    function displayResults(data) {
        // Helper for staggered animations
        const animateList = (element, selector) => {
            const items = element.querySelectorAll(selector);
            items.forEach((item, index) => {
                item.style.opacity = '0';
                item.style.animation = `fadeInUp 0.5s ease-out ${index * 0.08}s forwards`;
            });
        };

        // Job Match Tab
        const matchScore = Math.round(data.jobMatchScore);
        matchScoreEl.textContent = `${matchScore}%`;
        setProgress(matchProgressCircle, matchScore);
        matchFeedbackEl.textContent = matchScore >= 75 ? "Strong match!" : matchScore >= 50 ? "Good potential." : "Needs tailoring.";
        missingKeywordsEl.innerHTML = data.missingKeywords.length > 0
            ? data.missingKeywords.map(kw => `<span class="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">${kw}</span>`).join('')
            : `<p class="text-sm text-gray-500">No major keywords missing. Great job!</p>`;
        animateList(missingKeywordsEl, 'span');

        // ATS Tab
        const atsScore = Math.round(data.atsFriendlinessScore);
        atsScoreEl.textContent = `${atsScore}%`;
        setProgress(atsProgressCircle, atsScore);
        atsFeedbackEl.textContent = atsScore >= 80 ? "Highly ATS-compatible." : "Formatting may need work.";
        actionVerbsEl.innerHTML = data.actionVerbs.map(v => `<span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">${v}</span>`).join('');
        animateList(actionVerbsEl, 'span');


        // Improvements Tab
        suggestionsListEl.innerHTML = data.suggestions.map(s => `<li class="flex items-start"><svg class="w-5 h-5 text-violet-500 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>${s}</span></li>`).join('');
        quantifyListEl.innerHTML = data.quantifySuggestions.map(q => `
            <div class="border-l-4 border-violet-200 pl-4">
                <p class="text-sm text-gray-500"><strong>Original:</strong> "${q.original}"</p>
                <p class="text-sm text-green-700 font-semibold mt-1"><strong>Suggestion:</strong> "${q.suggested}"</p>
            </div>`).join('') || `<p class="text-sm text-gray-500">Your achievements are well-quantified!</p>`;
        animateList(suggestionsListEl, 'li');
        animateList(quantifyListEl, 'div');

        // Interview Prep Tab
        interviewQuestionsListEl.innerHTML = data.interviewQuestions.map(q => `<li class="flex items-start"><svg class="w-5 h-5 text-blue-500 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.546-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>${q}</span></li>`).join('');
        animateList(interviewQuestionsListEl, 'li');

        // Show generate button and scroll
        generateCoverLetterBtn.classList.remove('hidden');
        generateCoverLetterBtn.classList.add('flex');
        window.scrollTo({ top: resultsSection.offsetTop - 80, behavior: 'smooth' });

        // Reset to first tab
        tabButtons.forEach((btn, index) => {
            btn.classList.toggle('active', index === 0);
            btn.classList.toggle('text-gray-500', index !== 0);
        });
        tabPanels.forEach((panel, index) => panel.classList.toggle('hidden', index !== 0));
    }
});
