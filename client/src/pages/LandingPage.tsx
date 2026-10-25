/**
 * Landing Page – aim, apparatus, college info, login CTA
 * 3D hero section with animated elements
 */

import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const features = [
  { icon: '⚡', title: 'Physics Simulator', desc: 'Real-time collision simulation with customizable parameters and noise modes.' },
  { icon: '📊', title: 'Observation Table', desc: 'Auto-filled table matching the lab manual. Min 5 rows, CSV export.' },
  { icon: '📈', title: 'Smart Graphs', desc: 'e vs h, velocity comparisons, and momentum conservation charts.' },
  { icon: '🧠', title: 'Quiz & Viva', desc: '10 MCQs with explanations + 5 viva reveal cards. Scores saved.' },
  { icon: '📝', title: 'Lab Report', desc: 'Auto-generated result, conclusion, error analysis, and PDF export.' },
  { icon: '🎓', title: 'Teacher Portal', desc: 'Review submissions, grade reports, and view class analytics.' },
];

const apparatus = [
  'Curved ramp with adjustable release height (h)',
  'Two steel/glass/rubber balls (A and B)',
  'Vertical platform of height y',
  'Metre scale / ruler',
  'Carbon paper for marking landing positions',
  'Weighing balance for masses mA and mB',
];

export default function LandingPage() {
  const { user } = useAuthStore();

  return (
    <div className="page-enter">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="hero-gradient min-h-[80vh] flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">

        {/* Decorative 3D orbs */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }}
        />
        <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />

        {/* College badge */}
        <div className="mb-6 animate-fade-in">
          <span className="badge badge-warning text-xs px-4 py-1.5">
            🏛️ St. John College of Engineering and Management, Palghar · Semester I
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-heading text-4xl sm:text-6xl lg:text-7xl mb-4 animate-slide-up"
          style={{ animationDelay: '0.1s' }}
        >
          <span className="gradient-text">Virtual</span>{' '}
          <span className="text-text-primary">Mechanics Lab</span>
        </h1>

        <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <p className="font-heading text-xl sm:text-3xl text-text-secondary mb-2">
            Experiment 5
          </p>
          <p className="font-heading text-2xl sm:text-4xl gradient-text mb-6">
            Collision of Elastic Bodies
          </p>
        </div>

        <p
          className="text-text-secondary max-w-xl mb-8 text-base sm:text-lg animate-slide-up leading-relaxed"
          style={{ animationDelay: '0.2s' }}
        >
          Determine the <strong className="text-text-primary">Coefficient of Restitution (e)</strong> through
          an interactive physics simulator. Record observations, analyse graphs, and submit your lab report — all in one place.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-3 justify-center animate-slide-up" style={{ animationDelay: '0.25s' }}>
          <Link to="/simulator" className="btn btn-primary btn-lg">
            🔬 Launch Simulator
          </Link>
          <Link to="/theory" className="btn btn-secondary btn-lg">
            📖 Read Theory
          </Link>
          {!user && (
            <Link to="/register" className="btn btn-ghost btn-lg">
              Create Account →
            </Link>
          )}
        </div>

        {/* Animated collision diagram */}
        <div className="mt-12 animate-float" aria-hidden="true">
          <CollisionDiagramSVG />
        </div>
      </section>

      {/* ── Aim ──────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="glass-card p-8">
          <h2 className="font-heading text-3xl mb-4 gradient-text">🎯 Aim</h2>
          <p className="text-text-secondary text-lg leading-relaxed">
            To study the collision between two spheres undergoing{' '}
            <strong className="text-text-primary">direct central impact</strong>, and to determine the{' '}
            <strong className="text-text-primary">coefficient of restitution (e)</strong> experimentally
            using the projectile motion method.
          </p>
        </div>
      </section>

      {/* ── Apparatus ────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <div className="glass-card p-8">
          <h2 className="font-heading text-3xl mb-6 gradient-text">🔧 Apparatus Required</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {apparatus.map((item, i) => (
              <li key={i} className="flex items-start gap-3 p-3 rounded-lg surface-card">
                <span className="text-primary mt-0.5">▸</span>
                <span className="text-text-secondary text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="font-heading text-3xl text-center mb-8 text-text-primary">
          Everything You Need
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div key={i} className="glass-card card-3d p-6">
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="font-heading text-xl mb-2 text-text-primary">{f.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      {!user && (
        <section className="max-w-4xl mx-auto px-4 pb-16">
          <div className="glass-card p-8 text-center glow-primary">
            <h2 className="font-heading text-3xl mb-3">Ready to Start?</h2>
            <p className="text-text-secondary mb-6">
              Register to save your observations and submit lab reports.
              The simulator works without an account in guest mode.
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/register" className="btn btn-primary btn-lg">Register Free</Link>
              <Link to="/login" className="btn btn-secondary btn-lg">Sign In</Link>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-text-muted text-sm">
        <p>© 2024 St. John College of Engineering and Management, Palghar · Semester I · Engineering Mechanics</p>
      </footer>
    </div>
  );
}

/** Simple SVG illustration of the collision experiment */
function CollisionDiagramSVG() {
  return (
    <svg width="320" height="100" viewBox="0 0 320 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ramp */}
      <path d="M20 80 L100 20 L160 20" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
      {/* Ball A on ramp */}
      <circle cx="70" cy="42" r="10" fill="#6B7280" stroke="#9CA3AF" strokeWidth="1"/>
      <text x="66" y="46" fill="white" fontSize="9" fontFamily="JetBrains Mono">A</text>
      {/* Ball B at table edge */}
      <circle cx="160" cy="20" r="10" fill="#6B7280" stroke="#9CA3AF" strokeWidth="1"/>
      <text x="156" y="24" fill="white" fontSize="9" fontFamily="JetBrains Mono">B</text>
      {/* Table */}
      <rect x="150" y="28" width="100" height="4" fill="#374151" rx="2"/>
      {/* Ground */}
      <line x1="20" y1="90" x2="300" y2="90" stroke="#374151" strokeWidth="2" strokeDasharray="4,4"/>
      {/* y dimension */}
      <line x1="260" y1="32" x2="260" y2="90" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2,2"/>
      <text x="264" y="65" fill="#3b82f6" fontSize="10" fontFamily="JetBrains Mono">y</text>
      {/* XA arrow */}
      <text x="100" y="105" fill="#f59e0b" fontSize="9" fontFamily="JetBrains Mono">XA</text>
      {/* XB arrow */}
      <text x="195" y="105" fill="#22c55e" fontSize="9" fontFamily="JetBrains Mono">XB</text>
      {/* Impact point */}
      <circle cx="160" cy="20" r="3" fill="#ef4444"/>
    </svg>
  );
}
