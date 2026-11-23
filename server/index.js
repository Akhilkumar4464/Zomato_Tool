import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { existsSync, mkdirSync, createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import csvParser from 'csv-parser';

import uploadRoutes from './routes/upload.js';
import analyticsRoutes from './routes/analytics.js';
import predictRoutes from './routes/predict.js';
import adminRoutes from './routes/admin.js';
import { dataStore } from './store.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = join(__dirname, 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// Function to auto-seed sample dataset if sample_data.csv exists
function seedSampleData() {
  const samplePath = join(__dirname, 'sample_data.csv');
  if (!existsSync(samplePath)) return;

  const rows = [];
  createReadStream(samplePath)
    .pipe(csvParser())
    .on('data', (r) => rows.push(r))
    .on('end', () => {
      if (rows.length === 0) return;
      const colNames = Object.keys(rows[0]);
      const sample = rows.slice(0, 10);

      const columns = colNames.map((name) => {
        let numericCount = 0;
        for (const r of sample) {
          let v = String(r[name] || '').trim();
          if (v.includes('/')) v = v.split('/')[0].trim();
          v = v.replace(/,/g, '');
          if (v !== '' && Number.isFinite(parseFloat(v))) numericCount++;
        }
        return {
          name,
          type: numericCount / sample.length >= 0.5 ? 'numeric' : 'categorical',
        };
      });

      const cleanedRows = rows.map((r, idx) => {
        const cleaned = { _id: idx };
        for (const col of columns) {
          let v = String(r[col.name] ?? '').trim();
          if (v.includes('/')) v = v.split('/')[0].trim();
          v = v.replace(/,/g, '');
          if (col.type === 'numeric') {
            const n = parseFloat(v);
            cleaned[col.name] = Number.isFinite(n) ? n : null;
          } else {
            cleaned[col.name] = v;
          }
        }
        return cleaned;
      });

      const defaultId = 'zomato-default';
      dataStore.set(defaultId, {
        id: defaultId,
        filename: 'zomato_bangalore.csv',
        uploadedAt: new Date().toISOString(),
        columns,
        rows: cleanedRows,
      });
      console.log(`✅ Seeded sample dataset "${defaultId}" with ${cleanedRows.length} rows.`);
    })
    .on('error', (err) => {
      console.warn('Sample seed error:', err.message);
    });
}

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// --- Routes ---
app.use('/api', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Zomato Tool server running on http://localhost:${PORT}`);
  seedSampleData();
});

