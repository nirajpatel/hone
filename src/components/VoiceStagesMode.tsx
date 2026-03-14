import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { parseVoiceCommand, VoiceCommand } from '../utils/voiceCommandParser';
import { formatTime } from './TimeInput';
import { Label } from './ui/label';

interface VoiceStage {
  endTime: string;
  endWeight: string;
}

interface TranscriptEntry {
  id: number;
  text: string;
  recognized: boolean;
  command?: string;
}

interface VoiceStagesModeProps {
  stages: VoiceStage[];
  setStages: (stages: VoiceStage[] | ((prev: VoiceStage[]) => VoiceStage[])) => void;
  onExit: () => void;
}

export function VoiceStagesMode({ stages, setStages, onExit }: VoiceStagesModeProps) {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [flashingField, setFlashingField] = useState<{ stageIndex: number; field: 'time' | 'weight' } | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const entryIdRef = useRef(0);

  const flashField = useCallback((stageIndex: number, field: 'time' | 'weight') => {
    setFlashingField({ stageIndex, field });
    setTimeout(() => setFlashingField(null), 600);
  }, []);

  const applyCommand = useCallback((command: VoiceCommand) => {
    // For data commands, use the embedded stageIndex if present, otherwise active stage
    const MAX_STAGES = 10;
    const ensureStageExists = (targetIdx: number) => {
      if (targetIdx >= MAX_STAGES) return;
      if (targetIdx >= stages.length) {
        setStages(prev => {
          const updated = [...prev];
          while (updated.length <= targetIdx) {
            updated.push({ endTime: '', endWeight: '' });
          }
          return updated;
        });
      }
    };

    const resolveTarget = (si?: number) => {
      if (si !== undefined && si >= 0 && si < MAX_STAGES) {
        ensureStageExists(si);
        setActiveStageIndex(si);
        return si;
      }
      return activeStageIndex;
    };

    switch (command.type) {
      case 'setTime': {
        const target = resolveTarget(command.stageIndex);
        setStages(prev => {
          const updated = [...prev];
          updated[target] = { ...updated[target], endTime: command.seconds.toString() };
          return updated;
        });
        flashField(target, 'time');
        break;
      }
      case 'setWeight': {
        const target = resolveTarget(command.stageIndex);
        setStages(prev => {
          const updated = [...prev];
          updated[target] = { ...updated[target], endWeight: command.grams.toString() };
          return updated;
        });
        flashField(target, 'weight');
        break;
      }
      case 'setTimeAndWeight': {
        const target = resolveTarget(command.stageIndex);
        setStages(prev => {
          const updated = [...prev];
          updated[target] = {
            endTime: command.seconds.toString(),
            endWeight: command.grams.toString(),
          };
          return updated;
        });
        flashField(target, 'time');
        setTimeout(() => flashField(target, 'weight'), 150);
        break;
      }
      case 'nextStage': {
        setStages(prev => {
          if (activeStageIndex >= prev.length - 1) {
            return [...prev, { endTime: '', endWeight: '' }];
          }
          return prev;
        });
        setActiveStageIndex(prev => prev + 1);
        break;
      }
      case 'previousStage': {
        setActiveStageIndex(prev => Math.max(0, prev - 1));
        break;
      }
      case 'goToStage': {
        const idx = command.stageIndex;
        if (idx >= 0 && idx < MAX_STAGES) {
          ensureStageExists(idx);
          setActiveStageIndex(idx);
        }
        break;
      }
      case 'addStage': {
        const toAdd = Math.max(0, Math.min(command.count, MAX_STAGES - stages.length));
        if (toAdd <= 0) break;
        setStages(prev => {
          const newStages = Array.from({ length: toAdd }, () => ({ endTime: '', endWeight: '' }));
          return [...prev, ...newStages];
        });
        setActiveStageIndex(stages.length);
        break;
      }
      case 'deleteStage': {
        const deleteIdx = command.stageIndex ?? activeStageIndex;
        setStages(prev => {
          if (prev.length <= 1) {
            return [{ endTime: '', endWeight: '' }];
          }
          if (deleteIdx < 0 || deleteIdx >= prev.length) return prev;
          return prev.filter((_, i) => i !== deleteIdx);
        });
        setActiveStageIndex(prev => {
          if (stages.length <= 1) return 0;
          if (deleteIdx >= stages.length - 1) return Math.max(0, stages.length - 2);
          if (prev > deleteIdx) return prev - 1;
          if (prev === deleteIdx) return Math.min(prev, stages.length - 2);
          return prev;
        });
        break;
      }
      case 'clearTime': {
        setStages(prev => {
          const updated = [...prev];
          updated[activeStageIndex] = { ...updated[activeStageIndex], endTime: '' };
          return updated;
        });
        break;
      }
      case 'clearWeight': {
        setStages(prev => {
          const updated = [...prev];
          updated[activeStageIndex] = { ...updated[activeStageIndex], endWeight: '' };
          return updated;
        });
        break;
      }
      case 'done': {
        onExit();
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStageIndex, flashField, stages.length]);

  // Auto-advance when both fields are filled on the active stage
  useEffect(() => {
    const stage = stages[activeStageIndex];
    if (!stage) return;
    if (stage.endTime && stage.endWeight) {
      const timer = setTimeout(() => {
        setStages(prev => {
          if (activeStageIndex >= prev.length - 1) {
            return [...prev, { endTime: '', endWeight: '' }];
          }
          return prev;
        });
        setActiveStageIndex(prev => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [stages, activeStageIndex, setStages]);

  const handleFinalTranscript = useCallback((transcript: string) => {
    const command = parseVoiceCommand(transcript);
    const entry: TranscriptEntry = {
      id: ++entryIdRef.current,
      text: transcript,
      recognized: command !== null,
      command: command ? commandLabel(command) : undefined,
    };
    setTranscriptEntries(prev => [...prev.slice(-4), entry]);

    if (command) {
      applyCommand(command);
    }
  }, [applyCommand]);

  const {
    isListening,
    status,
    interimTranscript,
    error,
    start,
    stop,
  } = useVoiceRecognition({ onFinalTranscript: handleFinalTranscript });

  useEffect(() => {
    if (status !== 'unsupported') {
      start();
    }
    return () => { stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = transcriptContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcriptEntries, interimTranscript]);

  const hasTranscript = transcriptEntries.length > 0 || !!interimTranscript;

  return (
    <div className="space-y-3">
      {/* Mic status row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => isListening ? stop() : start()}
          className="relative flex items-center justify-center w-6 h-6 rounded-full cursor-pointer bg-transparent border-0 p-0 flex-shrink-0"
          type="button"
        >
          {isListening && (
            <span className="absolute inset-0 rounded-full voice-pulse-ring" />
          )}
          <span className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
            isListening ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {isListening ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
          </span>
        </button>
        <span className="text-sm text-gray-500">
          {error ? <span className="text-red-600">{error}</span>
            : status === 'unsupported' ? <span className="text-red-600">Not supported in this browser.</span>
            : isListening ? 'Listening\u2026'
            : 'Paused'}
        </span>
      </div>

      {/* Transcript */}
      <div ref={transcriptContainerRef} className="max-h-16 overflow-y-auto -mt-1">
        {!hasTranscript && (
          <p className="text-xs text-gray-400">
            Say &ldquo;45 seconds 90 grams&rdquo;, &ldquo;stage 1 end time 90&rdquo;, &ldquo;go back&rdquo;, or &ldquo;done&rdquo;
          </p>
        )}
        <div className="space-y-0.5">
          {transcriptEntries.map((entry) => (
            <p key={entry.id} className={`text-sm ${
              entry.recognized ? 'text-gray-700' : 'text-gray-400'
            }`}>
              {entry.text}
              {entry.command && (
                <span className="ml-1.5 text-gray-500">&ensp;&rarr; {entry.command}</span>
              )}
            </p>
          ))}
          {interimTranscript && (
            <p className="text-sm text-gray-400 italic">{interimTranscript}</p>
          )}
        </div>
      </div>

      {/* Stage rows */}
      <div className="space-y-3">
        {stages.map((stage, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setActiveStageIndex(index)}
            className={`flex items-start gap-3 w-full text-left cursor-pointer bg-transparent border-0 p-0 outline-none`}
          >
            <div className={`text-sm whitespace-nowrap w-16 flex-shrink-0 ${index === activeStageIndex ? 'text-gray-900 font-medium' : 'text-gray-700'} ${index === 0 ? 'pt-8' : 'pt-2'}`}>
              Stage {index + 1}
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div>
                {index === 0 && (
                  <Label className="text-sm text-gray-900 font-normal" style={{ marginBottom: 'calc(var(--spacing))' }}>
                    End Time
                  </Label>
                )}
                <StageValue
                  value={stage.endTime ? formatTime(parseFloat(stage.endTime)) : '—'}
                  filled={!!stage.endTime}
                  flashing={flashingField?.stageIndex === index && flashingField.field === 'time'}
                />
              </div>
              <div>
                {index === 0 && (
                  <Label className="text-sm text-gray-900 font-normal whitespace-nowrap" style={{ marginBottom: 'calc(var(--spacing))' }}>
                    End Weight (g)
                  </Label>
                )}
                <StageValue
                  value={stage.endWeight ? stage.endWeight : '—'}
                  filled={!!stage.endWeight}
                  flashing={flashingField?.stageIndex === index && flashingField.field === 'weight'}
                />
              </div>
            </div>
            <div className="h-9 w-9 flex-shrink-0" />
          </button>
        ))}
      </div>

    </div>
  );
}

function StageValue({ value, filled, flashing }: {
  value: string;
  filled: boolean;
  flashing?: boolean;
}) {
  return (
    <div
      className={`h-9 flex items-center px-3 rounded-md border border-input bg-input-background text-sm ${flashing ? 'voice-value-flash' : ''}`}
    >
      <span className={filled ? 'text-gray-900' : 'text-muted-foreground'}>
        {value}
      </span>
    </div>
  );
}

function commandLabel(command: VoiceCommand): string {
  switch (command.type) {
    case 'setTime': return `Time: ${formatTime(command.seconds)}`;
    case 'setWeight': return `Weight: ${command.grams}g`;
    case 'setTimeAndWeight': return `${formatTime(command.seconds)}, ${command.grams}g`;
    case 'nextStage': return 'Next stage';
    case 'previousStage': return 'Previous stage';
    case 'goToStage': return `Stage ${command.stageIndex + 1}`;
    case 'addStage': return command.count > 1 ? `Added ${command.count} stages` : 'Added stage';
    case 'deleteStage': return command.stageIndex !== undefined ? `Deleted stage ${command.stageIndex + 1}` : 'Deleted stage';
    case 'clearTime': return 'Cleared time';
    case 'clearWeight': return 'Cleared weight';
    case 'done': return 'Done';
  }
}
