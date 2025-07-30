# Astra Voice Agent - Professional AI Assistant

## Project Overview

Astra Voice Agent is an advanced, professional AI voice assistant designed for seamless interaction with the Astra Workspace. Built with modern web technologies, it provides natural voice command processing, intelligent navigation, and professional user experience.

**Created by:** Bhanu  
**Version:** 1.0  
**Last Updated:** 2024

---

## 🚀 Key Features

### Voice Recognition & Synthesis
- **Real-time Speech Recognition**: Continuous listening with Web Speech API
- **Natural Voice Synthesis**: Professional voice responses using Microsoft David voice
- **Feedback Loop Prevention**: Advanced algorithms to prevent self-feedback
- **Error Cooldown**: 5-second cooldown after errors to prevent rapid retries

### Professional User Experience
- **Sir Address**: All responses address the user as "sir" for professional tone
- **Natural Welcome**: "Welcome to Astra Workspace, created by Bhanu"
- **Draggable Interface**: Status widget and voice indicator are fully draggable
- **Visual Feedback**: Voice waves animation during listening
- **Clean Interface**: Minimal visual clutter with disabled command feedback cards

### Command Processing
- **Multi-Intent Recognition**: Navigation, file operations, data analysis, workflows
- **Fuzzy Matching**: Flexible command recognition with confidence scoring
- **Context Awareness**: Maintains conversation context and user preferences
- **AI Integration**: DeepSeek AI for unknown commands and knowledge queries

### Navigation & Control
- **Complete Website Control**: Navigate to all sections via voice
- **File Operations**: Upload, download, save, select files
- **Data Analysis**: Analyze data, create visualizations, export results
- **Workflow Management**: Initiate, control, and complete workflows
- **System Operations**: Refresh, clear, help, activate/deactivate

---

## 🏗️ Architecture

### Core Components

#### 1. AstraVoiceAgent (Main Class)
```javascript
class AstraVoiceAgent {
    // Voice system management
    // UI components
    // Command processing coordination
    // Speech synthesis
}
```

#### 2. CommandProcessor
```javascript
class CommandProcessor {
    // Command pattern matching
    // Intent classification
    // Response generation
}
```

#### 3. TaskExecutor
```javascript
class TaskExecutor {
    // Task execution
    // UI interactions
    // Error handling
}
```

#### 4. ContextManager
```javascript
class ContextManager {
    // Conversation context
    // User preferences
    // State management
}
```

### File Structure
```
astra-final/
├── frontend/
│   ├── js/
│   │   ├── astra-agent.js      # Main voice agent
│   │   ├── app.js              # Main application
│   │   ├── astra.js            # Astra workspace
│   │   └── voice.js            # Voice system
│   ├── css/
│   │   └── style.css           # Styling
│   └── index.html              # Main interface
├── backend/
│   ├── app.py                  # Flask backend
│   ├── requirements.txt        # Python dependencies
│   └── uploads/                # File storage
└── README.md
```

---

## 🛠️ Setup Instructions

### Prerequisites
- Modern web browser with Web Speech API support
- Microphone access permissions
- Python 3.7+ (for backend)

### Frontend Setup
1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd astra-final
   ```

2. **Start the frontend**
   - Open `frontend/index.html` in a modern browser
   - Or serve using a local server:
   ```bash
   cd frontend
   python -m http.server 8000
   ```

3. **Enable microphone permissions**
   - Allow microphone access when prompted
   - Ensure browser supports Web Speech API

### Backend Setup (Optional)
1. **Install Python dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Start Flask server**
   ```bash
   python app.py
   ```

---

## 🎯 Usage Guide

### Activation
- **Voice Activation**: Say "Hey Astra" or "Astra, are you there?"
- **Manual Activation**: Click the activate button in the status widget
- **Auto-Activation**: Disabled by default for better control

### Voice Commands

#### Navigation Commands
```
"Go to dashboard"
"Navigate to data insights"
"Switch to batch data"
"Open data analysis"
"Show database"
```

#### File Operations
```
"Upload file [filename]"
"Download [filename]"
"Save file [filename]"
"Select file [filename]"
```

#### Data Analysis
```
"Analyze this data"
"Run analysis"
"Create visualization"
"Generate chart"
"Store to database"
"Export results"
```

#### Workflow Commands
```
"Initiate workflow"
"Start workflow"
"Complete workflow"
"Next step"
```

#### System Commands
```
"Refresh page"
"Clear all"
"Show help"
"Activate voice"
"Deactivate voice"
```

#### Search Operations
```
"Search for [query]"
"Find [query]"
"Look up [query]"
```

#### Scroll Commands
```
"Scroll up"
"Scroll down"
"Go up"
"Go down"
```

### Voice Response Examples
- **Activation**: "At your service, sir."
- **Navigation**: "Navigating there right away, sir."
- **File Operations**: "Handling that file operation, sir."
- **Workflow**: "Initiating the workflow, sir."
- **Error**: "I apologize, but I couldn't complete that request, sir."

---

## 🔧 Configuration

### Voice Settings
```javascript
// Voice configuration
utter.pitch = 1;
utter.rate = 0.9;
utter.volume = 1;
```

### Confidence Thresholds
```javascript
// Command recognition confidence
confidenceThreshold: 0.2  // Lower for better responsiveness
```

### UI Settings
```javascript
// Interface configuration
voiceTimeout: 10000,
maxRetries: 3,
autoActivate: false,  // Manual activation
visualFeedback: true,
debugMode: true
```

---

## 🎨 UI Components

### Status Widget
- **Location**: Top-right corner
- **Features**: Draggable, shows agent status
- **Controls**: Activate/Deactivate, Reset, Settings

### Voice Indicator
- **Location**: Bottom-right corner
- **Features**: Voice waves animation, listening status
- **Behavior**: Shows when actively listening

### Command Feedback
- **Status**: Disabled (clean interface)
- **Previous**: Showed executed commands at bottom

---

## 🔍 Technical Details

### Speech Recognition
- **API**: Web Speech API (webkitSpeechRecognition)
- **Language**: English (en-US)
- **Mode**: Continuous with interim results
- **Alternatives**: 3 max for better accuracy

### Speech Synthesis
- **Voice**: Microsoft David (English US)
- **Fallback**: First available English voice
- **Settings**: Optimized for clarity and professionalism

### Error Handling
- **Feedback Loop Prevention**: 8-second speech suppression
- **Error Cooldown**: 5-second cooldown after errors
- **Agent Phrase Detection**: Prevents processing own speech
- **AI Response Flag**: Prevents processing during AI responses

### Command Processing Flow
1. **Speech Recognition** → Captures user input
2. **Phrase Filtering** → Removes agent speech
3. **Command Processing** → Pattern matching and intent classification
4. **Task Execution** → Performs requested action
5. **Response Generation** → Professional voice response

---

## 🐛 Troubleshooting

### Common Issues

#### Microphone Not Working
- Check browser permissions
- Ensure HTTPS or localhost
- Try refreshing the page

#### Voice Recognition Issues
- Speak clearly and naturally
- Reduce background noise
- Check confidence threshold settings

#### Commands Not Recognized
- Use exact command phrases
- Check command patterns in code
- Ensure proper activation

#### Feedback Loop
- Automatic prevention implemented
- 8-second speech suppression
- Agent phrase detection

### Debug Mode
```javascript
// Enable debug logging
debugMode: true
```

---

## 🔮 Future Enhancements

### Planned Features
- **Multi-language Support**: Additional languages
- **Custom Voice Training**: Personalized voice models
- **Advanced AI Integration**: More sophisticated AI responses
- **Mobile Support**: Mobile-optimized interface
- **Offline Mode**: Basic functionality without internet

### Potential Improvements
- **Voice Biometrics**: User voice recognition
- **Context Memory**: Long-term conversation memory
- **Custom Commands**: User-defined command patterns
- **Integration APIs**: Third-party service integration

---

## 📝 Development Notes

### Code Organization
- **Modular Design**: Separate classes for different responsibilities
- **Event-Driven**: Async/await for non-blocking operations
- **Error Handling**: Comprehensive error catching and recovery
- **Performance**: Optimized for real-time voice processing

### Best Practices
- **Professional Tone**: Consistent "sir" addressing
- **Natural Responses**: Varied, human-like responses
- **Clean UI**: Minimal visual clutter
- **Reliable Operation**: Robust error handling

---

## 📞 Support

For technical support or feature requests:
- **Developer**: Bhanu
- **Project**: Astra Voice Agent
- **Version**: 1.0

---

*This documentation covers the Astra Voice Agent project as of 2024. For the latest updates and features, refer to the project repository.* 