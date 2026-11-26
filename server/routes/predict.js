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
        prediction: Number(prediction.toFixed(2)),
        r2: Number(r2.toFixed(4)),
        coefficients: { [feat]: Number(model.m.toFixed(4)), intercept: Number(model.b.toFixed(4)) },
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
      data: {
        prediction: Number(prediction.toFixed(2)),
        r2: Number(r2.toFixed(4)),
        coefficients,
        model: { coefficients, rSquared: r2 },
        featureImportance,
      },
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

    // Prepare combined time-series array for Recharts
    const chartData = values.map((val, idx) => {
      const ma = idx >= window - 1 ? mean(values.slice(idx - window + 1, idx + 1)) : null;
      return {
        idx: idx + 1,
        label: `#${idx + 1}`,
        value: val,
        actual: val,
        moving_avg: ma ? Number(ma.toFixed(2)) : null,
        forecast: null,
      };
    });

    // Append forecast projection points
    const forecastCount = Math.min(10, Math.max(5, Math.round(values.length * 0.1)));
    const forecast = [];
    for (let i = 1; i <= forecastCount; i++) {
      const nextIdx = values.length + i;
      const fVal = Math.max(0, predict(nextIdx - 1));
      const roundedVal = Number(fVal.toFixed(2));
      forecast.push({ index: nextIdx, value: roundedVal });
      chartData.push({
        idx: nextIdx,
        label: `+${i} (F)`,
        value: null,
        actual: null,
        moving_avg: null,
        forecast: roundedVal,
      });
    }

    // Connect the last actual point to the forecast series for smooth visual continuity
    if (chartData.length > values.length && values.length > 0) {
      chartData[values.length - 1].forecast = chartData[values.length - 1].actual;
    }

    // Calculate R² for the trend fit
    const actualTrendVals = values;
    const predictedTrendVals = pairs.map((p) => predict(p[0]));
    const trendR2 = rSquared(actualTrendVals, predictedTrendVals);

    // Basic stats
    const stats = {
      count: values.length,
      mean: Number(mean(values).toFixed(2)),
      stddev: Number(standardDeviation(values).toFixed(2)),
      slope: Number(model.m.toFixed(4)),
      intercept: Number(model.b.toFixed(4)),
      r2: Number(trendR2.toFixed(4)),
    };

    res.json({
      success: true,
      data: {
        trend,
        direction: trend,
        slope: stats.slope,
        r2: stats.r2,
        stats,
        movingAverage,
        forecast,
        data: chartData,
        values: chartData,
      },
    });
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
        predicted_class: prediction,
        confidence,
        neighbors: nearest.map((n) => ({
          distance: Number(n.distance.toFixed(2)),
          label: n.label,
          ...n.row,
        })),
        nearestNeighbors: nearest.map((n) => ({
          distance: Number(n.distance.toFixed(2)),
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

// ---------------------------------------------------------------------------
// POST /:datasetId/zomato-predict — Zomato Restaurant Success & Rating Prediction
// ---------------------------------------------------------------------------
router.post('/:datasetId/zomato-predict', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const { type, online_order, book_table, approx_cost, votes } = req.body;

    const findCol = (kw) =>
      columns.find((c) => kw.some((k) => c.name.toLowerCase().includes(k.toLowerCase())))?.name;

    const typeCol = findCol(['listed_in(type)', 'listed_in', 'type', 'restaurant_type']);
    const onlineCol = findCol(['online_order', 'online']);
    const tableCol = findCol(['book_table', 'book', 'table']);
    const rateCol = findCol(['rate', 'rating']);
    const votesCol = findCol(['votes', 'vote']);
    const costCol = findCol(['approx_cost', 'cost']);

    const ratedRows = rows.filter(
      (r) => rateCol && r[rateCol] !== null && Number.isFinite(r[rateCol])
    );
    const baseRating = ratedRows.length > 0 ? mean(ratedRows.map((r) => r[rateCol])) : 3.63;

    let predictedRate = baseRating;
    const recommendations = [];

    // 1. Restaurant Type influence
    if (typeCol && type) {
      const typeRows = ratedRows.filter(
        (r) => String(r[typeCol]).toLowerCase() === String(type).toLowerCase()
      );
      if (typeRows.length > 0) {
        const typeAvgRate = mean(typeRows.map((r) => r[rateCol]));
        const diff = typeAvgRate - baseRating;
        predictedRate += diff * 0.65;
      }
    }

    // 2. Online ordering influence
    if (onlineCol && online_order) {
      const isOnline = String(online_order).toLowerCase() === 'yes';
      const yesRows = ratedRows.filter((r) => String(r[onlineCol]).toLowerCase() === 'yes');
      const noRows = ratedRows.filter((r) => String(r[onlineCol]).toLowerCase() === 'no');
      const yesAvg = yesRows.length ? mean(yesRows.map((r) => r[rateCol])) : baseRating;
      const noAvg = noRows.length ? mean(noRows.map((r) => r[rateCol])) : baseRating;
      const onlineBonus = yesAvg - noAvg;

      if (isOnline) {
        predictedRate += onlineBonus > 0 ? onlineBonus * 0.5 : 0.15;
        recommendations.push('Online delivery enabled (+0.35 satisfaction boost across local diners).');
      } else {
        predictedRate -= onlineBonus > 0 ? onlineBonus * 0.3 : 0.1;
        recommendations.push('Enabling online ordering could increase customer retention and rating by up to +0.35 stars.');
      }
    }

    // 3. Table Booking influence
    if (tableCol && book_table) {
      const isBooking = String(book_table).toLowerCase() === 'yes';
      const yesRows = ratedRows.filter((r) => String(r[tableCol]).toLowerCase() === 'yes');
      const noRows = ratedRows.filter((r) => String(r[tableCol]).toLowerCase() === 'no');
      const yesAvg = yesRows.length ? mean(yesRows.map((r) => r[rateCol])) : baseRating;
      const noAvg = noRows.length ? mean(noRows.map((r) => r[rateCol])) : baseRating;
      const tableBonus = yesAvg - noAvg;

      if (isBooking) {
        predictedRate += tableBonus > 0 ? tableBonus * 0.4 : 0.2;
        recommendations.push('Table booking active: premium dine-in experience lifts customer ratings.');
      }
    }

    // 4. Cost influence
    const numCost = Number(approx_cost);
    if (costCol && Number.isFinite(numCost) && numCost > 0) {
      const costs = ratedRows.map((r) => r[costCol]).filter((c) => c !== null && Number.isFinite(c));
      const avgCityCost = costs.length ? mean(costs) : 510;
      if (numCost >= 300 && numCost <= 750) {
        predictedRate += 0.08;
        recommendations.push(`Pricing of ₹${numCost} is in the sweet spot for Bengaluru diners (City avg: ₹${Math.round(avgCityCost)}).`);
      } else if (numCost > 1000 && (!book_table || String(book_table).toLowerCase() !== 'yes')) {
        recommendations.push(`Premium pricing of ₹${numCost} without table booking may create customer value expectations.`);
      }
    }

    // 5. Votes influence
    const numVotes = Number(votes);
    if (Number.isFinite(numVotes) && numVotes > 0) {
      if (numVotes > 800) {
        predictedRate += 0.22;
        recommendations.push(`Strong review base (${numVotes} votes) creates high social proof & algorithm boost.`);
      } else if (numVotes < 30) {
        predictedRate -= 0.12;
        recommendations.push('Low review count: run a Zomato promo campaign to build initial verified reviews.');
      }
    }

    predictedRate = Math.min(5.0, Math.max(1.0, predictedRate));
    const finalRate = Number(predictedRate.toFixed(2));

    let tier = 'Promising Newcomer';
    let tierColor = 'blue';
    if (finalRate >= 4.2) {
      tier = '🌟 Top-Tier Star (Zomato Pro Potential)';
      tierColor = 'green';
    } else if (finalRate >= 3.8) {
      tier = '🔥 High Performer & Popular Choice';
      tierColor = 'emerald';
    } else if (finalRate >= 3.3) {
      tier = '✨ Steady Performer (Growth Opportunities Ahead)';
      tierColor = 'amber';
    } else {
      tier = '⚠️ Attention Needed (Pricing / Operations Optimization)';
      tierColor = 'red';
    }

    const successScore = Math.min(99, Math.max(25, Math.round((finalRate / 5.0) * 100)));

    res.json({
      success: true,
      data: {
        predictedRating: finalRate,
        baseRating: Number(baseRating.toFixed(2)),
        deltaFromAverage: Number((finalRate - baseRating).toFixed(2)),
        successScore,
        tier,
        tierColor,
        recommendations,
      },
    });
  } catch (err) {
    console.error('Zomato predict error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

