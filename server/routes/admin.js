import { Router } from 'express';
import { dataStore } from '../store.js';

const router = Router();

// ---------------------------------------------------------------------------
// Parameter middleware — resolve dataset
// ---------------------------------------------------------------------------
router.param('datasetId', (req, res, next, datasetId) => {
  const ds = dataStore.get(datasetId);
  if (!ds) return res.status(404).json({ success: false, error: 'Dataset not found' });
  req.dataset = ds;
  next();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape a value for CSV output */
function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---------------------------------------------------------------------------
// GET /:datasetId/rows?page=1&limit=20 — paginated rows
// ---------------------------------------------------------------------------
router.get('/:datasetId/rows', (req, res) => {
  try {
    const { rows } = req.dataset;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20, 500));
    const total = rows.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const pageRows = rows.slice(start, start + limit);

    res.json({ success: true, data: { rows: pageRows, total, page, totalPages } });
  } catch (err) {
    console.error('Get rows error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /:datasetId/rows — add a new row
// ---------------------------------------------------------------------------
router.post('/:datasetId/rows', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, error: 'Request body must be a JSON object' });
    }

    // Build a new row with an _id, coercing types as needed
    let maxId = 0;
    for (const r of rows) {
      if (typeof r._id === 'number' && r._id > maxId) maxId = r._id;
    }
    const newRow = { _id: maxId + 1 };
    for (const col of columns) {
      const raw = body[col.name];
      if (col.type === 'numeric') {
        const n = parseFloat(raw);
        newRow[col.name] = Number.isFinite(n) ? n : null;
      } else {
        newRow[col.name] = raw !== undefined ? String(raw) : '';
      }
    }

    rows.push(newRow);

    res.status(201).json({ success: true, data: newRow });
  } catch (err) {
    console.error('Add row error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /:datasetId/rows/:rowIndex — update a row by index
// ---------------------------------------------------------------------------
router.put('/:datasetId/rows/:rowIndex', (req, res) => {
  try {
    const { columns, rows } = req.dataset;
    const idx = parseInt(req.params.rowIndex, 10);

    if (isNaN(idx) || idx < 0 || idx >= rows.length) {
      return res.status(404).json({ success: false, error: `Row index ${req.params.rowIndex} out of range` });
    }

    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, error: 'Request body must be a JSON object' });
    }

    const row = rows[idx];
    for (const col of columns) {
      if (body[col.name] === undefined) continue; // only update provided fields
      if (col.type === 'numeric') {
        const n = parseFloat(body[col.name]);
        row[col.name] = Number.isFinite(n) ? n : null;
      } else {
        row[col.name] = String(body[col.name]);
      }
    }

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('Update row error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:datasetId/rows/:rowIndex — delete a row by index
// ---------------------------------------------------------------------------
router.delete('/:datasetId/rows/:rowIndex', (req, res) => {
  try {
    const { rows } = req.dataset;
    const idx = parseInt(req.params.rowIndex, 10);

    if (isNaN(idx) || idx < 0 || idx >= rows.length) {
      return res.status(404).json({ success: false, error: `Row index ${req.params.rowIndex} out of range` });
    }

    const [deleted] = rows.splice(idx, 1);

    res.json({ success: true, data: { message: 'Row deleted', row: deleted } });
  } catch (err) {
    console.error('Delete row error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:datasetId/export — export dataset as CSV
// ---------------------------------------------------------------------------
router.get('/:datasetId/export', (req, res) => {
  try {
    const { columns, rows, filename } = req.dataset;
    const colNames = columns.map((c) => c.name);

    // Build CSV
    const header = colNames.map(csvEscape).join(',');
    const lines = rows.map((row) =>
      colNames.map((name) => csvEscape(row[name])).join(',')
    );
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'export.csv'}"`);
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

