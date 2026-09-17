# Logistic Regression Explorer

A static teaching tool built with HTML, CSS, vanilla JavaScript, and D3 7.9.0. All dependencies are included. No npm install, compilation, backend, account, or API key is needed.

## Run locally

Open `index.html` in a modern browser. The page works offline, including when opened directly from your filesystem.

Alternatively, run a local server from this folder:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000/**. Stop the server with **Ctrl+C**. Python serves the static files for local development; the deployed page does not need Python.

## Use it in class

The step selector follows the lesson from data to model evaluation to one prediction. A single instance-space plot stays in the same position throughout.

### 1. Place points

Choose a true label, then click the instance space or enter coordinates and select **Add point**. The dataset table shows coordinates and labels. Remove examples with their **Remove** buttons. The line and loss calculations are hidden at this stage. Add at least one point to enable the later steps.

### 2. Explore total loss

Use the angle and offset sliders to rotate and translate the line. The training points stay fixed. The table now shows each point's class-1 probability and loss, alongside a prominent **total training loss**. The total is the sum of all training losses, not their average. The table scrolls at 320 px with sticky headers; the total stays outside the scroll area.

### 3. Inspect one point

Select a point with the dropdown, click a training point on the plot, or use **Inspect** in the step-2 table. Its original position is outlined, and a diamond marks an independent exploration copy.

Drag the diamond or edit **Copy x₁ / Copy x₂** to follow position → score → probability → individual loss. The copy's true label stays fixed to the selected training point's label. The line stays fixed during this step; return to step 2 to adjust it.

The inspection pipeline is oriented toward the selected class. Its score is **s = (2y − 1) f(x)**: **s = f(x)** for a class-1 point and **s = −f(x)** for a class-0 point. The displayed signed distance is **s / √2**, positive on that point's correct side. The sigmoid plots **q = sigmoid(s) = P(the selected class)**, and the loss plot uses **L = −ln(q)** for both classes. Moving either class's point deeper into its correct region therefore increases the displayed score and probability and decreases its loss.

The loss plot uses the raw model score **f(x)** on its horizontal axis, a signed distance proxy (the exact signed distance is **f(x) / √2**). It plots **L = ln(1 + exp(−f(x)))** for class 1 and **L = ln(1 + exp(f(x)))** for class 0. Thus the loss curve falls toward the right for class 1 and toward the left for class 0. Both curves pass through **L = ln(2) ≈ 0.693** at **f(x) = 0**.

The raw model score f(x) remains visible separately. Selecting class 0 reverses the score used in the probability plot; it does not alter the underlying classifier or the decision boundary. The other class's probability is shown as **1 − q**. The training table in step 2 continues to label its probability column explicitly as **P(y = 1)**.

Moving the copy does not change any training point or the total training loss. The original point's loss and the unchanged training total are shown for comparison. **Return copy to original** restores the selected point's coordinates.

The step selector and Back/Next buttons preserve points, line settings, point selection, and the exploration copy. Returning to step 1 lets you edit the dataset. Selecting a different point starts a new copy from that point; removing the selected original clears that selection.

Changes are held in memory. Reloading starts a new lesson with an empty dataset and the default line.

## Model and teaching scope

For line angle θ and offset d, the unit normal is **n = (−sin θ, cos θ)**. The model uses **w = √2 n**, **b = −√2 d**, and **f(x) = wᵀx + b**. The weight magnitude stays fixed at √2 as the line rotates or moves. The displayed coefficients are rounded; calculations use full precision.

- Decision boundary: **f(x) = 0**.
- Signed distance: **f(x) / √2**.
- Probability: **p = 1 / (1 + exp(−f(x)))**, always the probability of class 1.
- Inspection score: **s = (2y − 1) f(x)**; selected-class probability **q = sigmoid(s)**, equal to **p** for y = 1 and **1 − p** for y = 0.
- Per-point loss: **−y ln(p) − (1 − y) ln(1 − p)**, calculated directly from the score to avoid taking the log of a rounded probability.
- Total training loss: **Σᵢ Lᵢ**, a sum rather than an average, using natural logarithms. Displayed values are rounded after calculation.

The line is adjusted manually. The page does not implement automatic training or optimization.

## Source files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, labels, controls, and table |
| `app.js` | Model calculations, line geometry, rendering, and interactions |
| `styles.css` | Standalone theme and form/table styles |
| `charts.css` | Chart layout, responsive behavior, and table scroll limit |
| `vendor/d3.v7.9.0.min.js` | Local copy of D3 |
| `vendor/D3-LICENSE` | D3's ISC license |
| `.nojekyll` | Tells GitHub Pages to serve the static files without Jekyll processing |

## Publish to GitHub Pages later

1. Put the **contents of this folder** at the root of the GitHub repository you want to publish. Include `vendor/` and `.nojekyll`.
2. Push the files to your `main` branch.
3. In the repository's **Settings → Pages**, select **Deploy from a branch**, then **main** and **/(root)**, and save.
4. Use the site address shown by GitHub Pages when deployment completes.

All asset paths are relative, so the page supports both a repository site such as `https://USERNAME.github.io/REPOSITORY/` and a user site. You can also put the contents in a repository's `docs/` folder and select `/docs` as the publishing folder.

See [GitHub's official Pages guide](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) and [publishing source settings](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
