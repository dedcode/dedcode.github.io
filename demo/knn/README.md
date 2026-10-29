# K-Nearest Neighbors Explorer

An original, dependency-free teaching demo inspired by the [Stanford CS231n KNN visualization](https://vision.stanford.edu/teaching/cs231n-demos/knn/) and [course notes](https://cs231n.github.io/classification/).

Open `index.html` in a modern browser, or serve the directory with `python3 -m http.server`. All code and styles are local; the demo works offline. Publish the directory at `/demo/knn/` on GitHub Pages.

## Interactions

- Switch between Euclidean (L2) and Manhattan (L1) distance.
- Change K from 1 to 15, class count from 2 to 5, and training count from 20 to 100.
- Drag a training point to update the decision regions. Use the expandable point editor for a keyboard alternative.
- Click empty plot space or drag the query marker to inspect a prediction. Numeric query coordinates are also editable.
- See the K selected neighbors, their distances, per-class votes, and an L2 circle or L1 diamond extending to the Kth neighbor.
- New samples generates another reproducible synthetic dataset. Class/point count changes regenerate the data. K and metric changes preserve edited positions.

## Conventions

All points live in the same `[0,10] × [0,10]` feature space, displayed with equal axis scales. Neighbors are ordered by distance and then numeric point ID. Exactly K examples receive one vote each; a tie for the largest vote total is left unresolved and shown as a neutral region. A distance tie at the Kth position may leave other equidistant points outside the selected set, as explained on the page. Vote fractions are not presented as probabilities.

The query is independent of the training data. No validation or test accuracy is claimed. The distance contour and query calculation are exact; the background is sampled on an approximately 3 CSS-pixel grid (9 while dragging training points). Map calculations are split across frames and stale requests are canceled. The synthetic Gaussian clusters are seeded, balanced to within one point per class, and clipped to the interior of the feature space.

The model has two equivalent prediction paths: the sorted-neighbor inspector and a reusable-buffer classifier for the dense map. Tests compare both paths, including tied votes and tied distances.

## Files and checks

- `index.html`: accessible controls and lesson layout.
- `style.css`: responsive light/dark styles.
- `model.js`: pure data generation and nearest-neighbor calculations.
- `app.js`: plot rendering and interactions.
- `model.test.cjs`: numerical correctness tests; run `node --test model.test.cjs`.

No build step, remote scripts, account, or backend is required.
