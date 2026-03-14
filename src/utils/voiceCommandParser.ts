export type VoiceCommand =
  | { type: 'setTime'; seconds: number; stageIndex?: number }
  | { type: 'setWeight'; grams: number; stageIndex?: number }
  | { type: 'setTimeAndWeight'; seconds: number; grams: number; stageIndex?: number }
  | { type: 'nextStage' }
  | { type: 'previousStage' }
  | { type: 'goToStage'; stageIndex: number }
  | { type: 'addStage'; count: number }
  | { type: 'deleteStage'; stageIndex?: number }
  | { type: 'clearTime' }
  | { type: 'clearWeight' }
  | { type: 'done' };

const WORD_TO_NUMBER: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

const MULTIPLIER_WORDS: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
};

function wordsToNumber(words: string[]): number | null {
  if (words.length === 0) return null;

  if (words.length === 1) {
    const n = parseFloat(words[0]);
    if (!isNaN(n)) return n;
  }

  let total = 0;
  let current = 0;
  let hasAny = false;

  for (const word of words) {
    const val = WORD_TO_NUMBER[word];
    const mult = MULTIPLIER_WORDS[word];

    if (val !== undefined) {
      current += val;
      hasAny = true;
    } else if (mult !== undefined) {
      current = (current || 1) * mult;
      hasAny = true;
    } else {
      const n = parseFloat(word);
      if (!isNaN(n)) {
        current += n;
        hasAny = true;
      } else {
        break;
      }
    }
  }

  if (!hasAny) return null;
  total += current;
  return total;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function isNumberToken(token: string): boolean {
  return (
    WORD_TO_NUMBER[token] !== undefined ||
    MULTIPLIER_WORDS[token] !== undefined ||
    !isNaN(parseFloat(token))
  );
}

function collectNumber(tokens: string[], startIdx: number): { value: number; consumed: number } | null {
  const numTokens: string[] = [];
  let i = startIdx;
  while (i < tokens.length && isNumberToken(tokens[i])) {
    numTokens.push(tokens[i]);
    // If this token is a raw digit (not a word-number like "twenty"), stop
    // after consuming it so "1" "32" aren't summed into 33.
    if (WORD_TO_NUMBER[tokens[i]] === undefined && MULTIPLIER_WORDS[tokens[i]] === undefined) {
      i++;
      break;
    }
    i++;
  }
  if (numTokens.length === 0) return null;
  const value = wordsToNumber(numTokens);
  if (value === null) return null;
  return { value, consumed: numTokens.length };
}

const TIME_UNITS: Record<string, number> = {
  second: 1, seconds: 1, sec: 1, secs: 1, s: 1,
  minute: 60, minutes: 60, min: 60, mins: 60, m: 60,
};

const WEIGHT_UNITS = new Set([
  'gram', 'grams', 'g',
]);

interface ParsedTime {
  seconds: number;
  endIndex: number;
}

function tryParseTime(tokens: string[], startIdx: number): ParsedTime | null {
  const num = collectNumber(tokens, startIdx);
  if (!num) return null;

  const unitIdx = startIdx + num.consumed;
  if (unitIdx >= tokens.length) return null;

  const unitToken = tokens[unitIdx];
  const multiplier = TIME_UNITS[unitToken];
  if (multiplier === undefined) return null;

  let totalSeconds = num.value * multiplier;
  let endIndex = unitIdx + 1;

  if (multiplier === 60 && endIndex < tokens.length) {
    const secondNum = collectNumber(tokens, endIndex);
    if (secondNum) {
      const secondUnitIdx = endIndex + secondNum.consumed;
      if (secondUnitIdx < tokens.length && TIME_UNITS[tokens[secondUnitIdx]] === 1) {
        totalSeconds += secondNum.value;
        endIndex = secondUnitIdx + 1;
      } else {
        totalSeconds += secondNum.value;
        endIndex = endIndex + secondNum.consumed;
      }
    }
  }

  return { seconds: totalSeconds, endIndex };
}

interface ParsedWeight {
  grams: number;
  endIndex: number;
}

/**
 * Concatenate consecutive raw digit tokens into a single number string.
 * Unlike collectNumber, this joins "1" + "30" as "130" (not 1+30=31).
 * Used for bare numbers after context phrases like "end time 132" or "end wait 1:30".
 */
function collectDigitString(tokens: string[], startIdx: number): { value: number; endIndex: number } | null {
  let str = '';
  let i = startIdx;
  while (i < tokens.length && /^\d+\.?\d*$/.test(tokens[i])) {
    str += tokens[i];
    i++;
  }
  if (!str) return null;
  const value = parseFloat(str);
  if (isNaN(value)) return null;
  return { value, endIndex: i };
}

/**
 * Interpret a bare number as a time value.
 * Numbers >= 100 are treated as M:SS (e.g. 132 → 1:32 → 92 seconds).
 * Numbers < 100 are treated as plain seconds.
 */
function interpretBareTime(num: number): number {
  if (Number.isInteger(num) && num >= 100) {
    const minutes = Math.floor(num / 100);
    const seconds = num % 100;
    if (seconds < 60) return minutes * 60 + seconds;
  }
  return num;
}

function tryParseWeight(tokens: string[], startIdx: number): ParsedWeight | null {
  const num = collectNumber(tokens, startIdx);
  if (!num) return null;

  const unitIdx = startIdx + num.consumed;
  if (unitIdx >= tokens.length) return null;

  if (!WEIGHT_UNITS.has(tokens[unitIdx])) return null;

  return { grams: num.value, endIndex: unitIdx + 1 };
}

function matchesPhrase(tokens: string[], startIdx: number, phrases: string[][]): { matched: string[][]; endIndex: number } | null {
  for (const phrase of phrases) {
    let match = true;
    for (let j = 0; j < phrase.length; j++) {
      if (startIdx + j >= tokens.length || tokens[startIdx + j] !== phrase[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return { matched: [phrase], endIndex: startIdx + phrase.length };
    }
  }
  return null;
}

const NEXT_PHRASES = [['next', 'stage'], ['next']];
const PREV_PHRASES = [['previous', 'stage'], ['go', 'back'], ['previous']];
const ADD_STAGE_VERBS = [['add'], ['create'], ['new']];
const STAGE_WORDS = new Set(['stage', 'stages']);
const DELETE_STAGE_PHRASES = [['delete', 'stage'], ['remove', 'stage'], ['clear', 'stage'], ['reset', 'stage']];
const CLEAR_TIME_PHRASES = [['clear', 'time']];
const CLEAR_WEIGHT_PHRASES = [['clear', 'weight']];
const DONE_PHRASES = [['done'], ['save'], ['finish']];

const ORDINAL_TO_NUM: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

/**
 * Extract a "stage N" reference from the tokens, returning the
 * stage index (0-based) and the token range it occupied.
 */
function extractStageReference(tokens: string[]): { stageIndex: number; startIdx: number; endIdx: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'stage' && i + 1 < tokens.length) {
      const next = tokens[i + 1];
      const ordinal = ORDINAL_TO_NUM[next];
      if (ordinal !== undefined) {
        return { stageIndex: ordinal - 1, startIdx: i, endIdx: i + 2 };
      }
      const num = collectNumber(tokens, i + 1);
      if (num && num.value >= 1) {
        return { stageIndex: Math.round(num.value) - 1, startIdx: i, endIdx: i + 1 + num.consumed };
      }
    }
  }
  return null;
}

/**
 * Parse a voice transcript into a structured command.
 * Returns null if no recognized coffee-related command is found.
 *
 * Supports compound utterances like "stage 2 1 minute 30 seconds 200 grams"
 * which navigates to stage 2 AND sets both time and weight.
 */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return null;

  // Check simple control commands first (no parameters)
  for (let i = 0; i < tokens.length; i++) {
    if (matchesPhrase(tokens, i, DONE_PHRASES)) return { type: 'done' };
    if (matchesPhrase(tokens, i, CLEAR_TIME_PHRASES)) return { type: 'clearTime' };
    if (matchesPhrase(tokens, i, CLEAR_WEIGHT_PHRASES)) return { type: 'clearWeight' };
    if (matchesPhrase(tokens, i, NEXT_PHRASES)) return { type: 'nextStage' };
    if (matchesPhrase(tokens, i, PREV_PHRASES)) return { type: 'previousStage' };
    // "add/create/new [N] stage(s)" or "add/create a stage"
    const addVerbMatch = matchesPhrase(tokens, i, ADD_STAGE_VERBS);
    if (addVerbMatch) {
      let cursor = addVerbMatch.endIndex;
      // skip filler word "a"
      if (cursor < tokens.length && tokens[cursor] === 'a') cursor++;
      // try to collect a count
      let count = 1;
      const numResult = collectNumber(tokens, cursor);
      if (numResult) {
        count = Math.max(1, Math.round(numResult.value));
        cursor += numResult.consumed;
      }
      // must end with a stage word
      if (cursor < tokens.length && STAGE_WORDS.has(tokens[cursor])) {
        return { type: 'addStage', count };
      }
    }

    // "delete/remove/clear/reset stage" optionally followed by a number
    const deleteMatch = matchesPhrase(tokens, i, DELETE_STAGE_PHRASES);
    if (deleteMatch) {
      const afterPhrase = deleteMatch.endIndex;
      if (afterPhrase < tokens.length) {
        const ordinal = ORDINAL_TO_NUM[tokens[afterPhrase]];
        if (ordinal !== undefined) return { type: 'deleteStage', stageIndex: ordinal - 1 };
        const num = collectNumber(tokens, afterPhrase);
        if (num && num.value >= 1) return { type: 'deleteStage', stageIndex: Math.round(num.value) - 1 };
      }
      return { type: 'deleteStage' };
    }
  }

  // Extract optional "stage N" reference
  const stageRef = extractStageReference(tokens);

  // Remove stage reference tokens so they don't interfere with number parsing
  const scanTokens = stageRef
    ? [...tokens.slice(0, stageRef.startIdx), ...tokens.slice(stageRef.endIdx)]
    : tokens;

  // Scan for time and weight parameters
  let parsedTime: number | null = null;
  let parsedWeight: number | null = null;

  let i = 0;
  while (i < scanTokens.length) {
    if (parsedTime === null) {
      const timeResult = tryParseTime(scanTokens, i);
      if (timeResult) {
        parsedTime = timeResult.seconds;
        i = timeResult.endIndex;
        continue;
      }
    }

    if (parsedWeight === null) {
      const weightResult = tryParseWeight(scanTokens, i);
      if (weightResult) {
        parsedWeight = weightResult.grams;
        i = weightResult.endIndex;
        continue;
      }
    }

    i++;
  }

  // Fallback: bare numbers after context phrases like "end time 132" or "end/and wait 1:30".
  // Only applies to numbers NOT already followed by a unit (those are handled by the first pass).
  if (parsedTime === null || parsedWeight === null) {
    const END_WORDS = new Set(['end', 'and']);
    const WEIGHT_WORDS = new Set(['weight', 'wait', 'wade', 'weigh']);
    const hasUnit = (idx: number) =>
      idx < scanTokens.length && (TIME_UNITS[scanTokens[idx]] !== undefined || WEIGHT_UNITS.has(scanTokens[idx]));

    for (let j = 0; j < scanTokens.length; j++) {
      const isEndPrefix = END_WORDS.has(scanTokens[j]) && j + 1 < scanTokens.length;
      if (parsedTime === null) {
        const isTimeCtx = scanTokens[j] === 'time' || (isEndPrefix && scanTokens[j + 1] === 'time');
        if (isTimeCtx) {
          const numStart = isEndPrefix ? j + 2 : j + 1;
          const digits = collectDigitString(scanTokens, numStart);
          if (digits && !hasUnit(digits.endIndex)) {
            parsedTime = interpretBareTime(digits.value);
          } else if (!digits) {
            const num = collectNumber(scanTokens, numStart);
            if (num && !hasUnit(numStart + num.consumed)) parsedTime = interpretBareTime(num.value);
          }
        }
      }
      if (parsedWeight === null) {
        const isWeightCtx = WEIGHT_WORDS.has(scanTokens[j]) ||
          (isEndPrefix && WEIGHT_WORDS.has(scanTokens[j + 1]));
        if (isWeightCtx) {
          const numStart = isEndPrefix ? j + 2 : j + 1;
          const digits = collectDigitString(scanTokens, numStart);
          if (digits && !hasUnit(digits.endIndex)) {
            parsedWeight = digits.value;
          } else if (!digits) {
            const num = collectNumber(scanTokens, numStart);
            if (num && !hasUnit(numStart + num.consumed)) parsedWeight = num.value;
          }
        }
      }
    }
  }

  const targetStage = stageRef?.stageIndex;

  if (parsedTime !== null && parsedWeight !== null) {
    return { type: 'setTimeAndWeight', seconds: parsedTime, grams: parsedWeight, stageIndex: targetStage };
  }
  if (parsedTime !== null) {
    return { type: 'setTime', seconds: parsedTime, stageIndex: targetStage };
  }
  if (parsedWeight !== null) {
    return { type: 'setWeight', grams: parsedWeight, stageIndex: targetStage };
  }

  // Stage reference with no data → just navigate
  if (stageRef) {
    return { type: 'goToStage', stageIndex: stageRef.stageIndex };
  }

  return null;
}
