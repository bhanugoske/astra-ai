/**
 * Astra Voice Module - Voice Interaction and Workflow Triggers
 * Handles speech recognition, voice commands, and workflow automation
 */

class AstraVoice {
    constructor() {
        this.isRecording = false;
        this.isListening = false;
        this.isStarting = false; // Prevent multiple simultaneous start attempts
        this.shouldBeListening = false; // Track if user wants voice active
        this.hasSpokenWelcome = false; // Track if welcome message was spoken
        this.recognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.voiceBtn = null;
        this.statusElement = null;
        this.isInitialized = false;
        this.lastResult = '';
        this.confidenceThreshold = 0.3; // Lower threshold for easier speech capture
        
        // Voice command patterns
        this.commands = {
            greetings: [
                'hello', 'hi', 'hey astra', 'good morning', 'good afternoon', 'good evening'
            ],
            help: [
                'help', 'what can you do', 'how can you help', 'help me', 'assist me'
            ],
            dataWorkflow: [
                'help with data', 'help me with data', 'data workflow', 'process data',
                'analyze data', 'work with data'
            ],
            upload: [
                'upload file', 'upload data', 'load file', 'import data', 'add file',
                'select file', 'choose file', 'pick file', 'browse file'
            ],
            filter: [
                'filter data', 'apply filter', 'filter records', 'set conditions',
                'filter the data', 'add filter'
            ],
            sqlFilter: [
                'apply sql filter', 'sql filter', 'set sql filter', 'filter with sql',
                'weekly sales greater than', 'sales greater than', 'apply filter weekly sales'
            ],
            database: [
                'save to database', 'store data', 'save data', 'save this',
                'store this', 'save to db'
            ],
            analysis: [
                'analyze this', 'run analysis', 'analyze data', 'generate insights',
                'create analysis', 'perform analysis'
            ],
            newChat: [
                'new chat', 'start new chat', 'new conversation', 'fresh start',
                'new session'
            ],
            stop: [
                'stop', 'pause', 'stop listening', 'stop recording', 'cancel'
            ],
            runWorkflow: [
                'run workflow', 'execute workflow', 'start workflow', 'run the workflow',
                'execute the workflow', 'start the workflow', 'run data workflow'
            ],
            cancelWorkflow: [
                'cancel workflow', 'stop workflow', 'abort workflow', 'cancel the workflow',
                'stop the workflow', 'abort the workflow', 'cancel data workflow'
            ]
        };
        
        this.init();
    }

    init() {
        this.setupSpeechRecognition();
        this.setupVoiceButton();
        this.setupStatusElement();
        this.isInitialized = true;
        
        console.log('AstraVoice initialized successfully');
        console.log('astraApp available:', !!window.astraApp);
        
        // Test the connection
        if (window.astraApp) {
            console.log('astraApp methods available:', {
                onVoiceResult: typeof window.astraApp.onVoiceResult,
                speak: typeof window.astraApp.speak
            });
        }
    }

    setupSpeechRecognition() {
        // Check for browser support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported in this browser');
            this.showUnsupportedMessage();
            return;
        }

        // Initialize speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition settings
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 3;

        // Event handlers
        this.recognition.onstart = () => {
            console.log('Speech recognition started');
            this.isListening = true;
            this.isRecording = true;
            this.isStarting = false;
            this.updateVoiceButton('listening');
            this.updateStatus('Listening... Speak now!');
            this.animateVoiceButton();
            
            // Only speak welcome message once when first activated
            if (!this.hasSpokenWelcome) {
                setTimeout(() => {
                    this.speak("I'm listening. Please speak your command.");
                    this.hasSpokenWelcome = true;
                }, 1000);
            }
        };

        this.recognition.onresult = (event) => {
            this.handleSpeechResult(event);
        };

        this.recognition.onerror = (event) => {
            console.log('Speech recognition error:', event.error);
            this.handleSpeechError(event);
        };

        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            this.isListening = false;
            this.isRecording = false;
            this.isStarting = false;
            
            // Only update UI if we're not supposed to be listening
            if (!this.shouldBeListening) {
                this.updateVoiceButton('idle');
                this.updateStatus('Click to speak');
                this.stopVoiceButtonAnimation();
            } else {
                // Restart listening if we should still be listening, but don't speak
                setTimeout(() => {
                    if (this.shouldBeListening) {
                        this.start();
                    }
                }, 2000); // Longer delay to avoid constant restarts
            }
        };
    }

    setupVoiceButton() {
        this.voiceBtn = document.querySelector('.astra-voice-btn');
        if (!this.voiceBtn) {
            console.warn('Voice button not found');
            return;
        }

        this.voiceBtn.addEventListener('click', () => {
            this.toggle();
        });
    }

    setupStatusElement() {
        this.statusElement = document.querySelector('.astra-status');
        if (!this.statusElement) {
            console.warn('Status element not found');
            return;
        }
    }

    toggle() {
        console.log('Voice toggle called. Current state:', {
            isListening: this.isListening,
            isRecording: this.isRecording,
            shouldBeListening: this.shouldBeListening
        });
        
        if (this.shouldBeListening) {
            // Turn off voice
            console.log('Turning off voice recognition...');
            this.shouldBeListening = false;
            this.hasSpokenWelcome = false; // Reset welcome flag
            this.stop();
            this.updateVoiceButton('idle');
            this.updateStatus('Voice deactivated. Click to activate.');
        } else {
            // Turn on voice
            console.log('Turning on voice recognition...');
            this.shouldBeListening = true;
            this.hasSpokenWelcome = false; // Reset welcome flag
            this.start();
        }
    }

    start() {
        if (!this.recognition) {
            this.showUnsupportedMessage();
            return;
        }

        if (this.isStarting) {
            console.log('Start already in progress, ignoring...');
            return;
        }

        this.isStarting = true;

        // Reset state first
        this.isRecording = false;
        this.isListening = false;

        // Always try to stop first to ensure clean state
        try {
            this.recognition.stop();
        } catch (error) {
            console.log('Error stopping recognition (expected during start):', error);
        }

        // Wait longer to ensure the stop completes
        setTimeout(() => {
            try {
                this.recognition.start();
                console.log('Speech recognition start() called successfully');
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                this.updateStatus('Error starting voice recognition');
                // Reset state on error
                this.isRecording = false;
                this.isListening = false;
            } finally {
                this.isStarting = false;
            }
        }, 500); // Increased delay to 500ms
    }

    stop() {
        if (!this.recognition) {
            return;
        }

        try {
            this.recognition.stop();
            this.isRecording = false;
            this.isListening = false;
            console.log('Speech recognition stopped successfully');
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
            // Force reset state even if stop fails
            this.isRecording = false;
            this.isListening = false;
        }
    }

    handleSpeechResult(event) {
        console.log('Speech result event received:', event);
        console.log('Number of results:', event.results.length);
        console.log('Result index:', event.resultIndex);
        
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            console.log('Processing result:', result);
            
            if (result.length > 0) {
                const transcript = result[0].transcript;
                const confidence = result[0].confidence;

                console.log('Speech result details:', { 
                    transcript, 
                    confidence, 
                    isFinal: result.isFinal,
                    transcriptLength: transcript.length
                });

                if (result.isFinal) {
                    // Accept any transcript with confidence > 0, or if transcript is not empty
                    if (confidence > 0 || transcript.trim().length > 0) {
                        finalTranscript += transcript;
                        console.log('Added to final transcript:', transcript, 'confidence:', confidence);
                    } else {
                        console.log('Skipping empty transcript with confidence:', confidence);
                    }
                } else {
                    interimTranscript += transcript;
                    console.log('Added to interim transcript:', transcript);
                }
            } else {
                console.log('Empty result array');
            }
        }

        // Update status with interim results
        if (interimTranscript) {
            this.updateStatus(`Hearing: "${interimTranscript}"`);
            console.log('Updated status with interim:', interimTranscript);
        }

        // Process final transcript
        if (finalTranscript) {
            console.log('Processing final transcript:', finalTranscript);
            this.processFinalTranscript(finalTranscript);
        } else {
            console.log('No final transcript to process');
        }
    }

    processFinalTranscript(transcript) {
        const cleanTranscript = transcript.trim().toLowerCase();
        
        if (cleanTranscript === this.lastResult) {
            return; // Avoid duplicate processing
        }
        
        this.lastResult = cleanTranscript;
        
        console.log('Voice command received:', cleanTranscript);
        console.log('window.astraApp available:', !!window.astraApp);
        
        // Send to chat for DeepSeek API processing
        if (window.astraApp) {
            console.log('Calling astraApp.onVoiceResult with:', transcript);
            window.astraApp.onVoiceResult(transcript);
        } else {
            console.error('astraApp not available!');
        }
        
        // Only process predefined voice commands if no general conversation
        const isPredefinedCommand = this.matchCommand(cleanTranscript);
        if (isPredefinedCommand) {
            this.processVoiceCommand(cleanTranscript);
        }
        
        // Update status
        this.updateStatus(`Processed: "${transcript}"`);
        
        // Auto-restart listening after a short delay
        setTimeout(() => {
            if (this.isRecording && !this.isListening) {
                this.start();
            }
        }, 1000);
    }

    processVoiceCommand(command) {
        const matchedCommand = this.matchCommand(command);
        
        if (!matchedCommand) {
            // Let the DeepSeek API handle general conversation
            console.log('No predefined command matched, letting DeepSeek handle:', command);
            return;
        }

        console.log('Processing predefined command:', matchedCommand);
        
        switch (matchedCommand) {
            case 'greetings':
                this.handleGreeting();
                break;
            case 'help':
                this.handleHelp();
                break;
            case 'dataWorkflow':
                this.handleDataWorkflow();
                break;
            case 'upload':
                this.handleUpload();
                break;
            case 'filter':
                this.handleFilter();
                break;
            case 'sqlFilter':
                this.handleSqlFilter();
                break;
            case 'database':
                this.handleDatabase();
                break;
            case 'analysis':
                this.handleAnalysis();
                break;
            case 'newChat':
                this.handleNewChat();
                break;
            case 'stop':
                this.handleStop();
                break;
            case 'runWorkflow':
                this.handleRunWorkflow();
                break;
            case 'cancelWorkflow':
                this.handleCancelWorkflow();
                break;
            default:
                console.log('Unknown predefined command:', matchedCommand);
        }
    }

    matchCommand(input) {
        for (const [category, patterns] of Object.entries(this.commands)) {
            for (const pattern of patterns) {
                if (input.includes(pattern)) {
                    console.log('Matched predefined command:', category, 'for input:', input);
                    return category;
                }
            }
        }
        console.log('No predefined command matched for:', input);
        return null;
    }

    // Command Handlers
    handleGreeting() {
        const greetings = [
            "Hello! I'm Astra. How can I help you with your data today?",
            "Hi there! Ready to work with some data?",
            "Hello! I'm here to help you analyze and process your data.",
            "Hey! What would you like to do with your data today?"
        ];
        
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        this.speak(greeting);
    }

    handleHelp() {
        const helpMessage = "I can help you with data workflows. Say 'help with data' to start, " +
                           "or try commands like 'upload file', 'filter data', 'save to database', " +
                           "or 'analyze this' to work with your data.";
        this.speak(helpMessage);
    }

    handleDataWorkflow() {
        this.speak("Great! I'll help you with your data workflow. Let's start by uploading a file.");
        this.triggerWorkflowStep('upload');
    }

    handleUpload() {
        this.speak("Opening file upload. Please select your data file, sir.");
        this.triggerWorkflowStep('upload');
        
        // Trigger file upload UI
        if (window.astraApp) {
            window.astraApp.openFilePicker();
        }
    }

    handleFilter() {
        this.speak("Activating SQL filter step. You can now set your filter conditions like 'Weekly_Sales greater than 2000', sir.");
        this.triggerWorkflowStep('filter');
    }

    handleSqlFilter() {
        this.speak("Activating advanced SQL filter. You can now set precise conditions like 'Weekly_Sales greater than 2000' for the walmart sales table, sir.");
        this.triggerWorkflowStep('filter');
        
        // If astraApp is available, we can also set the filter directly
        if (window.astraApp) {
            // This will be handled by the workflow system
            console.log('SQL filter activated via voice command');
        }
    }

    handleDatabase() {
        this.speak("Saving your data to the database now.");
        this.triggerWorkflowStep('database');
        
        // Trigger database save
        if (window.astraApp) {
            window.astraApp.handleDatabaseWorkflow();
        }
    }

    handleAnalysis() {
        this.speak("Starting data analysis. This will generate insights and visualizations.");
        this.triggerWorkflowStep('analysis');
        
        // Trigger analysis
        if (window.astraApp) {
            window.astraApp.handleAnalysisWorkflow();
        }
    }

    handleNewChat() {
        this.speak("Starting a new chat session.");
        
        if (window.astraApp) {
            window.astraApp.createNewChatSession();
        }
    }

    handleStop() {
        this.speak("Stopping voice recognition.");
        this.stop();
    }

    handleRunWorkflow() {
        this.speak("Running the data workflow now, sir.");
        
        // Trigger workflow execution
        if (window.astraApp) {
            window.astraApp.runWorkflow().then(() => {
                // Additional feedback after workflow execution
                setTimeout(() => {
                    this.speak("Workflow execution completed, sir.");
                }, 2000);
            }).catch((error) => {
                console.error('Workflow execution error:', error);
                this.speak("There was an issue with the workflow execution, sir.");
            });
        }
    }

    handleCancelWorkflow() {
        this.speak("Cancelling the workflow, sir.");
        
        // Trigger workflow cancellation
        if (window.astraApp) {
            window.astraApp.cancelWorkflow();
        }
    }

    // Workflow Integration
    triggerWorkflowStep(step) {
        if (window.astraApp) {
            window.astraApp.triggerWorkflowStep(step);
        }
        
        // Visual feedback
        this.highlightWorkflowStep(step);
    }

    highlightWorkflowStep(step) {
        const stepElement = document.querySelector(`[data-step="${step}"]`);
        if (stepElement) {
            stepElement.classList.add('voice-triggered');
            setTimeout(() => {
                stepElement.classList.remove('voice-triggered');
            }, 2000);
        }
    }

    // Text-to-Speech
    speak(text) {
        if (!this.speechSynthesis) {
            console.warn('Speech synthesis not supported');
            return;
        }

        // Stop any ongoing speech
        this.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        // Select a suitable voice
        const voices = this.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.name.includes('Google') || 
            voice.name.includes('Microsoft') || 
            voice.lang.includes('en-US')
        );
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
            this.updateStatus('Speaking...');
            // Pause listening while speaking
            if (this.isListening) {
                this.recognition.stop();
            }
        };

        utterance.onend = () => {
            this.updateStatus('Click to speak');
            // Resume listening after speaking
            if (this.isRecording && !this.isListening) {
                setTimeout(() => {
                    this.start();
                }, 500);
            }
        };

        this.speechSynthesis.speak(utterance);
    }

    // UI Updates
    updateVoiceButton(state) {
        if (!this.voiceBtn) return;

        this.voiceBtn.classList.remove('active', 'listening', 'processing');
        
        switch (state) {
            case 'listening':
                this.voiceBtn.classList.add('active');
                break;
            case 'processing':
                this.voiceBtn.classList.add('processing');
                break;
            case 'idle':
            default:
                // No additional classes
                break;
        }
    }

    updateStatus(message) {
        if (!this.statusElement) return;

        this.statusElement.textContent = message;
        this.statusElement.classList.add('fade-in');
        
        setTimeout(() => {
            this.statusElement.classList.remove('fade-in');
        }, 300);
    }

    animateVoiceButton() {
        if (!this.voiceBtn) return;

        this.voiceBtn.style.animation = 'pulse 2s infinite';
    }

    stopVoiceButtonAnimation() {
        if (!this.voiceBtn) return;

        this.voiceBtn.style.animation = '';
    }

    showUnsupportedMessage() {
        const message = "Voice recognition is not supported in this browser. " +
                       "Please use Chrome, Firefox, or Safari for voice features.";
        
        this.updateStatus(message);
        
        if (this.voiceBtn) {
            this.voiceBtn.disabled = true;
            this.voiceBtn.style.opacity = '0.5';
            this.voiceBtn.style.cursor = 'not-allowed';
        }
    }

    handleSpeechError(event) {
        let errorMessage = 'Voice recognition error: ';
        
        switch (event.error) {
            case 'no-speech':
                errorMessage += 'No speech detected. Try speaking louder.';
                break;
            case 'audio-capture':
                errorMessage += 'Microphone access denied or not available.';
                break;
            case 'not-allowed':
                errorMessage += 'Microphone permission denied.';
                break;
            case 'network':
                errorMessage += 'Network error. Check your connection.';
                break;
            case 'aborted':
                errorMessage += 'Speech recognition aborted.';
                break;
            default:
                errorMessage += event.error;
        }
        
        console.error(errorMessage);
        this.updateStatus(errorMessage);
        
        this.isListening = false;
        this.updateVoiceButton('idle');
        this.stopVoiceButtonAnimation();
    }

    // Public Methods
    destroy() {
        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }
        
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }
        
        this.isInitialized = false;
        this.isRecording = false;
        this.isListening = false;
        
        console.log('AstraVoice destroyed');
    }

    reset() {
        console.log('Resetting voice system...');
        this.isRecording = false;
        this.isListening = false;
        this.isStarting = false;
        this.shouldBeListening = false;
        this.hasSpokenWelcome = false;
        this.updateVoiceButton('idle');
        this.updateStatus('Click to speak');
        this.stopVoiceButtonAnimation();
        
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.log('Error stopping recognition during reset:', error);
            }
        }
    }

    // Utility Methods
    isSupported() {
        return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
    }

    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isRecording: this.isRecording,
            isListening: this.isListening,
            isSupported: this.isSupported()
        };
    }

    // Voice Command Registration
    addCommand(category, patterns) {
        if (!this.commands[category]) {
            this.commands[category] = [];
        }
        
        if (Array.isArray(patterns)) {
            this.commands[category].push(...patterns);
        } else {
            this.commands[category].push(patterns);
        }
    }

    removeCommand(category, pattern) {
        if (this.commands[category]) {
            const index = this.commands[category].indexOf(pattern);
            if (index > -1) {
                this.commands[category].splice(index, 1);
            }
        }
    }

    // Settings
    setConfidenceThreshold(threshold) {
        this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
    }

    setLanguage(lang) {
        if (this.recognition) {
            this.recognition.lang = lang;
        }
    }
}

// Initialize AstraVoice when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Don't initialize immediately - wait for workspace to be opened
    console.log('AstraVoice: DOM ready, waiting for workspace...');
});

// Initialize when workspace is opened
document.addEventListener('astraWorkspaceOpened', () => {
    console.log('AstraVoice: Workspace opened, initializing...');
    if (document.querySelector('.astra-voice-btn') && !window.AstraVoice) {
        window.AstraVoice = new AstraVoice();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AstraVoice;
} 