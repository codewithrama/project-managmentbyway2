import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Task, TaskPriority, TaskStatus, User } from '../types';
import {
  ArrowLeft,
  Calendar,
  User as UserIcon,
  Clock,
  Send,
  Trash2,
  Activity,
  AlertCircle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export const TaskDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const [users, setUsers] = useState<User[]>([]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tasks/${id}`);
      setTask(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
    api.get('/users').then((r) => setUsers(r.data.data)).catch(console.error);
  }, [id]);

  const handleUpdate = async (fields: Partial<Task>) => {
    try {
      const res = await api.patch(`/tasks/${id}`, fields);
      setTask(res.data.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Update failed');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      navigate('/tasks');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete task');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    try {
      setPostingComment(true);
      await api.post(`/tasks/${id}/comments`, { content: commentContent });
      setCommentContent('');
      fetchTask();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const canManageTask =
    user?.role === 'ADMIN' ||
    (user?.role === 'PROJECT_MANAGER' && task?.project);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading task...</div>;
  if (error || !task) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl">
        {error || 'Task not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/tasks"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Tasks
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Comments */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-indigo-600 uppercase">
                  Project: {task.project?.name}
                </span>
                <h1 className="text-2xl font-bold text-slate-900 mt-1">{task.title}</h1>
              </div>

              {canManageTask && (
                <button
                  onClick={handleDelete}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition"
                  title="Delete Task"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="text-sm text-slate-600 whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100">
              {task.description || 'No description provided.'}
            </div>

            <div className="text-xs text-slate-400">
              Created on {format(new Date(task.createdAt), 'PPP')} by {task.creator?.name}
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-slate-900">
              Discussion & Comments ({task.comments?.length || 0})
            </h3>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="submit"
                disabled={postingComment || !commentContent.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Send
              </button>
            </form>

            <div className="divide-y divide-slate-100 pt-2">
              {task.comments?.map((c) => (
                <div key={c.id} className="py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {c.author.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{c.author.name}</span>
                      <span className="text-slate-400">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">{c.content}</p>
                  </div>
                </div>
              ))}

              {task.comments?.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No comments yet. Start the conversation!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Attributes & Status */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Task Settings</h3>

            {/* Status change */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status</label>
              <select
                value={task.status}
                onChange={(e) => handleUpdate({ status: e.target.value as TaskStatus })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            {/* Priority change */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Priority</label>
              <select
                disabled={!canManageTask}
                value={task.priority}
                onChange={(e) => handleUpdate({ priority: e.target.value as TaskPriority })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold disabled:bg-slate-100"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            {/* Assignee change */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Assignee</label>
              <select
                disabled={!canManageTask}
                value={task.assigneeId || ''}
                onChange={(e) => handleUpdate({ assigneeId: e.target.value || null })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold disabled:bg-slate-100"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Due Date</label>
              <input
                type="date"
                disabled={!canManageTask}
                value={task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : ''}
                onChange={(e) =>
                  handleUpdate({
                    dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Task Activity Logs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" /> Task History
            </h3>
            <div className="space-y-2">
              {task.activityLogs?.map((log) => (
                <div key={log.id} className="text-xs border-l-2 border-indigo-200 pl-2.5 py-1">
                  <p className="text-slate-800 font-medium">
                    <span className="font-semibold">{log.user?.name}</span> {log.details || log.action}
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
    </div>
  );
};
