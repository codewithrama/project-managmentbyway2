import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Project, ProjectStatus, User, TaskStatus, TaskPriority } from '../types';
import {
  Calendar,
  Users as UsersIcon,
  CheckCircle2,
  Trash2,
  Edit,
  Plus,
  ArrowLeft,
  Clock,
  Activity,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Project Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<ProjectStatus>('ACTIVE');
  const [editDesc, setEditDesc] = useState('');

  // Add Member modal
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

  // Quick Task Creation in project
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    status: 'TODO' as TaskStatus,
    assigneeId: '',
    dueDate: '',
  });

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/projects/${id}`);
      setProject(res.data.data);
      setEditStatus(res.data.data.status);
      setEditDesc(res.data.data.description || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  const handleUpdateProject = async () => {
    try {
      await api.patch(`/projects/${id}`, {
        status: editStatus,
        description: editDesc,
      });
      setIsEditing(false);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update project');
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Are you sure you want to delete this project? All associated tasks will be removed.')) {
      return;
    }
    try {
      await api.delete(`/projects/${id}`);
      navigate('/projects');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserToAdd) return;
    try {
      await api.post(`/projects/${id}/members`, { userId: selectedUserToAdd });
      setShowMemberModal(false);
      setSelectedUserToAdd('');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm('Remove member from project?')) return;
    try {
      await api.delete(`/projects/${id}/members/${userId}`);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tasks', {
        title: newTask.title,
        description: newTask.description,
        projectId: id,
        priority: newTask.priority,
        status: newTask.status,
        assigneeId: newTask.assigneeId || null,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : null,
      });
      setShowTaskModal(false);
      setNewTask({
        title: '',
        description: '',
        priority: 'MEDIUM',
        status: 'TODO',
        assigneeId: '',
        dueDate: '',
      });
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create task');
    }
  };

  const canManage =
    user?.role === 'ADMIN' ||
    (user?.role === 'PROJECT_MANAGER' && project?.managerId === user?.id);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading project details...</div>;
  }

  if (error || !project) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl">
        {error || 'Project not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              {!isEditing && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {project.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Managed by <span className="text-slate-700 font-medium">{project.manager.name}</span>
            </p>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleUpdateProject}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
                  >
                    <Check className="w-3.5 h-3.5" /> Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold hover:bg-rose-100 border border-rose-200 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Description</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">{project.description || 'No description provided.'}</p>
        )}

        {/* Progress bar */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex justify-between text-xs text-slate-500 font-medium">
            <span>Overall Completion</span>
            <span>{project.progress || 0}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              style={{ width: `${project.progress || 0}%` }}
              className="h-full bg-indigo-600 rounded-full transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Team & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Project Tasks ({project.tasks?.length || 0})</h2>
            {canManage && (
              <button
                onClick={() => setShowTaskModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition"
              >
                <Plus className="w-3.5 h-3.5" /> New Task
              </button>
            )}
          </div>

          <div className="space-y-3">
            {project.tasks && project.tasks.length > 0 ? (
              project.tasks.map((task) => (
                <Link
                  key={task.id}
                  to={`/tasks/${task.id}`}
                  className="bg-white p-4 rounded-xl border border-slate-200/80 hover:border-indigo-300 transition block shadow-2xs group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-slate-800 text-sm group-hover:text-indigo-600 transition">
                      {task.title}
                    </h4>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                      {task.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                    <span>Assignee: {task.assignee?.name || 'Unassigned'}</span>
                    <span>Priority: {task.priority}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-sm text-slate-400">
                No tasks created in this project yet.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Members & Activity */}
        <div className="space-y-6">
          {/* Members Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Assigned Members</h3>
              {canManage && (
                <button
                  onClick={async () => {
                    const res = await api.get('/users');
                    setAllUsers(res.data.data);
                    setShowMemberModal(true);
                  }}
                  className="text-xs text-indigo-600 font-semibold hover:text-indigo-700"
                >
                  + Add Member
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {project.members?.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                      {m.user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{m.user.name}</p>
                      <p className="text-[11px] text-slate-400">{m.user.role}</p>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      className="text-slate-400 hover:text-rose-600 transition p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Activity Logs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" /> Project History
            </h3>
            <div className="space-y-3">
              {project.activityLogs?.slice(0, 8).map((log) => (
                <div key={log.id} className="text-xs space-y-0.5 border-l-2 border-indigo-200 pl-2.5">
                  <p className="text-slate-800 font-medium">
                    <span className="font-bold">{log.user?.name}</span> {log.details || log.action}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-base text-slate-900">Add Team Member</h3>
            <select
              value={selectedUserToAdd}
              onChange={(e) => setSelectedUserToAdd(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value="">Select a user...</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowMemberModal(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
              >
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Create Task in {project.name}</h3>
              <button onClick={() => setShowTaskModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Task title..."
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Details..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Assignee</label>
                  <select
                    value={newTask.assigneeId}
                    onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="">Unassigned</option>
                    {project.members?.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Due Date</label>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
