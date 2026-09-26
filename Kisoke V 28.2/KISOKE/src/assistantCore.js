export const ARABIC_DIALECTS = {
  auto: { label: 'Auto / تلقائي', locale: 'ar-AE', prompt: 'Detect the user’s Arabic dialect and mirror it naturally. Use Modern Standard Arabic when uncertain.' },
  uae: { label: 'UAE / إماراتي', locale: 'ar-AE', prompt: 'Use natural, respectful Emirati Arabic. Avoid caricature, forced slang, and mixing unrelated Gulf dialects.' },
  egyptian: { label: 'Egyptian / مصري', locale: 'ar-EG', prompt: 'Use natural Egyptian Arabic (اللهجة المصرية) while keeping technical terms clear.' },
  syrian: { label: 'Syrian / سوري', locale: 'ar-SY', prompt: 'Use natural Syrian Arabic (اللهجة السورية) while keeping technical terms clear.' },
  lebanese: { label: 'Lebanese / لبناني', locale: 'ar-LB', prompt: 'Use natural Lebanese Arabic (اللهجة اللبنانية) while keeping technical terms clear.' },
  saudi: { label: 'Saudi / سعودي', locale: 'ar-SA', prompt: 'Use natural Saudi Arabic, choosing broadly understood wording unless the user uses a regional variety.' },
  omani: { label: 'Omani / عُماني', locale: 'ar-OM', prompt: 'Use natural, respectful Omani Arabic while keeping technical terms clear.' },
  kuwaiti: { label: 'Kuwaiti / كويتي', locale: 'ar-KW', prompt: 'Use natural Kuwaiti Arabic while keeping technical terms clear.' },
  qatari: { label: 'Qatari / قطري', locale: 'ar-QA', prompt: 'Use natural Qatari Arabic while keeping technical terms clear.' },
  msa: { label: 'Modern Standard / فصحى', locale: 'ar-SA', prompt: 'Use clear Modern Standard Arabic.' }
};

const ARABIC_DIGITS = new Map([
  ['٠', '0'], ['١', '1'], ['٢', '2'], ['٣', '3'], ['٤', '4'],
  ['٥', '5'], ['٦', '6'], ['٧', '7'], ['٨', '8'], ['٩', '9'],
  ['۰', '0'], ['۱', '1'], ['۲', '2'], ['۳', '3'], ['۴', '4'],
  ['۵', '5'], ['۶', '6'], ['۷', '7'], ['۸', '8'], ['۹', '9']
]);

export function normalizeArabicDigits(value) {
  return String(value ?? '').replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS.get(digit) || digit);
}

function unicodeCharacter(hex) {
  const value = Number.parseInt(hex, 16);
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return '';
  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
}

/**
 * Repairs model/TTS output such as "backslash u0643" and literal "\\u0643".
 * The malformed spoken form is the exact issue visible in the supplied screenshot.
 */
export function decodeAssistantText(value) {
  let text = String(value ?? '');
  if (!text) return '';

  // Decode a run as one unit so speech-to-text spaces between uXXXX tokens do
  // not turn one Arabic word into disconnected letters.
  text = text.replace(/(?:(?:(?:slash\s+)?backslash\s*)?(?:u|U)\s*[0-9a-fA-F]{4}\s*){2,}/gi, (run) => {
    const characters = [...run.matchAll(/(?:u|U)\s*([0-9a-fA-F]{4})/g)];
    return characters.map((match) => unicodeCharacter(match[1])).join('');
  });

  text = text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/(?:slash\s+)?backslash\s*(?:u|U)\s*([0-9a-fA-F]{4,6})/gi, (_match, hex) => unicodeCharacter(hex))
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_match, hex) => unicodeCharacter(hex))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) => unicodeCharacter(hex));

  // Some speech engines say the first "backslash" once, then continue with uXXXX tokens.
  if (/[\u0600-\u06ff]/.test(text)) {
    text = text
      .replace(/(?:^|\s)u([0-9a-fA-F]{4})(?=\s|$)/g, (_match, hex) => unicodeCharacter(hex))
      .replace(/^\s*slash\s+/i, '')
      .replace(/\s*(?:backslash\s*)?u[0-9a-fA-F]{0,3}\s*$/i, '');
  }

  return text
    .replace(/\b(?:slash\s+)?backslash\b(?=\s*(?:u|U)\s*[0-9a-fA-F]{0,3}\b)/gi, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;!?،؛؟])/g, '$1')
    .trim();
}

export function containsArabic(value) {
  return /[\u0600-\u06ff]/.test(String(value || ''));
}

export function speechLocaleForSettings(settings = {}, text = '') {
  // Select the voice from the reply itself. The previous version used the
  // saved response preference, which made English responses sound Arabic in
  // bilingual/automatic mode and made Arabic-only mode feel unreliable.
  if (!containsArabic(text)) return settings.recognitionLanguage || 'en-US';
  const dialect = ARABIC_DIALECTS[settings.arabicDialect] || ARABIC_DIALECTS.auto;
  return dialect.locale;
}

export function assistantDialectInstruction(settings = {}, command = '') {
  const hasArabic = containsArabic(command);
  const preference = settings.replyLanguage || 'both';
  // "Arabic only" and "English only" are explicit choices. Automatic
  // detection is useful only while the bilingual option is selected.
  const mode = preference === 'both' && settings.autoLanguage
    ? (hasArabic ? 'ar' : 'en')
    : preference;
  const dialect = ARABIC_DIALECTS[settings.arabicDialect] || ARABIC_DIALECTS.auto;
  if (mode === 'en' && !hasArabic) return 'Reply in fluent, concise English.';
  if (mode === 'both') return `Reply first in the language used by the user, then add a concise translation. ${dialect.prompt}`;
  return `${dialect.prompt} Reply in Arabic script, not transliterated Arabic or escaped Unicode.`;
}

export function conversationContext(history = [], limit = 6) {
  const clean = Array.isArray(history) ? history.slice(-limit) : [];
  if (!clean.length) return 'No earlier conversation turns.';
  return clean.map((turn) => {
    const role = turn?.role === 'assistant' ? 'Assistant' : 'User';
    return `${role}: ${decodeAssistantText(turn?.text || '')}`;
  }).join('\n');
}

function normalizeMathWords(value) {
  return normalizeArabicDigits(value)
    .toLowerCase()
    .replace(/\bwhat(?:'s| is)\b|\bcalculate\b|\bcompute\b|\bsolve\b|\banswer\b|\bplease\b|\bاحسب\b|\bكم يساوي\b|\bما هو\b/g, ' ')
    .replace(/\bmultiplied by\b|\btimes\b|\bضرب\b/g, '*')
    .replace(/\bdivided by\b|\bover\b|\bقسمة\b/g, '/')
    .replace(/\bplus\b|\bجمع\b/g, '+')
    .replace(/\bminus\b|\bناقص\b/g, '-')
    .replace(/\bto the power of\b|\bpower\b/g, '^')
    .replace(/(\d+(?:\.\d+)?)\s*%\s*(?:of|من)\s*(\d+(?:\.\d+)?)/g, '( $1 / 100 ) * $2')
    .replace(/[=؟?]/g, ' ')
    .trim();
}

function tokenizeExpression(expression) {
  const compact = expression.replace(/\s+/g, '');
  if (!compact || compact.length > 120 || /[^0-9.+\-*/^()%]/.test(compact)) return null;
  const tokens = compact.match(/\d+(?:\.\d+)?|[()+\-*/^%]/g);
  if (!tokens || tokens.join('') !== compact) return null;
  return tokens;
}

function evaluateTokens(tokens) {
  const output = [];
  const operators = [];
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
  let previous = 'start';

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (/^\d/.test(token)) {
      output.push(Number(token));
      previous = 'number';
      continue;
    }
    if (token === '%') {
      if (previous !== 'number' && previous !== 'close') throw new Error('Invalid percent');
      output.push(100);
      output.push('/');
      previous = 'number';
      continue;
    }
    if (token === '(') {
      operators.push(token);
      previous = 'open';
      continue;
    }
    if (token === ')') {
      while (operators.length && operators.at(-1) !== '(') output.push(operators.pop());
      if (operators.pop() !== '(') throw new Error('Mismatched parentheses');
      previous = 'close';
      continue;
    }
    if (!(token in precedence)) throw new Error('Unknown operator');
    if (token === '-' && ['start', 'open', 'operator'].includes(previous)) output.push(0);
    while (operators.length && operators.at(-1) !== '(') {
      const top = operators.at(-1);
      const shouldPop = precedence[top] > precedence[token] || (precedence[top] === precedence[token] && token !== '^');
      if (!shouldPop) break;
      output.push(operators.pop());
    }
    operators.push(token);
    previous = 'operator';
  }
  while (operators.length) {
    const operator = operators.pop();
    if (operator === '(') throw new Error('Mismatched parentheses');
    output.push(operator);
  }

  const stack = [];
  output.forEach((token) => {
    if (typeof token === 'number') {
      stack.push(token);
      return;
    }
    const right = stack.pop();
    const left = stack.pop();
    if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error('Invalid expression');
    if (token === '+') stack.push(left + right);
    else if (token === '-') stack.push(left - right);
    else if (token === '*') stack.push(left * right);
    else if (token === '/') {
      if (right === 0) throw new Error('Division by zero');
      stack.push(left / right);
    } else if (token === '^') stack.push(left ** right);
  });
  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error('Invalid result');
  return stack[0];
}

function rounded(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

const UNIT_ALIASES = {
  c: 'c', celsius: 'c', '°c': 'c', f: 'f', fahrenheit: 'f', '°f': 'f',
  km: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km',
  mi: 'mi', mile: 'mi', miles: 'mi', m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  ft: 'ft', foot: 'ft', feet: 'ft', kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  gal: 'gal', gallon: 'gal', gallons: 'gal', cm: 'cm', centimeter: 'cm', centimeters: 'cm',
  in: 'in', inch: 'in', inches: 'in'
};

function convertUnit(value, from, to) {
  if (from === to) return value;
  const key = `${from}:${to}`;
  const converters = {
    'c:f': (v) => (v * 9 / 5) + 32, 'f:c': (v) => (v - 32) * 5 / 9,
    'km:mi': (v) => v * 0.6213711922, 'mi:km': (v) => v / 0.6213711922,
    'm:ft': (v) => v * 3.280839895, 'ft:m': (v) => v / 3.280839895,
    'kg:lb': (v) => v * 2.2046226218, 'lb:kg': (v) => v / 2.2046226218,
    'l:gal': (v) => v * 0.2641720524, 'gal:l': (v) => v / 0.2641720524,
    'cm:in': (v) => v / 2.54, 'in:cm': (v) => v * 2.54
  };
  return converters[key] ? converters[key](value) : null;
}

export function solveKnowledgeIntent(command, settings = {}) {
  const raw = decodeAssistantText(command);
  const lower = normalizeArabicDigits(raw).toLowerCase();
  const conversion = lower.match(/(?:convert\s+)?(-?\d+(?:\.\d+)?)\s*([°a-z]+)\s+(?:to|in|into)\s+([°a-z]+)/i);
  if (conversion) {
    const from = UNIT_ALIASES[conversion[2]];
    const to = UNIT_ALIASES[conversion[3]];
    const converted = from && to ? convertUnit(Number(conversion[1]), from, to) : null;
    if (converted != null) {
      const answer = `${conversion[1]} ${from} = ${rounded(converted)} ${to}`;
      return { type: 'conversion', answer: settings.replyLanguage === 'ar' ? `النتيجة: ${answer}` : answer };
    }
  }

  const normalized = normalizeMathWords(raw);
  const tokens = tokenizeExpression(normalized);
  if (!tokens || !tokens.some((token) => ['+', '-', '*', '/', '^', '%'].includes(token))) return null;
  try {
    const result = rounded(evaluateTokens(tokens));
    return {
      type: 'calculation',
      answer: settings.replyLanguage === 'ar' ? `النتيجة هي ${result}.` : settings.replyLanguage === 'both' ? `The answer is ${result}. / النتيجة هي ${result}.` : `The answer is ${result}.`
    };
  } catch (error) {
    return { type: 'calculation-error', answer: error.message === 'Division by zero' ? 'That calculation divides by zero, so it has no finite answer.' : 'I could not safely parse that calculation.' };
  }
}

export function parseNaturalDuration(command) {
  const value = normalizeArabicDigits(command).toLowerCase();
  const matches = [...value.matchAll(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|ساع(?:ة|ات)|minutes?|mins?|دقائق?|دقيقة|seconds?|secs?|ثواني|ثانية)/gi)];
  if (!matches.length) return null;
  let seconds = 0;
  matches.forEach((match) => {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (/hour|hr|ساع/.test(unit)) seconds += amount * 3600;
    else if (/minute|min|دق(?:يق|ائ)/.test(unit)) seconds += amount * 60;
    else seconds += amount;
  });
  return Math.max(1, Math.round(seconds));
}
