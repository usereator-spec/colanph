import { getStore } from '@netlify/blobs';
import { INITIAL_DATA } from './initial-data.mjs';

const STORE_NAME = 'colanph-content';
const DATA_KEY = 'site-data';

export function getContentStore() {
  return getStore(STORE_NAME);
}

export async function readSiteData({ withMetadata = false } = {}) {
  const store = getContentStore();
  if (withMetadata) {
    const result = await store.getWithMetadata(DATA_KEY, { consistency: 'strong', type: 'json' });
    if (!result || !result.data) {
      return { data: structuredClone(INITIAL_DATA), etag: null, source: 'default' };
    }
    return { data: result.data, etag: result.etag ?? null, source: 'blob' };
  }

  const data = await store.get(DATA_KEY, { consistency: 'strong', type: 'json' });
  return data ?? structuredClone(INITIAL_DATA);
}

export async function writeSiteData(data, etag) {
  const store = getContentStore();
  const options = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
  return store.setJSON(DATA_KEY, data, options);
}
