import { useState, useRef, useCallback, useEffect } from 'react';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type RecognitionStatus = 'idle' | 'listening' | 'error' | 'unsupported';

interface UseVoiceRecognitionOptions {
  onFinalTranscript?: (transcript: string) => void;
  lang?: string;
}

interface UseVoiceRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  status: RecognitionStatus;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  const w = window as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionInstance)
    | null;
}

export function useVoiceRecognition(
  options: UseVoiceRecognitionOptions = {}
): UseVoiceRecognitionReturn {
  const { onFinalTranscript, lang = 'en-US' } = options;

  const isSupported = typeof window !== 'undefined' && getSpeechRecognitionConstructor() !== null;

  const [status, setStatus] = useState<RecognitionStatus>(isSupported ? 'idle' : 'unsupported');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldBeListeningRef = useRef(false);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  const start = useCallback(() => {
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }

    shouldBeListeningRef.current = true;
    setError(null);

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const Ctor = getSpeechRecognitionConstructor()!;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setStatus('listening');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          onFinalTranscriptRef.current?.(text.trim());
          setInterimTranscript('');
        } else {
          interim += text;
        }
      }
      if (interim) {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;

      const message =
        event.error === 'not-allowed'
          ? 'Microphone access denied. Please allow microphone permissions.'
          : event.error === 'audio-capture'
            ? 'No microphone found. Please connect a microphone.'
            : `Speech recognition error: ${event.error}`;

      setError(message);
      setStatus('error');
    };

    recognition.onend = () => {
      if (shouldBeListeningRef.current) {
        try {
          setTimeout(() => {
            if (shouldBeListeningRef.current && recognitionRef.current === recognition) {
              recognition.start();
            }
          }, 100);
        } catch {}
      } else {
        setStatus('idle');
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError('Failed to start speech recognition.');
      setStatus('error');
    }
  }, [isSupported, lang]);

  const stop = useCallback(() => {
    shouldBeListeningRef.current = false;
    setInterimTranscript('');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening: status === 'listening',
    status,
    interimTranscript,
    error,
    start,
    stop,
  };
}
