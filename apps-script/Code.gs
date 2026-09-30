const CONFIG = {
  SPREADSHEET_ID: '1c7DbzkIB8k4PjKEnYvF7h80Pr69vafAG0fm1AmTOoZg',
  SCHEDULE_SHEET_GID: 466347550,
  TIMEZONE: 'Asia/Manila',
  DEFAULT_SHIFT_START: '10:00 PM',
  DEFAULT_SHIFT_END: '7:00 AM'
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const agentId = String(p.agentId || '').trim();
  const view = normalizeView(p.view);
  const callback = String(p.callback || '').trim();

  try {
    if (!agentId) {
      return respond({ ok: false, error: 'Agent ID is required.' }, callback);
    }

    return respond(getSchedule(agentId, view), callback);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);

    return respond({
      ok: false,
      error: err && err.message
        ? err.message
        : 'Unable to read the schedule.',
      code: 'SCHEDULE_READ_ERROR'
    }, callback);
  }
}

function getSchedule(agentId, view) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetById(CONFIG.SCHEDULE_SHEET_GID) || findScheduleSheet(ss);

  if (!sheet) {
    throw new Error('The configured schedule tab could not be found.');
  }

  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) {
    throw new Error('The schedule sheet is empty.');
  }

  const layout = findScheduleLayout(values);

  if (layout.agentCol < 0) {
    throw new Error('Agent ID column was not found. Please use a header such as "Agent ID".');
  }

  if (layout.nameCol < 0) {
    throw new Error('Agent Name column was not found. Please use a header such as "Agent Name".');
  }

  const normalizedId = normalizeAgentId(agentId);

  const row = values.slice(layout.headerRow + 1).find(function(r) {
    return normalizeAgentId(r[layout.agentCol]) === normalizedId;
  });

  if (!row) {
    return {
      ok: false,
      error: 'Agent ID not found.',
      agentId: agentId
    };
  }

  const agentName = String(row[layout.nameCol] || agentId).trim();
  const entries = [];

  for (let c = 0; c < layout.headers.length; c++) {
    const date = parseScheduleDate(layout.headers[c]);

    if (!date) continue;

    const setup = normalizeSetup(row[c]);

    if (!setup) continue;

    entries.push({
      date: Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd'),
      day: Utilities.formatDate(date, CONFIG.TIMEZONE, 'EEE'),
      dateLabel: Utilities.formatDate(date, CONFIG.TIMEZONE, 'MMM d'),
      workSetup: setup,
      shiftStart: CONFIG.DEFAULT_SHIFT_START,
      shiftEnd: CONFIG.DEFAULT_SHIFT_END
    });
  }

  entries.sort(function(a, b) {
    return a.date.localeCompare(b.date);
  });

  const now = new Date();
  const todayKey = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const today = entries.find(function(x) {
    return x.date === todayKey;
  }) || null;

  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const week = entries.filter(function(entry) {
    const d = parseDateKey(entry.date);
    return d >= weekStart && d <= weekEnd;
  });

  const monthKey = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM');
  const month = entries.filter(function(entry) {
    return entry.date.indexOf(monthKey) === 0;
  });

  let schedule = [];

  if (view === 'month') {
    schedule = month;
  } else if (view === 'week') {
    schedule = week;
  } else if (today) {
    schedule = [today];
  }

  return {
    ok: true,
    agentId: agentId,
    agentName: agentName,
    timezone: CONFIG.TIMEZONE,
    shift: {
      start: CONFIG.DEFAULT_SHIFT_START,
      end: CONFIG.DEFAULT_SHIFT_END
    },
    today: today,
    week: week,
    month: month,
    view: view,
    schedule: schedule
  };
}

function findScheduleLayout(values) {
  // Search the first 10 rows so the sheet can have a title/instruction row
  // above the actual table header.
  const maxHeaderRows = Math.min(values.length, 10);

  for (let r = 0; r < maxHeaderRows; r++) {
    const headers = values[r] || [];
    const agentCol = findHeader(headers, [
      'agent id', 'agentid', 'agent_id',
      'employee id', 'employeeid', 'employee_id',
      'id'
    ]);

    const nameCol = findHeader(headers, [
      'agent name', 'agentname', 'agent_name',
      'employee name', 'employeename', 'employee_name',
      'name'
    ]);

    if (agentCol >= 0 && nameCol >= 0) {
      return {
        headerRow: r,
        headers: headers,
        agentCol: agentCol,
        nameCol: nameCol
      };
    }
  }

  return {
    headerRow: 0,
    headers: values[0] || [],
    agentCol: -1,
    nameCol: -1
  };
}

function findScheduleSheet(ss) {
  const currentMonth = Utilities.formatDate(
    new Date(),
    CONFIG.TIMEZONE,
    'MMMM yyyy'
  );

  const named = ss.getSheetByName(currentMonth);
  if (named) return named;

  const sheets = ss.getSheets();

  for (let i = 0; i < sheets.length; i++) {
    const values = sheets[i].getDataRange().getValues();
    if (values && values.length) {
      const layout = findScheduleLayout(values);
      if (layout.agentCol >= 0 && layout.nameCol >= 0) {
        return sheets[i];
      }
    }
  }

  return null;
}

function findHeader(headers, names) {
  const normalized = headers.map(function(h) {
    return normalizeHeader(h);
  });

  for (let i = 0; i < names.length; i++) {
    const target = normalizeHeader(names[i]);
    const index = normalized.indexOf(target);
    if (index >= 0) return index;
  }

  return -1;
}

function normalizeHeader(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[\u00a0_\-]+/g, ' ')
    .replace(/\\s+/g, ' ');
}

function normalizeAgentId(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase();
}

function normalizeSetup(value) {
  const raw = String(value == null ? '' : value).trim().toUpperCase();

  if (!raw) return '';

  if (raw === 'WFH' ||
      raw === 'WORK FROM HOME' ||
      raw === 'HOME' ||
      raw === 'REMOTE') {
    return 'WFH';
  }

  if (raw === 'ONSITE' ||
      raw === 'ON SITE' ||
      raw === 'OFFICE') {
    return 'ONSITE';
  }

  if (raw === 'OFF' ||
      raw === 'REST DAY' ||
      raw === 'REST') {
    return 'OFF';
  }

  return raw;
}

function parseScheduleDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number' && value > 0) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) return date;
  }

  const text = String(value == null ? '' : value).trim();

  if (!text) return null;

  // Avoid treating normal column labels such as "Agent ID" as dates.
  if (!/[0-9]/.test(text)) return null;

  const currentYear = Number(
    Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy')
  );

  const formats = [
    'M/d/yyyy',
    'MM/dd/yyyy',
    'M-d-yyyy',
    'MM-dd-yyyy',
    'yyyy-MM-dd',
    'MMM d yyyy',
    'MMMM d yyyy',
    'MMM d',
    'MMMM d',
    'M/d',
    'MM/dd'
  ];

  for (let i = 0; i < formats.length; i++) {
    const parsed = parseDateWithFormat(text, formats[i], currentYear);
    if (parsed) return parsed;
  }

  return null;
}

function parseDateWithFormat(text, format, currentYear) {
  try {
    let candidate = text;

    // For formats without a year, append the current year.
    if (format.indexOf('yyyy') === -1) {
      candidate = text + ' ' + currentYear;
      format = format + ' yyyy';
    }

    const parts = Utilities.parseDate(
      candidate,
      CONFIG.TIMEZONE,
      format
    );

    if (parts instanceof Date && !isNaN(parts.getTime())) {
      return parts;
    }
  } catch (err) {
    // Try the next format.
  }

  return null;
}

function normalizeView(value) {
  const view = String(value || 'today').trim().toLowerCase();

  if (view === 'week' || view === 'month') {
    return view;
  }

  return 'today';
}

function startOfWeek(date) {
  const key = Utilities.formatDate(
    date,
    CONFIG.TIMEZONE,
    'yyyy-MM-dd'
  );

  const d = parseDateKey(key);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function parseDateKey(key) {
  const p = String(key).split('-').map(Number);

  return new Date(
    p[0],
    p[1] - 1,
    p[2]
  );
}

function respond(data, callback) {
  const json = JSON.stringify(data);

  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
      return ContentService
        .createTextOutput('Invalid callback.');
    }

    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
