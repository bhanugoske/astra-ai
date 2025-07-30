/**
 * Astra AI Dashboard - Main Application Module
 * Professional Layout with 3D Astra, Workflow, and Chat Assistant
 */

class AstraApp {
    constructor() {
        this.dom = {};
        this.chartInstances = {};
        this.animationId = null;
        // Initialize voice synthesis system
        this.voiceSystem = {
            isSupported: 'speechSynthesis' in window,
            isEnabled: true,
            currentUtterance: null,
            roboticVoice: null,
            lastSpeechTime: 0,
            debounceDelay: 3000, // 3 second debounce - very aggressive
            isSpeaking: false
        };
        
        this.state = {
            isLoggedIn: false,
            currentUser: null,
            user: { name: "Alex Doe", email: "alex.doe@example.com" },
            workflow: { uploads: 0, analyses: 0, lastFile: null, lastUploadDate: null },
            history: [],
            reports: [],
            database: [
                { name: 'marketing_filtered.csv', type: 'CSV', rows: 300, cols: 6, date: 'Jul 2, 2025' },
                { name: 'user_data_cleaned.xlsx', type: 'Excel', rows: 512, cols: 8, date: 'Jul 1, 2025' }
            ],
            lastAnalyzedCompany: null,
            lastPrediction: { summary: "Customers over 50 in the Midwest have a 2.3x higher churn rate.", timestamp: null },
            astraChat: {
                sessions: [],
                activeSessionId: null
            },
            currentView: 'dashboard',
            isWorkspaceOpen: false
        };
        
        // Flag to track if response is from voice command
        this.isVoiceCommand = false;
        
        // Add workflow state
        this.workflowState = 'idle'; // idle, awaiting_upload, awaiting_filter, awaiting_analysis, ready_for_prediction
        this.lastStep = '';
        
        this.init();
    }

    init() {
        this.cacheDOMElements();
        this.setupEventListeners();
        this.loadVoicePreferences();
        this.initializeVoiceSystem();
        this.checkLoginStatus();
        this.renderHeaderMenu();
        this.applySavedTheme(); // NEW: Apply saved theme on load
        this.setupThemeToggle(); // NEW: Setup theme toggle button
        this.switchView('#dashboard');
        this.renderHistory();
        this.initializeAstraChat();
        this.attachWorkflowLinkHandler();
        
        // Initialize default chat session
        if (this.state.astraChat.sessions.length === 0) {
            this.createDefaultChatSession();
                 }
     }

    // Toggle voice system on/off
    toggleVoiceSystem() {
        this.voiceSystem.isEnabled = !this.voiceSystem.isEnabled;
        if (!this.voiceSystem.isEnabled) {
            this.stopSpeech();
        }
        
        // Save preference to localStorage
        localStorage.setItem('astra-voice-enabled', this.voiceSystem.isEnabled.toString());
        
        // Show notification
        const status = this.voiceSystem.isEnabled ? 'enabled' : 'disabled';
        console.log(`🤖 Voice system ${status}`);
        
        return this.voiceSystem.isEnabled;
    }

    // Load voice preferences from localStorage
    loadVoicePreferences() {
        const savedPreference = localStorage.getItem('astra-voice-enabled');
        if (savedPreference !== null) {
            this.voiceSystem.isEnabled = savedPreference === 'true';
        }
    }

    cacheDOMElements() {
        this.dom = {
            body: document.body,
            mainApp: document.getElementById('main-app'),
            astraWorkspace: document.getElementById('astra-workspace'),
            headerTitle: document.getElementById('header-title'),
            headerRightMenu: document.getElementById('header-right-menu'),
            mainSections: document.querySelectorAll('.main-section'),
            navItems: document.querySelectorAll('.nav-item'),
            dashboardSection: document.getElementById('dashboard-section'),
            predictionsContent: document.getElementById('analysis-content'),
            companySearchInput: document.getElementById('company-search-input'),
            databaseSearchInput: document.getElementById('database-search-input'),
            searchFeedback: document.getElementById('search-feedback'),
            companyInsightsContent: document.getElementById('company-insights-content'),
            databaseTableBody: document.querySelector('#database-table tbody'),
            historyLogContainer: document.getElementById('history-log-container'),
            goToPredictionsContainer: document.getElementById('go-to-analysis-container'),
            loginModal: document.getElementById('login-modal'),
            loginErrorMsg: document.getElementById('login-error-msg'),
            userNameInput: document.getElementById('user-name-input'),
            userEmailInput: document.getElementById('user-email-input'),
            profileSaveFeedback: document.getElementById('profile-save-feedback'),
            
            // New workspace elements
            workspaceElements: {
                container: document.getElementById('astra-workspace'),
                panel3D: document.querySelector('.astra-3d-panel'),
                panelWorkflow: document.querySelector('.astra-workflow-panel'),
                panelChat: document.querySelector('.astra-chat-panel'),
                chatMessages: document.querySelector('.chat-messages'),
                chatInput: document.querySelector('.chat-input'),
                chatSendBtn: document.querySelector('.chat-send-btn'),
                workflowBlocks: document.querySelectorAll('.workflow-block'),
                chatSessions: document.querySelector('.chat-sessions'),
                newChatBtn: document.querySelector('.new-chat-btn'),
                voiceBtn: document.querySelector('.astra-voice-btn'),
                closeBtn: document.querySelector('.close-btn')
            }
        };
    }

    setupEventListeners() {
        // Global click handler
        document.body.addEventListener('click', this.handleGlobalClick.bind(this));
        
        // Input handlers
        if (this.dom.companySearchInput) {
            this.dom.companySearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.searchCompany();
            });
        }
        
        if (this.dom.databaseSearchInput) {
            this.dom.databaseSearchInput.addEventListener('input', () => this.renderDatabase());
        }
        
        // Workspace specific handlers
        this.setupWorkspaceEventListeners();
        
        // Add specific listener for the data analysis workflow link
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'data-analysis-workflow-link') {
                e.preventDefault();
                this.switchView('#batch-data');
            }
        });
    }

    setupWorkspaceEventListeners() {
        const { workspaceElements } = this.dom;
        
        // Only set up event listeners once
        if (this._workspaceEventsBound) return;
        this._workspaceEventsBound = true;
        
        if (workspaceElements.chatInput) {
            workspaceElements.chatInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    await this.sendChatMessage();
                }
            });
            // Auto-resize textarea as user types
            workspaceElements.chatInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 160) + 'px';
            });
        }
        
        if (workspaceElements.chatSendBtn) {
            workspaceElements.chatSendBtn.addEventListener('click', async () => {
                await this.sendChatMessage();
            });
        }
        
        // Upload icon button logic
        const uploadBtn = document.querySelector('.chat-upload-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.multiple = true;
                fileInput.accept = '.csv,.xlsx,.xls,.json,.txt';
                fileInput.style.display = 'none';
                fileInput.addEventListener('change', async (e) => {
                    await this.handleFileUpload(e.target.files);
                    fileInput.remove();
                });
                document.body.appendChild(fileInput);
                fileInput.click();
            });
        }
        
        if (workspaceElements.voiceBtn) {
            workspaceElements.voiceBtn.addEventListener('click', () => {
                this.toggleVoiceRecording();
            });
        }
        
        if (workspaceElements.closeBtn) {
            workspaceElements.closeBtn.addEventListener('click', () => {
                this.closeWorkspace();
            });
        }
        
        // File upload handlers (for other areas, not chat)
        // this.setupFileUploadHandlers();
    }

    setupFileUploadHandlers() {
        const fileUploadArea = document.querySelector('.file-upload-area');
        if (fileUploadArea) {
            fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUploadArea.classList.add('dragover');
            });
            
            fileUploadArea.addEventListener('dragleave', () => {
                fileUploadArea.classList.remove('dragover');
            });
            
            fileUploadArea.addEventListener('drop', async (e) => {
                e.preventDefault();
                fileUploadArea.classList.remove('dragover');
                await this.handleFileUpload(e.dataTransfer.files);
            });
            
            fileUploadArea.addEventListener('click', () => {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.multiple = true;
                fileInput.accept = '.csv,.xlsx,.xls,.json,.txt';
                fileInput.addEventListener('change', async (e) => {
                    await this.handleFileUpload(e.target.files);
                });
                fileInput.click();
            });
        }
    }

    async handleGlobalClick(e) {
        const target = e.target.closest('[id], .nav-item, .chat-history-item, .workflow-block, .chat-session-item, .new-chat-btn');
        if (!target) return;
        
        const isNavLink = target.matches('.nav-item');
        const isButton = target.tagName === 'BUTTON' || target.id.startsWith('launch');
        
        if (isNavLink || isButton) {
            e.preventDefault();
        }
        
        const id = target.id;
        
        // Navigation handling
        if (isNavLink) {
            // Check if it's the Astra navigation button
            if (target.getAttribute('href') === '#astra') {
                this.speakRobotic("Ready to launch Astra workspace.");
            }
            this.switchView(target.getAttribute('href'));
        }
        // New Chat button handling
        else if (target.matches('.new-chat-btn')) {
            e.preventDefault();
            e.stopPropagation();
            this.createNewChatSession();
        }
        // Workspace launch - immediate single trigger
        else if (id === 'launch-voice-workspace' || target.closest('#astra-launch-card')) {
            // Stop all ongoing speech immediately
            speechSynthesis.cancel();
            this.voiceSystem.currentUtterance = null;
            this.voiceSystem.isSpeaking = false;
            
            // Speak immediately without any delays
            this.speakRobotic("Welcome to the Astra workspace, created by Bhanu. Where your data transforms into insight and innovation.");
            this.openWorkspace();
        }
        // Chat session handling
        else if (target.matches('.chat-session-item')) {
            this.switchChatSession(target.dataset.sessionId);
        }
        // Workflow block handling
        else if (target.matches('.workflow-block')) {
            await this.handleWorkflowBlock(target.dataset.step);
        }
        // Other button handlers
        else if (id === 'initiate-workflow-btn') {
            this.resetWorkflowView();
            this.openWorkflowModal();
        }
        else if (id === 'company-search-btn') {
            this.searchCompany();
        }
        else if (id === 'download-report-btn') {
            this.downloadReport();
        }
        else if (id === 'login-btn') {
            this.showLoginModal(true);
        }
        else if (id === 'close-login-modal-btn') {
            this.showLoginModal(false);
        }
        else if (id === 'login-submit-btn') {
            this.handleLogin();
        }
        else if (id === 'logout-btn') {
            this.handleLogout();
        }
        else if (id === 'save-profile-btn') {
            this.saveUserProfile();
        }
        else if (id === 'theme-dark-btn') {
            this.dom.body.classList.remove('light-mode');
        }
        else if (id === 'theme-light-btn') {
            this.dom.body.classList.add('light-mode');
        }
    }

    // Workspace Management
    openWorkspace() {
        this.state.isWorkspaceOpen = true;
        this.dom.mainApp.classList.add('hidden');
        this.dom.astraWorkspace.classList.remove('hidden');
        this.dom.astraWorkspace.classList.add('flex');
        
        // Initialize workspace components
        this.initializeWorkspace();
        
        // Initialize 3D model with delay to ensure DOM is ready
        setTimeout(() => {
            if (window.Astra3D) {
                console.log('Initializing Astra 3D model...');
                window.Astra3D.init();
            } else {
                console.warn('Astra3D not available, loading fallback...');
            }
        }, 100);
        
        // Dispatch event for voice system initialization
        document.dispatchEvent(new CustomEvent('astraWorkspaceOpened'));
        
        // Initialize voice system
        if (window.AstraVoice) {
            window.AstraVoice.init();
        }
    }

    closeWorkspace() {
        this.state.isWorkspaceOpen = false;
        this.dom.mainApp.classList.remove('hidden');
        this.dom.astraWorkspace.classList.add('hidden');
        this.dom.astraWorkspace.classList.remove('flex');
        
        // Clean up 3D resources
        if (window.Astra3D) {
            window.Astra3D.destroy();
        }
        
        // Reset voice system
        if (window.AstraVoice) {
            window.AstraVoice.reset();
        }
    }

    initializeWorkspace() {
        // Render chat sessions
        this.renderChatSessions();
        
        // Initialize workflow blocks
        this.initializeWorkflowBlocks();
        
        // Load active chat session
        if (this.state.astraChat.activeSessionId) {
            this.loadChatSession(this.state.astraChat.activeSessionId);
        }
        
        // Add welcome message if no active session
        if (!this.state.astraChat.activeSessionId || !this.getCurrentSession()?.messages?.length) {
            this.addSystemMessage("Welcome to Astra! I'm your AI assistant. How can I help you with your data today?");
        }
    }

    // Chat Management
    createDefaultChatSession() {
        const sessionId = 'chat_' + Date.now();
        this.state.astraChat.sessions.push({
            id: sessionId,
            name: 'General Chat',
            timestamp: new Date(),
            messages: [],
            type: 'general'
        });
        this.state.astraChat.activeSessionId = sessionId;
    }

    createNewChatSession() {
        // Prevent duplicate sessions on rapid clicks
        if (this._creatingChat) {
            console.log('Chat creation already in progress, ignoring click');
            return;
        }
        this._creatingChat = true;
        
        // Create a unique session ID with timestamp and random component
        const sessionId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        let sessionName = 'New Chat ' + (this.state.astraChat.sessions.length + 1);
        
        // Ensure unique name
        const existingNames = this.state.astraChat.sessions.map(s => s.name);
        let i = 1;
        while (existingNames.includes(sessionName)) {
            sessionName = 'New Chat ' + (this.state.astraChat.sessions.length + 1 + i);
            i++;
        }
        
        // Check if session with this ID already exists (extra protection)
        if (this.state.astraChat.sessions.some(s => s.id === sessionId)) {
            console.log('Session ID collision detected, aborting');
            this._creatingChat = false;
            return;
        }
        
        this.state.astraChat.sessions.unshift({
            id: sessionId,
            name: sessionName,
            timestamp: new Date(),
            messages: [],
            type: 'general'
        });
        this.state.astraChat.activeSessionId = sessionId;
        this.renderChatSessions();
        this.loadChatSession(sessionId);
        this.addSystemMessage("Hello! I'm Astra. How can I help you with your data today?");
        
        // Reset the flag after a delay
        setTimeout(() => { 
            this._creatingChat = false; 
        }, 1000); // Increased delay for extra safety
    }

    switchChatSession(sessionId) {
        this.state.astraChat.activeSessionId = sessionId;
        this.renderChatSessions();
        this.loadChatSession(sessionId);
    }

    loadChatSession(sessionId) {
        const session = this.getCurrentSession();
        if (!session) return;
        
        const chatMessages = this.dom.workspaceElements.chatMessages;
        if (!chatMessages) return;
        
        chatMessages.innerHTML = '';
        
        session.messages.forEach(msg => {
            this.displayChatMessage(msg.text, msg.sender, msg.timestamp);
        });
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    getCurrentSession() {
        return this.state.astraChat.sessions.find(s => s.id === this.state.astraChat.activeSessionId);
    }

    renderChatSessions() {
        const sessionsContainer = this.dom.workspaceElements.chatSessions;
        if (!sessionsContainer) return;
        let sessionsList = sessionsContainer.querySelector('.chat-sessions-list');
        if (!sessionsList) {
            sessionsList = document.createElement('div');
            sessionsList.className = 'chat-sessions-list';
            sessionsContainer.appendChild(sessionsList);
        }
        // Empty state
        if (this.state.astraChat.sessions.length === 0) {
            sessionsList.innerHTML = `<div class="chat-session-empty">No chats yet. <button class="new-chat-btn">Start a new chat</button></div>`;
            // Bind new chat button in empty state
            sessionsList.querySelector('.new-chat-btn').onclick = () => this.createNewChatSession();
            return;
        }
        sessionsList.innerHTML = this.state.astraChat.sessions.map(session => `
            <div class="chat-session-item${session.id === this.state.astraChat.activeSessionId ? ' active' : ''}" 
                 data-session-id="${session.id}" tabindex="0" aria-label="Chat session: ${session.name}">
            <div class="session-info">
                <span class="session-name">${session.name}</span>
                <span class="session-time">${this.timeAgo(session.timestamp)}</span>
                <button class="chat-session-menu-btn" data-session-id="${session.id}" tabindex="0" aria-label="Session menu">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="5" r="1.5"></circle>
                        <circle cx="12" cy="12" r="1.5"></circle>
                        <circle cx="12" cy="19" r="1.5"></circle>
                    </svg>
                </button>
                <div class="chat-session-menu" id="menu-${session.id}" style="display:none;position:absolute;z-index:10;right:10px;top:32px;background:#222;border-radius:8px;box-shadow:0 2px 8px #0002;min-width:120px;">
                    <div class="chat-session-menu-item" data-action="rename" data-session-id="${session.id}" tabindex="0">Rename</div>
                    <div class="chat-session-menu-item" data-action="share" data-session-id="${session.id}" tabindex="0">Share</div>
                    <div class="chat-session-menu-item" data-action="delete" data-session-id="${session.id}" tabindex="0">Delete</div>
                </div>
            </div>
            <div class="session-preview">
                ${session.messages.length > 0 ? session.messages[session.messages.length - 1].text.substring(0, 30) + '...' : 'No messages yet'}
            </div>
        </div>
    `).join('');
        // Only add event delegation once
        if (!this._chatSessionMenuDelegated) {
            this._chatSessionMenuDelegated = true;
            sessionsList.addEventListener('click', (e) => {
                const btn = e.target.closest('.chat-session-menu-btn');
                if (btn) {
                    e.stopPropagation();
                    document.querySelectorAll('.chat-session-menu').forEach(menu => menu.style.display = 'none');
                    const menu = document.getElementById('menu-' + btn.dataset.sessionId);
                    if (menu) menu.style.display = 'block';
                    return;
                }
                const item = e.target.closest('.chat-session-menu-item');
                if (item) {
                    e.stopPropagation();
                    document.querySelectorAll('.chat-session-menu').forEach(menu => menu.style.display = 'none');
                    const action = item.dataset.action;
                    const sessionId = item.dataset.sessionId;
                    if (action === 'rename') {
                        this.renameChatSession(sessionId);
                    } else if (action === 'share') {
                        this.shareChatSession(sessionId);
                    } else if (action === 'delete') {
                        this.deleteChatSession(sessionId);
                    }
                    return;
                }
                // Session item click
                const sessionItem = e.target.closest('.chat-session-item');
                if (sessionItem && !e.target.closest('.chat-session-menu-btn')) {
                    this.switchChatSession(sessionItem.dataset.sessionId);
                }
            });
            // Keyboard accessibility
            sessionsList.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    const sessionItem = e.target.closest('.chat-session-item');
                    if (sessionItem) {
                        this.switchChatSession(sessionItem.dataset.sessionId);
                        e.preventDefault();
                    }
                    const menuItem = e.target.closest('.chat-session-menu-item');
                    if (menuItem) {
                        const action = menuItem.dataset.action;
                        const sessionId = menuItem.dataset.sessionId;
                        if (action === 'rename') this.renameChatSession(sessionId);
                        else if (action === 'share') this.shareChatSession(sessionId);
                        else if (action === 'delete') this.deleteChatSession(sessionId);
                        document.querySelectorAll('.chat-session-menu').forEach(menu => menu.style.display = 'none');
                        e.preventDefault();
                    }
                } else if (e.key === 'Escape') {
                    document.querySelectorAll('.chat-session-menu').forEach(menu => menu.style.display = 'none');
                }
            });
            // Close menus on outside click
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.chat-session-menu-btn') && !e.target.closest('.chat-session-menu')) {
                    document.querySelectorAll('.chat-session-menu').forEach(menu => menu.style.display = 'none');
                }
            });
        }
    }

    async sendChatMessage() {
        const input = this.dom.workspaceElements.chatInput;
        if (!input) return;
        
        const message = input.value.trim();
        if (!message) return;
        
        // Add user message
        this.addChatMessage(message, 'user');
        input.value = '';
        // Show Astra typing animation
        this.showAstraTyping();
        // Process message and get response
        await this.processUserMessage(message);
        // Remove Astra typing animation
        this.removeAstraTyping();
    }

    showAstraTyping() {
        const chatMessages = this.dom.workspaceElements.chatMessages;
        if (!chatMessages) return;
        // Remove any existing typing indicator first
        this.removeAstraTyping();
        const typingEl = document.createElement('div');
        typingEl.className = 'chat-message assistant astra-typing-indicator';
        typingEl.innerHTML = `<div class="astra-typing"><span></span><span></span><span></span></div>`;
        chatMessages.appendChild(typingEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    removeAstraTyping() {
        const chatMessages = this.dom.workspaceElements.chatMessages;
        if (!chatMessages) return;
        const typingEl = chatMessages.querySelector('.astra-typing-indicator');
        if (typingEl) typingEl.remove();
    }

    addChatMessage(text, sender, timestamp = new Date()) {
        const session = this.getCurrentSession();
        if (session) {
            session.messages.push({
                text,
                sender,
                timestamp
            });
        }
        
        this.displayChatMessage(text, sender, timestamp);
        this.renderChatSessions(); // Update session preview
    }

    addSystemMessage(text) {
        this.addChatMessage(text, 'system');
    }

    displayChatMessage(text, sender, timestamp) {
        const chatMessages = this.dom.workspaceElements.chatMessages;
        if (!chatMessages) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${sender}`;
        
        if (sender === 'system') {
            messageEl.innerHTML = `<div class="message-content">${text}</div>`;
        } else {
            messageEl.innerHTML = `
                <div class="message-content">${text}</div>
                <div class="message-time">${this.formatTime(timestamp)}</div>
            `;
        }
        
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async processUserMessage(message) {
        const lower = message.trim().toLowerCase();
        
        // Enhanced Autonomous Navigation Commands
        if (await this.handleNavigationCommands(lower, message)) {
            return;
        }
        
        // Enhanced Workflow Commands
        if (await this.handleWorkflowCommands(lower, message)) {
            return;
        }
        
        // Enhanced Context-Aware Commands
        if (await this.handleContextAwareCommands(lower, message)) {
            return;
        }
        
        // Enhanced Data Commands
        if (await this.handleDataCommands(lower, message)) {
            return;
        }
        
        // Legacy workflow handling (keeping for backward compatibility)
        if (lower === 'help me with my data' && this.workflowState === 'idle') {
            this.workflowState = 'awaiting_upload';
            this.lastStep = 'awaiting_upload';
            this.addChatMessage('Sure, please upload your file, sir.', 'assistant');
            this.speakIfVoiceCommand('Sure, please upload your file, sir.');
            return;
        }
        
        if (this.workflowState === 'awaiting_filter' && lower === 'yes') {
            this.showFilterUI();
            this.workflowState = 'filtering';
            this.lastStep = 'filtering';
            return;
        }
        
        if ((this.workflowState === 'awaiting_analysis' && (lower === 'yes' || lower.includes('analyz'))) || (this.workflowState === 'ready_for_analysis' && (lower === 'yes' || lower.includes('analyz')))) {
            this.workflowState = 'analyzing';
            this.lastStep = 'analyzing';
            this.addChatMessage('Analyzing the data now, sir.', 'assistant');
            this.speakIfVoiceCommand('Analyzing the data now, sir.');
            this.runAnalysis();
            return;
        }
        
        if (lower.includes('predict') || lower.includes('next 7 days sales')) {
            this.workflowState = 'predicting';
            this.lastStep = 'predicting';
            this.addChatMessage('Here are the predictions you requested, sir.', 'assistant');
            this.speakIfVoiceCommand('Here are the predictions you requested, sir.');
            this.showPrediction();
            return;
        }

        // Fallback: send to backend chat API if not handled above
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    context: {
                        currentView: this.state.currentView,
                        workflowState: this.workflowState,
                        isWorkspaceOpen: this.state.isWorkspaceOpen,
                        lastStep: this.lastStep
                    }
                })
            });
            const data = await response.json();
            if (data.response) {
                this.addChatMessage(data.response, 'assistant');
                this.speakIfVoiceCommand(data.response);
                if (data.triggers) {
                    this.handleUITriggers(data.triggers);
                }
            } else if (data.error) {
                const errorMsg = 'Sorry, I could not process your request.';
                this.addChatMessage(errorMsg, 'assistant');
                this.speakIfVoiceCommand(errorMsg);
            }
        } catch (error) {
            const errorMsg = 'Sorry, there was a problem connecting to the assistant.';
            this.addChatMessage(errorMsg, 'assistant');
            this.speakIfVoiceCommand(errorMsg);
        }
    }

    // Workflow Management
    initializeWorkflowBlocks() {
        const blocks = document.querySelectorAll('.workflow-block');
        blocks.forEach(block => {
            // Remove click event listeners - workflow blocks should only be activated by Astra
            block.style.cursor = 'default'; // Change cursor to indicate they're not clickable
            block.classList.add('disabled'); // Start with all blocks disabled
        });
    }

    async handleWorkflowBlock(step) {
        const block = document.querySelector(`[data-step="${step}"]`);
        if (!block || block.classList.contains('disabled')) return;
        
        // Only allow execution if the block is active (triggered by Astra)
        if (!block.classList.contains('active')) {
            return;
        }
        
        switch (step) {
            case 'upload':
                await this.handleUploadWorkflow();
                break;
            case 'filter':
                this.handleFilterWorkflow();
                break;
            case 'database':
                this.handleDatabaseWorkflow();
                break;
            case 'analysis':
                this.handleAnalysisWorkflow();
                break;
        }
    }

    triggerWorkflowStep(step) {
        const block = document.querySelector(`[data-step="${step}"]`);
        if (!block) return;
        
        // Reset all blocks to disabled state
        document.querySelectorAll('.workflow-block').forEach(b => {
            b.classList.remove('active', 'completed', 'processing');
            b.classList.add('disabled');
            b.style.cursor = 'default';
        });
        
        // Activate current block and enable it for interaction
        block.classList.add('active');
        block.classList.remove('disabled');
        block.style.cursor = 'pointer';
        
        // Add visual feedback
        block.classList.add('bounce-in');
        setTimeout(() => {
            block.classList.remove('bounce-in');
        }, 600);
    }

    async handleUploadWorkflow() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = '.csv,.xlsx,.xls,.json,.txt';
        fileInput.addEventListener('change', async (e) => {
            await this.handleFileUpload(e.target.files);
        });
        fileInput.click();
    }

    async handleFilterWorkflow() {
        const filterCondition = prompt("Enter filter condition (e.g., age > 30, status = 'active'):");
        if (filterCondition) {
            this.addChatMessage(`Filter applied: ${filterCondition}`, 'assistant');
            
            // Store the filtered data for use in database step
            this.filteredData = {
                data: this.generateSampleFilteredData(filterCondition),
                filterCondition: filterCondition,
                timestamp: new Date().toISOString()
            };
            
            this.completeWorkflowStep('filter');
            this.triggerWorkflowStep('database');
        }
    }

    async handleDatabaseWorkflow() {
        try {
            this.addChatMessage("Saving filtered data to database...", 'assistant');
            
            // Prepare data for saving
            const saveData = {
                data: this.filteredData?.data || this.generateSampleFilteredData("sample data"),
                filename: `filtered_${Date.now()}`
            };
            
            // Call the backend API to save data
            const response = await fetch('/api/save_filtered', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(saveData)
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.addChatMessage(
                    `✅ Data saved successfully!\n` +
                    `📄 File: ${result.filename}\n` +
                    `📊 ${result.rows} rows, ${result.columns} columns\n` +
                    `💾 Size: ${(result.size / 1024).toFixed(2)} KB`, 
                    'assistant'
                );
                
                // Refresh the database section to show the new file
                await this.refreshDatabaseSection();
                
                this.completeWorkflowStep('database');
                this.triggerWorkflowStep('analysis');
            } else {
                this.addChatMessage(`❌ Error saving data: ${result.error}`, 'assistant');
            }
            
        } catch (error) {
            console.error('Database workflow error:', error);
            this.addChatMessage('❌ Failed to save data to database. Please try again.', 'assistant');
        }
    }

    handleAnalysisWorkflow() {
        this.addChatMessage("Analysis complete! Generated insights and visualizations are ready.", 'assistant');
        this.completeWorkflowStep('analysis');
        
        // Update workflow state
        this.state.workflow.analyses++;
        this.state.lastPrediction.timestamp = new Date();
        
        // Offer to view results
        setTimeout(() => {
            this.addChatMessage("Would you like to view the analysis results in the Data Analysis section?", 'assistant');
        }, 1000);
    }

    completeWorkflowStep(step) {
        const block = document.querySelector(`[data-step="${step}"]`);
        if (block) {
            block.classList.remove('active', 'processing');
            block.classList.add('completed');
            // Disable the block after completion
            block.classList.add('disabled');
            block.style.cursor = 'default';
        }
    }

    async handleFileUpload(fileList) {
        if (!fileList || fileList.length === 0) return;
        const file = fileList[0];
        // Check for large fields if CSV
        if (file.name.endsWith('.csv')) {
            const text = await this.readFileAsText(file);
            const lines = text.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const fields = lines[i].split(',');
                for (let field of fields) {
                    if (field.length > 100000) {
                        alert('One or more fields in your file are extremely large (over 100,000 characters). Please check your data.');
                        return;
                    }
                }
            }
        }
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch('/api/upload-file', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                this.onFileUploaded();
                this.fetchAndDisplayFiles();
            } else {
                this.addChatMessage('File upload failed, sir.', 'assistant');
            }
        } catch (e) {
            this.addChatMessage('File upload error, sir.', 'assistant');
        }
    }

    async fetchAndDisplayFiles() {
        try {
            const response = await fetch('/api/files');
            const files = await response.json();
            // Display files in a UI section (implement as needed)
            this.renderFileList(files);
        } catch (e) {
            // Optionally show error
        }
    }

    renderFileList(files) {
        // Example: show in a sidebar or modal
        const container = document.getElementById('astra-file-list');
        if (!container) return;
        container.innerHTML = files.map(f =>
            `<div class="file-item">
                <span>${f.filename}</span>
                <button onclick="astraApp.downloadFile(${f.id})">Download</button>
            </div>`
        ).join('');
    }

    async downloadFile(fileId) {
        window.open(`/api/download-file/${fileId}`, '_blank');
    }

    displayFilePreview(fileInfo) {
        const chatMessages = this.dom.workspaceElements.chatMessages;
        if (!chatMessages) return;
        
        const previewEl = document.createElement('div');
        previewEl.className = 'file-preview';
        previewEl.innerHTML = `
            <div class="file-preview-header">
                <span class="file-preview-name">${fileInfo.name}</span>
                <span class="file-preview-size">${fileInfo.size}</span>
            </div>
            <div class="file-preview-content">
                Type: ${fileInfo.type}<br>
                Modified: ${this.formatTime(fileInfo.lastModified)}
            </div>
        `;
        
        chatMessages.appendChild(previewEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    displayFileAnalysis(fileInfo, analysis) {
        const chatMessages = this.dom.workspaceElements.chatMessages;
        if (!chatMessages) return;
        
        const analysisEl = document.createElement('div');
        analysisEl.className = 'file-analysis';
        analysisEl.innerHTML = `
            <div class="file-analysis-header">
                <span class="file-analysis-title">📊 Data Analysis Results</span>
                <span class="file-analysis-filename">${fileInfo.filename}</span>
            </div>
            <div class="file-analysis-stats">
                <div class="stat-item">
                    <span class="stat-label">Rows:</span>
                    <span class="stat-value">${fileInfo.rows}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Columns:</span>
                    <span class="stat-value">${fileInfo.columns}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Missing Values:</span>
                    <span class="stat-value">${Object.values(fileInfo.missing_values).reduce((a, b) => a + b, 0)}</span>
                </div>
            </div>
            <div class="file-analysis-content">
                <div class="analysis-text">${analysis}</div>
            </div>
        `;
        
        chatMessages.appendChild(analysisEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Voice Integration
    toggleVoiceRecording() {
        if (window.AstraVoice) {
            window.AstraVoice.toggle();
        }
    }

    async onVoiceResult(transcript) {
        console.log('onVoiceResult called with:', transcript);
        
        // Set flag to indicate this is a voice command
        this.isVoiceCommand = true;
        
        // Add voice input as user message
        this.addChatMessage(transcript, 'user');
        
        // Process the voice command
        await this.processUserMessage(transcript);
    }

    // Make Astra speak (ONLY for voice commands, not chat)
    speak(text) {
        // Only speak if this is a voice command response, not a chat response
        if (!window.speechSynthesis) return;
        let utter = new window.SpeechSynthesisUtterance();
        // Always address as 'sir'
        utter.text = text.endsWith('sir.') ? text : text.replace(/([.!?])$/, ', sir$1');
        // Find best available male voice (not Jarvis, but confident, warm, professional)
        const voices = window.speechSynthesis.getVoices();
        let preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male'))
          || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('wavenet') && v.name.toLowerCase().includes('b'))
          || voices.find(v => v.lang.startsWith('en') && v.gender === 'male')
          || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('english'))
          || voices.find(v => v.lang.startsWith('en'))
          || voices[0];
        if (preferredVoice) utter.voice = preferredVoice;
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        // Add emotional inflection if supported
        if ('emotion' in utter) utter.emotion = 'calm';
        if ('style' in utter) utter.style = 'conversational';
        window.speechSynthesis.cancel(); // Stop any previous speech
        window.speechSynthesis.speak(utter);
    }

    // Handle UI triggers from API responses
    handleUITriggers(triggers) {
        console.log('Handling UI triggers:', triggers);
        
        triggers.forEach(trigger => {
            switch (trigger) {
                case 'upload_card':
                    this.triggerWorkflowStep('upload');
                    break;
                case 'filter_card':
                    this.triggerWorkflowStep('filter');
                    break;
                case 'analysis_card':
                    this.triggerWorkflowStep('analysis');
                    break;
                case 'database_card':
                    this.triggerWorkflowStep('database');
                    break;
                default:
                    console.log('Unknown trigger:', trigger);
            }
        });
    }

    // Navigation and View Management
    switchView(targetId) {
        if (targetId === 'astra-workspace') {
            this.openWorkspace();
            return;
        }
        
        if (targetId.startsWith("#")) {
            const actualId = targetId.substring(1);
            this.state.currentView = actualId;
            
            // Update navigation
            const navItemsArr = Array.from(this.dom.navItems);
            navItemsArr.forEach(nav => 
                nav.classList.toggle('active', nav.getAttribute('href') === targetId)
            );
            
            // Show the target section
            this.dom.mainSections.forEach(section => {
                section.classList.toggle('active', section.id === `${actualId}-section`);
            });
            
            // Update header
            const headerTitle = this.dom.headerTitle;
            if (headerTitle) {
                const navItem = navItemsArr.find(nav => nav.getAttribute('href') === targetId);
                headerTitle.textContent = navItem ? navItem.textContent.trim() : 'Dashboard';
            }
            
            // Special handling for data analysis section
            if (actualId === 'data-analysis' && this.state.lastAnalysis) {
                this.renderAnalysisResults();
            }
            
            // Render section content
            this.renderSectionContent(actualId);
        }
    }

    // Render comprehensive analysis results
    renderAnalysisResults() {
        const analysisContent = document.getElementById('analysis-content');
        const analysisStatus = document.getElementById('analysis-status');
        if (!analysisContent || !this.state.lastAnalysis) return;
        const { file_info, statistics, categorical_stats, insights, model_suggestions, forecast, forecast_results } = this.state.lastAnalysis;
        // Update status
        if (analysisStatus) {
            analysisStatus.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="flex items-center gap-2">
                        <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Analysis Complete - ${new Date().toLocaleTimeString()}
                    </span>
                    <button onclick="astraApp.downloadAnalysisReport()" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7,10 12,15 17,10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download Report
                    </button>
                </div>
            `;
        }
        // Enhanced Model suggestions with clickable actions
        let modelHtml = '';
        if (model_suggestions && model_suggestions.length > 0) {
            modelHtml = `<div class='bg-card p-6 rounded-2xl border border-main'><h3 class='text-xl font-semibold text-main mb-4'>🤖 AI Model Suggestions</h3><div class='space-y-3'>`;
            modelHtml += model_suggestions.map(s => `
                <div class='flex items-center justify-between p-3 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-500/30 hover:border-blue-400/50 transition-all cursor-pointer' onclick='astraApp.handleModelSuggestionClick("${s}")'>
                    <div class='flex items-center gap-3'>
                        <div class='w-2 h-2 bg-blue-400 rounded-full animate-pulse'></div>
                        <span class='text-main font-medium'>${s}</span>
                    </div>
                    <button class='px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors'>
                        Try This Model
                    </button>
                </div>
            `).join('');
            modelHtml += `</div></div>`;
        }
        // Enhanced Forecast section with time range selector and color coding
        let forecastHtml = '';
        if (forecast_results && Object.keys(forecast_results).length > 0) {
            forecastHtml = `<div class='bg-card p-6 rounded-2xl border border-main'><h3 class='text-xl font-semibold text-main mb-4'>🔮 Predictive Forecast</h3>`;
            
            // Time range selector
            forecastHtml += `<div class='mb-4'><div class='flex gap-2 mb-4'>`;
            const timeRanges = [
                { key: 'next_7_days', label: '7 Days', icon: '📅' },
                { key: 'next_4_weeks', label: '4 Weeks', icon: '📆' },
                { key: 'next_quarter', label: 'Quarter', icon: '🗓️' }
            ];
            
            timeRanges.forEach((range, index) => {
                const isActive = index === 0 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600';
                forecastHtml += `<button class='px-4 py-2 rounded-lg ${isActive} transition-colors text-sm font-medium' onclick='astraApp.switchForecastRange("${range.key}")' id='forecast-btn-${range.key}'>${range.icon} ${range.label}</button>`;
            });
            forecastHtml += `</div></div>`;
            
            // Forecast content container
            forecastHtml += `<div id='forecast-content'>`;
            
            // Default to first available range
            const defaultRange = Object.keys(forecast_results)[0];
            const defaultForecast = forecast_results[defaultRange];
            
            if (defaultForecast && defaultForecast.length > 0) {
                // Forecast table with color coding
                forecastHtml += `<div class='grid grid-cols-1 lg:grid-cols-2 gap-6'><div><h4 class='font-semibold text-main mb-3'>Forecast Values</h4><div class='overflow-x-auto'><table class='w-full text-sm'><thead><tr class='border-b border-main'><th class='text-left p-2 text-muted'>Date</th><th class='text-left p-2 text-muted'>Predicted</th><th class='text-left p-2 text-muted'>Range</th><th class='text-left p-2 text-muted'>Trend</th></tr></thead><tbody>`;
                
                defaultForecast.forEach(row => {
                    const trendColor = row.trend === 'increase' ? 'text-green-400' : row.trend === 'decrease' ? 'text-red-400' : 'text-gray-400';
                    const trendIcon = row.trend === 'increase' ? '📈' : row.trend === 'decrease' ? '📉' : '➡️';
                    const confidenceRange = `${row.lower_bound.toFixed(2)} - ${row.upper_bound.toFixed(2)}`;
                    
                    forecastHtml += `<tr class='border-b border-main/20'><td class='p-2 text-main'>${row.date}</td><td class='p-2 text-main font-medium'>${row.predicted.toFixed(2)}</td><td class='p-2 text-muted text-xs'>${confidenceRange}</td><td class='p-2 ${trendColor}'>${trendIcon} ${row.trend}</td></tr>`;
                });
                
                forecastHtml += `</tbody></table></div></div>`;
                
                // Chart container
                forecastHtml += `<div><h4 class='font-semibold text-main mb-3'>Forecast Chart</h4><div class='bg-gray-800 rounded-lg p-4'><canvas id='forecast-chart-canvas' width='400' height='200'></canvas></div></div></div>`;
            }
            
            forecastHtml += `</div></div>`;
            
            // Initialize chart after DOM update
            setTimeout(() => {
                this.initializeForecastChart(defaultRange, forecast_results);
            }, 100);
        } else if (forecast && Array.isArray(forecast) && forecast.length > 0) {
            // Fallback for old format
            forecastHtml = `<div class='bg-card p-6 rounded-2xl border border-main'><h3 class='text-xl font-semibold text-main mb-4'>🔮 Forecast (next ${forecast.length})</h3><div class='overflow-x-auto'><table class='w-full text-sm'><thead><tr class='border-b border-main'><th class='text-left p-2 text-muted'>Date</th><th class='text-left p-2 text-muted'>Predicted</th></tr></thead><tbody>`;
            forecast.forEach(row => {
                forecastHtml += `<tr class='border-b border-main/20'><td class='p-2 text-main'>${row.date}</td><td class='p-2 text-main'>${row.predicted.toFixed(2)}</td></tr>`;
            });
            forecastHtml += `</tbody></table></div></div>`;
        }
        // Create comprehensive analysis display
        let summary = `<div class='space-y-8'>`;
        summary += `<div class='bg-card p-6 rounded-2xl border border-main'>`;
        summary += `<div class='flex items-center justify-between mb-4'><h3 class='text-xl font-semibold text-main'>📁 File Overview</h3><span class='text-sm text-muted'>${file_info.filename}</span></div>`;
        summary += `<div class='grid grid-cols-2 md:grid-cols-4 gap-4'>`;
        summary += `<div class='text-center'><div class='text-2xl font-bold text-blue-400'>${file_info.rows.toLocaleString()}</div><div class='text-sm text-muted'>Rows</div></div>`;
        summary += `<div class='text-center'><div class='text-2xl font-bold text-green-400'>${file_info.columns}</div><div class='text-sm text-muted'>Columns</div></div>`;
        summary += `<div class='text-center'><div class='text-2xl font-bold text-orange-400'>${file_info.total_missing.toLocaleString()}</div><div class='text-sm text-muted'>Missing Values</div></div>`;
        summary += `<div class='text-center'><div class='text-2xl font-bold text-purple-400'>${file_info.duplicate_rows.toLocaleString()}</div><div class='text-sm text-muted'>Duplicates</div></div>`;
        summary += `</div></div>`;
        summary += `<div class='bg-card p-6 rounded-2xl border border-main'><h3 class='text-xl font-semibold text-main mb-4'>🔍 Data Quality Assessment</h3><div class='space-y-4'><div class='grid grid-cols-1 md:grid-cols-2 gap-4'><div><h4 class='font-semibold text-main mb-2'>Column Information</h4><div class='space-y-2 max-h-40 overflow-y-auto'>${file_info.column_names.map(col => `<div class='flex justify-between items-center text-sm'><span class='text-muted'>${col}</span><span class='text-main'>${file_info.data_types[col]}</span></div>`).join('')}</div></div><div><h4 class='font-semibold text-main mb-2'>Missing Values</h4><div class='space-y-2 max-h-40 overflow-y-auto'>${Object.entries(file_info.missing_values).map(([col, count]) => {
            const percentage = file_info.missing_percentages ? file_info.missing_percentages[col] : 0;
            return `<div class='flex justify-between items-center text-sm'><span class='text-muted'>${col}</span><span class='text-${count > 0 ? 'red' : 'green'}-400'>${count} (${percentage.toFixed(1)}%)</span></div>`;
        }).join('')}</div></div></div></div></div>`;
        if (statistics && Object.keys(statistics).length > 0) {
            summary += `<div class='bg-card p-6 rounded-2xl border border-main'><h3 class='text-xl font-semibold text-main mb-4'>📊 Statistical Analysis</h3><div class='overflow-x-auto'><table class='w-full text-sm'><thead><tr class='border-b border-main'><th class='text-left p-2 text-muted'>Column</th><th class='text-left p-2 text-muted'>Count</th><th class='text-left p-2 text-muted'>Mean</th><th class='text-left p-2 text-muted'>Median</th><th class='text-left p-2 text-muted'>Std</th><th class='text-left p-2 text-muted'>Min</th><th class='text-left p-2 text-muted'>Max</th></tr></thead><tbody>${Object.entries(statistics).map(([col, stats]) => `<tr class='border-b border-main/20'><td class='p-2 text-main font-medium'>${col}</td><td class='p-2 text-main'>${stats.count.toLocaleString()}</td><td class='p-2 text-main'>${stats.mean.toFixed(2)}</td><td class='p-2 text-main'>${stats['50%'].toFixed(2)}</td><td class='p-2 text-main'>${stats.std.toFixed(2)}</td><td class='p-2 text-main'>${stats.min.toFixed(2)}</td><td class='p-2 text-main'>${stats.max.toFixed(2)}</td></tr>`).join('')}</tbody></table></div></div>`;
        }
        if (categorical_stats && Object.keys(categorical_stats).length > 0) {
            summary += `<div class='bg-card p-6 rounded-2xl border border-main'><h3 class='text-xl font-semibold text-main mb-4'>📈 Categorical Analysis</h3><div class='space-y-4'>${Object.entries(categorical_stats).map(([col, stats]) => `<div class='border border-main rounded-lg p-4'><h4 class='font-semibold text-main mb-3'>${col}</h4><div class='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'><div><span class='text-muted'>Unique Values:</span><span class='text-main ml-2'>${stats.unique_values}</span></div><div><span class='text-muted'>Null Count:</span><span class='text-main ml-2'>${stats.null_count}</span></div></div><div class='mt-3'><span class='text-muted text-sm'>Top Values:</span><div class='mt-2 space-y-1'>${Object.entries(stats.top_values).map(([value, count]) => `<div class='flex justify-between items-center text-sm'><span class='text-muted'>${value}</span><span class='text-main'>${count}</span></div>`).join('')}</div></div></div>`).join('')}</div></div>`;
        }
        summary += `<div class='bg-card p-6 rounded-2xl border border-main'><h3 class='text-xl font-semibold text-main mb-4'>📝 Data Insights</h3><ul class='list-disc pl-6 text-main space-y-1'>${insights.map(item => `<li>${item}</li>`).join('')}</ul></div>`;
        if (file_info.top_5_rows && file_info.top_5_rows.length > 0) {
            summary += `<div class='bg-card p-6 rounded-2xl border border-main'><h3 class='text-xl font-semibold text-main mb-4'>📋 Data Preview</h3>`;
            summary += `<div class='mb-6'><h4 class='font-semibold text-main mb-2'>Top 5 Rows</h4><div class='overflow-x-auto'><table class='w-full text-sm'><thead><tr class='border-b border-main'>${file_info.column_names.map(col => `<th class='text-left p-2 text-muted'>${col}</th>`).join('')}</tr></thead><tbody>${file_info.top_5_rows.map(row => `<tr class='border-b border-main/20'>${file_info.column_names.map(col => `<td class='p-2 text-main'>${row[col] !== null && row[col] !== undefined ? row[col] : '<span class="text-muted">null</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
            if (file_info.bottom_5_rows && file_info.bottom_5_rows.length > 0) {
                summary += `<div><h4 class='font-semibold text-main mb-2'>Bottom 5 Rows</h4><div class='overflow-x-auto'><table class='w-full text-sm'><thead><tr class='border-b border-main'>${file_info.column_names.map(col => `<th class='text-left p-2 text-muted'>${col}</th>`).join('')}</tr></thead><tbody>${file_info.bottom_5_rows.map(row => `<tr class='border-b border-main/20'>${file_info.column_names.map(col => `<td class='p-2 text-main'>${row[col] !== null && row[col] !== undefined ? row[col] : '<span class="text-muted">null</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
            }
            summary += `</div>`;
        }
        summary += modelHtml;
        summary += forecastHtml;
        summary += `</div>`;
        analysisContent.innerHTML = summary;
    }

    // Handle model suggestion clicks
    handleModelSuggestionClick(suggestion) {
        const prompt = `Please help me implement: ${suggestion}`;
        
        // Add to chat if workspace is open
        if (this.state.isWorkspaceOpen) {
            const input = this.dom.workspaceElements.chatInput;
            if (input) {
                input.value = prompt;
                input.focus();
            }
        } else {
            // Open workspace and set prompt
            this.openWorkspace();
            setTimeout(() => {
                const input = this.dom.workspaceElements.chatInput;
                if (input) {
                    input.value = prompt;
                    input.focus();
                }
            }, 500);
        }
    }

    // Switch forecast time range
    switchForecastRange(rangeKey) {
        if (!this.state.lastAnalysis || !this.state.lastAnalysis.forecast_results) return;
        
        const forecast_results = this.state.lastAnalysis.forecast_results;
        const forecastData = forecast_results[rangeKey];
        
        if (!forecastData) return;
        
        // Update button states
        document.querySelectorAll('[id^="forecast-btn-"]').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
        });
        
        const activeBtn = document.getElementById(`forecast-btn-${rangeKey}`);
        if (activeBtn) {
            activeBtn.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
            activeBtn.classList.add('bg-blue-600', 'text-white');
        }
        
        // Update forecast content
        this.updateForecastContent(rangeKey, forecastData);
        this.initializeForecastChart(rangeKey, forecast_results);
    }

    // Update forecast content
    updateForecastContent(rangeKey, forecastData) {
        const container = document.getElementById('forecast-content');
        if (!container) return;
        
        let content = `<div class='grid grid-cols-1 lg:grid-cols-2 gap-6'><div><h4 class='font-semibold text-main mb-3'>Forecast Values</h4><div class='overflow-x-auto'><table class='w-full text-sm'><thead><tr class='border-b border-main'><th class='text-left p-2 text-muted'>Date</th><th class='text-left p-2 text-muted'>Predicted</th><th class='text-left p-2 text-muted'>Range</th><th class='text-left p-2 text-muted'>Trend</th></tr></thead><tbody>`;
        
        forecastData.forEach(row => {
            const trendColor = row.trend === 'increase' ? 'text-green-400' : row.trend === 'decrease' ? 'text-red-400' : 'text-gray-400';
            const trendIcon = row.trend === 'increase' ? '📈' : row.trend === 'decrease' ? '📉' : '➡️';
            const confidenceRange = `${row.lower_bound.toFixed(2)} - ${row.upper_bound.toFixed(2)}`;
            
            content += `<tr class='border-b border-main/20'><td class='p-2 text-main'>${row.date}</td><td class='p-2 text-main font-medium'>${row.predicted.toFixed(2)}</td><td class='p-2 text-muted text-xs'>${confidenceRange}</td><td class='p-2 ${trendColor}'>${trendIcon} ${row.trend}</td></tr>`;
        });
        
        content += `</tbody></table></div></div>`;
        content += `<div><h4 class='font-semibold text-main mb-3'>Forecast Chart</h4><div class='bg-gray-800 rounded-lg p-4'><canvas id='forecast-chart-canvas' width='400' height='200'></canvas></div></div></div>`;
        
        container.innerHTML = content;
    }

    // Initialize forecast chart
    initializeForecastChart(rangeKey, forecast_results) {
        const canvas = document.getElementById('forecast-chart-canvas');
        if (!canvas || !window.Chart) return;
        
        const forecastData = forecast_results[rangeKey];
        if (!forecastData || forecastData.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.forecastChart) {
            this.forecastChart.destroy();
        }
        
        const labels = forecastData.map(f => f.date);
        const predicted = forecastData.map(f => f.predicted);
        const upperBound = forecastData.map(f => f.upper_bound);
        const lowerBound = forecastData.map(f => f.lower_bound);
        
        this.forecastChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Forecast',
                    data: predicted,
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96,165,250,0.2)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                }, {
                    label: 'Upper Bound',
                    data: upperBound,
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52,211,153,0.1)',
                    borderWidth: 1,
                    fill: '+1',
                    tension: 0.4
                }, {
                    label: 'Lower Bound',
                    data: lowerBound,
                    borderColor: '#f87171',
                    backgroundColor: 'rgba(248,113,113,0.1)',
                    borderWidth: 1,
                    fill: false,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e2e8f0',
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#e2e8f0',
                        borderColor: '#475569',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date',
                            color: '#94a3b8'
                        },
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Predicted Value',
                            color: '#94a3b8'
                        },
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' }
                    }
                }
            }
        });
    }

    // Download analysis report as PDF
    async downloadAnalysisReport() {
        if (!this.state.lastAnalysis) {
            alert('No analysis data available to download.');
            return;
        }

        try {
            // Check if html2pdf is available
            if (typeof html2pdf === 'undefined') {
                // Fallback: create a simple text report
                this.downloadTextReport();
                return;
            }

            const { file_info, statistics, categorical_stats, insights, model_suggestions, forecast_results } = this.state.lastAnalysis;
            
            // Create a clean report HTML
            const reportHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1e40af; margin-bottom: 10px;">Astra AI Data Analysis Report</h1>
                        <p style="color: #64748b; font-size: 14px;">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                    </div>
                    
                    <div style="margin-bottom: 30px;">
                        <h2 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">📁 File Overview</h2>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px;">
                            <div style="text-align: center; padding: 15px; background: #f8fafc; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${file_info.rows.toLocaleString()}</div>
                                <div style="font-size: 12px; color: #64748b;">Rows</div>
                            </div>
                            <div style="text-align: center; padding: 15px; background: #f8fafc; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #10b981;">${file_info.columns}</div>
                                <div style="font-size: 12px; color: #64748b;">Columns</div>
                            </div>
                            <div style="text-align: center; padding: 15px; background: #f8fafc; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${file_info.total_missing.toLocaleString()}</div>
                                <div style="font-size: 12px; color: #64748b;">Missing Values</div>
                            </div>
                            <div style="text-align: center; padding: 15px; background: #f8fafc; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${file_info.duplicate_rows.toLocaleString()}</div>
                                <div style="font-size: 12px; color: #64748b;">Duplicates</div>
                            </div>
                        </div>
                    </div>
                    
                    ${statistics && Object.keys(statistics).length > 0 ? `
                    <div style="margin-bottom: 30px;">
                        <h2 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">📊 Statistical Analysis</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                            <thead>
                                <tr style="background: #f8fafc;">
                                    <th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">Column</th>
                                    <th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">Count</th>
                                    <th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">Mean</th>
                                    <th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">Median</th>
                                    <th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">Std</th>
                                    <th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">Min</th>
                                    <th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">Max</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(statistics).map(([col, stats]) => `
                                    <tr>
                                        <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold;">${col}</td>
                                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${stats.count.toLocaleString()}</td>
                                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${stats.mean.toFixed(2)}</td>
                                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${stats['50%'].toFixed(2)}</td>
                                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${stats.std.toFixed(2)}</td>
                                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${stats.min.toFixed(2)}</td>
                                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${stats.max.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}
                    
                    <div style="margin-bottom: 30px;">
                        <h2 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">📝 Data Insights</h2>
                        <ul style="margin-top: 20px; padding-left: 20px;">
                            ${insights.map(item => `<li style="margin-bottom: 8px; color: #374151;">${item}</li>`).join('')}
                        </ul>
                    </div>
                    
                    ${model_suggestions && model_suggestions.length > 0 ? `
                    <div style="margin-bottom: 30px;">
                        <h2 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">🤖 AI Model Suggestions</h2>
                        <div style="margin-top: 20px;">
                            ${model_suggestions.map(s => `
                                <div style="padding: 12px; margin-bottom: 8px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                                    ${s}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${forecast_results && Object.keys(forecast_results).length > 0 ? `
                    <div style="margin-bottom: 30px;">
                        <h2 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">🔮 Forecast Results</h2>
                        <p style="margin-top: 20px; color: #64748b; font-size: 14px;">
                            Predictive forecasting has been generated for multiple time horizons. 
                            The forecast includes confidence intervals and trend analysis.
                        </p>
                    </div>
                    ` : ''}
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
                        <p style="color: #64748b; font-size: 12px;">
                            This report was generated by Astra AI Dashboard<br>
                            For questions or support, contact your data analysis team
                        </p>
                    </div>
                </div>
            `;

            // Create a temporary element
            const element = document.createElement('div');
            element.innerHTML = reportHtml;

            // Configure PDF options
            const options = {
                margin: 0.5,
                filename: `astra-analysis-report-${file_info.filename}-${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            // Generate and download PDF
            await html2pdf().set(options).from(element).save();

        } catch (error) {
            console.error('Error generating PDF report:', error);
            // Fallback to text report
            this.downloadTextReport();
        }
    }

    // Fallback text report download
    downloadTextReport() {
        if (!this.state.lastAnalysis) return;

        const { file_info, statistics, categorical_stats, insights, model_suggestions } = this.state.lastAnalysis;
        
        let reportText = `ASTRA AI DATA ANALYSIS REPORT\n`;
        reportText += `Generated: ${new Date().toLocaleString()}\n`;
        reportText += `File: ${file_info.filename}\n`;
        reportText += `${'='.repeat(50)}\n\n`;
        
        reportText += `FILE OVERVIEW:\n`;
        reportText += `- Rows: ${file_info.rows.toLocaleString()}\n`;
        reportText += `- Columns: ${file_info.columns}\n`;
        reportText += `- Missing Values: ${file_info.total_missing.toLocaleString()}\n`;
        reportText += `- Duplicate Rows: ${file_info.duplicate_rows.toLocaleString()}\n\n`;
        
        if (statistics && Object.keys(statistics).length > 0) {
            reportText += `STATISTICAL ANALYSIS:\n`;
            Object.entries(statistics).forEach(([col, stats]) => {
                reportText += `- ${col}: Mean=${stats.mean.toFixed(2)}, Median=${stats['50%'].toFixed(2)}, Std=${stats.std.toFixed(2)}\n`;
            });
            reportText += `\n`;
        }
        
        reportText += `DATA INSIGHTS:\n`;
        insights.forEach(insight => {
            reportText += `- ${insight}\n`;
        });
        reportText += `\n`;
        
        if (model_suggestions && model_suggestions.length > 0) {
            reportText += `MODEL SUGGESTIONS:\n`;
            model_suggestions.forEach(suggestion => {
                reportText += `- ${suggestion}\n`;
            });
        }

        // Create and download text file
        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `astra-analysis-report-${file_info.filename}-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    renderSectionContent(sectionId) {
        switch (sectionId) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'database':
                this.renderDatabase();
                break;
            case 'data-analysis':
                if (this.state.lastAnalysis) {
                    this.renderAnalysisResults();
                } else {
                this.renderPredictions();
                }
                this.attachWorkflowLinkHandler();
                break;
        }
    }

    // Authentication
    checkLoginStatus() {
        const user = localStorage.getItem('astraUser');
        if (user) {
            this.state.isLoggedIn = true;
            this.state.currentUser = user;
            this.loadWork();
        }
    }

    renderHeaderMenu() {
        if (this.state.isLoggedIn) {
            this.dom.headerRightMenu.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span class="text-blue-500 text-sm font-medium">Welcome, ${this.state.currentUser}</span>
                    </div>
                    <button id="logout-btn" class="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm shadow-sm hover:shadow-md">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        <span>Sign Out</span>
                    </button>
                </div>
            `;
        } else {
            this.dom.headerRightMenu.innerHTML = `
                <button id="login-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm shadow-sm hover:shadow-md">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                        <polyline points="10 17 15 12 10 7"/>
                        <line x1="15" y1="12" x2="3" y2="12"/>
                    </svg>
                    <span>Login</span>
                </button>
            `;
        }
    }

    showLoginModal(show) {
        if (show) {
            this.dom.loginModal.classList.remove('hidden');
            this.dom.loginModal.classList.add('flex');
        } else {
            this.dom.loginModal.classList.add('hidden');
            this.dom.loginModal.classList.remove('flex');
        }
    }

    async handleLogin() {
        const username = document.getElementById('username-input').value;
        const password = document.getElementById('password-input').value;
        this.dom.loginErrorMsg.textContent = '';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                this.state.isLoggedIn = true;
                               this.state.currentUser = result.username;
                localStorage.setItem('astraUser', result.username);
                this.renderHeaderMenu();
                this.showLoginModal(false);
                this.loadWork();
            } else {
                this.dom.loginErrorMsg.textContent = result.message;
            }
        } catch (error) {
            this.dom.loginErrorMsg.textContent = 'Failed to connect to the server.';
        }
    }

    handleLogout() {
        this.saveWork();
        localStorage.removeItem('astraUser');
        this.state.isLoggedIn = false;
        this.state.currentUser = null;
        
        // Reset state to default
        this.state.user = { name: "Guest", email: "" };
        this.state.workflow = { uploads: 0, analyses: 0, lastFile: null, lastUploadDate: null };
        this.state.history = [];
        this.state.reports = [];
        this.state.lastAnalyzedCompany = null;
        
        this.renderHeaderMenu();
        this.renderDashboard();
        this.renderHistory();
    }

    async saveWork() {
        if (!this.state.isLoggedIn) return;
        
        try {
            await fetch('/api/save_work', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: this.state.currentUser, 
                    state: this.state 
                })
            });
        } catch (error) {
            console.error("Failed to save work:", error);
        }
    }

    async loadWork() {
        if (!this.state.isLoggedIn) return;
        
        try {
            const response = await fetch(`/api/load_work/${this.state.currentUser}`);
            const result = await response.json();
            
            if (result.status === 'success') {
                const loadedState = result.state;
                loadedState.isLoggedIn = this.state.isLoggedIn;
                loadedState.currentUser = this.state.currentUser;
                this.state = loadedState;
                
                this.dom.userNameInput.value = this.state.user.name;
                this.dom.userEmailInput.value = this.state.user.email;
                this.renderDashboard();
                this.renderHistory();
            }
        } catch (error) {
            console.error("Failed to load work:", error);
        }
    }

    saveUserProfile() {
        this.state.user.name = this.dom.userNameInput.value;
        this.state.user.email = this.dom.userEmailInput.value;
        this.dom.profileSaveFeedback.textContent = 'Profile saved!';
        
        setTimeout(() => {
            this.dom.profileSaveFeedback.textContent = '';
        }, 2000);
    }

    // Utility Functions
    formatTime(date) {
        return new Date(date).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    timeAgo(date) {
        if (!date) return '';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 5) return 'just now';
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }

    logHistory(title, details) {
        this.state.history.unshift({ 
            title, 
            details, 
            timestamp: new Date() 
        });
        this.renderHistory();
    }

    renderHistory() {
        if (!this.dom.historyLogContainer) return;
        
        if (this.state.history.length === 0) {
            this.dom.historyLogContainer.innerHTML = `
                <p class="text-muted">No activity yet. Start by loading data or searching for a company.</p>
            `;
            return;
        }
        
        this.dom.historyLogContainer.innerHTML = this.state.history.map(item => `
            <div class="history-item p-4 rounded-lg">
                <div class="flex justify-between items-center">
                    <p class="font-semibold text-main">${item.title}</p>
                    <p class="text-sm text-muted">${this.timeAgo(item.timestamp)}</p>
                </div>
                <p class="text-sm text-muted mt-1">${item.details}</p>
            </div>
        `).join('');
    }

    // Dashboard and other section rendering
    renderDashboard() {
        const { user, workflow, reports, lastPrediction } = this.state;
        
        // Update dashboard activity timeline
        const activityContainer = document.getElementById('dashboard-activity-timeline');
        if (activityContainer && this.state.history.length > 0) {
            activityContainer.innerHTML = this.state.history.slice(0, 3).map(item => `
                <div class="flex items-center gap-3 text-sm">
                    <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                        <span class="text-main font-medium">${item.title}</span>
                        <span class="text-muted ml-2">${this.timeAgo(item.timestamp)}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    // Update renderDatabase to use real backend data
    async renderDatabase() {
        if (!this.dom.databaseTableBody) return;
        
        // Show loading state
        this.dom.databaseTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-muted">Loading files...</td></tr>`;
        
        try {
            const response = await fetch('/api/list_saved_files');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const files = result.files || [];
            
            // Get search term for filtering
            const searchTerm = this.dom.databaseSearchInput?.value?.toLowerCase() || '';
            const filteredFiles = files.filter(f => 
                f.filename.toLowerCase().includes(searchTerm) ||
                f.type.toLowerCase().includes(searchTerm)
            );
            
            if (filteredFiles.length === 0) {
                this.dom.databaseTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-muted">No datasets found.</td></tr>`;
                return;
            }
            
            this.dom.databaseTableBody.innerHTML = filteredFiles.map(f => {
                const sizeKB = (f.size / 1024).toFixed(2);
                return `
                    <tr class="border-b border-main hover:bg-tertiary">
                        <td class="p-3">${f.filename}</td>
                        <td class="p-3">${f.type}</td>
                        <td class="p-3">${f.rows}</td>
                        <td class="p-3">${f.columns}</td>
                        <td class="p-3">${sizeKB} KB</td>
                        <td class="p-3">${f.date_added}</td>
                        <td class="p-3">
                            <button class="astra-download-btn" data-filename="${f.filename}">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                </svg>
                                Download
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
            
            // Add download event listeners
            this.dom.databaseTableBody.querySelectorAll('.astra-download-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const filename = btn.getAttribute('data-filename');
                    this.downloadSavedFile(filename);
                });
            });
        } catch (e) {
            console.error('Database render error:', e);
            this.dom.databaseTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-danger">Failed to load files.</td></tr>`;
        }
    }

    // Add refresh function for database section
    async refreshDatabaseSection() {
        await this.renderDatabase();
        // No redirect! Only refresh database data.
    }

    // Add download function for saved files
    async downloadSavedFile(filename) {
        try {
            const response = await fetch(`/api/download_file/${filename}`);
            if (!response.ok) {
                throw new Error('Download failed');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.addChatMessage(`📥 Downloaded ${filename} successfully!`, 'assistant');
        } catch (error) {
            console.error('Download error:', error);
            this.addChatMessage(`❌ Failed to download ${filename}. Please try again.`, 'assistant');
        }
    }

    renderPredictions() {
        if (!this.dom.predictionsContent) return;
        
        if (this.state.workflow.analyses === 0) {
            this.dom.predictionsContent.innerHTML = `
                <div class="text-center text-muted">
                    <div class="text-5xl mb-4">📊</div>
                    <p class="mb-4">Run the Data Processing Workflow to see analysis and growth models here.</p>
                    <a href="#batch-data" class="ultra-futuristic-link nav-item">
                        <div class="ultra-futuristic-content">
                            <div class="pulse-ring"></div>
                            <div class="ultra-link-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14,2 14,8 20,8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10,9 9,9 8,9"></polyline>
                                </svg>
                            </div>
                            <div class="ultra-link-text">
                                <div class="primary-text">Launch Batch Data Processing</div>
                                <div class="secondary-text">Advanced AI Workflow System</div>
                            </div>
                            <div class="holographic-effects">
                                <div class="holo-layer-1"></div>
                                <div class="holo-layer-2"></div>
                                <div class="holo-layer-3"></div>
                            </div>
                            <div class="energy-bars">
                                <div class="energy-bar bar-1"></div>
                                <div class="energy-bar bar-2"></div>
                                <div class="energy-bar bar-3"></div>
                            </div>
                        </div>
                    </a>
                </div>`;
            return;
        }

        this.dom.predictionsContent.innerHTML = `
            <div class="space-y-8">
                <!-- Data Overview & Quality -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="card-modern">
                        <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                <path d="M3 3v18h18"></path>
                                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                            </svg>
                            Data Overview
                        </h3>
                        <div class="space-y-3">
                            <div class="flex justify-between">
                                <span class="text-muted">Total Records:</span>
                                <span class="text-main font-semibold">1,500</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Columns:</span>
                                <span class="text-main font-semibold">12</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Data Quality:</span>
                                <span class="text-green-400 font-semibold">92%</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Missing Values:</span>
                                <span class="text-yellow-400 font-semibold">3.2%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-modern">
                        <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                            Performance Metrics
                        </h3>
                        <div class="space-y-3">
                            <div class="flex justify-between">
                                <span class="text-muted">Processing Time:</span>
                                <span class="text-main font-semibold">2.3s</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Memory Usage:</span>
                                <span class="text-main font-semibold">45.6 MB</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Throughput:</span>
                                <span class="text-main font-semibold">652 rec/s</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Accuracy:</span>
                                <span class="text-green-400 font-semibold">94.7%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-modern">
                        <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="m22 21-3-3m-3 3a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z"></path>
                            </svg>
                            Key Insights
                        </h3>
                        <ul class="space-y-3 text-muted">
                            <li class="flex flex-col">
                                <span class="text-sm">Growth Rate</span>
                                <strong class="text-green-400 text-lg">+15.3%</strong>
                            </li>
                            <li class="flex flex-col">
                                <span class="text-sm">Top Segment</span>
                                <strong class="text-main text-lg">Premium</strong>
                            </li>
                            <li class="flex flex-col">
                                <span class="text-sm">Correlation</span>
                                <strong class="text-main text-lg">0.847</strong>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <!-- Predictive Models & Growth Forecasts -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="card-modern">
                        <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                <path d="M3 3v18h18"></path>
                                <path d="M8 17l4-4 4 4"></path>
                                <path d="M8 7l4 4 4-4"></path>
                            </svg>
                            Predictive Models
                        </h3>
                        <div class="space-y-4">
                            <div class="bg-secondary p-4 rounded-lg">
                                <h4 class="font-semibold text-main mb-2">Linear Regression Model</h4>
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span class="text-muted">R² Score:</span>
                                        <span class="text-green-400 font-semibold ml-2">0.847</span>
                                    </div>
                                    <div>
                                        <span class="text-muted">RMSE:</span>
                                        <span class="text-main font-semibold ml-2">2.3</span>
                                    </div>
                                    <div>
                                        <span class="text-muted">MAE:</span>
                                        <span class="text-main font-semibold ml-2">1.8</span>
                                    </div>
                                    <div>
                                        <span class="text-muted">Features:</span>
                                        <span class="text-main font-semibold ml-2">8</span>
                                    </div>
                                </div>
                            </div>
                            <div class="bg-secondary p-4 rounded-lg">
                                <h4 class="font-semibold text-main mb-2">Random Forest Classifier</h4>
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span class="text-muted">Accuracy:</span>
                                        <span class="text-green-400 font-semibold ml-2">94.7%</span>
                                    </div>
                                    <div>
                                        <span class="text-muted">Precision:</span>
                                        <span class="text-main font-semibold ml-2">0.92</span>
                                    </div>
                                    <div>
                                        <span class="text-muted">Recall:</span>
                                        <span class="text-main font-semibold ml-2">0.89</span>
                                    </div>
                                    <div>
                                        <span class="text-muted">F1-Score:</span>
                                        <span class="text-main font-semibold ml-2">0.91</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-modern">
                        <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                            </svg>
                            Growth Forecasts
                        </h3>
                        <div class="space-y-4">
                            <div class="bg-secondary p-4 rounded-lg">
                                <h4 class="font-semibold text-main mb-3">6-Month Projection</h4>
                                <div class="space-y-2">
                                    <div class="flex justify-between">
                                        <span class="text-muted">Revenue Growth:</span>
                                        <span class="text-green-400 font-semibold">+15.3%</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-muted">User Acquisition:</span>
                                        <span class="text-green-400 font-semibold">+23.7%</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-muted">Churn Rate:</span>
                                        <span class="text-red-400 font-semibold">-2.1%</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-muted">Market Share:</span>
                                        <span class="text-green-400 font-semibold">+4.2%</span>
                                    </div>
                                </div>
                            </div>
                            <div class="bg-secondary p-4 rounded-lg">
                                <h4 class="font-semibold text-main mb-2">Trend Analysis</h4>
                                <div class="text-sm text-muted">
                                    <p class="mb-2">📈 <strong>Upward Trend:</strong> Customer satisfaction increasing</p>
                                    <p class="mb-2">⚡ <strong>Seasonal Pattern:</strong> Q4 peak identified</p>
                                    <p>🎯 <strong>Opportunity:</strong> Premium segment expansion</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                                 <!-- Visual Charts & Graphs -->
                 <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     <div class="card-modern">
                         <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                 <path d="M3 3v18h18"></path>
                                 <path d="M7 16l4-4 4 4 4-4"></path>
                             </svg>
                             Revenue Growth Chart
                         </h3>
                         <div class="bg-secondary p-4 rounded-lg">
                             <div class="chart-container">
                                 <div class="line-chart">
                                     <div class="chart-grid">
                                         <div class="grid-line"></div>
                                         <div class="grid-line"></div>
                                         <div class="grid-line"></div>
                                         <div class="grid-line"></div>
                                     </div>
                                     <div class="chart-line">
                                         <div class="chart-point" style="left: 0%; bottom: 20%;" data-value="$45K"></div>
                                         <div class="chart-point" style="left: 20%; bottom: 35%;" data-value="$52K"></div>
                                         <div class="chart-point" style="left: 40%; bottom: 28%;" data-value="$48K"></div>
                                         <div class="chart-point" style="left: 60%; bottom: 55%;" data-value="$68K"></div>
                                         <div class="chart-point" style="left: 80%; bottom: 75%;" data-value="$82K"></div>
                                         <div class="chart-point" style="left: 100%; bottom: 85%;" data-value="$95K"></div>
                                     </div>
                                 </div>
                                 <div class="chart-labels">
                                     <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                                 </div>
                             </div>
                         </div>
                     </div>
                     
                     <div class="card-modern">
                         <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                 <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                                 <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                             </svg>
                             Customer Segments
                         </h3>
                         <div class="bg-secondary p-4 rounded-lg">
                             <div class="pie-chart-container">
                                 <div class="pie-chart">
                                     <div class="pie-slice pie-slice-1" style="--percentage: 45;"></div>
                                     <div class="pie-slice pie-slice-2" style="--percentage: 30;"></div>
                                     <div class="pie-slice pie-slice-3" style="--percentage: 25;"></div>
                                 </div>
                                 <div class="pie-legend">
                                     <div class="legend-item">
                                         <div class="legend-color legend-color-1"></div>
                                         <span>Premium (45%)</span>
                                     </div>
                                     <div class="legend-item">
                                         <div class="legend-color legend-color-2"></div>
                                         <span>Standard (30%)</span>
                                     </div>
                                     <div class="legend-item">
                                         <div class="legend-color legend-color-3"></div>
                                         <span>Basic (25%)</span>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
                 
                 <!-- Bar Charts & Histograms -->
                 <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     <div class="card-modern">
                         <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                 <path d="M3 3v18h18"></path>
                                 <path d="M7 17V7h4v10"></path>
                                 <path d="M14 17V3h4v14"></path>
                             </svg>
                             Sales by Region
                         </h3>
                         <div class="bg-secondary p-4 rounded-lg">
                             <div class="bar-chart">
                                 <div class="bar-item">
                                     <div class="bar-label">North</div>
                                     <div class="bar-container">
                                         <div class="bar-fill" style="height: 85%; background: linear-gradient(to top, #3b82f6, #60a5fa);"></div>
                                     </div>
                                     <div class="bar-value">$85K</div>
                                 </div>
                                 <div class="bar-item">
                                     <div class="bar-label">South</div>
                                     <div class="bar-container">
                                         <div class="bar-fill" style="height: 65%; background: linear-gradient(to top, #8b5cf6, #a78bfa);"></div>
                                     </div>
                                     <div class="bar-value">$65K</div>
                                 </div>
                                 <div class="bar-item">
                                     <div class="bar-label">East</div>
                                     <div class="bar-container">
                                         <div class="bar-fill" style="height: 92%; background: linear-gradient(to top, #10b981, #34d399);"></div>
                                     </div>
                                     <div class="bar-value">$92K</div>
                                 </div>
                                 <div class="bar-item">
                                     <div class="bar-label">West</div>
                                     <div class="bar-container">
                                         <div class="bar-fill" style="height: 78%; background: linear-gradient(to top, #f59e0b, #fbbf24);"></div>
                                     </div>
                                     <div class="bar-value">$78K</div>
                                 </div>
                             </div>
                         </div>
                     </div>
                     
                     <div class="card-modern">
                         <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                 <path d="M7,10 12,15 17,10"/>
                                 <line x1="12" y1="15" x2="12" y2="3"/>
                             </svg>
                             Age Distribution
                         </h3>
                         <div class="bg-secondary p-4 rounded-lg">
                             <div class="histogram">
                                 <div class="histogram-bar" style="height: 40%;">
                                     <div class="histogram-fill"></div>
                                     <div class="histogram-label">18-25</div>
                                 </div>
                                 <div class="histogram-bar" style="height: 75%;">
                                     <div class="histogram-fill"></div>
                                     <div class="histogram-label">26-35</div>
                                 </div>
                                 <div class="histogram-bar" style="height: 90%;">
                                     <div class="histogram-fill"></div>
                                     <div class="histogram-label">36-45</div>
                                 </div>
                                 <div class="histogram-bar" style="height: 60%;">
                                     <div class="histogram-fill"></div>
                                     <div class="histogram-label">46-55</div>
                                 </div>
                                 <div class="histogram-bar" style="height: 35%;">
                                     <div class="histogram-fill"></div>
                                     <div class="histogram-label">56+</div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
                 
                 <!-- Correlation Heatmap & Scatter Plot -->
                 <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     <div class="card-modern">
                         <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                 <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                 <path d="M9 9h6v6H9z"></path>
                             </svg>
                             Correlation Heatmap
                         </h3>
                         <div class="bg-secondary p-4 rounded-lg">
                             <div class="heatmap">
                                 <div class="heatmap-grid">
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.8);" data-value="0.85"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.4);" data-value="0.42"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.6);" data-value="0.63"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.3);" data-value="0.31"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.4);" data-value="0.42"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.9);" data-value="0.92"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.5);" data-value="0.55"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.2);" data-value="0.18"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.6);" data-value="0.63"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.5);" data-value="0.55"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.7);" data-value="0.78"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.4);" data-value="0.39"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.3);" data-value="0.31"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.2);" data-value="0.18"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.4);" data-value="0.39"></div>
                                     <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.8);" data-value="0.81"></div>
                                 </div>
                                 <div class="heatmap-labels">
                                     <div class="heatmap-x-labels">
                                         <span>Age</span><span>Income</span><span>Spend</span><span>Tenure</span>
                                     </div>
                                     <div class="heatmap-y-labels">
                                         <span>Age</span><span>Income</span><span>Spend</span><span>Tenure</span>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                     
                     <div class="card-modern">
                         <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                 <circle cx="9" cy="9" r="2"></circle>
                                 <path d="M21 15l-3.086-3.086a2 2 0 0 0-1.414-.586H13l-2.5 2.5"></path>
                                 <path d="M3 21l6-6"></path>
                             </svg>
                             Age vs Purchase Correlation
                         </h3>
                         <div class="bg-secondary p-4 rounded-lg">
                             <div class="scatter-plot">
                                 <div class="scatter-grid">
                                     <div class="scatter-line scatter-line-h"></div>
                                     <div class="scatter-line scatter-line-h"></div>
                                     <div class="scatter-line scatter-line-h"></div>
                                     <div class="scatter-line scatter-line-h"></div>
                                     <div class="scatter-line scatter-line-v"></div>
                                     <div class="scatter-line scatter-line-v"></div>
                                     <div class="scatter-line scatter-line-v"></div>
                                     <div class="scatter-line scatter-line-v"></div>
                                 </div>
                                 <div class="scatter-points">
                                     <div class="scatter-point" style="left: 15%; bottom: 25%;"></div>
                                     <div class="scatter-point" style="left: 25%; bottom: 35%;"></div>
                                     <div class="scatter-point" style="left: 35%; bottom: 45%;"></div>
                                     <div class="scatter-point" style="left: 45%; bottom: 55%;"></div>
                                     <div class="scatter-point" style="left: 55%; bottom: 65%;"></div>
                                     <div class="scatter-point" style="left: 65%; bottom: 75%;"></div>
                                     <div class="scatter-point" style="left: 75%; bottom: 85%;"></div>
                                     <div class="scatter-point" style="left: 20%; bottom: 30%;"></div>
                                     <div class="scatter-point" style="left: 40%; bottom: 50%;"></div>
                                     <div class="scatter-point" style="left: 60%; bottom: 70%;"></div>
                                     <div class="scatter-point" style="left: 80%; bottom: 80%;"></div>
                                 </div>
                                 <div class="trend-line"></div>
                             </div>
                             <div class="chart-axes">
                                 <div class="axis-label axis-x">Age (Years)</div>
                                 <div class="axis-label axis-y">Purchase Amount ($)</div>
                             </div>
                         </div>
                     </div>
                 </div>
                 
                 <!-- Entity Relationship Diagram -->
                 <div class="card-modern">
                     <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                             <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                             <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
                             <line x1="12" y1="15" x2="12" y2="3"></line>
                         </svg>
                         Entity Relationship Diagram
                     </h3>
                     <div class="bg-secondary p-4 rounded-lg">
                         <div class="er-diagram-extended">
                             <div class="er-row">
                                 <div class="er-entity">
                                     <div class="er-entity-name">CUSTOMERS</div>
                                     <div class="er-attributes">
                                         <div class="er-key">🔑 customer_id</div>
                                         <div>first_name</div>
                                         <div>last_name</div>
                                         <div>email</div>
                                         <div>phone</div>
                                         <div>birth_date</div>
                                         <div>segment</div>
                                         <div>created_at</div>
                                     </div>
                                 </div>
                                 <div class="er-connection">
                                     <div class="er-line-extended"></div>
                                     <div class="er-relationship-label">
                                         <div class="er-rel-name">PLACES</div>
                                         <div class="er-cardinality">1:M</div>
                                     </div>
                                 </div>
                                 <div class="er-entity">
                                     <div class="er-entity-name">ORDERS</div>
                                     <div class="er-attributes">
                                         <div class="er-key">🔑 order_id</div>
                                         <div class="er-foreign-key">🔗 customer_id</div>
                                         <div>order_date</div>
                                         <div>total_amount</div>
                                         <div>tax_amount</div>
                                         <div>shipping_cost</div>
                                         <div>status</div>
                                         <div>payment_method</div>
                                     </div>
                                 </div>
                             </div>
                             <div class="er-row">
                                 <div class="er-entity">
                                     <div class="er-entity-name">PRODUCTS</div>
                                     <div class="er-attributes">
                                         <div class="er-key">🔑 product_id</div>
                                         <div>product_name</div>
                                         <div>category</div>
                                         <div>price</div>
                                         <div>stock_quantity</div>
                                         <div>description</div>
                                         <div>created_at</div>
                                     </div>
                                 </div>
                                 <div class="er-connection">
                                     <div class="er-line-extended"></div>
                                     <div class="er-relationship-label">
                                         <div class="er-rel-name">CONTAINS</div>
                                         <div class="er-cardinality">M:N</div>
                                     </div>
                                 </div>
                                 <div class="er-entity">
                                     <div class="er-entity-name">ORDER_ITEMS</div>
                                     <div class="er-attributes">
                                         <div class="er-key">🔑 item_id</div>
                                         <div class="er-foreign-key">🔗 order_id</div>
                                         <div class="er-foreign-key">🔗 product_id</div>
                                         <div>quantity</div>
                                         <div>unit_price</div>
                                         <div>discount</div>
                                         <div>subtotal</div>
                                     </div>
                                 </div>
                             </div>
                         </div>
                         <div class="mt-4 text-sm text-muted">
                             <div class="grid grid-cols-2 gap-4">
                                 <div>
                                     <p class="mb-2">📊 <strong>Entities:</strong> 4 main tables</p>
                                     <p class="mb-2">🔗 <strong>Relationships:</strong> 3 connections</p>
                                 </div>
                                 <div>
                                     <p class="mb-2">🔑 <strong>Primary Keys:</strong> 4 identified</p>
                                     <p class="mb-2">📈 <strong>Normalization:</strong> 3NF compliant</p>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
                
                <!-- Recommendations & Next Steps -->
                <div class="card-modern">
                    <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                            <path d="M9 12l2 2 4-4"></path>
                            <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                            <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                        </svg>
                        AI-Powered Recommendations
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div class="bg-secondary p-4 rounded-lg">
                            <h4 class="font-semibold text-green-400 mb-3">🎯 Optimization Opportunities</h4>
                            <ul class="text-sm text-muted space-y-1">
                                <li>• Focus on premium customer segment</li>
                                <li>• Implement retention strategies</li>
                                <li>• Optimize Q4 seasonal campaigns</li>
                            </ul>
                        </div>
                        <div class="bg-secondary p-4 rounded-lg">
                            <h4 class="font-semibold text-blue-400 mb-3">📈 Growth Strategies</h4>
                            <ul class="text-sm text-muted space-y-1">
                                <li>• Expand into high-correlation markets</li>
                                <li>• Leverage age-purchase patterns</li>
                                <li>• Increase marketing spend by 12%</li>
                            </ul>
                        </div>
                        <div class="bg-secondary p-4 rounded-lg">
                            <h4 class="font-semibold text-purple-400 mb-3">⚠️ Risk Mitigation</h4>
                            <ul class="text-sm text-muted space-y-1">
                                <li>• Address data quality issues</li>
                                <li>• Monitor churn indicators</li>
                                <li>• Implement early warning system</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachWorkflowLinkHandler() {
        // Handle "Go to Analysis" link
        const goToAnalysisLink = document.querySelector('a[href="#data-analysis"]');
        if (goToAnalysisLink) {
            goToAnalysisLink.onclick = (e) => {
                e.preventDefault();
                this.switchView('#data-analysis');
            };
        }
        
        // Handle workflow link (if it exists)
        const workflowLink = document.getElementById('data-analysis-workflow-link');
        if (workflowLink) {
            workflowLink.onclick = (e) => {
                e.preventDefault();
                this.switchView('#batch-data');
            };
        }
    }

    resetWorkflowView() {
        const steps = ['load', 'filter', 'store', 'analyze'];
        steps.forEach(step => {
            const card = document.getElementById(`pipeline-${step}`);
            const content = document.getElementById(`pipeline-${step}-content`);
            if (card && content) {
                card.className = 'pipeline-card pending w-full md:flex-1 bg-main p-6 rounded-lg border border-main';
                let defaultText = '';
                switch(step) {
                    case 'load': defaultText = 'Upload a CSV or Excel file.'; break;
                    case 'filter': defaultText = 'Apply filter conditions.'; break;
                    case 'store': defaultText = 'Save data to the database.'; break;
                    case 'analyze': defaultText = 'Run data profiling and generate charts.'; break;
                }
                content.innerHTML = defaultText;
            }
        });
        
        const goToAnalysisContainer = document.getElementById('go-to-analysis-container');
        if (goToAnalysisContainer) {
            goToAnalysisContainer.classList.add('hidden');
        }
    }

    openWorkflowModal() {
        const modal = document.getElementById('workflow-modal');
        const fileInput = document.getElementById('workflow-file-input');
        const nameDisplay = document.getElementById('workflow-file-name');
        const filterInput = document.getElementById('filter-condition-input');
        const joinToggle = document.getElementById('join-toggle');
        
        if (!modal) return;
        
        // Reset form
        if (fileInput) fileInput.value = '';
        if (nameDisplay) nameDisplay.textContent = '';
        if (filterInput) filterInput.value = '';
        if (joinToggle) {
            joinToggle.checked = false;
            fileInput.removeAttribute('multiple');
            filterInput.placeholder = "e.g., age > 30";
        }

        modal.classList.remove('hidden');

        // Event handlers
        const handleToggle = () => {
            if (joinToggle && filterInput && fileInput) {
                if (joinToggle.checked) {
                    fileInput.setAttribute('multiple', true);
                    filterInput.placeholder = "e.g., table1.id = table2.id";
                } else {
                    fileInput.removeAttribute('multiple');
                    filterInput.placeholder = "e.g., age > 30";
                }
            }
        };
        
        const handleFileChange = () => {
            if (fileInput && nameDisplay) {
                if (fileInput.files.length > 0) {
                    const fileNames = Array.from(fileInput.files).map(file => file.name).join(', ');
                    nameDisplay.textContent = `Selected: ${fileNames}`;
                    nameDisplay.style.color = '#22c55e';
                } else {
                    nameDisplay.textContent = '';
                }
            }
        };
        
        const handleSubmit = () => {
            if (!fileInput || fileInput.files.length === 0) {
                if (nameDisplay) {
                    nameDisplay.textContent = 'Please select a file first!';
                    nameDisplay.style.color = '#f87171';
                    setTimeout(() => {
                        nameDisplay.textContent = '';
                        nameDisplay.style.color = '';
                    }, 2000);
                }
                return;
            }
            
            modal.classList.add('hidden');
            cleanup();
            
            const formData = {
                files: fileInput.files,
                filter: filterInput?.value || "Not specified",
                store: document.querySelector('input[name="store-data"]:checked')?.value || "yes",
                analyze: document.querySelector('input[name="analyze-data"]:checked')?.value || "yes"
            };
            
            this.runDataPipeline(formData);
        };

        const handleCancel = () => {
            modal.classList.add('hidden');
            cleanup();
        };

        const cleanup = () => {
            if (joinToggle) joinToggle.removeEventListener('change', handleToggle);
            if (fileInput) fileInput.removeEventListener('change', handleFileChange);
            
            const submitBtn = document.getElementById('submit-workflow-btn');
            const cancelBtn = document.getElementById('cancel-workflow-btn');
            if (submitBtn) submitBtn.removeEventListener('click', handleSubmit);
            if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
        };

        if (joinToggle) joinToggle.addEventListener('change', handleToggle);
        if (fileInput) fileInput.addEventListener('change', handleFileChange);
        
        const submitBtn = document.getElementById('submit-workflow-btn');
        const cancelBtn = document.getElementById('cancel-workflow-btn');
        if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
        if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    }

    async runDataPipeline(inputs) {
        this.state.workflow.uploads++;
        this.state.workflow.lastFile = inputs.files[0].name;
        this.state.workflow.lastUploadDate = new Date();
        // Step 1: Load Data (initially show file count)
        await this.updatePipelineCard('load', `✅ Files: ${inputs.files.length}<br>Loading...`, 'done');
        // Step 2: Filter Data
        let filterMsg = '';
        if (!inputs.filter || inputs.filter === 'Not specified' || inputs.filter.trim() === '') {
            filterMsg = '✅ Condition: Not Applied';
        } else {
            filterMsg = `✅ Condition: ${inputs.filter}`;
        }
        await this.updatePipelineCard('filter', filterMsg, 'done');
        // Step 3: Store Data - REAL IMPLEMENTATION
        if (inputs.store === 'yes') {
            try {
                // Prepare data for storage - use the filtered data if available
                let dataToStore = [];
                let filenameBase = inputs.files[0].name.replace(/\.[^/.]+$/, ""); // Remove extension
                
                // If we have analysis data, use that; otherwise read the file
                if (this.state.lastAnalysis && this.state.lastAnalysis.preview_data) {
                    dataToStore = this.state.lastAnalysis.preview_data;
                } else {
                    // Read the file to get data
                    const fileContent = await this.readFileAsText(inputs.files[0]);
                    if (inputs.files[0].name.endsWith('.csv')) {
                        dataToStore = this.parseCSVData(fileContent);
                    } else if (inputs.files[0].name.endsWith('.json')) {
                        dataToStore = JSON.parse(fileContent);
                    }
                }
                
                        // Apply filter if specified
        if (inputs.filter && inputs.filter !== 'Not specified' && inputs.filter.trim() !== '') {
            dataToStore = await this.applyDataFilter(dataToStore, inputs.filter);
        }
                
                // Save to backend
                if (!dataToStore || !Array.isArray(dataToStore) || dataToStore.length === 0) {
                    alert('No data to save. Please make sure you have uploaded and filtered your file.');
                    await this.updatePipelineCard('store', '❌ Save Failed<br>No data to save.', 'error');
                    return;
                }
                if (!filenameBase || typeof filenameBase !== 'string' || filenameBase.trim() === '') {
                    alert('No filename specified. Please upload a valid file.');
                    await this.updatePipelineCard('store', '❌ Save Failed<br>No filename specified.', 'error');
                    return;
                }
                const saveResponse = await fetch('/api/save_filtered', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        data: dataToStore,
                        filename: filenameBase
                    })
                });
                
                if (saveResponse.ok) {
                    const saveResult = await saveResponse.json();
                    await this.updatePipelineCard('store', `✅ Saved: ${saveResult.filename}<br>Rows: ${saveResult.rows}`, 'done');
                    
                    // Refresh the database section to show the new file
                    await this.refreshDatabaseSection();
                    
                    // Log the save operation
                    this.logHistory('Data Stored', `File saved: ${saveResult.filename} (${saveResult.rows} rows)`);
                } else {
                    const errorData = await saveResponse.json();
                    await this.updatePipelineCard('store', `❌ Save Failed<br>${errorData.error || 'Unknown error'}`, 'error');
                }
                
            } catch (error) {
                console.error('Error storing data:', error);
                await this.updatePipelineCard('store', '❌ Save Failed<br>Storage error', 'error');
            }
        } else {
            await this.updatePipelineCard('store', '⏩ Skipped by user.', 'skipped');
        }
        // Step 4: Analyze Data - REAL ANALYSIS
        if (inputs.analyze === 'yes') {
            this.state.workflow.analyses++;
            this.state.lastPrediction.timestamp = new Date();
            // Perform real file analysis
            try {
                const formData = new FormData();
                formData.append('file', inputs.files[0]);
                const response = await fetch('/api/analyze-file', {
                    method: 'POST',
                    body: formData
                });
                if (response.ok) {
                    const analysisData = await response.json();
                    this.state.lastAnalysis = analysisData;
                    const fileInfo = analysisData.file_info;
                    // Update Load Data card with real rows/columns
                    await this.updatePipelineCard('load', `✅ Rows: ${fileInfo.rows.toLocaleString()}<br>Columns: ${fileInfo.columns}`, 'done');
                    // Only show minimal message in Analyze Data card
                    await this.updatePipelineCard('analyze', `✅ Analysis Complete`, 'done');
                    // Show completion message with real data
                    this.logHistory('Data Workflow Completed', `File: ${inputs.files[0].name} - ${fileInfo.rows} rows analyzed`);
                    // Show "Go to Analysis" link
                    const goToAnalysisContainer = document.getElementById('go-to-analysis-container');
                    if (goToAnalysisContainer) {
                        goToAnalysisContainer.classList.remove('hidden');
                    }
                } else {
                    const errorData = await response.json();
                    await this.updatePipelineCard('analyze', `❌ Analysis Failed<br>${errorData.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error('Error during analysis:', error);
                await this.updatePipelineCard('analyze', '❌ Analysis Failed<br>Network error', 'error');
            }
        } else {
            await this.updatePipelineCard('analyze', '⏩ Skipped by user.', 'skipped');
        }
    }
    
    async updatePipelineCard(step, message, status) {
        const card = document.getElementById(`pipeline-${step}`);
        const content = document.getElementById(`pipeline-${step}-content`);
        if (!card || !content) return;
        card.classList.remove('pending', 'in-progress', 'done', 'skipped');
        if (status === 'skipped') {
            card.classList.add('skipped');
            content.innerHTML = message;
            return new Promise(r => setTimeout(r, 300));
        }
        if (status === 'done') {
            card.classList.add('done');
            content.innerHTML = message;
            return new Promise(r => setTimeout(r, 300));
        }
        // Show processing state
        card.classList.add('in-progress');
        content.innerHTML = `<div class="flex items-center gap-2"><div class="w-4 h-4 border-2 border-dashed rounded-full animate-spin border-blue-400"></div><span>Processing...</span></div>`;
        await new Promise(r => setTimeout(r, 1500));
        // Show completed state
        card.classList.remove('in-progress');
        card.classList.add(status);
        content.innerHTML = message;
        await new Promise(r => setTimeout(r, 300));
    }

    async searchCompany() {
        if (!this.dom.searchFeedback || !this.dom.companySearchInput) return;
        
        this.dom.searchFeedback.textContent = '';
        const query = this.dom.companySearchInput.value.toLowerCase().trim();
        
        if (!query) {
            this.dom.searchFeedback.textContent = 'Please enter a company name.';
            return;
        }

        try {
            const response = await fetch(`/api/company/${query}`);
            const result = await response.json();

            if (response.ok && result.status === 'success') {
                this.state.lastAnalyzedCompany = result.data;
                this.logHistory('Company Analysis', `Searched for: ${result.data.name}`);
                this.renderCompanyInsights(result.data);
                this.switchView('#data-insights');
            } else {
                this.dom.searchFeedback.textContent = result.message || "Company not found.";
            }
        } catch (error) {
            console.error("Error fetching company data:", error);
            this.dom.searchFeedback.textContent = 'An error occurred while fetching data.';
        }
    }

    renderCompanyInsights(data) {
        if (!this.dom.companyInsightsContent) return;
        
        const { name, data: companyMetrics, prediction, models, revenue_breakdown, insights } = data;
        
        // Hide the default state and show the company data
        const noCompanySelected = document.getElementById('no-company-selected');
        const companyDataContent = document.getElementById('company-data-content');
        
        if (noCompanySelected) noCompanySelected.classList.add('hidden');
        if (companyDataContent) companyDataContent.classList.remove('hidden');
        
        // Extract real financial data from the correct API structure
        const revenueData = companyMetrics.find(m => m.metric === 'Revenue') || {};
        const marketCapData = companyMetrics.find(m => m.metric === 'Market Cap') || {};
        const stockPriceData = companyMetrics.find(m => m.metric === 'Stock Price') || {};
        
        // Parse values from API data
        const marketCap = marketCapData.current_year || 'N/A';
        const marketCapGrowth = marketCapData.yoy_growth || 'N/A';
        const stockPrice = stockPriceData.current_year || 'N/A';
        const stockChange = stockPriceData.yoy_growth || 'N/A';
        const revenueGrowth = revenueData.yoy_growth || 'N/A';
        
        // Calculate metric bar widths based on growth percentages
        const parseGrowth = (growth) => {
            if (growth === 'N/A') return 50; // Default width for N/A values
            const num = parseFloat(growth.replace(/[^-0-9.]/g, ''));
            return Math.min(Math.max(num + 50, 10), 100); // Normalize to 10-100% range
        };
        
        const marketCapWidth = parseGrowth(marketCapGrowth);
        const stockPriceWidth = parseGrowth(stockChange);
        const revenueWidth = parseGrowth(revenueGrowth);
        
        companyDataContent.innerHTML = `
            <div class="space-y-8">
                <!-- Company Header & Real-time Status -->
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-3xl font-bold text-main">${name} - Live Company Analytics</h2>
                        <div class="flex items-center gap-4 mt-2">
                            <span class="flex items-center gap-2 text-sm">
                                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span class="text-green-400">Live Data Stream Active</span>
                            </span>
                            <span class="text-sm text-muted">Last Updated: ${new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>
                    <a href="#stream-data" class="futuristic-link nav-item">
                        <div class="futuristic-link-content">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                <path d="M19 12H6m0 0l4 4m-4-4l4-4"></path>
                            </svg>
                            Back to Search
                            <div class="link-glow-effect"></div>
                        </div>
                    </a>
                </div>
                
                <!-- Real-time Key Metrics Dashboard -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="card-modern">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-lg font-semibold text-main">Market Cap</h3>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                        </div>
                        <div class="text-2xl font-bold text-main mb-1">${marketCap}</div>
                        <div class="text-sm ${marketCapGrowth.includes('-') ? 'text-red-400' : 'text-green-400'}">${marketCapGrowth}</div>
                        <div class="mt-3 live-metric-bar">
                            <div class="metric-bar-fill" style="width: ${marketCapWidth}%; background: linear-gradient(90deg, #10b981, #34d399);"></div>
                        </div>
                    </div>
                    
                    <div class="card-modern">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-lg font-semibold text-main">Stock Price</h3>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
                                <path d="M3 3v18h18"></path>
                                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                            </svg>
                        </div>
                        <div class="text-2xl font-bold text-main mb-1">${stockPrice}</div>
                        <div class="text-sm ${stockChange.includes('-') ? 'text-red-400' : 'text-green-400'}">${stockChange} Today</div>
                        <div class="mt-3 live-metric-bar">
                            <div class="metric-bar-fill" style="width: ${stockPriceWidth}%; background: linear-gradient(90deg, #3b82f6, #60a5fa);"></div>
                        </div>
                    </div>
                    
                    <div class="card-modern">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-lg font-semibold text-main">Industry</h3>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-400">
                                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                            </svg>
                        </div>
                        <div class="text-xl font-bold text-main mb-1">${models[0] || 'N/A'}</div>
                        <div class="text-sm text-muted">${models[1] || 'Sector N/A'}</div>
                        <div class="mt-3 live-metric-bar">
                            <div class="metric-bar-fill" style="width: 75%; background: linear-gradient(90deg, #8b5cf6, #a78bfa);"></div>
                        </div>
                    </div>
                    
                    <div class="card-modern">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-lg font-semibold text-main">Revenue Growth</h3>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22,4 12,14.01 9,11.01"></polyline>
                            </svg>
                        </div>
                        <div class="text-2xl font-bold text-main mb-1">${revenueGrowth}</div>
                        <div class="text-sm text-muted">YoY Growth</div>
                        <div class="mt-3 live-metric-bar">
                            <div class="metric-bar-fill" style="width: ${revenueWidth}%; background: linear-gradient(90deg, #10b981, #34d399);"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Live Stock Chart & Real Company Insights -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="card-modern">
                        <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                <path d="M3 3v18h18"></path>
                                <path d="M7 16l4-4 4 4 4-4"></path>
                            </svg>
                            Live Financial Metrics
                        </h3>
                        <div class="bg-secondary p-4 rounded-lg">
                            <div class="space-y-4">
                                ${companyMetrics.map(metric => `
                                    <div class="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                                        <div>
                                            <div class="font-semibold text-main">${metric.metric}</div>
                                            <div class="text-sm text-muted">${metric.previous_year || 'Live Data'}</div>
                                        </div>
                                        <div class="text-right">
                                            <div class="font-bold text-main">${metric.current_year}</div>
                                            <div class="text-sm ${metric.yoy_growth.includes('-') ? 'text-red-400' : 'text-green-400'}">${metric.yoy_growth}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-modern">
                        <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                            </svg>
                            Live Company Analysis
                        </h3>
                        <div class="bg-secondary p-4 rounded-lg">
                            <div class="space-y-4">
                                <div>
                                    <h4 class="font-semibold text-main mb-2">Financial Health</h4>
                                    <div class="text-sm text-muted">${insights.financial}</div>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-main mb-2">Market Position</h4>
                                    <div class="text-sm text-muted">${insights.market}</div>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-main mb-2">Strategic Overview</h4>
                                    <div class="text-sm text-muted">${insights.strategic}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Strategic Business Intelligence -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="card-modern">
                        <h3 class="text-lg font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 text-green-400">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                            Financial Health
                        </h3>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Market Cap</span>
                                <span class="font-semibold text-main">${companyMetrics.find(m => m.metric === 'Market Cap')?.current_year || 'N/A'}</span>
                                    </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Revenue Growth</span>
                                <span class="font-semibold ${revenueGrowth.includes('-') ? 'text-red-400' : 'text-green-400'}">${revenueGrowth}</span>
                                    </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Stock Price</span>
                                <span class="font-semibold text-main">${companyMetrics.find(m => m.metric === 'Stock Price')?.current_year || 'N/A'}</span>
                                </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Industry</span>
                                <span class="font-semibold text-main">${models[0] || 'N/A'}</span>
                                    </div>
                                    </div>
                                </div>
                    
                    <div class="card-modern">
                        <h3 class="text-lg font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 text-blue-400">
                                <path d="M3 3v18h18"></path>
                                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                            </svg>
                            Market Position
                        </h3>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Sector</span>
                                <span class="font-semibold text-main">${models[1] || 'N/A'}</span>
                                    </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">CEO</span>
                                <span class="font-semibold text-main">${insights.market.includes('CEO:') ? insights.market.split('CEO:')[1].split('<')[0] : 'N/A'}</span>
                                    </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Exchange</span>
                                <span class="font-semibold text-main">${insights.market.includes('Exchange:') ? insights.market.split('Exchange:')[1].split('<')[0] : 'N/A'}</span>
                                </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Status</span>
                                <span class="font-semibold text-green-400">Active</span>
                                    </div>
                                    </div>
                                </div>
                    
                    <div class="card-modern">
                        <h3 class="text-lg font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 text-purple-400">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22,4 12,14.01 9,11.01"></polyline>
                            </svg>
                            Growth Opportunities
                        </h3>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Revenue Trend</span>
                                <span class="font-semibold ${revenueGrowth.includes('-') ? 'text-red-400' : 'text-green-400'}">${revenueGrowth}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Market Cap Growth</span>
                                <span class="font-semibold ${marketCapGrowth.includes('-') ? 'text-red-400' : 'text-green-400'}">${marketCapGrowth}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Innovation Index</span>
                                <span class="font-semibold ${models[0]?.toLowerCase().includes('technology') ? 'text-blue-400' : 'text-green-400'}">${models[0]?.toLowerCase().includes('technology') ? 'High' : 'Medium'}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Expansion Potential</span>
                                <span class="font-semibold ${revenueGrowth.includes('-') ? 'text-yellow-400' : 'text-green-400'}">${revenueGrowth.includes('-') ? 'Limited' : 'Strong'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-modern">
                        <h3 class="text-lg font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 text-yellow-400">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            Risk Factors
                        </h3>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Market Volatility</span>
                                <span class="font-semibold ${stockChange.includes('-') ? 'text-red-400' : stockChange.includes('0') ? 'text-yellow-400' : 'text-green-400'}">${stockChange.includes('-') ? 'High' : stockChange.includes('0') ? 'Medium' : 'Low'}</span>
                                </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Regulatory Risk</span>
                                <span class="font-semibold ${models[1]?.toLowerCase().includes('financial') ? 'text-red-400' : 'text-yellow-400'}">${models[1]?.toLowerCase().includes('financial') ? 'High' : 'Low'}</span>
                                </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Competition</span>
                                <span class="font-semibold ${models[0]?.toLowerCase().includes('technology') ? 'text-red-400' : 'text-yellow-400'}">${models[0]?.toLowerCase().includes('technology') ? 'High' : 'Medium'}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-muted">Economic Exposure</span>
                                <span class="font-semibold ${revenueGrowth.includes('-') ? 'text-red-400' : 'text-yellow-400'}">${revenueGrowth.includes('-') ? 'High' : 'Medium'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- AI Predictions & Strategic Insights -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="card-modern">
                        <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" x2="12" y1="19" y2="22"></line>
                            </svg>
                            AI-Powered Predictions
                        </h3>
                        <div class="bg-secondary p-4 rounded-lg space-y-4">
                            <div class="prediction-item">
                                <div class="prediction-header">
                                    <span class="prediction-label">Live Analysis</span>
                                    <span class="prediction-confidence">Real-time Data</span>
                                </div>
                                <div class="prediction-value text-green-400">${stockChange} Today</div>
                                <div class="prediction-details text-sm text-muted">
                                    Current Price: ${stockPrice}
                                </div>
                            </div>
                            <div class="prediction-item">
                                <div class="prediction-header">
                                    <span class="prediction-label">Growth Indicators</span>
                                    <span class="prediction-confidence">Live Data</span>
                                </div>
                                <div class="prediction-value text-blue-400">${revenueGrowth} YoY</div>
                                <div class="prediction-details text-sm text-muted">
                                    Revenue Growth Rate
                                </div>
                            </div>
                            <div class="prediction-item">
                                <div class="prediction-header">
                                    <span class="prediction-label">AI Analysis</span>
                                    <span class="prediction-confidence">Live Insights</span>
                                </div>
                                <div class="prediction-value text-purple-400">${models[0] || 'Technology'}</div>
                                <div class="prediction-details text-sm text-muted">
                                    ${prediction.replace(/<[^>]*>/g, '')}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-modern">
                        <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <path d="M9 9h6v6H9z"></path>
                            </svg>
                            Performance Heatmap
                        </h3>
                        <div class="bg-secondary p-4 rounded-lg">
                            <div class="performance-heatmap">
                                <div class="heatmap-grid">
                                    <div class="heatmap-cell" style="background: rgba(16, 185, 129, 0.8);" data-metric="Revenue: Strong"></div>
                                    <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.6);" data-metric="Profit: Good"></div>
                                    <div class="heatmap-cell" style="background: rgba(16, 185, 129, 0.9);" data-metric="Growth: Excellent"></div>
                                    <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.7);" data-metric="Innovation: Good"></div>
                                    <div class="heatmap-cell" style="background: rgba(245, 158, 11, 0.6);" data-metric="Debt: Moderate"></div>
                                    <div class="heatmap-cell" style="background: rgba(16, 185, 129, 0.8);" data-metric="Cash: Strong"></div>
                                    <div class="heatmap-cell" style="background: rgba(59, 130, 246, 0.5);" data-metric="Efficiency: Average"></div>
                                    <div class="heatmap-cell" style="background: rgba(16, 185, 129, 0.7);" data-metric="ESG: Good"></div>
                                    <div class="heatmap-cell" style="background: rgba(16, 185, 129, 0.9);" data-metric="Brand: Excellent"></div>
                                </div>
                                <div class="heatmap-labels">
                                    <div class="heatmap-y-labels">
                                        <span>Financial</span>
                                        <span>Operational</span>
                                        <span>Strategic</span>
                                    </div>
                                    <div class="heatmap-x-labels">
                                        <span>Revenue</span><span>Profit</span><span>Growth</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Professional Strategic Business Intelligence - Dynamic Data -->
                <div class="card-modern">
                    <h3 class="text-xl font-semibold text-main mb-4 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                            <path d="M9 12l2 2 4-4"></path>
                            <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                            <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                        </svg>
                        Strategic Business Intelligence
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div class="bg-secondary p-4 rounded-lg">
                            <h4 class="font-semibold text-blue-400 mb-3">Financial Health</h4>
                            <ul class="text-sm text-muted space-y-2">
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${revenueGrowth.includes('-') ? 'bg-red-400' : 'bg-green-400'} rounded-full"></div>
                                    Market Cap: ${marketCap}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${revenueGrowth.includes('-') ? 'bg-red-400' : 'bg-green-400'} rounded-full"></div>
                                    Revenue Growth: ${revenueGrowth}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${stockChange.includes('-') ? 'bg-red-400' : 'bg-green-400'} rounded-full"></div>
                                    Stock Performance: ${stockChange}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    Current Price: ${stockPrice}
                                </li>
                            </ul>
                        </div>
                        
                        <div class="bg-secondary p-4 rounded-lg">
                            <h4 class="font-semibold text-green-400 mb-3">Market Position</h4>
                            <ul class="text-sm text-muted space-y-2">
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                                    Industry: ${models[0] || 'N/A'}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    Sector: ${models[1] || 'N/A'}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                                    CEO: ${insights.market.includes('CEO:') ? insights.market.split('CEO:')[1].split('<')[0].trim() : 'N/A'}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    Exchange: ${insights.market.includes('Exchange:') ? insights.market.split('Exchange:')[1].split('<')[0].trim() : 'N/A'}
                                </li>
                            </ul>
                        </div>
                        
                        <div class="bg-secondary p-4 rounded-lg">
                            <h4 class="font-semibold text-purple-400 mb-3">Growth Opportunities</h4>
                            <ul class="text-sm text-muted space-y-2">
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${revenueGrowth.includes('-') ? 'bg-yellow-400' : 'bg-green-400'} rounded-full"></div>
                                    Revenue Trend: ${revenueGrowth.includes('-') ? 'Declining' : 'Growing'}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${models[0]?.toLowerCase().includes('technology') ? 'bg-green-400' : 'bg-blue-400'} rounded-full"></div>
                                    Innovation Index: ${models[0]?.toLowerCase().includes('technology') ? 'High' : 'Medium'}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${marketCapGrowth !== 'N/A' && !marketCapGrowth.includes('-') ? 'bg-green-400' : 'bg-yellow-400'} rounded-full"></div>
                                    Market Cap Growth: ${marketCapGrowth}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${models[1]?.toLowerCase().includes('consumer') ? 'bg-green-400' : 'bg-blue-400'} rounded-full"></div>
                                    Market Expansion: ${models[1]?.toLowerCase().includes('consumer') ? 'Strong' : 'Moderate'}
                                </li>
                            </ul>
                        </div>
                        
                        <div class="bg-secondary p-4 rounded-lg">
                            <h4 class="font-semibold text-yellow-400 mb-3">Risk Factors</h4>
                            <ul class="text-sm text-muted space-y-2">
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${stockChange.includes('-') ? 'bg-red-400' : 'bg-yellow-400'} rounded-full"></div>
                                    Market Volatility: ${stockChange.includes('-') ? 'High' : 'Medium'}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${models[1]?.toLowerCase().includes('financial') ? 'bg-red-400' : 'bg-yellow-400'} rounded-full"></div>
                                    Regulatory Risk: ${models[1]?.toLowerCase().includes('financial') ? 'High' : 'Medium'}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${models[0]?.toLowerCase().includes('technology') ? 'bg-red-400' : 'bg-yellow-400'} rounded-full"></div>
                                    Competition: ${models[0]?.toLowerCase().includes('technology') ? 'High' : 'Medium'}
                                </li>
                                <li class="flex items-center gap-2">
                                    <div class="w-2 h-2 ${revenueGrowth.includes('-') ? 'bg-red-400' : 'bg-yellow-400'} rounded-full"></div>
                                    Economic Exposure: ${revenueGrowth.includes('-') ? 'High' : 'Medium'}
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    downloadReport() {
        this.showReportFormatModal();
    }

    // Add a modal for report format selection
    showReportFormatModal() {
        // Remove existing modal if present
        const existing = document.getElementById('report-format-modal');
        if (existing) existing.remove();
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'report-format-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.35)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
            <div style="background: #232946; color: #fff; padding: 2rem 2.5rem; border-radius: 1.25rem; box-shadow: 0 8px 32px #0008; min-width: 320px; text-align: center;">
                <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem;">Download Report As...</h2>
                <button id="report-pdf-btn" style="margin: 0 1rem 0 0; padding: 0.75rem 2rem; border-radius: 0.5rem; background: #3b82f6; color: #fff; font-weight: 600; border: none; font-size: 1rem; cursor: pointer;">PDF</button>
                <button id="report-doc-btn" style="padding: 0.75rem 2rem; border-radius: 0.5rem; background: #10b981; color: #fff; font-weight: 600; border: none; font-size: 1rem; cursor: pointer;">DOC</button>
                <div style="margin-top: 1.5rem;"><button id="report-cancel-btn" style="background: none; color: #aaa; border: none; font-size: 1rem; cursor: pointer;">Cancel</button></div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('report-pdf-btn').onclick = () => {
            modal.remove();
            this.downloadAnalysisReport();
        };
        document.getElementById('report-doc-btn').onclick = () => {
            modal.remove();
            this.downloadDocReport();
        };
        document.getElementById('report-cancel-btn').onclick = () => modal.remove();
    }

    // Add DOC report download logic
    downloadDocReport() {
        if (!this.state.lastAnalyzedCompany) return;
        const company = this.state.lastAnalyzedCompany;
        const { name, data: companyMetrics, prediction, models, insights, revenue_breakdown } = company;
        let docContent = `<h2 style='color:#232946;'>ASTRA AI FINANCIAL INSIGHTS REPORT</h2>`;
        docContent += `<h3 style='color:#3b82f6;'>${name} - Live Company Analytics</h3>`;
        docContent += `<p><strong>Live Data Stream Active</strong><br>Last Updated: ${new Date().toLocaleTimeString()}</p>`;
        
        // Key Metrics Table
        docContent += `<h4>Key Metrics</h4><table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;'>`;
        docContent += `<tr><th>Metric</th><th>Current</th><th>Previous</th><th>YoY Growth</th></tr>`;
        companyMetrics.forEach(m => {
            docContent += `<tr><td>${m.metric}</td><td>${m.current_year || 'N/A'}</td><td>${m.previous_year || 'N/A'}</td><td>${m.yoy_growth || 'N/A'}</td></tr>`;
        });
        docContent += `</table>`;
        
        // Revenue Breakdown
        if (revenue_breakdown && Array.isArray(revenue_breakdown) && revenue_breakdown.length > 0) {
            docContent += `<h4>Revenue Breakdown</h4><ul>`;
            revenue_breakdown.forEach(rb => {
                docContent += `<li>${rb.label}: ${rb.value}%</li>`;
            });
            docContent += `</ul>`;
        }
        
        // Financial Health
        docContent += `<h4>Financial Health</h4><ul>`;
        if (insights && insights.financial) {
            docContent += `<li>${insights.financial.replace(/<[^>]*>/g, '')}</li>`;
        }
        companyMetrics.forEach(m => {
            if (["Market Cap", "Revenue Growth", "Stock Price"].includes(m.metric)) {
                docContent += `<li>${m.metric}: ${m.current_year || 'N/A'}</li>`;
            }
        });
        docContent += `</ul>`;
        
        // Market Position
        docContent += `<h4>Market Position</h4><ul>`;
        if (insights && insights.market) {
            docContent += `<li>${insights.market.replace(/<[^>]*>/g, '')}</li>`;
        }
        if (company.industry) docContent += `<li>Industry: ${company.industry}</li>`;
        if (company.sector) docContent += `<li>Sector: ${company.sector}</li>`;
        if (company.ceo) docContent += `<li>CEO: ${company.ceo}</li>`;
        if (company.exchange) docContent += `<li>Exchange: ${company.exchange}</li>`;
        docContent += `</ul>`;
        
        // Strategic Overview
        docContent += `<h4>Strategic Overview</h4><ul>`;
        if (insights && insights.strategic) {
            docContent += `<li>${insights.strategic.replace(/<[^>]*>/g, '')}</li>`;
        }
        docContent += `</ul>`;
        
        // Growth Opportunities
        if (company.growth_opportunities) {
            docContent += `<h4>Growth Opportunities</h4><ul>`;
            company.growth_opportunities.forEach(go => {
                docContent += `<li>${go}</li>`;
            });
            docContent += `</ul>`;
        }
        
        // Risk Factors
        if (company.risk_factors) {
            docContent += `<h4>Risk Factors</h4><ul>`;
            company.risk_factors.forEach(rf => {
                docContent += `<li>${rf}</li>`;
            });
            docContent += `</ul>`;
        }
        
        // AI-Powered Predictions
        docContent += `<h4>AI-Powered Predictions</h4>`;
        docContent += `<p>${prediction?.replace(/<[^>]*>/g, '') || 'N/A'}</p>`;
        
        // Performance Heatmap (if available)
        if (company.performance_heatmap) {
            docContent += `<h4>Performance Heatmap</h4><ul>`;
            Object.entries(company.performance_heatmap).forEach(([k, v]) => {
                docContent += `<li>${k}: ${v}</li>`;
            });
            docContent += `</ul>`;
        }
        
        // Strategic Business Intelligence
        if (company.strategic_business_intel) {
            docContent += `<h4>Strategic Business Intelligence</h4><ul>`;
            company.strategic_business_intel.forEach(sbi => {
                docContent += `<li>${sbi}</li>`;
            });
            docContent += `</ul>`;
        }
        
        // Create a blob as HTML (Word will open it)
        const blob = new Blob([docContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Astra-Financial-Insights-Report-${name.replace(/\s+/g, '_')}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.logHistory('DOC Insights Report Downloaded', `Generated DOC financial insights report for ${name}`);
    }

    initializeAstraChat() {
        // Initialize chat system if needed
        if (this.state.astraChat.sessions.length === 0) {
            this.createDefaultChatSession();
        }
    }

    // Initialize voice synthesis system
    initializeVoiceSystem() {
        if (!this.voiceSystem.isSupported) {
            console.warn('Speech synthesis not supported in this browser');
            return;
        }

        // Wait for voices to be loaded
        const loadVoices = () => {
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                // Try to find a natural female voice for Astra dialogues
                const preferredVoices = [
                    'Microsoft Zira Desktop',
                    'Google UK English Female',
                    'Samantha',
                    'Karen',
                    'Moira',
                    'Victoria',
                    'Alex',
                    'Microsoft David Desktop'
                ];
                
                                    let selectedVoice = null;
                    for (const preferred of preferredVoices) {
                        selectedVoice = voices.find(voice => 
                            voice.name.includes(preferred) ||
                            voice.name.toLowerCase().includes('zira') ||
                            voice.name.toLowerCase().includes('samantha') ||
                            voice.name.toLowerCase().includes('karen') ||
                            voice.name.toLowerCase().includes('moira') ||
                            voice.name.toLowerCase().includes('victoria')
                        );
                        if (selectedVoice) break;
                    }
                
                // If no preferred voice found, try to find any English voice
                if (!selectedVoice) {
                    selectedVoice = voices.find(voice => 
                        voice.lang.startsWith('en') && 
                        !voice.name.toLowerCase().includes('novelty')
                    );
                }
                
                // Fallback to first available voice
                this.voiceSystem.roboticVoice = selectedVoice || voices[0];
                console.log('Voice system initialized with:', this.voiceSystem.roboticVoice?.name);
            }
        };

        // Load voices immediately if available
        loadVoices();
        
        // Also listen for voice changes (some browsers load voices asynchronously)
        speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }

    // Speak text with robotic voice characteristics
    speakRobotic(text, options = {}) {
        if (!this.voiceSystem.isSupported || !this.voiceSystem.isEnabled) {
            console.log('Voice synthesis not available or disabled');
            return;
        }

        // No debounce - speak immediately
        this.voiceSystem.isSpeaking = true;

                // Cancel any ongoing speech immediately
        speechSynthesis.cancel();
        
        // Speak immediately without delay
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Configure professional voice characteristics
        utterance.voice = this.voiceSystem.roboticVoice;
        
        // Adjust settings for mobile devices
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        utterance.rate = options.rate || (isMobile ? 0.85 : 0.9); // Natural speaking pace
        utterance.pitch = options.pitch || (isMobile ? 1.0 : 1.0); // Normal pitch
        utterance.volume = options.volume || 0.9;
        
        // Add robotic processing effects through text modification
        const roboticText = this.processTextForRobotic(text);
        utterance.text = roboticText;

        // Event handlers
        utterance.onstart = () => {
            console.log('🤖 Astra speaking:', text);
            this.voiceSystem.currentUtterance = utterance;
        };

        utterance.onend = () => {
            console.log('🤖 Astra finished speaking');
            this.voiceSystem.currentUtterance = null;
            this.voiceSystem.isSpeaking = false;
        };

        utterance.onerror = (event) => {
            console.error('🤖 Voice synthesis error:', event.error);
            this.voiceSystem.currentUtterance = null;
            this.voiceSystem.isSpeaking = false;
        };

        // Speak the text immediately
        speechSynthesis.speak(utterance);
    }

    // Process text for better pronunciation
    processTextForRobotic(text) {
        // Improve pronunciation and add natural pauses
        return text
            .replace(/\./g, '. ')  // Add pause after periods
            .replace(/,/g, ', ')   // Add pause after commas
            .replace(/Astra/g, 'Astra')  // Keep natural pronunciation
            .replace(/Bhanu/g, 'Bhanu')  // Keep natural pronunciation
            .replace(/—/g, ' - ')  // Replace em dash with spoken dash
            .replace(/\s+/g, ' ')  // Clean up extra spaces
            .trim()
    }

    // Stop any ongoing speech
    stopSpeech() {
        if (this.voiceSystem.currentUtterance) {
            speechSynthesis.cancel();
            this.voiceSystem.currentUtterance = null;
        }
        this.voiceSystem.isSpeaking = false;
    }

    // Voice indicator removed - no longer needed

    // Move these methods inside the AstraApp class:
    renameChatSession(sessionId) {
        const session = this.state.astraChat.sessions.find(s => s.id === sessionId);
        if (!session) return;
        let newName = prompt('Enter new chat name:', session.name);
        if (!newName) return;
        newName = newName.trim();
        if (!newName) return alert('Name cannot be empty.');
        if (this.state.astraChat.sessions.some(s => s.name === newName && s.id !== sessionId)) {
            return alert('A chat with this name already exists.');
        }
        session.name = newName;
        this.renderChatSessions();
    }
    shareChatSession(sessionId) {
        const session = this.state.astraChat.sessions.find(s => s.id === sessionId);
        if (!session) return;
        const text = JSON.stringify(session.messages, null, 2);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Chat session copied to clipboard!');
            }, () => {
                this.fallbackShare(text);
            });
        } else {
            this.fallbackShare(text);
        }
    }
    fallbackShare(text) {
        // Fallback: open a modal or prompt with the text
        prompt('Copy chat session JSON:', text);
    }

    deleteChatSession(sessionId) {
        if (!confirm('Are you sure you want to delete this chat session?')) return;
        const idx = this.state.astraChat.sessions.findIndex(s => s.id === sessionId);
        if (idx !== -1) {
            this.state.astraChat.sessions.splice(idx, 1);
            // If deleted session was active, switch to first available
            if (this.state.astraChat.activeSessionId === sessionId) {
                this.state.astraChat.activeSessionId = this.state.astraChat.sessions[0]?.id || null;
            }
            // If no sessions left, create a default one
            if (this.state.astraChat.sessions.length === 0) {
                this.createDefaultChatSession();
            }
            this.renderChatSessions();
            this.loadChatSession(this.state.astraChat.activeSessionId);
        }
    }

    // Add stubs for showFilterUI, runAnalysis, showPrediction
    showFilterUI() {
        // Show filter UI logic here
    }
    runAnalysis() {
        // Run analysis logic here
    }
    showPrediction() {
        // Show prediction logic here
    }

    // File reading utility method
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    // CSV parsing utility method
    parseCSVData(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
        
        return data;
    }

    // Data filtering utility method - now uses backend SQL-like filtering
    async applyDataFilter(data, filterCondition) {
        if (!filterCondition || filterCondition === 'Not specified' || filterCondition.trim() === '') {
            return data;
        }
        
        // Extract just the filter condition from SQL-like input
        let cleanFilterCondition = filterCondition;
        
        // If it looks like a full SQL query, extract just the WHERE clause
        if (filterCondition.toLowerCase().includes('select') && filterCondition.toLowerCase().includes('where')) {
            const whereMatch = filterCondition.match(/WHERE\s+(.+?)(?:;|$)/i);
            if (whereMatch) {
                cleanFilterCondition = whereMatch[1].trim();
                console.log(`Extracted filter condition: "${cleanFilterCondition}" from SQL: "${filterCondition}"`);
            }
        }
        
        try {
            // Use the new backend SQL-like filtering
            const response = await fetch('/api/apply-sql-filter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filter_condition: cleanFilterCondition,
                    file_data: data,
                    filename: 'current_file.csv'
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            // Log the filter results
            console.log(`Filter applied: ${cleanFilterCondition}`);
            console.log(`Original rows: ${result.original_count}, Filtered rows: ${result.filtered_count}`);
            
            return result.filtered_data;
            
        } catch (error) {
            console.error('Error applying SQL filter:', error);
            // Fallback to simple text-based filtering if backend fails
            try {
                const condition = filterCondition.toLowerCase();
                
                // Handle common filter patterns
                if (condition.includes('>') || condition.includes('<') || condition.includes('=')) {
                    // For numeric comparisons, we'll do a simple text-based filter
                    return data.filter(row => {
                        const rowString = JSON.stringify(row).toLowerCase();
                        return rowString.includes(condition.split(/[><=]/)[0].trim());
                    });
                } else {
                    // For text-based filters
                    return data.filter(row => {
                        const rowString = JSON.stringify(row).toLowerCase();
                        return rowString.includes(condition);
                    });
                }
            } catch (fallbackError) {
                console.error('Fallback filter also failed:', fallbackError);
                return data; // Return original data if all filtering fails
            }
        }
    }

    // Generate sample filtered data for demonstration
    async generateSampleFilteredData(filterCondition) {
        const sampleData = [
            { id: 1, name: 'John Doe', age: 25, department: 'Engineering', salary: 75000 },
            { id: 2, name: 'Jane Smith', age: 32, department: 'Marketing', salary: 65000 },
            { id: 3, name: 'Bob Johnson', age: 28, department: 'Engineering', salary: 80000 },
            { id: 4, name: 'Alice Brown', age: 35, department: 'Sales', salary: 70000 },
            { id: 5, name: 'Charlie Wilson', age: 29, department: 'Engineering', salary: 85000 }
        ];
        
        if (!filterCondition || filterCondition === 'Not specified') {
            return sampleData;
        }
        
        return await this.applyDataFilter(sampleData, filterCondition);
    }

    // File upload handler: after upload, auto-respond and set state
    onFileUploaded() {
        this.workflowState = 'awaiting_filter';
        this.lastStep = 'awaiting_filter';
        this.addChatMessage('Would you like to apply any filters, sir?', 'assistant');
    }
    // After filters applied, prompt for analysis
    onFiltersApplied() {
        this.workflowState = 'awaiting_analysis';
        this.lastStep = 'awaiting_analysis';
        this.addChatMessage('Filters applied. Ready for analysis?', 'assistant');
    }

    // NEW: Setup theme toggle button logic
    setupThemeToggle() {
        const btn = document.getElementById('theme-toggle-btn');
        const icon = document.getElementById('theme-toggle-icon');
        if (!btn || !icon) return;
        btn.onclick = () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem('astra-theme', isLight ? 'light' : 'dark');
            this.updateThemeIcon();
        };
        this.updateThemeIcon();
    }

    // NEW: Update the theme icon based on current mode
    updateThemeIcon() {
        const icon = document.getElementById('theme-toggle-icon');
        if (!icon) return;
        const isLight = document.body.classList.contains('light-mode');
        // Sun icon for light, moon for dark
        if (isLight) {
            icon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>`;
        } else {
            icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"></path>`;
        }
    }

    // NEW: Apply saved theme on load
    applySavedTheme() {
        const saved = localStorage.getItem('astra-theme');
        if (saved === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    }

    // === STUBS FOR COMMAND HANDLERS ===
    async handleNavigationCommands(lower, message) {
        // TODO: Implement navigation command handling
        return false;
    }
    async handleWorkflowCommands(lower, message) {
        console.log('[AstraApp] 🎯 Processing workflow command:', lower);
        console.log('[AstraApp] 🎯 Full message:', message);
        
        // Check for "initiate workflow" - this should navigate to batch data and click the real button
        if (lower.includes('initiate workflow') || lower.includes('start workflow') || lower.includes('begin workflow') || lower.includes('launch workflow')) {
            console.log('[AstraApp] ✅ Matched initiate workflow command');
            console.log('[AstraApp] 🚀 Navigating to batch data and initiating workflow...');
            
            this.addChatMessage('Navigating to batch data and initiating workflow, sir.', 'assistant');
            this.speakIfVoiceCommand('Navigating to batch data and initiating workflow, sir.');
            
            // Navigate to batch data page first, then click the real button
            await this.navigateToWorkflowAndInitiate();
            
            return true;
        }
        
        // Check for file selection commands
        if (lower.includes('choose file') || lower.includes('select file') || lower.includes('upload file')) {
            console.log('[AstraApp] ✅ Matched file selection command');
            const fileMatch = message.match(/(?:choose|select|upload)\s+file\s+(.+)/i);
            if (fileMatch) {
                const fileName = fileMatch[1];
                this.addChatMessage(`Selecting file: ${fileName}, sir.`, 'assistant');
                this.speakIfVoiceCommand(`Selecting file: ${fileName}, sir.`);
                // Simulate file selection in modal
                await this.simulateFileSelection(fileName);
            } else {
                // No specific file mentioned, open file picker
                this.addChatMessage('Opening file picker, sir.', 'assistant');
                this.speakIfVoiceCommand('Opening file picker, sir.');
                await this.openFilePicker();
            }
            return true;
        }
        
        // Check for filter commands
        if (lower.includes('set filter') || lower.includes('apply filter') || lower.includes('filter data')) {
            console.log('[AstraApp] ✅ Matched filter command');
            const filterMatch = message.match(/(?:set|apply)\s+filter\s+(.+)/i) || message.match(/filter\s+data\s+(.+)/i);
            if (filterMatch) {
                const filterCondition = filterMatch[1];
                this.addChatMessage(`Applying SQL filter: ${filterCondition}, sir.`, 'assistant');
                this.speakIfVoiceCommand(`Applying SQL filter: ${filterCondition}, sir.`);
                await this.setWorkflowFilter(filterCondition);
            }
            return true;
        }
        
        // Check for specific SQL-like filter commands
        if (lower.includes('weekly sales greater than') || lower.includes('sales greater than')) {
            console.log('[AstraApp] ✅ Matched SQL filter command');
            const numberMatch = message.match(/(\d+)/);
            if (numberMatch) {
                const value = numberMatch[1];
                const filterCondition = `Weekly_Sales > ${value}`;
                this.addChatMessage(`Applying SQL filter: ${filterCondition}, sir.`, 'assistant');
                this.speakIfVoiceCommand(`Applying SQL filter: Weekly_Sales greater than ${value}, sir.`);
                await this.setWorkflowFilter(filterCondition);
            } else {
                this.addChatMessage('Please specify a number value for the filter, sir.', 'assistant');
                this.speakIfVoiceCommand('Please specify a number value for the filter, sir.');
            }
            return true;
        }
        
        // Check for join tables commands
        if (lower.includes('join tables') || lower.includes('enable join') || lower.includes('disable join')) {
            console.log('[AstraApp] ✅ Matched join tables command');
            const enable = lower.includes('enable') || lower.includes('join tables');
            this.addChatMessage(`${enable ? 'Enabling' : 'Disabling'} join tables, sir.`, 'assistant');
            this.speakIfVoiceCommand(`${enable ? 'Enabling' : 'Disabling'} join tables, sir.`);
            await this.toggleJoinTables(enable);
            return true;
        }
        
        // Check for store data commands
        if (lower.includes('store data') || lower.includes('save data') || lower.includes('skip storing')) {
            console.log('[AstraApp] ✅ Matched store data command');
            const store = !lower.includes('skip');
            this.addChatMessage(`${store ? 'Storing' : 'Skipping'} data storage, sir.`, 'assistant');
            this.speakIfVoiceCommand(`${store ? 'Storing' : 'Skipping'} data storage, sir.`);
            await this.setStoreDataOption(store);
            return true;
        }
        
        // Check for analysis commands
        if (lower.includes('run analysis') || lower.includes('analyze data') || lower.includes('skip analysis')) {
            console.log('[AstraApp] ✅ Matched analysis command');
            const analyze = !lower.includes('skip');
            this.addChatMessage(`${analyze ? 'Running' : 'Skipping'} data analysis, sir.`, 'assistant');
            this.speakIfVoiceCommand(`${analyze ? 'Running' : 'Skipping'} data analysis, sir.`);
            await this.setAnalysisOption(analyze);
            return true;
        }
        
        // Check for run workflow command
        if (lower.includes('run workflow') || lower.includes('submit workflow') || lower.includes('execute workflow')) {
            console.log('[AstraApp] ✅ Matched run workflow command');
            
            // Check if we have a file first
            const fileInput = document.getElementById('workflow-file-input');
            if (!fileInput || fileInput.files.length === 0) {
                this.addChatMessage('Please upload a file first before running the workflow, sir.', 'assistant');
                this.speakIfVoiceCommand('Please upload a file first before running the workflow, sir.');
                return true;
            }
            
            this.addChatMessage('Running workflow now, sir.', 'assistant');
            this.speakIfVoiceCommand('Running workflow now, sir.');
            await this.submitWorkflow();
            return true;
        }
        
        // Check for cancel workflow command
        if (lower.includes('cancel workflow') || lower.includes('close workflow') || lower.includes('abort workflow')) {
            console.log('[AstraApp] ✅ Matched cancel workflow command');
            this.addChatMessage('Cancelling workflow, sir.', 'assistant');
            this.speakIfVoiceCommand('Cancelling workflow, sir.');
            await this.cancelWorkflow();
            return true;
        }
        
        // Check for workflow status command
        if (lower.includes('workflow status') || lower.includes('check workflow') || lower.includes('current workflow')) {
            console.log('[AstraApp] ✅ Matched workflow status command');
            await this.checkWorkflowStatus();
            return true;
        }
        
        // Check for help command
        if (lower.includes('workflow help') || lower.includes('workflow commands') || lower.includes('what can I say')) {
            console.log('[AstraApp] ✅ Matched workflow help command');
            const helpMessage = `Available workflow commands, sir:
            
📋 **Workflow Control:**
• "initiate workflow" - Navigate to batch data and open workflow modal
• "run workflow" - Submit the current workflow
• "cancel workflow" - Cancel and close the workflow
• "workflow status" - Check current workflow configuration

📁 **File Operations:**
• "choose file [filename]" - Select a specific file
• "upload file" - Open file selection dialog

🔧 **Configuration:**
• "set filter [condition]" - Apply data filter (e.g., "set filter age > 30")
• "join tables" - Enable table joining
• "disable join" - Disable table joining

💾 **Data Options:**
• "store data" - Enable data storage
• "skip storing" - Disable data storage
• "run analysis" - Enable data analysis
• "skip analysis" - Disable data analysis

Note: "initiate workflow" works from any page and navigates you to the proper location, sir.`;
            
            this.addChatMessage(helpMessage, 'assistant');
            this.speakIfVoiceCommand('I have listed all available workflow commands, sir.');
            return true;
        }
        
        console.log('[AstraApp] ❌ No workflow command matched');
        return false;
    }

    // Navigate to batch data and initiate real workflow
    async navigateToWorkflowAndInitiate() {
        try {
            console.log('[AstraApp] 🚀 Starting navigation to batch data...');
            
            // Step 1: Navigate to batch data page
            console.log('[AstraApp] 📋 Step 1: Navigating to batch data page');
            this.addChatMessage('Navigating to batch data page, sir.', 'assistant');
            this.speakIfVoiceCommand('Navigating to batch data page, sir.');
            
            // Close workspace if it's open and return to main app
            if (this.state.isWorkspaceOpen) {
                console.log('[AstraApp] 🔧 Closing workspace to navigate to batch data');
                this.addChatMessage('Closing workspace to navigate to batch data, sir.', 'assistant');
                this.speakIfVoiceCommand('Closing workspace to navigate to batch data, sir.');
                this.closeWorkspace();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Use the real switchView function to navigate
            this.switchView('#batch-data');
            
            // Wait for navigation to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Step 2: Find and click the real "Initiate Workflow" button
            console.log('[AstraApp] 📋 Step 2: Looking for initiate workflow button');
            const initiateBtn = document.getElementById('initiate-workflow-btn');
            
            if (initiateBtn) {
                console.log('[AstraApp] ✅ Found initiate workflow button, clicking...');
                this.addChatMessage('Found initiate workflow button, clicking it now, sir.', 'assistant');
                this.speakIfVoiceCommand('Found initiate workflow button, clicking it now, sir.');
                
                // Click the real button
                initiateBtn.click();
                
                // Wait for modal to open
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Step 3: Check if modal opened successfully
                const modal = document.getElementById('workflow-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    console.log('[AstraApp] ✅ Workflow modal opened successfully');
                    this.addChatMessage('Workflow modal opened successfully, sir. You can now upload a file and use voice commands to control the workflow.', 'assistant');
                    this.speakIfVoiceCommand('Workflow modal opened successfully, sir. You can now upload a file and use voice commands to control the workflow.');
                } else {
                    console.error('[AstraApp] ❌ Workflow modal failed to open');
                    this.addChatMessage('Workflow modal failed to open, sir. Please try again.', 'assistant');
                    this.speakIfVoiceCommand('Workflow modal failed to open, sir. Please try again.');
                }
            } else {
                console.error('[AstraApp] ❌ Initiate workflow button not found');
                this.addChatMessage('Could not find the initiate workflow button, sir. Please make sure you are on the batch data page.', 'assistant');
                this.speakIfVoiceCommand('Could not find the initiate workflow button, sir. Please make sure you are on the batch data page.');
            }
            
        } catch (error) {
            console.error('[AstraApp] ❌ Error in navigation workflow:', error);
            this.addChatMessage('Error occurred while navigating to workflow, sir.', 'assistant');
            this.speakIfVoiceCommand('Error occurred while navigating to workflow, sir.');
        }
    }

    // Complete workflow automation method
    async runCompleteWorkflowAutomation() {
        try {
            console.log('[AstraApp] 🚀 Starting complete workflow automation');
            
            // Step 1: Check if user has already uploaded a file BEFORE opening modal
            console.log('[AstraApp] 📋 Step 1: Checking for uploaded files');
            const fileInput = document.getElementById('workflow-file-input');
            const hasSelectedFile = fileInput && fileInput.files.length > 0;
            
            console.log('[AstraApp] 🔍 File input:', fileInput);
            console.log('[AstraApp] 🔍 Files count:', fileInput?.files?.length || 0);
            
            if (!hasSelectedFile) {
                console.log('[AstraApp] ❌ No file uploaded');
                this.addChatMessage('Please upload a file first before initiating the workflow, sir.', 'assistant');
                this.speakIfVoiceCommand('Please upload a file first before initiating the workflow, sir.');
                
                // Open modal to show file upload area
                const modal = document.getElementById('workflow-modal');
                if (modal && modal.classList.contains('hidden')) {
                    modal.classList.remove('hidden');
                }
                
                // Highlight the file input area
                const fileInputContainer = fileInput?.closest('div');
                if (fileInputContainer) {
                    fileInputContainer.style.border = '2px solid #ef4444';
                    fileInputContainer.style.borderRadius = '8px';
                    setTimeout(() => {
                        fileInputContainer.style.border = '';
                        fileInputContainer.style.borderRadius = '';
                    }, 3000);
                }
                return;
            }
            
            console.log('[AstraApp] ✅ File already uploaded');
            console.log('[AstraApp] 🔍 File details:', {
                name: fileInput.files[0]?.name,
                size: fileInput.files[0]?.size,
                type: fileInput.files[0]?.type
            });
            
            // Step 2: Ensure workflow modal is open (but don't reset the form)
            console.log('[AstraApp] 📋 Step 2: Checking workflow modal');
            const modal = document.getElementById('workflow-modal');
            console.log('[AstraApp] 🔍 Modal element:', modal);
            console.log('[AstraApp] 🔍 Modal hidden class:', modal?.classList.contains('hidden'));
            
            if (!modal || modal.classList.contains('hidden')) {
                console.log('[AstraApp] 🔧 Modal not open, opening it manually (without reset)');
                modal?.classList.remove('hidden');
                // Wait for modal to be ready
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Verify modal is now visible
                const modalAfter = document.getElementById('workflow-modal');
                console.log('[AstraApp] 🔍 Modal after opening:', modalAfter?.classList.contains('hidden') ? 'HIDDEN' : 'VISIBLE');
            } else {
                console.log('[AstraApp] ✅ Modal already open');
            }
            
            // Step 3: Set default filter (optional)
            console.log('[AstraApp] 📋 Step 3: Setting filter');
            await this.setWorkflowFilter(''); // No filter by default
            
            // Step 4: Set default options (store: yes, analyze: yes)
            console.log('[AstraApp] 📋 Step 4: Setting options');
            await this.setStoreDataOption(true);
            await this.setAnalysisOption(true);
            
            // Step 5: Submit the workflow
            console.log('[AstraApp] 📋 Step 5: Submitting workflow');
            this.addChatMessage('Submitting workflow for processing, sir.', 'assistant');
            this.speakIfVoiceCommand('Submitting workflow for processing, sir.');
            await this.submitWorkflow();
            
            console.log('[AstraApp] ✅ Complete workflow automation finished successfully');
            
        } catch (error) {
            console.error('[AstraApp] ❌ Error in complete workflow automation:', error);
            this.addChatMessage('Workflow automation encountered an error, sir.', 'assistant');
            this.speakIfVoiceCommand('Workflow automation encountered an error, sir.');
        }
    }

    // Helper methods for workflow automation

    async setWorkflowFilter(filterCondition) {
        const filterInput = document.getElementById('filter-condition-input');
        const sqlPreview = document.getElementById('sql-preview');
        if (filterInput) {
            filterInput.value = filterCondition;
            filterInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (sqlPreview) {
            if (filterCondition && filterCondition.trim() !== '') {
                sqlPreview.textContent = `SELECT * FROM walmart_sales WHERE ${filterCondition};`;
            } else {
                sqlPreview.textContent = '';
            }
        }
    }

    async toggleJoinTables(enable) {
        const joinToggle = document.getElementById('join-toggle');
        if (joinToggle) {
            joinToggle.checked = enable;
            joinToggle.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    async setStoreDataOption(store) {
        const radio = document.querySelector(`input[name="store-data"][value="${store ? 'yes' : 'no'}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    async setAnalysisOption(analyze) {
        const radio = document.querySelector(`input[name="analyze-data"][value="${analyze ? 'yes' : 'no'}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    async submitWorkflow() {
        console.log('[AstraApp] 🔧 Attempting to submit workflow');
        const submitBtn = document.getElementById('submit-workflow-btn');
        if (submitBtn) {
            console.log('[AstraApp] ✅ Submit button found, clicking...');
            submitBtn.click();
            console.log('[AstraApp] ✅ Submit button clicked');
        } else {
            console.error('[AstraApp] ❌ Submit button not found');
        }
    }

    async cancelWorkflow() {
        // First, ensure the workflow modal is open
        const modal = document.getElementById('workflow-modal');
        if (modal && modal.classList.contains('hidden')) {
            this.openWorkflowModal();
            // Wait a moment for the modal to open
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const cancelBtn = document.getElementById('cancel-workflow-btn');
        if (cancelBtn) {
            cancelBtn.click();
        }
    }

    async runWorkflow() {
        // First, ensure the workflow modal is open
        const modal = document.getElementById('workflow-modal');
        if (modal && modal.classList.contains('hidden')) {
            this.openWorkflowModal();
            // Wait a moment for the modal to open
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Check if a file is selected
        const fileInput = document.getElementById('workflow-file-input');
        if (!fileInput || fileInput.files.length === 0) {
            console.log('[AstraApp] ⚠️ No file selected for workflow');
            this.speakIfVoiceCommand("I need a file to run the workflow, sir. Please upload a file first.");
            return;
        }
        
        const submitBtn = document.getElementById('submit-workflow-btn');
        if (submitBtn) {
            console.log('[AstraApp] ✅ Running workflow with file:', fileInput.files[0].name);
            submitBtn.click();
        } else {
            console.error('[AstraApp] ❌ Run workflow button not found');
        }
    }

    async openFilePicker() {
        const fileInput = document.getElementById('workflow-file-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    async checkWorkflowStatus() {
        const fileInput = document.getElementById('workflow-file-input');
        const filterInput = document.getElementById('filter-condition-input');
        const joinToggle = document.getElementById('join-toggle');
        const storeRadio = document.querySelector('input[name="store-data"]:checked');
        const analyzeRadio = document.querySelector('input[name="analyze-data"]:checked');
        
        let status = 'Current workflow status, sir:\n\n';
        
        // File status
        if (fileInput && fileInput.files.length > 0) {
            status += `📁 File: ${fileInput.files[0].name} (${(fileInput.files[0].size / 1024).toFixed(1)} KB)\n`;
        } else {
            status += '📁 File: No file selected\n';
        }
        
        // Filter status
        const filterValue = filterInput?.value || '';
        status += `🔧 Filter: ${filterValue ? filterValue : 'None'}\n`;
        
        // Join tables status
        status += `🔗 Join Tables: ${joinToggle?.checked ? 'Enabled' : 'Disabled'}\n`;
        
        // Store data status
        status += `💾 Store Data: ${storeRadio?.value === 'yes' ? 'Yes' : 'No'}\n`;
        
        // Analyze data status
        status += `📊 Analyze Data: ${analyzeRadio?.value === 'yes' ? 'Yes' : 'No'}\n`;
        
        this.addChatMessage(status, 'assistant');
        this.speakIfVoiceCommand('I have provided the current workflow status, sir.');
    }

    // Test function for workflow commands (for debugging)
    async testWorkflowCommand(command) {
        console.log(`🧪 Testing workflow command: "${command}"`);
        this.isVoiceCommand = true;
        const result = await this.handleWorkflowCommands(command.toLowerCase(), command);
        console.log(`🧪 Command result: ${result}`);
        return result;
    }

    // Demo function to show complete workflow process
    async demoCompleteWorkflow() {
        console.log('🎬 Starting complete workflow demo...');
        
        // Step 1: Navigate and initiate
        console.log('🎬 Step 1: Initiating workflow...');
        await this.testWorkflowCommand('initiate workflow');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 2: Show status
        console.log('🎬 Step 2: Checking status...');
        await this.testWorkflowCommand('workflow status');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 3: Set some options
        console.log('🎬 Step 3: Setting filter...');
        await this.testWorkflowCommand('set filter age > 25');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('🎬 Step 4: Enable join tables...');
        await this.testWorkflowCommand('join tables');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('🎬 Demo complete! Upload a file and say "run workflow" to complete the process.');
    }

    async handleContextAwareCommands(lower, message) {
        // TODO: Implement context-aware command handling
        return false;
    }
    async handleDataCommands(lower, message) {
        // TODO: Implement data command handling
        return false;
    }

    // Enhanced voice command handling with intelligent agent integration
    speakIfVoiceCommand(text) {
        if (this.isVoiceCommand) {
            this.speakRobotic(text);
            this.isVoiceCommand = false; // Reset after speaking
        }
        
        // Also notify the voice agent if active
        if (window.astraVoiceAgent && window.astraVoiceAgent.isActive) {
            window.astraVoiceAgent.context.conversationHistory.push({
                type: 'assistant',
                text: text,
                timestamp: new Date()
            });
        }
    }

    // Enhanced command processing with agent integration
    async handleAgentCommand(command, context) {
        // Set voice command flag
        this.isVoiceCommand = true;
        
        // Process through existing chat system
        await this.processUserMessage(command);
        
        // Update agent context
        if (window.astraVoiceAgent) {
            window.astraVoiceAgent.context.currentView = this.state.currentView;
            window.astraVoiceAgent.context.workflowState = this.workflowState;
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.astraApp = new AstraApp();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AstraApp;
}

// === SMART VOICE-GUIDED WORKFLOW FUNCTION ===
window.App = window.App || {};
window.App.runSmartWorkflowInteractive = async function(commandText) {
    function extractFileName(text) {
        const match = text.match(/([\w\-]+\.(csv|xlsx|xls|json|txt))/i);
        return match ? match[1] : null;
    }
    function extractFilterCondition(text) {
        const match = text.match(/filter (?:by|on|for) ([^.,;]+)/i);
        return match ? match[1].trim() : null;
    }
    function speakAndConfirm(text, onYes) {
        return new Promise((resolve) => {
            if (window.App && App._autonomousActive) {
                // In autonomous mode, skip all confirmations and just say 'Yes sir.'
            const synth = window.speechSynthesis;
                const utter = new SpeechSynthesisUtterance('Yes sir.');
            synth.speak(utter);
            utter.onend = () => {
                    onYes && onYes();
                    resolve(true);
                };
                } else {
                const synth = window.speechSynthesis;
                const utter = new SpeechSynthesisUtterance(text);
                synth.speak(utter);
                utter.onend = () => {
                    // Fallback: prompt
                    resolve(confirm(text + '\n(Click OK for Yes, Cancel for No)'));
            };
            }
        });
    }
    function waitForSelector(sel, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            function check() {
                const el = document.querySelector(sel);
                if (el) return resolve(el);
                if (Date.now() - start > timeout) return reject('Timeout: ' + sel);
                setTimeout(check, 100);
            }
            check();
        });
    }
    // Step 1: Open Batch Data page
    await waitForSelector('.nav-item[href="#batch-data"]');
    document.querySelector('.nav-item[href="#batch-data"]').click();
    // In autonomous mode, skip the workflow popup message and all confirmations
    const isAutonomous = window.App && App._autonomousActive;
    const proceed = async () => {
        // Step 3: Upload file (simulate or prompt)
        const fileName = extractFileName(commandText);
        if (fileName) {
            await waitForSelector('#workflow-file-input');
            const fileInput = document.getElementById('workflow-file-input');
            fileInput.click();
            const afterFile = async () => {
                // Step 4: Apply filter condition
                const filterCond = extractFilterCondition(commandText);
                if (filterCond) {
                    await waitForSelector('#filter-condition-input');
                    document.getElementById('filter-condition-input').value = filterCond;
                    const afterFilter = async () => {
                        // Step 5: Store/Analyze radio buttons (default to Yes)
                        await waitForSelector('input[name="store-data"]');
                        document.querySelector('input[name="store-data"][value="yes"]').checked = true;
                        document.querySelector('input[name="analyze-data"][value="yes"]').checked = true;
                        const afterSettings = async () => {
                            // Step 6: Run workflow
                            await waitForSelector('#submit-workflow-btn');
                            document.getElementById('submit-workflow-btn').click();
                            const afterRun = async () => {
                                // Step 7: Go to Data Analysis tab
                                await waitForSelector('.nav-item[href="#data-analysis"]');
                                document.querySelector('.nav-item[href="#data-analysis"]').click();
                                if (!isAutonomous) speakAndConfirm('Navigated to Data Analysis page. Workflow is complete!');
                            };
                            if (isAutonomous) { await afterRun(); }
                            else await speakAndConfirm('Workflow completed. Would you like me to go to the Data Analysis page?', afterRun);
                        };
                        if (isAutonomous) { await afterSettings(); }
                        else await speakAndConfirm('Settings configured. Should I run the workflow now?', afterSettings);
                    };
                    if (isAutonomous) { await afterFilter(); }
                    else await speakAndConfirm(`File uploaded. Should I apply the filter: ${filterCond}?`, afterFilter);
                } else {
                    const afterNoFilter = async () => {
                        await waitForSelector('input[name="store-data"]');
                        document.querySelector('input[name="store-data"][value="yes"]').checked = true;
                        document.querySelector('input[name="analyze-data"][value="yes"]').checked = true;
                        const afterSettings = async () => {
                            await waitForSelector('#submit-workflow-btn');
                            document.getElementById('submit-workflow-btn').click();
                            const afterRun = async () => {
                                await waitForSelector('.nav-item[href="#data-analysis"]');
                                document.querySelector('.nav-item[href="#data-analysis"]').click();
                                if (!isAutonomous) speakAndConfirm('Navigated to Data Analysis page. Workflow is complete!');
                            };
                            if (isAutonomous) { await afterRun(); }
                            else await speakAndConfirm('Workflow completed. Would you like me to go to the Data Analysis page?', afterRun);
                        };
                        if (isAutonomous) { await afterSettings(); }
                        else await speakAndConfirm('Settings configured. Should I run the workflow now?', afterSettings);
                    };
                    if (isAutonomous) { await afterNoFilter(); }
                    else await speakAndConfirm('No filter condition found. Should I proceed without a filter?', afterNoFilter);
                }
            };
            if (isAutonomous) { await afterFile(); }
            else await speakAndConfirm(`Please select the file ${fileName} in the file picker, then say Yes when done.`, afterFile);
        } else {
            const afterNoFile = async () => {
                // Step 4: Apply filter condition
                const filterCond = extractFilterCondition(commandText);
                if (filterCond) {
                    await waitForSelector('#filter-condition-input');
                    document.getElementById('filter-condition-input').value = filterCond;
                    const afterFilter = async () => {
                        await waitForSelector('input[name="store-data"]');
                        document.querySelector('input[name="store-data"][value="yes"]').checked = true;
                        document.querySelector('input[name="analyze-data"][value="yes"]').checked = true;
                        const afterSettings = async () => {
                            await waitForSelector('#submit-workflow-btn');
                            document.getElementById('submit-workflow-btn').click();
                            const afterRun = async () => {
                                await waitForSelector('.nav-item[href="#data-analysis"]');
                                document.querySelector('.nav-item[href="#data-analysis"]').click();
                                if (!isAutonomous) speakAndConfirm('Navigated to Data Analysis page. Workflow is complete!');
                            };
                            if (isAutonomous) { await afterRun(); }
                            else await speakAndConfirm('Workflow completed. Would you like me to go to the Data Analysis page?', afterRun);
                        };
                        if (isAutonomous) { await afterSettings(); }
                        else await speakAndConfirm('Settings configured. Should I run the workflow now?', afterSettings);
                    };
                    if (isAutonomous) { await afterFilter(); }
                    else await speakAndConfirm(`File uploaded. Should I apply the filter: ${filterCond}?`, afterFilter);
                } else {
                    const afterNoFilter = async () => {
                        await waitForSelector('input[name="store-data"]');
                        document.querySelector('input[name="store-data"][value="yes"]').checked = true;
                        document.querySelector('input[name="analyze-data"][value="yes"]').checked = true;
                        const afterSettings = async () => {
                            await waitForSelector('#submit-workflow-btn');
                            document.getElementById('submit-workflow-btn').click();
                            const afterRun = async () => {
                                await waitForSelector('.nav-item[href="#data-analysis"]');
                                document.querySelector('.nav-item[href="#data-analysis"]').click();
                                if (!isAutonomous) speakAndConfirm('Navigated to Data Analysis page. Workflow is complete!');
                            };
                            if (isAutonomous) { await afterRun(); }
                            else await speakAndConfirm('Workflow completed. Would you like me to go to the Data Analysis page?', afterRun);
                        };
                        if (isAutonomous) { await afterSettings(); }
                        else await speakAndConfirm('Settings configured. Should I run the workflow now?', afterSettings);
                    };
                    if (isAutonomous) { await afterNoFilter(); }
                    else await speakAndConfirm('No filter condition found. Should I proceed without a filter?', afterNoFilter);
                }
            };
            if (isAutonomous) { await afterNoFile(); }
            else await speakAndConfirm('No file name found in your command. Please select a file in the popup, then say Yes.', afterNoFile);
        }
    };
    if (isAutonomous) {
        await proceed();
    } else {
        await speakAndConfirm('Workflow popup is ready. Should I locate and upload the file?', proceed);
    }
};
// === END SMART VOICE-GUIDED WORKFLOW FUNCTION ===

// === ASTRA VOICE AGENT INTEGRATION ===
window.App = window.App || {};

// Integration with new voice agent system
App.activateVoiceAgent = function() {
    if (window.astraVoiceAgent) {
        window.astraVoiceAgent.activate();
    }
};

App.deactivateVoiceAgent = function() {
    if (window.astraVoiceAgent) {
        window.astraVoiceAgent.deactivate();
    }
};

App.toggleVoiceAgent = function() {
    if (window.astraVoiceAgent) {
        window.astraVoiceAgent.toggle();
    }
};

// Backward compatibility aliases
App.activateAutonomousMode = App.activateVoiceAgent;
App.deactivateAutonomousMode = App.deactivateVoiceAgent;
App.toggleAutonomousMode = App.toggleVoiceAgent;

// === END ASTRA VOICE AGENT INTEGRATION ===

// === ENHANCED VOICE AGENT INTEGRATION ===
// This section provides enhanced integration between the new voice agent and existing systems

// Global voice agent utilities
window.App = window.App || {};
App._voiceAgentActive = false;

// Enhanced voice agent activation with visual feedback
App.activateVoiceAgent = function() {
    if (window.astraVoiceAgent) {
        window.astraVoiceAgent.activate();
        App._voiceAgentActive = true;
        
        // Notify main app
        if (window.astraApp) {
            window.astraApp.isVoiceCommand = true;
        }
    }
};

App.deactivateVoiceAgent = function() {
    if (window.astraVoiceAgent) {
        window.astraVoiceAgent.deactivate();
        App._voiceAgentActive = false;
    }
};

App.toggleVoiceAgent = function() {
    if (App._voiceAgentActive) {
        App.deactivateVoiceAgent();
    } else {
        App.activateVoiceAgent();
    }
};

// Backward compatibility
App.activateAutonomousMode = App.activateVoiceAgent;
App.deactivateAutonomousMode = App.deactivateVoiceAgent;
App.toggleAutonomousMode = App.toggleVoiceAgent;

// === END ENHANCED VOICE AGENT INTEGRATION ===

// Patch runSmartWorkflowInteractive to use pending actions for confirmations
window.App = window.App || {};
window.App.runSmartWorkflowInteractive = async function(commandText) {
    function extractFileName(text) {
        const match = text.match(/([\w\-]+\.(csv|xlsx|xls|json|txt))/i);
        return match ? match[1] : null;
    }
    function extractFilterCondition(text) {
        const match = text.match(/filter (?:by|on|for) ([^.,;]+)/i);
        return match ? match[1].trim() : null;
    }
    function speakAndConfirm(text, onYes) {
        return new Promise((resolve) => {
            if (window.App && App._autonomousActive) {
                // In autonomous mode, skip all confirmations and just say 'Yes sir.'
            const synth = window.speechSynthesis;
                const utter = new SpeechSynthesisUtterance('Yes sir.');
            synth.speak(utter);
            utter.onend = () => {
                    onYes && onYes();
                    resolve(true);
                };
                } else {
                const synth = window.speechSynthesis;
                const utter = new SpeechSynthesisUtterance(text);
                synth.speak(utter);
                utter.onend = () => {
                    // Fallback: prompt
                    resolve(confirm(text + '\n(Click OK for Yes, Cancel for No)'));
            };
            }
        });
    }
    function waitForSelector(sel, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            function check() {
                const el = document.querySelector(sel);
                if (el) return resolve(el);
                if (Date.now() - start > timeout) return reject('Timeout: ' + sel);
                setTimeout(check, 100);
            }
            check();
        });
    }
    // Step 1: Open Batch Data page
    await waitForSelector('.nav-item[href="#batch-data"]');
    document.querySelector('.nav-item[href="#batch-data"]').click();
    await speakAndConfirm('Workflow popup is ready. Should I locate and upload the file?', async () => {
        // Step 3: Upload file (simulate or prompt)
        const fileName = extractFileName(commandText);
        if (fileName) {
            await waitForSelector('#workflow-file-input');
            const fileInput = document.getElementById('workflow-file-input');
            fileInput.click();
            await speakAndConfirm(`Please select the file ${fileName} in the file picker, then say Yes when done.`, async () => {
                // Step 4: Apply filter condition
                const filterCond = extractFilterCondition(commandText);
                if (filterCond) {
                    await waitForSelector('#filter-condition-input');
                    document.getElementById('filter-condition-input').value = filterCond;
                    await speakAndConfirm(`File uploaded. Should I apply the filter: ${filterCond}?`, async () => {
                        // Step 5: Store/Analyze radio buttons (default to Yes)
                        await waitForSelector('input[name="store-data"]');
                        document.querySelector('input[name="store-data"][value="yes"]').checked = true;
                        document.querySelector('input[name="analyze-data"][value="yes"]').checked = true;
                        await speakAndConfirm('Settings configured. Should I run the workflow now?', async () => {
                            // Step 6: Run workflow
                            await waitForSelector('#submit-workflow-btn');
                            document.getElementById('submit-workflow-btn').click();
                            await speakAndConfirm('Workflow completed. Would you like me to go to the Data Analysis page?', async () => {
                                // Step 7: Go to Data Analysis tab
                                await waitForSelector('.nav-item[href="#data-analysis"]');
                                document.querySelector('.nav-item[href="#data-analysis"]').click();
                                speakAndConfirm('Navigated to Data Analysis page. Workflow is complete!');
                            });
                        });
                    });
                } else {
                    await speakAndConfirm('No filter condition found. Should I proceed without a filter?', async () => {
                        // Step 5: Store/Analyze radio buttons (default to Yes)
                        await waitForSelector('input[name="store-data"]');
                        document.querySelector('input[name="store-data"][value="yes"]').checked = true;
                        document.querySelector('input[name="analyze-data"][value="yes"]').checked = true;
                        await speakAndConfirm('Settings configured. Should I run the workflow now?', async () => {
                            // Step 6: Run workflow
                            await waitForSelector('#submit-workflow-btn');
                            document.getElementById('submit-workflow-btn').click();
                            await speakAndConfirm('Workflow completed. Would you like me to go to the Data Analysis page?', async () => {
                                // Step 7: Go to Data Analysis tab
                                await waitForSelector('.nav-item[href="#data-analysis"]');
                                document.querySelector('.nav-item[href="#data-analysis"]').click();
                                speakAndConfirm('Navigated to Data Analysis page. Workflow is complete!');
                            });
                        });
                    });
                }
            });
        } else {
            await speakAndConfirm('No file name found in your command. Please select a file in the popup, then say Yes.', async () => {
                // Step 4: Apply filter condition
                const filterCond = extractFilterCondition(commandText);
                if (filterCond) {
                    await waitForSelector('#filter-condition-input');
                    document.getElementById('filter-condition-input').value = filterCond;
                    await speakAndConfirm(`File uploaded. Should I apply the filter: ${filterCond}?`, async () => {
                        // Step 5: Store/Analyze radio buttons (default to Yes)
                        await waitForSelector('input[name="store-data"]');
                        document.querySelector('input[name="store-data"][value="yes"]').checked = true;
                        document.querySelector('input[name="analyze-data"][value="yes"]').checked = true;
                        await speakAndConfirm('Settings configured. Should I run the workflow now?', async () => {
                            // Step 6: Run workflow
                            await waitForSelector('#submit-workflow-btn');
                            document.getElementById('submit-workflow-btn').click();
                            await speakAndConfirm('Workflow completed. Would you like me to go to the Data Analysis page?', async () => {
                                // Step 7: Go to Data Analysis tab
                                await waitForSelector('.nav-item[href="#data-analysis"]');
                                document.querySelector('.nav-item[href="#data-analysis"]').click();
                                speakAndConfirm('Navigated to Data Analysis page. Workflow is complete!');
                            });
                        });
                    });
                } else {
                    await speakAndConfirm('No filter condition found. Should I proceed without a filter?', async () => {
                        // Step 5: Store/Analyze radio buttons (default to Yes)
                        await waitForSelector('input[name="store-data"]');
                        document.querySelector('input[name="store-data"][value="yes"]').checked = true;
                        document.querySelector('input[name="analyze-data"][value="yes"]').checked = true;
                        await speakAndConfirm('Settings configured. Should I run the workflow now?', async () => {
                            // Step 6: Run workflow
                            await waitForSelector('#submit-workflow-btn');
                            document.getElementById('submit-workflow-btn').click();
                            await speakAndConfirm('Workflow completed. Would you like me to go to the Data Analysis page?', async () => {
                                // Step 7: Go to Data Analysis tab
                                await waitForSelector('.nav-item[href="#data-analysis"]');
                                document.querySelector('.nav-item[href="#data-analysis"]').click();
                                speakAndConfirm('Navigated to Data Analysis page. Workflow is complete!');
                            });
                        });
                    });
                }
            });
        }
    });
};
// === END SMART VOICE-GUIDED WORKFLOW FUNCTION ===

// Add this after the setWorkflowFilter method or in the workflow modal setup
const filterInput = document.getElementById('filter-condition-input');
const sqlPreview = document.getElementById('sql-preview');
if (filterInput && sqlPreview) {
    filterInput.addEventListener('input', function() {
        const filter = filterInput.value.trim();
        if (filter) {
            sqlPreview.textContent = `SELECT * FROM walmart_sales WHERE ${filter};`;
        } else {
            sqlPreview.textContent = '';
        }
    });
}