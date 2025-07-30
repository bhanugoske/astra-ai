/**
 * ASTRA AI DASHBOARD - WORKSPACE MANAGER
 * Advanced workspace management for Astra AI voice assistant and data workflows
 */

const AstraWorkspace = {
    // === STATE MANAGEMENT ===
    state: {
        isInitialized: false,
        isRecording: false,
        isConnected: false,
        currentSession: null,
        animationId: null,
        chatHistory: [],
        workflowBlocks: [],
        // Chat session management
        chatSessions: [],
        currentChatSessionId: null,
        settings: {
            autoSave: true,
            voiceEnabled: true,
            theme: 'dark',
            notifications: true
        }
    },

    // === CONFIGURATION ===
    config: {
        maxChatHistory: 100,
        maxWorkflowBlocks: 50,
        saveInterval: 30000, // 30 seconds
        reconnectAttempts: 3,
        reconnectDelay: 2000,
        animationDuration: 1000,
        voiceTimeout: 10000
    },

    // === INITIALIZATION ===
    init() {
        if (this.state.isInitialized) {
            console.warn('AstraWorkspace already initialized');
            return;
        }

        try {
            console.log('🚀 Initializing Astra Workspace...');
            
            this.setupEventListeners();
            this.loadSettings();
            this.loadSession();
            this.startAutoSave();
            this.initializeVisualizer();
            this.initializeChatInterface();
            this.initializeChatSessions();
            this.initializeWorkflowPanel();
            
            this.state.isInitialized = true;
            console.log('✅ Astra Workspace initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing Astra Workspace:', error);
            this.showError('Failed to initialize Astra Workspace');
        }
    },

    // === EVENT LISTENERS ===
    setupEventListeners() {
        // Chat form submission
        const chatForm = document.getElementById('astra-chat-form');
        if (chatForm) {
            chatForm.addEventListener('submit', this.handleChatSubmit.bind(this));
        }

        // Voice input buttons
        const micButtons = document.querySelectorAll('#astra-mic-btn, #astra-mic-btn-chat');
        micButtons.forEach(btn => {
            btn.addEventListener('click', this.handleVoiceInput.bind(this));
        });

        // File upload buttons
        const uploadButtons = document.querySelectorAll('#astra-upload-btn, #astra-upload-btn-chat');
        uploadButtons.forEach(btn => {
            btn.addEventListener('click', this.handleFileUpload.bind(this));
        });

        // Workspace controls
        const newChatBtn = document.getElementById('astra-new-chat-btn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', this.startNewChat.bind(this));
        }

        const exportBtn = document.getElementById('astra-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', this.exportSession.bind(this));
        }

        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    },

    // === VISUALIZER MANAGEMENT ===
    initializeVisualizer() {
        // Skip visualizer initialization in new workspace
        // The 3D canvas is now handled by Astra3D.js
        console.log('🎨 Visualizer handled by Astra3D system');
    },

    startVisualizer() {
        // No longer needed - handled by Astra3D
        console.log('📊 Visualizer managed by 3D system');
    },

    stopVisualizer() {
        if (this.state.animationId) {
            cancelAnimationFrame(this.state.animationId);
            this.state.animationId = null;
        }
    },

    // === VISUALIZER UTILITIES ===
    generateParticles(count) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random(),
                y: Math.random(),
                vx: (Math.random() - 0.5) * 0.002,
                vy: (Math.random() - 0.5) * 0.002,
                size: Math.random() * 3 + 1,
                opacity: Math.random() * 0.5 + 0.3,
                color: `hsl(${200 + Math.random() * 80}, 70%, 60%)`
            });
        }
        return particles;
    },

    drawWaves(ctx, width, height, time) {
        const waveCount = 3;
        const centerY = height / 2;

        for (let i = 0; i < waveCount; i++) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 - i * 0.1})`;
            ctx.lineWidth = 2;

            for (let x = 0; x < width; x++) {
                const y = centerY + Math.sin((x * 0.01) + time + (i * 0.5)) * (20 + i * 10) * Math.sin(time * 0.5);
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
    },

    updateParticles(particles, width, height, time) {
        particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;

            if (particle.x < 0 || particle.x > 1) particle.vx *= -1;
            if (particle.y < 0 || particle.y > 1) particle.vy *= -1;

            particle.opacity = 0.3 + Math.sin(time + particle.x * 10) * 0.2;
        });
    },

    drawParticles(ctx, particles) {
        particles.forEach(particle => {
            ctx.beginPath();
            ctx.arc(
                particle.x * ctx.canvas.width,
                particle.y * ctx.canvas.height,
                particle.size,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = particle.color.replace('60%)', `${particle.opacity})`);
            ctx.fill();
        });
    },

    drawCentralPulse(ctx, width, height, time) {
        const centerX = width / 2;
        const centerY = height / 2;
        const pulseRadius = 30 + Math.sin(time * 2) * 10;

        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, pulseRadius
        );
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(0.7, 'rgba(139, 92, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    },

    // === CHAT INTERFACE ===
    initializeChatInterface() {
        this.addWelcomeMessage();
        this.updateChatStatus('Ready');
    },

    addWelcomeMessage() {
        const welcomeMessage = {
            id: this.generateId(),
            type: 'system',
            content: 'Hello! I\'m Astra, your AI assistant. I can help you analyze data, generate insights, and automate workflows. How can I assist you today?',
            timestamp: new Date().toISOString(),
            isWelcome: true
        };
        
        this.addChatMessage(welcomeMessage);
    },

    handleChatSubmit(event) {
        event.preventDefault();
        
        const input = document.getElementById('astra-chat-input');
        if (!input) return;
        
        const message = input.value.trim();
        if (!message) return;
        
        // Add user message
        const userMessage = {
            id: this.generateId(),
            type: 'user',
            content: message,
            timestamp: new Date().toISOString()
        };
        
        this.addChatMessage(userMessage);
        input.value = '';
        
        // Process message
        this.processUserMessage(message);
    },

    addChatMessage(message) {
        this.state.chatHistory.push(message);
        
        // Limit chat history
        if (this.state.chatHistory.length > this.config.maxChatHistory) {
            this.state.chatHistory.shift();
        }
        
        this.renderChatMessage(message);
        this.scrollChatToBottom();
        
        if (this.state.settings.autoSave) {
            this.saveSession();
        }
    },

    renderChatMessage(message) {
        const messagesContainer = document.getElementById('astra-chat-messages');
        if (!messagesContainer) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${message.type}`;
        messageElement.innerHTML = this.formatChatMessage(message);
        
        messagesContainer.appendChild(messageElement);
        
        // Add animation
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
            messageElement.style.transition = 'all 0.3s ease-out';
        }, 50);
    },

    formatChatMessage(message) {
        const time = new Date(message.timestamp).toLocaleTimeString();
        const isUser = message.type === 'user';
        
        // Handle code responses
        if (message.isCode) {
            return `
                <div class="flex justify-start mb-4">
                    <div class="max-w-full lg:max-w-2xl">
                        <div class="bg-slate-800 text-white rounded-lg border border-slate-600 overflow-hidden">
                            <div class="flex items-center justify-between px-4 py-2 bg-slate-700 border-b border-slate-600">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-medium text-slate-300">Code Assistant Active</span>
                                    <span class="text-xs px-2 py-1 rounded bg-blue-600 text-white">${message.codeLanguage || 'text'}</span>
                                </div>
                                <button class="copy-code-btn text-xs text-slate-400 hover:text-white transition-colors" 
                                        onclick="AstraWorkspace.copyCodeToClipboard(this)">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    Copy
                                </button>
                            </div>
                            <div class="p-4">
                                <pre class="text-sm overflow-x-auto whitespace-pre-wrap"><code class="language-${message.codeLanguage || 'text'}">${this.escapeHtml(message.content)}</code></pre>
                            </div>
                        </div>
                        <div class="text-xs text-slate-400 mt-1">${time}</div>
                    </div>
                </div>
            `;
        }
        
        // Handle error messages
        if (message.isError) {
            return `
                <div class="flex justify-start mb-4">
                    <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-red-600/20 text-red-100 border border-red-500/30">
                        <div class="text-sm">${this.escapeHtml(message.content)}</div>
                        <div class="text-xs opacity-70 mt-1">${time}</div>
                    </div>
                </div>
            `;
        }
        
        // Regular chat messages
        return `
            <div class="flex ${isUser ? 'justify-end' : 'justify-start'} mb-4">
                <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isUser 
                        ? 'bg-blue-600 text-white' 
                        : message.type === 'system' 
                            ? 'bg-purple-600/20 text-purple-100 border border-purple-500/30' 
                            : 'bg-slate-700 text-white'
                }">
                    <div class="text-sm">${this.escapeHtml(message.content)}</div>
                    <div class="text-xs opacity-70 mt-1">${time}</div>
                </div>
            </div>
        `;
    },

    processUserMessage(message) {
        this.updateChatStatus('Processing...');
        
        // Check if this is a code generation request
        if (this.isCodeGenerationRequest(message)) {
            this.handleCodeGenerationRequest(message);
        } else {
            // Regular chat processing
        setTimeout(() => {
            const response = this.generateResponse(message);
            
            const assistantMessage = {
                id: this.generateId(),
                type: 'assistant',
                content: response,
                timestamp: new Date().toISOString(),
                originalQuery: message
            };
            
            this.addChatMessage(assistantMessage);
            this.updateChatStatus('Ready');
            
        }, Math.random() * 1000 + 500);
        }
    },

    isCodeGenerationRequest(message) {
        const lowerMessage = message.toLowerCase();
        const codeKeywords = [
            'sql', 'python', 'code', 'query', 'function', 'script', 'program',
            'select', 'insert', 'update', 'delete', 'create', 'drop', 'table',
            'join', 'where', 'group by', 'order by', 'having', 'union',
            'def ', 'class ', 'import ', 'from ', 'return', 'print',
            'loop', 'for ', 'while ', 'if ', 'else', 'elif',
            'plot', 'chart', 'graph', 'visualize', 'analyze data',
            'generate code', 'write code', 'create function', 'build query'
        ];
        
        const isCodeRequest = codeKeywords.some(keyword => lowerMessage.includes(keyword));
        
        // Show/hide code assistant indicator
        const indicator = document.getElementById('code-assistant-indicator');
        if (indicator) {
            if (isCodeRequest) {
                indicator.classList.remove('hidden');
            } else {
                indicator.classList.add('hidden');
            }
        }
        
        return isCodeRequest;
    },

    async handleCodeGenerationRequest(message) {
        try {
            this.updateChatStatus('Generating code...');
            
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: message })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            const assistantMessage = {
                id: this.generateId(),
                type: 'assistant',
                content: data.code,
                timestamp: new Date().toISOString(),
                originalQuery: message,
                isCode: true,
                codeLanguage: this.detectCodeLanguage(data.code)
            };
            
            this.addChatMessage(assistantMessage);
            this.updateChatStatus('Ready');
            
        } catch (error) {
            console.error('Code generation error:', error);
            
            const errorMessage = {
                id: this.generateId(),
                type: 'assistant',
                content: `Sorry, I encountered an error while generating code: ${error.message}. Please try again or rephrase your request.`,
                timestamp: new Date().toISOString(),
                originalQuery: message,
                isError: true
            };
            
            this.addChatMessage(errorMessage);
            this.updateChatStatus('Ready');
        }
    },

    detectCodeLanguage(code) {
        const lowerCode = code.toLowerCase();
        
        if (lowerCode.includes('select') || lowerCode.includes('from') || lowerCode.includes('where') || 
            lowerCode.includes('insert into') || lowerCode.includes('update') || lowerCode.includes('delete from')) {
            return 'sql';
        }
        
        if (lowerCode.includes('def ') || lowerCode.includes('import ') || lowerCode.includes('class ') ||
            lowerCode.includes('print(') || lowerCode.includes('return ') || lowerCode.includes('if __name__')) {
            return 'python';
        }
        
        if (lowerCode.includes('function') || lowerCode.includes('const ') || lowerCode.includes('let ') ||
            lowerCode.includes('var ') || lowerCode.includes('console.log')) {
            return 'javascript';
        }
        
        return 'text';
    },

    copyCodeToClipboard(button) {
        const codeBlock = button.closest('.bg-slate-800').querySelector('code');
        const codeText = codeBlock.textContent;
        
        navigator.clipboard.writeText(codeText).then(() => {
            // Update button text temporarily
            const originalText = button.innerHTML;
            button.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
                Copied!
            `;
            button.classList.add('text-green-400');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('text-green-400');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy code:', err);
            this.showNotification('Failed to copy code to clipboard', 'error');
        });
    },

    generateResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        // Simple response generation based on keywords
        if (lowerMessage.includes('chart') || lowerMessage.includes('graph') || lowerMessage.includes('visualize')) {
            return "I can help you create charts and visualizations. Would you like me to generate a chart from your data? Please specify the type of chart you need (line, bar, pie, etc.).";
        }
        
        if (lowerMessage.includes('analyze') || lowerMessage.includes('analysis')) {
            return "I'll analyze your data for patterns and insights. Please upload your dataset or specify which data source you'd like me to examine.";
        }
        
        if (lowerMessage.includes('predict') || lowerMessage.includes('forecast')) {
            return "I can generate predictions based on your historical data. What specific metrics would you like me to forecast?";
        }
        
        if (lowerMessage.includes('export') || lowerMessage.includes('download')) {
            return "I can export your analysis results in various formats (PDF, CSV, Excel). What format would you prefer?";
        }
        
        if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
            return "I can help you with data analysis, creating visualizations, generating predictions, and automating workflows. You can upload files, ask questions about your data, or request specific analyses.";
        }
        
        // Default response
        return "I understand you're asking about: \"" + message + "\". I'm here to help with data analysis and insights. Could you provide more details about what you'd like to accomplish?";
    },

    updateChatStatus(status) {
        // Update any chat status indicators
        const statusElements = document.querySelectorAll('.astra-chat-status');
        statusElements.forEach(element => {
            element.textContent = status;
        });
    },

    scrollChatToBottom() {
        const messagesContainer = document.getElementById('astra-chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    },

    startNewChat() {
        this.createNewChatSession();
    },

    // === CHAT SESSION MANAGEMENT ===
    createNewChatSession(name = null) {
        const sessionId = this.generateId();
        const sessionName = name || `Chat ${this.state.chatSessions.length + 1}`;
        
        const newSession = {
            id: sessionId,
            name: sessionName,
            chatHistory: [],
            timestamp: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };
        
        this.state.chatSessions.push(newSession);
        this.switchToChatSession(sessionId);
        
        // Add welcome message for new sessions
        if (sessionName === 'General Chat') {
            this.addWelcomeMessage();
        }
        
        this.renderChatSessions();
        this.showNotification(`New chat "${sessionName}" created`, 'success');
        
        console.log('Created new chat session:', sessionName, 'with ID:', sessionId);
        
        return sessionId;
    },

    switchToChatSession(sessionId) {
        const session = this.state.chatSessions.find(s => s.id === sessionId);
        if (!session) {
            console.error('Chat session not found:', sessionId);
            return;
        }
        
        // Save current session's chat history
        if (this.state.currentChatSessionId) {
            this.saveCurrentChatHistory();
        }
        
        // Switch to new session
        this.state.currentChatSessionId = sessionId;
        this.state.chatHistory = [...session.chatHistory];
        session.lastActive = new Date().toISOString();
        
        // Update UI
        this.renderChatMessages();
        this.renderChatSessions();
        this.saveSession();
    },

    saveCurrentChatHistory() {
        if (!this.state.currentChatSessionId) return;
        
        const session = this.state.chatSessions.find(s => s.id === this.state.currentChatSessionId);
        if (session) {
            session.chatHistory = [...this.state.chatHistory];
            session.lastActive = new Date().toISOString();
        }
    },

    renderChatMessages() {
        const messagesContainer = document.getElementById('astra-chat-messages');
        if (!messagesContainer) return;
        
            messagesContainer.innerHTML = '';
        
        if (this.state.chatHistory.length === 0) {
        this.addWelcomeMessage();
        } else {
            this.state.chatHistory.forEach(message => {
                this.renderChatMessage(message);
            });
        }
        
        this.scrollChatToBottom();
    },

    renderChatSessions() {
        const container = document.querySelector('.chat-sessions-list');
        if (!container) {
            console.warn('Chat sessions list container not found');
            return;
        }
        
        container.innerHTML = '';
        
        this.state.chatSessions.forEach(session => {
            const sessionElement = document.createElement('div');
            sessionElement.className = `chat-session-item ${session.id === this.state.currentChatSessionId ? 'active' : ''}`;
            sessionElement.innerHTML = this.formatChatSession(session);
            container.appendChild(sessionElement);
        });
        
        console.log('Rendered', this.state.chatSessions.length, 'chat sessions');
    },

    formatChatSession(session) {
        const isActive = session.id === this.state.currentChatSessionId;
        const lastMessage = session.chatHistory.length > 0 
            ? session.chatHistory[session.chatHistory.length - 1]
            : null;
        
        const messagePreview = lastMessage 
            ? lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '')
            : 'No messages yet';
        
        return `
            <div class="chat-session-content" data-session-id="${session.id}">
                <div class="chat-session-header">
                    <div class="chat-session-title">
                        <h4 class="chat-session-name">${this.escapeHtml(session.name)} <span class="chat-session-time">just now</span></h4>
                        <p class="chat-session-preview">${this.escapeHtml(messagePreview)}</p>
                    </div>
                    <div class="chat-session-options">
                        <button class="chat-options-btn" data-session-id="${session.id}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="12" cy="5" r="1"></circle>
                                <circle cx="12" cy="19" r="1"></circle>
                            </svg>
                        </button>
                        <div class="chat-options-menu hidden" data-session-id="${session.id}">
                            <button class="chat-option-item" data-action="share" data-session-id="${session.id}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                                    <polyline points="16,6 12,2 8,6"></polyline>
                                    <line x1="12" y1="2" x2="12" y2="15"></line>
                                </svg>
                                Share
                            </button>
                            <button class="chat-option-item" data-action="pin" data-session-id="${session.id}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M16 3l4 4-4 4-4-4 4-4z"></path>
                                    <path d="M12 7L4 15l5 5 8-8"></path>
                                </svg>
                                Pin
                            </button>
                            <button class="chat-option-item" data-action="rename" data-session-id="${session.id}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                </svg>
                                Rename
                            </button>
                            <button class="chat-option-item delete" data-action="delete" data-session-id="${session.id}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renameChatSession(sessionId, newName) {
        const session = this.state.chatSessions.find(s => s.id === sessionId);
        if (!session) return;
        
        session.name = newName;
        this.renderChatSessions();
        this.saveSession();
        this.showNotification(`Chat renamed to "${newName}"`, 'success');
    },

    deleteChatSession(sessionId) {
        const sessionIndex = this.state.chatSessions.findIndex(s => s.id === sessionId);
        if (sessionIndex === -1) return;
        
        const session = this.state.chatSessions[sessionIndex];
        this.state.chatSessions.splice(sessionIndex, 1);
        
        // If we're deleting the current session, switch to another or create new
        if (this.state.currentChatSessionId === sessionId) {
            if (this.state.chatSessions.length > 0) {
                this.switchToChatSession(this.state.chatSessions[0].id);
            } else {
                this.createNewChatSession();
            }
        }
        
        this.renderChatSessions();
        this.saveSession();
        this.showNotification(`Chat "${session.name}" deleted`, 'success');
    },

    shareChatSession(sessionId) {
        const session = this.state.chatSessions.find(s => s.id === sessionId);
        if (!session) return;
        
        const shareData = {
            name: session.name,
            chatHistory: session.chatHistory,
            timestamp: session.timestamp
        };
        
        const shareText = `Chat Session: ${session.name}\n\n${session.chatHistory.map(msg => 
            `${msg.type === 'user' ? 'You' : 'Astra'}: ${msg.content}`
        ).join('\n\n')}`;
        
        if (navigator.share) {
            navigator.share({
                title: `Astra Chat: ${session.name}`,
                text: shareText
            }).catch(err => console.log('Error sharing:', err));
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(shareText).then(() => {
                this.showNotification('Chat copied to clipboard', 'success');
            }).catch(err => {
                console.error('Error copying to clipboard:', err);
                this.showNotification('Failed to copy chat', 'error');
            });
        }
    },

    pinChatSession(sessionId) {
        const session = this.state.chatSessions.find(s => s.id === sessionId);
        if (!session) return;
        
        session.pinned = !session.pinned;
        this.renderChatSessions();
        this.saveSession();
        
        const status = session.pinned ? 'pinned' : 'unpinned';
        this.showNotification(`Chat "${session.name}" ${status}`, 'success');
    },

    initializeChatSessions() {
        console.log('Initializing chat sessions...');
        
        // Load existing sessions or create first session
        if (this.state.chatSessions.length === 0) {
            console.log('Creating initial General Chat session');
            this.createNewChatSession('General Chat');
        } else {
            console.log('Found existing sessions:', this.state.chatSessions.length);
            // Set first session as active if none is active
            if (!this.state.currentChatSessionId && this.state.chatSessions.length > 0) {
                this.switchToChatSession(this.state.chatSessions[0].id);
            }
        }
        
        this.renderChatSessions();
        this.setupChatSessionEventListeners();
        
        console.log('Chat sessions initialized successfully');
    },

    setupChatSessionEventListeners() {
        // Event delegation for chat session interactions
        document.addEventListener('click', (e) => {
            if (e.target.closest('.chat-session-content')) {
                const sessionId = e.target.closest('.chat-session-content').dataset.sessionId;
                if (sessionId && sessionId !== this.state.currentChatSessionId) {
                    this.switchToChatSession(sessionId);
                }
            }
            
            if (e.target.closest('.chat-options-btn')) {
                e.stopPropagation();
                const sessionId = e.target.closest('.chat-options-btn').dataset.sessionId;
                this.toggleChatOptionsMenu(sessionId);
            }
            
            if (e.target.closest('.chat-option-item')) {
                e.stopPropagation();
                const action = e.target.closest('.chat-option-item').dataset.action;
                const sessionId = e.target.closest('.chat-option-item').dataset.sessionId;
                this.handleChatOptionAction(action, sessionId);
            }
            
            if (e.target.closest('.new-chat-btn')) {
                this.createNewChatSession();
            }
        });
    },

    toggleChatOptionsMenu(sessionId) {
        // Close all other menus first
        document.querySelectorAll('.chat-options-menu').forEach(menu => {
            if (menu.dataset.sessionId !== sessionId) {
                menu.classList.add('hidden');
            }
        });
        
        // Toggle the clicked menu
        const menu = document.querySelector(`.chat-options-menu[data-session-id="${sessionId}"]`);
        if (menu) {
            menu.classList.toggle('hidden');
        }
    },

    handleChatOptionAction(action, sessionId) {
        // Close menu
        const menu = document.querySelector(`.chat-options-menu[data-session-id="${sessionId}"]`);
        if (menu) menu.classList.add('hidden');
        
        switch (action) {
            case 'share':
                this.shareChatSession(sessionId);
                break;
            case 'pin':
                this.pinChatSession(sessionId);
                break;
            case 'rename':
                this.promptRenameChatSession(sessionId);
                break;
            case 'delete':
                this.promptDeleteChatSession(sessionId);
                break;
        }
    },

    promptRenameChatSession(sessionId) {
        const session = this.state.chatSessions.find(s => s.id === sessionId);
        if (!session) return;
        
        const newName = prompt('Enter new name for this chat:', session.name);
        if (newName && newName.trim() !== '' && newName !== session.name) {
            this.renameChatSession(sessionId, newName.trim());
        }
    },

    promptDeleteChatSession(sessionId) {
        const session = this.state.chatSessions.find(s => s.id === sessionId);
        if (!session) return;
        
        if (confirm(`Are you sure you want to delete the chat "${session.name}"?`)) {
            this.deleteChatSession(sessionId);
        }
    },

    // === WORKFLOW MANAGEMENT ===
    initializeWorkflowPanel() {
        this.loadWorkflowBlocks();
    },

    addWorkflowBlock(type, title, content, options = {}) {
        const block = {
            id: this.generateId(),
            type,
            title,
            content,
            timestamp: new Date().toISOString(),
            status: options.status || 'pending',
            data: options.data || null,
            actions: options.actions || []
        };
        
        this.state.workflowBlocks.push(block);
        
        // Limit workflow blocks
        if (this.state.workflowBlocks.length > this.config.maxWorkflowBlocks) {
            this.state.workflowBlocks.shift();
        }
        
        this.renderWorkflowBlock(block);
        
        if (this.state.settings.autoSave) {
            this.saveSession();
        }
        
        return block.id;
    },

    renderWorkflowBlock(block) {
        const container = document.getElementById('astra-workflow-pipeline');
        if (!container) return;
        
        const blockElement = document.createElement('div');
        blockElement.className = 'workflow-block';
        blockElement.id = `workflow-${block.id}`;
        blockElement.innerHTML = this.formatWorkflowBlock(block);
        
        container.appendChild(blockElement);
        
        // Add animation
        blockElement.style.opacity = '0';
        blockElement.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            blockElement.style.opacity = '1';
            blockElement.style.transform = 'translateX(0)';
            blockElement.style.transition = 'all 0.3s ease-out';
        }, 50);
    },

    formatWorkflowBlock(block) {
        const icons = {
            upload: '📁',
            analysis: '📊',
            prediction: '🔮',
            export: '💾',
            chart: '📈',
            filter: '🔍',
            transform: '🔄'
        };
        
        const statusColors = {
            pending: 'text-yellow-400',
            processing: 'text-blue-400',
            completed: 'text-green-400',
            error: 'text-red-400'
        };
        
        return `
            <div class="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all" data-step="${block.type}">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">${icons[block.type] || '▶️'}</span>
                        <div>
                            <h4 class="font-semibold text-white">${this.escapeHtml(block.title)}</h4>
                            <p class="text-sm text-slate-400">${this.escapeHtml(block.content)}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-xs ${statusColors[block.status] || 'text-slate-400'}">${block.status}</span>
                        <div class="text-xs text-slate-500">${new Date(block.timestamp).toLocaleTimeString()}</div>
                    </div>
                </div>
                ${block.actions.length > 0 ? this.renderWorkflowActions(block.actions) : ''}
            </div>
        `;
    },

    renderWorkflowActions(actions) {
        const actionButtons = actions.map(action => 
            `<button class="workflow-action-btn bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs px-3 py-1 rounded-md transition-colors" data-action="${action.id}">${action.label}</button>`
        ).join('');
        
        return `
            <div class="mt-3 pt-3 border-t border-slate-700/50">
                <div class="flex gap-2 flex-wrap">
                    ${actionButtons}
                </div>
            </div>
        `;
    },

    loadWorkflowBlocks() {
        // Load from localStorage or initialize empty
        const saved = localStorage.getItem('astra-workflow-blocks');
        if (saved) {
            try {
                this.state.workflowBlocks = JSON.parse(saved);
                this.renderAllWorkflowBlocks();
            } catch (error) {
                console.error('Error loading workflow blocks:', error);
            }
        }
    },

    renderAllWorkflowBlocks() {
        const container = document.getElementById('astra-workflow-pipeline');
        if (!container) return;
        
        container.innerHTML = '';
        this.state.workflowBlocks.forEach(block => {
            this.renderWorkflowBlock(block);
        });
    },

    // === VOICE INPUT ===
    handleVoiceInput() {
        if (!this.state.settings.voiceEnabled) {
            this.showNotification('Voice input is disabled', 'warning');
            return;
        }
        
        if (this.state.isRecording) {
            this.stopVoiceRecording();
        } else {
            this.startVoiceRecording();
        }
    },

    startVoiceRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showNotification('Voice input not supported in this browser', 'error');
            return;
        }
        
        this.state.isRecording = true;
        this.updateVoiceUI(true);
        
        // Simulate voice recording (replace with actual implementation)
        setTimeout(() => {
            this.stopVoiceRecording();
            this.showNotification('Voice input feature coming soon', 'info');
        }, 2000);
    },

    stopVoiceRecording() {
        this.state.isRecording = false;
        this.updateVoiceUI(false);
    },

    updateVoiceUI(isRecording) {
        const micButtons = document.querySelectorAll('#astra-mic-btn, #astra-mic-btn-chat');
        micButtons.forEach(btn => {
            if (isRecording) {
                btn.classList.add('animate-pulse');
                btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            } else {
                btn.classList.remove('animate-pulse');
                btn.style.background = '';
            }
        });
    },

    // === FILE UPLOAD ===
    handleFileUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.json,.txt';
        input.multiple = true;
        
        input.addEventListener('change', (event) => {
            const files = Array.from(event.target.files);
            if (files.length > 0) {
                this.processUploadedFiles(files);
            }
        });
        
        input.click();
    },

    processUploadedFiles(files) {
        files.forEach(file => {
            const blockId = this.addWorkflowBlock(
                'upload',
                'File Uploaded',
                `${file.name} (${this.formatFileSize(file.size)})`,
                {
                    status: 'completed',
                    data: { fileName: file.name, fileSize: file.size, fileType: file.type },
                    actions: [
                        { id: 'analyze', label: 'Analyze' },
                        { id: 'visualize', label: 'Visualize' }
                    ]
                }
            );
            
            this.showNotification(`File uploaded: ${file.name}`, 'success');
        });
    },

    // === SESSION MANAGEMENT ===
    saveSession() {
        // Save current chat history to current session
        this.saveCurrentChatHistory();
        
        const sessionData = {
            chatSessions: this.state.chatSessions,
            currentChatSessionId: this.state.currentChatSessionId,
            workflowBlocks: this.state.workflowBlocks,
            settings: this.state.settings,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('astra-session', JSON.stringify(sessionData));
        localStorage.setItem('astra-workflow-blocks', JSON.stringify(this.state.workflowBlocks));
    },

    loadSession() {
        const saved = localStorage.getItem('astra-session');
        if (saved) {
            try {
                const sessionData = JSON.parse(saved);
                this.state.chatSessions = sessionData.chatSessions || [];
                this.state.currentChatSessionId = sessionData.currentChatSessionId || null;
                this.state.workflowBlocks = sessionData.workflowBlocks || [];
                this.state.settings = { ...this.state.settings, ...sessionData.settings };
                
                // Set current chat history if there's an active session
                if (this.state.currentChatSessionId) {
                    const currentSession = this.state.chatSessions.find(s => s.id === this.state.currentChatSessionId);
                    if (currentSession) {
                        this.state.chatHistory = [...currentSession.chatHistory];
                    }
                }
                
                return true;
            } catch (error) {
                console.error('Error loading session:', error);
            }
        }
        return false;
    },

    exportSession() {
        this.saveCurrentChatHistory();
        
        const sessionData = {
            chatSessions: this.state.chatSessions,
            currentChatSessionId: this.state.currentChatSessionId,
            workflowBlocks: this.state.workflowBlocks,
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `astra-session-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Session exported successfully', 'success');
    },

    // === SETTINGS ===
    loadSettings() {
        const saved = localStorage.getItem('astra-settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.state.settings = { ...this.state.settings, ...settings };
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
    },

    saveSettings() {
        localStorage.setItem('astra-settings', JSON.stringify(this.state.settings));
    },

    // === AUTO-SAVE ===
    startAutoSave() {
        if (this.state.settings.autoSave) {
            setInterval(() => {
                this.saveSession();
            }, this.config.saveInterval);
        }
    },

    // === UTILITY FUNCTIONS ===
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    showNotification(message, type = 'info') {
        // Use the main app's notification system if available
        if (window.App && window.App.showNotification) {
            window.App.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    },

    showError(message) {
        this.showNotification(message, 'error');
    },

    // === EVENT HANDLERS ===
    handleBeforeUnload() {
        this.saveSession();
        this.saveSettings();
    },

    handleResize() {
        // Handle any resize-specific logic
        if (this.state.animationId) {
            // The visualizer handles its own resize
        }
    },

    // === CLEANUP ===
    destroy() {
        this.stopVisualizer();
        this.saveSession();
        this.saveSettings();
        
        // Remove event listeners
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('resize', this.handleResize);
        
        this.state.isInitialized = false;
        console.log('Astra Workspace destroyed');
    }
};

// === WORKFLOW STEP ACTIVATION STATE ===
AstraWorkspace.state.workflowStepActive = {
    upload: false,
    filter: false,
    database: false
};

// === WORKFLOW KEYWORDS ===
AstraWorkspace.workflowKeywords = {
    upload: ['upload file', 'upload data', 'select data'],
    filter: ['filter data', 'apply filter', 'apply conditions'],
    database: ['save to database', 'store data']
};

AstraWorkspace.checkWorkflowActivation = function(message) {
    for (const [step, keywords] of Object.entries(this.workflowKeywords)) {
        if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
            this.activateWorkflowStep(step);
        }
    }
};

AstraWorkspace.activateWorkflowStep = function(step) {
    if (!this.state.workflowStepActive[step]) {
        this.state.workflowStepActive[step] = true;
        this.updateWorkflowStepUI(step);
    }
};

AstraWorkspace.deactivateWorkflowStep = function(step) {
    if (this.state.workflowStepActive[step]) {
        this.state.workflowStepActive[step] = false;
        this.updateWorkflowStepUI(step);
    }
};

AstraWorkspace.updateWorkflowStepUI = function(step) {
    const block = document.querySelector(`.workflow-block[data-step='${step}']`);
    if (block) {
        if (this.state.workflowStepActive[step]) {
            block.classList.add('active');
            block.classList.remove('inactive');
        } else {
            block.classList.remove('active');
            block.classList.add('inactive');
        }
    }
};

AstraWorkspace.isCodeRequest = function(message) {
    // Simple heuristic: contains 'code', 'sql', 'python', etc.
    return /\b(code|sql|python|query|script|generate|write)\b/i.test(message);
};

AstraWorkspace.handleChatSubmit = async function(event) {
    event.preventDefault();
    const input = document.getElementById('astra-chat-input');
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;

    // Add user message to chat
    const userMessage = {
        id: this.generateId(),
        type: 'user',
        content: message,
        timestamp: new Date().toISOString()
    };
    this.addChatMessage(userMessage);
    input.value = '';

    // If it's a code request, call DeepSeek API
    if (this.isCodeRequest(message)) {
        this.addChatMessage({
            id: this.generateId(),
            type: 'assistant',
            content: 'Let me generate that code for you...',
            timestamp: new Date().toISOString()
        });
        try {
            const res = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: message })
            });
            const data = await res.json();
            if (data.code) {
                this.addChatMessage({
                    id: this.generateId(),
                    type: 'assistant',
                    content: `<pre><code>${data.code}</code></pre>`,
                    timestamp: new Date().toISOString()
                });
            } else {
                this.addChatMessage({
                    id: this.generateId(),
                    type: 'assistant',
                    content: 'Sorry, I could not generate code for that.',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            this.addChatMessage({
                id: this.generateId(),
                type: 'assistant',
                content: 'Error contacting code generation API.',
                timestamp: new Date().toISOString()
            });
        }
        return;
    }

    // Otherwise, use your existing logic for non-code requests
    this.processUserMessage(message);
};

// On page load, set all workflow blocks to inactive
window.addEventListener('DOMContentLoaded', function() {
    ['upload', 'filter', 'database'].forEach(step => {
        AstraWorkspace.deactivateWorkflowStep(step);
    });
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AstraWorkspace.init();
});

// Make globally available
window.AstraWorkspace = AstraWorkspace;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AstraWorkspace;
}

