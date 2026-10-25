/**
 * Physics utilities for Experiment 5: Collision of Elastic Bodies
 * Direct Central Impact – Coefficient of Restitution
 *
 * All formulas match the lab manual exactly.
 * g = 9.81 m/s²
 */

export const G = 9.81; // m/s²

export interface SimulationInput {
  h: number;  // release height of ball A (m)
  y: number;  // height above ground (m)
  mA: number; // mass of ball A (kg)
  mB: number; // mass of ball B (kg)
  e: number;  // coefficient of restitution (set value)
  noiseAmplitude?: number; // metres of measurement noise (realistic mode)
}

export interface SimulationResult {
  // Pre-impact velocities
  UA: number; // velocity of A before impact (m/s) = √(2gh)
  UB: number; // velocity of B before impact = 0

  // Post-impact velocities (theoretical)
  VA_theory: number; // V_A = (mA - e·mB)·UA / (mA+mB)
  VB_theory: number; // V_B = mA·(1+e)·UA / (mA+mB)

  // Time of flight
  t: number;  // t = √(2y/g)

  // Landing distances (may include noise)
  XA: number; // X_A = VA·t
  XB: number; // X_B = VB·t

  // Back-calculated velocities from X (lab method)
  VA: number; // V_A = X_A / t
  VB: number; // V_B = X_B / t

  // Calculated e from the lab method
  e_calc: number; // e = -(VA - VB) / (UA - UB)

  // Momentum
  p_before: number; // mA·UA + mB·UB
  p_after:  number; // mA·VA + mB·VB

  // KE
  ke_before: number;
  ke_after:  number;
}

/**
 * Run the full collision simulation
 *
 * @param input - Simulation parameters
 * @returns All computed physics values
 */
export function simulate(input: SimulationInput): SimulationResult {
  const { h, y, mA, mB, e, noiseAmplitude = 0 } = input;

  // ── Pre-impact ───────────────────────────────────────────────────────────
  const UA = Math.sqrt(2 * G * h);         // Energy conservation on ramp
  const UB = 0;

  // ── Post-impact (theoretical) ────────────────────────────────────────────
  const denom = mA + mB;
  const VA_theory = ((mA - e * mB) * UA) / denom;
  const VB_theory = (mA * (1 + e) * UA) / denom;

  // ── Time of flight ───────────────────────────────────────────────────────
  const t = Math.sqrt((2 * y) / G);

  // ── Projectile distances (with optional measurement noise) ───────────────
  function applyNoise(value: number): number {
    if (noiseAmplitude === 0) return value;
    const noise = (Math.random() * 2 - 1) * noiseAmplitude;
    return Math.max(0, value + noise);
  }

  const XA = applyNoise(VA_theory * t);
  const XB = applyNoise(VB_theory * t);

  // ── Back-calculate velocities from landing positions (lab method) ────────
  const VA = XA / t;
  const VB = XB / t;

  // ── Coefficient of restitution ───────────────────────────────────────────
  // e = -(VA - VB) / (UA - UB)
  // Since UB = 0: e = (VB - VA) / UA
  const e_calc = (UB - UA) === 0 ? 0 : -(VA - VB) / (UA - UB);

  // ── Momentum ─────────────────────────────────────────────────────────────
  const p_before = mA * UA + mB * UB;
  const p_after  = mA * VA + mB * VB;

  // ── Kinetic Energy ────────────────────────────────────────────────────────
  const ke_before = 0.5 * mA * UA ** 2 + 0.5 * mB * UB ** 2;
  const ke_after  = 0.5 * mA * VA ** 2 + 0.5 * mB * VB ** 2;

  return {
    UA, UB,
    VA_theory, VB_theory,
    t,
    XA, XB,
    VA, VB,
    e_calc: Math.max(0, Math.min(e_calc, 1.2)), // clamp
    p_before, p_after,
    ke_before, ke_after,
  };
}

/**
 * Calculate mean e and percent error from a set of trials
 */
export function calculateMeanE(eValues: number[]): number {
  if (eValues.length === 0) return 0;
  return eValues.reduce((s, v) => s + v, 0) / eValues.length;
}

export function calculatePercentError(measured: number, reference: number): number {
  if (reference === 0) return 0;
  return ((Math.abs(measured - reference)) / reference) * 100;
}

/**
 * Get worked calculation steps (for the live panel)
 */
export function getCalculationSteps(result: SimulationResult, input: SimulationInput): string[] {
  const { UA, UB, VA, VB, XA, XB, t, e_calc } = result;
  const { h, y, e } = input;

  return [
    `UA = √(2 × g × h) = √(2 × ${G} × ${h.toFixed(3)}) = ${UA.toFixed(4)} m/s`,
    `UB = 0 m/s  (ball B initially at rest)`,
    `t = √(2y/g) = √(2 × ${y.toFixed(3)} / ${G}) = ${t.toFixed(4)} s`,
    `VA = XA / t = ${XA.toFixed(4)} / ${t.toFixed(4)} = ${VA.toFixed(4)} m/s`,
    `VB = XB / t = ${XB.toFixed(4)} / ${t.toFixed(4)} = ${VB.toFixed(4)} m/s`,
    `e = -(VA − VB) / (UA − UB)`,
    `e = −(${VA.toFixed(4)} − ${VB.toFixed(4)}) / (${UA.toFixed(4)} − ${UB})`,
    `e = ${e_calc.toFixed(4)}   (set: ${e.toFixed(2)})`,
  ];
}

/**
 * Describe what happened physically (for "Explain what happened")
 */
export function explainCollision(result: SimulationResult, input: SimulationInput): string {
  const { UA, VA, VB, e_calc } = result;
  const { mA, mB, e } = input;

  let description = '';

  if (e >= 0.9) {
    description = 'This was a near-perfectly elastic collision. Most kinetic energy was conserved.';
  } else if (e <= 0.1) {
    description = 'This was a near-perfectly plastic collision. The balls barely separated after impact.';
  } else {
    description = `This was a real (partially elastic) collision with e ≈ ${e_calc.toFixed(3)}.`;
  }

  const directionA = VA < 0 ? 'bounced back' : VA < 0.01 ? 'stopped' : 'continued forward';
  const energyLoss = Math.round((1 - (result.ke_after / result.ke_before)) * 100);

  return (
    `${description} ` +
    `Ball A (${mA} kg) ${directionA} at ${Math.abs(VA).toFixed(3)} m/s. ` +
    `Ball B (${mB} kg) moved forward at ${VB.toFixed(3)} m/s. ` +
    `${energyLoss}% of kinetic energy was lost to heat, sound, and deformation.`
  );
}
