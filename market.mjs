export const MAX_SYMBOLS = 5;
export const MAX_CALENDAR_DAYS = 90;

const SYMBOL_PATTERN = /^(?:[A-Z0-9.^=_-]{1,20}|(?:NSE|BSE):[A-Z0-9.^=_-]{1,20})$/;

export function jsonResponse(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function parseSymbols(searchParams) {
  const symbols = [
    ...new Set(
      searchParams
        .getAll("symbols")
        .flatMap(value => value.split(","))
        .map(value => value.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  if (!symbols.length) {
    throw new Error("Add at least one ticker symbol.");
  }
  if (symbols.length > MAX_SYMBOLS) {
    throw new Error(`Use no more than ${MAX_SYMBOLS} symbols at a time.`);
  }
  if (symbols.some(symbol => !SYMBOL_PATTERN.test(symbol))) {
    throw new Error("Use valid ticker symbols such as RELIANCE.NS or NSE:RELIANCE.");
  }
  return symbols;
}

export function toYahooSymbol(symbol) {
  if (symbol.startsWith("NSE:")) return `${symbol.slice(4)}.NS`;
  if (symbol.startsWith("BSE:")) return `${symbol.slice(4)}.BO`;
  return symbol;
}

export function toFinnhubSymbol(symbol) {
  if (symbol.endsWith(".NS")) return `NSE:${symbol.slice(0, -3)}`;
  if (symbol.endsWith(".BO")) return `BSE:${symbol.slice(0, -3)}`;
  return symbol;
}

export function earningsSymbolAliases(symbol) {
  return new Set([symbol, toYahooSymbol(symbol), toFinnhubSymbol(symbol)]);
}

export function getCalendarDates(days, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const start = new Date(Date.UTC(
    Number(dateParts.year),
    Number(dateParts.month) - 1,
    Number(dateParts.day),
  ));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}
