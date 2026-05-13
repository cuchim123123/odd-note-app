const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'apps', 'api', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_.]/g, '_');
    cb(null, `${ts}-${safe}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
const PORT = process.env.API_PORT || 4000;

app.post('/uploads', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `http://localhost:${PORT}/uploads/${encodeURIComponent(req.file.filename)}`;
  res.json({ url, filename: req.file.filename });
});

app.use('/uploads', express.static(UPLOADS_DIR));

app.listen(PORT, () => console.log(`Simple upload server listening on http://localhost:${PORT}`));
