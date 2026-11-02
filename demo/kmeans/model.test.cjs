const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./model.js');

test('assignment uses squared Euclidean distance and resolves ties by centroid index', () => {
  const points = [{ x: 1, y: 1 }, { x: 5, y: 2 }, { x: 2, y: 0 }];
  const centroids = [{ x: 0, y: 0 }, { x: 4, y: 0 }];
  const result = M.assign(points, centroids);
  assert.deepEqual(result.labels, [0, 1, 0]);
  assert.deepEqual(result.counts, [2, 1]);
  assert.equal(result.inertia, 11);
  assert.equal(M.nearest({ x: 2, y: 0 }, centroids), 0);
});

test('update computes arithmetic means, reports Euclidean motion and retains empty centroids', () => {
  const points = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 8, y: 6 }];
  const centroids = [{ x: 0, y: 0 }, { x: 9, y: 6 }, { x: 4, y: 5 }];
  const labels = [0, 0, 1];
  const original = JSON.stringify({ points, centroids, labels });
  const result = M.update(points, labels, centroids);
  assert.deepEqual(result.centroids, [{ x: 2, y: 3 }, { x: 8, y: 6 }, { x: 4, y: 5 }]);
  assert.deepEqual(result.counts, [2, 1, 0]);
  assert.deepEqual(result.empty, [2]);
  assert.equal(result.maxShift, Math.sqrt(13));
  assert.equal(M.inertia(points, labels, result.centroids), 4);
  assert.equal(JSON.stringify({ points, centroids, labels }), original);
  result.centroids[2].x = 100;
  assert.equal(centroids[2].x, 4);
});

test('initialization is reproducible, samples without replacement and handles coincident data', () => {
  const points = Array.from({ length: 12 }, (_, i) => ({ id: i, x: i, y: i / 2 }));
  const before = JSON.stringify(points);
  for (const method of ['random', 'kmeans++']) {
    const result = M.initialize(points, 8, method, 123);
    assert.deepEqual(result, M.initialize(points, 8, method, 123));
    assert.equal(new Set(result.map(p => p.x)).size, 8);
    assert.equal(M.initialize(points, 30, method, 123).length, 12);
    result[0].x = 999;
    assert.equal(JSON.stringify(points), before);
    const duplicates = Array.from({ length: 8 }, () => ({ x: 3, y: 4 }));
    assert.deepEqual(M.initialize(duplicates, 5, method, 4), Array.from({ length: 5 }, () => ({ x: 3, y: 4 })));
  }
});

test('presets are reproducible, bounded, unlabeled, and seed-dependent', () => {
  for (const preset of ['blobs', 'rings', 'uniform']) {
    const points = M.generate(100, preset, 42);
    assert.deepEqual(points, M.generate(100, preset, 42));
    assert.notDeepEqual(points, M.generate(100, preset, 43));
    assert.equal(points.length, 100);
    points.forEach((point, i) => {
      assert.deepEqual(Object.keys(point).sort(), ['id', 'x', 'y']);
      assert.equal(point.id, i + 1);
      assert.ok(point.x >= 0.3 && point.x <= 9.7 && point.y >= 0.3 && point.y <= 9.7);
    });
  }
});

test('each Lloyd half-step decreases the objective and converges across presets, starts and K', () => {
  let completedRuns = 0;
  for (const preset of ['blobs', 'rings', 'uniform']) {
    for (const method of ['random', 'kmeans++']) {
      for (let seed = 1; seed <= 8; seed++) {
        for (const k of [1, 2, 3, 5, 8]) {
          const points = M.generate(90, preset, seed);
          let centroids = M.initialize(points, k, method, seed + 70);
          let previous = Infinity, stable = false;
          for (let step = 0; step < 100; step++) {
            const assigned = M.assign(points, centroids);
            assert.ok(assigned.inertia <= previous + 1e-8, 'assignment cannot increase squared error');
            assert.equal(assigned.counts.reduce((a, b) => a + b, 0), points.length);
            const moved = M.update(points, assigned.labels, centroids);
            const after = M.inertia(points, assigned.labels, moved.centroids);
            assert.ok(after <= assigned.inertia + 1e-8, 'taking the mean cannot increase squared error');
            centroids = moved.centroids;
            previous = after;
            if (moved.maxShift < 1e-10) {
              assert.deepEqual(M.assign(points, centroids).labels, assigned.labels);
              stable = true;
              break;
            }
          }
          assert.ok(stable, `convergence: ${preset}, ${method}, seed ${seed}, K ${k}`);
          completedRuns++;
        }
      }
    }
  }
  assert.equal(completedRuns, 240);
});

test('empty inputs, duplicate points and invalid preassignment have explicit behavior', () => {
  assert.deepEqual(M.initialize([], 3), []);
  assert.deepEqual(M.generate(0), []);
  assert.deepEqual(M.assign([], []), { labels: [], counts: [], inertia: 0 });
  assert.deepEqual(M.assign([{ x: 1, y: 1 }], []), { labels: [-1], counts: [], inertia: Infinity });
  assert.deepEqual(M.update([], [], [{ x: 3, y: 4 }]), {
    centroids: [{ x: 3, y: 4 }], counts: [0], maxShift: 0, empty: [0]
  });
  const points = [{ x: 3, y: 4 }, { x: 3, y: 4 }];
  const centers = M.initialize(points, 2, 'kmeans++');
  const assigned = M.assign(points, centers);
  assert.deepEqual(assigned, { labels: [0, 0], counts: [2, 0], inertia: 0 });
  assert.equal(M.update(points, assigned.labels, centers).maxShift, 0);
  assert.throws(() => M.update(points, [], centers), RangeError);
});
