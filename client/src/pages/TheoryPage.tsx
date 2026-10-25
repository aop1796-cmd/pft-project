/**
 * Theory Page – aim, apparatus, theory with KaTeX formulas
 * Covers: coefficient of restitution, impact types, factors affecting e
 */

import { useEffect } from 'react';
import katex from 'katex';

// Render a KaTeX formula into an element by ID
function KFormula({ id, formula, displayMode = true }: { id: string; formula: string; displayMode?: boolean }) {
  useEffect(() => {
    const el = document.getElementById(id);
    if (el) {
      katex.render(formula, el, {
        throwOnError: false,
        displayMode,
      });
    }
  }, [id, formula, displayMode]);

  return <div id={id} className={displayMode ? 'katex-display' : 'inline-block'} />;
}

export default function TheoryPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 page-enter">
      {/* Header */}
      <div className="mb-8">
        <span className="badge badge-warning mb-3">Theory</span>
        <h1 className="font-heading text-4xl sm:text-5xl gradient-text mb-2">
          Collision of Elastic Bodies
        </h1>
        <p className="text-text-secondary text-lg">
          Experiment 5 · Engineering Mechanics · Semester I
        </p>
      </div>

      {/* Aim */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-heading text-2xl mb-3 text-text-primary">🎯 Aim</h2>
        <p className="text-text-secondary leading-relaxed">
          To study the <strong className="text-text-primary">direct central impact</strong> between two spherical bodies,
          and to determine the <strong className="text-text-primary">coefficient of restitution (e)</strong> experimentally
          using the projectile motion method.
        </p>
      </div>

      {/* Theory Section */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-heading text-2xl mb-4 text-text-primary">📚 Theory</h2>

        <h3 className="font-heading text-xl mb-2 text-primary">1. Impact</h3>
        <p className="text-text-secondary leading-relaxed mb-4">
          When two bodies collide, the duration of contact is very small and large impulsive forces are developed
          during the collision. This phenomenon is called <strong className="text-text-primary">impact</strong>.
          The common normal to the surfaces in contact at the point of impact is called the
          <strong className="text-text-primary"> line of impact</strong>.
        </p>

        <h3 className="font-heading text-xl mb-2 text-primary">2. Types of Impact</h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          {[
            { title: 'Direct Central Impact', desc: 'The velocities of colliding bodies are directed along the line of impact (line joining the centres). This is what we study in this experiment.' },
            { title: 'Oblique Impact', desc: 'The velocity of at least one of the colliding bodies is not directed along the line of impact. The component along the line of impact follows Newton\'s Law of Restitution.' },
          ].map((item, i) => (
            <div key={i} className="surface-card p-4">
              <p className="font-semibold text-text-primary text-sm mb-1">▸ {item.title}</p>
              <p className="text-text-muted text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="font-heading text-xl mb-2 text-primary">3. Newton's Law of Restitution</h3>
        <p className="text-text-secondary leading-relaxed mb-2">
          The coefficient of restitution <em>e</em> is defined as the ratio of the relative velocity of separation
          to the relative velocity of approach of the two colliding bodies:
        </p>

        <KFormula
          id="formula-e-def"
          formula="e = -\\frac{V_A - V_B}{U_A - U_B} = \\frac{\\text{Relative velocity of separation}}{\\text{Relative velocity of approach}}"
        />

        <p className="text-text-secondary leading-relaxed mt-3 mb-4">
          Where <code className="font-mono text-primary">U_A, U_B</code> are velocities before impact and{' '}
          <code className="font-mono text-primary">V_A, V_B</code> are velocities after impact.
          Since Ball B is initially at rest (<code className="font-mono text-primary">U_B = 0</code>):
        </p>

        <KFormula
          id="formula-e-simplified"
          formula="e = \\frac{V_B - V_A}{U_A}"
        />

        <h3 className="font-heading text-xl mb-3 mt-6 text-primary">4. Range of e and Collision Types</h3>

        <div className="overflow-x-auto mb-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type of Collision</th>
                <th>Value of e</th>
                <th>Energy</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: 'Perfectly Elastic', e: 'e = 1', energy: 'Fully conserved', example: 'Ideal billiard balls' },
                { type: 'Real (Partial)', e: '0 < e < 1', energy: 'Partially lost', example: 'Steel, Glass, Rubber' },
                { type: 'Perfectly Plastic', e: 'e = 0', energy: 'Max loss', example: 'Clay balls (stick together)' },
              ].map((row, i) => (
                <tr key={i}>
                  <td className="text-text-primary">{row.type}</td>
                  <td><span className="font-mono text-primary">{row.e}</span></td>
                  <td className="text-text-secondary">{row.energy}</td>
                  <td className="text-text-muted">{row.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="font-heading text-xl mb-2 text-primary">5. Derivation of Velocities After Impact</h3>
        <p className="text-text-secondary mb-2">
          Applying conservation of momentum and Newton's Law of Restitution simultaneously:
        </p>

        <KFormula
          id="formula-VA"
          formula="V_A = \\frac{(m_A - e \\cdot m_B) \\cdot U_A}{m_A + m_B}"
        />

        <KFormula
          id="formula-VB"
          formula="V_B = \\frac{m_A \\cdot (1 + e) \\cdot U_A}{m_A + m_B}"
        />

        <h3 className="font-heading text-xl mb-2 mt-6 text-primary">6. Experimental Method (Projectile Technique)</h3>
        <p className="text-text-secondary leading-relaxed mb-3">
          Ball A is released from height <em>h</em> on a curved ramp, acquiring velocity U_A at the bottom.
          After impact, both balls become horizontal projectiles from height <em>y</em>.
          Their landing distances X_A and X_B are measured.
        </p>

        <KFormula
          id="formula-UA"
          formula="U_A = \\sqrt{2gh}, \\quad U_B = 0"
        />

        <KFormula
          id="formula-t"
          formula="t = \\sqrt{\\frac{2y}{g}} \\quad \\text{(time of flight, same for both balls)}"
        />

        <KFormula
          id="formula-VA-exp"
          formula="V_A = \\frac{X_A}{t}, \\quad V_B = \\frac{X_B}{t}"
        />

        <p className="text-text-secondary mt-3">
          Therefore, the coefficient of restitution from experimental measurements:
        </p>

        <KFormula
          id="formula-e-full"
          formula="\\boxed{e = -\\frac{V_A - V_B}{U_A - U_B} = \\frac{V_B - V_A}{U_A}}"
        />

        <h3 className="font-heading text-xl mb-2 mt-6 text-primary">7. Factors Affecting e</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { factor: 'Material', effect: 'Steel (≈0.90), Glass (≈0.95), Rubber (≈0.75), Wood (≈0.50), Clay (≈0.05)' },
            { factor: 'Impact Velocity', effect: 'e decreases slightly with higher impact velocity due to plastic deformation' },
            { factor: 'Shape & Size', effect: 'Spheres give consistent results; irregular shapes cause oblique effects' },
            { factor: 'Surface Finish', effect: 'Rough surfaces increase energy loss; polished surfaces give higher e' },
            { factor: 'Temperature', effect: 'Higher temperature may soften materials, reducing e slightly' },
            { factor: 'Deformation', effect: 'Permanent deformation (denting) greatly reduces e for soft materials' },
          ].map((item, i) => (
            <div key={i} className="surface-card p-3">
              <p className="font-semibold text-primary text-sm mb-1">▸ {item.factor}</p>
              <p className="text-text-muted text-xs leading-relaxed">{item.effect}</p>
            </div>
          ))}
        </div>

        {/* Conservation of Momentum note */}
        <div className="mt-6 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
          <h4 className="font-semibold text-blue-400 mb-2">📌 Important: Conservation of Linear Momentum</h4>
          <p className="text-text-secondary text-sm leading-relaxed">
            Linear momentum is always conserved in all types of collisions (elastic, plastic, and real),
            irrespective of the value of e. The total momentum before impact equals the total momentum after impact:
          </p>
          <KFormula
            id="formula-momentum"
            formula="m_A U_A + m_B U_B = m_A V_A + m_B V_B"
          />
        </div>
      </div>

      {/* Quick Reference */}
      <div className="glass-card p-6 mb-8">
        <h2 className="font-heading text-2xl mb-4 text-text-primary">🔖 Quick Reference (All Formulas)</h2>
        <div className="grid gap-3">
          {[
            { label: 'U_A (velocity before, from ramp)', formula: 'U_A = \\sqrt{2gh}' },
            { label: 'U_B (Ball B initially at rest)', formula: 'U_B = 0' },
            { label: 't (time of flight as projectile)', formula: 't = \\sqrt{2y/g}' },
            { label: 'V_A (from projectile distance)', formula: 'V_A = X_A / t' },
            { label: 'V_B (from projectile distance)', formula: 'V_B = X_B / t' },
            { label: 'e (coefficient of restitution)', formula: 'e = -(V_A - V_B)/(U_A - U_B)' },
          ].map((item, i) => {
            const elId = `qr-formula-${i}`;
            return (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 surface-card rounded-lg">
                <span className="text-text-muted text-sm min-w-[260px]">{item.label}:</span>
                <QRFormula id={elId} formula={item.formula} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QRFormula({ id, formula }: { id: string; formula: string }) {
  useEffect(() => {
    const el = document.getElementById(id);
    if (el) {
      katex.render(formula, el, { throwOnError: false, displayMode: false });
    }
  }, [id, formula]);

  return <span id={id} className="font-mono text-primary" />;
}
