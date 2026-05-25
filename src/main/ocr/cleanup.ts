/**
 * Shared post-OCR cleanup helpers. Both the Tesseract and PaddleOCR wrappers
 * call into these so noise filtering behaves identically regardless of engine.
 *
 * Two layers:
 *   - `stripIconNoise`: token-level surgery. Drops short symbol-bearing tokens
 *     (`O)`, `3=`, `<>`, `+`) and bullet-shaped leading digits (`4 Routines`).
 *   - `isLikelyNoise`: line-level heuristic for high-confidence noise that
 *     still slips through (letter ratio, vowel deficiency, single-letter token
 *     density, weird Unicode symbol density).
 */

const TRAILING_PUNCT = /[\p{P}]+$/u;
const SINGLE_LETTER_OK = /^[IiAa]$/;

/**
 * Strip token-level icon-mis-read noise from a single OCR line.
 *
 * Targets two real-world failure modes seen on UI screenshots:
 *  1. Short symbol-bearing tokens attached to menu items
 *     (`O) Chat`, `+ New`, `3= Cowork`, `<> Code`) — the symbol part is an
 *     icon mis-read.
 *  2. Single-digit prefixes followed by a Capitalized word
 *     (`4 Routines`, `6 Customize`) — the digit is a bullet / icon mis-read.
 *
 * Preserves: `OK.` (sentence-final period), `I am a dev` (valid pronouns),
 * `5G phones` (real digit+letter words), `Section 5` (mid-line numbers).
 */
export function stripIconNoise(line: string): string {
  const words = line.split(/\s+/).filter((w) => w.length > 0);
  const cleaned: string[] = [];

  for (const word of words) {
    const trailingMatch = word.match(TRAILING_PUNCT);
    const trailingPunct = trailingMatch ? trailingMatch[0] : '';
    const core = trailingPunct ? word.slice(0, -trailingPunct.length) : word;

    if (core.length === 0) continue;

    // Short token containing non-alphanumeric → icon noise (`3=`, `<>`, `+`).
    if (core.length <= 3 && /[^A-Za-z0-9]/.test(core)) continue;

    // Single letter + trailing punctuation = likely icon mis-read (`O)`).
    // Allow `I` and `a` since they're real English words and may end a clause.
    if (core.length === 1 && trailingPunct && !SINGLE_LETTER_OK.test(core)) continue;

    cleaned.push(core + trailingPunct);
  }

  // Line-start single-digit followed by a Capitalized word → bullet/icon noise
  // (`4 Routines`, `6 Customize`). A digit before lowercase ("5 minutes") is
  // probably a real number — keep it.
  if (
    cleaned.length >= 2 &&
    /^[0-9]$/.test(cleaned[0]) &&
    /^[A-Z]/.test(cleaned[1])
  ) {
    cleaned.shift();
  }

  return cleaned.join(' ');
}

/**
 * Heuristic noise detector for lines that survived stripping. Branches by
 * length because short text ("OK", "I am a dev") needs gentler treatment
 * than long text where statistical patterns are stable.
 */
export function isLikelyNoise(text: string): boolean {
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  const vowels = (text.match(/[aeiouAEIOU]/g) ?? []).length;
  const nonSpace = text.replace(/\s/g, '').length;
  if (nonSpace === 0) return true;

  const words = text.split(/\s+/).filter((w) => w.length > 0);

  // Universal: almost no letters → symbols / numbers only.
  if (letters / nonSpace < 0.45) return true;

  // Universal: weird Unicode glyphs beyond standard punctuation.
  const symbols = (text.match(/[^A-Za-z0-9\s\p{P}]/gu) ?? []).length;
  if (symbols / nonSpace > 0.2) return true;

  // Universal: density of single-LETTER tokens (`a Z q F` patterns from
  // Chinese glyphs each being read as one Latin character).
  const singleLetterTokens = words.filter((w) => /^[A-Za-z]$/.test(w)).length;
  if (words.length >= 4 && singleLetterTokens / words.length > 0.6) return true;

  if (nonSpace <= 12 || words.length <= 3) {
    // Short text: only flag clearly-junk patterns.
    if (letters >= 5 && vowels === 0) return true;
    return false;
  }

  // Longer text: stricter shape checks.
  if (vowels / letters < 0.12) return true;
  const meanLen = words.reduce((s, w) => s + w.length, 0) / words.length;
  if (meanLen < 2.3) return true;

  return false;
}
