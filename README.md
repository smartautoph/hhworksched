# HH Work Schedule

Agent schedule portal for the HH work schedule.

## Data flow

Google Sheet -> Google Apps Script -> GitHub Pages

Agents enter only their Agent ID. The portal supports Today, This Week, and This Month.

**Default shift:** 10:00 PM–7:00 AM Philippine Time (`Asia/Manila`).

## Files

- `index.html` — agent portal
- `config.js` — deployed Apps Script URL
- `apps-script/Code.gs` — Google Apps Script schedule API

## Google Sheet

Configured spreadsheet:

`1c7DbzkIB8k4PjKEnYvF7h80Pr69vafAG0fm1AmTOoZg`

Configured schedule tab GID:

`466347550`

The API first uses that tab. If it is unavailable, it falls back to a schedule sheet containing Agent ID and Agent Name headers.

The schedule parser accepts:

- Agent ID / AgentID / Employee ID
- Agent Name / Employee Name / Name
- Real Google Sheets date cells
- Common date text such as `9/30`, `09/30`, `Sep 30`, `September 30`, and full dates
- WFH / Work From Home / Home / Remote
- ONSITE / ON SITE / Office
- OFF / REST DAY / REST

The API also searches the first 10 rows for the actual Agent ID and Agent Name header row, so a title or instruction row above the table will not break the lookup.

## Apps Script deployment

After changing `apps-script/Code.gs`:

1. Open the Google Sheet.
2. Go to **Extensions -> Apps Script**.
3. Replace the Apps Script code with the current `apps-script/Code.gs` from this repository.
4. Save.
5. Run a function once from the Apps Script editor if Google asks for authorization.
6. Go to **Deploy -> Manage deployments**.
7. Edit the Web app deployment.
8. Set **Execute as** to **Me** (the deploying account).
9. Set **Who has access** to the audience that should use the portal. For an Agent-ID-only portal, this normally needs to be **Anyone** / anonymous access where your Google account/domain permits it.
10. Deploy a new version.
11. Keep the resulting `/exec` URL in `config.js`.

Google Apps Script web apps use `doGet(e)` for GET requests and can return JSON/JSONP through Content Service. The execution identity and access level are controlled by the web-app deployment configuration.

## GitHub Pages

Enable GitHub Pages for the repository's `main` branch and root folder.

The generated schedule data is **not saved to GitHub**. GitHub contains only the application source/configuration. The live schedule remains in Google Sheets and is read by Apps Script.

## Important

Changing `Code.gs` in GitHub does **not automatically change an already deployed Apps Script web app** unless the Apps Script project is actually synchronized with that repository. If the Apps Script project is separate, copy the updated code into Apps Script and redeploy the Web App.

## Security

Agent-ID-only access means anyone who knows a valid Agent ID can request that agent's schedule. If schedules are sensitive, add authentication or another verification step before production use.