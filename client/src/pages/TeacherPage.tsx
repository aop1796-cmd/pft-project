/**
 * Teacher Dashboard
 * View students, review submissions, grade reports, class analytics
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type TabType = 'overview' | 'students' | 'reports' | 'analytics';
type ReportStatus = 'SUBMITTED' | 'GRADED' | 'DRAFT';

export default function TeacherPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [reportFilter, setReportFilter] = useState<ReportStatus | ''>('SUBMITTED');
  const [gradingReport, setGradingReport] = useState<any>(null);
  const [marks, setMarks] = useState('');
  const [remarks, setRemarks] = useState('');

  const queryClient = useQueryClient();

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['teacher', 'analytics'],
    queryFn: async () => {
      const res = await api.get('/teacher/analytics');
      return res.data.data;
    },
  });

  const { data: students } = useQuery({
    queryKey: ['teacher', 'students'],
    queryFn: async () => {
      const res = await api.get('/teacher/students');
      return res.data.data;
    },
    enabled: activeTab === 'students',
  });

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['teacher', 'reports', reportFilter],
    queryFn: async () => {
      const url = reportFilter ? `/teacher/reports?status=${reportFilter}` : '/teacher/reports';
      const res = await api.get(url);
      return res.data.data;
    },
    enabled: activeTab === 'reports' || activeTab === 'overview',
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ id, marks, remarks }: { id: string; marks: number; remarks: string }) => {
      const res = await api.patch(`/teacher/reports/${id}/grade`, { marks, teacherRemarks: remarks });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Report graded!');
      setGradingReport(null);
      setMarks('');
      setRemarks('');
      queryClient.invalidateQueries({ queryKey: ['teacher', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'analytics'] });
    },
    onError: () => toast.error('Failed to grade report'),
  });

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'students', label: '👥 Students' },
    { id: 'reports', label: '📝 Reports' },
    { id: 'analytics', label: '📈 Analytics' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 page-enter">
      <div className="mb-6">
        <span className="badge badge-info mb-2">Teacher Portal</span>
        <h1 className="font-heading text-3xl sm:text-4xl gradient-text-blue">Teacher Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">Manage students, review reports, and track class performance</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {analyticsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="shimmer h-24 rounded-xl" />
              ))}
            </div>
          ) : analytics ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Students', value: analytics.studentCount, icon: '👥' },
                  { label: 'Total Trials', value: analytics.trialCount, icon: '🔬' },
                  { label: 'Reports', value: analytics.reportCount, icon: '📝' },
                  { label: 'Avg e', value: analytics.avgE?.toFixed(3) || '—', icon: '📊' },
                ].map((s) => (
                  <div key={s.label} className="glass-card p-5 text-center card-3d">
                    <div className="text-3xl mb-2">{s.icon}</div>
                    <div className="readout-value text-2xl">{s.value}</div>
                    <div className="readout-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Status breakdown */}
              <div className="glass-card p-6">
                <h2 className="font-heading text-xl mb-4 text-text-primary">Report Status</h2>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(analytics.statusBreakdown || {}).map(([status, count]) => (
                    <div key={status} className="surface-card p-4 text-center">
                      <div className="text-xl font-mono font-bold text-text-primary">{count as number}</div>
                      <div className={`badge mt-1 ${status === 'GRADED' ? 'badge-success' : status === 'SUBMITTED' ? 'badge-warning' : 'badge-neutral'}`}>
                        {status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick stats */}
              <div className="glass-card p-6">
                <h2 className="font-heading text-xl mb-4 text-text-primary">Class Performance</h2>
                <div className="grid sm:grid-cols-3 gap-4 text-center">
                  {[
                    { label: 'Avg Quiz Score', value: `${analytics.avgQuizScore?.toFixed(1) || 0}%`, color: '#3b82f6' },
                    { label: 'Avg % Error', value: `${analytics.avgPercentError?.toFixed(2) || 0}%`, color: '#f59e0b' },
                    { label: 'Avg Marks', value: analytics.avgMarks?.toFixed(1) || '—', color: '#22c55e' },
                  ].map((s) => (
                    <div key={s.label} className="surface-card p-4">
                      <div className="text-2xl font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-text-muted text-sm mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {/* Pending reports */}
          {reports && reports.filter((r: any) => r.status === 'SUBMITTED').length > 0 && (
            <div className="glass-card p-6">
              <h2 className="font-heading text-xl mb-4 text-text-primary">
                Pending Grading ({reports.filter((r: any) => r.status === 'SUBMITTED').length})
              </h2>
              <div className="space-y-3">
                {reports.filter((r: any) => r.status === 'SUBMITTED').slice(0, 5).map((report: any) => (
                  <ReportRow key={report.id} report={report} onGrade={() => setGradingReport(report)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Students Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'students' && (
        <div className="glass-card overflow-x-auto animate-fade-in">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roll No</th>
                <th>Division</th>
                <th>Trials</th>
                <th>Reports</th>
                <th>Quiz</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {(students || []).map((student: any) => (
                <tr key={student.id}>
                  <td className="font-medium text-text-primary">{student.name}</td>
                  <td className="text-text-secondary text-sm">{student.email}</td>
                  <td className="font-mono text-xs">{student.rollNo || '—'}</td>
                  <td>{student.division || '—'}</td>
                  <td className="text-center">{student._count?.trials || 0}</td>
                  <td className="text-center">{student._count?.reports || 0}</td>
                  <td className="text-center">{student._count?.quizAttempts || 0}</td>
                  <td className="text-text-muted text-xs">
                    {new Date(student.createdAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!students || students.length === 0) && (
            <p className="text-center py-12 text-text-muted">No students registered yet.</p>
          )}
        </div>
      )}

      {/* ── Reports Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex gap-2 flex-wrap">
            {(['', 'SUBMITTED', 'GRADED', 'DRAFT'] as const).map((f) => (
              <button
                key={f}
                className={`btn btn-sm ${reportFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setReportFilter(f as any)}
              >
                {f || 'All'}
              </button>
            ))}
          </div>

          {reportsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {(reports || []).map((report: any) => (
                <ReportRow key={report.id} report={report} onGrade={() => setGradingReport(report)} />
              ))}
            </div>
          )}

          {reports?.length === 0 && (
            <div className="glass-card p-12 text-center">
              <p className="text-text-muted">No reports match this filter.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Analytics Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6 animate-fade-in">
          {/* Error distribution chart */}
          {analytics.errorDistribution && (
            <div className="glass-card p-6">
              <h2 className="font-heading text-xl mb-4 text-text-primary">% Error Distribution</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={Object.entries(analytics.errorDistribution).map(([bucket, count]) => ({ bucket, count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="bucket" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                    formatter={(v: number) => [v, 'Students']}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Grading Modal */}
      {gradingReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-md w-full animate-slide-up">
            <h2 className="font-heading text-xl mb-1">Grade Report</h2>
            <p className="text-text-muted text-sm mb-4">
              Student: {gradingReport.user?.name} — e = {gradingReport.meanE?.toFixed(4)}
            </p>

            <div className="mb-4">
              <label className="text-sm text-text-secondary mb-1 block">Marks (out of 100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                className="input"
                placeholder="e.g. 85"
              />
            </div>

            <div className="mb-5">
              <label className="text-sm text-text-secondary mb-1 block">Remarks (optional)</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="input min-h-[80px] resize-none"
                placeholder="Good work! The e value is close to the reference..."
              />
            </div>

            <div className="flex gap-3">
              <button
                className="btn btn-primary flex-1"
                disabled={!marks || gradeMutation.isPending}
                onClick={() => gradeMutation.mutate({ id: gradingReport.id, marks: Number(marks), remarks })}
              >
                {gradeMutation.isPending ? '⏳ Grading…' : '✓ Submit Grade'}
              </button>
              <button className="btn btn-ghost" onClick={() => setGradingReport(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportRow({ report, onGrade }: { report: any; onGrade: () => void }) {
  const statusColor = report.status === 'GRADED' ? 'badge-success' : report.status === 'SUBMITTED' ? 'badge-warning' : 'badge-neutral';

  return (
    <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-text-primary">{report.user?.name}</span>
          <span className={`badge ${statusColor}`}>{report.status}</span>
          {report.marks !== null && (
            <span className="badge badge-success">{report.marks}/100</span>
          )}
        </div>
        <div className="text-text-muted text-xs flex gap-3">
          <span>{report.user?.rollNo || 'No Roll No'}</span>
          <span>Mean e = {report.meanE?.toFixed(4)}</span>
          <span>Error: {report.percentError?.toFixed(2)}%</span>
          {report.submittedAt && <span>Submitted: {new Date(report.submittedAt).toLocaleDateString('en-IN')}</span>}
        </div>
      </div>
      {report.status === 'SUBMITTED' && (
        <button className="btn btn-primary btn-sm flex-shrink-0" onClick={onGrade}>
          ✏️ Grade
        </button>
      )}
    </div>
  );
}
