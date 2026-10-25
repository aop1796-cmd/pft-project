/**
 * Express application entry point
 * Virtual Mechanics Lab – Experiment 5 API
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';

import { authRouter } from './routes/auth';
import { trialsRouter } from './routes/trials';
import { materialsRouter } from './routes/materials';
import { quizRouter } from './routes/quiz';
import { reportsRouter } from './routes/reports';
import { teacherRouter } from './routes/teacher';
import { adminRouter } from './routes/admin';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();

// ── Security ──────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // CSP handled by frontend
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Rate Limiting ─────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// ── Middleware ────────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health Check ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Virtual Mechanics Lab API is running', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/trials', trialsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/admin', adminRouter);

// ── Error Handlers ────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
