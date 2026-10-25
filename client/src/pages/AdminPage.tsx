/**
 * Admin Dashboard Page
 * System administration: User accounts, Simulation materials, and Question banks
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import toast from 'react-hot-toast';

type AdminTab = 'users' | 'materials' | 'questions';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const queryClient = useQueryClient();

  // ─────────────────────────────────────────────────────────────
  // USERS
  // ─────────────────────────────────────────────────────────────
  const [userSearch, setUserSearch] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: 'Password123!',
    role: 'STUDENT',
    rollNo: '',
    division: '',
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data.data;
    },
    enabled: activeTab === 'users',
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const res = await api.post('/admin/users', userData);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User created successfully');
      setShowAddUserModal(false);
      setNewUser({ name: '', email: '', password: 'Password123!', role: 'STUDENT', rollNo: '', division: '' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create user');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User removed');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    },
  });

  // ─────────────────────────────────────────────────────────────
  // MATERIALS
  // ─────────────────────────────────────────────────────────────
  const [showAddMatModal, setShowAddMatModal] = useState(false);
  const [newMat, setNewMat] = useState({
    name: '',
    referenceE: 0.7,
    color: '#3b82f6',
    density: 7850,
    description: '',
  });

  const { data: materials, isLoading: matsLoading } = useQuery({
    queryKey: ['admin', 'materials'],
    queryFn: async () => {
      const res = await api.get('/admin/materials');
      return res.data.data;
    },
    enabled: activeTab === 'materials',
  });

  const createMatMutation = useMutation({
    mutationFn: async (matData: typeof newMat) => {
      const res = await api.post('/admin/materials', matData);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'materials'] });
      toast.success('Material added');
      setShowAddMatModal(false);
      setNewMat({ name: '', referenceE: 0.7, color: '#3b82f6', density: 7850, description: '' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create material');
    },
  });

  const deleteMatMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/materials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'materials'] });
      toast.success('Material deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete material');
    },
  });

  // ─────────────────────────────────────────────────────────────
  // QUESTIONS
  // ─────────────────────────────────────────────────────────────
  const [showAddQModal, setShowAddQModal] = useState(false);
  const [newQ, setNewQ] = useState({
    type: 'MCQ' as 'MCQ' | 'VIVA',
    question: '',
    options: ['', '', '', ''],
    answer: '',
    explanation: '',
    orderIndex: 1,
  });

  const { data: questions, isLoading: qLoading } = useQuery({
    queryKey: ['admin', 'questions'],
    queryFn: async () => {
      const res = await api.get('/admin/questions');
      return res.data.data;
    },
    enabled: activeTab === 'questions',
  });

  const createQMutation = useMutation({
    mutationFn: async (qData: typeof newQ) => {
      const payload: any = {
        type: qData.type,
        question: qData.question,
        answer: qData.answer,
        explanation: qData.explanation,
        orderIndex: Number(qData.orderIndex),
      };
      if (qData.type === 'MCQ') {
        payload.options = qData.options.filter((o) => o.trim() !== '');
      }
      const res = await api.post('/admin/questions', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] });
      toast.success('Question added');
      setShowAddQModal(false);
      setNewQ({ type: 'MCQ', question: '', options: ['', '', '', ''], answer: '', explanation: '', orderIndex: 1 });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create question');
    },
  });

  const deleteQMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] });
      toast.success('Question removed');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete question');
    },
  });

  const filteredUsers = (users || []).filter((u: any) => {
    const q = userSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.rollNo && u.rollNo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Admin Portal
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-1 font-heading tracking-tight">
            System Administration
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage users, configurable simulation coefficients, and experiment evaluation questions.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'users'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            👥 Users ({users?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'materials'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            🧱 Materials ({materials?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'questions'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            ❓ Questions ({questions?.length || 0})
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: USERS
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by name, email, roll number..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <span>+ Add User</span>
            </button>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl overflow-hidden backdrop-blur">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-950/80 text-neutral-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Roll / Division</th>
                    <th className="px-6 py-4">Joined</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                        No users found matching "{userSearch}"
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u: any) => (
                      <tr key={u.id} className="hover:bg-neutral-800/30 transition">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{u.name}</div>
                          <div className="text-xs text-neutral-400">{u.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              u.role === 'ADMIN'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                : u.role === 'TEACHER'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                : 'bg-green-500/10 text-green-400 border border-green-500/30'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-neutral-300">
                          {u.rollNo || u.division ? (
                            <span>
                              {u.rollNo || '–'} / {u.division || '–'}
                            </span>
                          ) : (
                            <span className="text-neutral-500">–</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-neutral-400 text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete user "${u.name}" (${u.email})?`)) {
                                deleteUserMutation.mutate(u.id);
                              }
                            }}
                            className="text-red-400 hover:text-red-300 text-xs font-semibold transition px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: MATERIALS
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-neutral-400">
              Collision spheres and impact surface materials with standard coefficient of restitution (e) values.
            </p>
            <button
              onClick={() => setShowAddMatModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <span>+ Add Material</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matsLoading ? (
              <div className="col-span-full py-12 text-center text-neutral-500">Loading materials...</div>
            ) : materials?.length === 0 ? (
              <div className="col-span-full py-12 text-center text-neutral-500">No materials defined.</div>
            ) : (
              materials?.map((m: any) => (
                <div
                  key={m.id}
                  className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition space-y-3 relative overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: m.color }}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: m.color }}
                      />
                      <h3 className="font-bold text-white text-base">{m.name}</h3>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete material "${m.name}"?`)) {
                          deleteMatMutation.mutate(m.id);
                        }
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-neutral-800">
                    <div>
                      <span className="text-neutral-500">Ref Restitution (e):</span>
                      <div className="font-mono text-amber-400 font-bold text-sm">{m.referenceE}</div>
                    </div>
                    <div>
                      <span className="text-neutral-500">Density:</span>
                      <div className="font-mono text-neutral-300 font-bold text-sm">
                        {m.density ? `${m.density} kg/m³` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {m.description && (
                    <p className="text-xs text-neutral-400 leading-relaxed">{m.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: QUESTIONS
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-neutral-400">
              Multiple Choice Questions (MCQs) and Oral Viva Questions presented to students.
            </p>
            <button
              onClick={() => setShowAddQModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <span>+ Add Question</span>
            </button>
          </div>

          <div className="space-y-3">
            {qLoading ? (
              <div className="py-12 text-center text-neutral-500">Loading questions...</div>
            ) : questions?.length === 0 ? (
              <div className="py-12 text-center text-neutral-500">No questions found.</div>
            ) : (
              questions?.map((q: any, idx: number) => (
                <div
                  key={q.id}
                  className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                        #{q.orderIndex || idx + 1}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          q.type === 'MCQ'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        {q.type}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this question?')) {
                          deleteQMutation.mutate(q.id);
                        }
                      }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>

                  <p className="text-white font-medium text-sm">{q.question}</p>

                  {q.type === 'MCQ' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-neutral-400">
                      {q.options.map((opt: string, i: number) => (
                        <div
                          key={i}
                          className={`p-2 rounded-lg border ${
                            opt === q.answer
                              ? 'bg-green-500/10 border-green-500/40 text-green-300 font-semibold'
                              : 'bg-neutral-950 border-neutral-800/80'
                          }`}
                        >
                          <span className="font-mono mr-1.5">{String.fromCharCode(65 + i)}.</span>
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'VIVA' && (
                    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 text-xs">
                      <span className="text-neutral-500 font-semibold block mb-0.5">Model Answer:</span>
                      <span className="text-neutral-300">{q.answer}</span>
                    </div>
                  )}

                  {q.explanation && (
                    <p className="text-xs text-neutral-400 italic">
                      <strong className="text-neutral-300 not-italic">Explanation:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD USER
          ───────────────────────────────────────────────────────────── */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Create New User</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUserMutation.mutate(newUser);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Password</label>
                <input
                  type="text"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                  >
                    <option value="STUDENT">STUDENT</option>
                    <option value="TEACHER">TEACHER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Roll Number</label>
                  <input
                    type="text"
                    value={newUser.rollNo}
                    onChange={(e) => setNewUser({ ...newUser, rollNo: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD MATERIAL
          ───────────────────────────────────────────────────────────── */}
      {showAddMatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Add Collision Material</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMatMutation.mutate(newMat);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Material Name</label>
                <input
                  type="text"
                  required
                  value={newMat.name}
                  onChange={(e) => setNewMat({ ...newMat, name: e.target.value })}
                  placeholder="e.g. Copper Sphere"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Reference e (0.0 – 1.0)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    required
                    value={newMat.referenceE}
                    onChange={(e) => setNewMat({ ...newMat, referenceE: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Color (Hex)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newMat.color}
                      onChange={(e) => setNewMat({ ...newMat, color: e.target.value })}
                      className="w-10 h-9 p-0.5 rounded bg-neutral-950 border border-neutral-800 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newMat.color}
                      onChange={(e) => setNewMat({ ...newMat, color: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Density (kg/m³)</label>
                <input
                  type="number"
                  value={newMat.density}
                  onChange={(e) => setNewMat({ ...newMat, density: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Description</label>
                <textarea
                  value={newMat.description}
                  onChange={(e) => setNewMat({ ...newMat, description: e.target.value })}
                  placeholder="Physical description..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMatModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMatMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
                >
                  {createMatMutation.isPending ? 'Saving...' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD QUESTION
          ───────────────────────────────────────────────────────────── */}
      {showAddQModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Add Lab Question</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createQMutation.mutate(newQ);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Question Type</label>
                  <select
                    value={newQ.type}
                    onChange={(e) => setNewQ({ ...newQ, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                  >
                    <option value="MCQ">MCQ (Multiple Choice)</option>
                    <option value="VIVA">VIVA (Oral Question)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Display Order</label>
                  <input
                    type="number"
                    value={newQ.orderIndex}
                    onChange={(e) => setNewQ({ ...newQ, orderIndex: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Question Text</label>
                <textarea
                  required
                  rows={2}
                  value={newQ.question}
                  onChange={(e) => setNewQ({ ...newQ, question: e.target.value })}
                  placeholder="Enter the question statement..."
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                />
              </div>

              {newQ.type === 'MCQ' && (
                <div className="space-y-2">
                  <label className="text-xs text-neutral-400 block">Options (4 Choices)</label>
                  {newQ.options.map((opt, i) => (
                    <input
                      key={i}
                      type="text"
                      required
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      value={opt}
                      onChange={(e) => {
                        const copy = [...newQ.options];
                        copy[i] = e.target.value;
                        setNewQ({ ...newQ, options: copy });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                    />
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  {newQ.type === 'MCQ' ? 'Correct Answer (Must match option exactly)' : 'Model Answer'}
                </label>
                <input
                  type="text"
                  required
                  value={newQ.answer}
                  onChange={(e) => setNewQ({ ...newQ, answer: e.target.value })}
                  placeholder={newQ.type === 'MCQ' ? 'e.g. Option text' : 'Comprehensive answer for viva'}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Explanation / Derivation</label>
                <textarea
                  rows={2}
                  value={newQ.explanation}
                  onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })}
                  placeholder="Why is this answer correct?"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddQModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createQMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
                >
                  {createQMutation.isPending ? 'Saving...' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
