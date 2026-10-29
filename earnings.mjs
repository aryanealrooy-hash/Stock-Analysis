import {
  earningsSymbolAliases,
  getCalendarDates,
  jsonResponse,
  MAX_CALENDAR_DAYS,
  parseSymbols,
} from "./lib/market.mjs";

const FINNHUB_URL = "https://finnhub.io/api/v1/calendar/earnings";

export default async function handler(request) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse(
      { error: "Earnings calendar is not configured. Set FINNHUB_API_KEY in Netlify environment variables." },
      503,
    );
  }

  const params = new URL(request.url).searchParams;
  let symbols;
  let days;
  try {
    symbols = parseSymbols(params);
    days = Number(params.get("days") || "30");
    if (!Number.isInteger(days) || days < 1 || days > MAX_CALENDAR_DAYS) {
      throw new Error(`Choose a date range from 1 to ${MAX_CALENDAR_DAYS} days.`);
    }
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const { from, to } = getCalendarDates(days);
  const url = new URL(FINNHUB_URL);
  url.search = new URLSearchParams({ from, to, token: apiKey }).toString();
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    return jsonResponse({ error: `Could not reach the earnings provider: ${error.message}` }, 502);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return jsonResponse({ error: "Earnings provider rejected the API key or plan." }, 502);
    }
    if (response.status === 429) {
      return jsonResponse({ error: "Earnings provider rate limit reached. Try again later." }, 502);
    }
    return jsonResponse({ error: `Earnings provider request failed (HTTP ${response.status}).` }, 502);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return jsonResponse({ error: "Earnings provider returned an invalid response." }, 502);
  }
  if (!Array.isArray(payload?.earningsCalendar)) {
    return jsonResponse({ error: "Earnings provider returned an unexpected response." }, 502);
  }

  const requestedAliases = new Set(
    symbols.flatMap(symbol => [...earningsSymbolAliases(symbol)]),
  );
  const events = payload.earningsCalendar
    .filter(event => event && typeof event === "object"
      && requestedAliases.has(String(event.symbol || "").toUpperCase()))
    .sort((left, right) =>
      String(left.date || "").localeCompare(String(right.date || ""))
      || String(left.symbol || "").localeCompare(String(right.symbol || "")),
    );

  return jsonResponse({
    events,
    symbols,
    from,
    to,
    source: "Finnhub",
    warnings: [],
  });
}

export const config = { path: "/api/earnings" };
