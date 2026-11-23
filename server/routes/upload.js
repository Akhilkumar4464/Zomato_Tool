import { Router } from 'express';
import multer from 'multer';
import csvParser from 'csv-parser';
import { createReadStream, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dataStore } from '../store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Configure multer to store uploads in server/uploads/
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, join(__dirname, '..', 'uploads')),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clean a raw string value:
 *  - Strips surrounding quotes/whitespace
 *  - Converts rate-style values like "4.1/5" → 4.1
 */
function cleanValue(raw) {
  if (raw === null || raw === undefined) return '';
  let v = String(raw).trim();
  // Handle rate-style "4.1/5"
  if (/^\d+(\.\d+)?\/\d+(\.\d+)?$/.test(v)) {
    v = v.split('/')[0];
  }
  return v;
}

/**
 * Detect whether a column is numeric or categorical by sampling values.
 * If >80 % of non-empty sampled values parse as finite numbers → numeric.
 */
function detectColumnType(sampleValues) {
  const nonEmpty = sampleValues.filter((v) => v !== '' && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return 'categorical';

  let numericCount = 0;
  for (const v of nonEmpty) {
    const cleaned = cleanValue(v);
    if (cleaned === '') continue;
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) numericCount++;
  }
  return numericCount / nonEmpty.length > 0.8 ? 'numeric' : 'categorical';
}

// ---------------------------------------------------------------------------
// POST /api/upload — upload & parse a CSV
// ---------------------------------------------------------------------------
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const rows = [];

    // Parse CSV into array of row objects
    await new Promise((resolve, reject) => {
      createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length === 0) {
      unlinkSync(filePath);
      return res.status(400).json({ success: false, error: 'CSV file is empty or has no valid rows' });
    }

    // Detect column types by sampling first 10 rows
    const columnNames = Object.keys(rows[0]);
    const sampleRows = rows.slice(0, 10);
    const columns = columnNames.map((name) => ({
      name,
      type: detectColumnType(sampleRows.map((r) => r[name])),
    }));

    // Clean all values in every row & cast numerics
    const cleanedRows = rows.map((row, idx) => {
      const cleaned = { _id: idx };
      for (const col of columns) {
        const raw = cleanValue(row[col.name]);
        if (col.type === 'numeric') {
          const n = parseFloat(raw);
          cleaned[col.name] = Number.isFinite(n) ? n : null;
        } else {
          cleaned[col.name] = raw;
        }
      }
      return cleaned;
    });

    // Store dataset
    const datasetId = String(Date.now());
    dataStore.set(datasetId, {
      id: datasetId,
      filename: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      columns,
      rows: cleanedRows,
    });

    // Optionally remove temp file (data is in memory now)
    try { unlinkSync(filePath); } catch { /* ignore */ }

    return res.json({
      success: true,
      data: {
        datasetId,
        columns,
        rowCount: cleanedRows.length,
        preview: cleanedRows.slice(0, 5),
      },
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/datasets — list all uploaded datasets
// ---------------------------------------------------------------------------
router.get('/datasets', (_req, res) => {
  const list = [];
  for (const [id, ds] of dataStore) {
    list.push({
      id,
      filename: ds.filename,
      rowCount: ds.rows.length,
      uploadedAt: ds.uploadedAt,
    });
  }
  res.json({ success: true, data: list });
});

// ---------------------------------------------------------------------------
// GET /api/datasets/:id — full data for a dataset
// ---------------------------------------------------------------------------
router.get('/datasets/:id', (req, res) => {
  const ds = dataStore.get(req.params.id);
  if (!ds) return res.status(404).json({ success: false, error: 'Dataset not found' });
  res.json({ success: true, data: ds });
});

// ---------------------------------------------------------------------------
// DELETE /api/datasets/:id — delete a dataset
// ---------------------------------------------------------------------------
router.delete('/datasets/:id', (req, res) => {
  if (!dataStore.has(req.params.id)) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  dataStore.delete(req.params.id);
  res.json({ success: true, data: { message: 'Dataset deleted' } });
});

export default router;

