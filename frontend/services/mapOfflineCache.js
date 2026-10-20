import { offlineDatabase } from './offlineDatabase';
import { offlineStorage } from './offlineStorage';
import { mediaCache } from './mediaCache';

const MAP_SCOPE = 'map';
const PLACES_KEY = 'places';
const MALL_SHOPS_KEY = 'mall-shops';
const SEARCHES_KEY = 'searches';
const ROUTES_KEY = 'routes';
const AREAS_KEY = 'areas';

const readCollection = async (key, fallbackKey) => {
  const records = await offlineDatabase.getCollection(MAP_SCOPE);
  const record = records.find(item => item.key === key);
  if (record) return record.value;
  return (await offlineStorage.get(fallbackKey)) || [];
};

const writeCollection = (key, value, options) => offlineDatabase.putRecord(MAP_SCOPE, key, value, options);

const withCachedOwners = async records => Promise.all(records.map(async record => {
  const owner = record.owner || record.ownerId || record.userId;
  if (!owner) return record;

  const ownerId = typeof owner === 'object' ? owner._id || owner.id : owner;
  let ownerData = typeof owner === 'object' ? owner : null;
  if (ownerData && ownerId) {
    await offlineDatabase.putRecord('profiles', String(ownerId), ownerData, { priority: 'medium' });
  } else if (ownerId) {
    ownerData = await offlineDatabase.getRecord('profiles', String(ownerId));
  }

  return ownerData ? { ...record, owner: ownerData } : record;
}));

const appendRecent = (items, item, limit = 40) => [
  item,
  ...items.filter(existing => existing.id !== item.id),
].slice(0, limit);

export const mapOfflineCache = {
  async getPlaces() {
    return mediaCache.hydrate(await withCachedOwners(await readCollection(PLACES_KEY, `map:${PLACES_KEY}`)));
  },

  async savePlaces(places) {
    await writeCollection(PLACES_KEY, await mediaCache.hydrate(await withCachedOwners(places)), { priority: 'medium' });
  },

  async getMallShops() {
    return mediaCache.hydrate(await withCachedOwners(await readCollection(MALL_SHOPS_KEY, `map:${MALL_SHOPS_KEY}`)));
  },

  async saveMallShops(shops) {
    await writeCollection(MALL_SHOPS_KEY, await mediaCache.hydrate(await withCachedOwners(shops)), { priority: 'medium' });
  },

  async saveSearch(query, results) {
    if (!query?.trim()) return;
    const searches = await readCollection(SEARCHES_KEY, `map:${SEARCHES_KEY}`);
    await writeCollection(SEARCHES_KEY, appendRecent(searches, { id: query.trim().toLowerCase(), query: query.trim(), results, savedAt: Date.now() }, 20), { priority: 'low' });
  },

  async search(query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    const searches = await readCollection(SEARCHES_KEY, `map:${SEARCHES_KEY}`);
    return searches.find(item => item.id === normalizedQuery)?.results || [];
  },

  async saveRoute(route) {
    if (!route?.id || !route.geometry) return;
    const routes = await readCollection(ROUTES_KEY, `map:${ROUTES_KEY}`);
    await writeCollection(ROUTES_KEY, appendRecent(routes, { ...route, savedAt: Date.now() }, 10), { priority: 'medium' });
  },

  async findRoute(start, destination) {
    const routes = await readCollection(ROUTES_KEY, `map:${ROUTES_KEY}`);
    return routes.find(route => (
      Math.abs(route.start?.lat - start.lat) < 0.01
      && Math.abs(route.start?.lon - start.lon) < 0.01
      && Math.abs(route.destination?.lat - destination.lat) < 0.01
      && Math.abs(route.destination?.lon - destination.lon) < 0.01
    )) || null;
  },

  async saveArea(area) {
    if (!area?.id) return;
    const areas = await readCollection(AREAS_KEY, `map:${AREAS_KEY}`);
    await writeCollection(AREAS_KEY, appendRecent(areas, { ...area, lastViewedAt: Date.now() }, 12), { priority: area.priority || 'low' });
  },

  async getAreas() {
    return readCollection(AREAS_KEY, `map:${AREAS_KEY}`);
  },

  async cleanup() {
    await offlineStorage.cleanup();
    await offlineDatabase.evict();
  },
};
