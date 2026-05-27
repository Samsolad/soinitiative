/**
 * SoInitiative Google Apps Script backend
 *
 * Deploy as Web App: Execute as Me, Access: Anyone
 * Set Script Property SHEET_SECRET to match Vercel env SHEET_SECRET
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'Missing body' });
    }

    var data = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SHEET_SECRET');
    if (secret) {
      var provided = data._secret || getHeader_(e, 'X-SoInitiative-Secret');
      if (provided !== secret) {
        return json_({ ok: false, error: 'Unauthorized' });
      }
    }

    var ss = SpreadsheetApp.openById('YOUR_SHEET_ID');

    if (data.type === 'vote') {
      return handleVote_(ss, data);
    }

    return handleNomination_(ss, data);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function handleVote_(ss, data) {
  var campaign = sanitize_(data.campaign, 40);
  var nominee = sanitize_(data.nominee, 200);
  var email = sanitize_(data.email, 254).toLowerCase();

  if (!campaign || !nominee || !isValidEmail_(email)) {
    return json_({ ok: false, error: 'Invalid vote payload' });
  }

  var votes = ss.getSheetByName('Votes');
  if (!votes) throw new Error('Votes sheet missing');

  var rows = votes.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rowCampaign = String(rows[i][1] || '');
    var rowEmail = String(rows[i][3] || '').toLowerCase();
    if (rowCampaign === campaign && rowEmail === email) {
      return json_({ ok: false, error: 'duplicate_vote' });
    }
  }

  votes.appendRow([new Date(), campaign, nominee, email]);
  return json_({ ok: true });
}

function handleNomination_(ss, data) {
  var nominations = ss.getSheetByName('Nominations');
  if (!nominations) throw new Error('Nominations sheet missing');

  nominations.appendRow([
    new Date(),
    sanitize_(data.campaign, 40),
    sanitize_(data.category, 80),
    sanitize_(data.country, 80),
    sanitize_(data.nominee, 200),
    sanitize_(data.role, 120),
    sanitize_(data.org, 200),
    sanitize_(data.location, 120),
    sanitize_(data.what, 500),
    sanitize_(data.story || data.reason, 4000),
    sanitize_(data.link, 500),
    sanitize_(data.duration, 80),
    sanitize_(data.aware, 80),
    sanitize_(data.relationship, 120),
    sanitize_(data.nominator_name, 120),
    sanitize_(data.nominator_email, 254),
    sanitize_(data.nominator_phone, 40),
    sanitize_(data.nominator_country, 80)
  ]);

  return json_({ ok: true });
}

function sanitize_(value, maxLen) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function getHeader_(e, name) {
  if (!e || !e.headers) return '';
  var target = String(name).toLowerCase();
  for (var key in e.headers) {
    if (String(key).toLowerCase() === target) return String(e.headers[key]);
  }
  return '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
