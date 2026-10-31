export const getAddressText = (address, fallback = '') => {
  if (typeof address === 'string') return address;
  if (!address || typeof address !== 'object') return fallback;

  if (typeof address.full === 'string' && address.full.trim()) {
    return address.full;
  }

  const parts = [
    address.street,
    address.village,
    address.cell,
    address.sector,
    address.district,
    address.province,
    address.country,
  ].filter((part) => typeof part === 'string' && part.trim());

  return parts.length > 0 ? parts.join(', ') : fallback;
};
