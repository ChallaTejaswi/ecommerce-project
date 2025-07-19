import React, { useState, useEffect } from 'react';
import './VoiceToggle.css';

const VoiceToggle = ({ onVoiceResult, onVoiceModeChange, disabled, language }) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = language || 'en-US';

      recognitionInstance.onstart = () => {
        setIsListening(true);
        onVoiceModeChange(true);
      };

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Voice recognition result:', transcript);
        onVoiceResult(transcript);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
        onVoiceModeChange(false);
      };

      recognitionInstance.onerror = (event) => {
        console.error('Voice recognition error:', event.error);
        setIsListening(false);
        onVoiceModeChange(false);
      };

      setRecognition(recognitionInstance);
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, [onVoiceResult, onVoiceModeChange, language]);

  const toggleListening = () => {
    if (!recognition || disabled) return;

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  if (!isSupported) {
    return (
      <div className="voice-toggle unsupported">
        <span>🚫 Voice not supported</span>
      </div>
    );
  }

  return (
    <div className="voice-toggle">
      <button
        onClick={toggleListening}
        disabled={disabled}
        className={`voice-btn ${isListening ? 'listening' : ''}`}
        title={isListening ? 'Stop listening' : 'Start voice input'}
      >
        {isListening ? (
          <>
            <span className="pulse-ring"></span>
            🎙️ Listening...
          </>
        ) : (
          <>
            🎤 Voice
          </>
        )}
      </button>
      <div className="voice-hint">
        {isListening ? 'Speak now...' : 'Click to use voice'}
      </div>
    </div>
  );
};

export default VoiceToggle;
