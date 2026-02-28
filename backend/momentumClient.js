// momentumClient.js - wrapper for Momentum IoT API with caching + normalization
const fetch = require('node-fetch');

const MOMENTUM_API_URL = process.env.MOMENTUM_API_URL || 'https://api.momentumiot.com';
const MOMENTUM_API_KEY = process.env.MOMENTUM_API_KEY || '';
// Allow custom auth header name if needed (some APIs use x-api-key)
const MOMENTUM_AUTH_HEADER = process.env.MOMENTUM_AUTH_HEADER || 'Authorization';
// Endpoint path (adjust if Swagger shows different e.g., /api/assets or /api/devices)
const MOMENTUM_ASSETS_PATH = process.env.MOMENTUM_ASSETS_PATH || '/api/assets';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cache = { data: null, ts: 0 };

function buildHeaders() {
  if (!MOMENTUM_API_KEY) throw new Error('Missing MOMENTUM_API_KEY');
  if (MOMENTUM_AUTH_HEADER.toLowerCase() === 'authorization') {
    return { 'Authorization': `Bearer ${MOMENTUM_API_KEY}` };
  }
  // fallback using provided header name
  return { [MOMENTUM_AUTH_HEADER]: MOMENTUM_API_KEY };
}

// Normalize raw asset/device object into canonical structure
function normalizeAsset(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id || raw.deviceId || raw.assetId || raw.serial || raw.name;
  const name = raw.name || raw.assetName || raw.label || id || 'UNKNOWN';
  const lastUpdate = raw.lastUpdate || raw.lastSeen || raw.lastMessageAt || raw.updatedAt || raw.timestamp || null;
  // Location fields heuristics
  let lat = raw.lat || raw.latitude || (raw.location && (raw.location.lat || raw.location.latitude));
  let lng = raw.lng || raw.lon || raw.long || raw.longitude || (raw.location && (raw.location.lng || raw.location.lon || raw.location.longitude));
  const address = raw.address || (raw.location && (raw.location.address || raw.location.formattedAddress)) || null;
  const location = address || (lat && lng ? `${lat},${lng}` : null);
  return { id, name, lat, lng, location, lastUpdate, raw };
}

function normalizeAssets(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeAsset).filter(Boolean);
}

async function fetchAssets(force = false) {
  const now = Date.now();
  if (!force && cache.data && (now - cache.ts) < CACHE_TTL_MS) {
    return { data: cache.data, cached: true };
  }
  const headers = buildHeaders();
  const url = MOMENTUM_API_URL.replace(/\/$/, '') + MOMENTUM_ASSETS_PATH;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Momentum API error ${res.status}`);
  const json = await res.json();
  const normalized = normalizeAssets(Array.isArray(json) ? json : (json.items || json.assets || json.data || []));
  cache = { data: normalized, ts: now };
  return { data: normalized, raw: json, cached: false };
}

module.exports = { fetchAssets, normalizeAsset, normalizeAssets };
