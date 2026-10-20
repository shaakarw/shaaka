const RWANDA_COUNTRY_CODE = '+250';
const RWANDA_PHONE_REGEX = /^07[0-9]{8}$/;

function normalizeRwandaPhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.startsWith('250')) {
    const rest = digits.slice(3);
    if (rest.length === 9 && rest.startsWith('7')) {
      return `+250${rest}`;
    }
    return null;
  }
  if (digits.startsWith('07') && digits.length === 10) {
    return `+250${digits.slice(1)}`;
  }
  return null;
}

function isValidRwandaPhone(raw) {
  if (!raw || typeof raw !== 'string') return false;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('250')) {
    const rest = digits.slice(3);
    return rest.length === 9 && rest.startsWith('7');
  }
  return RWANDA_PHONE_REGEX.test(digits);
}

// For auth (login/register): keep number as-is, only strip non-digits
// Do NOT add +250 prefix — store exactly what user typed (e.g. 0781234567 stays 0781234567)
function normalizeForAuth(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.startsWith('250')) {
    const rest = digits.slice(3);
    if (rest.length === 9 && rest.startsWith('7')) {
      return `0${rest}`;
    }
    return null;
  }
  if (digits.startsWith('07') && digits.length === 10) {
    return digits;
  }
  return null;
}

function normalizePhoneField(raw) {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') return '';
  const normalized = normalizeRwandaPhone(raw);
  return normalized || raw.trim();
}

module.exports = {
  normalizeRwandaPhone,
  isValidRwandaPhone,
  normalizeForAuth,
  normalizePhoneField,
  RWANDA_PHONE_REGEX,
};
