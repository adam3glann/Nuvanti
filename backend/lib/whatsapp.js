// Sends WhatsApp messages via Twilio's WhatsApp API. Optional: if it isn't
// configured, this quietly no-ops in development (logging what would have
// been sent) and throws in production, matching lib/mail.js's pattern.
function configured() {
  return ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM'].every((key) => Boolean(process.env[key]) && !process.env[key].startsWith('PASTE_'));
}

// Best-effort phone normalization: Twilio's WhatsApp API requires E.164
// (a leading "+" and country code). We don't guess a country code for a
// bare local number — if the customer didn't include one, we skip sending
// rather than message the wrong person.
function toE164(phone) {
  const cleaned = String(phone || '').replace(/[\s()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
}

export async function sendOrderWhatsApp({ phone, message }) {
  const to = toE164(phone);
  if (!to) {
    if (process.env.NODE_ENV !== 'production') console.info(`WhatsApp skipped (no valid E.164 phone) for "${phone}": ${message}`);
    return;
  }
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') return; // WhatsApp is optional even in production — never blocks checkout.
    console.info(`Development WhatsApp message for ${to}: ${message}`);
    return;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({ From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, To: `whatsapp:${to}`, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) console.error('WhatsApp send failed:', response.status, await response.text().catch(() => ''));
}
