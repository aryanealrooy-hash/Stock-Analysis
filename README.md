# Indian Market Watch

A small informational watchlist website for Indian stock tickers. It displays the latest
available session quote and can look up reported upcoming earnings dates. It does not predict
stock performance or recommend buying or selling.

## Run locally

Requires Python 3.10 or later; there are no third-party Python packages.

```bash
python3 web_app.py
```

Open <http://127.0.0.1:8000>. Quotes are fetched from Yahoo Finance chart data and may be
delayed, unavailable, or subject to provider terms and rate limits.

## Earnings calendar

The earnings calendar uses Finnhub and requires an API key on the server:

```bash
FINNHUB_API_KEY=your_key_here python3 web_app.py
```

Keep the key private: do not put it in `index.html`, commit it, or expose it in browser code.
The calendar asks for dates up to 90 days ahead for the selected symbols. Indian ticker
suffixes `.NS` and `.BO` are translated to Finnhub's `NSE:` and `BSE:` symbol form. Provider
coverage varies; verify schedules through NSE/BSE filings and company investor-relations pages.

## Publish on Netlify

The Netlify version serves the site from `public/` and runs the quote and earnings APIs as
Netlify Functions. Company-name search uses the included NSE equity directory,
so matches appear as visitors type—even from the first letter—and the result count reflects all
matching NSE equity listings in that directory. The CSV directory is a snapshot; refresh it from
<https://archives.nseindia.com/content/equities/EQUITY_L.csv> when updating the project. The build
copies `index.html` and the directory into the publish directory, so the Python files and
configuration are not exposed as website content.

1. Push the project files to a GitHub repository. Include `index.html`, `netlify.toml`,
   `data/nse-equities.csv`, and the complete `netlify/functions/` folder. Keep each file in its
   original path. The Python files, `render.yaml`, and `requirements.txt` are not needed for
   Netlify, but may stay in the repository if you also want the local or Render version.
2. In Netlify, select **Add new site → Import an existing project**, connect GitHub, and select
   the repository. Netlify reads the build and Functions settings from `netlify.toml`.
3. Deploy the site. Netlify provides a public `https://...netlify.app` link; open it to check the
   page and share it.
4. Quotes work without extra configuration. To enable earnings dates, create a Finnhub API key
   and add `FINNHUB_API_KEY` under the site's **Environment variables** settings in Netlify.
   Never commit the key or put it in `index.html`. Trigger a new deploy after adding the key.
5. To use a custom domain, add it in the site's **Domain management** settings and follow
   Netlify's DNS instructions.

The page provides direct Yahoo Finance quote links and exchange/SEBI destinations so visitors
can verify information themselves. Links open in a new tab; they do not silently redirect users.
The `web_app.py` server remains available for local development; Netlify uses JavaScript
Functions for quote and earnings data.

The watchlist is saved in each visitor's browser. The app does not collect accounts or personal
financial details.
