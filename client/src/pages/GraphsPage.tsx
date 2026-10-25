/**
 * Graphs Page
 * Charts: e vs h, VA/VB vs UA, Momentum before vs after
 */

import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useTrialsStore } from '../stores/trialsStore';
import { Link } from 'react-router-dom';

const CHART_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '12px',
  color: 'var(--color-text-secondary)',
};

export default function GraphsPage() {
  const { trials } = useTrialsStore();

  if (trials.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center page-enter">
        <div className="glass-card p-16">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="font-heading text-2xl mb-2">No Data to Graph</h2>
          <p className="text-text-secondary mb-6">
            Add observations from the simulator to see charts.
          </p>
          <Link to="/simulator" className="btn btn-primary btn-lg">
            🚀 Go to Simulator
          </Link>
        </div>
      </div>
    );
  }

  // ── Prepare data ───────────────────────────────────────────────────────────

  // Sort by h for meaningful line charts
  const sorted = [...trials].sort((a, b) => a.h - b.h);

  const eVsH = sorted.map((t, i) => ({ name: `T${i+1}`, h: +t.h.toFixed(3), e: +t.e.toFixed(4) }));
  const velocities = sorted.map((t, i) => ({
    name: `T${i+1}`,
    UA: +t.UA.toFixed(3),
    VA: +t.VA.toFixed(3),
    VB: +t.VB.toFixed(3),
  }));
  const momentum = sorted.map((t, i) => ({
    name: `T${i+1}`,
    before: +((t.mA * t.UA + t.mB * t.UB).toFixed(5)),
    after: +((t.mA * t.VA + t.mB * t.VB).toFixed(5)),
  }));
  const eHist = sorted.map((t, i) => ({ name: `T${i+1}`, e: +t.e.toFixed(4) }));

  const meanE = trials.reduce((s, t) => s + t.e, 0) / trials.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 page-enter">
      <div className="mb-6">
        <span className="badge badge-warning mb-2">Graphs</span>
        <h1 className="font-heading text-3xl sm:text-4xl gradient-text">Analysis Charts</h1>
        <p className="text-text-secondary text-sm mt-1">
          {trials.length} observation{trials.length !== 1 ? 's' : ''} · Mean e = {meanE.toFixed(4)}
        </p>
      </div>

      <div className="space-y-6">

        {/* Chart 1: e vs h */}
        <div className="glass-card p-6">
          <h2 className="font-heading text-xl mb-1 text-text-primary">Chart 1: Coefficient of Restitution (e) vs Release Height (h)</h2>
          <p className="text-text-muted text-xs mb-4">
            Ideally, e should be constant regardless of h. Any variation indicates real-world effects.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={eVsH} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="h" label={{ value: 'h (m)', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 11 }} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis domain={[0, 1.1]} label={{ value: 'e', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip
                contentStyle={CHART_STYLE}
                labelFormatter={(v) => `h = ${v} m`}
                formatter={(v: number) => [v.toFixed(4), 'e']}
              />
              <ReferenceLine y={meanE} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: `Mean e = ${meanE.toFixed(3)}`, fill: '#f59e0b', fontSize: 10 }} />
              <Line type="monotone" dataKey="e" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: VA, VB vs UA */}
        <div className="glass-card p-6">
          <h2 className="font-heading text-xl mb-1 text-text-primary">Chart 2: Velocities After Impact (VA, VB) vs Velocity Before Impact (UA)</h2>
          <p className="text-text-muted text-xs mb-4">
            VA and VB should scale linearly with UA. VB should be positive and greater than VA for e &gt; 0.5.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={velocities} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis label={{ value: 'Velocity (m/s)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={CHART_STYLE} formatter={(v: number, name) => [`${v.toFixed(4)} m/s`, name]} />
              <Legend />
              <Line type="monotone" dataKey="UA" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="UA (before)" />
              <Line type="monotone" dataKey="VA" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="VA (after, A)" />
              <Line type="monotone" dataKey="VB" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="VB (after, B)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Momentum before vs after */}
        <div className="glass-card p-6">
          <h2 className="font-heading text-xl mb-1 text-text-primary">Chart 3: Linear Momentum Before vs After Impact</h2>
          <p className="text-text-muted text-xs mb-4">
            Both bars should be approximately equal, verifying conservation of linear momentum.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={momentum} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis label={{ value: 'p (kg·m/s)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={CHART_STYLE} formatter={(v: number, name) => [`${v.toFixed(6)} kg·m/s`, name === 'before' ? 'p_before' : 'p_after']} />
              <Legend />
              <Bar dataKey="before" fill="#3b82f6" name="Momentum Before" radius={[4, 4, 0, 0]} />
              <Bar dataKey="after" fill="#22c55e" name="Momentum After" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: e distribution */}
        <div className="glass-card p-6">
          <h2 className="font-heading text-xl mb-1 text-text-primary">Chart 4: Coefficient of Restitution per Trial</h2>
          <p className="text-text-muted text-xs mb-4">
            Individual e values per trial. The dashed line shows the mean value.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={eHist} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis domain={[0, 1.1]} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={CHART_STYLE} formatter={(v: number) => [v.toFixed(4), 'e']} />
              <ReferenceLine y={meanE} stroke="#ef4444" strokeDasharray="6 3" label={{ value: `Mean: ${meanE.toFixed(3)}`, fill: '#ef4444', fontSize: 10 }} />
              <Bar dataKey="e" fill="#f59e0b" radius={[4, 4, 0, 0]} name="e" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
