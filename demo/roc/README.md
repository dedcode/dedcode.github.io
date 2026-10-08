# ROC Curve Explorer

Static, offline-capable teaching demo. Open index.html or run python3 -m http.server in this directory.

Drag the score threshold or use the slider, Next score, Play/Pause, and Reset. Scores greater than or equal to the threshold are predicted positive. The confusion matrix, rates, and progressively revealed ROC curve update together. Equal scores cross as a group; mixed-class ties produce diagonal segments.

Instance count (10–100) and positive class prior (10–90%) control the synthetic dataset. The ranked list scrolls for larger datasets. Each class uses evenly spaced quantiles of the example scores. Three examples: perfect ranking (AUC 1), overlapping scores with ties (AUC 0.7), and reversed ranking (AUC 0). AUC is calculated from positive-negative pairs, with ties counting one half. Verified against trapezoidal integration of the ROC curve.

Files: index.html (structure), style.css (responsive theme), model.js (pure calculations), app.js (interaction/rendering), vendor/ (D3 7.9.0 and license).
