/**
 * Unit tests for physics engine calculations
 */

import { describe, it, expect } from 'vitest';
import {
  G,
  simulate,
  calculateMeanE,
  calculatePercentError,
  getCalculationSteps,
  explainCollision,
} from './physics';

describe('Physics Engine: Collision of Elastic Bodies', () => {
  it('correctly calculates pre-impact velocity UA = √(2gh)', () => {
    const h = 0.5; // m
    const expectedUA = Math.sqrt(2 * G * h);
    const result = simulate({
      h,
      y: 0.8,
      mA: 0.1,
      mB: 0.1,
      e: 0.8,
      noiseAmplitude: 0,
    });

    expect(result.UA).toBeCloseTo(expectedUA, 5);
    expect(result.UB).toBe(0);
  });

  it('correctly calculates time of flight t = √(2y/g)', () => {
    const y = 0.8; // m
    const expectedT = Math.sqrt((2 * y) / G);
    const result = simulate({
      h: 0.4,
      y,
      mA: 0.05,
      mB: 0.05,
      e: 0.7,
      noiseAmplitude: 0,
    });

    expect(result.t).toBeCloseTo(expectedT, 5);
  });

  it('conserves momentum in theoretical collision (p_before === p_after)', () => {
    const result = simulate({
      h: 0.35,
      y: 0.75,
      mA: 0.15,
      mB: 0.25,
      e: 0.65,
      noiseAmplitude: 0,
    });

    expect(result.p_after).toBeCloseTo(result.p_before, 5);
  });

  it('computes exact e for zero noise', () => {
    const inputE = 0.75;
    const result = simulate({
      h: 0.45,
      y: 0.9,
      mA: 0.08,
      mB: 0.08,
      e: inputE,
      noiseAmplitude: 0,
    });

    expect(result.e_calc).toBeCloseTo(inputE, 4);
  });

  it('handles completely elastic collision (e = 1) with equal masses', () => {
    // When mA = mB and e = 1, velocities exchange: VA = 0, VB = UA
    const result = simulate({
      h: 0.5,
      y: 0.8,
      mA: 0.1,
      mB: 0.1,
      e: 1.0,
      noiseAmplitude: 0,
    });

    expect(result.VA).toBeCloseTo(0, 5);
    expect(result.VB).toBeCloseTo(result.UA, 5);
    expect(result.ke_after).toBeCloseTo(result.ke_before, 5);
  });

  it('calculates mean e and percent error accurately', () => {
    const trials = [0.72, 0.74, 0.71, 0.73];
    const mean = calculateMeanE(trials);
    expect(mean).toBeCloseTo(0.725, 3);

    const ref = 0.75;
    const err = calculatePercentError(mean, ref);
    expect(err).toBeCloseTo(((0.75 - 0.725) / 0.75) * 100, 3);
  });

  it('generates step-by-step calculation strings', () => {
    const input = { h: 0.5, y: 0.8, mA: 0.1, mB: 0.1, e: 0.8, noiseAmplitude: 0 };
    const res = simulate(input);
    const steps = getCalculationSteps(res, input);

    expect(steps.length).toBeGreaterThan(5);
    expect(steps[0]).toContain('UA = √(2 × g × h)');
  });

  it('provides qualitative collision explanation', () => {
    const input = { h: 0.5, y: 0.8, mA: 0.1, mB: 0.1, e: 0.8, noiseAmplitude: 0 };
    const res = simulate(input);
    const text = explainCollision(res, input);

    expect(typeof text).toBe('string');
    expect(text).toContain('Ball A');
    expect(text).toContain('Ball B');
  });
});
