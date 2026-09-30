# HH Work Schedule

Agent schedule portal.

## Data flow
Google Sheet -> Google Apps Script -> GitHub Pages

Agents enter only their Agent ID. The app supports Today, This Week, and This Month.

Default shift: 10:00 PM–7:00 AM Philippine Time (Asia/Manila).

## Files
- `index.html` — agent portal
- `config.js` — Apps Script web-app URL
- `apps-script/Code.gs` — Google Apps Script API

## Google Sheet format
Row 1 should contain:
- Agent ID
- Agent Name
- Date columns

Date columns should be real spreadsheet date values. Cells contain WFH, ONSITE, OFF, LEAVE, or HOLIDAY.

A monthly tab can be named like `September 2026`, `October 2026`, etc. The API will use the current month's tab when available, otherwise it finds a sheet containing date headers.

## Setup
1. Open the Google Sheet.
2. Extensions -> Apps Script.
3. Paste `apps-script/Code.gs`.
4. Deploy as a Web app.
5. Copy the `/exec` URL.
6. Put it in `config.js` as `APP_CONFIG.API_URL`.
7. Enable GitHub Pages for this repository.

## Security note
Agent-ID-only access means anyone who knows a valid Agent ID can request that agent's schedule. If schedules are sensitive, add authentication or another verification step before production use.
