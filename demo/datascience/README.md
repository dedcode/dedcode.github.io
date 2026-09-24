# Data science demo

Interactive correlation and feature-standardization teaching demo.

- Correlation slider from −1 to +1, using 120 synthetic observations with exact sample correlation and standardized marginal values.
- Original and standardized histograms for age, annual income, and weekly work hours. Sample standard deviation (n − 1) is used. Bin boundaries are transformed with the data so before/after counts match.
- Standardized histograms share a common horizontal scale. Original histograms use feature-specific units and ranges.

Open `index.html` in a browser or serve this directory with `python3 -m http.server`. D3 loads from jsDelivr, so an internet connection is required.

`source.html` is the editable visualization fragment. `index.html` is its standalone export, including styles and interaction-state support. Regenerate the export after editing the fragment using the visualization skill's `scripts/render.py` tool.

Published at https://djelleldifallah.com/demo/datascience/.
