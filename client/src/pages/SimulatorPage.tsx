/**
 * Simulator Page
 * Canvas-based physics simulation of direct central impact
 * Features:
 *  - Accurate Impact Apparatus matching lab manual diagram (Experiment 05)
 *  - Ball A resting on the inclined ramp at Position 1 with correct contact normal
 *  - Ball B resting on the horizontal track lip at Position 2
 *  - Smooth tangent curve from straight incline to horizontal track
 *  - Plumb line from Position 2, horizontal dashed x-axis arrow, and vertical y-axis
 *  - Side-by-side Release and Restart buttons beside the diagram
 *  - Enlarged canvas (height 500px) and detailed X & Y Axis Trajectory Table
 *  - Exactly two ball references (Glass and Steel) with independent materials for Ball A & Ball B
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { simulate, SimulationResult, explainCollision, getCalculationSteps, G } from '../utils/physics';
import { useTrialsStore } from '../stores/trialsStore';

// ── Ball Material Types & Specifications ─────────────────────────────────────
export type BallMaterial = 'Glass' | 'Steel';

export interface BallMaterialInfo {
  name: BallMaterial;
  refE: number;
  density: number;        // kg/m^3
  defaultMass: number;    // kg
  color: string;
  glowColor: string;
  description: string;
  modulus: string;
}

export const BALL_MATERIALS: Record<BallMaterial, BallMaterialInfo> = {
  Glass: {
    name: 'Glass',
    refE: 0.95,
    density: 2500,
    defaultMass: 0.035,
    color: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.4)',
    description: 'Borosilicate Glass Marble',
    modulus: '64 GPa',
  },
  Steel: {
    name: 'Steel',
    refE: 0.90,
    density: 7800,
    defaultMass: 0.065,
    color: '#CBD5E1',
    glowColor: 'rgba(203, 213, 225, 0.35)',
    description: 'High-Carbon Steel Ball',
    modulus: '200 GPa',
  },
};

/**
 * Theoretical coefficient of restitution for a pair of materials
 */
export function getPairReferenceE(matA: BallMaterial, matB: BallMaterial): number {
  if (matA === 'Glass' && matB === 'Glass') return 0.95;
  if (matA === 'Steel' && matB === 'Steel') return 0.90;
  // Glass & Steel impact: sqrt(0.95 * 0.90) ≈ 0.925
  return 0.925;
}

// ── Canvas Renderer ───────────────────────────────────────────────────────────

interface DrawSimulatorParams {
  h: number; // release height (m)
  y: number; // table height (m)
  mA: number; // mass A (kg)
  mB: number; // mass B (kg)
  materialA: BallMaterial;
  materialB: BallMaterial;
  animProgress: number; // 0 = idle, 0..0.5 = sliding down ramp, 0.5..1.0 = projectile phase
  result: SimulationResult | null;
  isAnimating: boolean;
  showTrails: boolean;
}

function drawSimulator(canvas: HTMLCanvasElement, params: DrawSimulatorParams) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Background gradient: dark laboratory aesthetic
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0c0d18');
  bg.addColorStop(0.6, '#090a10');
  bg.addColorStop(1, '#050608');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid dots
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  for (let x = 0; x < W; x += 30) {
    for (let y = 0; y < H; y += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Layout Geometry ────────────────────────────────────────────────────────
  const MARGIN_LEFT = 45;
  const MARGIN_RIGHT = 35;
  const GROUND_Y = H - 55;

  // Position 2 (horizontal platform exit edge)
  const TABLE_X = Math.round(W * 0.36);

  // Table height scaled proportionally from y (0.30 m - 1.00 m)
  const normY = Math.max(0, Math.min(1, (params.y - 0.30) / (1.00 - 0.30)));
  const minTableH = H * 0.30;
  const maxTableH = H * 0.56;
  const tableHeightPx = minTableH + normY * (maxTableH - minTableH);
  const TABLE_Y = GROUND_Y - tableHeightPx;

  // Release height scaled from h (0.05 m - 0.50 m)
  const normH = Math.max(0, Math.min(1, (params.h - 0.05) / (0.50 - 0.05)));
  const maxRampPx = Math.min(TABLE_Y - 48, H * 0.38);
  const rampHeightPx = 35 + normH * (maxRampPx - 35);
  const Y_RELEASE = TABLE_Y - rampHeightPx;

  // Incline geometry:
  // Transition curve (fillet) connects the straight slope smoothly to the horizontal flat section
  const HORIZ_LEN = 38;
  const KNEE_X = TABLE_X - HORIZ_LEN;
  const R_CURVE = 62;
  const THETA = (34 * Math.PI) / 180; // 34 degree angle of incline
  const cosT = Math.cos(THETA);
  const sinT = Math.sin(THETA);
  const tanT = Math.tan(THETA);

  // Circle center of fillet arc
  const XC = KNEE_X;
  const YC = TABLE_Y - R_CURVE;

  // Fillet tangent point on incline
  const x_tan = XC - R_CURVE * sinT;
  const y_tan = YC + R_CURVE * cosT;

  // Top of ramp structure
  const Y_TOP = Math.max(32, TABLE_Y - maxRampPx - 26);
  let x_top = x_tan - (y_tan - Y_TOP) / tanT;
  if (x_top < MARGIN_LEFT) {
    x_top = MARGIN_LEFT;
  }

  // ── 1. IMPACT APPARATUS Header ─────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 11px JetBrains Mono, monospace';
  ctx.fillText('IMPACT APPARATUS', MARGIN_LEFT, 26);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN_LEFT, 31);
  ctx.lineTo(MARGIN_LEFT + 120, 31);
  ctx.stroke();
  ctx.restore();

  // ── 2. Apparatus Table & Support Stand ──────────────────────────────────────
  // Main vertical column under Position 2
  const colWidth = 14;
  const colLeft = TABLE_X - colWidth;
  const standGrad = ctx.createLinearGradient(colLeft, 0, colLeft + colWidth, 0);
  standGrad.addColorStop(0, '#334155');
  standGrad.addColorStop(0.4, '#475569');
  standGrad.addColorStop(1, '#1E293B');

  ctx.fillStyle = standGrad;
  ctx.fillRect(colLeft, TABLE_Y, colWidth, GROUND_Y - TABLE_Y);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1;
  ctx.strokeRect(colLeft, TABLE_Y, colWidth, GROUND_Y - TABLE_Y);

  // Base foot on the ground with leveling screws
  const footWidth = 44;
  const footLeft = TABLE_X - footWidth / 2 - 4;
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(footLeft, GROUND_Y - 5, footWidth, 5);
  ctx.strokeStyle = '#64748B';
  ctx.strokeRect(footLeft, GROUND_Y - 5, footWidth, 5);

  // Leveling screw feet
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(footLeft + 3, GROUND_Y, 6, 3);
  ctx.fillRect(footLeft + footWidth - 9, GROUND_Y, 6, 3);

  // Diagonal support strut under curved knee
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(KNEE_X - 10, TABLE_Y + 4);
  ctx.lineTo(colLeft, TABLE_Y + (GROUND_Y - TABLE_Y) * 0.45);
  ctx.stroke();

  // Table top mounting plate
  ctx.fillStyle = '#475569';
  ctx.fillRect(KNEE_X - 16, TABLE_Y, HORIZ_LEN + 18, 5);

  // ── 3. Ramp Guide Rails (Double-Rail Channel) ──────────────────────────────
  const BALL_R = 11;

  // Lower rail (depth shadow / secondary channel)
  const RAIL_OFFSET = 5.5;
  ctx.save();
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x_top + RAIL_OFFSET * sinT, Y_TOP + RAIL_OFFSET * cosT);
  ctx.lineTo(x_tan + RAIL_OFFSET * sinT, y_tan + RAIL_OFFSET * cosT);
  ctx.arc(XC, YC, R_CURVE + RAIL_OFFSET, Math.PI / 2 + THETA, Math.PI / 2, true);
  ctx.lineTo(TABLE_X, TABLE_Y + RAIL_OFFSET);
  ctx.stroke();

  // Cross-struts / ties connecting rails
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 1.2;
  const numTies = 10;
  for (let i = 0; i <= numTies; i++) {
    const tFrac = i / numTies;
    const tieX = x_top + tFrac * (x_tan - x_top);
    const tieY = Y_TOP + tFrac * (y_tan - Y_TOP);
    ctx.beginPath();
    ctx.moveTo(tieX, tieY);
    ctx.lineTo(tieX + RAIL_OFFSET * sinT, tieY + RAIL_OFFSET * cosT);
    ctx.stroke();
  }

  // Upper main guide rail (amber glow)
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x_top, Y_TOP);
  ctx.lineTo(x_tan, y_tan);
  // Fillet arc from theta to horizontal (0)
  ctx.arc(XC, YC, R_CURVE, Math.PI / 2 + THETA, Math.PI / 2, true);
  ctx.lineTo(TABLE_X, TABLE_Y);
  ctx.stroke();

  // Rail metallic highlight
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x_top, Y_TOP);
  ctx.lineTo(x_tan, y_tan);
  ctx.arc(XC, YC, R_CURVE, Math.PI / 2 + THETA, Math.PI / 2, true);
  ctx.lineTo(TABLE_X, TABLE_Y);
  ctx.stroke();
  ctx.restore();

  // ── 4. Position 1 (Release Point on Incline) ────────────────────────────────
  // On the straight incline at height Y_RELEASE
  const x_pos1 = x_tan - (y_tan - Y_RELEASE) / tanT;
  const y_pos1 = Y_RELEASE;

  // Ball A rests ON top of the incline track:
  // Normal vector pointing outwards from track: (-sinT, -cosT)
  const xA_rest = x_pos1 - BALL_R * sinT;
  const yA_rest = y_pos1 - BALL_R * cosT;

  // Mechanical release pin / stopper at Position 1
  ctx.save();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x_pos1, y_pos1);
  ctx.lineTo(x_pos1 + 7 * sinT, y_pos1 + 7 * cosT);
  ctx.stroke();
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.arc(x_pos1 + 8 * sinT, y_pos1 + 8 * cosT, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 5. Position 2 (Exit Point on Horizontal Platform) ──────────────────────
  // Ball B rests on the horizontal track lip at the exit edge
  const xB_rest = TABLE_X - BALL_R;
  const yB_rest = TABLE_Y - BALL_R;

  // ── 6. Ground & Ruler ──────────────────────────────────────────────────────
  // Ground line
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_LEFT, GROUND_Y);
  ctx.lineTo(W - MARGIN_RIGHT, GROUND_Y);
  ctx.stroke();

  // Ground diagonal hatching (////)
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  for (let gx = MARGIN_LEFT; gx < W - MARGIN_RIGHT - 10; gx += 10) {
    ctx.beginPath();
    ctx.moveTo(gx, GROUND_Y + 2);
    ctx.lineTo(gx - 6, GROUND_Y + 9);
    ctx.stroke();
  }

  // "GROUND" text annotation
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 9px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText('GROUND', W - MARGIN_RIGHT, GROUND_Y - 7);
  ctx.textAlign = 'left';

  // Ruler ticks on ground from plumb line (TABLE_X) to the right
  ctx.fillStyle = '#64748B';
  ctx.font = '8px JetBrains Mono, monospace';
  for (let rx = TABLE_X; rx <= W - MARGIN_RIGHT; rx += 25) {
    const isMajor = (rx - TABLE_X) % 100 === 0;
    const tickH = isMajor ? 8 : 4;
    ctx.strokeStyle = isMajor ? '#94A3B8' : '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, GROUND_Y);
    ctx.lineTo(rx, GROUND_Y + tickH);
    ctx.stroke();
  }

  // ── 7. Coordinate Axes: Plumb Line & Horizontal x-Axis ─────────────────────
  // Plumb line: dashed vertical line dropping from Position 2 to ground
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(TABLE_X, TABLE_Y);
  ctx.lineTo(TABLE_X, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Horizontal x-axis arrow extending to the right from Position 2
  const x_axis_len = Math.min(180, (W - MARGIN_RIGHT) - TABLE_X - 10);
  ctx.save();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(TABLE_X, TABLE_Y);
  ctx.lineTo(TABLE_X + x_axis_len, TABLE_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead pointing right for x-axis
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.moveTo(TABLE_X + x_axis_len, TABLE_Y);
  ctx.lineTo(TABLE_X + x_axis_len - 7, TABLE_Y - 3.5);
  ctx.lineTo(TABLE_X + x_axis_len - 7, TABLE_Y + 3.5);
  ctx.closePath();
  ctx.fill();

  // Label 'x'
  ctx.font = 'italic 11px JetBrains Mono, monospace';
  ctx.fillText('x', TABLE_X + x_axis_len + 6, TABLE_Y + 3.5);
  ctx.restore();

  // ── 8. Dimension Lines: h and y ────────────────────────────────────────────
  // Dimension h (vertical height between Position 1 and Position 2 level)
  const h_dim_x = Math.max(18, x_pos1 - 24);
  // Horizontal extension from Position 1 to h dimension line
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(h_dim_x - 4, Y_RELEASE);
  ctx.lineTo(x_pos1, Y_RELEASE);
  ctx.moveTo(h_dim_x - 4, TABLE_Y);
  ctx.lineTo(TABLE_X, TABLE_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Vertical dimension line for h
  drawDimensionLine(
    ctx,
    h_dim_x,
    Y_RELEASE,
    h_dim_x,
    TABLE_Y,
    '#38BDF8',
    `h = ${params.h.toFixed(3)} m`,
    true
  );

  // Dimension y (table height from Position 2 to ground)
  const y_dim_x = TABLE_X + 24;
  drawDimensionLine(
    ctx,
    y_dim_x,
    TABLE_Y,
    y_dim_x,
    GROUND_Y,
    '#10B981',
    `y = ${params.y.toFixed(2)} m`,
    true
  );

  // ── 9. Static Labels: POSITION 1 & POSITION 2 ──────────────────────────────
  ctx.save();
  ctx.font = 'bold 9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';

  // Position 1 label
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('POSITION 1', xA_rest, yA_rest - BALL_R - 14);
  ctx.fillStyle = '#CBD5E1';
  ctx.fillText(`BALL A (${params.materialA})`, xA_rest, yA_rest - BALL_R - 4);

  // Position 2 label
  ctx.fillStyle = '#10B981';
  ctx.fillText('POSITION 2', xB_rest, yB_rest - BALL_R - 14);
  ctx.fillStyle = '#CBD5E1';
  ctx.fillText(`BALL B (${params.materialB})`, xB_rest, yB_rest - BALL_R - 4);
  ctx.restore();

  // ── 10. Animation: Rolling, Collision & Projectile Trajectories ─────────────
  // Pre-calculate track path length for Ball A rolling kinematics:
  // 1) Incline segment
  const L1 = (y_tan - y_pos1) / sinT;
  // 2) Fillet arc segment
  const L2 = R_CURVE * THETA;
  // 3) Horizontal segment to impact Ball B (Ball A touches Ball B when center reaches TABLE_X - 3*BALL_R)
  const L3 = Math.max(0, (TABLE_X - 3 * BALL_R) - KNEE_X);
  const S_TOTAL = L1 + L2 + L3;

  function getBallAPosAlongTrack(s: number): { x: number; y: number } {
    if (s <= L1) {
      // On straight incline
      const xt = x_pos1 + s * cosT;
      const yt = y_pos1 + s * sinT;
      return {
        x: xt - BALL_R * sinT,
        y: yt - BALL_R * cosT,
      };
    } else if (s <= L1 + L2) {
      // On fillet arc
      const sArc = s - L1;
      const phi = THETA - sArc / R_CURVE; // phi from THETA down to 0
      return {
        x: XC - (R_CURVE + BALL_R) * Math.sin(phi),
        y: YC + (R_CURVE + BALL_R) * Math.cos(phi),
      };
    } else {
      // On horizontal flat track
      const sFlat = s - (L1 + L2);
      return {
        x: KNEE_X + sFlat,
        y: TABLE_Y - BALL_R,
      };
    }
  }

  // Scale factor for projectile flight distance
  const availFlightW = (W - MARGIN_RIGHT) - TABLE_X;
  const maxFlightMeters = params.result
    ? Math.max(params.result.XB, Math.abs(params.result.XA), 0.45) * 1.16
    : 0.8;
  const scaleX = availFlightW / maxFlightMeters;

  if (params.animProgress < 0.5) {
    // ── SLIDING PHASE (Ball A accelerates down ramp to strike Ball B) ───────────
    const u = params.animProgress * 2; // 0 -> 1
    // Physical acceleration s = 0.5 * a * t^2 -> quadratic progress
    const sCurrent = S_TOTAL * (u * u);
    const aPos = getBallAPosAlongTrack(sCurrent);

    // Ball B stays at rest at Position 2
    drawBall(ctx, xB_rest, yB_rest, BALL_R, params.materialB, 'B');

    // Draw moving Ball A
    drawBall(ctx, aPos.x, aPos.y, BALL_R, params.materialA, 'A');
  } else if (params.result) {
    // ── PROJECTILE PHASE (Both balls fly off horizontally) ─────────────────────
    const u = (params.animProgress - 0.5) * 2; // 0 -> 1
    const { VA, VB, XA, XB } = params.result;

    // Vertical gravity drop in pixels: y_drop(u) = u^2 * (GROUND_Y - TABLE_Y)
    const dropPx = (u * u) * (GROUND_Y - TABLE_Y);

    // Ball A flight position
    const aCurrentX = (TABLE_X - 3 * BALL_R) + u * (XA * scaleX);
    const aCurrentY = Math.min(GROUND_Y - BALL_R, TABLE_Y - BALL_R + dropPx);

    // Ball B flight position
    const bCurrentX = (TABLE_X - BALL_R) + u * (XB * scaleX);
    const bCurrentY = Math.min(GROUND_Y - BALL_R, TABLE_Y - BALL_R + dropPx);

    // Draw Parabolic Dashed Trails
    if (params.showTrails && u > 0.02) {
      // Trail A
      ctx.save();
      ctx.strokeStyle = BALL_MATERIALS[params.materialA].color;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const numSteps = 40;
      for (let i = 0; i <= Math.floor(u * numSteps); i++) {
        const stepU = i / numSteps;
        const tx = (TABLE_X - 3 * BALL_R) + stepU * (XA * scaleX);
        const ty = TABLE_Y - BALL_R + (stepU * stepU) * (GROUND_Y - TABLE_Y);
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.stroke();

      // Trail B
      ctx.strokeStyle = BALL_MATERIALS[params.materialB].color;
      ctx.beginPath();
      for (let i = 0; i <= Math.floor(u * numSteps); i++) {
        const stepU = i / numSteps;
        const tx = (TABLE_X - BALL_R) + stepU * (XB * scaleX);
        const ty = TABLE_Y - BALL_R + (stepU * stepU) * (GROUND_Y - TABLE_Y);
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Draw the flying balls
    drawBall(ctx, aCurrentX, aCurrentY, BALL_R, params.materialA, 'A');
    drawBall(ctx, bCurrentX, bCurrentY, BALL_R, params.materialB, 'B');

    // ── Landing Markers & XA, XB Dimensions ──────────────────────────────────
    if (u >= 0.98 || !params.isAnimating) {
      const xA_land = (TABLE_X - 3 * BALL_R) + XA * scaleX;
      const xB_land = (TABLE_X - BALL_R) + XB * scaleX;

      // Landing markers on ground
      ctx.fillStyle = BALL_MATERIALS[params.materialA].color;
      ctx.fillRect(xA_land - 1.5, GROUND_Y - 4, 3, 10);

      ctx.fillStyle = BALL_MATERIALS[params.materialB].color;
      ctx.fillRect(xB_land - 1.5, GROUND_Y - 4, 3, 10);

      // Dimension line for X_a (Ball A horizontal landing distance)
      drawDimensionLine(
        ctx,
        TABLE_X,
        GROUND_Y + 18,
        xA_land,
        GROUND_Y + 18,
        BALL_MATERIALS[params.materialA].color,
        `X_a = ${XA.toFixed(3)} m`,
        false
      );

      // Dimension line for X_b (Ball B horizontal landing distance)
      drawDimensionLine(
        ctx,
        TABLE_X,
        GROUND_Y + 34,
        xB_land,
        GROUND_Y + 34,
        BALL_MATERIALS[params.materialB].color,
        `X_b = ${XB.toFixed(3)} m`,
        false
      );
    }
  } else {
    // Idle state: draw balls resting at Position 1 and Position 2
    drawBall(ctx, xA_rest, yA_rest, BALL_R, params.materialA, 'A');
    drawBall(ctx, xB_rest, yB_rest, BALL_R, params.materialB, 'B');
  }
}

// ── Ball Visual Renderer with Material-Specific Shaders ───────────────────────

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  material: BallMaterial,
  label: 'A' | 'B'
) {
  ctx.save();

  if (material === 'Glass') {
    // ── Glass Ball: Translucent azure with internal glow and specular shine ───
    ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
    ctx.shadowBlur = 12;

    // Translucent sphere body
    const glassGrad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    glassGrad.addColorStop(0, 'rgba(240, 249, 255, 0.95)');
    glassGrad.addColorStop(0.35, 'rgba(125, 211, 252, 0.7)');
    glassGrad.addColorStop(0.75, 'rgba(14, 165, 233, 0.65)');
    glassGrad.addColorStop(1, 'rgba(3, 105, 161, 0.9)');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = glassGrad;
    ctx.fill();

    // Inner refraction arc
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r - 2, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Specular highlight dot
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = '#082F49';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 0.5, y + 0.5);
  } else {
    // ── Steel Ball: High-shine polished metallic chrome sphere ─────────────────
    ctx.shadowColor = 'rgba(203, 213, 225, 0.35)';
    ctx.shadowBlur = 10;

    // Metallic chrome radial gradient
    const steelGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.08, x, y, r);
    steelGrad.addColorStop(0, '#FFFFFF');
    steelGrad.addColorStop(0.25, '#E2E8F0');
    steelGrad.addColorStop(0.6, '#94A3B8');
    steelGrad.addColorStop(0.85, '#475569');
    steelGrad.addColorStop(1, '#0F172A');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = steelGrad;
    ctx.fill();

    // Crisp specular glint
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Subtle metallic rim reflection
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 0.5, y + 0.5);
  }

  ctx.restore();
}

// ── Dimension Line Utility ───────────────────────────────────────────────────

function drawDimensionLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  label: string,
  isVertical: boolean
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);

  // Main line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // End ticks and arrowheads
  if (isVertical) {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const midY = (minY + maxY) / 2;

    // End cross ticks
    ctx.beginPath();
    ctx.moveTo(x1 - 4, minY); ctx.lineTo(x1 + 4, minY);
    ctx.moveTo(x1 - 4, maxY); ctx.lineTo(x1 + 4, maxY);
    ctx.stroke();

    // Arrowheads
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, minY); ctx.lineTo(x1 - 2.5, minY + 5); ctx.lineTo(x1 + 2.5, minY + 5); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x1, maxY); ctx.lineTo(x1 - 2.5, maxY - 5); ctx.lineTo(x1 + 2.5, maxY - 5); ctx.closePath(); ctx.fill();

    // Rotated text label
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.save();
    ctx.translate(x1 - 8, midY);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  } else {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const midX = (minX + maxX) / 2;

    // End cross ticks
    ctx.beginPath();
    ctx.moveTo(minX, y1 - 4); ctx.lineTo(minX, y1 + 4);
    ctx.moveTo(maxX, y1 - 4); ctx.lineTo(maxX, y1 + 4);
    ctx.stroke();

    // Arrowheads
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(minX, y1); ctx.lineTo(minX + 5, y1 - 2.5); ctx.lineTo(minX + 5, y1 + 2.5); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(maxX, y1); ctx.lineTo(maxX - 5, y1 - 2.5); ctx.lineTo(maxX - 5, y1 + 2.5); ctx.closePath(); ctx.fill();

    // Centered label above line
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, midX, y1 - 4);
  }

  ctx.restore();
}

// ── Main Simulator Page Component ────────────────────────────────────────────

export default function SimulatorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const { addTrial } = useTrialsStore();

  // ── Two Ball Reference State ───────────────────────────────────────────────
  const [materialA, setMaterialA] = useState<BallMaterial>('Glass');
  const [materialB, setMaterialB] = useState<BallMaterial>('Steel');
  const [mA, setMA] = useState(BALL_MATERIALS.Glass.defaultMass); // kg
  const [mB, setMB] = useState(BALL_MATERIALS.Steel.defaultMass); // kg

  // Parameters
  const [h, setH] = useState(0.18);              // release height (m)
  const [y, setY] = useState(0.65);              // table height (m)
  const [useCustomE, setUseCustomE] = useState(false);
  const [customE, setCustomE] = useState(0.925);
  const [slowMotion, setSlowMotion] = useState(false);
  const [realisticMode, setRealisticMode] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0);

  // Animation & simulation result state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [explanation, setExplanation] = useState('');
  const [showCalcPanel, setShowCalcPanel] = useState(true);

  // Coefficient of restitution
  const pairReferenceE = getPairReferenceE(materialA, materialB);
  const e = useCustomE ? customE : pairReferenceE;

  // Live theoretical preview (before release)
  const livePreview = simulate({ h, y, mA, mB, e, noiseAmplitude: 0 });

  // ── Canvas Redraw Handler ──────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawSimulator(canvas, {
      h,
      y,
      mA,
      mB,
      materialA,
      materialB,
      animProgress,
      result,
      isAnimating,
      showTrails: true,
    });
  }, [h, y, mA, mB, materialA, materialB, animProgress, result, isAnimating]);

  // Resize observer to maintain canvas pixel buffer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      redraw();
    });
    observer.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    redraw();
    return () => observer.disconnect();
  }, [redraw]);

  // ── Material Change Handlers ───────────────────────────────────────────────
  const handleSelectMaterialA = (newMat: BallMaterial) => {
    setMaterialA(newMat);
    setMA(BALL_MATERIALS[newMat].defaultMass);
    const newPairE = getPairReferenceE(newMat, materialB);
    setCustomE(newPairE);
    handleReset();
  };

  const handleSelectMaterialB = (newMat: BallMaterial) => {
    setMaterialB(newMat);
    setMB(BALL_MATERIALS[newMat].defaultMass);
    const newPairE = getPairReferenceE(materialA, newMat);
    setCustomE(newPairE);
    handleReset();
  };

  const handleSwapMaterials = () => {
    const prevA = materialA;
    const prevB = materialB;
    setMaterialA(prevB);
    setMaterialB(prevA);
    setMA(BALL_MATERIALS[prevB].defaultMass);
    setMB(BALL_MATERIALS[prevA].defaultMass);
    handleReset();
  };

  // ── Animation Loop ─────────────────────────────────────────────────────────
  const animate = useCallback(
    (startTime: number, simResult: SimulationResult) => {
      const DURATION = slowMotion ? 4000 : 2200; // ms

      const frame = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / DURATION, 1);

        setAnimProgress(progress);
        setResult(simResult);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(frame);
        } else {
          setIsAnimating(false);
        }
      };

      animFrameRef.current = requestAnimationFrame(frame);
    },
    [slowMotion]
  );

  // ── Release Action ─────────────────────────────────────────────────────────
  const handleRelease = useCallback(() => {
    if (isAnimating) return;

    cancelAnimationFrame(animFrameRef.current);
    setAnimProgress(0);
    setIsAnimating(true);

    const simResult = simulate({
      h,
      y,
      mA,
      mB,
      e,
      noiseAmplitude: realisticMode ? 0.002 : 0, // ±2 mm measurement noise
    });

    setResult(simResult);
    setExplanation(explainCollision(simResult, { h, y, mA, mB, e }));
    animate(performance.now(), simResult);

    if (guidedMode) setGuidedStep(4);
  }, [h, y, mA, mB, e, realisticMode, slowMotion, guidedMode, isAnimating, animate]);

  // ── Restart / Reset Action ─────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setAnimProgress(0);
    setResult(null);
    setIsAnimating(false);
    setExplanation('');
    if (guidedMode) setGuidedStep(0);
  }, [guidedMode]);

  // ── Record Observation ─────────────────────────────────────────────────────
  const handleRecord = useCallback(() => {
    if (!result) {
      toast.error('Run a simulation first by clicking Release!');
      return;
    }

    addTrial({
      h,
      y,
      mA,
      mB,
      material: `${materialA} - ${materialB}`,
      XA: result.XA,
      XB: result.XB,
      UA: result.UA,
      UB: result.UB,
      VA: result.VA,
      VB: result.VB,
      e: result.e_calc,
      noiseApplied: realisticMode,
    });

    toast.success(`Observation recorded (${materialA} ➔ ${materialB})! Check Observations page.`);
  }, [result, h, y, mA, mB, materialA, materialB, realisticMode, addTrial]);

  // ── Guided Mode Steps ──────────────────────────────────────────────────────
  const GUIDED_STEPS = [
    { label: 'Select Ball Materials', desc: 'Choose reference materials for Ball A and Ball B (Glass / Steel).' },
    { label: 'Set Release Height h', desc: 'Adjust slider h to choose Position 1 on the ramp.' },
    { label: 'Set Table Height y', desc: 'Adjust slider y to set table elevation above ground.' },
    { label: 'Release Ball A', desc: 'Click the Release button beside the diagram.' },
    { label: 'Observe Collision & Flight', desc: 'Watch central impact at Position 2 and projectile trails.' },
    { label: 'Record Trial', desc: 'Click Record Observation to add to your lab journal.' },
  ];

  const calcSteps = result ? getCalculationSteps(result, { h, y, mA, mB, e }) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 page-enter">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="badge badge-warning mb-2">Experiment 05</span>
          <h1 className="font-heading text-3xl sm:text-4xl gradient-text">
            Collision of Elastic Bodies
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Impact Apparatus Simulator · Direct Central Impact · St. John College of Engineering and Management
          </p>
        </div>

        {/* Live Pair Badge */}
        <div className="flex items-center gap-2 bg-surface-2 border border-border px-3 py-2 rounded-xl">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: BALL_MATERIALS[materialA].color }} />
            <span className="font-semibold text-xs text-text-primary">Ball A: {materialA}</span>
          </div>
          <span className="text-text-muted text-xs">➔</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: BALL_MATERIALS[materialB].color }} />
            <span className="font-semibold text-xs text-text-primary">Ball B: {materialB}</span>
          </div>
          <span className="font-mono text-primary text-xs font-bold ml-2">
            e_ref ≈ {pairReferenceE.toFixed(3)}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_390px] gap-6 items-start">
        {/* ── Left Column: Diagram Canvas + Beside Controls + Parameters ──── */}
        <div className="space-y-5">
          {/* Main Diagram Card with Side-by-Side Action Buttons right beside/above the canvas */}
          <div className="glass-card p-4 sm:p-5">
            {/* Action Bar Beside Diagram: Side-by-Side Release and Restart Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Diagram View
                </span>
                <span
                  className={`badge ${
                    isAnimating
                      ? 'badge-warning'
                      : result
                      ? 'badge-success'
                      : 'badge-primary'
                  }`}
                >
                  {isAnimating
                    ? animProgress < 0.5
                      ? '⚡ Sliding on Ramp…'
                      : '🚀 In Projectile Flight…'
                    : result
                    ? '✓ Landed at XA, XB'
                    : '● Ready at Position 1'}
                </span>
              </div>

              {/* SIDE-BY-SIDE RELEASE & RESTART BUTTONS BESIDE THE DIAGRAM */}
              <div className="flex items-center gap-2.5">
                <button
                  id="btn-release"
                  className="btn btn-primary px-6 py-2.5 flex items-center gap-2 font-bold text-sm shadow-lg shadow-amber-500/25 transition-transform active:scale-95"
                  onClick={handleRelease}
                  disabled={isAnimating}
                  aria-label="Release ball A down the ramp"
                >
                  <span>🚀</span>
                  <span>{isAnimating ? 'Running…' : 'Release'}</span>
                </button>

                <button
                  id="btn-reset"
                  className="btn btn-secondary px-5 py-2.5 flex items-center gap-2 font-bold text-sm hover:border-amber-500/40 transition-transform active:scale-95"
                  onClick={handleReset}
                  aria-label="Restart simulation"
                >
                  <span>🔄</span>
                  <span>Restart</span>
                </button>

                <button
                  id="btn-record"
                  className="btn btn-sm btn-ghost border border-border flex items-center gap-1.5 text-xs font-semibold py-2.5"
                  onClick={handleRecord}
                  disabled={!result}
                  title="Record Observation to Table"
                >
                  <span>📝</span>
                  <span className="hidden sm:inline">Record</span>
                </button>
              </div>
            </div>

            {/* Enlarged Simulation Canvas (500px Height for Spacious X and Y Axes) */}
            <div className="simulator-canvas-wrapper" style={{ height: '500px' }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block' }}
                aria-label="Impact apparatus collision simulation canvas"
                role="img"
              />

              {/* Status prompt overlay when idle */}
              {!isAnimating && animProgress === 0 && (
                <div className="absolute inset-0 flex items-end justify-center pb-12 pointer-events-none">
                  <div className="bg-surface-1/90 backdrop-blur-md px-4 py-2 rounded-full border border-primary/30 shadow-lg text-text-secondary text-xs font-mono animate-pulse-slow">
                    👉 Click <strong className="text-primary font-bold">Release</strong> beside the diagram to launch Ball A
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Enlarged X & Y Axis Trajectory & Coordinates Table ────────── */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-lg text-text-primary flex items-center gap-2">
                <span>📐</span>
                <span>X & Y Axis Trajectory Table</span>
              </h3>
              <span className="text-xs font-mono text-text-muted">
                Plumb Line Reference (x = 0 at Position 2)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table" aria-label="X and Y trajectory table">
                <thead>
                  <tr>
                    <th>Axis</th>
                    <th>Coordinate Parameter</th>
                    <th>Symbol</th>
                    <th>Physics Formula</th>
                    <th>Theoretical</th>
                    <th>Simulated</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="badge badge-warning text-xs">Y-Axis</span></td>
                    <td className="text-text-primary font-semibold">Release Height on Incline</td>
                    <td className="font-mono text-primary font-bold">h</td>
                    <td className="font-mono text-xs text-text-muted">Position 1 − Position 2</td>
                    <td className="font-mono">{h.toFixed(3)}</td>
                    <td className="font-mono text-primary font-bold">{h.toFixed(3)}</td>
                    <td className="text-text-muted text-xs">m</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-warning text-xs">Y-Axis</span></td>
                    <td className="text-text-primary font-semibold">Table Elevation Above Ground</td>
                    <td className="font-mono text-primary font-bold">y</td>
                    <td className="font-mono text-xs text-text-muted">Position 2 − Ground</td>
                    <td className="font-mono">{y.toFixed(2)}</td>
                    <td className="font-mono text-primary font-bold">{y.toFixed(2)}</td>
                    <td className="text-text-muted text-xs">m</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-primary text-xs" style={{ background: BALL_MATERIALS[materialA].glowColor, color: BALL_MATERIALS[materialA].color }}>X-Axis</span></td>
                    <td className="text-text-primary font-semibold">Ball A Landing Range ({materialA})</td>
                    <td className="font-mono font-bold" style={{ color: BALL_MATERIALS[materialA].color }}>X_a</td>
                    <td className="font-mono text-xs text-text-muted">V_A × t</td>
                    <td className="font-mono">{livePreview.XA.toFixed(4)}</td>
                    <td className="font-mono font-bold" style={{ color: BALL_MATERIALS[materialA].color }}>
                      {result ? result.XA.toFixed(4) : '—'}
                    </td>
                    <td className="text-text-muted text-xs">m</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-primary text-xs" style={{ background: BALL_MATERIALS[materialB].glowColor, color: BALL_MATERIALS[materialB].color }}>X-Axis</span></td>
                    <td className="text-text-primary font-semibold">Ball B Landing Range ({materialB})</td>
                    <td className="font-mono font-bold" style={{ color: BALL_MATERIALS[materialB].color }}>X_b</td>
                    <td className="font-mono text-xs text-text-muted">V_B × t</td>
                    <td className="font-mono">{livePreview.XB.toFixed(4)}</td>
                    <td className="font-mono font-bold" style={{ color: BALL_MATERIALS[materialB].color }}>
                      {result ? result.XB.toFixed(4) : '—'}
                    </td>
                    <td className="text-text-muted text-xs">m</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-secondary text-xs">Time</span></td>
                    <td className="text-text-primary font-semibold">Projectile Flight Time</td>
                    <td className="font-mono text-primary font-bold">t</td>
                    <td className="font-mono text-xs text-text-muted">√(2y / g)</td>
                    <td className="font-mono">{livePreview.t.toFixed(4)}</td>
                    <td className="font-mono text-green-400 font-bold">
                      {result ? result.t.toFixed(4) : livePreview.t.toFixed(4)}
                    </td>
                    <td className="text-text-muted text-xs">s</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-secondary text-xs">Velocity</span></td>
                    <td className="text-text-primary font-semibold">Approach Velocity of Ball A</td>
                    <td className="font-mono text-blue-400 font-bold">U_A</td>
                    <td className="font-mono text-xs text-text-muted">√(2gh)</td>
                    <td className="font-mono">{livePreview.UA.toFixed(4)}</td>
                    <td className="font-mono text-blue-400 font-bold">
                      {result ? result.UA.toFixed(4) : livePreview.UA.toFixed(4)}
                    </td>
                    <td className="text-text-muted text-xs">m/s</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-secondary text-xs">Restitution</span></td>
                    <td className="text-text-primary font-semibold">Coefficient of Restitution</td>
                    <td className="font-mono text-amber-400 font-bold">e</td>
                    <td className="font-mono text-xs text-text-muted">(V_B − V_A) / U_A</td>
                    <td className="font-mono">{e.toFixed(3)}</td>
                    <td className="font-mono text-amber-400 font-bold text-base">
                      {result ? result.e_calc.toFixed(4) : '—'}
                    </td>
                    <td className="text-text-muted text-xs">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Apparatus Physical Parameters ────────────────────────────── */}
          <div className="glass-card p-5">
            <h3 className="font-heading text-lg mb-4 text-text-primary">⚙️ Apparatus Parameters</h3>

            <div className="grid sm:grid-cols-2 gap-5">
              {/* Release Height h */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-text-secondary" htmlFor="slider-h">
                    <span className="tooltip-wrapper">
                      h (Release Height on Ramp)
                      <span className="tooltip">Vertical height of Ball A release position above Position 2</span>
                    </span>
                  </label>
                  <span className="font-mono text-primary text-sm font-bold">{h.toFixed(3)} m</span>
                </div>
                <input
                  id="slider-h"
                  type="range"
                  min={0.05}
                  max={0.50}
                  step={0.005}
                  value={h}
                  onChange={(ev) => {
                    setH(Number(ev.target.value));
                    handleReset();
                  }}
                  aria-label="Release height h"
                />
                <div className="flex justify-between text-text-muted text-xs mt-1">
                  <span>0.05 m</span>
                  <span>0.50 m</span>
                </div>
              </div>

              {/* Table Height y */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-text-secondary" htmlFor="slider-y">
                    <span className="tooltip-wrapper">
                      y (Table Elevation Above Ground)
                      <span className="tooltip">Vertical drop height from Position 2 to the ground floor</span>
                    </span>
                  </label>
                  <span className="font-mono text-primary text-sm font-bold">{y.toFixed(2)} m</span>
                </div>
                <input
                  id="slider-y"
                  type="range"
                  min={0.30}
                  max={1.00}
                  step={0.01}
                  value={y}
                  onChange={(ev) => {
                    setY(Number(ev.target.value));
                    handleReset();
                  }}
                  aria-label="Table height y"
                />
                <div className="flex justify-between text-text-muted text-xs mt-1">
                  <span>0.30 m</span>
                  <span>1.00 m</span>
                </div>
              </div>

              {/* Mass mA */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-text-secondary" htmlFor="input-mA">
                    <span className="tooltip-wrapper">
                      m_A (Mass of Ball A: {materialA})
                      <span className="tooltip">Mass of the rolling ball A</span>
                    </span>
                  </label>
                  <span className="font-mono text-primary text-sm font-bold">{(mA * 1000).toFixed(1)} g</span>
                </div>
                <input
                  id="input-mA"
                  type="range"
                  min={0.015}
                  max={0.150}
                  step={0.005}
                  value={mA}
                  onChange={(ev) => {
                    setMA(Number(ev.target.value));
                    handleReset();
                  }}
                  aria-label="Mass of ball A"
                />
              </div>

              {/* Mass mB */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-text-secondary" htmlFor="input-mB">
                    <span className="tooltip-wrapper">
                      m_B (Mass of Ball B: {materialB})
                      <span className="tooltip">Mass of target stationary ball B</span>
                    </span>
                  </label>
                  <span className="font-mono text-primary text-sm font-bold">{(mB * 1000).toFixed(1)} g</span>
                </div>
                <input
                  id="input-mB"
                  type="range"
                  min={0.015}
                  max={0.150}
                  step={0.005}
                  value={mB}
                  onChange={(ev) => {
                    setMB(Number(ev.target.value));
                    handleReset();
                  }}
                  aria-label="Mass of ball B"
                />
              </div>
            </div>
          </div>

          {/* Guided Mode Steps */}
          {guidedMode && (
            <div className="glass-card p-5 animate-fade-in">
              <h3 className="font-heading text-lg mb-3 text-text-primary">📋 Guided Lab Procedure</h3>
              <div className="space-y-2">
                {GUIDED_STEPS.map((step, i) => (
                  <div
                    key={i}
                    className={`step-item ${
                      i === guidedStep ? 'active' : i < guidedStep ? 'done' : 'pending'
                    }`}
                    role="listitem"
                    aria-current={i === guidedStep ? 'step' : undefined}
                  >
                    <span
                      className="step-number"
                      style={{
                        background:
                          i < guidedStep
                            ? '#22c55e'
                            : i === guidedStep
                            ? 'var(--color-primary)'
                            : 'var(--color-surface-3)',
                        color: i <= guidedStep ? '#000' : 'var(--color-text-muted)',
                      }}
                    >
                      {i < guidedStep ? '✓' : i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{step.label}</p>
                      <p className="text-xs text-text-muted">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              {guidedStep < GUIDED_STEPS.length - 1 && (
                <button
                  className="btn btn-secondary btn-sm mt-3 w-full"
                  onClick={() => setGuidedStep((s) => Math.min(s + 1, GUIDED_STEPS.length - 1))}
                >
                  Next Step →
                </button>
              )}
            </div>
          )}

          {/* Explanation Panel */}
          {explanation && (
            <div className="glass-card p-5 animate-fade-in border border-amber-500/30">
              <h3 className="font-heading text-lg mb-2 text-primary">💡 Collision Analysis</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{explanation}</p>
            </div>
          )}
        </div>

        {/* ── Right Column: Two Ball Reference + Live Readout + Controls ─── */}
        <div className="space-y-5">
          {/* Quick Action Controller directly beside the diagram */}
          <div className="glass-card p-5 border border-primary/25 shadow-lg shadow-primary/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-base text-text-primary font-bold">
                🎮 Experiment Controller
              </h3>
              <span className="text-xs text-text-muted font-mono">Beside Diagram</span>
            </div>

            {/* Prominent Side-by-Side Release and Restart Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                className="btn btn-primary py-3 flex items-center justify-center gap-2 text-base font-bold shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={handleRelease}
                disabled={isAnimating}
                id="btn-release-sidebar"
              >
                <span>🚀</span>
                <span>{isAnimating ? 'Running…' : 'Release'}</span>
              </button>

              <button
                className="btn btn-secondary py-3 flex items-center justify-center gap-2 text-base font-bold hover:border-amber-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={handleReset}
                id="btn-reset-sidebar"
              >
                <span>🔄</span>
                <span>Restart</span>
              </button>
            </div>

            {/* Record Observation Button */}
            <button
              className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm font-semibold"
              onClick={handleRecord}
              disabled={!result}
              id="btn-record-sidebar"
              style={{
                background: result ? undefined : 'var(--color-surface-3)',
                borderColor: result ? undefined : 'var(--color-border)',
                color: result ? undefined : 'var(--color-text-muted)',
              }}
            >
              <span>📝</span>
              <span>Record Observation</span>
            </button>

            {/* Toggles */}
            <div className="mt-4 pt-3 border-t border-border flex flex-col gap-2.5">
              <ToggleOption
                label="🐢 Slow Motion (2×)"
                checked={slowMotion}
                onChange={setSlowMotion}
                tooltip="Slows animation duration to observe micro-phases"
              />
              <ToggleOption
                label="🎯 Realistic Noise (±2 mm)"
                checked={realisticMode}
                onChange={setRealisticMode}
                tooltip="Adds realistic measurement noise to simulate physical ruler readings"
              />
              <ToggleOption
                label="📋 Guided Mode"
                checked={guidedMode}
                onChange={(v) => {
                  setGuidedMode(v);
                  setGuidedStep(0);
                }}
                tooltip="Follow systematic steps as performed in the physical lab"
              />
            </div>
          </div>

          {/* ── TWO BALL REFERENCE & MATERIAL SPECIFICATIONS ───────────────── */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-base text-text-primary font-bold">
                ⚪ Two Ball Reference
              </h3>
              <button
                className="btn btn-ghost btn-sm text-xs text-primary border border-primary/20 hover:bg-primary/10 flex items-center gap-1"
                onClick={handleSwapMaterials}
                title="Swap Ball A and Ball B materials"
              >
                <span>⇄</span>
                <span>Swap Balls</span>
              </button>
            </div>

            <p className="text-xs text-text-muted mb-4">
              Direct central impact apparatus tests spherical bodies of different materials (e.g. Glass & Steel).
            </p>

            <div className="space-y-3">
              {/* Ball A Material Selection & Reference */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  materialA === 'Glass'
                    ? 'border-sky-500/40 bg-sky-500/5'
                    : 'border-slate-500/40 bg-slate-500/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full shadow-sm"
                      style={{ background: BALL_MATERIALS[materialA].color }}
                    />
                    <span className="font-heading text-sm text-text-primary font-bold">
                      Ball A (Impacting):
                    </span>
                  </div>

                  {/* Material Toggle for Ball A */}
                  <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                    {(['Glass', 'Steel'] as BallMaterial[]).map((m) => (
                      <button
                        key={m}
                        className={`px-2.5 py-1 transition-colors ${
                          materialA === m
                            ? 'bg-primary text-black font-bold'
                            : 'bg-surface-2 text-text-secondary hover:text-text-primary'
                        }`}
                        onClick={() => handleSelectMaterialA(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="bg-surface-2/60 p-2 rounded-lg text-center">
                    <div className="text-text-muted text-[10px]">Reference e_A</div>
                    <div className="text-primary font-bold">{BALL_MATERIALS[materialA].refE.toFixed(2)}</div>
                  </div>
                  <div className="bg-surface-2/60 p-2 rounded-lg text-center">
                    <div className="text-text-muted text-[10px]">Density</div>
                    <div className="text-text-secondary">{BALL_MATERIALS[materialA].density} kg/m³</div>
                  </div>
                  <div className="bg-surface-2/60 p-2 rounded-lg text-center">
                    <div className="text-text-muted text-[10px]">Modulus</div>
                    <div className="text-text-secondary">{BALL_MATERIALS[materialA].modulus}</div>
                  </div>
                </div>
              </div>

              {/* Ball B Material Selection & Reference */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  materialB === 'Steel'
                    ? 'border-slate-500/40 bg-slate-500/5'
                    : 'border-sky-500/40 bg-sky-500/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full shadow-sm"
                      style={{ background: BALL_MATERIALS[materialB].color }}
                    />
                    <span className="font-heading text-sm text-text-primary font-bold">
                      Ball B (Target):
                    </span>
                  </div>

                  {/* Material Toggle for Ball B */}
                  <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                    {(['Glass', 'Steel'] as BallMaterial[]).map((m) => (
                      <button
                        key={m}
                        className={`px-2.5 py-1 transition-colors ${
                          materialB === m
                            ? 'bg-primary text-black font-bold'
                            : 'bg-surface-2 text-text-secondary hover:text-text-primary'
                        }`}
                        onClick={() => handleSelectMaterialB(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="bg-surface-2/60 p-2 rounded-lg text-center">
                    <div className="text-text-muted text-[10px]">Reference e_B</div>
                    <div className="text-primary font-bold">{BALL_MATERIALS[materialB].refE.toFixed(2)}</div>
                  </div>
                  <div className="bg-surface-2/60 p-2 rounded-lg text-center">
                    <div className="text-text-muted text-[10px]">Density</div>
                    <div className="text-text-secondary">{BALL_MATERIALS[materialB].density} kg/m³</div>
                  </div>
                  <div className="bg-surface-2/60 p-2 rounded-lg text-center">
                    <div className="text-text-muted text-[10px]">Modulus</div>
                    <div className="text-text-secondary">{BALL_MATERIALS[materialB].modulus}</div>
                  </div>
                </div>
              </div>

              {/* Collision Pair Restitution Summary */}
              <div className="p-3 bg-surface-2/80 rounded-xl border border-primary/20 flex items-center justify-between">
                <div>
                  <div className="text-xs text-text-muted">Combined Pair Reference</div>
                  <div className="font-semibold text-sm text-text-primary">
                    {materialA} ➔ {materialB} Impact
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-primary font-bold text-base">
                    e_ref ≈ {pairReferenceE.toFixed(3)}
                  </div>
                  <div className="text-[10px] text-text-muted">√(e_A × e_B)</div>
                </div>
              </div>

              {/* Custom e Toggle */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <label className="toggle-switch" aria-label="Use custom e value">
                    <input
                      type="checkbox"
                      checked={useCustomE}
                      onChange={(ev) => setUseCustomE(ev.target.checked)}
                    />
                    <span className="toggle-track" />
                    <span className="toggle-thumb" />
                  </label>
                  <span className="text-xs text-text-secondary">Custom e override</span>
                </div>

                {useCustomE && (
                  <div className="p-3 bg-surface-2 rounded-lg border border-border">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-text-muted">Set e value:</span>
                      <span className="font-mono text-primary text-sm font-bold">{customE.toFixed(3)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.005}
                      value={customE}
                      onChange={(ev) => {
                        setCustomE(Number(ev.target.value));
                        handleReset();
                      }}
                      aria-label="Custom coefficient of restitution"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Live Physics Readout ───────────────────────────────────────── */}
          <div className="glass-card p-5">
            <h3 className="font-heading text-lg mb-4 text-text-primary">📡 Live Readout</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: 'UA',
                  value: livePreview.UA,
                  unit: 'm/s',
                  tooltip: 'Approach velocity of ball A before impact = √(2gh)',
                },
                {
                  label: 'UB',
                  value: 0,
                  unit: 'm/s',
                  tooltip: 'Initial velocity of ball B before impact (at rest at Position 2)',
                },
                {
                  label: 'VA',
                  value: result?.VA ?? livePreview.VA_theory,
                  unit: 'm/s',
                  tooltip: 'Velocity of ball A after impact = XA / t',
                },
                {
                  label: 'VB',
                  value: result?.VB ?? livePreview.VB_theory,
                  unit: 'm/s',
                  tooltip: 'Velocity of ball B after impact = XB / t',
                },
                {
                  label: 'XA',
                  value: result?.XA ?? livePreview.XA,
                  unit: 'm',
                  tooltip: 'Horizontal landing range of ball A after impact',
                },
                {
                  label: 'XB',
                  value: result?.XB ?? livePreview.XB,
                  unit: 'm',
                  tooltip: 'Horizontal landing range of ball B after impact',
                },
                {
                  label: 't',
                  value: livePreview.t,
                  unit: 's',
                  tooltip: 'Time of flight = √(2y/g)',
                },
                {
                  label: 'e',
                  value: result?.e_calc ?? e,
                  unit: '',
                  tooltip: 'Calculated coefficient of restitution',
                },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="tooltip-wrapper mx-auto">
                    <div className="readout-value font-mono">
                      {item.value.toFixed(4)}
                      <span className="text-text-muted text-xs ml-1">{item.unit}</span>
                    </div>
                    <div className="readout-label">{item.label}</div>
                    <span className="tooltip">{item.tooltip}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="section-divider" />

            {/* Momentum conservation readout */}
            <div className="grid grid-cols-2 gap-3 text-center text-sm">
              <div>
                <div className="font-mono text-blue-400 font-bold">
                  {(result?.p_before ?? livePreview.p_before).toFixed(5)}
                </div>
                <div className="text-text-muted text-xs">p_before (kg·m/s)</div>
              </div>
              <div>
                <div className="font-mono text-green-400 font-bold">
                  {(result?.p_after ?? livePreview.p_after).toFixed(5)}
                </div>
                <div className="text-text-muted text-xs">p_after (kg·m/s)</div>
              </div>
            </div>
          </div>

          {/* ── Worked Calculation Steps ──────────────────────────────────── */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-lg text-text-primary">🔢 Lab Calculations</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowCalcPanel(!showCalcPanel)}
                aria-label="Toggle calculation panel"
              >
                {showCalcPanel ? '▲ Hide' : '▼ Show'}
              </button>
            </div>

            {showCalcPanel && (
              <div>
                {calcSteps.length > 0 ? (
                  <div className="space-y-1.5">
                    {calcSteps.map((step, i) => (
                      <div key={i} className="calc-step">
                        <span className="calc-label">Step {i + 1}</span>
                        <span className="calc-formula flex-1 font-mono text-xs">{step}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted text-sm text-center py-4">
                    Click Release beside the diagram to view step-by-step calculations
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Toggle Option Helper Component ───────────────────────────────────────────

function ToggleOption({
  label,
  checked,
  onChange,
  tooltip,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tooltip: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="tooltip-wrapper text-xs text-text-secondary cursor-default">
        {label}
        <span className="tooltip">{tooltip}</span>
      </span>
      <label className="toggle-switch" aria-label={label}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </label>
    </div>
  );
}
