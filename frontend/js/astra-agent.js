/**
 * ASTRA INTELLIGENT VOICE AGENT SYSTEM - PROFESSIONAL ASSISTANT
 * Advanced AI-powered voice assistant with complete website control
 * Responds only with "Yes, sir." and executes commands immediately
 * Created by Bhanu - Enhanced for full autonomous control
 */

// Add DeepSeek API integration at the top-level of the file
async function queryDeepSeek(prompt) {
    try {
        const response = await fetch('/api/deepseek', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: `Answer concisely in 1-2 sentences. ${prompt}`
            })
        });
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            return data.choices[0].message.content;
        } else {
            return "I'm sorry, I couldn't retrieve the information right now.";
        }
    } catch (error) {
        return "I'm sorry, there was an error connecting to my knowledge service.";
    }
}

class AstraVoiceAgent {
    constructor() {
        this.isActive = false;
        this.isListening = false;
        this.isSpeaking = false;
        this.isProcessing = false;
        this.isProcessingAIResponse = false;
        this.restartAttempted = false;
        this.forceRestarting = false;
        this.lastSpeechTime = null;
        this.lastErrorTime = null;
        
        // Voice recognition system
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.selectedVoice = null;
        
        // Agent state and context
        this.context = {
            currentView: 'dashboard',
            lastCommand: null,
            activeTask: null,
            conversationHistory: [],
            userPreferences: {},
            workflowState: 'idle',
            uploadedFiles: [],
            appliedFilters: [],
            currentData: null
        };
        
        // Command processing engine
        this.commandProcessor = new CommandProcessor(this); // Pass agent reference
        this.taskExecutor = new TaskExecutor(this); // Pass agent reference
        this.contextManager = new ContextManager();
        
        // UI elements
        this.ui = {
            statusWidget: null,
            voiceIndicator: null,
            commandFeedback: null
        };
        
        // Configuration for professional assistant
        this.config = {
            voiceTimeout: 10000,
            maxRetries: 3,
            confidenceThreshold: 0.2, // Lower for better responsiveness
            autoActivate: true,
            visualFeedback: true,
            contextMemory: 50,
            debugMode: true,
            professionalMode: true, // Only "Yes, sir." responses
            immediateExecution: true // Execute commands immediately
        };
        
        this.init();
    }
    
    async init() {
        console.log('🤖 Initializing Astra Professional Voice Agent...');
        
        try {
            await this.initializeVoiceSystem();
            this.setupUI();
            this.loadUserPreferences();
            this.bindGlobalEvents();
            
            console.log('✅ Astra Professional Voice Agent initialized successfully');
            
            // REMOVE auto-activation
            // if (this.config.autoActivate) {
            //     this.activate();
            // }
        } catch (error) {
            console.error('❌ Failed to initialize Astra Voice Agent:', error);
            this.showError('Voice agent initialization failed');
        }
    }
    
    async initializeVoiceSystem() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            throw new Error('Speech recognition not supported in this browser');
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 3;
        this.recognition.lang = 'en-US';
        if ('webkitSpeechRecognition' in window) {
            this.recognition.webkitSpeechRecognition = true;
        }
        // Centralized event handlers
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUI();
        };
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                const confidence = event.results[i][0].confidence || 0.8;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            if (interimTranscript && !this.isSpeaking) {
                this.showFeedback(`Listening: ${interimTranscript}`, 'interim');
            }
            if (finalTranscript) {
                const cleanTranscript = finalTranscript.trim();
                // Feedback loop prevention: ignore all recognition for 8s after speaking (increased from 5s)
                if (this.lastSpeechTime && Date.now() - this.lastSpeechTime < 8000) {
                    console.log(`[Astra DEBUG] Ignored transcript due to recent speech: '${cleanTranscript}'`);
                    return;
                }
                // Prevent processing during AI response generation
                if (this.isProcessingAIResponse) {
                    console.log(`[Astra DEBUG] Ignored transcript during AI response: '${cleanTranscript}'`);
                    return;
                }
                // Prevent processing during error cooldown (5 seconds after error)
                if (this.lastErrorTime && Date.now() - this.lastErrorTime < 5000) {
                    console.log(`[Astra DEBUG] Ignored transcript during error cooldown: '${cleanTranscript}'`);
                    return;
                }
                // Expanded agent phrase detection (professional, startup, confirmations, etc.)
                const agentPhrases = [
                    'okay', 'alright', 'sure', 'on it', 'processing', 'got it',
                    'okay, i am on it', 'alright, your request is being processed',
                    'please repeat the command', 'could you please specify the command',
                    'astra voice agent activated', 'astra voice agent deactivated',
                    'astra agent', 'astra, astra, astra', 'yes, sir.',
                    'would you like to hear a list of valid commands?',
                    'say "help" to get a list of commands.',
                    'i am ready to assist you',
                    'i\'m not sure what you mean. would you like to hear a list of valid commands?',
                    'navigating to data insights.',
                    'system activated', 'system deactivated',
                    'command unclear. please repeat.',
                    'command execution error.',
                    'sample commands shown.',
                    'help cancelled.',
                    'settings panel coming soon!',
                    'voice agent initialization failed',
                    'agent state reset',
                    'active - ready',
                    'active - listening',
                    'speaking...',
                    'deactivated',
                    'activation failed',
                    'activation...',
                    'status: speaking... (speaking)',
                    'status: active - ready (active)',
                    'status: active - listening (active)',
                    'status: deactivated (inactive)',
                    'status: activation failed (error)',
                    'status: activating... (processing)',
                    'would you like to go to data insights',
                    'would you like to go to data insights after this',
                    'va would you like to go to data insights after this',
                    'searching for',
                    'could you clarify', 'provide more details', 'please specify',
                    'certainly', 'please specify the topic', 'assistance with',
                    'concise answer', 'topic or question', 'address briefly',
                    'understood', 'let me find', 'most accurate information',
                    'consulting knowledge base', 'processing your request',
                    'working on that', 'taking care of', 'handling your request',
                    'processing your', 'executing', 'managing your',
                    'applying your', 'setting up', 'implementing',
                    'analyzing the data', 'searching for that',
                    'looking up', 'finding the information',
                    'processing your search', 'searching the database',
                    'executing that system', 'working on the system',
                    'handling the system', 'processing your system',
                    'sorry, there was an error', 'please try again',
                    'there was an error', 'error occurred',
                    'command execution error', 'processing error',
                    'workflow error', 'system error', 'operation failed',
                    'failed to execute', 'unable to process',
                    'error processing', 'error occurred while',
                    'sorry, there was', 'there was an error',
                    'please try again', 'try again',
                    'error occurred', 'an error occurred',
                    'there was an error', 'error processing command',
                    'command failed', 'operation failed',
                    'failed to execute command', 'unable to complete',
                    'error while processing', 'processing failed',
                    'command execution failed', 'workflow failed',
                    'system encountered an error', 'error in processing',
                    'failed to process', 'unable to execute',
                    'error occurred during', 'processing encountered error'
                ];
                const isAgentSpeech = agentPhrases.some(phrase => cleanTranscript.toLowerCase().includes(phrase));
                if (isAgentSpeech) {
                    console.log(`[Astra DEBUG] Ignored agent phrase: '${cleanTranscript}'`);
                    return;
                }
                if (cleanTranscript.length > 2) {
                    this.processCommand(cleanTranscript);
                }
            }
        };
        this.recognition.onerror = (event) => {
            this.isListening = false;
            switch (event.error) {
                case 'no-speech':
                    break;
                case 'audio-capture':
                    this.showFeedback('Microphone not accessible', 'error');
                    break;
                case 'not-allowed':
                    this.showFeedback('Microphone permission denied', 'error');
                    break;
                case 'network':
                    this.showFeedback('Network error', 'error');
                    break;
                case 'aborted':
                    return;
                default:
                    this.showFeedback(`Recognition error: ${event.error}`, 'error');
            }
            if (['no-speech', 'network'].includes(event.error) && this.isActive && !this.isSpeaking) {
                setTimeout(() => {
                    if (this.isActive && !this.isListening && !this.isSpeaking) {
                        this.startListening();
                    }
                }, 1000);
            }
        };
        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUI();
            if (this.isActive && !this.isSpeaking) {
                setTimeout(() => {
                    if (this.isActive && !this.isListening && !this.isSpeaking) {
                        this.startListening();
                    }
                }, 1000);
            }
        };
        await this.initializeSpeechSynthesis();
    }
    
    async initializeSpeechSynthesis() {
        return new Promise((resolve) => {
            const loadVoices = () => {
                const voices = this.synthesis.getVoices();
                if (voices.length === 0) {
                    setTimeout(loadVoices, 100);
                    return;
                }
                
                // Select best voice for Astra
                this.selectedVoice = this.selectOptimalVoice(voices);
                console.log('🎤 Selected voice:', this.selectedVoice?.name || 'Default');
                resolve();
            };
            
            if (this.synthesis.getVoices().length > 0) {
                loadVoices();
            } else {
                this.synthesis.addEventListener('voiceschanged', loadVoices);
            }
        });
    }
    
    selectOptimalVoice(voices) {
        // Prioritize natural, professional voices
        const preferredVoices = [
            'Microsoft Zira Desktop',
            'Google UK English Female',
            'Samantha',
            'Karen',
            'Victoria',
            'Microsoft David Desktop',
            'Google US English'
        ];
        
        for (const preferred of preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferred));
            if (voice) return voice;
        }
        
        // Fallback to first English voice
        return voices.find(v => v.lang.startsWith('en')) || voices[0];
    }
    
    setupUI() {
        this.createStatusWidget();
        this.createVoiceIndicator();
        this.createCommandFeedback();
        this.setupGlobalStyles();
        this.setupDraggable();
    }
    
    createStatusWidget() {
        this.ui.statusWidget = document.createElement('div');
        this.ui.statusWidget.id = 'astra-agent-status';
        this.ui.statusWidget.className = 'astra-agent-status';
        this.ui.statusWidget.innerHTML = `
            <div class="agent-status-content">
                <div class="agent-avatar">
                    <div class="avatar-glow"></div>
                    <svg class="avatar-icon" viewBox="0 0 24 24">
                        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V7H1V9H3V15H1V17H3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V17H23V15H21V9H23ZM19 21H5V3H14.17L19 7.83V21Z"/>
                    </svg>
                </div>
                <div class="agent-info">
                    <div class="agent-name">Astra Agent</div>
                    <div class="agent-status-text">Ready</div>
                </div>
                <div class="agent-controls">
                    <button class="agent-btn activate-btn" id="activate-agent">
                        <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </button>
                    <button class="agent-btn reset-btn" id="reset-agent" title="Reset Agent State">
                        <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                    </button>
                    <button class="agent-btn settings-btn" id="agent-settings">
                        <svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/></svg>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.ui.statusWidget);
    }
    
    createVoiceIndicator() {
        this.ui.voiceIndicator = document.createElement('div');
        this.ui.voiceIndicator.id = 'astra-voice-indicator';
        this.ui.voiceIndicator.className = 'astra-voice-indicator';
        this.ui.voiceIndicator.innerHTML = `
            <div class="voice-waves">
                <div class="wave"></div>
                <div class="wave"></div>
                <div class="wave"></div>
                <div class="wave"></div>
                <div class="wave"></div>
            </div>
            <div class="voice-status">Listening...</div>
        `;
        
        document.body.appendChild(this.ui.voiceIndicator);
    }
    
    createCommandFeedback() {
        this.ui.commandFeedback = document.createElement('div');
        this.ui.commandFeedback.id = 'astra-command-feedback';
        this.ui.commandFeedback.className = 'astra-command-feedback';
        
        document.body.appendChild(this.ui.commandFeedback);
    }
    
    setupGlobalStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            .astra-agent-status {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(15, 23, 42, 0.95);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 16px;
                padding: 16px;
                z-index: 10000;
                transition: all 0.3s ease;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                cursor: move;
                user-select: none;
            }
            
            .astra-agent-status.dragging {
                opacity: 0.8;
                /* transform: scale(1.02); */
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
            }
            
            .astra-voice-indicator.dragging {
                opacity: 0.8;
                /* transform: scale(1.02) translateY(0); */
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
            }
            
            .astra-agent-status.active {
                border-color: rgba(34, 197, 94, 0.5);
                box-shadow: 0 8px 32px rgba(34, 197, 94, 0.2);
            }
            
            .agent-status-content {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 280px;
            }
            
            .agent-avatar {
                position: relative;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .avatar-glow {
                position: absolute;
                inset: -4px;
                border-radius: 50%;
                background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                opacity: 0.3;
                animation: pulse 2s infinite;
            }
            
            .avatar-icon {
                width: 24px;
                height: 24px;
                fill: white;
                z-index: 1;
            }
            
            .agent-info {
                flex: 1;
            }
            
            .agent-name {
                font-size: 16px;
                font-weight: 600;
                color: white;
                margin-bottom: 4px;
            }
            
            .agent-status-text {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .agent-controls {
                display: flex;
                gap: 8px;
            }
            
            .agent-btn {
                width: 36px;
                height: 36px;
                border: none;
                border-radius: 8px;
                background: rgba(59, 130, 246, 0.2);
                color: #3b82f6;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .agent-btn:hover {
                background: rgba(59, 130, 246, 0.3);
                transform: translateY(-2px);
            }
            
            .agent-btn svg {
                width: 18px;
                height: 18px;
                fill: currentColor;
            }
            
            .activate-btn.active {
                background: rgba(34, 197, 94, 0.2);
                color: #22c55e;
            }
            
            .astra-voice-indicator {
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: rgba(15, 23, 42, 0.95);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 16px;
                padding: 20px;
                z-index: 10000;
                transform: translateY(100px);
                opacity: 0;
                transition: all 0.3s ease;
                text-align: center;
                cursor: move;
                user-select: none;
            }
            
            .astra-voice-indicator.active {
                transform: translateY(0);
                opacity: 1;
            }
            
            .voice-waves {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 4px;
                margin-bottom: 12px;
            }
            
            .wave {
                width: 4px;
                height: 20px;
                background: linear-gradient(to top, #3b82f6, #8b5cf6);
                border-radius: 2px;
                animation: wave 1.5s infinite ease-in-out;
            }
            
            .wave:nth-child(2) { animation-delay: 0.1s; }
            .wave:nth-child(3) { animation-delay: 0.2s; }
            .wave:nth-child(4) { animation-delay: 0.3s; }
            .wave:nth-child(5) { animation-delay: 0.4s; }
            
            .voice-status {
                color: white;
                font-size: 14px;
                font-weight: 500;
            }
            
            .astra-command-feedback {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: rgba(15, 23, 42, 0.95);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 12px;
                padding: 16px 24px;
                z-index: 10000;
                opacity: 0;
                transition: all 0.3s ease;
                max-width: 500px;
                text-align: center;
            }
            
            .astra-command-feedback.show {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            
            .astra-command-feedback.success {
                border-color: rgba(34, 197, 94, 0.5);
                background: rgba(34, 197, 94, 0.1);
            }
            
            .astra-command-feedback.error {
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.5);
                color: #fca5a5;
            }
            
            .astra-command-feedback.warning {
                background: rgba(245, 158, 11, 0.2);
                border-color: rgba(245, 158, 11, 0.5);
                color: #fbbf24;
            }
            
            .astra-command-feedback.interim {
                background: rgba(139, 92, 246, 0.2);
                border-color: rgba(139, 92, 246, 0.5);
                color: #c4b5fd;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 0.7; }
            }
            
            @keyframes wave {
                0%, 100% { height: 20px; }
                50% { height: 40px; }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    setupDraggable() {
        // Make the Astra Agent status widget draggable
        this.makeDraggable('astra-agent-status');
        
        // Make the voice indicator draggable
        this.makeDraggable('astra-voice-indicator');
    }
    
    makeDraggable(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        const onMouseDown = (e) => {
            // Don't start dragging if clicking on buttons
            if (e.target.closest('.agent-btn') || e.target.closest('button')) {
                return;
            }
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            // On first drag, set left/top based on current position and clear right/bottom
            const rect = element.getBoundingClientRect();
            element.style.left = rect.left + 'px';
            element.style.top = rect.top + 'px';
            element.style.right = '';
            element.style.bottom = '';
            // Lock width and height to prevent resizing
            element.style.width = rect.width + 'px';
            element.style.height = rect.height + 'px';
            startLeft = rect.left;
            startTop = rect.top;
            
            element.style.position = 'fixed';
            element.style.zIndex = '10001';
            element.style.transition = 'none';
            element.classList.add('dragging');
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            
            e.preventDefault();
        };
        
        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;
            
            // Keep element within viewport bounds
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            
            element.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
            element.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
        };
        
        const onMouseUp = () => {
            if (!isDragging) return;
            
            isDragging = false;
            element.style.zIndex = '10000';
            element.style.transition = 'all 0.3s ease';
            element.classList.remove('dragging');
            // Do NOT remove width/height, keep them fixed after drag
            
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        element.addEventListener('mousedown', onMouseDown);
    }
    
    bindGlobalEvents() {
        // Wait for DOM elements to be created
        setTimeout(() => {
            // Activation button
            const activateBtn = document.getElementById('activate-agent');
            if (activateBtn) {
                activateBtn.addEventListener('click', () => {
                    this.toggle();
                });
            }
            
            // Reset button
            const resetBtn = document.getElementById('reset-agent');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.resetState();
                    this.showFeedback('Agent state reset', 'success');
                });
            }
            
            // Settings button
            const settingsBtn = document.getElementById('agent-settings');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', () => {
                    this.showSettings();
                });
            }
        }, 100);
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.toggle();
            }
        });
        
        // Wake word detection (optional)
        if (this.config.wakeWordEnabled) {
            this.setupWakeWordDetection();
        }
    }
    
    toggle() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }
    
    async activate() {
        if (this.isActive) return;
        
        try {
            this.isActive = true;
            this.updateStatus('Activating...', 'processing');
            
            // Start voice recognition
            this.startListening();
            
            this.updateStatus('Active - Listening', 'active');
            this.ui.statusWidget?.classList.add('active');
            
            const activateBtn = document.getElementById('activate-agent');
            if (activateBtn) {
                activateBtn.classList.add('active');
                activateBtn.textContent = 'Deactivate';
            }
            
            // Welcome message
            this.speak('Astra voice agent activated. I am ready to assist you.');
            
            console.log('✅ Astra Voice Agent activated');
        } catch (error) {
            console.error('❌ Failed to activate voice agent:', error);
            this.updateStatus('Activation failed', 'error');
            this.isActive = false;
        }
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        this.stopListening();
        
        this.updateStatus('Deactivated', 'inactive');
        this.ui.statusWidget?.classList.remove('active');
        
        const activateBtn = document.getElementById('activate-agent');
        if (activateBtn) {
            activateBtn.classList.remove('active');
            activateBtn.textContent = 'Activate';
        }
        
        this.ui.voiceIndicator?.classList.remove('active');
        
        this.speak('Astra voice agent deactivated.');
        
        console.log('🔇 Astra Voice Agent deactivated');
    }
    
    startListening() {
        if (!this.recognition) {
            console.error('❌ Speech recognition not supported');
            return;
        }

        // Don't start if already listening or if speaking
        if (this.isListening || this.isSpeaking) {
            console.log('⚠️ Cannot start listening: already listening or speaking');
            return;
        }

        try {
            // Check if recognition is already running
            if (this.recognition.state === 'started') {
                console.log('🔇 Recognition already started, aborting first');
                this.recognition.abort();
                setTimeout(() => this.startListening(), 500);
                return;
            }
            
            this.isListening = true;
            this.updateUI();
            
            // Configure recognition for better accuracy
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 3;
            
            // Set language for better recognition
            this.recognition.lang = 'en-US';
            
            console.log('🎤 Starting speech recognition...');
            this.recognition.start();
            
            // Auto-restart after timeout
            this.restartTimeout = setTimeout(() => {
                if (this.isListening && !this.isSpeaking) {
                    console.log('🔄 Auto-restarting recognition...');
                    this.restartListening();
                }
            }, 30000); // 30 seconds timeout
            
        } catch (error) {
            console.error('❌ Error starting recognition:', error);
            this.isListening = false;
            this.updateUI();
            
            // Only try to restart once for state errors, with longer delay
            if (error.name === 'InvalidStateError' && !this.restartAttempted) {
                this.restartAttempted = true;
                setTimeout(() => {
                    this.restartAttempted = false;
                    if (this.isActive && !this.isListening && !this.isSpeaking) {
                        console.log('🔄 Attempting delayed restart after InvalidStateError');
                        this.forceRestartListening();
                    }
                }, 5000); // Longer delay to break the loop
            }
        }
    }

    stopListening() {
        if (!this.isListening) return;
        
        try {
            if (this.recognition) {
                this.recognition.stop();
            }
        } catch (error) {
            console.error('❌ Error stopping recognition:', error);
        }
        
        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }
        
        this.isListening = false;
        this.updateUI();
        console.log('🔇 Speech recognition stopped');
    }

    forceRestartListening() {
        console.log('🔄 Force restarting speech recognition...');
        
        // Prevent multiple force restarts
        if (this.forceRestarting) {
            console.log('🔇 Force restart already in progress, skipping');
            return;
        }
        
        this.forceRestarting = true;
        
        // Force stop everything
        this.isListening = false;
        if (this.recognition) {
            try {
                this.recognition.abort();
            } catch (e) {
                console.log('Recognition already stopped');
            }
        }
        
        // Clear any existing timeouts
        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }
        
        // Wait longer then restart
        setTimeout(() => {
            this.forceRestarting = false;
            if (this.isActive && !this.isSpeaking && !this.isListening) {
                this.startListening();
            }
        }, 2000); // Longer delay to ensure clean restart
    }

    restartListening() {
        console.log('🔄 Restarting speech recognition...');
        this.stopListening();
        
        setTimeout(() => {
            if (this.isActive && !this.isSpeaking) {
                this.startListening();
            }
        }, 1000);
    }

    onListeningStart() {
        if (this.config.debugMode) console.log('🎤 Voice recognition started');
        this.updateStatus('Listening...', 'listening');
    }
    
    onListeningEnd() {
        console.log('🔇 Voice recognition ended');
        
        if (this.isActive && !this.isSpeaking) {
            // Restart listening if agent is still active
            setTimeout(() => {
                if (this.isActive && !this.isSpeaking) {
                    this.startListening();
                }
            }, 1000);
        }
    }
    
    async onSpeechResult(event) {
        const results = event.results;
        const lastResult = results[results.length - 1];
        
        if (lastResult.isFinal) {
            const transcript = lastResult[0].transcript.trim();
            const confidence = lastResult[0].confidence || 1.0; // Default to 1.0 if undefined
            
            console.log('🎤 Speech recognized:', transcript, 'Confidence:', confidence);
            
            // Process command if confidence is acceptable or if transcript is not empty
            if (confidence >= this.config.confidenceThreshold || (transcript.length > 2 && confidence > 0.3)) {
                await this.processCommand(transcript);
            } else {
                this.showFeedback(`I heard "${transcript}" but wasn't confident. Please try again.`, 'error');
                this.speak('I didn\'t catch that clearly. Could you please repeat?');
            }
        }
    }
    
    onSpeechError(event) {
        console.error('🎤 Speech recognition error:', event.error);
        
        switch (event.error) {
            case 'network':
                this.showFeedback('Network error. Please check your connection.', 'error');
                break;
            case 'not-allowed':
                this.showFeedback('Microphone access denied. Please enable microphone permissions.', 'error');
                break;
            case 'no-speech':
                // Silently restart listening
                if (this.isActive) {
                    setTimeout(() => this.startListening(), 1000);
                }
                break;
            default:
                this.showFeedback('Voice recognition error. Please try again.', 'error');
        }
    }
    
    async processCommand(transcript) {
        // Only process if agent is active
        if (!this.isActive) return;
        // Prevent processing during error cooldown
        if (this.lastErrorTime && Date.now() - this.lastErrorTime < 5000) {
            console.log(`[Astra DEBUG] Ignored command during error cooldown: '${transcript}'`);
            return;
        }
        // If Astra is speaking, interrupt and process new command
        if (this.isSpeaking) {
            window.speechSynthesis.cancel();
            this.isSpeaking = false;
        }
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.updateStatus('Processing...', 'processing');
        try {
            if (!this.failedAttempts) this.failedAttempts = 0;
            const result = this.commandProcessor.processCommand(transcript, this.context);
            if (result.confidence > 0.4) {
                this.failedAttempts = 0;
                if (this.isActive) this.speak(result.response);
                if (result.type === 'workflow' && window.astraApp) {
                    try {
                        const handled = await window.astraApp.handleWorkflowCommands(transcript.toLowerCase(), transcript);
                        if (handled) {
                            this.showFeedback(`Workflow command executed: ${result.action}`, 'success');
                            return;
                        }
                    } catch (error) {}
                }
                if (this.isActive) await this.taskExecutor.executeTask(result);
                this.showFeedback(`Executed: ${result.type} - ${result.action}`, 'success');
                if (result.context) {
                    this.contextManager.updateContext(result.context, this.context);
                }
            } else {
                // If not a recognized command, ask DeepSeek for a professional answer
                this.updateStatus('Consulting knowledge base...', 'processing');
                this.showFeedback('Let me find the most accurate information for you...', 'info');
                const aiResponse = await queryDeepSeek(transcript);
                // Set a flag to prevent processing during AI response
                this.isProcessingAIResponse = true;
                if (this.isActive) this.speak(aiResponse);
                this.showFeedback(aiResponse, 'success');
                // Clear the flag after a delay to allow speech to complete
                setTimeout(() => {
                    this.isProcessingAIResponse = false;
                }, 8000); // 8 seconds to account for longer AI responses
            }
        } catch (error) {
            console.error('❌ Command execution error:', error);
            // Don't speak error messages to prevent feedback loop
            this.showFeedback('Command execution error. Please try again.', 'error');
            // Add error cooldown to prevent rapid retries
            this.lastErrorTime = Date.now();
        } finally {
            this.isProcessing = false;
            this.updateStatus('Active - Listening', 'active');
        }
    }
    
    speak(text) {
        // Only speak if agent is active
        if (!this.isActive) return;
        const synth = window.speechSynthesis;
        if (!synth) return;
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        // Always use cached selectedVoice if available
        if (this.selectedVoice) {
            utter.voice = this.selectedVoice;
        } else {
        const voices = synth.getVoices();
        utter.voice = voices.find(v => v.name.includes('UK') && v.name.includes('Male')) || voices[0];
        }
        utter.pitch = 1;
        utter.rate = 0.9;
        utter.volume = 1;
        utter.onstart = () => {
            this.isSpeaking = true;
            this.lastSpeechTime = Date.now();
            this.updateStatus('Speaking...', 'speaking');
        };
        utter.onend = () => {
            this.isSpeaking = false;
            if (this.isActive) {
                this.updateStatus('Active - Ready', 'active');
                // Longer delay for AI responses to prevent feedback loop
                const delay = this.isProcessingAIResponse ? 4000 : 2500;
                setTimeout(() => {
                    if (this.isActive && !this.isSpeaking && !this.isListening) {
                        this.updateStatus('Active - Listening', 'active');
                        this.startListening();
                    }
                }, delay);
            }
        };
        utter.onerror = (error) => {
            this.isSpeaking = false;
            if (this.isActive && error.error !== 'interrupted') {
                setTimeout(() => {
                    if (this.isActive && !this.isSpeaking) {
                        this.startListening();
                    }
                }, 2000);
            }
        };
        synth.speak(utter);
    }
    
    updateUI() {
        if (this.ui.voiceIndicator) {
            if (this.isListening) {
                this.ui.voiceIndicator.classList.add('active');
            } else {
                this.ui.voiceIndicator.classList.remove('active');
            }
        }
        if (this.isListening) {
            this.updateStatus('Active - Listening', 'active');
        } else if (this.isSpeaking) {
            this.updateStatus('Speaking...', 'speaking');
        } else if (this.isActive) {
            this.updateStatus('Active - Ready', 'active');
        } else {
            this.updateStatus('Inactive', 'inactive');
        }
        const activateBtn = document.getElementById('activate-agent');
        if (activateBtn) {
            if (this.isActive) {
                activateBtn.classList.add('active');
                activateBtn.textContent = 'Deactivate';
            } else {
                activateBtn.classList.remove('active');
                activateBtn.textContent = 'Activate';
            }
        }
    }
    
    updateStatus(text, type = 'default') {
        const statusText = this.ui.statusWidget?.querySelector('.agent-status-text');
        if (statusText) {
            statusText.textContent = text;
            statusText.className = `agent-status-text ${type}`;
        }
        
        // Also update console for debugging
        console.log(`🤖 Status: ${text} (${type})`);
    }
    
    showFeedback(message, type = 'info') {
        // Command feedback disabled - no longer showing cards at bottom
        // if (!this.ui.commandFeedback) return;
        // this.ui.commandFeedback.textContent = message;
        // this.ui.commandFeedback.className = `astra-command-feedback show ${type}`;
        // setTimeout(() => {
        //     if (this.ui.commandFeedback) this.ui.commandFeedback.classList.remove('show');
        // }, 4000);
    }
    
    showSettings() {
        console.log('🔧 Settings panel not implemented yet');
        this.showFeedback('Settings panel coming soon!', 'info');
    }
    
    showError(message) {
        console.error('❌ Error:', message);
        this.showFeedback(message, 'error');
    }
    
    loadUserPreferences() {
        const saved = localStorage.getItem('astra-agent-preferences');
        if (saved) {
            this.context.userPreferences = JSON.parse(saved);
        }
    }
    
    saveUserPreferences() {
        localStorage.setItem('astra-agent-preferences', JSON.stringify(this.context.userPreferences));
    }

    // Move getRandomResponse to AstraVoiceAgent
    getRandomResponse(type, action = null) {
        const responses = {
            activation: [
                "At your service, sir.",
                "Ready to assist you, sir.",
                "I'm here and listening, sir.",
                "How can I help you today, sir?",
                "Yes, I'm ready to work, sir.",
                "What would you like me to do, sir?",
                "I'm at your command, sir.",
                "Ready when you are, sir.",
                "How may I be of assistance, sir?",
                "I'm ready to help you, sir.",
                "Welcome to Astra Workspace, created by Bhanu."
            ],
            navigation: [
                "Navigating there right away, sir.",
                "Switching to that section for you, sir.",
                "Taking you there now, sir.",
                "Moving to that view, sir.",
                "Opening that section right away, sir.",
                "Switching views as requested, sir.",
                "Navigating to your destination, sir.",
                "Taking you there immediately, sir."
            ],
            file: [
                "Handling that file operation, sir.",
                "Processing your file request, sir.",
                "Working on the file task, sir.",
                "Executing the file operation, sir.",
                "Managing your files as requested, sir.",
                "Taking care of the file work, sir.",
                "Processing your file command, sir.",
                "Handling the file operation, sir."
            ],
            filter: [
                "Applying your filter criteria, sir.",
                "Setting up the filters as requested, sir.",
                "Processing your filter requirements, sir.",
                "Implementing the filter conditions, sir.",
                "Applying the data filters, sir.",
                "Setting up your filter preferences, sir.",
                "Processing the filter request, sir.",
                "Implementing your filter criteria, sir."
            ],
            data: [
                "Analyzing the data for you, sir.",
                "Processing your data request, sir.",
                "Working on the data analysis, sir.",
                "Executing the data operation, sir.",
                "Analyzing as requested, sir.",
                "Processing your data requirements, sir.",
                "Working on the analysis, sir.",
                "Handling your data request, sir."
            ],
            workflow: [
                "Initiating the workflow, sir.",
                "Starting the process for you, sir.",
                "Launching the workflow system, sir.",
                "Beginning the workflow execution, sir.",
                "Setting up the workflow process, sir.",
                "Initiating as requested, sir.",
                "Starting the workflow now, sir.",
                "Launching the process, sir."
            ],
            search: [
                "Searching for that information, sir.",
                "Looking up the data for you, sir.",
                "Processing your search request, sir.",
                "Finding the information you need, sir.",
                "Searching the database now, sir.",
                "Looking up your query, sir.",
                "Processing the search, sir.",
                "Finding what you need, sir."
            ],
            system: [
                "Executing that system command, sir.",
                "Processing your system request, sir.",
                "Working on the system operation, sir.",
                "Handling the system task, sir.",
                "Executing as requested, sir.",
                "Processing your command, sir.",
                "Working on the system task, sir.",
                "Handling the operation, sir."
            ],
            scroll: [
                `Scrolling ${action} for you, sir.`,
                `Moving ${action} as requested, sir.`,
                `Scrolling ${action} now, sir.`,
                `Taking you ${action} on the page, sir.`,
                `Moving ${action} for you, sir.`,
                `Scrolling ${action} as requested, sir.`,
                `Navigating ${action} on the page, sir.`,
                `Moving ${action} right away, sir.`
            ],
            completion: [
                "Task completed successfully, sir.",
                "That's been taken care of for you, sir.",
                "All done, sir.",
                "The operation is complete, sir.",
                "Finished as requested, sir.",
                "Task accomplished, sir.",
                "Successfully completed, sir.",
                "Done and dusted, sir."
            ],
            error: [
                "I apologize, but I couldn't complete that request, sir.",
                "I'm sorry, that didn't work as expected, sir.",
                "There seems to be an issue with that command, sir.",
                "I wasn't able to process that request, sir.",
                "Let me try a different approach, sir.",
                "I encountered an error with that task, sir.",
                "That didn't go as planned, sir.",
                "I'm having trouble with that request, sir."
            ]
        };
        const typeResponses = responses[type] || ["I'm on it, sir."];
        return typeResponses[Math.floor(Math.random() * typeResponses.length)];
    }
}

// Command Processing Engine - Professional Assistant
class CommandProcessor {
    constructor(agent) {
        this.agent = agent;
        
        // Navigation commands
        this.navigationMap = {
            'dashboard': '#dashboard',
            'home': '#dashboard',
            'main': '#dashboard',
            'astra': '#astra',
            'workspace': '#astra',
            'batch data': '#batch-data',
            'batch': '#batch-data',
            'data processing': '#batch-data',
            'upload': '#batch-data',
            'data analysis': '#data-analysis',
            'analysis': '#data-analysis',
            'analytics': '#data-analysis',
            'insights': '#data-analysis',
            'stream data': '#stream-data',
            'stream': '#stream-data',
            'company search': '#stream-data',
            'data insights': '#data-insights',
            'insights': '#data-insights',
            'company insights': '#data-insights',
            'database': '#database',
            'db': '#database',
            'saved files': '#database',
            'files': '#database',
            'reports': '#reports',
            'activity': '#activity-log',
            'activity log': '#activity-log',
            'log': '#activity-log',
            'settings': '#settings',
            'config': '#settings',
            'preferences': '#settings'
        };

        // Advanced command patterns for complete website control
        this.commandPatterns = {
            // Navigation patterns
            navigation: [
                /(?:go to|open|show|navigate to|switch to|display)\s+(.+)/i,
                /(?:astra,?\s+)?(?:go to|open|show|navigate to|switch to|display)\s+(.+)/i,
                /(dashboard|home|main|astra|workspace|batch data|batch|data processing|upload|data analysis|analysis|analytics|insights|stream data|stream|company search|search|data insights|company insights|database|db|saved files|files|reports|activity log|activity|log|settings|config|preferences)/i
            ],
            
            // File operations
            fileOperations: [
                /(?:astra,?\s+)?upload\s+(?:file\s+)?(.+)/i,
                /(?:astra,?\s+)?(?:load|import)\s+(?:file\s+)?(.+)/i,
                /(?:astra,?\s+)?(?:select|choose)\s+file\s+(.+)/i,
                /(?:astra,?\s+)?download\s+(.+)/i,
                /(?:astra,?\s+)?save\s+(?:file\s+)?(.+)/i
            ],
            
            // Filter operations
            filterOperations: [
                /(?:astra,?\s+)?apply\s+filter:?\s*(.+)/i,
                /(?:astra,?\s+)?filter\s+(?:by|on|where)\s+(.+)/i,
                /(?:astra,?\s+)?(?:show|display)\s+(?:only|where)\s+(.+)/i,
                /(?:astra,?\s+)?remove\s+(?:filter|filters)/i,
                /(?:astra,?\s+)?clear\s+(?:filter|filters)/i
            ],
            
            // Data operations
            dataOperations: [
                /(?:astra,?\s+)?(?:analyze|analyse)\s+(?:this\s+)?(?:data|file)?/i,
                /(?:astra,?\s+)?(?:run|start|execute)\s+analysis/i,
                /(?:astra,?\s+)?(?:generate|create)\s+(?:chart|visualization|graph)/i,
                /(?:astra,?\s+)?(?:store|save)\s+(?:this\s+)?(?:to\s+)?database/i,
                /(?:astra,?\s+)?(?:export|download)\s+(?:results|data|report)/i
            ],
            
            // Workflow operations
            workflowOperations: [
                /(?:astra,?\s+)?(?:start|begin|run|execute)\s+(?:work\s*)?flow/i,
                /(?:astra,?\s+)?(?:initiate|launch)\s+(?:data\s+)?(?:processing|(?:work\s*)?flow)/i,
                /(?:astra,?\s+)?(?:complete|finish)\s+(?:the\s+)?(?:work\s*)?flow/i,
                /(?:astra,?\s+)?(?:next|continue)\s+(?:step|stage)/i
            ],
            
            // Search operations
            searchOperations: [
                /(?:astra,?\s+)?search\s+(?:for\s+)?(.+)/i,
                /(?:astra,?\s+)?(?:find|locate)\s+(.+)/i,
                /(?:astra,?\s+)?(?:look\s+up|lookup)\s+(.+)/i
            ],
            
            // System operations
            systemOperations: [
                /(?:astra,?\s+)?(?:refresh|reload)\s+(?:page|data)?/i,
                /(?:astra,?\s+)?(?:clear|reset)\s+(?:everything|all|data)?/i,
                /(?:astra,?\s+)?(?:show|display)\s+(?:help|commands)/i,
                /(?:astra,?\s+)?(?:activate|enable)\s+(?:voice|listening)/i,
                /(?:astra,?\s+)?(?:deactivate|disable)\s+(?:voice|listening)/i
            ],
            
            // Activation patterns
            activation: [
                /(?:hey|hello|hi)\s+astra/i,
                /astra(?:,?\s+are\s+you\s+there)?/i,
                /(?:astra,?\s+)?(?:listen|wake up|attention)/i
            ],
            
            // Scroll operations
            scrollOperations: [
                /scroll\s+up/i,
                /scroll\s+down/i,
                /go\s+up/i,
                /go\s+down/i,
                /move\s+up/i,
                /move\s+down/i
            ]
        };

        this.workflowModalPatterns = [
            { type: 'workflow', action: 'start', patterns: [/initiate\s+(?:work\s*)?flow|start\s+(?:work\s*)?flow|begin\s+(?:work\s*)?flow|launch\s+(?:work\s*)?flow/i] },
            { type: 'workflow', action: 'choose_file', patterns: [/choose file (.+)/i, /upload file (.+)/i] },
            { type: 'workflow', action: 'set_filter', patterns: [/set filter (.+)/i, /filter (.+)/i] },
            { type: 'workflow', action: 'toggle_join', patterns: [/join tables/i, /enable join tables/i, /disable join tables/i, /turn (on|off) join tables/i] },
            { type: 'workflow', action: 'store_data', patterns: [/store data|save data|store in database/i] },
            { type: 'workflow', action: 'skip_store', patterns: [/skip storing|do not store|no store/i] },
            { type: 'workflow', action: 'run_analysis', patterns: [/run analysis|analyze data|yes analysis/i] },
            { type: 'workflow', action: 'skip_analysis', patterns: [/skip analysis|no analysis|do not analyze/i] },
            { type: 'workflow', action: 'run_workflow', patterns: [/run\s+(?:work\s*)?flow|submit\s+(?:work\s*)?flow|start\s+processing/i] },
            { type: 'workflow', action: 'cancel_workflow', patterns: [/cancel\s+(?:work\s*)?flow|close\s+(?:work\s*)?flow|abort\s+(?:work\s*)?flow/i] }
        ];
    }

    processCommand(transcript, context = {}) {
        const command = transcript.toLowerCase().trim();
        
        console.log('🎯 Processing professional command:', command);
        
        // Check for activation phrases first
        for (const pattern of this.commandPatterns.activation) {
            if (pattern.test(command)) {
                return {
                    type: 'activation',
                    action: 'acknowledge',
                    response: this.agent.getRandomResponse('activation'),
                    confidence: 0.9
                };
            }
        }

        // Check for search operations FIRST (before navigation to avoid conflicts)
        const searchResult = this.processSearchOperation(command);
        if (searchResult.confidence > 0.4) {
            return searchResult;
        }

        // Check for workflow operations
        const workflowResult = this.processWorkflowOperation(command);
        if (workflowResult.confidence > 0.4) {
            return workflowResult;
        }

        // Check for navigation commands
        const navResult = this.processNavigationCommand(command);
        if (navResult.confidence > 0.4) {
            return navResult;
        }

        // Check for file operations
        const fileResult = this.processFileOperation(command);
        if (fileResult.confidence > 0.4) {
            return fileResult;
        }

        // Check for filter operations
        const filterResult = this.processFilterOperation(command);
        if (filterResult.confidence > 0.4) {
            return filterResult;
        }

        // Check for data operations
        const dataResult = this.processDataOperation(command);
        if (dataResult.confidence > 0.4) {
            return dataResult;
        }

        // Check for system operations
        const systemResult = this.processSystemOperation(command);
        if (systemResult.confidence > 0.4) {
            return systemResult;
        }

        // Check for scroll operations
        const scrollResult = this.processScrollOperation(command);
        if (scrollResult.confidence > 0.4) {
            return scrollResult;
        }

        // Check for workflow modal specific commands
        for (const modalCmd of this.workflowModalPatterns) {
            for (const pattern of modalCmd.patterns) {
                const match = command.match(pattern);
                if (match) {
                    return {
                        type: 'workflow',
                        action: modalCmd.action,
                        value: match[1] || null,
                    response: this.agent.getRandomResponse('workflow'),
                        confidence: 0.95
                    };
                }
            }
        }

        // Fallback for unrecognized commands
        return {
            type: 'unknown',
            action: 'suggest',
            response: "Could you please specify the command?",
            confidence: 0.2
        };
    }

    processNavigationCommand(command) {
        // Direct match first
        for (const [key, target] of Object.entries(this.navigationMap)) {
            if (command === key || command.includes(key)) {
                return {
                    type: 'navigation',
                    action: 'navigate',
                    target: target,
                    response: this.agent.getRandomResponse('navigation'),
                    confidence: 0.95
                };
            }
        }

        // Pattern matching for navigation
        for (const pattern of this.commandPatterns.navigation) {
            const match = command.match(pattern);
            if (match) {
                const destination = match[1] || match[0];
                const cleanDestination = destination.replace(/^(go to|open|show|navigate to|switch to|display)\s+/i, '').trim();
                
                // Find the best match
                for (const [key, target] of Object.entries(this.navigationMap)) {
                    if (cleanDestination.includes(key) || key.includes(cleanDestination)) {
                        return {
                            type: 'navigation',
                            action: 'navigate',
                            target: target,
                            response: this.agent.getRandomResponse('navigation'),
                            confidence: 0.85
                        };
                    }
                }
            }
        }

        return { confidence: 0.2 };
    }

    processFileOperation(command) {
        for (const pattern of this.commandPatterns.fileOperations) {
            const match = command.match(pattern);
            if (match) {
                const fileName = match[1] ? match[1].trim() : null;
                const operation = this.extractFileOperation(command);
                
                return {
                    type: 'file',
                    action: operation,
                    fileName: fileName,
                    response: this.agent.getRandomResponse('file'),
                    confidence: 0.9
                };
            }
        }
        return { confidence: 0.2 };
    }

    processFilterOperation(command) {
        for (const pattern of this.commandPatterns.filterOperations) {
            const match = command.match(pattern);
            if (match) {
                const filterCondition = match[1] ? match[1].trim() : null;
                const operation = command.includes('remove') || command.includes('clear') ? 'clear' : 'apply';
                
                return {
                    type: 'filter',
                    action: operation,
                    condition: filterCondition,
                    response: this.agent.getRandomResponse('filter'),
                    confidence: 0.9
                };
            }
        }
        return { confidence: 0.2 };
    }

    processDataOperation(command) {
        for (const pattern of this.commandPatterns.dataOperations) {
            const match = command.match(pattern);
            if (match) {
                const operation = this.extractDataOperation(command);
                
                return {
                    type: 'data',
                    action: operation,
                    response: this.agent.getRandomResponse('data'),
                    confidence: 0.9
                };
            }
        }
        return { confidence: 0.2 };
    }

    processWorkflowOperation(command) {
        for (const pattern of this.commandPatterns.workflowOperations) {
            const match = command.match(pattern);
            if (match) {
                const operation = this.extractWorkflowOperation(command);
                
                return {
                    type: 'workflow',
                    action: operation,
                    response: this.agent.getRandomResponse('workflow'),
                    confidence: 0.9
                };
            }
        }
        return { confidence: 0.2 };
    }

    processSearchOperation(command) {
        for (const pattern of this.commandPatterns.searchOperations) {
            const match = command.match(pattern);
            if (match) {
                let query = match[1] ? match[1].trim() : null;
                // Clean the query: remove punctuation and extra whitespace for accurate API calls
                if (query) {
                    query = query.replace(/[.,;:!?'"()[\]{}]/g, '').replace(/\s+/g, ' ').trim();
                }
                return {
                    type: 'search',
                    action: 'search',
                    query: query,
                    response: this.agent.getRandomResponse('search'),
                    confidence: 0.9
                };
            }
        }
        // Scroll commands
        for (const pattern of this.commandPatterns.scrollOperations) {
            if (pattern.test(command)) {
                return {
                    type: 'scroll',
                    action: command.includes('up') ? 'up' : 'down',
                    response: `Scrolling ${command.includes('up') ? 'up' : 'down'}.`,
                    confidence: 0.95
                };
            }
        }
        return { confidence: 0.2 };
    }

    processSystemOperation(command) {
        for (const pattern of this.commandPatterns.systemOperations) {
            const match = command.match(pattern);
            if (match) {
                const operation = this.extractSystemOperation(command);
                
                return {
                    type: 'system',
                    action: operation,
                    response: this.agent.getRandomResponse('system'),
                    confidence: 0.9
                };
            }
        }
        return { confidence: 0.2 };
    }

    processScrollOperation(command) {
        // Scroll commands
        for (const pattern of this.commandPatterns.scrollOperations) {
            const match = command.match(pattern);
            if (match) {
                const action = command.includes('up') ? 'up' : 'down';
                return {
                    type: 'scroll',
                    action: action,
                    response: this.agent.getRandomResponse('scroll', action),
                    confidence: 0.95
                };
            }
        }
        return { confidence: 0.2 };
    }

    extractFileOperation(command) {
        if (command.includes('upload') || command.includes('load') || command.includes('import')) return 'upload';
        if (command.includes('download') || command.includes('export')) return 'download';
        if (command.includes('save') || command.includes('store')) return 'save';
        if (command.includes('select') || command.includes('choose')) return 'select';
        return 'upload';
    }

    extractDataOperation(command) {
        if (command.includes('analyze') || command.includes('analyse')) return 'analyze';
        if (command.includes('chart') || command.includes('visualization') || command.includes('graph')) return 'visualize';
        if (command.includes('store') || command.includes('save')) return 'store';
        if (command.includes('export') || command.includes('download')) return 'export';
        return 'analyze';
    }

    extractWorkflowOperation(command) {
        if (command.includes('start') || command.includes('begin') || command.includes('initiate') || command.includes('launch')) return 'start';
        if (command.includes('run') && command.includes('workflow')) return 'run_workflow';
        if (command.includes('submit') && command.includes('workflow')) return 'run_workflow';
        if (command.includes('complete') || command.includes('finish')) return 'complete';
        if (command.includes('next') || command.includes('continue')) return 'next';
        return 'start';
    }

    extractSystemOperation(command) {
        if (command.includes('refresh') || command.includes('reload')) return 'refresh';
        if (command.includes('clear') || command.includes('reset')) return 'clear';
        if (command.includes('help') || command.includes('commands')) return 'help';
        if (command.includes('activate') || command.includes('enable')) return 'activate';
        if (command.includes('deactivate') || command.includes('disable')) return 'deactivate';
        return 'help';
    }
}

// Task Execution Engine - Complete Website Control
class TaskExecutor {
    constructor(agent) {
        this.agent = agent;
        this.isExecuting = false;
        this.currentTask = null;
        this.uploadedFiles = [];
        this.appliedFilters = [];
    }

    async executeTask(result) {
        if (this.isExecuting) {
            console.log('⚠️ Task already executing, queuing...');
            return;
        }

        this.isExecuting = true;
        this.currentTask = result;

        try {
            console.log('🚀 Executing professional task:', result);

            switch (result.type) {
                case 'navigation':
                    await this.handleNavigation(result);
                    break;
                case 'file':
                    await this.handleFileOperation(result);
                    break;
                case 'filter':
                    await this.handleFilterOperation(result);
                    break;
                case 'data':
                    await this.handleDataOperation(result);
                    break;
                case 'workflow':
                    await this.handleWorkflowOperation(result);
                    break;
                case 'search':
                    await this.handleSearchOperation(result);
                    break;
                case 'system':
                    await this.handleSystemOperation(result);
                    break;
                case 'activation':
                    await this.handleActivation(result);
                    break;
                case 'scroll':
                    await this.handleScrollOperation(result);
                    break;
                default:
                    console.log('Unknown task type:', result.type);
            }
            
            // Task completed successfully
            await this.handleTaskCompletion();
        } catch (error) {
            console.error('❌ Task execution error:', error);
            await this.handleTaskError(error);
        } finally {
            this.isExecuting = false;
            this.currentTask = null;
        }
    }

    async handleNavigation(result) {
        console.log('🧭 Navigating to:', result.target);
        
        try {
            // Multiple navigation methods for reliability
            const navElement = document.querySelector(`.nav-item[href="${result.target}"]`);
            
            if (navElement) {
                console.log('✅ Found navigation element, clicking...');
                navElement.click();
                await this.waitForNavigation(result.target);
                return true;
            } else {
                return await this.alternativeNavigation(result.target);
            }
        } catch (error) {
            console.error('❌ Navigation error:', error);
            return await this.alternativeNavigation(result.target);
        }
    }

    async handleFileOperation(result) {
        console.log('📁 Handling file operation:', result.action, result.fileName);
        
        try {
            switch (result.action) {
                case 'upload':
                    await this.handleFileUpload(result.fileName);
                    break;
                case 'download':
                    await this.handleFileDownload(result.fileName);
                    break;
                case 'save':
                    await this.handleFileSave(result.fileName);
                    break;
                case 'select':
                    await this.handleFileSelect(result.fileName);
                    break;
                default:
                    await this.handleFileUpload(result.fileName);
            }
        } catch (error) {
            console.error('❌ File operation error:', error);
        }
    }

    async handleFilterOperation(result) {
        console.log('🔍 Handling filter operation:', result.action, result.condition);
        
        try {
            switch (result.action) {
                case 'apply':
                    await this.applyFilter(result.condition);
                    break;
                case 'clear':
                    await this.clearFilters();
                    break;
                default:
                    await this.applyFilter(result.condition);
            }
        } catch (error) {
            console.error('❌ Filter operation error:', error);
        }
    }

    async handleDataOperation(result) {
        console.log('📊 Handling data operation:', result.action);
        
        try {
            switch (result.action) {
                case 'analyze':
                    await this.analyzeData();
                    break;
                case 'visualize':
                    await this.createVisualization();
                    break;
                case 'store':
                    await this.storeToDatabase();
                    break;
                case 'export':
                    await this.exportData();
                    break;
                default:
                    await this.analyzeData();
            }
        } catch (error) {
            console.error('❌ Data operation error:', error);
        }
    }

    async handleWorkflowOperation(result) {
        console.log('⚙️ Handling workflow operation:', result.action);
        try {
            switch (result.action) {
                case 'start':
                    await this.startWorkflow(); break;
                case 'choose_file':
                    await this.setWorkflowFile(result.value); break;
                case 'set_filter':
                    await this.setWorkflowFilter(result.value); break;
                case 'toggle_join':
                    await this.toggleJoinTables(result.value); break;
                case 'store_data':
                    await this.setStoreData(true); break;
                case 'skip_store':
                    await this.setStoreData(false); break;
                case 'run_analysis':
                    await this.setRunAnalysis(true); break;
                case 'skip_analysis':
                    await this.setRunAnalysis(false); break;
                case 'run_workflow':
                    await this.clickButton('submit-workflow-btn'); break;
                case 'cancel_workflow':
                    await this.clickButton('cancel-workflow-btn'); break;
                case 'complete':
                    await this.completeWorkflow(); break;
                case 'next':
                    await this.nextWorkflowStep(); break;
                default:
                    await this.startWorkflow();
            }
        } catch (error) {
            console.error('❌ Workflow operation error:', error);
        }
    }

    async handleSearchOperation(result) {
        console.log('🔍 Handling search operation:', result.query);
        try {
            await this.handleNavigation({ target: '#stream-data' });
            const searchInput = document.querySelector('#company-search-input');
            const searchBtn = document.querySelector('#company-search-btn');
            if (searchInput && searchBtn) {
                searchInput.value = result.query;
                searchBtn.click();
                console.log('✅ Search performed for:', result.query);
                // After search completion, inform user that data insights are ready
                if (window.astraVoiceAgent) {
                    setTimeout(() => {
                        window.astraVoiceAgent.speak('Your data insights are ready.');
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('❌ Search operation error:', error);
        }
    }

    async handleSystemOperation(result) {
        console.log('🔧 Handling system operation:', result.action);
        
        try {
            switch (result.action) {
                case 'refresh':
                    await this.refreshPage();
                    break;
                case 'clear':
                    await this.clearAll();
                    break;
                case 'help':
                    await this.showHelp();
                    break;
                case 'activate':
                    await this.activateSystem();
                    break;
                case 'deactivate':
                    await this.deactivateSystem();
                    break;
                default:
                    await this.showHelp();
            }
        } catch (error) {
            console.error('❌ System operation error:', error);
        }
    }

    async handleActivation(result) {
        console.log('👋 Handling activation');
        // Activation is handled by the response, no additional action needed
    }

    async handleTaskCompletion() {
        const completionResponse = this.agent.getRandomResponse('completion');
        this.agent.speak(completionResponse);
        console.log('✅ Task completed:', completionResponse);
    }

    async handleTaskError(error) {
        const errorResponse = this.agent.getRandomResponse('error');
        this.agent.speak(errorResponse);
        console.log('❌ Task error:', errorResponse, error);
    }

    async handleScrollOperation(result) {
        // Only allow scroll on Data Analysis or Data Insights sections
        const analysisSection = document.querySelector('#data-analysis-section.active');
        const insightsSection = document.querySelector('#data-insights-section.active');
        let scrollTarget = null;
        if (analysisSection) {
            scrollTarget = document.getElementById('analysis-content');
        } else if (insightsSection) {
            scrollTarget = document.getElementById('company-insights-content');
        }
        if (scrollTarget) {
            if (result.action === 'up') {
                scrollTarget.scrollBy({ top: -200, behavior: 'smooth' });
            } else {
                scrollTarget.scrollBy({ top: 200, behavior: 'smooth' });
            }
            console.log(`✅ Scrolled ${result.action} in analysis/insights section`);
        } else {
            console.log('⚠️ Scroll command ignored: not in Data Analysis or Data Insights section');
        }
    }

    // Navigation helper methods
    async alternativeNavigation(target) {
        console.log('🔄 Trying alternative navigation for:', target);
        
        try {
            if (window.astraApp && typeof window.astraApp.switchView === 'function') {
                console.log('📱 Using main app switchView method');
                window.astraApp.switchView(target);
                await this.waitForNavigation(target);
                return true;
            }
            
            // Direct DOM manipulation
            console.log('🔧 Trying direct DOM manipulation');
            const allSections = document.querySelectorAll('.main-section');
            allSections.forEach(section => section.classList.remove('active'));
            
            const targetSection = document.querySelector(`${target}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
                this.updateNavigationUI(target);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Alternative navigation error:', error);
            return false;
        }
    }

    async waitForNavigation(target) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const targetSection = document.querySelector(`${target}-section`);
                if (targetSection && targetSection.classList.contains('active')) {
                    console.log('✅ Navigation successful');
                    resolve(true);
                } else {
                    console.log('⚠️ Navigation may have failed');
                    resolve(false);
                }
            }, 500);
        });
    }

    updateNavigationUI(target) {
        // Update nav items
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => item.classList.remove('active'));
        
        const targetNavItem = document.querySelector(`.nav-item[href="${target}"]`);
        if (targetNavItem) {
            targetNavItem.classList.add('active');
        }
        
        // Update header title
        const headerTitle = document.getElementById('header-title');
        if (headerTitle) {
            const sectionName = target.replace('#', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
            headerTitle.textContent = sectionName;
        }
    }

    // File operation methods
    async handleFileUpload(fileName) {
        console.log('📤 Uploading file:', fileName);
        
        // Navigate to batch data if not already there
        if (!document.querySelector('#batch-data-section.active')) {
            await this.handleNavigation({ target: '#batch-data' });
        }
        
        // Trigger file upload
        const uploadBtn = document.querySelector('#initiate-workflow-btn');
        if (uploadBtn) {
            uploadBtn.click();
            await this.waitForElement('#workflow-file-input');
            
            // If fileName is provided, we simulate the selection
            if (fileName) {
                this.uploadedFiles.push(fileName);
                console.log('✅ File upload initiated for:', fileName);
            }
        }
    }

    async handleFileDownload(fileName) {
        console.log('📥 Downloading file:', fileName);
        
        // Navigate to database if not already there
        if (!document.querySelector('#database-section.active')) {
            await this.handleNavigation({ target: '#database' });
        }
        
        // Find and click download button for the file
        const downloadBtn = document.querySelector(`[data-filename="${fileName}"] .astra-download-btn`);
        if (downloadBtn) {
            downloadBtn.click();
            console.log('✅ File download initiated for:', fileName);
        } else {
            console.log('⚠️ Download button not found for:', fileName);
        }
    }

    async handleFileSave(fileName) {
        console.log('💾 Saving file:', fileName);
        
        // Trigger save operation
        const saveBtn = document.querySelector('#submit-workflow-btn');
        if (saveBtn) {
            saveBtn.click();
            console.log('✅ File save initiated for:', fileName);
        }
    }

    async handleFileSelect(fileName) {
        console.log('📋 Selecting file:', fileName);
        
        // Find and select the file in the interface
        const fileElement = document.querySelector(`[data-filename="${fileName}"]`);
        if (fileElement) {
            fileElement.click();
            console.log('✅ File selected:', fileName);
        }
    }

    // Filter operation methods
    async applyFilter(condition) {
        console.log('🔍 Applying filter:', condition);
        
        // Navigate to batch data if not already there
        if (!document.querySelector('#batch-data-section.active')) {
            await this.handleNavigation({ target: '#batch-data' });
        }
        
        // Convert natural language to proper SQL format
        let convertedFilter = condition;
        
        // Handle "weekly sales/seals greater than X" -> "Weekly_Sales > X"
        if (condition.toLowerCase().includes('weekly sales greater than') || 
            condition.toLowerCase().includes('weekly seals greater than')) {
            const numberMatch = condition.match(/(\d+)/);
            if (numberMatch) {
                convertedFilter = `Weekly_Sales > ${numberMatch[1]}`;
            }
        }
        // Handle "sales/seals greater than X" -> "Weekly_Sales > X"
        else if (condition.toLowerCase().includes('sales greater than') || 
                 condition.toLowerCase().includes('seals greater than')) {
            const numberMatch = condition.match(/(\d+)/);
            if (numberMatch) {
                convertedFilter = `Weekly_Sales > ${numberMatch[1]}`;
            }
        }
        // Handle "greater than" -> ">"
        else if (condition.toLowerCase().includes('greater than')) {
            convertedFilter = condition.replace(/greater than/gi, '>');
        }
        // Handle "less than" -> "<"
        else if (condition.toLowerCase().includes('less than')) {
            convertedFilter = condition.replace(/less than/gi, '<');
        }
        // Handle "equals" -> "="
        else if (condition.toLowerCase().includes('equals')) {
            convertedFilter = condition.replace(/equals/gi, '=');
        }
        
        console.log('🔧 [DEBUG] Original filter:', condition);
        console.log('🔧 [DEBUG] Converted filter:', convertedFilter);
        
        // Use the app's setWorkflowFilter method to properly update both input and SQL preview
        if (window.astraApp && window.astraApp.setWorkflowFilter) {
            await window.astraApp.setWorkflowFilter(convertedFilter);
            console.log('✅ Filter applied via app method:', convertedFilter);
        } else {
            // Fallback to direct DOM manipulation
            const filterInput = document.querySelector('#filter-condition-input');
            const sqlPreview = document.getElementById('sql-preview');
            if (filterInput) {
                filterInput.value = convertedFilter;
                filterInput.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('✅ Filter input updated:', filterInput.value);
            }
            if (sqlPreview) {
                if (convertedFilter && convertedFilter.trim() !== '') {
                    sqlPreview.textContent = `SELECT * FROM walmart_sales WHERE ${convertedFilter};`;
                    console.log('✅ SQL preview updated:', sqlPreview.textContent);
                } else {
                    sqlPreview.textContent = '';
                }
            }
            console.log('✅ Filter applied via direct DOM:', convertedFilter);
        }
        
        this.appliedFilters.push(convertedFilter);
    }

    async clearFilters() {
        console.log('🧹 Clearing filters');
        
        const filterInput = document.querySelector('#filter-condition-input');
        if (filterInput) {
            filterInput.value = '';
            this.appliedFilters = [];
            console.log('✅ Filters cleared');
        }
    }

    // Data operation methods
    async analyzeData() {
        console.log('📊 Analyzing data');
        
        // Navigate to analysis section
        await this.handleNavigation({ target: '#data-analysis' });
        
        // Trigger analysis
        const analyzeBtn = document.querySelector('#analyze-data-btn');
        if (analyzeBtn) {
            analyzeBtn.click();
            console.log('✅ Data analysis initiated');
        }
    }

    async createVisualization() {
        console.log('📈 Creating visualization');
        
        // Navigate to analysis section
        await this.handleNavigation({ target: '#data-analysis' });
        
        // Trigger visualization creation
        console.log('✅ Visualization creation initiated');
    }

    async storeToDatabase() {
        console.log('💾 Storing to database');
        
        // Navigate to database section
        await this.handleNavigation({ target: '#database' });
        
        // Trigger database storage
        const storeBtn = document.querySelector('#store-data-btn');
        if (storeBtn) {
            storeBtn.click();
            console.log('✅ Data stored to database');
        }
    }

    async exportData() {
        console.log('📤 Exporting data');
        
        // Trigger export
        const exportBtn = document.querySelector('#download-report-btn');
        if (exportBtn) {
            exportBtn.click();
            console.log('✅ Data export initiated');
        }
    }

    // Workflow operation methods
    async startWorkflow() {
        console.log('[Astra Agent] ⚙️ Initiating complete workflow automation');
        
        // Navigate to batch data first
        await this.handleNavigation({ target: '#batch-data' });

        // Wait for the section to be present
        try {
            await this.waitForElement('#batch-data-section', 3000);
        } catch (e) {
            console.error('[Astra Agent] ❌ Batch data section not found or not visible:', e);
            return;
        }

        // Call the main app's complete workflow automation
        if (window.astraApp && typeof window.astraApp.handleWorkflowCommands === 'function') {
            console.log('[Astra Agent] ✅ Calling main app workflow automation');
            try {
                await window.astraApp.handleWorkflowCommands('initiate workflow', 'initiate workflow');
                console.log('[Astra Agent] ✅ Workflow automation completed');
            } catch (error) {
                console.error('[Astra Agent] ❌ Error in workflow automation:', error);
                // Fallback: try to open modal manually
                await this.fallbackModalOpen();
            }
        } else {
            console.error('[Astra Agent] ❌ Main app not available, trying fallback');
            await this.fallbackModalOpen();
        }
    }

    async fallbackModalOpen() {
        console.log('[Astra Agent] 🔧 Fallback: Opening modal manually');
        
        // Try to open the workflow modal professionally
        let modalOpened = false;
        if (window.astraApp && typeof window.astraApp.openWorkflowModal === 'function') {
            window.astraApp.openWorkflowModal();
            console.log('[Astra Agent] ✅ Called openWorkflowModal()');
            // Check if modal is now visible
            const modal = document.getElementById('workflow-modal');
            if (modal && !modal.classList.contains('hidden')) {
                modalOpened = true;
                console.log('[Astra Agent] ✅ Workflow modal is now visible.');
            }
        }
        
        // Fallback: forcibly show the modal if still hidden
        if (!modalOpened) {
            const modal = document.getElementById('workflow-modal');
            if (modal) {
                modal.classList.remove('hidden');
                console.warn('[Astra Agent] ⚠️ Fallback: forcibly removed hidden class from workflow modal.');
                // Reset modal fields for a clean experience
                const fileInput = document.getElementById('workflow-file-input');
                const nameDisplay = document.getElementById('workflow-file-name');
                const filterInput = document.getElementById('filter-condition-input');
                const joinToggle = document.getElementById('join-toggle');
                if (fileInput) fileInput.value = '';
                if (nameDisplay) nameDisplay.textContent = '';
                if (filterInput) filterInput.value = '';
                if (joinToggle) joinToggle.checked = false;
                console.log('[Astra Agent] 🧹 Modal fields reset for professional UX.');
            } else {
                console.error('[Astra Agent] ❌ Workflow modal element not found in DOM.');
            }
        }
    }

    async completeWorkflow() {
        console.log('✅ Completing workflow');
        
        // Submit workflow
        const submitBtn = document.querySelector('#submit-workflow-btn');
        if (submitBtn) {
            submitBtn.click();
            console.log('✅ Workflow completed');
        }
    }

    async nextWorkflowStep() {
        console.log('➡️ Moving to next workflow step');
        
        // Find and click next step
        const nextBtn = document.querySelector('.workflow-next-btn');
        if (nextBtn) {
            nextBtn.click();
            console.log('✅ Moved to next workflow step');
        }
    }

    // System operation methods
    async refreshPage() {
        console.log('🔄 Refreshing page');
        window.location.reload();
    }

    async clearAll() {
        console.log('🧹 Clearing all data');
        
        // Clear filters
        await this.clearFilters();
        
        // Clear uploaded files
        this.uploadedFiles = [];
        
        console.log('✅ All data cleared');
    }

    async showHelp() {
        console.log('❓ Showing help');
        
        // Navigate to help or settings
        await this.handleNavigation({ target: '#settings' });
        
        console.log('✅ Help displayed');
    }

    async activateSystem() {
        console.log('🔌 Activating system');
        
        if (window.astraVoiceAgent) {
            window.astraVoiceAgent.activate();
            console.log('✅ System activated');
        }
    }

    async deactivateSystem() {
        console.log('🔇 Deactivating system');
        
        if (window.astraVoiceAgent) {
            window.astraVoiceAgent.deactivate();
            console.log('✅ System deactivated');
        }
    }

    // Utility methods
    async waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkElement = () => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                } else {
                    setTimeout(checkElement, 100);
                }
            };
            
            checkElement();
        });
    }

    async clickButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            console.log('🔘 Clicking button:', buttonId);
            button.click();
            return true;
        } else {
            console.log('⚠️ Button not found:', buttonId);
            return false;
        }
    }
    
    resetState() {
        console.log('🔄 Resetting agent state...');
        this.isListening = false;
        this.isSpeaking = false;
        this.isProcessing = false;
        this.restartAttempted = false;
        this.forceRestarting = false;
        this.lastSpeechTime = null;
        
        // Clear any timeouts
        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }
        
        // Stop recognition if running
        if (this.recognition) {
            try {
                this.recognition.abort();
            } catch (e) {
                console.log('Recognition already stopped');
            }
        }
        
        this.updateUI();
    }

    // Manual test function for debugging
    testCommand(command) {
        console.log('🧪 [TEST] Manually testing command:', command);
        this.processCommand(command);
    }

    async setWorkflowFile(fileName) {
        await this.startWorkflow();
        const fileInput = document.getElementById('workflow-file-input');
        if (fileInput && fileName) {
            // Simulate file selection (real file upload requires user interaction)
            fileInput.setAttribute('data-fake-file', fileName);
            fileInput.value = '';
            const nameDisplay = document.getElementById('workflow-file-name');
            if (nameDisplay) {
                nameDisplay.textContent = `Selected: ${fileName}`;
                nameDisplay.style.color = '#22c55e';
            }
            console.log('✅ (Simulated) file set:', fileName);
        }
    }

    async setWorkflowFilter(filter) {
        await this.startWorkflow();
        
        // Convert natural language to proper SQL format
        let convertedFilter = filter;
        
        // Handle "weekly sales/seals greater than X" -> "Weekly_Sales > X"
        if (filter.toLowerCase().includes('weekly sales greater than') || 
            filter.toLowerCase().includes('weekly seals greater than')) {
            const numberMatch = filter.match(/(\d+)/);
            if (numberMatch) {
                convertedFilter = `Weekly_Sales > ${numberMatch[1]}`;
            }
        }
        // Handle "sales/seals greater than X" -> "Weekly_Sales > X"
        else if (filter.toLowerCase().includes('sales greater than') || 
                 filter.toLowerCase().includes('seals greater than')) {
            const numberMatch = filter.match(/(\d+)/);
            if (numberMatch) {
                convertedFilter = `Weekly_Sales > ${numberMatch[1]}`;
            }
        }
        // Handle "greater than" -> ">"
        else if (filter.toLowerCase().includes('greater than')) {
            convertedFilter = filter.replace(/greater than/gi, '>');
        }
        // Handle "less than" -> "<"
        else if (filter.toLowerCase().includes('less than')) {
            convertedFilter = filter.replace(/less than/gi, '<');
        }
        // Handle "equals" -> "="
        else if (filter.toLowerCase().includes('equals')) {
            convertedFilter = filter.replace(/equals/gi, '=');
        }
        
        // Use the app's setWorkflowFilter method to properly update both input and SQL preview
        console.log('🔧 [DEBUG] Original filter:', filter);
        console.log('🔧 [DEBUG] Converted filter:', convertedFilter);
        console.log('🔧 [DEBUG] App available:', !!window.astraApp);
        console.log('🔧 [DEBUG] App method available:', !!(window.astraApp && window.astraApp.setWorkflowFilter));
        
        if (window.astraApp && window.astraApp.setWorkflowFilter) {
            await window.astraApp.setWorkflowFilter(convertedFilter);
            console.log('✅ Filter set via app method:', convertedFilter);
        } else {
            // Fallback to direct DOM manipulation
            const filterInput = document.getElementById('filter-condition-input');
            const sqlPreview = document.getElementById('sql-preview');
            if (filterInput) {
                filterInput.value = convertedFilter;
                filterInput.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('✅ Filter input updated:', filterInput.value);
            }
            if (sqlPreview) {
                if (convertedFilter && convertedFilter.trim() !== '') {
                    sqlPreview.textContent = `SELECT * FROM walmart_sales WHERE ${convertedFilter};`;
                    console.log('✅ SQL preview updated:', sqlPreview.textContent);
                } else {
                    sqlPreview.textContent = '';
                }
            }
            console.log('✅ Filter set via direct DOM:', convertedFilter);
        }
    }

    async toggleJoinTables(value) {
        await this.startWorkflow();
        const joinToggle = document.getElementById('join-toggle');
        if (joinToggle) {
            joinToggle.checked = !joinToggle.checked;
            joinToggle.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✅ Join tables toggled:', joinToggle.checked);
        }
    }

    async setStoreData(yes) {
        await this.startWorkflow();
        const radio = document.querySelector(`input[name="store-data"][value="${yes ? 'yes' : 'no'}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✅ Store data set:', yes);
        }
    }

    async setRunAnalysis(yes) {
        await this.startWorkflow();
        const radio = document.querySelector(`input[name="analyze-data"][value="${yes ? 'yes' : 'no'}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✅ Run analysis set:', yes);
        }
    }
}

// Context Management System
class ContextManager {
    updateContext(newContext, currentContext) {
        Object.assign(currentContext, newContext);
        
        // Trim conversation history if too long
        if (currentContext.conversationHistory.length > 50) {
            currentContext.conversationHistory = currentContext.conversationHistory.slice(-50);
        }
    }
    
    getRelevantContext(context) {
        return {
            currentView: context.currentView,
            workflowState: context.workflowState,
            recentCommands: context.conversationHistory.slice(-5)
        };
    }
}

// Global initialization and export
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Astra Voice Agent...');
    
    // Create global instance
    window.astraVoiceAgent = new AstraVoiceAgent();
    
    // Add global activation function for easy access
    window.activateAstraAgent = () => {
        if (window.astraVoiceAgent) {
            window.astraVoiceAgent.activate();
        }
    };
    
    window.deactivateAstraAgent = () => {
        if (window.astraVoiceAgent) {
            window.astraVoiceAgent.deactivate();
        }
    };
    
    // Integration with existing app
    if (window.astraApp) {
        window.astraApp.voiceAgent = window.astraVoiceAgent;
    }
    
    console.log('✅ Astra Voice Agent ready');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AstraVoiceAgent, CommandProcessor, TaskExecutor, ContextManager };
}
