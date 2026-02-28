
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { triggerHapticFeedback } from '../utils';

// --- TYPES ---
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

declare global {
    interface Window {
        SpeechRecognition: { new(): SpeechRecognition };
        webkitSpeechRecognition: { new(): SpeechRecognition };
    }
}

// --- UTILS ---

const WORD_TO_NUMBER_CS: { [key: string]: number } = {
    'nula': 0, 'jedna': 1, 'jeden': 1, 'jedno': 1, 'dva': 2, 'dvě': 2, 'tři': 3, 'čtyři': 4, 'pět': 5,
    'šest': 6, 'sedm': 7, 'osm': 8, 'devět': 9, 'deset': 10, 'jedenáct': 11, 'dvanáct': 12,
    'třináct': 13, 'čtrnáct': 14, 'patnáct': 15, 'šestnáct': 16, 'sedmnáct': 17, 'osmnáct': 18, 'devatenáct': 19,
    'dvacet': 20, 'třicet': 30, 'čtyřicet': 40, 'padesát': 50, 'šedesát': 60, 'sedmdesát': 70, 'osmdesát': 80, 'devadesát': 90,
    'sto': 100
};

const WORD_TO_NUMBER_EN: { [key: string]: number } = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50
};

// Helper to find numbers in text (digits or words) and combine compound numbers (e.g. "dvacet" + "šest" = 26)
const extractNumbers = (text: string, lang: string): number[] => {
    const tokens = text.split(/[\s,.]+/);
    const numbers: number[] = [];
    const map = lang === 'cs' ? WORD_TO_NUMBER_CS : WORD_TO_NUMBER_EN;

    let currentSum = 0;
    let hasCurrent = false;

    tokens.forEach(token => {
        // Check for digits
        const digitMatch = token.match(/^\d+$/);
        if (digitMatch) {
            if (hasCurrent) numbers.push(currentSum);
            numbers.push(parseInt(digitMatch[0], 10));
            currentSum = 0;
            hasCurrent = false;
            return;
        }

        // Check for number words
        const val = map[token];
        if (val !== undefined) {
            if (val >= 100) {
                // simple handling for "sto"
                currentSum = (currentSum === 0 ? 1 : currentSum) * val;
                hasCurrent = true;
            } else if (val >= 20) {
                if (hasCurrent) numbers.push(currentSum);
                currentSum = val;
                hasCurrent = true;
            } else {
                // 0-19
                currentSum += val;
                hasCurrent = true;
            }
        } else {
            // non-number word breaks the chain
            if (hasCurrent) {
                numbers.push(currentSum);
                currentSum = 0;
                hasCurrent = false;
            }
        }
    });

    if (hasCurrent) {
        numbers.push(currentSum);
    }

    return numbers;
};

// --- COMPONENT ---

const VoiceControl: React.FC<{
    onScore: (points: number, type: 'standard' | 'clean10' | 'clean20') => void;
    onEndTurn: () => void;
    onUndo: () => void;
    currentPlayerName?: string; // For TTS
}> = ({ onScore, onEndTurn, onUndo, currentPlayerName }) => {
    const { t, i18n } = useTranslation();
    const [isListening, setIsListening] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    
    // Refs to hold the latest version of props/callbacks to avoid stale closures in event listeners
    const onScoreRef = useRef(onScore);
    const onEndTurnRef = useRef(onEndTurn);
    const onUndoRef = useRef(onUndo);
    
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const feedbackTimeoutRef = useRef<number | null>(null);
    const manuallyStoppedRef = useRef(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    const isSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

    // Update refs whenever props change
    useEffect(() => {
        onScoreRef.current = onScore;
        onEndTurnRef.current = onEndTurn;
        onUndoRef.current = onUndo;
    }, [onScore, onEndTurn, onUndo]);

    // Load voices
    useEffect(() => {
        if (!window.speechSynthesis) return;
        
        const loadVoices = () => {
            setVoices(window.speechSynthesis.getVoices());
        };

        loadVoices();
        
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    // --- TTS (Text to Speech) ---
    const speak = useCallback((text: string) => {
        if (!window.speechSynthesis) return;
        
        window.speechSynthesis.cancel(); // Stop any previous speech

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = i18n.language === 'cs' ? 'cs-CZ' : 'en-US';
        
        // Priority for Czech:
        // 1. "Zuzana" (Apple/iOS - High Quality Female)
        // 2. "Google čeština" (Chrome/Android - High Quality Female)
        // 3. "Iveta" (Android/Samsung - Female)
        // 4. Any voice marked as "female" in metadata (rarely exposed directly in name, but worth trying)
        // 5. Fallback to default
        
        let preferredVoice: SpeechSynthesisVoice | undefined;

        if (utterance.lang === 'cs-CZ') {
             preferredVoice = voices.find(v => v.lang === 'cs-CZ' && (v.name.includes('Zuzana') || v.name.includes('Google') || v.name.includes('Iveta')));
        } else {
             preferredVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Victoria')));
        }

        if (!preferredVoice) {
             // Fallback: look for any voice with correct lang
             preferredVoice = voices.find(v => v.lang.startsWith(i18n.language));
        }
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        // Pitch 0.9 = Natural Female/Alto. (1.0 is default, >1 is chipmunk, <1 is deeper)
        utterance.pitch = 0.9; 
        utterance.rate = 1.0;

        window.speechSynthesis.speak(utterance);
    }, [i18n.language, voices]);

    // Announce player change
    useEffect(() => {
        if (currentPlayerName) {
            const phrase = i18n.language === 'cs' 
                ? `Na tahu je ${currentPlayerName}` 
                : `${currentPlayerName} is on turn`;
            
            // Wait slightly for visual transition
            setTimeout(() => speak(phrase), 600);
        }
    }, [currentPlayerName, i18n.language, speak]);


    // --- COMMAND PARSING ---
    // Defined as a ref or inside useEffect to avoid stale closures, 
    // but here we use the Refs for callbacks so the function itself can be stable.
    const processTranscript = (rawText: string) => {
        const text = rawText.toLowerCase().trim();
        const lang = i18n.language === 'cs' ? 'cs' : 'en';
        
        console.log(`[Voice] Processing: "${text}"`);
        let actionTaken = false;

        // 1. UNDO
        const undoKw = lang === 'cs' ? ['zpět', 'vrátit', 'chyba'] : ['undo', 'back', 'mistake'];
        if (undoKw.some(k => text.includes(k))) {
            onUndoRef.current();
            showFeedback(t('voice.feedback.undo'));
            return;
        }

        // 2. PARSE SCORE & STATS
        const clean10Kw = lang === 'cs' ? ['desítk', 'desítka', 'čistých'] : ['clean ten', 'clean 10']; 
        const hasClean10 = clean10Kw.some(k => text.includes(k));
        
        const extractedNumbers = extractNumbers(text, lang);
        
        // Logic: Only use a number as a MULTIPLIER for "Clean 10" if it's very small (<= 5).
        // If the number is large (e.g. 26), it's likely the score itself (e.g. "Dvacet šest bodů"),
        // even if the keyword "desítka" was falsely detected or part of "deset".
        
        if (hasClean10 && extractedNumbers.length > 0 && extractedNumbers[0] <= 5) {
            let count = extractedNumbers[0];
            
            for(let i=0; i<count; i++) {
                onScoreRef.current(10, 'clean10');
            }
            showFeedback(t('voice.feedback.added', { count: count * 10 }));
            actionTaken = true;
        } 
        else if (extractedNumbers.length > 0) {
            // Take the largest number found to avoid mistaking "Turn 2" for "2 points" if possible,
            // or if we have [20, 6] (which didn't combine for some reason), we generally want the sum or max.
            // With new extractNumbers, "dvacet šest" becomes [26].
            const scoreToAdd = Math.max(...extractedNumbers); 
            
            if (scoreToAdd > 0 && scoreToAdd < 500) {
                onScoreRef.current(scoreToAdd, 'standard');
                showFeedback(t('voice.feedback.added', { count: scoreToAdd }));
                actionTaken = true;
            }
        } else if (hasClean10) {
            // Keyword "Clean 10" present but no number? Assume 1x.
            onScoreRef.current(10, 'clean10');
            showFeedback(t('voice.feedback.added', { count: 10 }));
            actionTaken = true;
        }

        // 3. END TURN 
        const nextKw = lang === 'cs' 
            ? ['dále', 'další', 'dál', 'konec', 'hotovo', 'ukončit', 'piš', 'zapiš', 'střídat', 'končím'] 
            : ['next', 'end', 'finish', 'done', 'pass', 'switch', 'write'];
        
        if (nextKw.some(k => text.includes(k))) {
            // CRITICAL FIX: Give React enough time to update the state from onScore
            // before calling onEndTurn.
            const delay = actionTaken ? 500 : 0;
            
            setTimeout(() => {
                onEndTurnRef.current();
                showFeedback(t('voice.feedback.next'));
            }, delay);
            
            actionTaken = true;
        }

        if (actionTaken) {
            triggerHapticFeedback(50);
        }
    };


    // --- LIFECYCLE ---

    useEffect(() => {
        if (!isSupported) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true; 
        recognition.interimResults = false;
        recognition.lang = i18n.language === 'cs' ? 'cs-CZ' : 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const lastResultIndex = event.results.length - 1;
            if (event.results[lastResultIndex].isFinal) {
                const transcript = event.results[lastResultIndex][0].transcript;
                processTranscript(transcript);
            }
        };

        recognition.onend = () => {
            if (isListening && !manuallyStoppedRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    console.warn("Restart recognition failed", e);
                    setIsListening(false);
                }
            } else {
                setIsListening(false);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'not-allowed') {
                setIsListening(false);
                manuallyStoppedRef.current = true;
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.abort();
        };
    }, [i18n.language, isSupported]); // Dependencies: Re-init if language changes

    // Handle Start/Stop toggle
    useEffect(() => {
        if (!recognitionRef.current) return;
        
        if (isListening) {
            manuallyStoppedRef.current = false;
            try {
                recognitionRef.current.start();
            } catch (e) { 
                // Ignore if already started
            }
        } else {
            manuallyStoppedRef.current = true;
            recognitionRef.current.stop();
        }
    }, [isListening]);


    const showFeedback = (text: string) => {
        setFeedback(text);
        if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(null), 2000);
    };

    if (!isSupported) return null;

    return (
        <>
            <button 
                onClick={() => setIsListening(!isListening)}
                className={`fixed bottom-20 right-4 z-40 p-4 rounded-full shadow-2xl transition-all duration-300 border-4 ${isListening ? 'bg-red-500 border-red-300 animate-pulse scale-110' : 'bg-[--color-surface-light] border-[--color-border] opacity-80 hover:opacity-100'}`}
                aria-label={isListening ? t('voice.stop') : t('voice.start')}
            >
                <span className="text-3xl">{isListening ? '🎙️' : '🎤'}</span>
            </button>
            
            {/* Listening Indicator / Feedback Toast */}
            {isListening && (
                <div className="fixed bottom-36 right-4 z-40 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-lg shadow-lg max-w-[250px] text-center pointer-events-none">
                    {feedback ? (
                        <span className="font-bold text-[--color-green] text-lg block animate-score-pop">{feedback}</span>
                    ) : (
                        <span className="text-sm italic text-gray-300">{t('voice.listening')}</span>
                    )}
                </div>
            )}
        </>
    );
};

export default VoiceControl;
