import { Router } from 'express';
import {
  linearRegression,
  linearRegressionLine,
  mean,
  standardDeviation,
  sum,
} from 'simple-statistics';
import { dataStore } from '../store.js';

const router = Router();

// ---------------------------------------------------------------------------
// Parameter middleware — resolve dataset
// ---------------------------------------------------------------------------
router.param('datasetId', (req, res, next, datasetId) => {
  const ds = dataStore.get(datasetId);
  if (!ds) return res.status(404).json({ success: false, error: 'Dataset not found' });
  if (ds.rows.length === 0) return res.status(400).json({ success: false, error: 'Dataset is empty' });
  req.dataset = ds;
  next();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Non-null finite values for a column */
function numericValues(rows, col) {
  return rows.map((r) => r[col]).filter((v) => v !== null && Number.isFinite(v));
}

/** Compute R² for predicted vs actual */
function rSquared(actual, predicted) {
  const avg = mean(actual);
  const ssTot = sum(actual.map((a) => (a - avg) ** 2));
  if (ssTot === 0) return 1; // perfect fit when all actuals are identical
  const ssRes = sum(actual.map((a, i) => (a - predicted[i]) ** 2));
  return 1 - ssRes / ssTot;
}

// ---------------------------------------------------------------------------
// POST /:datasetId/linear — simple / multivariate linear regression
// ---------------------------------------------------------------------------
router.post('/:datasetId/linear', (req, res) => {
  try {
    const { features, target, input } = req.body;
    const { rows } = req.dataset;

    if (!features || !target || !input) {
      return res.status(400).json({ success: false, error: 'Missing features, target, or input in request body' });
    }

    // --- Single feature: use simple-statistics linearRegression ---
    if (features.length === 1) {
      const feat = features[0];
      const pairs = rows
        .filter((r) => r[feat] !== null && r[target] !== null && Number.isFinite(r[feat]) && Number.isFinite(r[target]))
        .map((r) => [r[feat], r[target]]);

      if (pairs.length < 2) {
        return res.status(400).json({ success: false, error: 'Not enough valid data points for regression' });
      }

      const model = linearRegression(pairs);
      const predict = linearRegressionLine(model);
      const actual = pairs.map((p) => p[1]);
      const predicted = pairs.map((p) => predict(p[0]));
      const r2 = rSquared(actual, predicted);

      const prediction = predict(Number(input[feat]));

      return res.json({
        success: true,
        data: {
          prediction,
          model: {
            coefficients: { [feat]: model.m, intercept: model.b },
            rSquared: r2,
          },
          featureImportance: [{ feature: feat, importance: 1 }],
        },
      });
    }

    // --- Multivariate: manual ordinary least squares via normal equation ---
    // Filter to rows with all features and target non-null
    const validRows = rows.filter((r) => {
      if (r[target] === null || !Number.isFinite(r[target])) return false;
      return features.every((f) => r[f] !== null && Number.isFinite(r[f]));
    });

    if (validRows.length < features.length + 1) {
      return res.status(400).json({ success: false, error: 'Not enough valid data points for multivariate regression' });
    }

    const n = validRows.length;
    const p = features.length;

    // Build design matrix X (n × p+1) and target vector Y (n × 1)
    // X has a column of 1s for the intercept
    const X = validRows.map((r) => [1, ...features.map((f) => r[f])]);
    const Y = validRows.map((r) => r[target]);

    // Normal equation: β = (Xᵀ X)⁻¹ Xᵀ Y
    // Xᵀ X  (p+1 × p+1)
    const XtX = Array.from({ length: p + 1 }, (_, i) =>
      Array.from({ length: p + 1 }, (_, j) =>
        sum(X.map((row) => row[i] * row[j]))
      )
    );

    // Xᵀ Y  (p+1 × 1)
    const XtY = Array.from({ length: p + 1 }, (_, i) =>
      sum(X.map((row, k) => row[i] * Y[k]))
    );

    // Invert XtX using Gauss-Jordan elimination
    const dim = p + 1;
    const aug = XtX.map((row, i) => {
      const identity = Array(dim).fill(0);
      identity[i] = 1;
      return [...row, ...identity];
    });

    for (let col = 0; col < dim; col++) {
      // Partial pivoting
      let maxRow = col;
      for (let row = col + 1; row < dim; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
      }
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

      const pivot = aug[col][col];
      if (Math.abs(pivot) < 1e-12) {
        return res.status(400).json({ success: false, error: 'Features are collinear; cannot compute regression' });
      }

      for (let j = 0; j < 2 * dim; j++) aug[col][j] /= pivot;
      for (let row = 0; row < dim; row++) {
        if (row === col) continue;
        const factor = aug[row][col];
        for (let j = 0; j < 2 * dim; j++) aug[row][j] -= factor * aug[col][j];
      }
    }

    // Extract inverse
    const inv = aug.map((row) => row.slice(dim));

    // Compute coefficients β = inv × XtY
    const beta = inv.map((row) =>
      sum(row.map((v, j) => v * XtY[j]))
    );

    // Predict
    const intercept = beta[0];
    const coefficients = { intercept };
    features.forEach((f, i) => { coefficients[f] = beta[i + 1]; });

    const inputVec = [1, ...features.map((f) => Number(input[f]))];
    const prediction = sum(inputVec.map((v, i) => v * beta[i]));

    // R²
    const predicted = X.map((row) => sum(row.map((v, i) => v * beta[i])));
    const r2 = rSquared(Y, predicted);

    // Feature importance (absolute standardised coefficients)
    const stds = features.map((f) => {
      const vals = validRows.map((r) => r[f]);
      return standardDeviation(vals) || 1;
    });
    const targetStd = standardDeviation(Y) || 1;
    const rawImportance = features.map((f, i) => Math.abs(beta[i + 1]) * stds[i] / targetStd);
    const totalImp = sum(rawImportance) || 1;
    const featureImportance = features.map((f, i) => ({
      feature: f,
      importance: rawImportance[i] / totalImp,
    }));

    res.json({
      success: true,
      data: { prediction, model: { coefficients, rSquared: r2 }, featureImportance },
    });
  } catch (err) {
    console.error('Linear regression error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:datasetId/trends/:column — trend analysis
// ---------------------------------------------------------------------------
router.get('/:datasetId/trends/:column', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const colName = req.params.column;
    const colMeta = columns.find((c) => c.name === colName);
    if (!colMeta) return res.status(404).json({ success: false, error: `Column "${colName}" not found` });
    if (colMeta.type !== 'numeric') {
      return res.status(400).json({ success: false, error: `Column "${colName}" is not numeric` });
    }

    const values = numericValues(rows, colName);
    if (values.length < 2) {
      return res.status(400).json({ success: false, error: 'Not enough data points for trend analysis' });
    }

    // Moving average (window = 5)
    const window = Math.min(5, values.length);
    const movingAverage = [];
    for (let i = 0; i <= values.length - window; i++) {
      const slice = values.slice(i, i + window);
      movingAverage.push(mean(slice));
    }

    // Linear regression on index vs value for trend direction and forecasting
    const pairs = values.map((v, i) => [i, v]);
    const model = linearRegression(pairs);
    const predict = linearRegressionLine(model);

    // Trend direction
    let trend = 'stable';
    if (model.m > 0.01) trend = 'increasing';
    else if (model.m < -0.01) trend = 'decreasing';

    // Forecast next 5 values
    const forecast = [];
    for (let i = 1; i <= 5; i++) {
      forecast.push({
        index: values.length - 1 + i,
        value: predict(values.length - 1 + i),
      });
    }

    // Basic stats
    const stats = {
      count: values.length,
      mean: mean(values),
      stddev: standardDeviation(values),
      slope: model.m,
      intercept: model.b,
    };

    res.json({ success: true, data: { trend, movingAverage, forecast, stats } });
  } catch (err) {
    console.error('Trends error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /:datasetId/classify — K-nearest neighbors classification
// ---------------------------------------------------------------------------
router.post('/:datasetId/classify', (req, res) => {
  try {
    const { features, target, input } = req.body;
    const { rows } = req.dataset;

    if (!features || !target || !input) {
      return res.status(400).json({ success: false, error: 'Missing features, target, or input in request body' });
    }

    // Build training set — rows where all features and target are present
    const trainRows = rows.filter((r) => {
      if (r[target] === null || r[target] === undefined || r[target] === '') return false;
      return features.every((f) => r[f] !== null && r[f] !== undefined);
    });

    if (trainRows.length < 5) {
      return res.status(400).json({ success: false, error: 'Not enough data points for classification (need >= 5)' });
    }

    // Compute Euclidean distance from input to each training row
    const distances = trainRows.map((r) => {
      const dist = Math.sqrt(
        sum(features.map((f) => {
          const a = Number(input[f]) || 0;
          const b = Number(r[f]) || 0;
          return (a - b) ** 2;
        }))
      );
      return { distance: dist, label: String(r[target]), row: r };
    });

    distances.sort((a, b) => a.distance - b.distance);

    const k = Math.min(5, distances.length);
    const nearest = distances.slice(0, k);

    // Majority vote
    const votes = {};
    for (const n of nearest) {
      votes[n.label] = (votes[n.label] || 0) + 1;
    }

    const sortedVotes = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    const prediction = sortedVotes[0][0];
    const confidence = sortedVotes[0][1] / k;

    res.json({
      success: true,
      data: {
        prediction,
        confidence,
        nearestNeighbors: nearest.map((n) => ({
          distance: n.distance,
          label: n.label,
          row: n.row,
        })),
      },
    });
  } catch (err) {
    console.error('Classify error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

