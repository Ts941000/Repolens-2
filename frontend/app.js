document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL =
        window.location.protocol === 'file:' ||
        (window.location.hostname === 'localhost' && window.location.port !== '5000') ||
        (window.location.hostname === '127.0.0.1' && window.location.port !== '5000')
            ? 'http://localhost:5000'
            : '';
    let indexedChunks = [];


    const thinkingSteps = [

    "🔍 Searching repository...",

    "📄 Reading source files...",

    "🧠 Understanding project...",

    "✨ Generating answer..."

];

    async function checkBackendConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);

        if (!response.ok) {
            throw new Error("Backend is not responding");
        }

        const data = await response.json();

        console.log("Backend response:", data);

    } catch (error) {
        console.error("Backend connection failed:", error);
    }
}

checkBackendConnection();

    // Views
    const landingView = document.getElementById('landingView');
    const loadingView = document.getElementById('loadingView');
    const chatView = document.getElementById('chatView');
    
    // Inputs & Buttons
    const repoUrlInput = document.getElementById('repoUrlInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const suggestionTags = document.querySelectorAll('.suggestion-tag');
    const popularChips = document.querySelectorAll('.popular-chip');
    const askAnythingBtn = document.getElementById('askAnythingBtn');
    
    // Chat Elements
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatHistory = document.getElementById('chatHistory');
    const chatScrollArea = document.getElementById('chatScrollArea');
    const welcomeSection = document.getElementById('welcomeSection');
    const qSuggestions = document.querySelectorAll('.q-suggestion');
    const newRepoBtn = document.getElementById('newRepoBtn');
    const conversationHistory = [];
    
    // Dynamic Stats Elements
    const sidebarRepoName = document.getElementById("sidebarRepoName");
    const currentRepoNameHeader = document.getElementById("currentRepoNameHeader");
    const activeRepoDetails = document.getElementById('activeRepoDetails');
    const recentTitle = document.getElementById('recentTitle');
    const recentChats = document.getElementById('recentChats');
    const totalFiles = document.getElementById("totalFiles");
    const usefulFilesCount = document.getElementById("usefulFiles");
    const repoLanguage = document.getElementById("repoLanguage");
    const repoStars = document.getElementById("repoStars");
    const repoForks = document.getElementById("repoForks");
    const defaultBranch = document.getElementById("defaultBranch");
    const repoDescription = document.getElementById("repoDescription");
    const recentRepositories = document.getElementById("recentRepositories");
    const landingFilesIndexed = document.getElementById("landingFilesIndexed");
    const landingChunksCreated = document.getElementById("landingChunksCreated");
    const landingEmbeddings = document.getElementById("landingEmbeddings");
    const landingTopK = document.getElementById("landingTopK");
    const lastRepoName = document.getElementById("lastRepoName");
    const lastRepoMeta = document.getElementById("lastRepoMeta");
    const lastRepoLanguageIcon = document.getElementById("lastRepoLanguageIcon");
    const sidebarRepoCount = document.getElementById("sidebarRepoCount");
    const sidebarQuestionCount = document.getElementById("sidebarQuestionCount");
    const sidebarFilesIndexed = document.getElementById("sidebarFilesIndexed");
    const sidebarChunksCreated = document.getElementById("sidebarChunksCreated");
    const sidebarEmbeddings = document.getElementById("sidebarEmbeddings");

    let currentRepo = '';
    const RECENTS_KEY = "repolens.recentRepositories";
    const QUESTIONS_KEY = "repolens.questionsAsked";

    function formatNumber(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return "--";
        return number.toLocaleString();
    }

    function getStoredRecents() {
        try {
            return JSON.parse(localStorage.getItem(RECENTS_KEY)) || [];
        } catch (error) {
            return [];
        }
    }

    function saveStoredRecents(recents) {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 6)));
    }

    function getQuestionCount() {
        const value = Number(localStorage.getItem(QUESTIONS_KEY));
        return Number.isFinite(value) ? value : 0;
    }

    function setQuestionCount(value) {
        localStorage.setItem(QUESTIONS_KEY, String(value));
        if (sidebarQuestionCount) {
            sidebarQuestionCount.textContent = formatNumber(value);
        }
    }

    function getLanguageClass(language) {
        const value = String(language || "").toLowerCase();
        if (value.includes("python")) return "python";
        if (value.includes("typescript")) return "typescript";
        if (value.includes("javascript")) return "javascript";
        return "default";
    }

    function getLanguageIcon(language) {
        const value = String(language || "").toLowerCase();
        if (value.includes("python")) return '<i class="fa-brands fa-python"></i>';
        if (value.includes("typescript")) return "TS";
        if (value.includes("javascript")) return "JS";
        return '<i class="fa-brands fa-github"></i>';
    }

    function timeAgo(timestamp) {
        if (!timestamp) return "just now";
        const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    function updateSidebarCounts() {
        const recents = getStoredRecents();
        if (sidebarRepoCount) sidebarRepoCount.textContent = formatNumber(recents.length);
        if (sidebarQuestionCount) sidebarQuestionCount.textContent = formatNumber(getQuestionCount());
    }

    function updateDashboardStats(data) {
        const filesIndexed = data.totalFiles ?? data.documents ?? data.usefulFiles;
        if (landingFilesIndexed) landingFilesIndexed.textContent = formatNumber(filesIndexed);
        if (landingChunksCreated) landingChunksCreated.textContent = formatNumber(data.chunks);
        if (landingEmbeddings) landingEmbeddings.textContent = formatNumber(data.embeddings);
        if (landingTopK) landingTopK.textContent = "5";
        if (sidebarFilesIndexed) sidebarFilesIndexed.textContent = formatNumber(filesIndexed);
        if (sidebarChunksCreated) sidebarChunksCreated.textContent = formatNumber(data.chunks);
        if (sidebarEmbeddings) sidebarEmbeddings.textContent = formatNumber(data.embeddings);
    }

    function updateLastRepoCard(repo, data = {}) {
        if (!repo) return;

        const language = repo.language || "Unknown";
        if (lastRepoName) lastRepoName.textContent = repo.fullName || repo.name || "Repository";
        if (lastRepoMeta) {
            const usefulFiles = data.usefulFiles ?? repo.usefulFiles;
            const indexedText = usefulFiles ? `${formatNumber(usefulFiles)} useful files` : "Indexed from backend";
            lastRepoMeta.textContent = `${language} - ${indexedText} - ${timeAgo(repo.analyzedAt)}`;
        }
        if (lastRepoLanguageIcon) {
            const languageClass = getLanguageClass(language);
            lastRepoLanguageIcon.className = `language-badge ${languageClass}`;
            lastRepoLanguageIcon.innerHTML = getLanguageIcon(language);
        }
    }

    function renderRecentRepositories() {
        if (!recentRepositories) return;

        const recents = getStoredRecents();
        if (recents.length === 0) {
            recentRepositories.innerHTML = '<li class="empty-repo-state">Analyze a public GitHub repo to build history.</li>';
            updateSidebarCounts();
            return;
        }

        recentRepositories.innerHTML = recents.slice(0, 4).map((repo) => {
            const language = repo.language || "Unknown";
            const languageClass = getLanguageClass(language);
            return `
                <li class="recent-repo-item" data-url="${escapeHTML(repo.githubUrl || "")}">
                    <span class="recent-repo-icon ${languageClass}">${getLanguageIcon(language)}</span>
                    <span class="recent-repo-meta">
                        <span class="repo-name">${escapeHTML(repo.fullName || repo.name || "Repository")}</span>
                        <span class="repo-language">${getLanguageIcon(language)}${escapeHTML(language)}</span>
                    </span>
                    <span class="recent-time">${timeAgo(repo.analyzedAt)}</span>
                </li>
            `;
        }).join("");

        updateSidebarCounts();
    }

    function rememberRepository(data) {
        const repo = {
            fullName: data.repository.fullName,
            name: data.repository.name,
            language: data.repository.language || "Unknown",
            githubUrl: data.repository.githubUrl,
            totalFiles: data.totalFiles,
            usefulFiles: data.usefulFiles,
            chunks: data.chunks,
            embeddings: data.embeddings,
            analyzedAt: Date.now()
        };

        const recents = getStoredRecents().filter(item => item.fullName !== repo.fullName);
        recents.unshift(repo);
        saveStoredRecents(recents);
        renderRecentRepositories();
        updateLastRepoCard(repo, data);
    }

    function hydrateLandingFromStorage() {
        const recents = getStoredRecents();
        renderRecentRepositories();
        updateSidebarCounts();

        if (recents.length === 0) return;

        const latest = recents[0];
        updateLastRepoCard(latest, latest);
        updateDashboardStats({
            totalFiles: latest.totalFiles,
            chunks: latest.chunks,
            embeddings: latest.embeddings
        });
    }

    hydrateLandingFromStorage();

    // Switch Views
    function showView(view) {
        landingView.classList.remove('active');
        loadingView.classList.remove('active');
        chatView.classList.remove('active');
        view.classList.add('active');
    }

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value.trim() === '') {
            this.style.height = 'auto';
        }
    });

    // Handle suggestion tags in landing
    suggestionTags.forEach(tag => {
        tag.addEventListener('click', () => {
            repoUrlInput.value = `https://github.com/${tag.textContent}`;
            analyzeRepo();
        });
    });

    if (recentRepositories) {
        recentRepositories.addEventListener('click', (event) => {
            const repoItem = event.target.closest('.recent-repo-item');
            if (!repoItem || !repoItem.dataset.url) return;
            repoUrlInput.value = repoItem.dataset.url;
            analyzeRepo();
        });
    }

    if (askAnythingBtn) {
        askAnythingBtn.addEventListener('click', () => {
            if (!currentRepo) {
                repoUrlInput.focus();
                return;
            }

            showView(chatView);
            activeRepoDetails.style.display = 'block';
            recentTitle.style.display = 'block';
            recentChats.style.display = 'flex';
            chatInput.focus();
        });
    }

    popularChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (!currentRepo) {
                repoUrlInput.focus();
                return;
            }

            showView(chatView);
            activeRepoDetails.style.display = 'block';
            recentTitle.style.display = 'block';
            recentChats.style.display = 'flex';
            chatInput.value = chip.textContent;
            chatInput.focus();
        });
    });

    // Analyze Repo flow
    analyzeBtn.addEventListener('click', analyzeRepo);
    repoUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') analyzeRepo();
    });

    async function analyzeRepo() {
        const url = repoUrlInput.value.trim();
        if (!url) return;

        showView(loadingView);

        const progressBar = document.getElementById('analysisProgress');
        progressBar.style.width = '0%';

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 8 + 4;
            if (progress > 95) progress = 95;
            progressBar.style.width = `${progress}%`;
        }, 420);

        try {
            const response = await fetch(`${API_BASE_URL}/api/repositories`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    repoUrl: url
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to analyze repository");
            }

            console.log("Repository API Response:", data);

            currentRepo = data.repository.fullName;
            indexedChunks = data.indexedChunks || [];

            sidebarRepoName.textContent = data.repository.fullName;
            currentRepoNameHeader.textContent = data.repository.fullName;

            totalFiles.textContent = formatNumber(data.totalFiles);
            usefulFilesCount.textContent = formatNumber(data.usefulFiles);
            repoLanguage.textContent = data.repository.language || "Unknown";
            repoStars.textContent = formatNumber(data.repository.stars);
            repoForks.textContent = formatNumber(data.repository.forks);
            defaultBranch.textContent = data.repository.defaultBranch;
            repoDescription.textContent = data.repository.description || "No description available";

            updateDashboardStats(data);
            rememberRepository(data);

            clearInterval(interval);
            progressBar.style.width = '100%';

            setTimeout(() => {
                showView(chatView);

                activeRepoDetails.style.display = 'block';
                recentTitle.style.display = 'block';
                recentChats.style.display = 'flex';

                chatInput.focus();
            }, 400);
        } catch (error) {
            clearInterval(interval);
            console.error("Repository request failed:", error);
            alert(error.message);
            showView(landingView);
        }
    }

    // Handle new repo button
   newRepoBtn.addEventListener('click', () => {

    repoUrlInput.value = '';

    // Reset conversation memory
    conversationHistory.length = 0;
    indexedChunks = [];

    // Reset chat history
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => msg.remove());

    // Reset input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Show welcome section
    welcomeSection.style.display = 'flex';

    // Hide repository details
    activeRepoDetails.style.display = 'none';

    // Hide recent sections
    recentTitle.style.display = 'none';
    recentChats.style.display = 'none';

    // Go back to landing page
    showView(landingView);

    // Focus repository URL input
    repoUrlInput.focus();
});

    // Handle chat suggestions
    qSuggestions.forEach(btn => {
        btn.addEventListener('click', () => {
            chatInput.value = btn.textContent;
            sendMessage();
        });
    });

    // Chat logic
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Hide welcome section if visible
        if (welcomeSection.style.display !== 'none') {
            welcomeSection.style.display = 'none';
        }

        // Add user message
addUserMessage(text);

conversationHistory.push({
    role: "user",
    content: text
});

setQuestionCount(getQuestionCount() + 1);

// Clear input
chatInput.value = '';
chatInput.style.height = 'auto';

        // Add AI loading state
        const typingId = addTypingIndicator();

        // Simulate AI response delay
        try {

    const response = await fetch(`${API_BASE_URL}/api/chat`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

    question: text,

    history: conversationHistory,

    indexedChunks

})

    });

    const data = await response.json();

    removeTypingIndicator(typingId);

    if (!response.ok) {
        throw new Error(data.message);
    }

    addAIMessage(data.answer, data.chunks);
    conversationHistory.push({
    role: "assistant",
    content: data.answer
});

} catch (error) {

    removeTypingIndicator(typingId);

    addAIMessage(
        "Error: " + error.message,
        []
    );

}
    }

    function addUserMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message user';
        msgDiv.innerHTML = `
            <div class="avatar">U</div>
            <div class="message-content">
                <div class="message-text">${escapeHTML(text)}</div>
            </div>
        `;
        chatHistory.appendChild(msgDiv);
        scrollToBottom();
    }

    function addTypingIndicator() {
        const id = 'typing-' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message ai';
        msgDiv.id = id;
        msgDiv.innerHTML = `
            <div class="avatar"><i class="fa-solid fa-layer-group"></i></div>
            <div class="message-content">
                <div class="message-text">
                <div class="thinking-container">
                    <div class="thinking-spinner"></div>
                    <div class="thinking-text">
                    🔍 Searching repository...</div>
                </div>
            </div>
            </div>
        `;
        chatHistory.appendChild(msgDiv);
        scrollToBottom();

        let currentStep = 0;

const interval = setInterval(() => {

    const thinkingText =
        document.querySelector(`#${id} .thinking-text`);

    if (!thinkingText) {

        clearInterval(interval);
        return;

    }

    currentStep++;

    thinkingText.textContent =
        thinkingSteps[currentStep % thinkingSteps.length];

}, 1000);

        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function addAIMessage(text, sources) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message ai';
        
        let sourcesHTML = '';
        if (sources && sources.length > 0) {
            const sourceCards = sources.map(src => {
                return `
                <div class="source-file-card">
                    <div class="source-header">
                        <i class="fa-regular fa-file-code"></i>
                        <span class="filename">${escapeHTML(src.file || src.path || "Unknown file")}</span>
                    </div>
                    <div class="source-lines">${src.lines ? `Lines ${escapeHTML(src.lines)}` : (typeof src.score === "number" ? `Match: ${(src.score * 100).toFixed(0)}%` : "")}</div>
                </div>`;
            }).join('');
            
            sourcesHTML = `
                <div class="sources-container">
                    <div class="sources-title"><i class="fa-solid fa-code-branch"></i> Sources</div>
                    <div class="sources-grid">
                        ${sourceCards}
                    </div>
                </div>
            `;
        }

        msgDiv.innerHTML = `
            <div class="avatar"><i class="fa-solid fa-layer-group"></i></div>
            <div class="message-content">

    <div class="message-text"></div>

    <div class="message-toolbar">

        <button class="tool-btn copy-btn">
            <i class="fa-regular fa-copy"></i>
            Copy
        </button>

        <button class="tool-btn">
            👍
        </button>

        <button class="tool-btn">
            👎
        </button>

    </div>

    ${sourcesHTML}

</div>
        `;
        chatHistory.appendChild(msgDiv);
        const copyBtn = msgDiv.querySelector(".copy-btn");

copyBtn.addEventListener("click", () => {

    navigator.clipboard.writeText(text);

    copyBtn.innerHTML =
        '<i class="fa-solid fa-check"></i> Copied';

    setTimeout(() => {

        copyBtn.innerHTML =
        '<i class="fa-regular fa-copy"></i> Copy';

    },2000);

});
        const messageElement = msgDiv.querySelector(".message-text");

let index = 0;

const interval = setInterval(() => {

    messageElement.textContent += text[index];

    index++;

    scrollToBottom();

    if(index >= text.length){

        clearInterval(interval);

    }

},12);
        
}


    function scrollToBottom() {
        chatScrollArea.scrollTop = chatScrollArea.scrollHeight;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }

    function generateMockResponse(query) {
        const q = query.toLowerCase();
        if (q.includes('auth') || q.includes('login')) {
            return {
                text: "Authentication is implemented using JWT (JSON Web Tokens). The auth middleware intercepts incoming requests to protected routes, validates the token present in the Authorization header, and attaches the user payload to the request object. If the token is missing or invalid, it returns a 401 Unauthorized response.",
                sources: [
                    { file: "middleware/auth.js", lines: "12-45" },
                    { file: "controllers/authController.js", lines: "55-89" },
                    { file: "routes/authRoutes.js", lines: "8-24" }
                ]
            };
        } else if (q.includes('database') || q.includes('db')) {
            return {
                text: "The database connection is configured using Prisma ORM with PostgreSQL. The connection string is loaded from the environment variables (<code>DATABASE_URL</code>). The Prisma client is initialized as a singleton to prevent multiple connections during hot-reloads.",
                sources: [
                    { file: "lib/db.ts", lines: "1-15" },
                    { file: ".env.example", lines: "4-5" },
                    { file: "prisma/schema.prisma", lines: "1-12" }
                ]
            };
        } else if (q.includes('purpose') || q.includes('explain')) {
            return {
                text: "This repository provides a high-performance REST API built on modern architectural principles. Its primary purpose is to serve client applications with robust data management, secure authentication, and scalable database integrations.",
                sources: [
                    { file: "README.md", lines: "1-25" },
                    { file: "package.json", lines: "2-10" }
                ]
            };
        } else {
            return {
                text: "Based on the repository analysis, this module handles the core routing and API setup. It initializes the application, applies global middleware like CORS and body-parser, and registers the main API routers.",
                sources: [
                    { file: "src/app.js", lines: "20-65" },
                    { file: "src/routes/index.js", lines: "5-30" }
                ]
            };
        }
    }
});
