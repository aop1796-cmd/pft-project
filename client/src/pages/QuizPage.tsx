/**
 * Quiz Page – 10 MCQs with scoring + 5 Viva Q&A reveal cards
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

interface QuizQuestion {
  id: string;
  type: 'MCQ' | 'VIVA';
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string | null;
}

const DEFAULT_MCQS: QuizQuestion[] = [
  {
    id: 'mcq-1',
    type: 'MCQ',
    question: 'The coefficient of restitution (e) is defined as the ratio of:',
    options: [
      'Velocity of approach to velocity of separation',
      'Velocity of separation to velocity of approach',
      'Kinetic energy after impact to kinetic energy before impact',
      'Momentum after impact to momentum before impact',
    ],
    answer: 'Velocity of separation to velocity of approach',
    explanation: 'e = (Relative velocity of separation) / (Relative velocity of approach) = -(V_A - V_B) / (U_A - U_B).',
  },
  {
    id: 'mcq-2',
    type: 'MCQ',
    question: 'For a perfectly elastic collision, the coefficient of restitution e equals:',
    options: ['0', '0.5', '1', 'Infinity'],
    answer: '1',
    explanation: 'In a perfectly elastic collision, kinetic energy is fully conserved and e = 1.',
  },
  {
    id: 'mcq-3',
    type: 'MCQ',
    question: 'For a perfectly plastic (inelastic) collision, the value of e is:',
    options: ['1', '0.5', '0', '> 1'],
    answer: '0',
    explanation: 'In a perfectly plastic collision, the colliding bodies stick together, so e = 0.',
  },
  {
    id: 'mcq-4',
    type: 'MCQ',
    question: 'In the laboratory experiment, the velocity U_A of ball A before impact is calculated using:',
    options: ['U_A = √(2gh)', 'U_A = X_A / t', 'U_A = g × t', 'U_A = m_A × g × h'],
    answer: 'U_A = √(2gh)',
    explanation: 'Using energy conservation on the curved ramp: (1/2)m_A U_A² = m_A g h, giving U_A = √(2gh).',
  },
  {
    id: 'mcq-5',
    type: 'MCQ',
    question: 'The time of flight t for both balls after leaving the table is given by:',
    options: ['t = √(2y/g)', 't = y/g', 't = √(y/2g)', 't = 2y/g'],
    answer: 't = √(2y/g)',
    explanation: 'Both balls drop vertically from height y with zero vertical initial velocity: y = (1/2)g t², so t = √(2y/g).',
  },
  {
    id: 'mcq-6',
    type: 'MCQ',
    question: 'During direct central impact, the line of impact is:',
    options: [
      'Perpendicular to the line joining centres',
      'Along the line joining the centres of the two balls',
      'At 45° to the direction of motion',
      'Horizontal always',
    ],
    answer: 'Along the line joining the centres of the two balls',
    explanation: 'In direct central impact, initial velocities are collinear along the line connecting the spheres’ centres.',
  },
  {
    id: 'mcq-7',
    type: 'MCQ',
    question: 'Which law is conserved during all types of impact (elastic, plastic, and real)?',
    options: [
      'Conservation of kinetic energy',
      'Conservation of linear momentum',
      'Conservation of potential energy',
      'Conservation of angular momentum',
    ],
    answer: 'Conservation of linear momentum',
    explanation: 'Linear momentum is always conserved because impact forces are internal equal-and-opposite reactions.',
  },
  {
    id: 'mcq-8',
    type: 'MCQ',
    question: 'If m_A = m_B and e = 1 (perfectly elastic), after impact:',
    options: [
      'Both balls move with the same velocity',
      'Ball A stops and ball B moves with U_A',
      'Both balls bounce back',
      'Ball A continues and B remains stationary',
    ],
    answer: 'Ball A stops and ball B moves with U_A',
    explanation: 'For equal masses colliding with e = 1, velocities exchange: V_A = 0, V_B = U_A.',
  },
  {
    id: 'mcq-9',
    type: 'MCQ',
    question: 'The value of e depends on which of the following?',
    options: [
      'Mass of the balls only',
      'Speed of impact only',
      'Material, surface finish, and impact speed',
      'Gravity and height only',
    ],
    answer: 'Material, surface finish, and impact speed',
    explanation: 'e depends fundamentally on material properties, surface conditions, and slightly on impact speed.',
  },
  {
    id: 'mcq-10',
    type: 'MCQ',
    question: 'In this experiment, the velocity V_B of ball B after impact is measured as:',
    options: ['V_B = X_B / t', 'V_B = √(2g × X_B)', 'V_B = m_A × U_A / m_B', 'V_B = g × t'],
    answer: 'V_B = X_B / t',
    explanation: 'Horizontal projectile motion has constant speed: X_B = V_B × t, hence V_B = X_B / t.',
  },
];

const DEFAULT_VIVAS: QuizQuestion[] = [
  {
    id: 'viva-1',
    type: 'VIVA',
    question: 'What is the physical significance of the coefficient of restitution?',
    options: null,
    answer: 'The coefficient of restitution (e) quantifies the elasticity of a collision: e = 1 indicates perfectly elastic impact (no energy loss), e = 0 indicates plastic impact (maximum energy loss; bodies stick together), and 0 < e < 1 represents real engineering materials.',
    explanation: null,
  },
  {
    id: 'viva-2',
    type: 'VIVA',
    question: 'Why is the initial velocity of ball B (U_B) taken as zero in this experiment?',
    options: null,
    answer: 'Ball B is placed at rest at the bottom of the curved ramp before Ball A is released from height h. Therefore U_B = 0, which simplifies e = (V_B - V_A) / U_A.',
    explanation: null,
  },
  {
    id: 'viva-3',
    type: 'VIVA',
    question: 'What are the assumptions made in this experiment?',
    options: null,
    answer: '1. Ramp is frictionless. 2. Balls are rigid, spherical, and homogeneous. 3. Direct central impact along the line of centres. 4. Negligible air drag during horizontal projectile flight.',
    explanation: null,
  },
  {
    id: 'viva-4',
    type: 'VIVA',
    question: 'How does changing the release height h affect the coefficient of restitution?',
    options: null,
    answer: 'Theoretically e is a material constant independent of h. In real experiments, higher h gives higher impact velocities which slightly increases plastic deformation at the contact point, causing e to drop marginally.',
    explanation: null,
  },
  {
    id: 'viva-5',
    type: 'VIVA',
    question: 'List the possible sources of error and precautions.',
    options: null,
    answer: 'Sources of error: track friction, parallax error when reading landing markers, air turbulence. Precautions: use carbon paper for sharp landing dots, ensure the track exit is strictly horizontal, and repeat at least 5 trials to compute the mean e.',
    explanation: null,
  },
];

export default function QuizPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'MCQ' | 'VIVA'>('MCQ');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [openViva, setOpenViva] = useState<string | null>(null);

  const { data: mcqData, isLoading: mcqLoading } = useQuery({
    queryKey: ['quiz', 'MCQ'],
    queryFn: async () => {
      try {
        const res = await api.get('/quiz/questions?type=MCQ');
        return res.data.data?.length ? (res.data.data as QuizQuestion[]) : DEFAULT_MCQS;
      } catch {
        return DEFAULT_MCQS;
      }
    },
    initialData: DEFAULT_MCQS,
  });

  const { data: vivaData, isLoading: vivaLoading } = useQuery({
    queryKey: ['quiz', 'VIVA'],
    queryFn: async () => {
      try {
        const res = await api.get('/quiz/questions?type=VIVA');
        return res.data.data?.length ? (res.data.data as QuizQuestion[]) : DEFAULT_VIVAS;
      } catch {
        return DEFAULT_VIVAS;
      }
    },
    initialData: DEFAULT_VIVAS,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Login required to save score');
      const res = await api.post('/quiz/attempts', { answers });
      return res.data.data;
    },
    onSuccess: (data) => {
      setScore(data.score);
      setSubmitted(true);
      toast.success(`Quiz submitted! Score: ${data.score}/${data.total} (${data.percentage}%)`);
    },
    onError: () => {
      // Even without auth, show local score
      if (!user) {
        const mcqs = mcqData || [];
        let localScore = 0;
        for (const q of mcqs) {
          if (answers[q.id] === q.answer) localScore++;
        }
        setScore(localScore);
        setSubmitted(true);
        toast('Score computed locally (not saved — please log in)', { icon: 'ℹ️' });
      } else {
        toast.error('Failed to submit quiz');
      }
    },
  });

  const handleSubmit = () => {
    const mcqs = mcqData || [];
    const unanswered = mcqs.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      toast.error(`Please answer all ${unanswered.length} remaining question(s)`);
      return;
    }
    submitMutation.mutate();
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
  };

  const mcqs = mcqData || [];
  const vivas = vivaData || [];
  const total = mcqs.length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 page-enter">
      <div className="mb-6">
        <span className="badge badge-warning mb-2">Quiz & Viva</span>
        <h1 className="font-heading text-3xl sm:text-4xl gradient-text">
          Knowledge Assessment
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Experiment 5: Coefficient of Restitution
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['MCQ', 'VIVA'] as const).map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab)}
            aria-selected={activeTab === tab}
            role="tab"
          >
            {tab === 'MCQ' ? '📝 MCQ (10 Questions)' : '🎙️ Viva Questions (5)'}
          </button>
        ))}
      </div>

      {/* Score Banner */}
      {submitted && score !== null && activeTab === 'MCQ' && (
        <div className="glass-card p-6 mb-6 text-center border border-amber-500/30 animate-fade-in">
          <div className="text-5xl mb-2">
            {score === total ? '🏆' : score >= total * 0.7 ? '🎉' : '📚'}
          </div>
          <h2 className="font-heading text-3xl gradient-text mb-1">
            {score}/{total}
          </h2>
          <p className="text-text-secondary mb-2">
            {Math.round((score / total) * 100)}% — {
              score === total ? 'Perfect score!' :
              score >= total * 0.8 ? 'Excellent!' :
              score >= total * 0.6 ? 'Good work!' : 'Keep studying!'
            }
          </p>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>Try Again</button>
        </div>
      )}

      {/* MCQ Tab */}
      {activeTab === 'MCQ' && (
        <div className="space-y-6">
          {mcqLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card p-6">
                <div className="shimmer h-5 w-3/4 mb-4 rounded" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="shimmer h-10 rounded" />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <>
              {mcqs.map((q, i) => (
                <MCQCard
                  key={q.id}
                  question={q}
                  index={i}
                  selectedAnswer={answers[q.id]}
                  onSelect={(ans) => !submitted && setAnswers((prev) => ({ ...prev, [q.id]: ans }))}
                  submitted={submitted}
                />
              ))}

              {!submitted && (
                <div className="flex items-center justify-between glass-card p-4">
                  <span className="text-sm text-text-secondary">
                    Answered: {Object.keys(answers).length}/{total}
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending}
                    id="btn-submit-quiz"
                  >
                    {submitMutation.isPending ? '⏳ Submitting…' : '✓ Submit Quiz'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Viva Tab */}
      {activeTab === 'VIVA' && (
        <div className="space-y-4">
          {vivaLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="shimmer h-20 rounded-xl" />
            ))
          ) : (
            vivas.map((q, i) => (
              <VivaCard
                key={q.id}
                question={q}
                index={i}
                isOpen={openViva === q.id}
                onToggle={() => setOpenViva(openViva === q.id ? null : q.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MCQCard({
  question, index, selectedAnswer, onSelect, submitted,
}: {
  question: QuizQuestion;
  index: number;
  selectedAnswer?: string;
  onSelect: (ans: string) => void;
  submitted: boolean;
}) {
  const isCorrect = selectedAnswer === question.answer;

  return (
    <div className="glass-card p-6 animate-fade-in" role="group" aria-labelledby={`q-${question.id}`}>
      <div className="flex items-start gap-3 mb-4">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center font-mono text-sm text-text-secondary">
          {index + 1}
        </span>
        <h3 id={`q-${question.id}`} className="text-text-primary font-medium leading-relaxed">
          {question.question}
        </h3>
      </div>

      <div className="space-y-2 ml-11" role="radiogroup">
        {(question.options || []).map((option, j) => {
          let optClass = 'quiz-option';
          if (submitted) {
            if (option === question.answer) optClass += ' correct';
            else if (option === selectedAnswer) optClass += ' incorrect';
          } else if (option === selectedAnswer) {
            optClass += ' selected';
          }

          return (
            <div
              key={j}
              className={optClass}
              onClick={() => onSelect(option)}
              role="radio"
              aria-checked={option === selectedAnswer}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(option)}
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs mt-0.5">
                {submitted && option === question.answer ? '✓' :
                 submitted && option === selectedAnswer && !isCorrect ? '✗' :
                 option === selectedAnswer ? '●' : ''}
              </span>
              <span className="text-sm">{option}</span>
            </div>
          );
        })}
      </div>

      {submitted && question.explanation && (
        <div className="mt-4 ml-11 p-3 rounded-lg bg-surface-2 border border-border animate-fade-in">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-1">Explanation</p>
          <p className="text-sm text-text-secondary leading-relaxed">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}

function VivaCard({
  question, index, isOpen, onToggle,
}: {
  question: QuizQuestion;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="glass-card viva-card overflow-hidden">
      <button
        className="w-full p-5 flex items-start gap-3 text-left hover:bg-surface-2 transition-colors"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`viva-answer-${question.id}`}
        id={`viva-q-${question.id}`}
      >
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-heading text-sm text-primary">
          {index + 1}
        </span>
        <div className="flex-1">
          <h3 className="text-text-primary font-medium leading-relaxed text-sm">{question.question}</h3>
          <p className="text-text-muted text-xs mt-1">
            {isOpen ? 'Click to hide answer' : '👆 Click to reveal answer'}
          </p>
        </div>
        <span className="text-text-muted transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
          ▼
        </span>
      </button>

      <div
        id={`viva-answer-${question.id}`}
        className="viva-answer"
        style={{ maxHeight: isOpen ? '600px' : '0' }}
        aria-labelledby={`viva-q-${question.id}`}
      >
        <div className="px-5 pb-5 ml-11 border-t border-border pt-4">
          <p className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-2">Model Answer</p>
          <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
            {question.answer}
          </p>
        </div>
      </div>
    </div>
  );
}
