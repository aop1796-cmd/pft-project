/**
 * Simulator Page
 * Canvas-based physics simulation of direct central impact (Experiment 05)
 *
 * Features:
 *  - Accurate Impact Apparatus matching the lab manual diagram (straight incline, smooth curve, horizontal platform)
 *  - Ball A resting on the straight incline at Position 1 with release stopper pin
 *  - Ball B resting on the horizontal platform lip at Position 2
 *  - Coordinate axes: plumb line (x = 0), horizontal x-axis arrow (--> x), vertical y-axis, dimension h
 *  - Side-by-side Release and Restart buttons located right beside the figure
 *  - Dual material selection for both Ball A and Ball B across all 5 materials (Steel, Glass, Wood, Rubber, Clay)
 *  - Permanent, live Step-by-Step Worked Calculation panel that updates in real time
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { simulate, SimulationResult, explainCollision, getCalculationSteps, G } from '../utils/physics';
import { useTrialsStore } from '../stores/trialsStore';

// ── Constants ─────────────────────────────────────────────────────────────
const MATERIAL_DEFAULTS: Record<string, number> = {
  Steel: 0.90, Glass: 0.95, Wood: 0.50, Rubber: 0.75, Clay: 0.05,
};

const MATERIAL_COLORS: Record<string, string> = {
  Steel: '#94A3B8', Glass: '#93C5FD', Wood: '#B45309', Rubber: '#F59E0B', Clay: '#EA580C',
};

const MATERIAL_MASSES: Record<string, number> = {
  Steel: 0.065, Glass: 0.035, Wood: 0.025, Rubber: 0.040, Clay: 0.050,
};

/**
 * Theoretical coefficient of restitution for any pair of colliding materials
 */
function getCombinedE(matA: string, matB: string): number {
  const eA = MATERIAL_DEFAULTS[matA] ?? 0.90;
  const eB = MATERIAL_DEFAULTS[matB] ?? 0.90;
  if (matA === matB) return eA;
  return +(Math.sqrt(eA * eB).toFixed(3));
}

// ── Canvas Renderer (Accurate Lab Manual Impact Apparatus) ─────────────────

function drawSimulator(
  canvas: HTMLCanvasElement,
  params: {
    h: number;
    y: number;
    mA: number;
    mB: number;
    materialA: string;
    materialB: string;
    colorA: string;
    colorB: string;
    animProgress: number; // 0 = idle, 0..0.5 = ball sliding, 0.5..1.0 = projectile phase
    result: SimulationResult | null;
    isAnimating: boolean;
    showTrails: boolean;
  }
) {
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

  // ── Layout Geometry (matching the lab manual image) ────────────────────────
  const MARGIN_LEFT = 45;
  const MARGIN_RIGHT = 35;
  const GROUND_Y = H - 55;

  // Position 2 (horizontal platform exit edge where Ball B rests)
  const TABLE_X = Math.round(W * 0.40);

  // Table elevation scaled proportionally from y (0.30 m - 1.00 m)
  const normY = Math.max(0, Math.min(1, (params.y - 0.30) / (1.00 - 0.30)));
  const minTableH = H * 0.28;
  const maxTableH = H * 0.50;
  const tableHeightPx = minTableH + normY * (maxTableH - minTableH);
  const TABLE_Y = GROUND_Y - tableHeightPx;

  // Release height scaled from h (0.05 m - 0.50 m)
  const normH = Math.max(0, Math.min(1, (params.h - 0.05) / (0.50 - 0.05)));
  const maxRampPx = Math.min(TABLE_Y - 45, H * 0.38);
  const rampHeightPx = 35 + normH * (maxRampPx - 35);
  const Y_RELEASE = TABLE_Y - rampHeightPx;

  // Incline & fillet curve geometry:
  // As shown in the manual: A long straight slope down at ~32 degrees,
  // transitioning through a smooth circular curve to a short horizontal flat section!
  const HORIZ_LEN = 44;
  const KNEE_X = TABLE_X - HORIZ_LEN;
  const R_CURVE = 64;
  const THETA = (32 * Math.PI) / 180; // 32 degree straight incline
  const cosT = Math.cos(THETA);
  const sinT = Math.sin(THETA);
  const tanT = Math.tan(THETA);

  // Center of fillet transition arc (located ABOVE the track since it's concave up)
  const XC = KNEE_X;
  const YC = TABLE_Y - R_CURVE;

  // Tangent point on incline
  const x_tan = XC - R_CURVE * sinT;
  const y_tan = YC + R_CURVE * cosT;

  // Top of ramp structure
  const Y_TOP = Math.max(28, TABLE_Y - maxRampPx - 25);
  let x_top = x_tan - (y_tan - Y_TOP) / tanT;
  if (x_top < MARGIN_LEFT) {
    x_top = MARGIN_LEFT;
  }

  // ── 1. IMPACT APPARATUS Header ─────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 11px JetBrains Mono, monospace';
  ctx.fillText('IMPACT APPARATUS', MARGIN_LEFT, 24);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN_LEFT, 29);
  ctx.lineTo(MARGIN_LEFT + 120, 29);
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
  const footWidth = 46;
  const footLeft = TABLE_X - footWidth / 2 - 2;
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(footLeft, GROUND_Y - 5, footWidth, 5);
  ctx.strokeStyle = '#64748B';
  ctx.strokeRect(footLeft, GROUND_Y - 5, footWidth, 5);

  // Diagonal support strut under curved knee
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(KNEE_X - 8, TABLE_Y + 4);
  ctx.lineTo(colLeft, TABLE_Y + (GROUND_Y - TABLE_Y) * 0.45);
  ctx.stroke();

  // Table top mounting plate
  ctx.fillStyle = '#475569';
  ctx.fillRect(KNEE_X - 14, TABLE_Y, HORIZ_LEN + 16, 5);

  // ── 3. Ramp Guide Rails (Double-Rail Channel as in Manual) ─────────────────
  const BALL_R = 10;
  const RAIL_OFFSET = 6;

  // Lower rail (depth shadow / secondary channel)
  ctx.save();
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x_top - RAIL_OFFSET * sinT, Y_TOP + RAIL_OFFSET * cosT);
  ctx.lineTo(x_tan - RAIL_OFFSET * sinT, y_tan + RAIL_OFFSET * cosT);
  ctx.arc(XC, YC, R_CURVE + RAIL_OFFSET, Math.PI / 2 + THETA, Math.PI / 2, true);
  ctx.lineTo(TABLE_X, TABLE_Y + RAIL_OFFSET);
  ctx.stroke();

  // Cross-struts connecting rails (track ties)
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 1.2;
  const numTies = 11;
  for (let i = 0; i <= numTies; i++) {
    const tFrac = i / numTies;
    const tieX = x_top + tFrac * (x_tan - x_top);
    const tieY = Y_TOP + tFrac * (y_tan - Y_TOP);
    ctx.beginPath();
    ctx.moveTo(tieX, tieY);
    ctx.lineTo(tieX - RAIL_OFFSET * sinT, tieY + RAIL_OFFSET * cosT);
    ctx.stroke();
  }

  // Upper main guide rail (amber glowing track)
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x_top, Y_TOP);
  ctx.lineTo(x_tan, y_tan);
  ctx.arc(XC, YC, R_CURVE, Math.PI / 2 + THETA, Math.PI / 2, true);
  ctx.lineTo(TABLE_X, TABLE_Y);
  ctx.stroke();

  // Rail highlight
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
  // Located on the straight incline at vertical height Y_RELEASE
  const x_pos1 = x_tan - (y_tan - Y_RELEASE) / tanT;
  const y_pos1 = Y_RELEASE;

  // Ball A rests ON TOP of the straight incline track:
  // Normal vector pointing outward/upward from track: (+sinT, -cosT)
  const xA_rest = x_pos1 + BALL_R * sinT;
  const yA_rest = y_pos1 - BALL_R * cosT;

  // Release stopper pin at Position 1 (holding Ball A)
  ctx.save();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x_pos1, y_pos1);
  ctx.lineTo(x_pos1 + 12 * sinT, y_pos1 - 12 * cosT);
  ctx.stroke();
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.arc(x_pos1 + 12 * sinT, y_pos1 - 12 * cosT, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 5. Position 2 (Exit Point on Horizontal Platform) ──────────────────────
  // Ball B rests on the horizontal track lip at Position 2 with center over plumb line
  const xB_rest = TABLE_X;
  const yB_rest = TABLE_Y - BALL_R;

  // ── 6. Ground & Ruler ──────────────────────────────────────────────────────
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
  // Plumb line: dashed vertical line dropping directly from Position 2 (Ball B) to ground
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(TABLE_X, TABLE_Y - BALL_R);
  ctx.lineTo(TABLE_X, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Plumb mark at ground level x = 0
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.arc(TABLE_X, GROUND_Y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal x-axis arrow extending to the right from Position 2 (Ball B center)
  const x_axis_len = Math.min(180, (W - MARGIN_RIGHT) - TABLE_X - 10);
  ctx.save();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(TABLE_X, TABLE_Y - BALL_R);
  ctx.lineTo(TABLE_X + x_axis_len, TABLE_Y - BALL_R);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead pointing right
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.moveTo(TABLE_X + x_axis_len, TABLE_Y - BALL_R);
  ctx.lineTo(TABLE_X + x_axis_len - 7, TABLE_Y - BALL_R - 3.5);
  ctx.lineTo(TABLE_X + x_axis_len - 7, TABLE_Y - BALL_R + 3.5);
  ctx.closePath();
  ctx.fill();

  // Label 'x'
  ctx.font = 'italic 11px JetBrains Mono, monospace';
  ctx.fillText('x', TABLE_X + x_axis_len + 6, TABLE_Y - BALL_R + 3.5);
  ctx.restore();

  // ── 8. Dimension Lines: h and y ────────────────────────────────────────────
  // Dimension h (vertical height between Position 1 and Position 2 level)
  const h_dim_x = Math.max(18, x_pos1 - 28);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(h_dim_x - 4, yA_rest);
  ctx.lineTo(xA_rest, yA_rest);
  ctx.moveTo(h_dim_x - 4, TABLE_Y - BALL_R);
  ctx.lineTo(TABLE_X, TABLE_Y - BALL_R);
  ctx.stroke();
  ctx.setLineDash([]);

  // Vertical dimension line for h
  drawDimensionLine(
    ctx,
    h_dim_x,
    yA_rest,
    h_dim_x,
    TABLE_Y - BALL_R,
    '#38BDF8',
    `h = ${params.h.toFixed(3)} m`,
    true
  );

  // Dimension y (table height from Position 2 to ground)
  const y_dim_x = TABLE_X + 28;
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(TABLE_X, TABLE_Y);
  ctx.lineTo(y_dim_x + 4, TABLE_Y);
  ctx.moveTo(TABLE_X, GROUND_Y);
  ctx.lineTo(y_dim_x + 4, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);

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
  ctx.fillStyle = params.colorA;
  ctx.fillText(`BALL A (${params.materialA})`, xA_rest, yA_rest - BALL_R - 4);

  // Position 2 label
  ctx.fillStyle = '#10B981';
  ctx.fillText('POSITION 2', xB_rest, yB_rest - BALL_R - 14);
  ctx.fillStyle = params.colorB;
  ctx.fillText(`BALL B (${params.materialB})`, xB_rest, yB_rest - BALL_R - 4);
  ctx.restore();

  // ── 10. Animation: Rolling along Curve, Collision & Projectile Flight ──────
  const R_EFF = R_CURVE - BALL_R;
  const L1 = (y_tan - y_pos1) / sinT;
  const L2 = R_EFF * THETA;
  const L3 = Math.max(0, (TABLE_X - 2 * BALL_R) - KNEE_X);
  const S_TOTAL = L1 + L2 + L3;

  function getBallAPosAlongTrack(s: number): { x: number; y: number } {
    if (s <= L1) {
      // On straight incline
      const xt = x_pos1 + s * cosT;
      const yt = y_pos1 + s * sinT;
      return {
        x: xt + BALL_R * sinT,
        y: yt - BALL_R * cosT,
      };
    } else if (s <= L1 + L2) {
      // On fillet arc (riding smoothly on top of the concave arc)
      const sArc = s - L1;
      const phi = THETA - sArc / R_EFF;
      return {
        x: XC - R_EFF * Math.sin(phi),
        y: YC + R_EFF * Math.cos(phi),
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
    // ── SLIDING PHASE: Ball A rolls down ramp to strike Ball B ─────────────────
    const u = params.animProgress * 2; // 0 -> 1
    const sCurrent = S_TOTAL * (u * u);
    const aPos = getBallAPosAlongTrack(sCurrent);

    // Ball B rests at Position 2
    drawBall(ctx, xB_rest, yB_rest, BALL_R, params.colorB, 'B');

    // Draw moving Ball A
    drawBall(ctx, aPos.x, aPos.y, BALL_R, params.colorA, 'A');
  } else if (params.result) {
    // ── PROJECTILE PHASE: Both balls fly off horizontally ──────────────────────
    const u = (params.animProgress - 0.5) * 2; // 0 -> 1
    const { VA, VB, XA, XB } = params.result;

    const dropPx = (u * u) * (GROUND_Y - (TABLE_Y - BALL_R));

    const aCurrentX = (TABLE_X - 2 * BALL_R) + u * (XA * scaleX);
    const aCurrentY = Math.min(GROUND_Y, (TABLE_Y - BALL_R) + dropPx);

    const bCurrentX = TABLE_X + u * (XB * scaleX);
    const bCurrentY = Math.min(GROUND_Y, (TABLE_Y - BALL_R) + dropPx);

    // Parabolic Dashed Trails
    if (params.showTrails && u > 0.02) {
      // Trail A
      ctx.save();
      ctx.strokeStyle = params.colorA;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const numSteps = 40;
      for (let i = 0; i <= Math.floor(u * numSteps); i++) {
        const stepU = i / numSteps;
        const tx = (TABLE_X - 2 * BALL_R) + stepU * (XA * scaleX);
        const ty = (TABLE_Y - BALL_R) + (stepU * stepU) * (GROUND_Y - (TABLE_Y - BALL_R));
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.stroke();

      // Trail B
      ctx.strokeStyle = params.colorB;
      ctx.beginPath();
      for (let i = 0; i <= Math.floor(u * numSteps); i++) {
        const stepU = i / numSteps;
        const tx = TABLE_X + stepU * (XB * scaleX);
        const ty = (TABLE_Y - BALL_R) + (stepU * stepU) * (GROUND_Y - (TABLE_Y - BALL_R));
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Draw the flying balls
    drawBall(ctx, aCurrentX, aCurrentY, BALL_R, params.colorA, 'A');
    drawBall(ctx, bCurrentX, bCurrentY, BALL_R, params.colorB, 'B');

    // ── Landing Markers & Xa, Xb Dimensions ───────────────────────────────────
    if (u >= 0.98 || !params.isAnimating) {
      const xA_land = (TABLE_X - 2 * BALL_R) + XA * scaleX;
      const xB_land = TABLE_X + XB * scaleX;

      // Landing markers on ground
      ctx.fillStyle = params.colorA;
      ctx.fillRect(xA_land - 1.5, GROUND_Y - 4, 3, 10);

      ctx.fillStyle = params.colorB;
      ctx.fillRect(xB_land - 1.5, GROUND_Y - 4, 3, 10);

      // Vertical dashed projection lines from landing points down to dimension lines
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(xA_land, GROUND_Y);
      ctx.lineTo(xA_land, GROUND_Y + 22);
      ctx.moveTo(xB_land, GROUND_Y);
      ctx.lineTo(xB_land, GROUND_Y + 38);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dimension line for X_a
      drawDimensionLine(
        ctx,
        TABLE_X,
        GROUND_Y + 18,
        xA_land,
        GROUND_Y + 18,
        params.colorA,
        `X_a = ${XA.toFixed(3)} m`,
        false
      );

      // Dimension line for X_b
      drawDimensionLine(
        ctx,
        TABLE_X,
        GROUND_Y + 34,
        xB_land,
        GROUND_Y + 34,
        params.colorB,
        `X_b = ${XB.toFixed(3)} m`,
        false
      );
    }
  } else {
    // Idle state: draw balls resting at Position 1 and Position 2
    drawBall(ctx, xA_rest, yA_rest, BALL_R, params.colorA, 'A');
    drawBall(ctx, xB_rest, yB_rest, BALL_R, params.colorB, 'B');
  }
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, label: string) {
  ctx.save();
  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  // 3D gradient sphere
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, lightenColor(color, 50));
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, darkenColor(color, 45));

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Engineering crosshair '+' through center (matching manual diagram)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, y);
  ctx.lineTo(x + r * 0.7, y);
  ctx.moveTo(x, y - r * 0.7);
  ctx.lineTo(x, y + r * 0.7);
  ctx.stroke();

  // Label
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  ctx.restore();
}

function drawDimensionLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, label: string,
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

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = 'bold 9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function lightenColor(hex: string, amount: number) {
  const cleanHex = hex.replace('#', '');
  const r = Math.min(255, parseInt(cleanHex.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(cleanHex.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(cleanHex.slice(4, 6), 16) + amount);
  return `rgb(${r},${g},${b})`;
}
function darkenColor(hex: string, amount: number) {
  const cleanHex = hex.replace('#', '');
  const r = Math.max(0, parseInt(cleanHex.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(cleanHex.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(cleanHex.slice(4, 6), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

// ── Simulator Page Component ───────────────────────────────────────────────

export default function SimulatorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const { addTrial } = useTrialsStore();

  // ── State ─────────────────────────────────────────────────────────────────
  const [h, setH] = useState(0.18);              // release height (m)
  const [y, setY] = useState(0.65);              // table height (m)
  const [mA, setMA] = useState(0.035);           // mass A (kg) - glass default
  const [mB, setMB] = useState(0.065);           // mass B (kg) - steel default

  // Dual Material Selection for Ball A and Ball B (all 5 materials)
  const [materialA, setMaterialA] = useState('Glass');
  const [materialB, setMaterialB] = useState('Steel');
  const [activeRefBall, setActiveRefBall] = useState<'A' | 'B'>('A');

  const [useCustomE, setUseCustomE] = useState(false);
  const [customE, setCustomE] = useState(0.925);
  const [slowMotion, setSlowMotion] = useState(false);
  const [realisticMode, setRealisticMode] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [explanation, setExplanation] = useState('');
  const [showCalcPanel, setShowCalcPanel] = useState(true);

  // ── Derived ───────────────────────────────────────────────────────────────
  const pairReferenceE = getCombinedE(materialA, materialB);
  const e = useCustomE ? customE : pairReferenceE;
  const colorA = MATERIAL_COLORS[materialA] || '#93C5FD';
  const colorB = MATERIAL_COLORS[materialB] || '#6B7280';

  // Live theoretical preview (before release)
  const livePreview = simulate({ h, y, mA, mB, e, noiseAmplitude: 0 });

  // Active data for calculations: uses simulated result if available, or real-time live preview!
  const activeSim = result ?? livePreview;

  // ── Material query ────────────────────────────────────────────────────────
  const { data: materialsData } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const res = await api.get('/materials');
      return res.data.data as { name: string; referenceE: number; color: string }[];
    },
    staleTime: Infinity,
  });

  // ── Canvas drawing effect ─────────────────────────────────────────────────
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
  }, [h, y, mA, mB, e, materialA, materialB, colorA, colorB, animProgress, result, isAnimating]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawSimulator(canvas, {
      h, y, mA, mB,
      materialA,
      materialB,
      colorA,
      colorB,
      animProgress,
      result,
      isAnimating,
      showTrails: true,
    });
  }, [h, y, mA, mB, materialA, materialB, colorA, colorB, animProgress, result, isAnimating]);

  // ── Animation loop ────────────────────────────────────────────────────────
  const animate = useCallback((startTime: number, simResult: SimulationResult) => {
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
  }, [slowMotion]);

  // ── Release handler ───────────────────────────────────────────────────────
  const handleRelease = useCallback(() => {
    if (isAnimating) return;

    cancelAnimationFrame(animFrameRef.current);
    setAnimProgress(0);
    setIsAnimating(true);

    const simResult = simulate({
      h, y, mA, mB, e,
      noiseAmplitude: realisticMode ? 0.002 : 0, // ±2 mm noise
    });

    setResult(simResult);
    setExplanation(explainCollision(simResult, { h, y, mA, mB, e }));

    animate(performance.now(), simResult);

    if (guidedMode) setGuidedStep(4);
  }, [h, y, mA, mB, e, realisticMode, slowMotion, guidedMode, isAnimating, animate]);

  // ── Reset handler ─────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setAnimProgress(0);
    setResult(null);
    setIsAnimating(false);
    setExplanation('');
    if (guidedMode) setGuidedStep(0);
  }, [guidedMode]);

  // ── Swap handler ──────────────────────────────────────────────────────────
  const handleSwapBalls = () => {
    const prevA = materialA;
    const prevB = materialB;
    const prevMA = mA;
    const prevMB = mB;
    setMaterialA(prevB);
    setMaterialB(prevA);
    setMA(prevMB);
    setMB(prevMA);
    handleReset();
  };

  // ── Record Observation ────────────────────────────────────────────────────
  const handleRecord = useCallback(() => {
    if (!result) {
      toast.error('Run a simulation first by clicking Release!');
      return;
    }

    addTrial({
      h, y, mA, mB,
      material: `${materialA} - ${materialB}`,
      XA: result.XA, XB: result.XB,
      UA: result.UA, UB: result.UB,
      VA: result.VA, VB: result.VB,
      e: result.e_calc,
      noiseApplied: realisticMode,
    });

    toast.success(`Observation recorded (${materialA} ➔ ${materialB})! Go to Observations page.`);
  }, [result, h, y, mA, mB, materialA, materialB, realisticMode, addTrial]);

  // ── Guided mode steps ─────────────────────────────────────────────────────
  const GUIDED_STEPS = [
    { label: 'Set materials for Ball A & Ball B', desc: 'Select materials for both balls from the Material Reference card.' },
    { label: 'Set height h', desc: 'Adjust the slider to set the release height of ball A.' },
    { label: 'Set height y', desc: 'Set the table height above the ground.' },
    { label: 'Release', desc: 'Click the Release button beside the diagram to launch ball A.' },
    { label: 'Observe', desc: 'Watch the collision and projectile paths. Note XA and XB.' },
    { label: 'Record', desc: 'Click "Record Observation" to save this trial.' },
  ];

  // ── Step-by-Step Worked Calculations (ALWAYS LIVE & UP TO DATE) ───────────
  const workedSteps = [
    {
      step: 1,
      title: 'Velocity of Ball A Before Impact (UA)',
      symbol: 'UA = √(2 · g · h)',
      formula: `UA = √(2 × ${G} m/s² × ${h.toFixed(3)} m) = ${activeSim.UA.toFixed(4)} m/s`,
      resultText: `${activeSim.UA.toFixed(4)} m/s`,
      note: 'Derived from conservation of mechanical energy along the frictionless ramp',
    },
    {
      step: 2,
      title: 'Velocity of Ball B Before Impact (UB)',
      symbol: 'UB = 0 m/s',
      formula: 'UB = 0.0000 m/s (Stationary at Position 2)',
      resultText: '0.0000 m/s',
      note: 'Ball B rests at the lip of the horizontal platform prior to collision',
    },
    {
      step: 3,
      title: 'Projectile Time of Flight (t)',
      symbol: 't = √(2y / g)',
      formula: `t = √(2 × ${y.toFixed(3)} m / ${G} m/s²) = ${activeSim.t.toFixed(4)} s`,
      resultText: `${activeSim.t.toFixed(4)} s`,
      note: 'Both balls undergo horizontal projectile motion from table height y',
    },
    {
      step: 4,
      title: 'Horizontal Landing Range (XA & XB)',
      symbol: 'X = V · t',
      formula: `XA = VA × t = ${activeSim.XA.toFixed(4)} m  |  XB = VB × t = ${activeSim.XB.toFixed(4)} m`,
      resultText: `XA = ${activeSim.XA.toFixed(3)} m,  XB = ${activeSim.XB.toFixed(3)} m`,
      note: 'Distance measured horizontally along the floor from the plumb line (x = 0)',
    },
    {
      step: 5,
      title: 'Post-Impact Velocities from Landing Distances (VA & VB)',
      symbol: 'V = X / t',
      formula: `VA = ${activeSim.XA.toFixed(4)} / ${activeSim.t.toFixed(4)} = ${activeSim.VA.toFixed(4)} m/s  |  VB = ${activeSim.XB.toFixed(4)} / ${activeSim.t.toFixed(4)} = ${activeSim.VB.toFixed(4)} m/s`,
      resultText: `VA = ${activeSim.VA.toFixed(4)} m/s,  VB = ${activeSim.VB.toFixed(4)} m/s`,
      note: 'Back-calculated post-impact horizontal velocities using lab manual method',
    },
    {
      step: 6,
      title: 'Experimental Coefficient of Restitution (e)',
      symbol: 'e = -(VA − VB) / (UA − UB) = (VB − VA) / UA',
      formula: `e = (${activeSim.VB.toFixed(4)} − ${activeSim.VA.toFixed(4)}) / ${activeSim.UA.toFixed(4)} = ${activeSim.e_calc.toFixed(4)}`,
      resultText: `e = ${activeSim.e_calc.toFixed(4)} (Pair Ref: ${e.toFixed(3)})`,
      note: `Newton's Law of Restitution for direct central impact (${materialA} ➔ ${materialB})`,
    },
    {
      step: 7,
      title: 'Conservation of Linear Momentum Check',
      symbol: 'mA · UA + mB · UB = mA · VA + mB · VB',
      formula: `p_before = ${(mA * activeSim.UA).toFixed(5)} kg·m/s  |  p_after = ${(mA * activeSim.VA + mB * activeSim.VB).toFixed(5)} kg·m/s`,
      resultText: `Δp = ${Math.abs(activeSim.p_after - activeSim.p_before).toFixed(6)} kg·m/s`,
      note: 'Total linear momentum is strictly conserved along the line of impact',
    },
  ];

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

        {/* Live Material Pair Pill */}
        <div className="flex items-center gap-2 bg-surface-2 border border-border px-3.5 py-2 rounded-xl text-xs font-mono self-start sm:self-auto shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorA }} />
          <span className="text-text-primary font-bold">Ball A: {materialA}</span>
          <span className="text-text-muted">➔</span>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorB }} />
          <span className="text-text-primary font-bold">Ball B: {materialB}</span>
          <span className="text-primary font-bold ml-2">e_ref ≈ {pairReferenceE.toFixed(2)}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── Left Column: Canvas Figure + Calculations + Parameters ── */}
        <div className="space-y-5">

          {/* Canvas Figure Card */}
          <div className="glass-card p-4 sm:p-5">
            {/* Top Bar directly above/beside the figure */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-text-muted">
                  Impact Apparatus Figure
                </span>
                <span className={`badge ${isAnimating ? 'badge-warning' : result ? 'badge-success' : 'badge-primary'}`}>
                  {isAnimating ? '⏳ Simulating…' : result ? '✓ Collision Complete' : '● Ready at Position 1'}
                </span>
              </div>

              {/* Side-by-side buttons on figure */}
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-primary btn-sm px-4 py-1.5 flex items-center gap-1.5 font-bold shadow-md shadow-primary/20"
                  onClick={handleRelease}
                  disabled={isAnimating}
                  id="btn-release-canvas"
                >
                  <span>🚀</span>
                  <span>{isAnimating ? 'Running…' : 'Release'}</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm px-3.5 py-1.5 flex items-center gap-1.5 font-semibold"
                  onClick={handleReset}
                  id="btn-reset-canvas"
                >
                  <span>🔄</span>
                  <span>Restart</span>
                </button>
                <button
                  className="btn btn-ghost btn-sm px-3 py-1.5 border border-border text-xs"
                  onClick={handleRecord}
                  disabled={!result}
                  id="btn-record-canvas"
                  title="Record this trial"
                >
                  <span>📝</span>
                  <span className="hidden sm:inline">Record</span>
                </button>
              </div>
            </div>

            {/* Canvas (460px Height for Realistic Ramp Incline & Coordinate Visibility) */}
            <div className="simulator-canvas-wrapper" style={{ height: '460px' }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block' }}
                aria-label="Collision simulation canvas"
                role="img"
              />

              {/* Status overlay */}
              {!isAnimating && animProgress === 0 && (
                <div className="absolute inset-0 flex items-end justify-center pb-12 pointer-events-none">
                  <p className="text-text-muted text-xs font-mono bg-surface-1/90 px-4 py-1.5 rounded-full border border-primary/30 shadow-lg animate-pulse-slow">
                    👉 Click <strong className="text-primary font-bold">Release</strong> beside the diagram to launch Ball A
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── STEP-BY-STEP WORKED CALCULATION PANEL (ALWAYS VISIBLE & LIVE) ─ */}
          <div className="glass-card p-5 border border-primary/20 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🔢</span>
                <div>
                  <h3 className="font-heading text-lg text-text-primary font-bold">
                    Step-by-Step Worked Calculation
                  </h3>
                  <p className="text-xs text-text-muted">
                    Full lab derivation matching St. John College of Engineering & Management Lab Manual
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`badge ${
                    result ? 'badge-success' : 'badge-warning'
                  } text-[10px] font-mono`}
                >
                  {result ? '✓ Trial Data (Simulated)' : '● Live Theoretical Preview'}
                </span>
                <button
                  className="btn btn-ghost btn-sm text-xs py-1 px-2 border border-border"
                  onClick={() => setShowCalcPanel(!showCalcPanel)}
                  aria-label="Toggle calculation panel"
                >
                  {showCalcPanel ? '▲ Collapse' : '▼ Expand'}
                </button>
              </div>
            </div>

            {showCalcPanel && (
              <div className="space-y-3">
                {workedSteps.map((s) => (
                  <div
                    key={s.step}
                    className="p-3 rounded-xl bg-surface-2/60 border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-mono font-bold text-xs flex items-center justify-center">
                          {s.step}
                        </span>
                        <span className="font-semibold text-xs text-text-primary">
                          {s.title}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {s.resultText}
                      </span>
                    </div>

                    <div className="font-mono text-xs text-text-secondary pl-7 mb-1 bg-surface-1/40 p-1.5 rounded border border-border/40">
                      {s.formula}
                    </div>

                    <p className="text-[11px] text-text-muted pl-7 italic">
                      ↳ {s.note}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls Row 1: Sliders */}
          <div className="glass-card p-5">
            <h3 className="font-heading text-lg mb-4 text-text-primary">Parameters</h3>

            <div className="grid sm:grid-cols-2 gap-5">
              {/* h slider */}
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
                  min={0.05} max={0.50} step={0.005}
                  value={h}
                  onChange={(ev) => { setH(Number(ev.target.value)); handleReset(); }}
                  aria-label="Release height h"
                />
                <div className="flex justify-between text-text-muted text-xs mt-1">
                  <span>0.05 m</span><span>0.50 m</span>
                </div>
              </div>

              {/* y slider */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-text-secondary" htmlFor="slider-y">
                    <span className="tooltip-wrapper">
                      y (Table Height Above Ground)
                      <span className="tooltip">Height of the platform above the floor</span>
                    </span>
                  </label>
                  <span className="font-mono text-primary text-sm font-bold">{y.toFixed(2)} m</span>
                </div>
                <input
                  id="slider-y"
                  type="range"
                  min={0.30} max={1.0} step={0.01}
                  value={y}
                  onChange={(ev) => { setY(Number(ev.target.value)); handleReset(); }}
                  aria-label="Table height y"
                />
                <div className="flex justify-between text-text-muted text-xs mt-1">
                  <span>0.30 m</span><span>1.00 m</span>
                </div>
              </div>

              {/* mA */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-text-secondary flex items-center gap-1.5" htmlFor="input-mA">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorA }} />
                    <span className="tooltip-wrapper">
                      m_A (Mass of Ball A: {materialA})
                      <span className="tooltip">Mass of impacting ball A</span>
                    </span>
                  </label>
                  <span className="font-mono text-primary text-sm font-bold">{(mA * 1000).toFixed(1)} g</span>
                </div>
                <input
                  id="input-mA"
                  type="range"
                  min={0.010} max={0.200} step={0.005}
                  value={mA}
                  onChange={(ev) => { setMA(Number(ev.target.value)); handleReset(); }}
                  aria-label="Mass of ball A"
                />
              </div>

              {/* mB */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-text-secondary flex items-center gap-1.5" htmlFor="input-mB">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorB }} />
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
                  min={0.010} max={0.200} step={0.005}
                  value={mB}
                  onChange={(ev) => { setMB(Number(ev.target.value)); handleReset(); }}
                  aria-label="Mass of ball B"
                />
              </div>
            </div>
          </div>

          {/* Controls Row 2: Material Selectors & Toggles */}
          <div className="glass-card p-5">
            <h3 className="font-heading text-lg mb-4 text-text-primary">Ball Materials & Options</h3>
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Ball A Material Selector */}
              <div>
                <label className="text-sm text-text-secondary mb-1.5 flex items-center gap-2" htmlFor="select-material-a">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorA }} />
                  <span>Ball A Material (Impacting)</span>
                </label>
                <select
                  id="select-material-a"
                  className="input"
                  value={materialA}
                  onChange={(ev) => {
                    const newMat = ev.target.value;
                    setMaterialA(newMat);
                    setMA(MATERIAL_MASSES[newMat] ?? 0.05);
                    const newE = getCombinedE(newMat, materialB);
                    setCustomE(newE);
                    handleReset();
                  }}
                >
                  {(materialsData || Object.keys(MATERIAL_DEFAULTS)).map((m) => {
                    const name = typeof m === 'string' ? m : (m as any).name;
                    const refE = typeof m === 'string' ? MATERIAL_DEFAULTS[m] : (m as any).referenceE;
                    return (
                      <option key={name} value={name}>
                        {name} (e_ref ≈ {refE.toFixed(2)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Ball B Material Selector */}
              <div>
                <label className="text-sm text-text-secondary mb-1.5 flex items-center gap-2" htmlFor="select-material-b">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorB }} />
                  <span>Ball B Material (Target)</span>
                </label>
                <select
                  id="select-material-b"
                  className="input"
                  value={materialB}
                  onChange={(ev) => {
                    const newMat = ev.target.value;
                    setMaterialB(newMat);
                    setMB(MATERIAL_MASSES[newMat] ?? 0.05);
                    const newE = getCombinedE(materialA, newMat);
                    setCustomE(newE);
                    handleReset();
                  }}
                >
                  {(materialsData || Object.keys(MATERIAL_DEFAULTS)).map((m) => {
                    const name = typeof m === 'string' ? m : (m as any).name;
                    const refE = typeof m === 'string' ? MATERIAL_DEFAULTS[m] : (m as any).referenceE;
                    return (
                      <option key={name} value={name}>
                        {name} (e_ref ≈ {refE.toFixed(2)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Custom e */}
              <div>
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
                  <span className="text-sm text-text-secondary">Custom e override</span>
                </div>
                {useCustomE && (
                  <>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-text-muted">e (0 = plastic, 1 = elastic)</span>
                      <span className="font-mono text-primary text-sm font-bold">{customE.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0} max={1} step={0.01}
                      value={customE}
                      onChange={(ev) => { setCustomE(Number(ev.target.value)); handleReset(); }}
                      aria-label="Custom coefficient of restitution"
                    />
                  </>
                )}
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3">
                <ToggleOption label="🐢 Slow Motion (2×)" checked={slowMotion} onChange={setSlowMotion}
                  tooltip="Slows animation duration to observe the collision in detail" />
                <ToggleOption label="🎯 Realistic Mode (±2 mm noise)" checked={realisticMode} onChange={setRealisticMode}
                  tooltip="Adds ±2 mm measurement noise to simulate real lab ruler readings" />
                <ToggleOption label="📋 Guided Mode" checked={guidedMode} onChange={(v) => { setGuidedMode(v); setGuidedStep(0); }}
                  tooltip="Step-by-step procedure guide" />
              </div>
            </div>
          </div>

          {/* Guided Steps */}
          {guidedMode && (
            <div className="glass-card p-5 animate-fade-in">
              <h3 className="font-heading text-lg mb-3 text-text-primary">📋 Guided Procedure</h3>
              <div className="space-y-2">
                {GUIDED_STEPS.map((step, i) => (
                  <div
                    key={i}
                    className={`step-item ${i === guidedStep ? 'active' : i < guidedStep ? 'done' : 'pending'}`}
                    role="listitem"
                    aria-current={i === guidedStep ? 'step' : undefined}
                  >
                    <span
                      className="step-number"
                      style={{
                        background: i < guidedStep ? '#22c55e' : i === guidedStep ? 'var(--color-primary)' : 'var(--color-surface-3)',
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
            <div className="glass-card p-5 animate-fade-in border border-amber-500/20">
              <h3 className="font-heading text-lg mb-2 text-primary">💡 What Happened?</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{explanation}</p>
            </div>
          )}
        </div>

        {/* ── Right Column: Release Button Beside Figure + Materials + Readout ─ */}
        <div className="space-y-4">

          {/* ── ACTION BUTTONS BESIDE THE FIGURE ────────────────────────── */}
          <div className="glass-card p-5 border border-primary/25 shadow-lg shadow-primary/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-base font-bold text-text-primary">
                🎮 Controls Beside Figure
              </h3>
              <span className={`badge ${isAnimating ? 'badge-warning' : result ? 'badge-success' : 'badge-primary'}`}>
                {isAnimating ? '⏳ Simulating…' : result ? '✓ Trial Complete' : '● Ready'}
              </span>
            </div>

            {/* Side-by-Side Release and Restart Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                className="btn btn-primary py-3 flex items-center justify-center gap-2 font-bold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={handleRelease}
                disabled={isAnimating}
                id="btn-release"
                aria-label="Release ball A"
              >
                <span>🚀</span>
                <span>{isAnimating ? 'Running…' : 'Release'}</span>
              </button>
              <button
                className="btn btn-secondary py-3 flex items-center justify-center gap-2 font-bold text-base hover:border-amber-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={handleReset}
                id="btn-reset"
                aria-label="Restart simulation"
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
              id="btn-record"
              aria-label="Record this observation"
              style={{
                background: result ? undefined : 'var(--color-surface-3)',
                borderColor: result ? undefined : 'var(--color-border)',
                color: result ? undefined : 'var(--color-text-muted)',
              }}
            >
              <span>📝</span>
              <span>Record Observation</span>
            </button>
          </div>

          {/* ── MATERIAL REFERENCE CARD (FOR BOTH BALL A AND BALL B) ───────── */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-base text-text-primary">📎 Material Reference e</h3>
              <button
                className="btn btn-ghost btn-sm text-xs text-primary border border-primary/20 hover:bg-primary/10 flex items-center gap-1"
                onClick={handleSwapBalls}
                title="Swap Ball A and Ball B materials"
              >
                <span>⇄</span>
                <span>Swap (A ↔ B)</span>
              </button>
            </div>

            {/* Ball Selector Tabs: Select which ball you are picking material for */}
            <div className="grid grid-cols-2 gap-2 mb-3 p-1 bg-surface-2 rounded-xl border border-border">
              <button
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeRefBall === 'A'
                    ? 'bg-primary text-black font-bold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => setActiveRefBall('A')}
                type="button"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorA }} />
                <span>Ball A: {materialA}</span>
              </button>
              <button
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeRefBall === 'B'
                    ? 'bg-primary text-black font-bold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => setActiveRefBall('B')}
                type="button"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorB }} />
                <span>Ball B: {materialB}</span>
              </button>
            </div>

            {/* The 5 Materials list exactly as in the user screenshot */}
            <div className="space-y-2">
              {(materialsData || Object.entries(MATERIAL_DEFAULTS).map(([name, referenceE]) => ({ name, referenceE }))).map((m) => {
                const name = typeof m === 'string' ? m : (m as any).name;
                const refE = typeof m === 'string' ? MATERIAL_DEFAULTS[m] : (m as any).referenceE;
                const currentSelectedMat = activeRefBall === 'A' ? materialA : materialB;
                const isSelected = name === currentSelectedMat;
                return (
                  <div
                    key={name}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'border border-primary bg-amber-500/10'
                        : 'border border-transparent hover:bg-surface-2'
                    }`}
                    onClick={() => {
                      if (activeRefBall === 'A') {
                        setMaterialA(name);
                        setMA(MATERIAL_MASSES[name] ?? 0.05);
                        const newE = getCombinedE(name, materialB);
                        setCustomE(newE);
                      } else {
                        setMaterialB(name);
                        setMB(MATERIAL_MASSES[name] ?? 0.05);
                        const newE = getCombinedE(materialA, name);
                        setCustomE(newE);
                      }
                      handleReset();
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: MATERIAL_COLORS[name] || '#6B7280' }} />
                      <span className="text-sm text-text-secondary">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-primary text-sm">e ≈ {refE.toFixed(2)}</span>
                      {isSelected && (
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">
                          Ball {activeRefBall}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Impact pair theoretical e footer */}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
              <div className="text-text-muted">
                Pair: <strong className="text-text-primary">{materialA}</strong> ➔ <strong className="text-text-primary">{materialB}</strong>
              </div>
              <div className="font-mono text-primary font-bold text-sm">
                e_theory ≈ {e.toFixed(3)}
              </div>
            </div>
          </div>

          {/* Live Readout */}
          <div className="glass-card p-5">
            <h3 className="font-heading text-lg mb-4 text-text-primary">📡 Live Readout</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'UA', value: livePreview.UA, unit: 'm/s', tooltip: 'Velocity of ball A before impact = √(2gh)' },
                { label: 'UB', value: livePreview.UB, unit: 'm/s', tooltip: 'Velocity of ball B before impact (at rest)' },
                { label: 'VA', value: result?.VA ?? livePreview.VA_theory, unit: 'm/s', tooltip: 'Velocity of ball A after impact' },
                { label: 'VB', value: result?.VB ?? livePreview.VB_theory, unit: 'm/s', tooltip: 'Velocity of ball B after impact' },
                { label: 'XA', value: result?.XA ?? livePreview.XA, unit: 'm', tooltip: 'Horizontal distance ball A travels after impact' },
                { label: 'XB', value: result?.XB ?? livePreview.XB, unit: 'm', tooltip: 'Horizontal distance ball B travels after impact' },
                { label: 't', value: livePreview.t, unit: 's', tooltip: 'Time of flight = √(2y/g)' },
                { label: 'e', value: result?.e_calc ?? e, unit: '', tooltip: 'Coefficient of restitution (measured)' },
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

            {/* Momentum */}
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

            <div className="mt-3 p-2 rounded-lg text-center text-xs font-mono"
              style={{
                background: 'var(--color-surface-2)',
                color: result
                  ? Math.abs((result.p_after - result.p_before) / result.p_before) < 0.01
                    ? '#22c55e' : '#f59e0b'
                  : 'var(--color-text-muted)'
              }}
            >
              {result
                ? `Momentum conserved: Δp = ${Math.abs(result.p_after - result.p_before).toFixed(6)} kg·m/s`
                : 'Run simulation to check momentum conservation'
              }
            </div>
          </div>

          {/* Energy Analysis */}
          {result && (
            <div className="glass-card p-5 animate-fade-in">
              <h3 className="font-heading text-base mb-3 text-text-primary">⚡ Energy Analysis</h3>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-text-muted">KE before:</span>
                  <span className="text-blue-400">{result.ke_before.toFixed(6)} J</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">KE after:</span>
                  <span className="text-green-400">{result.ke_after.toFixed(6)} J</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Energy lost:</span>
                  <span className="text-red-400">{(result.ke_before - result.ke_after).toFixed(6)} J</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-text-muted">Loss %:</span>
                  <span className="text-amber-400">
                    {Math.round((1 - result.ke_after / result.ke_before) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleOption({
  label, checked, onChange, tooltip,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tooltip: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="toggle-switch" aria-label={label}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </label>
      <span className="tooltip-wrapper text-sm text-text-secondary cursor-default">
        {label}
        <span className="tooltip">{tooltip}</span>
      </span>
    </div>
  );
}
