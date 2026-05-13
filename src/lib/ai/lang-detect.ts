// Detect whether a user message is written in Tanglish (casual Tamil + simple English mix)
// or contains Tamil unicode. Used by the agent layer in 'auto' language mode.

const TAMIL_UNICODE = /[\u0B80-\u0BFF]/;

// Roman-script Tanglish markers. Lowercased token match, word-bounded.
const TANGLISH_TOKENS = new Set([
  "enna", "epdi", "epadi", "vera", "level", "da", "machi", "bro", "anna",
  "akka", "solunga", "sollunga", "paaru", "paaru", "vaa", "vada", "varum",
  "irukku", "irukka", "irukkum", "illa", "illai", "illaiya", "venum",
  "vendum", "venuma", "tha", "thaan", "than", "appo", "appadi", "ipdi",
  "ipdi", "seri", "seriya", "seekram", "siikram", "ungal", "unga", "naan",
  "nee", "neenga", "namma", "namba", "konjam", "konjm", "rombha", "romba",
  "kekkanum", "panna", "pannu", "panrathu", "panrom", "ponga", "po",
  "varen", "varein", "vendaam", "kuda", "mathiri", "pola", "podhum",
  "podum", "kammi", "athigam", "athiga", "kaasu", "panam",
]);

const TOKEN_RE = /[a-zA-Z]+/g;

export function detectTanglish(text: string): boolean {
  if (!text) return false;
  if (TAMIL_UNICODE.test(text)) return true;

  const tokens = text.toLowerCase().match(TOKEN_RE);
  if (!tokens || tokens.length === 0) return false;

  let hits = 0;
  for (const tok of tokens) {
    if (TANGLISH_TOKENS.has(tok)) hits++;
    if (hits >= 2) return true;
  }
  // Short messages: a single strong token still flips it
  if (hits >= 1 && tokens.length <= 6) return true;
  return false;
}
