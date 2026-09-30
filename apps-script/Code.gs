const CONFIG = {
  SPREADSHEET_ID: '1c7DbzkIB8k4PjKEnYvF7h80Pr69vafAG0fm1AmTOoZg',
  TIMEZONE: 'Asia/Manila',
  DEFAULT_SHIFT_START: '10:00 PM',
  DEFAULT_SHIFT_END: '7:00 AM'
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const agentId = String(p.agentId || '').trim();
  const view = String(p.view || 'today').toLowerCase();
  const callback = String(p.callback || '').trim();

  let result;
  try {
    result = agentId ? getSchedule(agentId, view) : { ok:false, error:'Agent ID is required.' };
  } catch (err) {
    result = { ok:false, error: err.message || 'Unable to read schedule.' };
  }

  const json = JSON.stringify(result);
  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
      return ContentService.createTextOutput('Invalid callback.');
    }
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function getSchedule(agentId, view) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const now = new Date();
  const sheet = findScheduleSheet(ss);
  if (!sheet) throw new Error('No schedule sheet with date columns was found.');

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('The schedule sheet is empty.');

  const headers = data[0];
  const agentCol = findHeader(headers, ['agent id','agentid','employee id']);
  const nameCol = findHeader(headers, ['agent name','name','employee name']);
  if (agentCol < 0 || nameCol < 0) throw new Error('The sheet needs Agent ID and Agent Name columns.');

  const row = data.slice(1).find(r =>
    String(r[agentCol] || '').trim().toLowerCase() === agentId.toLowerCase()
  );
  if (!row) return { ok:false, error:'Agent ID not found.' };

  const agentName = String(row[nameCol] || agentId).trim();
  const entries = [];

  headers.forEach((h, c) => {
    if (!(h instanceof Date)) return;
    const setup = String(row[c] || '').trim().toUpperCase();
    if (!setup) return;
    entries.push({
      date: Utilities.formatDate(h, CONFIG.TIMEZONE, 'yyyy-MM-dd'),
      day: Utilities.formatDate(h, CONFIG.TIMEZONE, 'EEE'),
      dateLabel: Utilities.formatDate(h, CONFIG.TIMEZONE, 'MMM d'),
      workSetup: setup,
      shiftStart: CONFIG.DEFAULT_SHIFT_START,
      shiftEnd: CONFIG.DEFAULT_SHIFT_END
    });
  });

  const todayKey = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const today = entries.find(x => x.date === todayKey) || null;
  const start = startOfWeek(now);
  const end = new Date(start.getTime() + 6 * 86400000);
  const week = entries.filter(x => {
    const d = parseDateKey(x.date);
    return d >= start && d <= end;
  });
  const monthKey = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM');
  const month = entries.filter(x => x.date.indexOf(monthKey) === 0);

  return {
    ok:true, agentId, agentName, timezone:CONFIG.TIMEZONE,
    shift:{start:CONFIG.DEFAULT_SHIFT_START,end:CONFIG.DEFAULT_SHIFT_END},
    today, week, month,
    view,
    schedule:view === 'month' ? month : view === 'week' ? week : [today].filter(Boolean)
  };
}

function findScheduleSheet(ss) {
  const current = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MMMM yyyy');
  const named = ss.getSheetByName(current);
  if (named && hasDateHeader(named)) return named;
  return ss.getSheets().find(hasDateHeader) || null;
}

function hasDateHeader(sheet) {
  if (!sheet.getLastColumn()) return false;
  return sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].some(v => v instanceof Date);
}

function findHeader(headers, names) {
  const normalized = headers.map(h => String(h || '').trim().toLowerCase());
  for (const name of names) {
    const i = normalized.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

function startOfWeek(date) {
  const key = Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const d = parseDateKey(key);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function parseDateKey(key) {
  const p = key.split('-').map(Number);
  return new Date(p[0], p[1]-1, p[2]);
}
