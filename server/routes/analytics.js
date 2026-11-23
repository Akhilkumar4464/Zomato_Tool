import { Router } from 'express';
import {
  mean,
  median,
  standardDeviation,
  min,
  max,
  sampleCorrelation,
} from 'simple-statistics';
import { dataStore } from '../store.js';

const router = Router();

// ---------------------------------------------------------------------------
// Parameter middleware — resolve dataset and attach to req
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

/** Extract non-null numeric values for a column */
function numericValues(rows, col) {
  return rows
    .map((r) => r[col])
    .filter((v) => v !== null && v !== undefined && Number.isFinite(v));
}

/** Count occurrences of each value in a categorical column */
function valueCounts(rows, col) {
  const counts = {};
  for (const row of rows) {
    const v = row[col] ?? '(empty)';
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// GET /:datasetId/summary
// ---------------------------------------------------------------------------
router.get('/:datasetId/summary', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const summary = {};

    for (const col of columns) {
      if (col.type === 'numeric') {
        const vals = numericValues(rows, col.name);
        if (vals.length === 0) {
          summary[col.name] = { type: 'numeric', count: 0, min: null, max: null, mean: null, median: null, stddev: null };
          continue;
        }
        summary[col.name] = {
          type: 'numeric',
          count: vals.length,
          min: min(vals),
          max: max(vals),
          mean: mean(vals),
          median: median(vals),
          stddev: vals.length > 1 ? standardDeviation(vals) : 0,
        };
      } else {
        const counts = valueCounts(rows, col.name);
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        summary[col.name] = {
          type: 'categorical',
          uniqueCount: sorted.length,
          mode: sorted[0] ? sorted[0][0] : null,
          modeCount: sorted[0] ? sorted[0][1] : 0,
          topValues: sorted.slice(0, 10).map(([value, count]) => ({ value, count })),
        };
      }
    }

    res.json({
      success: true,
      data: {
        total_rows: rows.length,
        columns: columns.map((c) => c.name),
        column_meta: columns,
        summary,
        numeric_summary: Object.fromEntries(
          columns.filter((c) => c.type === 'numeric').map((c) => [c.name, summary[c.name]])
        ),
        categorical_summary: Object.fromEntries(
          columns.filter((c) => c.type === 'categorical').map((c) => [c.name, summary[c.name]])
        ),
      },
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:datasetId/distribution/:column
// ---------------------------------------------------------------------------
router.get('/:datasetId/distribution/:column', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const colName = req.params.column;
    const colMeta = columns.find((c) => c.name === colName);
    if (!colMeta) return res.status(404).json({ success: false, error: `Column "${colName}" not found` });

    if (colMeta.type === 'numeric') {
      const vals = numericValues(rows, colName);
      if (vals.length === 0) return res.json({ success: true, data: { type: 'numeric', bins: [] } });

      const lo = min(vals);
      const hi = max(vals);
      const binCount = 10;
      const binWidth = (hi - lo) / binCount || 1; // avoid /0 when all values identical

      // Initialise bins
      const bins = Array.from({ length: binCount }, (_, i) => ({
        bin: `${(lo + i * binWidth).toFixed(2)}-${(lo + (i + 1) * binWidth).toFixed(2)}`,
        rangeStart: lo + i * binWidth,
        rangeEnd: lo + (i + 1) * binWidth,
        count: 0,
      }));

      for (const v of vals) {
        let idx = Math.floor((v - lo) / binWidth);
        if (idx >= binCount) idx = binCount - 1; // inclusive upper edge
        bins[idx].count++;
      }

      return res.json({ success: true, data: { type: 'numeric', bins } });
    }

    // Categorical — value counts sorted desc
    const counts = valueCounts(rows, colName);
    const distribution = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));

    res.json({ success: true, data: { type: 'categorical', distribution } });
  } catch (err) {
    console.error('Distribution error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:datasetId/correlation
// ---------------------------------------------------------------------------
router.get('/:datasetId/correlation', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const numCols = columns.filter((c) => c.type === 'numeric').map((c) => c.name);

    if (numCols.length < 2) {
      return res.status(400).json({ success: false, error: 'Need at least 2 numeric columns for correlation' });
    }

    // Build arrays per column (aligned, skip rows where either is null)
    const matrix = {};
    for (const a of numCols) {
      matrix[a] = {};
      for (const b of numCols) {
        if (a === b) {
          matrix[a][b] = 1;
          continue;
        }
        // Pair-wise filter: both must be non-null
        const pairs = rows
          .map((r) => [r[a], r[b]])
          .filter(([va, vb]) => va !== null && vb !== null && Number.isFinite(va) && Number.isFinite(vb));

        if (pairs.length < 2) {
          matrix[a][b] = null;
          continue;
        }

        const xs = pairs.map((p) => p[0]);
        const ys = pairs.map((p) => p[1]);

        // Guard: if either series has zero variance, correlation is undefined
        const sdX = standardDeviation(xs);
        const sdY = standardDeviation(ys);
        if (sdX === 0 || sdY === 0) {
          matrix[a][b] = 0;
          continue;
        }

        matrix[a][b] = sampleCorrelation(xs, ys);
      }
    }

    res.json({ success: true, data: { columns: numCols, matrix } });
  } catch (err) {
    console.error('Correlation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:datasetId/group/:groupBy/:metric?agg=mean|sum|count|max|min
// ---------------------------------------------------------------------------
router.get('/:datasetId/group/:groupBy/:metric', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const { groupBy, metric } = req.params;
    const agg = req.query.agg || 'mean';

    if (!columns.find((c) => c.name === groupBy)) {
      return res.status(404).json({ success: false, error: `Column "${groupBy}" not found` });
    }
    if (!columns.find((c) => c.name === metric)) {
      return res.status(404).json({ success: false, error: `Column "${metric}" not found` });
    }

    // Bucket rows by groupBy value
    const groups = {};
    for (const row of rows) {
      const key = row[groupBy] ?? '(empty)';
      if (!groups[key]) groups[key] = [];
      const v = row[metric];
      if (v !== null && v !== undefined && Number.isFinite(Number(v))) {
        groups[key].push(Number(v));
      }
    }

    const result = Object.entries(groups).map(([group, vals]) => {
      let value;
      switch (agg) {
        case 'sum':
          value = vals.reduce((s, v) => s + v, 0);
          break;
        case 'count':
          value = vals.length;
          break;
        case 'max':
          value = vals.length ? max(vals) : null;
          break;
        case 'min':
          value = vals.length ? min(vals) : null;
          break;
        case 'mean':
        default:
          value = vals.length ? mean(vals) : null;
          break;
      }
      return { group, value };
    });

    // Sort by value descending (nulls last)
    result.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Group error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:datasetId/top/:column — top 10 entries by a numeric column desc
// ---------------------------------------------------------------------------
router.get('/:datasetId/top/:column', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const colName = req.params.column;
    const colMeta = columns.find((c) => c.name === colName);
    if (!colMeta) return res.status(404).json({ success: false, error: `Column "${colName}" not found` });
    if (colMeta.type !== 'numeric') {
      return res.status(400).json({ success: false, error: `Column "${colName}" is not numeric` });
    }

    const sorted = [...rows]
      .filter((r) => r[colName] !== null && Number.isFinite(r[colName]))
      .sort((a, b) => b[colName] - a[colName])
      .slice(0, 10);

    res.json({ success: true, data: sorted });
  } catch (err) {
    console.error('Top error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:datasetId/compare/:col1/:col2 — scatter data for two columns
// ---------------------------------------------------------------------------
router.get('/:datasetId/compare/:col1/:col2', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const { col1, col2 } = req.params;

    if (!columns.find((c) => c.name === col1)) {
      return res.status(404).json({ success: false, error: `Column "${col1}" not found` });
    }
    if (!columns.find((c) => c.name === col2)) {
      return res.status(404).json({ success: false, error: `Column "${col2}" not found` });
    }

    // Find first categorical or "name"-ish column for labels
    const labelCol =
      columns.find((c) => c.type === 'categorical' && /name/i.test(c.name)) ||
      columns.find((c) => c.type === 'categorical');

    const data = rows
      .filter((r) => r[col1] !== null && r[col2] !== null)
      .map((r) => ({
        x: r[col1],
        y: r[col2],
        label: labelCol ? r[labelCol.name] : String(r._id),
      }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Compare error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:datasetId/zomato-insights — 6 core business questions answered
// ---------------------------------------------------------------------------
router.get('/:datasetId/zomato-insights', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const findCol = (keywords) => {
      const match = columns.find((c) =>
        keywords.some((k) => c.name.toLowerCase().includes(k.toLowerCase()))
      );
      return match ? match.name : null;
    };

    const typeCol = findCol(['listed_in(type)', 'listed_in', 'rest_type', 'type']);
    const onlineCol = findCol(['online_order', 'online']);
    const rateCol = findCol(['rate', 'rating']);
    const votesCol = findCol(['votes', 'vote']);
    const costCol = findCol(['approx_cost', 'cost']);

    const insights = {};

    // Q1: What type of restaurant do the majority of customers order from?
    if (typeCol) {
      const counts = {};
      for (const r of rows) {
        const t = r[typeCol] || 'Other';
        counts[t] = (counts[t] || 0) + 1;
      }
      const sortedTypes = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      insights.q1 = {
        question: 'What type of restaurant do the majority of customers order from?',
        majorityType: sortedTypes[0]?.name || 'N/A',
        majorityCount: sortedTypes[0]?.count || 0,
        data: sortedTypes,
      };
    }

    // Q2: How many votes has each type of restaurant received from customers?
    if (typeCol && votesCol) {
      const votesByType = {};
      for (const r of rows) {
        const t = r[typeCol] || 'Other';
        const v = Number(r[votesCol]) || 0;
        votesByType[t] = (votesByType[t] || 0) + v;
      }
      const sortedVotes = Object.entries(votesByType)
        .map(([name, totalVotes]) => ({ name, totalVotes }))
        .sort((a, b) => b.totalVotes - a.totalVotes);
      insights.q2 = {
        question: 'How many votes has each type of restaurant received from customers?',
        data: sortedVotes,
      };
    }

    // Q3: What are the ratings that the majority of restaurants have received?
    if (rateCol) {
      const rateCounts = {};
      const validRates = [];
      for (const r of rows) {
        const val = r[rateCol];
        if (val !== null && Number.isFinite(val)) {
          const rounded = val.toFixed(1);
          rateCounts[rounded] = (rateCounts[rounded] || 0) + 1;
          validRates.push(val);
        }
      }
      const sortedRatings = Object.entries(rateCounts)
        .map(([rating, count]) => ({ rating, count }))
        .sort((a, b) => b.count - a.count);
      insights.q3 = {
        question: 'What are the ratings that the majority of restaurants have received?',
        majorityRating: sortedRatings[0]?.rating || 'N/A',
        majorityCount: sortedRatings[0]?.count || 0,
        averageRating: validRates.length ? Number(mean(validRates).toFixed(2)) : null,
        data: sortedRatings.sort((a, b) => parseFloat(a.rating) - parseFloat(b.rating)),
      };
    }

    // Q4: Average spending for online orders (couples / 2 people)
    if (onlineCol && costCol) {
      const onlineCosts = rows
        .filter((r) => String(r[onlineCol]).toLowerCase() === 'yes')
        .map((r) => r[costCol])
        .filter((c) => c !== null && Number.isFinite(c));
      const avgOnlineCost = onlineCosts.length ? Number(mean(onlineCosts).toFixed(2)) : null;
      insights.q4 = {
        question: 'What is the average spending on each order for couples ordering online?',
        averageSpending: avgOnlineCost,
        currency: '₹',
        sampleSize: onlineCosts.length,
      };
    }

    // Q5: Which mode (online or offline) has received maximum rating?
    if (onlineCol && rateCol) {
      const onlineRates = rows
        .filter((r) => String(r[onlineCol]).toLowerCase() === 'yes')
        .map((r) => r[rateCol])
        .filter((v) => v !== null && Number.isFinite(v));
      const offlineRates = rows
        .filter((r) => String(r[onlineCol]).toLowerCase() === 'no')
        .map((r) => r[rateCol])
        .filter((v) => v !== null && Number.isFinite(v));

      const avgOnline = onlineRates.length ? Number(mean(onlineRates).toFixed(2)) : 0;
      const avgOffline = offlineRates.length ? Number(mean(offlineRates).toFixed(2)) : 0;
      const maxOnline = onlineRates.length ? max(onlineRates) : 0;
      const maxOffline = offlineRates.length ? max(offlineRates) : 0;

      insights.q5 = {
        question: 'Which mode (online or offline) has received the maximum rating?',
        winner: avgOnline >= avgOffline ? 'Online' : 'Offline',
        online: { average: avgOnline, max: maxOnline, count: onlineRates.length },
        offline: { average: avgOffline, max: maxOffline, count: offlineRates.length },
      };
    }

    // Q6: Which type of restaurant received more offline orders?
    if (typeCol && onlineCol) {
      const offlineByType = {};
      for (const r of rows) {
        if (String(r[onlineCol]).toLowerCase() === 'no') {
          const t = r[typeCol] || 'Other';
          offlineByType[t] = (offlineByType[t] || 0) + 1;
        }
      }
      const sortedOffline = Object.entries(offlineByType)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      insights.q6 = {
        question: 'Which type of restaurant received more offline orders (for offering discounts)?',
        targetType: sortedOffline[0]?.name || 'N/A',
        count: sortedOffline[0]?.count || 0,
        data: sortedOffline,
      };
    }

    res.json({ success: true, data: insights });
  } catch (err) {
    console.error('Zomato insights error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

