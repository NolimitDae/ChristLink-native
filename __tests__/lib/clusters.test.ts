import { clusterPoints, regionForPoints } from '../../lib/clusters';

const region = { latitude: 40, longitude: -75, latitudeDelta: 0.6, longitudeDelta: 0.6 };

describe('clusterPoints', () => {
  it('merges nearby pins and keeps far ones separate', () => {
    const pts = [
      { id: 'a', lat: 40.001, lng: -75.001 },
      { id: 'b', lat: 40.002, lng: -75.002 },
      { id: 'c', lat: 40.25, lng: -74.75 },
    ];
    const clusters = clusterPoints(pts, region, 6);
    expect(clusters).toHaveLength(2);
    const big = clusters.find(c => c.items.length === 2);
    expect(big?.id.startsWith('c:')).toBe(true);
    expect(clusters.find(c => c.items.length === 1)?.id).toBe('c');
  });

  it('ignores invalid coordinates', () => {
    expect(clusterPoints([{ id: 'x', lat: Number.NaN, lng: 1 }], region)).toEqual([]);
  });
});

describe('regionForPoints', () => {
  it('falls back when there are no points', () => {
    expect(regionForPoints([], region)).toBe(region);
  });

  it('fits all points with padding and a minimum zoom', () => {
    const r = regionForPoints(
      [
        { id: 'a', lat: 39, lng: -76 },
        { id: 'b', lat: 41, lng: -74 },
      ],
      region,
    );
    expect(r.latitude).toBe(40);
    expect(r.longitude).toBe(-75);
    expect(r.latitudeDelta).toBeCloseTo(2.8);
    expect(regionForPoints([{ id: 'a', lat: 1, lng: 1 }], region).latitudeDelta).toBe(0.05);
  });
});
