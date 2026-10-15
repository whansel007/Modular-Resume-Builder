import express from 'express';
import mongoose from 'mongoose';
import dns from 'dns';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import blocksRouter from './routes/blocks.js';
import resumesRouter from './routes/resumes.js';
import authRouter from './routes/auth.js';
import tagsRouter from './routes/tags.js';
import defaultsRouter from './routes/defaults.js';
import accountRouter from './routes/account.js';
import extractKeywordsRouter from './routes/extractKeywords.js';
import autofillResumeRouter from './routes/autofillResume.js';
import resumeChatRouter from './routes/resumeChat.js';
import importResumeRouter from './routes/importResume.js';
import autoparseBlockRouter from './routes/autoparseBlock.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const dnsServers = (process.env.DNS_SERVERS || '223.5.5.5,119.29.29.29')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers.length) {
  dns.setServers(dnsServers);
}

if (!process.env.JWT_SECRET) {
  console.error('Missing required environment variable: JWT_SECRET');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/resume-builder';

// Restrict cross-origin browser access to the API. Same-origin requests
// (Vercel rewrites, the Vite dev proxy) are unaffected; only browsers from
// other origins are blocked.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRouter);
app.use('/api/blocks', blocksRouter);
app.use('/api/resumes', resumesRouter);
app.use('/api/user/tags', tagsRouter);
app.use('/api/user/defaults', defaultsRouter);
app.use('/api/user', accountRouter);
app.use('/api/extract-keywords', extractKeywordsRouter);
app.use('/api/autofill-resume', autofillResumeRouter);
app.use('/api/resume-chat', resumeChatRouter);
app.use('/api/import-resume', importResumeRouter);
app.use('/api/autoparse-block', autoparseBlockRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
