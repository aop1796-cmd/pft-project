import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app';

describe('Server API Endpoints', () => {
  it('GET /api/health should return 200 OK and health info', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Virtual Mechanics Lab API is running');
  });

  it('GET /api/nonexistent should return 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
