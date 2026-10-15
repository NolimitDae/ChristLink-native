export interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
}

export interface Cluster<T extends GeoPoint> {
  id: string;
  lat: number;
  lng: number;
  items: T[];
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Grid clustering: divides the visible region into `cells` × `cells` buckets and merges points
 * that share a bucket. Cheap enough to rerun on every region change for a few hundred pins.
 */
export function clusterPoints<T extends GeoPoint>(points: T[], region: Region, cells = 6): Cluster<T>[] {
  const cellLat = Math.max(region.latitudeDelta / cells, 1e-6);
  const cellLng = Math.max(region.longitudeDelta / cells, 1e-6);
  const buckets = new Map<string, T[]>();
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const key = `${Math.floor(p.lat / cellLat)}:${Math.floor(p.lng / cellLng)}`;
    const list = buckets.get(key);
    if (list) list.push(p);
    else buckets.set(key, [p]);
  }
  const out: Cluster<T>[] = [];
  for (const [key, items] of buckets) {
    const lat = items.reduce((s, i) => s + i.lat, 0) / items.length;
    const lng = items.reduce((s, i) => s + i.lng, 0) / items.length;
    out.push({ id: items.length === 1 ? items[0].id : `c:${key}`, lat, lng, items });
  }
  return out;
}

export function regionForPoints(points: GeoPoint[], fallback: Region): Region {
  const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length === 0) return fallback;
  const lats = valid.map(p => p.lat);
  const lngs = valid.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.05, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.05, (maxLng - minLng) * 1.4),
  };
}
