/**
 * Prisma Seed Script
 * Seeds: Materials, Quiz Questions (10 MCQ + 5 Viva), Admin, Teacher, Student, Experiment
 */

import { PrismaClient, Role, QuestionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Experiment ────────────────────────────────────────────────────────────
  const experiment = await prisma.experiment.upsert({
    where: { slug: 'exp-5-collision-elastic' },
    update: {},
    create: {
      title: 'Experiment 5: Collision of Elastic Bodies',
      slug: 'exp-5-collision-elastic',
    },
  });
  console.log('✅ Experiment seeded:', experiment.slug);

  // ── Materials ─────────────────────────────────────────────────────────────
  const materials = [
    { name: 'Steel', referenceE: 0.90, color: '#6B7280', density: 7800, description: 'High-carbon steel bearing balls' },
    { name: 'Glass', referenceE: 0.95, color: '#93C5FD', density: 2500, description: 'Borosilicate glass marbles' },
    { name: 'Wood', referenceE: 0.50, color: '#92400E', density: 700, description: 'Hardwood billiard balls' },
    { name: 'Rubber', referenceE: 0.75, color: '#F59E0B', density: 1200, description: 'Natural rubber bouncing balls' },
    { name: 'Clay', referenceE: 0.05, color: '#D97706', density: 1600, description: 'Plasticine clay balls (near-plastic impact)' },
  ];

  for (const mat of materials) {
    await prisma.material.upsert({
      where: { name: mat.name },
      update: mat,
      create: mat,
    });
  }
  console.log('✅ Materials seeded:', materials.length);

  // ── Users ─────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const teacherHash = await bcrypt.hash('Teacher@123', 12);
  const studentHash = await bcrypt.hash('Student@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@sjcem.edu.in' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@sjcem.edu.in',
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@sjcem.edu.in' },
    update: {},
    create: {
      name: 'Prof. Sharma',
      email: 'teacher@sjcem.edu.in',
      passwordHash: teacherHash,
      role: Role.TEACHER,
      division: 'A',
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@sjcem.edu.in' },
    update: {},
    create: {
      name: 'Rahul Patil',
      email: 'student@sjcem.edu.in',
      passwordHash: studentHash,
      role: Role.STUDENT,
      rollNo: 'SJCEM/2024/001',
      division: 'A',
    },
  });
  console.log('✅ Users seeded: admin, teacher, student');

  // ── Quiz Questions – MCQ ──────────────────────────────────────────────────
  const mcqQuestions = [
    {
      type: QuestionType.MCQ,
      question: 'The coefficient of restitution (e) is defined as the ratio of:',
      options: [
        'Velocity of approach to velocity of separation',
        'Velocity of separation to velocity of approach',
        'Kinetic energy after impact to kinetic energy before impact',
        'Momentum after impact to momentum before impact',
      ],
      answer: 'Velocity of separation to velocity of approach',
      explanation:
        'e = (Relative velocity of separation) / (Relative velocity of approach) = -(V_A - V_B) / (U_A - U_B). A value closer to 1 indicates a more elastic collision.',
      orderIndex: 1,
    },
    {
      type: QuestionType.MCQ,
      question: 'For a perfectly elastic collision, the coefficient of restitution e equals:',
      options: ['0', '0.5', '1', 'Infinity'],
      answer: '1',
      explanation:
        'In a perfectly elastic collision, kinetic energy is fully conserved and e = 1. No energy is lost to deformation or heat.',
      orderIndex: 2,
    },
    {
      type: QuestionType.MCQ,
      question: 'For a perfectly plastic (inelastic) collision, the value of e is:',
      options: ['1', '0.5', '0', '> 1'],
      answer: '0',
      explanation:
        'In a perfectly plastic collision, the bodies stick together after impact. The relative velocity of separation is zero, so e = 0.',
      orderIndex: 3,
    },
    {
      type: QuestionType.MCQ,
      question:
        'In the laboratory experiment, the velocity U_A of ball A before impact is calculated using:',
      options: [
        'U_A = √(2gh)',
        'U_A = X_A / t',
        'U_A = g × t',
        'U_A = m_A × g × h',
      ],
      answer: 'U_A = √(2gh)',
      explanation:
        'Using energy conservation on the curved ramp: (1/2)m_A U_A² = m_A g h, giving U_A = √(2gh), where h is the height of release.',
      orderIndex: 4,
    },
    {
      type: QuestionType.MCQ,
      question: 'The time of flight t for both balls after leaving the table is given by:',
      options: [
        't = √(2y/g)',
        't = y/g',
        't = √(y/2g)',
        't = 2y/g',
      ],
      answer: 't = √(2y/g)',
      explanation:
        'Both balls become projectiles launched horizontally from height y. Using y = (1/2)g t², we get t = √(2y/g).',
      orderIndex: 5,
    },
    {
      type: QuestionType.MCQ,
      question: 'During direct central impact, the line of impact is:',
      options: [
        'Perpendicular to the line joining centres',
        'Along the line joining the centres of the two balls',
        'At 45° to the direction of motion',
        'Horizontal always',
      ],
      answer: 'Along the line joining the centres of the two balls',
      explanation:
        'In direct central impact, the velocity of the impacting body is along the line joining the centres, which is called the line of impact.',
      orderIndex: 6,
    },
    {
      type: QuestionType.MCQ,
      question: 'Which law is conserved during all types of impact (elastic, plastic, and real)?',
      options: [
        'Conservation of kinetic energy',
        'Conservation of linear momentum',
        'Conservation of potential energy',
        'Conservation of angular momentum',
      ],
      answer: 'Conservation of linear momentum',
      explanation:
        'Linear momentum is always conserved in collisions (m_A U_A + m_B U_B = m_A V_A + m_B V_B), regardless of the type of impact. Kinetic energy is only conserved in perfectly elastic collisions.',
      orderIndex: 7,
    },
    {
      type: QuestionType.MCQ,
      question: 'If m_A = m_B = m and e = 1 (perfectly elastic), after impact:',
      options: [
        'Both balls move with the same velocity',
        'Ball A stops and ball B moves with U_A',
        'Both balls bounce back',
        'Ball A continues and B remains stationary',
      ],
      answer: 'Ball A stops and ball B moves with U_A',
      explanation:
        'For equal masses with e = 1, the velocities are exchanged: V_A = [(m-m)/(m+m)]U_A = 0, V_B = [2m/(m+m)]U_A = U_A.',
      orderIndex: 8,
    },
    {
      type: QuestionType.MCQ,
      question: 'The value of e depends on which of the following?',
      options: [
        'Mass of the balls only',
        'Speed of impact only',
        'Material, surface finish, and impact speed',
        'Gravity and height only',
      ],
      answer: 'Material, surface finish, and impact speed',
      explanation:
        'e is primarily a material property but is also influenced by the impact velocity, surface condition, temperature, and shape of the colliding bodies.',
      orderIndex: 9,
    },
    {
      type: QuestionType.MCQ,
      question: 'In this experiment, the velocity V_B of ball B after impact is measured as:',
      options: [
        'V_B = X_B / t',
        'V_B = √(2g × X_B)',
        'V_B = m_A × U_A / m_B',
        'V_B = g × t',
      ],
      answer: 'V_B = X_B / t',
      explanation:
        'After impact, ball B becomes a horizontal projectile. Since initial vertical velocity is zero, horizontal distance X_B = V_B × t, so V_B = X_B / t.',
      orderIndex: 10,
    },
  ];

  // ── Quiz Questions – Viva ─────────────────────────────────────────────────
  const vivaQuestions = [
    {
      type: QuestionType.VIVA,
      question: 'What is the physical significance of the coefficient of restitution?',
      options: null,
      answer:
        'The coefficient of restitution (e) quantifies the elasticity of a collision. It is the ratio of the relative velocity of separation to the relative velocity of approach after impact. A value of e = 1 indicates a perfectly elastic collision (no energy loss), e = 0 indicates a perfectly plastic collision (maximum energy loss; bodies stick together), and 0 < e < 1 represents real collisions where some energy is lost to heat, sound, and deformation.',
      explanation: null,
      orderIndex: 11,
    },
    {
      type: QuestionType.VIVA,
      question: 'Why is the initial velocity of ball B (U_B) taken as zero in this experiment?',
      options: null,
      answer:
        'Ball B is placed at rest at the bottom of the curved ramp (Position 2) before ball A is released. Since it is stationary, its velocity before impact is zero (U_B = 0). This simplifies the calculation: e = -(V_A - V_B) / (U_A - 0) = (V_B - V_A) / U_A.',
      explanation: null,
      orderIndex: 12,
    },
    {
      type: QuestionType.VIVA,
      question: 'What are the assumptions made in this experiment?',
      options: null,
      answer:
        '1. The ramp is frictionless (energy conservation holds from h to impact point). 2. Both balls are rigid and perfectly spherical. 3. The impact is direct and central (velocity along the line of centres). 4. Air resistance is neglected. 5. The table edge from which balls become projectiles is sharp and well-defined. 6. Horizontal velocity of each ball at the edge equals its post-impact velocity (no energy loss at the edge).',
      explanation: null,
      orderIndex: 13,
    },
    {
      type: QuestionType.VIVA,
      question: 'How does changing the height h affect the coefficient of restitution?',
      options: null,
      answer:
        'Theoretically, for an ideal elastic material, e is constant regardless of h. However, in practice, e decreases slightly with increasing impact velocity (higher h) because at higher speeds the contact forces exceed the elastic limit, causing some plastic deformation and greater energy dissipation. Steel shows the smallest variation, while rubber and softer materials show a more pronounced decrease.',
      explanation: null,
      orderIndex: 14,
    },
    {
      type: QuestionType.VIVA,
      question: 'List the possible sources of error in this experiment and suggest precautions.',
      options: null,
      answer:
        'Sources of error: (1) Friction on the ramp — use a smooth, lubricated track. (2) Measurement of X_A and X_B — use a steel ruler aligned with the point of impact. (3) Ball B not exactly at rest — ensure B is gently placed. (4) Imperfect alignment — ensure the ramp is level. (5) Air currents affecting the projectile path — conduct in a closed room.\n\nPrecautions: (1) Conduct at least 5 trials and take the mean. (2) Mark the landing positions carefully with carbon paper. (3) Zero the scale at the base of the table. (4) Ensure direct central impact by aligning balls carefully. (5) Use digital calipers for measuring distances.',
      explanation: null,
      orderIndex: 15,
    },
  ];

  const allQuestions = [...mcqQuestions, ...vivaQuestions];
  for (const q of allQuestions) {
    await prisma.quizQuestion.create({ data: q });
  }
  console.log('✅ Quiz questions seeded:', allQuestions.length, '(10 MCQ + 5 Viva)');

  console.log('\n🎉 Seeding complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin:   admin@sjcem.edu.in   / Admin@123');
  console.log('Teacher: teacher@sjcem.edu.in / Teacher@123');
  console.log('Student: student@sjcem.edu.in / Student@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
