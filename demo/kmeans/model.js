(function (root) {
  'use strict';

  function randomSource(seed) {
    let state = seed >>> 0;
    return function () {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return (state + 0.5) / 4294967296;
    };
  }

  function squaredDistance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function nearest(point, centroids) {
    let best = -1, bestDistance = Infinity;
    for (let i = 0; i < centroids.length; i++) {
      const distance = squaredDistance(point, centroids[i]);
      // Strict comparison gives exact ties to the lowest centroid index.
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    }
    return best;
  }

  function inertia(points, labels, centroids) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const centroid = centroids[labels[i]];
      if (!centroid) return Infinity;
      sum += squaredDistance(points[i], centroid);
    }
    return sum;
  }

  function assign(points, centroids) {
    const counts = Array(centroids.length).fill(0);
    const labels = points.map(point => {
      const label = nearest(point, centroids);
      if (label >= 0) counts[label]++;
      return label;
    });
    return { labels, counts, inertia: inertia(points, labels, centroids) };
  }

  function update(points, labels, centroids) {
    const counts = Array(centroids.length).fill(0);
    const sums = centroids.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < points.length; i++) {
      const label = labels[i];
      if (!Number.isInteger(label) || label < 0 || label >= centroids.length) {
        throw new RangeError('Each point needs a valid cluster assignment before updating centroids.');
      }
      counts[label]++;
      sums[label].x += points[i].x;
      sums[label].y += points[i].y;
    }
    let maxShift = 0;
    const empty = [];
    const next = centroids.map((centroid, i) => {
      // Keeping an empty centroid in place preserves the descent property.
      if (!counts[i]) {
        empty.push(i);
        return { x: centroid.x, y: centroid.y };
      }
      const mean = { x: sums[i].x / counts[i], y: sums[i].y / counts[i] };
      maxShift = Math.max(maxShift, Math.sqrt(squaredDistance(mean, centroid)));
      return mean;
    });
    return { centroids: next, counts, maxShift, empty };
  }

  function initialize(points, k, method = 'random', seed = 42) {
    if (!points.length) return [];
    if (!Number.isFinite(k) || k < 1) throw new RangeError('K must be at least 1.');
    if (method !== 'random' && method !== 'kmeans++') throw new RangeError('Unknown initialization method.');
    const count = Math.min(points.length, Math.floor(k));
    const random = randomSource(seed);
    const available = points.map((_, i) => i);
    const centroids = [];
    while (centroids.length < count) {
      let chosen = Math.floor(random() * available.length);
      if (method === 'kmeans++' && centroids.length) {
        const weights = available.map(i => squaredDistance(points[i], centroids[nearest(points[i], centroids)]));
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        if (total > 0) {
          let target = random() * total;
          chosen = weights.length - 1;
          for (let i = 0; i < weights.length; i++) {
            target -= weights[i];
            if (target < 0) { chosen = i; break; }
          }
        }
        // If all remaining distances are zero, keep the uniform choice.
      }
      const point = points[available.splice(chosen, 1)[0]];
      centroids.push({ x: point.x, y: point.y });
    }
    return centroids;
  }

  function generate(count, preset = 'blobs', seed = 42) {
    if (!Number.isFinite(count) || count < 0) throw new RangeError('Point count must be nonnegative.');
    if (!['blobs', 'rings', 'uniform'].includes(preset)) throw new RangeError('Unknown dataset preset.');
    const random = randomSource(seed);
    const normal = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
    const bounded = value => Math.max(0.3, Math.min(9.7, value));
    const centers = [{ x: 2.6, y: 7.1 }, { x: 7.4, y: 7 }, { x: 5, y: 2.6 }];
    return Array.from({ length: Math.floor(count) }, (_, i) => {
      let x, y;
      if (preset === 'uniform') {
        x = 0.3 + 9.4 * random();
        y = 0.3 + 9.4 * random();
      } else if (preset === 'rings') {
        const angle = random() * Math.PI * 2;
        const radius = (i % 2 ? 3.65 : 1.45) + 0.16 * normal();
        x = 5 + radius * Math.cos(angle);
        y = 5 + radius * Math.sin(angle);
      } else {
        const center = centers[i % centers.length];
        x = center.x + 0.85 * normal();
        y = center.y + 0.85 * normal();
      }
      return { id: i + 1, x: bounded(x), y: bounded(y) };
    });
  }

  const api = { generate, initialize, assign, update, inertia, nearest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KMeansModel = api;
})(typeof window !== 'undefined' ? window : this);
