/**
 * Report Page – auto-generated lab report, PDF export, submit to teacher
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTrialsStore } from '../stores/trialsStore';
import { useAuthStore } from '../stores/authStore';
import { calculateMeanE, calculatePercentError } from '../utils/physics';

const MATERIAL_REFERENCE_E: Record<string, number> = {
  'Glass - Steel': 0.925,
  'Glass': 0.95,
  'Steel': 0.90,
  'Steel - Glass': 0.925,
};

const SOURCES_OF_ERROR = [
  'Friction between ball and ramp surface (energy loss before impact)',
  'Measurement errors in landing distances XA and XB using scale',
  'Ball B may not be perfectly at rest at Position 2',
  'Air resistance affecting projectile trajectory',
  'Imperfect alignment of ball A along the line of impact',
  'Slight rotation of balls affecting post-impact velocities',
];

const PRECAUTIONS = [
  'Ensure the ramp surface is clean, smooth, and well-lubricated',
  'Ball B must be placed exactly at the edge of the platform at rest',
  'Use carbon paper to accurately mark landing positions',
  'Zero the measuring scale at the base of the table',
  'Perform a minimum of 5 trials and take the mean value of e',
  'Ensure direct central impact by aligning balls carefully along the ramp axis',
  'Conduct the experiment in a calm environment, away from air currents',
];

export default function ReportPage() {
  const { user } = useAuthStore();
  const { trials } = useTrialsStore();
  const navigate = useNavigate();

  const [conclusion, setConclusion] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('Glass - Steel');
  const [savedReportId, setSavedReportId] = useState<string | null>(null);

  const meanE = calculateMeanE(trials.map((t) => t.e));
  const referenceE = MATERIAL_REFERENCE_E[selectedMaterial] ?? 0.90;
  const percentError = calculatePercentError(meanE, referenceE);

  // Auto-generate conclusion
  const autoConclusion = `The experiment was conducted to determine the coefficient of restitution (e) for ${selectedMaterial} balls undergoing direct central impact. ` +
    `From ${trials.length} trial(s), the mean value of e was found to be ${meanE.toFixed(4)}. ` +
    `The reference value for ${selectedMaterial} is e = ${referenceE.toFixed(2)}. ` +
    `The percentage error is ${percentError.toFixed(2)}%. ` +
    (percentError < 10
      ? 'This low error indicates good experimental accuracy, and the results are in close agreement with theoretical values.'
      : 'The relatively higher error may be attributed to friction on the ramp, measurement inaccuracies in landing distances, and air resistance.');

  const { data: existingReports } = useQuery({
    queryKey: ['reports', 'me'],
    queryFn: async () => {
      const res = await api.get('/reports/me');
      return res.data.data;
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/reports', {
        meanE,
        referenceE,
        percentError,
        conclusion: conclusion || autoConclusion,
        sourcesOfError: SOURCES_OF_ERROR,
        precautions: PRECAUTIONS,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setSavedReportId(data.id);
      toast.success('Report saved as draft!');
    },
    onError: () => toast.error('Failed to save report'),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!savedReportId) throw new Error('Save report first');
      const res = await api.post(`/reports/${savedReportId}/submit`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Report submitted to teacher!');
      navigate('/');
    },
    onError: () => toast.error('Failed to submit report'),
  });

  const handlePrint = () => window.print();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center page-enter">
        <div className="glass-card p-12">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="font-heading text-2xl mb-2">Login Required</h2>
          <p className="text-text-secondary mb-6">
            You need to be logged in to create and submit lab reports.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
            Log In
          </button>
        </div>
      </div>
    );
  }

  if (trials.length < 3) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center page-enter">
        <div className="glass-card p-12">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="font-heading text-2xl mb-2">Not Enough Data</h2>
          <p className="text-text-secondary mb-6">
            You need at least 3 observations to generate a report. You have {trials.length}.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/simulator')}>
            Add Observations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 page-enter" id="report-content">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 no-print">
        <div>
          <span className="badge badge-warning mb-2">Lab Report</span>
          <h1 className="font-heading text-3xl sm:text-4xl gradient-text">Lab Report</h1>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨️ Print / PDF</button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? '⏳ Saving…' : '💾 Save Draft'}
          </button>
          {savedReportId && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? '⏳ Submitting…' : '📤 Submit to Teacher'}
            </button>
          )}
        </div>
      </div>

      {/* Print Header */}
      <div className="glass-card p-6 mb-6 text-center">
        <p className="font-heading text-xl text-text-primary">
          St. John College of Engineering and Management, Palghar
        </p>
        <p className="text-text-secondary text-sm mt-1">
          Department of Engineering | Semester I | Engineering Mechanics
        </p>
        <div className="section-divider" />
        <p className="font-heading text-2xl gradient-text">
          Experiment No. 5: Collision of Elastic Bodies
        </p>
        <p className="text-text-secondary mt-1">
          Determination of Coefficient of Restitution by Direct Central Impact
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-left">
          <div><span className="text-text-muted">Name:</span> <strong>{user.name}</strong></div>
          <div><span className="text-text-muted">Roll No:</span> <strong>{user.rollNo || 'N/A'}</strong></div>
          <div><span className="text-text-muted">Division:</span> <strong>{user.division || 'N/A'}</strong></div>
          <div><span className="text-text-muted">Date:</span> <strong>{new Date().toLocaleDateString('en-IN')}</strong></div>
          <div><span className="text-text-muted">Material:</span> <strong>{selectedMaterial}</strong></div>
          <div><span className="text-text-muted">Trials:</span> <strong>{trials.length}</strong></div>
        </div>
      </div>

      {/* Material selection (no-print) */}
      <div className="glass-card p-5 mb-6 no-print">
        <label className="text-sm text-text-secondary mb-2 block">Reference Material</label>
        <select
          className="input"
          value={selectedMaterial}
          onChange={(e) => setSelectedMaterial(e.target.value)}
        >
          {Object.keys(MATERIAL_REFERENCE_E).map((m) => (
            <option key={m} value={m}>{m} (e_ref = {MATERIAL_REFERENCE_E[m]})</option>
          ))}
        </select>
      </div>

      {/* Result */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-heading text-2xl mb-4 gradient-text">📊 Result</h2>
        <div className="stats-grid">
          {[
            { label: 'Mean e (Measured)', value: meanE.toFixed(4), color: '#f59e0b' },
            { label: `Reference e (${selectedMaterial})`, value: referenceE.toFixed(2), color: '#3b82f6' },
            { label: '% Error', value: `${percentError.toFixed(2)}%`, color: percentError < 10 ? '#22c55e' : '#ef4444' },
            { label: 'No. of Trials', value: trials.length.toString(), color: '#a3a3a3' },
          ].map((stat) => (
            <div key={stat.label} className="surface-card p-4 text-center">
              <div className="text-2xl font-mono font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-text-muted text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Observation Table (summary) */}
      <div className="glass-card p-6 mb-6 overflow-x-auto">
        <h2 className="font-heading text-xl mb-4 text-text-primary">Observation Table (Summary)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sr.</th>
              <th>h (m)</th>
              <th>XA (m)</th>
              <th>XB (m)</th>
              <th>UA (m/s)</th>
              <th>VA (m/s)</th>
              <th>VB (m/s)</th>
              <th>e</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((t, i) => (
              <tr key={t.localId}>
                <td>{i + 1}</td>
                <td className="font-mono">{t.h.toFixed(3)}</td>
                <td className="font-mono">{t.XA.toFixed(4)}</td>
                <td className="font-mono">{t.XB.toFixed(4)}</td>
                <td className="font-mono text-blue-400">{t.UA.toFixed(4)}</td>
                <td className="font-mono text-amber-400">{t.VA.toFixed(4)}</td>
                <td className="font-mono text-green-400">{t.VB.toFixed(4)}</td>
                <td className="font-mono font-bold text-primary">{t.e.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-2">
              <td colSpan={7} className="text-right font-semibold">Mean e =</td>
              <td className="font-mono font-bold text-primary text-lg">{meanE.toFixed(4)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Conclusion */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-heading text-xl mb-3 text-text-primary">🔍 Conclusion</h2>
        <textarea
          className="input min-h-[120px] resize-none"
          value={conclusion}
          placeholder={autoConclusion}
          onChange={(e) => setConclusion(e.target.value)}
          aria-label="Conclusion"
        />
        {!conclusion && (
          <button
            className="btn btn-ghost btn-sm mt-2 no-print"
            onClick={() => setConclusion(autoConclusion)}
          >
            ✨ Use Auto-generated Conclusion
          </button>
        )}
        {(conclusion || autoConclusion) && (
          <p className="mt-3 text-text-secondary text-sm leading-relaxed print:block">
            {conclusion || autoConclusion}
          </p>
        )}
      </div>

      {/* Error Analysis */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-heading text-xl mb-3 text-text-primary">⚠️ Sources of Error</h2>
        <ol className="space-y-2">
          {SOURCES_OF_ERROR.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="text-primary flex-shrink-0 font-mono">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {/* Precautions */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-heading text-xl mb-3 text-text-primary">🛡️ Precautions</h2>
        <ol className="space-y-2">
          {PRECAUTIONS.map((p, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="text-green-400 flex-shrink-0 font-mono">{i + 1}.</span>
              {p}
            </li>
          ))}
        </ol>
      </div>

      {/* Teacher feedback (if graded) */}
      {existingReports?.find((r: any) => r.status === 'GRADED') && (
        <div className="glass-card p-6 mb-6 border border-green-500/20">
          <h2 className="font-heading text-xl mb-3 text-green-400">✅ Teacher Feedback</h2>
          {(() => {
            const graded = existingReports.find((r: any) => r.status === 'GRADED');
            return graded ? (
              <>
                <div className="flex gap-4 mb-3">
                  <div className="surface-card p-3 text-center">
                    <div className="text-2xl font-mono font-bold text-primary">{graded.marks}/100</div>
                    <div className="text-text-muted text-xs">Marks</div>
                  </div>
                </div>
                {graded.teacherRemarks && (
                  <p className="text-text-secondary text-sm leading-relaxed">{graded.teacherRemarks}</p>
                )}
              </>
            ) : null;
          })()}
        </div>
      )}

      {/* Action buttons (bottom) */}
      <div className="flex flex-wrap gap-3 no-print pb-8">
        <button className="btn btn-secondary" onClick={handlePrint}>
          🖨️ Print / Save as PDF
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? '⏳ Saving…' : '💾 Save Draft'}
        </button>
        {savedReportId && (
          <button
            className="btn btn-primary"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? '⏳ Submitting…' : '📤 Submit to Teacher'}
          </button>
        )}
      </div>
    </div>
  );
}
