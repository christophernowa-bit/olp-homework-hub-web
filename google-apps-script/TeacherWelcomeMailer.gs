/**
 * OLP Homework Hub teacher welcome mailer.
 * Deploy as a Web app that executes as the Google account which owns this script.
 * The endpoint is protected by a random token stored in Script Properties.
 */
function doPost(e) {
  try {
    const expected = PropertiesService.getScriptProperties().getProperty('OLP_MAILER_TOKEN') || '';
    const input = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const supplied = typeof input.token === 'string' ? input.token : '';

    if (!expected || !supplied || supplied.length !== expected.length || supplied !== expected) {
      return jsonOutput({ ok: false, error: 'Request not authorized.' });
    }

    const to = typeof input.to === 'string' ? input.to.trim() : '';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(to)) {
      return jsonOutput({ ok: false, error: 'A valid recipient email is required.' });
    }

    const fullName = typeof input.fullName === 'string'
      ? input.fullName.trim().slice(0, 120)
      : 'Teacher';
    const supportUrl = typeof input.supportUrl === 'string'
      ? input.supportUrl.trim()
      : '';
    if (!/^https:\/\//i.test(supportUrl)) {
      return jsonOutput({ ok: false, error: 'The support link is invalid.' });
    }

    const safeName = escapeHtml(fullName || 'Teacher');
    const subject = 'Welcome to OLP Homework Hub';
    const body = [
      `Hello ${fullName || 'Teacher'},`,
      '',
      'Welcome to OLP Homework Hub. We are glad you have joined our teaching community.',
      '',
      'Would you like help getting started or using the platform? Sign in and send us a message in the teacher support chat. The Platform Owner will be able to reply there:',
      supportUrl,
      '',
      'Warm regards,',
      'OLP Homework Hub',
    ].join('\\n');

    if (MailApp.getRemainingDailyQuota() < 1) {
      return jsonOutput({ ok: false, error: 'The Google account has reached its daily email recipient limit.' });
    }

    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      htmlBody: `<p>Hello ${safeName},</p>
        <p>Welcome to OLP Homework Hub. We are glad you have joined our teaching community.</p>
        <p>Would you like help getting started or using the platform? Sign in and send us a message in the teacher support chat. The Platform Owner will be able to reply there.</p>
        <p><a href="${supportUrl}">Open teacher support chat</a></p>
        <p>Warm regards,<br>OLP Homework Hub</p>`,
      name: 'OLP Homework Hub',
    });

    return jsonOutput({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonOutput({
      ok: false,
      error: error && error.message ? String(error.message).slice(0, 300) : 'Email could not be sent.',
    });
  }
}

function jsonOutput(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
  });
}

/**
 * Run this once from the Apps Script editor to create a high-entropy shared token.
 * Copy the execution log value into Supabase as APPS_SCRIPT_SHARED_SECRET, and
 * into Script Properties as OLP_MAILER_TOKEN. Never paste it into source code.
 */
function generateMailerToken() {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('OLP_MAILER_TOKEN', token);
  console.log('Copy this token into Supabase secret APPS_SCRIPT_SHARED_SECRET. Keep it private.');
  console.log(token);
}
