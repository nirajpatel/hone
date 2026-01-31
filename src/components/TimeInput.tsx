import { useRef, useState, useEffect } from 'react';
import { Input } from './ui/input';

interface TimeInputProps {
  value: string; // Value in seconds (e.g., "90" for 1m 30s)
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onComplete?: () => void; // Callback when all fields are filled
}

export function TimeInput({ value, onChange, placeholder = '0m 00s', disabled = false, onComplete }: TimeInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const secondsFirstRef = useRef<HTMLInputElement>(null);
  const secondsSecondRef = useRef<HTMLInputElement>(null);
  
  // Track if the component is focused
  const [isComponentFocused, setIsComponentFocused] = useState(false);
  
  // Parse seconds into minutes and seconds
  const totalSeconds = parseFloat(value) || 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  const [minutesValue, setMinutesValue] = useState(minutes > 0 ? minutes.toString() : '');
  const [secondsFirstValue, setSecondsFirstValue] = useState(seconds > 0 ? Math.floor(seconds / 10).toString() : '');
  const [secondsSecondValue, setSecondsSecondValue] = useState(seconds > 0 ? (seconds % 10).toString() : '');
  
  // Update local state when value prop changes
  useEffect(() => {
    const totalSeconds = parseFloat(value) || 0;
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    setMinutesValue(mins > 0 ? mins.toString() : '');
    setSecondsFirstValue(secs > 0 ? Math.floor(secs / 10).toString() : '');
    setSecondsSecondValue(secs > 0 ? (secs % 10).toString() : '');
  }, [value]);
  
  const updateTotalTime = (mins: string, secFirst: string, secSecond: string) => {
    const m = parseInt(mins) || 0;
    const s1 = parseInt(secFirst) || 0;
    const s2 = parseInt(secSecond) || 0;
    const totalSecs = s1 * 10 + s2;
    const total = m * 60 + totalSecs;
    onChange(total.toString());
  };
  
  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    
    // Limit to single digit (0-9)
    if (val.length > 1) {
      val = val.slice(-1); // Take last character
    }
    
    setMinutesValue(val);
    updateTotalTime(val, secondsFirstValue, secondsSecondValue);
    
    // Auto-advance to first seconds digit
    if (val.length === 1) {
      secondsFirstRef.current?.focus();
      secondsFirstRef.current?.select();
    }
  };
  
  const handleSecondsFirstChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    
    // Limit to single digit (0-5 for first digit of seconds)
    if (val.length > 1) {
      val = val.slice(-1);
    }
    
    // First digit of seconds can only be 0-5
    if (parseInt(val) > 5) {
      val = '5';
    }
    
    setSecondsFirstValue(val);
    updateTotalTime(minutesValue, val, secondsSecondValue);
    
    // Auto-advance to second seconds digit
    if (val.length === 1) {
      secondsSecondRef.current?.focus();
      secondsSecondRef.current?.select();
    }
  };
  
  const handleSecondsSecondChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    
    // If there are multiple digits, take only the last one (the newly typed digit)
    if (val.length > 1) {
      val = val.slice(-1);
    }
    
    setSecondsSecondValue(val);
    updateTotalTime(minutesValue, secondsFirstValue, val);
    
    // If a value was entered and this is the last field, trigger onComplete
    // Check if all fields will have values after this update
    if (val !== '' && minutesValue !== '' && secondsFirstValue !== '' && onComplete) {
      onComplete();
    }
  };
  
  const handleMinutesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      secondsFirstRef.current?.focus();
      secondsFirstRef.current?.select();
    } else if (e.key === 'Backspace' && !minutesValue) {
      e.preventDefault();
    } else if (e.key >= '0' && e.key <= '9') {
      // Clear existing value when typing a new digit
      setMinutesValue('');
    }
  };
  
  const handleSecondsFirstKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      secondsSecondRef.current?.focus();
      secondsSecondRef.current?.select();
    } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      minutesRef.current?.focus();
      minutesRef.current?.select();
    } else if (e.key === 'Backspace' && !secondsFirstValue) {
      e.preventDefault();
      minutesRef.current?.focus();
      minutesRef.current?.select();
    } else if (e.key >= '0' && e.key <= '9') {
      // Clear existing value when typing a new digit
      setSecondsFirstValue('');
    }
  };
  
  const handleSecondsSecondKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      secondsFirstRef.current?.focus();
      secondsFirstRef.current?.select();
    } else if (e.key === 'Backspace' && !secondsSecondValue) {
      e.preventDefault();
      secondsFirstRef.current?.focus();
      secondsFirstRef.current?.select();
    } else if (e.key >= '0' && e.key <= '9') {
      // Clear existing value when typing a new digit
      setSecondsSecondValue('');
    }
  };
  
  return (
    <div
      ref={containerRef}
      className={`relative flex items-center h-9 px-3 rounded-md border bg-input-background cursor-text transition-[color,box-shadow] outline-none ${
        isComponentFocused ? 'border-ring ring-ring/50 ring-[3px]' : 'border-input'
      }`}
      style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
      onClick={(e) => {
        // If clicking the container itself (not an input), focus the leftmost digit (minutes)
        if (!isComponentFocused && e.target === containerRef.current) {
          minutesRef.current?.focus();
          minutesRef.current?.select();
        }
      }}
    >
      <input
        ref={minutesRef}
        type="text"
        inputMode="numeric"
        value={minutesValue}
        onChange={handleMinutesChange}
        onKeyDown={handleMinutesKeyDown}
        onFocus={() => {
          setIsComponentFocused(true);
          minutesRef.current?.select();
        }}
        onBlur={() => {
          // Small delay to check if focus moved to another input within the component
          setTimeout(() => {
            const activeElement = document.activeElement;
            if (
              activeElement !== minutesRef.current &&
              activeElement !== secondsFirstRef.current &&
              activeElement !== secondsSecondRef.current
            ) {
              setIsComponentFocused(false);
            }
          }, 0);
        }}
        placeholder="0"
        disabled={disabled}
        maxLength={1}
        className="w-3 border-none outline-none bg-transparent text-sm py-0.5 cursor-pointer focus:ring-0 focus:bg-blue-200 rounded text-center"
        style={{ caretColor: 'transparent' }}
      />
      <span className="text-sm text-muted-foreground">m</span>
      
      <input
        ref={secondsFirstRef}
        type="text"
        inputMode="numeric"
        value={secondsFirstValue}
        onChange={handleSecondsFirstChange}
        onKeyDown={handleSecondsFirstKeyDown}
        onMouseDown={(e) => {
          // If component wasn't focused, redirect to minutes
          if (!isComponentFocused) {
            e.preventDefault();
            minutesRef.current?.focus();
            minutesRef.current?.select();
          }
        }}
        onFocus={() => {
          setIsComponentFocused(true);
          secondsFirstRef.current?.select();
        }}
        onBlur={() => {
          setTimeout(() => {
            const activeElement = document.activeElement;
            if (
              activeElement !== minutesRef.current &&
              activeElement !== secondsFirstRef.current &&
              activeElement !== secondsSecondRef.current
            ) {
              setIsComponentFocused(false);
            }
          }, 0);
        }}
        placeholder="0"
        disabled={disabled}
        maxLength={1}
        className="w-3 border-none outline-none bg-transparent text-sm py-0.5 ml-0.5 cursor-pointer focus:ring-0 focus:bg-blue-200 rounded text-center"
        style={{ caretColor: 'transparent' }}
      />
      <input
        ref={secondsSecondRef}
        type="text"
        inputMode="numeric"
        value={secondsSecondValue}
        onChange={handleSecondsSecondChange}
        onKeyDown={handleSecondsSecondKeyDown}
        onMouseDown={(e) => {
          // If component wasn't focused, redirect to minutes
          if (!isComponentFocused) {
            e.preventDefault();
            minutesRef.current?.focus();
            minutesRef.current?.select();
          }
        }}
        onFocus={() => {
          setIsComponentFocused(true);
          secondsSecondRef.current?.select();
        }}
        onBlur={() => {
          setTimeout(() => {
            const activeElement = document.activeElement;
            if (
              activeElement !== minutesRef.current &&
              activeElement !== secondsFirstRef.current &&
              activeElement !== secondsSecondRef.current
            ) {
              setIsComponentFocused(false);
            }
          }, 0);
        }}
        placeholder="0"
        disabled={disabled}
        maxLength={1}
        className="w-3 border-none outline-none bg-transparent text-sm py-0.5 cursor-pointer focus:ring-0 focus:bg-blue-200 rounded text-center"
        style={{ caretColor: 'transparent', marginLeft: 'calc(var(--spacing) * -0.75)' }}
      />
      <span className="text-sm text-muted-foreground">s</span>
    </div>
  );
}

// Helper function to format seconds as "Xm Ys" for display in brew stages (no space)
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (mins > 0 && secs > 0) {
    return `${mins}m${secs}s`;
  } else if (mins > 0) {
    return `${mins}m`;
  } else if (secs > 0) {
    return `${secs}s`;
  } else {
    return '0s';
  }
}

// Helper function to format seconds for extraction time display (spelled out with proper pluralization)
export function formatExtractionTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (mins > 0 && secs > 0) {
    const minuteText = mins === 1 ? 'minute' : 'minutes';
    const secondText = secs === 1 ? 'second' : 'seconds';
    return `${mins} ${minuteText} ${secs} ${secondText}`;
  } else if (mins > 0) {
    const minuteText = mins === 1 ? 'minute' : 'minutes';
    return `${mins} ${minuteText}`;
  } else {
    const secondText = secs === 1 ? 'second' : 'seconds';
    return `${secs} ${secondText}`;
  }
}