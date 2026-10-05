export function normalizeWhatsAppPhone(value) {
  let digits = String(value ?? '').trim().replace(/[\s().-]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (/^01[0125]\d{8}$/.test(digits)) digits = `20${digits.slice(1)}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}

export function createWhatsAppUrl(phone, message) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}` : '';
}
