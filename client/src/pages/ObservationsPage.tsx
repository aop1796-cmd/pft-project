/**
 * Observations Page
 * Table matching the lab manual – auto-filled from simulator trials
 */

import { useTrialsStore, Trial } from '../stores/trialsStore';
import { calculateMeanE } from '../utils/physics';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function ObservationsPage() {
  const { trials, deleteTrial, clearTrials, exportCsv } = useTrialsStore();
  const { user } = useAuthStore();

  const meanE = calculateMeanE(trials.map((t) => t.e));
  const minTrialsRequired = 5;

  const handleDelete = async (localId: string) => {
    await deleteTrial(localId);
    toast.success('Trial deleted');
  };

  const handleClearAll = async () => {
    if (!confirm('Delete all observations? This cannot be undone.')) return;
    await clearTrials();
    toast.success('All observations cleared');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <span className="badge badge-warning mb-2">Observations</span>
          <h1 className="font-heading text-3xl sm:text-4xl gradient-text">Observation Table</h1>
          <p className="text-text-secondary text-sm mt-1">
            Experiment 5: Direct Central Impact
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!user && (
            <span className="badge badge-warning self-center">Guest Mode – data in localStorage</span>
          )}
          <button onClick={exportCsv} className="btn btn-secondary btn-sm" disabled={trials.length === 0}>
            ⬇️ Export CSV
          </button>
          <button onClick={handleClearAll} className="btn btn-danger btn-sm" disabled={trials.length === 0}>
            🗑️ Clear All
          </button>
          <Link to="/simulator" className="btn btn-primary btn-sm">
            + Add Observation
          </Link>
        </div>
      </div>

      {/* College header for print */}
      <div className="glass-card p-4 mb-6 text-center hidden print:block">
        <p className="font-heading text-lg">St. John College of Engineering and Management, Palghar</p>
        <p className="text-text-secondary text-sm">Department of Engineering | Semester I | Engineering Mechanics</p>
        <p className="font-semibold mt-1">Experiment 5: Collision of Elastic Bodies – Observation Table</p>
        {user && <p className="text-sm mt-1">Name: {user.name} | Roll No: {user.rollNo || 'N/A'} | Division: {user.division || 'N/A'}</p>}
      </div>

      {/* Progress indicator */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">
            Observations: <strong className="text-text-primary">{trials.length}</strong> / {minTrialsRequired} required
          </span>
          {trials.length >= minTrialsRequired ? (
            <span className="badge badge-success">✓ Sufficient</span>
          ) : (
            <span className="badge badge-warning">Need {minTrialsRequired - trials.length} more</span>
          )}
        </div>
        <div className="w-full bg-surface-3 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((trials.length / minTrialsRequired) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Table */}
      {trials.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="font-heading text-2xl mb-2">No Observations Yet</h2>
          <p className="text-text-secondary mb-6">
            Run the simulator and click "Record Observation" to add data here.
            Minimum 5 observations required.
          </p>
          <Link to="/simulator" className="btn btn-primary btn-lg">
            🚀 Go to Simulator
          </Link>
        </div>
      ) : (
        <>
          <div className="glass-card overflow-x-auto">
            <table className="data-table" aria-label="Observation table">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ verticalAlign: 'middle' }}>Sr. No.</th>
                  <th rowSpan={2} style={{ verticalAlign: 'middle' }}>h (m)</th>
                  <th colSpan={2} className="text-center border-l border-border">Ball A</th>
                  <th colSpan={2} className="text-center border-l border-border">Ball B</th>
                  <th colSpan={2} className="text-center border-l border-border">Velocity Before (m/s)</th>
                  <th colSpan={2} className="text-center border-l border-border">Velocity After (m/s)</th>
                  <th rowSpan={2} className="border-l border-border" style={{ verticalAlign: 'middle' }}>e</th>
                  <th rowSpan={2} className="no-print" style={{ verticalAlign: 'middle' }}>Actions</th>
                </tr>
                <tr>
                  <th className="border-l border-border">
                    <span className="tooltip-wrapper">XA (m)<span className="tooltip">Horizontal landing distance of ball A after impact</span></span>
                  </th>
                  <th>y (m)</th>
                  <th className="border-l border-border">
                    <span className="tooltip-wrapper">XB (m)<span className="tooltip">Horizontal landing distance of ball B after impact</span></span>
                  </th>
                  <th>y (m)</th>
                  <th className="border-l border-border">
                    <span className="tooltip-wrapper">UA<span className="tooltip">Velocity of ball A before impact = √(2gh)</span></span>
                  </th>
                  <th>
                    <span className="tooltip-wrapper">UB<span className="tooltip">Velocity of ball B before impact (always 0)</span></span>
                  </th>
                  <th className="border-l border-border">
                    <span className="tooltip-wrapper">VA<span className="tooltip">Velocity of ball A after impact = XA/t</span></span>
                  </th>
                  <th>
                    <span className="tooltip-wrapper">VB<span className="tooltip">Velocity of ball B after impact = XB/t</span></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {trials.map((trial, idx) => (
                  <ObservationRow
                    key={trial.localId}
                    trial={trial}
                    index={idx}
                    onDelete={() => handleDelete(trial.localId)}
                  />
                ))}

                {/* Padding rows to reach minimum 5 */}
                {trials.length < minTrialsRequired && Array.from({ length: minTrialsRequired - trials.length }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td className="text-text-muted">{trials.length + i + 1}</td>
                    {Array(10).fill(0).map((_, j) => (
                      <td key={j} className="text-text-muted">—</td>
                    ))}
                    <td className="no-print">
                      <Link to="/simulator" className="btn btn-ghost btn-sm text-xs">+ Add</Link>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Mean row */}
              {trials.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--color-surface-2)' }}>
                    <td colSpan={10} className="text-right font-semibold text-text-secondary pr-4">
                      Mean e =
                    </td>
                    <td className="font-mono text-primary font-bold text-lg">
                      {meanE.toFixed(4)}
                    </td>
                    <td className="no-print" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            {[
              { label: 'Trials', value: trials.length, unit: '' },
              { label: 'Mean e', value: meanE.toFixed(4), unit: '' },
              { label: 'Min e', value: Math.min(...trials.map((t) => t.e)).toFixed(4), unit: '' },
              { label: 'Max e', value: Math.max(...trials.map((t) => t.e)).toFixed(4), unit: '' },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-4 text-center">
                <div className="readout-value">{stat.value}{stat.unit}</div>
                <div className="readout-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ObservationRow({ trial, index, onDelete }: { trial: Trial; index: number; onDelete: () => void }) {
  const eColor = trial.e >= 0.85 ? '#22c55e' : trial.e >= 0.6 ? '#f59e0b' : '#ef4444';

  return (
    <tr>
      <td className="text-center text-text-muted">{index + 1}</td>
      <td className="font-mono">{trial.h.toFixed(3)}</td>
      <td className="font-mono">{trial.XA.toFixed(4)}</td>
      <td className="font-mono text-text-muted">{trial.y.toFixed(2)}</td>
      <td className="font-mono">{trial.XB.toFixed(4)}</td>
      <td className="font-mono text-text-muted">{trial.y.toFixed(2)}</td>
      <td className="font-mono text-blue-400">{trial.UA.toFixed(4)}</td>
      <td className="font-mono text-text-muted">0.0000</td>
      <td className="font-mono text-amber-400">{trial.VA.toFixed(4)}</td>
      <td className="font-mono text-green-400">{trial.VB.toFixed(4)}</td>
      <td className="font-mono font-bold" style={{ color: eColor }}>
        {trial.e.toFixed(4)}
      </td>
      <td className="no-print">
        <button
          onClick={onDelete}
          className="btn btn-ghost btn-sm text-xs text-red-400 hover:text-red-300"
          aria-label={`Delete trial ${index + 1}`}
          title="Delete this trial"
        >
          🗑️
        </button>
      </td>
    </tr>
  );
}
