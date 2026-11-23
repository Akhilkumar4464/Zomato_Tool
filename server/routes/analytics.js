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
// Middleware — resolve dataset and attach to req
// ---------------------------------------------------------------------------
function resolveDataset(req, res, next) {
  const ds = dataStore.get(req.params.datasetId);
  if (!ds) return res.status(404).json({ success: false, error: 'Dataset not found' });
  if (ds.rows.length === 0) return res.status(400).json({ success: false, error: 'Dataset is empty' });
  req.dataset = ds;
  next();
}

router.use('/:datasetId', resolveDataset);

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

    res.json({ success: true, data: summary });
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

export default router;

