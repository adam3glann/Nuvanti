/**
 * Domain-free Gmail relay for the Railway backend.
 * Deploy as a web app that executes as the owner and is accessible to anyone.
 * Store the same high-entropy shared secret used by Railway in Script Properties
 * under MAIL_RELAY_SECRET. Never put the secret in this source file.
 */
function doGet() {
  return jsonOutput({ ok: true, service: "Nuvanti mail relay" });
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty(
      "MAIL_RELAY_SECRET",
    );
    if (!expectedSecret || request.secret !== expectedSecret) {
      return jsonOutput({ ok: false, error: "Unauthorized" });
    }

    const to = String(request.to || "").trim();
    const subject = String(request.subject || "").replace(/[\r\n]+/g, " ");
    const text = String(request.text || "");
    const html = String(request.html || "");
    if (!to || !subject || (!text && !html) || /[\r\n]/.test(to)) {
      return jsonOutput({ ok: false, error: "Invalid email payload" });
    }

    const options = {
      name: String(request.fromName || "Nuvanti").slice(0, 100),
    };
    if (html) options.htmlBody = html;
    if (request.replyTo) options.replyTo = String(request.replyTo).trim();
    MailApp.sendEmail(to, subject, text || " ", options);
    return jsonOutput({ ok: true });
  } catch (error) {
    return jsonOutput({
      ok: false,
      error: String((error && error.message) || "Mail relay failed").slice(0, 300),
    });
  }
}

function authorizeMailer() {
  // Run this once from the editor to grant the script permission to send mail.
  return MailApp.getRemainingDailyQuota();
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
