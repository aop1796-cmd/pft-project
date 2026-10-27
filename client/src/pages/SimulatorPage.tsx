/**
 * Simulator Page
 * Canvas-based physics simulation of direct central impact
 * Features:
 *  - Dual ball material selection (Ball A & Ball B) supporting Steel, Glass, Wood, Rubber, Clay
 *  - Interactive Material Reference card with Ball A and Ball B tabs
 *  - Release and Restart buttons placed right beside the figure, side by side
 *  - Smooth curved ramp with physically grounded rolling along the curve
 *  - Projectile trails, landing markers, dimension lines, and live readout
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

// ── Canvas Renderer ───────────────────────────────────────────────────────

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
    animProgress: number; // 0 = idle, 0-0.5 = ball sliding, 0.5-1 = projectile phase
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

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d0d1a');
  bg.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grid dots
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 0; x < W; x += 30) {
    for (let y = 0; y < H; y += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Layout constants ──────────────────────────────────────────────────────
  const MARGIN_LEFT = 55;
  const MARGIN_RIGHT = 40;
  const MARGIN_BOTTOM = 50;

  const TABLE_X = W * 0.38; // where the table/platform exit is
  const GROUND_Y = H - MARGIN_BOTTOM;
  const TABLE_Y = GROUND_Y - (params.y / 1.0) * (H * 0.52); // scaled platform top
  const RAMP_START_X = MARGIN_LEFT;
  const RAMP_TOP_Y = TABLE_Y - (params.h / 0.5) * (H * 0.38); // top of ramp based on h

  // ── Ground ────────────────────────────────────────────────────────────────
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(MARGIN_LEFT, GROUND_Y);
  ctx.lineTo(W - MARGIN_RIGHT, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Ground diagonal hatching (////)
  ctx.strokeStyle = '#272f3d';
  ctx.lineWidth = 1;
  for (let gx = MARGIN_LEFT; gx < W - MARGIN_RIGHT; gx += 12) {
    ctx.beginPath();
    ctx.moveTo(gx, GROUND_Y + 2);
    ctx.lineTo(gx - 6, GROUND_Y + 8);
    ctx.stroke();
  }

  // Ruler on ground
  ctx.fillStyle = '#374151';
  ctx.fillRect(MARGIN_LEFT, GROUND_Y + 1, W - MARGIN_LEFT - MARGIN_RIGHT, 3);
  for (let px = MARGIN_LEFT; px < W - MARGIN_RIGHT; px += 20) {
    ctx.fillStyle = '#4B5563';
    ctx.fillRect(px, GROUND_Y + 1, 1, (px - MARGIN_LEFT) % 100 === 0 ? 8 : 4);
  }

  // ── Table platform & Stand ────────────────────────────────────────────────
  const legW = 12;
  ctx.fillStyle = '#1F2937';
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.fillRect(TABLE_X - legW, TABLE_Y, legW, GROUND_Y - TABLE_Y);
  ctx.strokeRect(TABLE_X - legW, TABLE_Y, legW, GROUND_Y - TABLE_Y);

  // Platform top surface
  ctx.fillStyle = '#374151';
  ctx.fillRect(RAMP_START_X + 50, TABLE_Y, TABLE_X - RAMP_START_X - 50 + 4, 4);

  // ── Plumb Line from Position 2 to Ground ──────────────────────────────────
  ctx.strokeStyle = '#4B5563';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(TABLE_X, TABLE_Y);
  ctx.lineTo(TABLE_X, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Horizontal x-axis arrow from Position 2
  const xAxisLen = Math.min(140, W - MARGIN_RIGHT - TABLE_X - 10);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(TABLE_X, TABLE_Y);
  ctx.lineTo(TABLE_X + xAxisLen, TABLE_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  // Arrowhead
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.moveTo(TABLE_X + xAxisLen, TABLE_Y);
  ctx.lineTo(TABLE_X + xAxisLen - 6, TABLE_Y - 3);
  ctx.lineTo(TABLE_X + xAxisLen - 6, TABLE_Y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'italic 10px JetBrains Mono, monospace';
  ctx.fillText('x', TABLE_X + xAxisLen + 4, TABLE_Y + 3);

  // ── Curved Ramp ───────────────────────────────────────────────────────────
  // Smoothly curves from top release point down to table level
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = 'rgba(245,158,11,0.45)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(RAMP_START_X, RAMP_TOP_Y);
  ctx.bezierCurveTo(
    RAMP_START_X + (TABLE_X - RAMP_START_X) * 0.28, RAMP_TOP_Y + (TABLE_Y - RAMP_TOP_Y) * 0.1,
    RAMP_START_X + (TABLE_X - RAMP_START_X) * 0.65, TABLE_Y,
    TABLE_X, TABLE_Y
  );
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Ramp vertical dashed support line
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(RAMP_START_X, RAMP_TOP_Y);
  ctx.lineTo(RAMP_START_X, TABLE_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Dimension Lines ───────────────────────────────────────────────────────
  // h – height of ramp release point
  drawDimensionLine(ctx, RAMP_START_X - 20, RAMP_TOP_Y, RAMP_START_X - 20, TABLE_Y, '#38BDF8', `h = ${params.h.toFixed(2)} m`);

  // y – table height above ground
  drawDimensionLine(ctx, TABLE_X + 25, TABLE_Y, TABLE_X + 25, GROUND_Y, '#10B981', `y = ${params.y.toFixed(2)} m`);

  // ── Ball B at rest (Position 2) ────────────────────────────────────────────
  const BALL_R = 10;
  const B_REST_X = TABLE_X;
  const B_REST_Y = TABLE_Y - BALL_R;

  // ── Ball A at start (Position 1) ───────────────────────────────────────────
  const A_START_X = RAMP_START_X + 12;
  const A_START_Y = RAMP_TOP_Y + 3;

  if (params.animProgress < 0.5 || !params.result) {
    // Ball B rests at Position 2 before impact
    drawBall(ctx, B_REST_X, B_REST_Y, BALL_R, params.colorB, 'B');
  }

  if (params.animProgress < 0.5) {
    // Sliding phase: Ball A moves down along the ramp curve
    const progress = params.animProgress * 2; // 0→1
    const t = easeIn(progress); // smooth gravity acceleration

    // Quadratic interpolation along the ramp curve
    const P0 = { x: A_START_X, y: A_START_Y };
    const P1 = { x: RAMP_START_X + (TABLE_X - RAMP_START_X) * 0.5, y: TABLE_Y - BALL_R };
    const P2 = { x: B_REST_X - BALL_R * 2, y: TABLE_Y - BALL_R };

    const ax = (1 - t) * (1 - t) * P0.x + 2 * (1 - t) * t * P1.x + t * t * P2.x;
    const ay = (1 - t) * (1 - t) * P0.y + 2 * (1 - t) * t * P1.y + t * t * P2.y;

    drawBall(ctx, ax, ay, BALL_R, params.colorA, 'A');

    // Labels
    if (params.animProgress === 0) {
      drawLabel(ctx, A_START_X, A_START_Y - BALL_R - 6, `Pos 1 (${params.materialA})`, params.colorA);
      drawLabel(ctx, B_REST_X, B_REST_Y - BALL_R - 6, `Pos 2 (${params.materialB})`, params.colorB);
    }
  } else if (params.result) {
    // Projectile phase: both balls fly off horizontally from Position 2
    const progress = (params.animProgress - 0.5) * 2; // 0→1
    const { VA, VB, t: flightTime, XA, XB } = params.result;

    // Scale factors for canvas display
    const availWidth = (W - MARGIN_RIGHT) - TABLE_X;
    const maxMeters = Math.max(Math.abs(XA), XB, 0.4) * 1.15;
    const xScale = availWidth / maxMeters;
    const gravScale = GROUND_Y - TABLE_Y;

    const elapsedT = progress * flightTime;
    const subG = G;

    // Ball A position
    const aFinalX = TABLE_X + VA * elapsedT * xScale;
    const aFinalY = TABLE_Y + 0.5 * subG * elapsedT ** 2 * (gravScale / (0.5 * subG * flightTime ** 2));
    drawBall(ctx, aFinalX, Math.min(aFinalY, GROUND_Y - BALL_R), BALL_R, params.colorA, 'A');

    // Ball B position
    const bFinalX = TABLE_X + VB * elapsedT * xScale;
    const bFinalY = TABLE_Y + 0.5 * subG * elapsedT ** 2 * (gravScale / (0.5 * subG * flightTime ** 2));
    drawBall(ctx, bFinalX, Math.min(bFinalY, GROUND_Y - BALL_R), BALL_R, params.colorB, 'B');

    // Trails (dashed in each ball's distinct color)
    if (params.showTrails && progress > 0.04) {
      // Ball A Trail
      ctx.save();
      ctx.strokeStyle = params.colorA;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(TABLE_X, TABLE_Y);
      ctx.quadraticCurveTo(TABLE_X + (VA * flightTime * xScale * progress) / 2, TABLE_Y + 20, aFinalX, aFinalY);
      ctx.stroke();

      // Ball B Trail
      ctx.strokeStyle = params.colorB;
      ctx.beginPath();
      ctx.moveTo(TABLE_X, TABLE_Y);
      ctx.quadraticCurveTo(TABLE_X + (VB * flightTime * xScale * progress) / 2, TABLE_Y + 20, bFinalX, bFinalY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // When animation completes, show landing markers and XA, XB dimension lines
    if (progress >= 0.98 || !params.isAnimating) {
      const xA_canvas = TABLE_X + VA * flightTime * xScale;
      const xB_canvas = TABLE_X + VB * flightTime * xScale;

      // Landing markers
      ctx.fillStyle = params.colorA;
      ctx.fillRect(xA_canvas - 1.5, GROUND_Y - 4, 3, 10);
      ctx.fillStyle = params.colorB;
      ctx.fillRect(xB_canvas - 1.5, GROUND_Y - 4, 3, 10);

      // XA dimension line
      drawDimensionLine(ctx, TABLE_X, GROUND_Y + 18, xA_canvas, GROUND_Y + 18, params.colorA, `XA = ${XA.toFixed(3)} m`);
      // XB dimension line
      drawDimensionLine(ctx, TABLE_X, GROUND_Y + 32, xB_canvas, GROUND_Y + 32, params.colorB, `XB = ${XB.toFixed(3)} m`);
    }
  }

  // Ground label
  ctx.fillStyle = '#4B5563';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText('Ground', MARGIN_LEFT + 4, GROUND_Y - 6);
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, label: string) {
  ctx.save();
  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;

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
  color: string, label: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);

  // Arrow heads
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tick marks
  const isVertical = Math.abs(x2 - x1) < 2;
  if (isVertical) {
    ctx.beginPath(); ctx.moveTo(x1 - 5, y1); ctx.lineTo(x1 + 5, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2 - 5, y2); ctx.lineTo(x2 + 5, y2); ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.save();
    ctx.translate(x1 + 12, (y1 + y2) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, -label.length * 3, 0);
    ctx.restore();
  } else {
    const midX = (x1 + x2) / 2;
    const midY = Math.min(y1, y2) - 5;
    ctx.fillStyle = color;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, midX, midY);
    ctx.beginPath(); ctx.moveTo(x1, y1 - 4); ctx.lineTo(x1, y1 + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2 - 4); ctx.lineTo(x2, y2 + 4); ctx.stroke();
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

function easeIn(t: number) { return t * t; }
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
  const [h, setH] = useState(0.15);              // release height (m)
  const [y, setY] = useState(0.60);              // table height (m)
  const [mA, setMA] = useState(0.035);           // mass A (kg) - glass default
  const [mB, setMB] = useState(0.065);           // mass B (kg) - steel default

  // Dual Material Selection for Ball A and Ball B
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

  // Live preview (before release)
  const livePreview = simulate({ h, y, mA, mB, e, noiseAmplitude: 0 });

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
    const DURATION = slowMotion ? 4000 : 2000; // ms

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

  const calcSteps = result ? getCalculationSteps(result, { h, y, mA, mB, e }) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 page-enter">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="badge badge-warning mb-2">Simulator</span>
          <h1 className="font-heading text-3xl sm:text-4xl gradient-text">Physics Simulator</h1>
          <p className="text-text-secondary text-sm mt-1">
            Direct Central Impact · Coefficient of Restitution
          </p>
        </div>

        {/* Live Material Pair Pill */}
        <div className="flex items-center gap-2 bg-surface-2 border border-border px-3.5 py-2 rounded-xl text-xs font-mono self-start sm:self-auto">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorA }} />
          <span className="text-text-primary font-bold">Ball A: {materialA}</span>
          <span className="text-text-muted">➔</span>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorB }} />
          <span className="text-text-primary font-bold">Ball B: {materialB}</span>
          <span className="text-primary font-bold ml-2">e_ref ≈ {pairReferenceE.toFixed(2)}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── Left Column: Canvas Figure + Parameters ─────────────────── */}
        <div className="space-y-4">

          {/* Canvas Figure Card */}
          <div className="glass-card p-4 sm:p-5">
            {/* Top Bar above/beside figure with status and quick side-by-side action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-text-muted">
                  Simulation Figure
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

            {/* Canvas */}
            <div className="simulator-canvas-wrapper" style={{ height: '380px' }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block' }}
                aria-label="Collision simulation canvas"
                role="img"
              />

              {/* Status overlay */}
              {!isAnimating && animProgress === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-text-muted text-xs font-mono bg-surface-1/80 px-3 py-1.5 rounded-full border border-border animate-pulse-slow">
                    ↑ Click Release beside the diagram to launch Ball A
                  </p>
                </div>
              )}
            </div>
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
                      h (Release Height)
                      <span className="tooltip">Height from which ball A is released on the ramp</span>
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
                      y (Table Height)
                      <span className="tooltip">Height of the table above the ground</span>
                    </span>
                  </label>
                  <span className="font-mono text-primary text-sm font-bold">{y.toFixed(3)} m</span>
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
                  <span>0.3 m</span><span>1.0 m</span>
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
                aria-label="Reset simulation"
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

          {/* Calculation Panel */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-text-primary">🔢 Worked Calculation</h3>
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
                  <div>
                    {calcSteps.map((step, i) => (
                      <div key={i} className="calc-step">
                        <span className="calc-label">Step {i + 1}</span>
                        <span className="calc-formula flex-1 font-mono text-xs">{step}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted text-sm text-center py-4">
                    Run a simulation to see step-by-step calculations
                  </p>
                )}
              </div>
            )}
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
