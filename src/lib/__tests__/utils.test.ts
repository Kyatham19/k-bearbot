// Stock query and greeting detection tests
// Note: These functions are in chat/route.ts, extracting for testing

export function detectStockQuery(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const TICKER_PATTERN = /\$([A-Z]{1,10}(?:\.[A-Z]{1,2})?)\b/;
  const dollarMatch = trimmed.match(TICKER_PATTERN);
  if (dollarMatch?.[1]) return dollarMatch[1].toUpperCase();

  if (/^[A-Z]{1,10}(\.[A-Z]{1,2})?$/.test(trimmed)) return trimmed.toUpperCase();

  const NOUN_PHRASE_PATTERN =
    /(?:analyze|analysis\s+of|price\s+of|quote\s+for|stock\s+of)\s+([a-zA-Z0-9.&\-\s]{2,40})/i;
  const nounPhraseMatch = trimmed.match(NOUN_PHRASE_PATTERN);
  if (nounPhraseMatch?.[1]) return nounPhraseMatch[1].trim();

  return null;
}

export function isGreeting(message: string): boolean {
  const t = message.trim().toLowerCase().replace(/[!.?]+$/g, '');
  if (
    t.length <= 20 &&
    /^(hi|hey|hello|yo|sup|howdy|good\s+(morning|afternoon|evening|night)|thanks|thank\s+you|ok|okay|bye)$/.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

describe('Stock Query Detection', () => {
  it('should detect dollar ticker', () => {
    const result = detectStockQuery('$AAPL');
    expect(result).toBe('AAPL');
  });

  it('should detect bare ticker', () => {
    const result = detectStockQuery('AAPL');
    expect(result).toBe('AAPL');
  });

  it('should detect noun phrase pattern', () => {
    const result = detectStockQuery('analyze Apple');
    expect(result).toContain('Apple');
  });

  it('should return null for non-stock queries', () => {
    const result = detectStockQuery('what is the weather?');
    expect(result).toBeNull();
  });
});

describe('Greeting Detection', () => {
  it('should detect hello greeting', () => {
    const greeting = isGreeting('hello');
    expect(greeting).toBe(true);
  });

  it('should detect hi greeting', () => {
    const greeting = isGreeting('hi');
    expect(greeting).toBe(true);
  });

  it('should detect thanks greeting', () => {
    const greeting = isGreeting('thanks');
    expect(greeting).toBe(true);
  });

  it('should not detect long messages as greetings', () => {
    const greeting = isGreeting(
      'hello, how are you doing today with the markets?'
    );
    expect(greeting).toBe(false);
  });
});
