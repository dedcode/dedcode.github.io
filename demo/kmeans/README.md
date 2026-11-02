# K-means explorer

Buildless, dependency-free K-means teaching demo for GitHub Pages. Open `index.html` locally, or serve this directory with any static server. Published at `/demo/kmeans/`.

## Controls

- Step through assignment and centroid updates separately, or play until convergence.
- Choose 1–6 clusters, 30–180 points, and blobs, concentric rings, or uniform data.
- Compare random sample initialization with K-means++.
- Drag data points or centroids, or edit their coordinates with the keyboard.
- Toggle nearest-centroid regions, assignment lines, and centroid trails.
- Reset replays the current run's initial centroids. New centroids keeps the data; New data resamples it. Changes to coordinates start a new run from the displayed centers.

## Numerical conventions

The standard Lloyd algorithm minimizes within-cluster squared Euclidean error. An iteration is one assignment followed by one centroid update. A subsequent unchanged assignment ends the run. Point labels remain fixed during the update half-step, so point colors may briefly differ from the nearest-centroid background regions until the next assignment.

The objective chart records every half-step, including the final unchanged assignment. Exact distance ties favor the lower centroid index. Empty clusters retain their previous centroid. Starting centroids are distinct sample indices; duplicate coordinates are supported by the model. K-means++ samples with probability proportional to squared distance to the nearest existing center, with a uniform remaining-index fallback when every distance is zero.

The SVG plot clips half-planes to draw exact Voronoi regions. It uses equal scales on x₁ and x₂. Datasets are synthetic, reproducible and unlabeled. All computation stays in the browser; there are no runtime network dependencies.

## Validation

Run `node --test model.test.cjs`. Tests cover arithmetic means, distance ties, empty clusters, duplicates, deterministic data and initialization, plus monotone objective and convergence across 240 runs. Check `app.js` with `node --check app.js`.
