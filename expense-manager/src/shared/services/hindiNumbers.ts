/**
 * Converts spoken Hindi / Hinglish number words into digits.
 *
 * Speech recognition returns numbers inconsistently: the `en-IN` engine usually
 * emits numerals ("450"), while `hi-IN` often emits words ("चार सौ पचास" /
 * "paanch sau"). This module normalises the word form so the voice parser only
 * ever deals with numbers.
 *
 * Pure and dependency-free — safe to unit test in isolation.
 */

/** Devanagari digits ०-९ → ASCII 0-9. */
const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

/**
 * Units and tens. Hindi numerals below 100 are highly irregular (every value
 * has its own word), so we cover 0-20, the round tens, and the handful of
 * compound values people actually say out loud for money. Anything rarer
 * arrives as numerals from the recogniser anyway.
 */
const WORD_VALUES: Record<string, number> = {
  // 0-10
  'शून्य': 0, 'zero': 0, 'shunya': 0,
  'एक': 1, 'ek': 1, 'one': 1,
  'दो': 2, 'do': 2, 'two': 2,
  'तीन': 3, 'teen': 3, 'tin': 3, 'three': 3,
  'चार': 4, 'char': 4, 'chaar': 4, 'four': 4,
  'पांच': 5, 'पाँच': 5, 'panch': 5, 'paanch': 5, 'five': 5,
  'छह': 6, 'छः': 6, 'chhe': 6, 'chah': 6, 'che': 6, 'six': 6,
  'सात': 7, 'saat': 7, 'sat': 7, 'seven': 7,
  'आठ': 8, 'aath': 8, 'ath': 8, 'eight': 8,
  'नौ': 9, 'nau': 9, 'nine': 9,
  'दस': 10, 'das': 10, 'dus': 10, 'ten': 10,
  // 11-20
  'ग्यारह': 11, 'gyarah': 11, 'eleven': 11,
  'बारह': 12, 'barah': 12, 'twelve': 12,
  'तेरह': 13, 'terah': 13, 'thirteen': 13,
  'चौदह': 14, 'chaudah': 14, 'fourteen': 14,
  'पंद्रह': 15, 'pandrah': 15, 'fifteen': 15,
  'सोलह': 16, 'solah': 16, 'sixteen': 16,
  'सत्रह': 17, 'satrah': 17, 'seventeen': 17,
  'अठारह': 18, 'atharah': 18, 'eighteen': 18,
  'उन्नीस': 19, 'unnis': 19, 'nineteen': 19,
  'बीस': 20, 'bees': 20, 'bis': 20, 'twenty': 20,
  // Common compound values people say for money
  'पच्चीस': 25, 'pachhees': 25, 'pachees': 25,
  'तीस': 30, 'tees': 30, 'this': 30, 'thirty': 30,
  'पैंतीस': 35, 'paintees': 35,
  'चालीस': 40, 'chalis': 40, 'chaalis': 40, 'forty': 40,
  'पैंतालीस': 45, 'paintalis': 45,
  'पचास': 50, 'pachas': 50, 'pachaas': 50, 'fifty': 50,
  'पचपन': 55, 'pachpan': 55,
  'साठ': 60, 'sath': 60, 'saath': 60, 'sixty': 60,
  'पैंसठ': 65, 'painsath': 65,
  'सत्तर': 70, 'sattar': 70, 'seventy': 70,
  'पचहत्तर': 75, 'pachhattar': 75,
  'अस्सी': 80, 'assi': 80, 'eighty': 80,
  'पचासी': 85, 'pachasi': 85,
  'नब्बे': 90, 'nabbe': 90, 'ninety': 90,
  'निन्यानवे': 99, 'ninyanve': 99,
};

/** Multipliers that scale the number built up so far. */
const MULTIPLIERS: Record<string, number> = {
  'सौ': 100, 'sau': 100, 'hundred': 100,
  'हज़ार': 1000, 'हजार': 1000, 'hazaar': 1000, 'hazar': 1000, 'hajar': 1000,
  'thousand': 1000, 'k': 1000,
  'लाख': 100000, 'lakh': 100000, 'lac': 100000, 'lakhs': 100000,
  'करोड़': 10000000, 'करोड': 10000000, 'crore': 10000000, 'cr': 10000000,
  'million': 1000000, 'billion': 1000000000,
};

/**
 * Fractional quantifiers. Hindi has dedicated words for 1.25/1.5/2.5 and a
 * prefix (`saade`) meaning "+ a half", so "saade teen sau" is 350.
 */
const STANDALONE_FRACTIONS: Record<string, number> = {
  'डेढ़': 1.5, 'डेढ': 1.5, 'dedh': 1.5, 'derh': 1.5,
  'ढाई': 2.5, 'dhai': 2.5, 'dhaai': 2.5,
  'सवा': 1.25, 'sawa': 1.25, 'sava': 1.25,
  'आधा': 0.5, 'aadha': 0.5, 'adha': 0.5, 'half': 0.5,
};

/** Prefix modifiers that adjust the number immediately after them. */
const PREFIX_MODIFIERS: Record<string, number> = {
  'साढ़े': 0.5, 'साढे': 0.5, 'sade': 0.5, 'saade': 0.5, // "+ a half"
  'पौने': -0.25, 'paune': -0.25,                        // "less a quarter"
};

/** Filler words that may appear between number words without changing value. */
const NUMBER_FILLERS = new Set(['और', 'aur', 'and']);

/** Replaces Devanagari digits with ASCII so downstream regexes work. */
export function normalizeDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d);
}

/** True when the token contributes to a spoken number. */
export function isNumberWord(token: string): boolean {
  const t = token.toLowerCase();
  return (
    t in WORD_VALUES ||
    t in MULTIPLIERS ||
    t in STANDALONE_FRACTIONS ||
    t in PREFIX_MODIFIERS
  );
}

/**
 * Evaluates a run of number tokens into a single value.
 *
 * Uses the standard accumulator approach: small values build up `current`,
 * `sau` scales `current` in place, and the larger scales (`hazaar`, `lakh`,
 * `crore`) flush `current` into `total` so "do lakh paanch hazaar" = 205000.
 *
 * Returns null when the tokens carry no numeric value.
 */
export function evaluateNumberWords(tokens: string[]): number | null {
  let total = 0;
  let current = 0;
  let seenValue = false;
  let pendingModifier: number | null = null;

  const applyModifier = (value: number): number => {
    if (pendingModifier === null) return value;
    const adjusted = value + pendingModifier;
    pendingModifier = null;
    return adjusted;
  };

  for (const raw of tokens) {
    const token = raw.toLowerCase();
    if (NUMBER_FILLERS.has(token)) continue;

    if (token in PREFIX_MODIFIERS) {
      pendingModifier = PREFIX_MODIFIERS[token];
      continue;
    }

    if (token in STANDALONE_FRACTIONS) {
      current += STANDALONE_FRACTIONS[token];
      seenValue = true;
      continue;
    }

    if (token in WORD_VALUES) {
      current += applyModifier(WORD_VALUES[token]);
      seenValue = true;
      continue;
    }

    if (/^\d+(?:\.\d+)?$/.test(token)) {
      current += applyModifier(parseFloat(token));
      seenValue = true;
      continue;
    }

    if (token in MULTIPLIERS) {
      const mult = MULTIPLIERS[token];
      // A bare multiplier means one of it: "sau rupaye" = 100.
      const base = current === 0 ? applyModifier(1) : current;
      if (mult >= 1000) {
        total += base * mult;
        current = 0;
      } else {
        current = base * mult;
      }
      seenValue = true;
      continue;
    }

    // Unknown token — the number run has ended.
    break;
  }

  if (!seenValue) return null;
  const result = total + current;
  return Number.isFinite(result) ? result : null;
}

/**
 * Finds the first spoken number in free text and returns its value plus the
 * span it occupied, so the caller can strip it out of the note.
 */
export function extractNumber(
  text: string,
): { value: number; startIndex: number; endIndex: number } | null {
  const normalized = normalizeDigits(text);
  // Keep Devanagari letters alongside ASCII so Hindi words survive tokenising.
  // Include \p{M} (combining marks): Devanagari vowel signs and the nukta are
  // Marks, not Letters, so omitting them splits "पाँच" into "पा" and "च".
  const tokenRegex = /[\p{L}\p{N}][\p{L}\p{N}\p{M}.,]*/gu;
  const tokens: { text: string; start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(normalized)) !== null) {
    tokens.push({
      // Strip grouping commas ("1,250") and trailing punctuation.
      text: match[0].replace(/,(?=\d{2,3}\b)/g, '').replace(/[.,]+$/, ''),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  for (let i = 0; i < tokens.length; i++) {
    const isNumeric = /^\d+(?:\.\d+)?$/.test(tokens[i].text);
    if (!isNumeric && !isNumberWord(tokens[i].text)) continue;

    // Greedily consume the whole number run.
    let end = i;
    while (
      end + 1 < tokens.length &&
      (isNumberWord(tokens[end + 1].text) ||
        /^\d+(?:\.\d+)?$/.test(tokens[end + 1].text) ||
        NUMBER_FILLERS.has(tokens[end + 1].text.toLowerCase()))
    ) {
      // Don't let a trailing filler ("and") swallow the next clause unless a
      // real number follows it.
      if (NUMBER_FILLERS.has(tokens[end + 1].text.toLowerCase())) {
        const after = tokens[end + 2];
        if (!after || !(isNumberWord(after.text) || /^\d+(?:\.\d+)?$/.test(after.text))) break;
      }
      end++;
    }

    const value = evaluateNumberWords(tokens.slice(i, end + 1).map((t) => t.text));
    if (value !== null) {
      return { value, startIndex: tokens[i].start, endIndex: tokens[end].end };
    }
  }

  return null;
}

/** Convenience wrapper: value only. */
export function parseSpokenNumber(text: string): number | null {
  return extractNumber(text)?.value ?? null;
}
