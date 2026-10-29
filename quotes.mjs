import {
  jsonResponse,
  parseSymbols,
  toYahooSymbol,
} from "./lib/market.mjs";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

function requiredNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Market data is missing or has an invalid ${field}.`);
  }
  return value;
}

function firstValidNumber(values, field) {
  const value = values.find(item => item !== null && item !== undefined);
  return requiredNumber(value, field);
}

function summarizeQuote(payload, requestedSymbol) {
  const chart = payload?.chart;
  if (chart?.error) {
    throw new Error(`Market data service: ${chart.error.description || "Unknown ticker or data error"}`);
  }

  const result = chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];
  if (!meta || !quote) {
    throw new Error("No usable current-day market data was returned for that ticker.");
  }

  const latestPrice = requiredNumber(meta.regularMarketPrice, "latest price");
  const previousClose = requiredNumber(
    meta.chartPreviousClose ?? meta.previousClose,
    "previous close",
  );
  if (latestPrice <= 0 || previousClose <= 0) {
    throw new Error("Market data contains a non-positive price.");
  }

  const highs = (quote.high || [])
    .filter(value => value !== null && value !== undefined)
    .map(value => requiredNumber(value, "intraday high"));
  const lows = (quote.low || [])
    .filter(value => value !== null && value !== undefined)
    .map(value => requiredNumber(value, "intraday low"));
  if (!highs.length || !lows.length) {
    throw new Error("No intraday price data is available for this ticker.");
  }

  const volume = requiredNumber(meta.regularMarketVolume, "trading volume");
  if (volume < 0) {
    throw new Error("Market data contains invalid trading volume.");
  }
  const timestamps = result.timestamp || [];
  const quoteTime = meta.regularMarketTime ?? timestamps.at(-1);
  if (!Number.isInteger(quoteTime)) {
    throw new Error("Market data is missing quote time.");
  }

  return {
    symbol: String(meta.symbol || requestedSymbol),
    name: String(meta.longName || meta.shortName || requestedSymbol),
    exchange: String(meta.fullExchangeName || meta.exchangeName || "Unknown exchange"),
    currency: String(meta.currency || ""),
    latest_price: latestPrice,
    previous_close: previousClose,
    open: firstValidNumber(quote.open || [], "session open"),
    high: Math.max(...highs),
    low: Math.min(...lows),
    volume: Math.trunc(volume),
    quote_time: `${new Date(quoteTime * 1000).toISOString().slice(0, 19).replace("T", " ")} UTC`,
  };
}

async function fetchQuote(symbol) {
  const yahooSymbol = toYahooSymbol(symbol);
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}?range=1d&interval=5m`;
  let response;
  try {
    response = await fetch(url, { headers: { "User-Agent": "IndianMarketWatch/1.0" } });
  } catch (error) {
    throw new Error(`Could not reach the market data service: ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`Market data request failed (HTTP ${response.status}).`);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The market data service returned an invalid response.");
  }
  return summarizeQuote(payload, yahooSymbol);
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let symbols;
  try {
    symbols = parseSymbols(new URL(request.url).searchParams);
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const quotes = await Promise.all(symbols.map(async symbol => {
    try {
      return await fetchQuote(symbol);
    } catch (error) {
      return { symbol, error: error.message };
    }
  }));
  const order = new Map(symbols.map((symbol, index) => [toYahooSymbol(symbol), index]));
  quotes.sort((left, right) =>
    (order.get(left.symbol) ?? symbols.length) - (order.get(right.symbol) ?? symbols.length),
  );
  return jsonResponse({ quotes });
}

export const config = { path: "/api/quotes" };
