import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import type { DashboardSummary } from '../types';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
  ListTodo
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await api.get('/dashboard/summary');
        setData(res.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch dashboard metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-lg w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl">
        {error || 'Unable to load dashboard data'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-slate-500">Live operational overview across projects and task deliverables</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/tasks"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition shadow-sm"
          >
            Manage Tasks
          </Link>
          <Link
            to="/projects"
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-sm font-medium transition shadow-sm"
          >
            View Projects
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Projects</p>
            <h3 className="text-2xl font-bold text-slate-900">{data.projects.total}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="text-emerald-600 font-semibold">{data.projects.active} active</span> · {data.projects.completed} done
            </p>
          </div>
        </div>

        {/* Total Tasks */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ListTodo className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</p>
            <h3 className="text-2xl font-bold text-slate-900">{data.tasks.total}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="text-indigo-600 font-semibold">{data.tasks.myAssigned} assigned</span> to you
            </p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completion Rate</p>
            <h3 className="text-2xl font-bold text-slate-900">{data.tasks.completionRate}%</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.tasks.byStatus.DONE} of {data.tasks.total} tasks resolved
            </p>
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overdue Tasks</p>
            <h3 className="text-2xl font-bold text-rose-600">{data.tasks.overdue}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Requiring urgent attention</p>
          </div>
        </div>
      </div>

      {/* Task Distribution & Status Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Task Status Distribution</h2>
            <span className="text-xs font-medium text-slate-400">Real-time pipeline</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-xs font-semibold text-slate-500">To Do</span>
              <p className="text-xl font-bold text-slate-800 mt-1">{data.tasks.byStatus.TODO}</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/60">
              <span className="text-xs font-semibold text-amber-700">In Progress</span>
              <p className="text-xl font-bold text-amber-900 mt-1">{data.tasks.byStatus.IN_PROGRESS}</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200/60">
              <span className="text-xs font-semibold text-purple-700">In Review</span>
              <p className="text-xl font-bold text-purple-900 mt-1">{data.tasks.byStatus.IN_REVIEW}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
              <span className="text-xs font-semibold text-emerald-700">Done</span>
              <p className="text-xl font-bold text-emerald-900 mt-1">{data.tasks.byStatus.DONE}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 font-medium mb-2">
              <span>Overall Organization Progress</span>
              <span>{data.tasks.completionRate}% Completed</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${data.tasks.completionRate}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
              />
            </div>
          </div>
        </div>

        {/* Project Health */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">Project States</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Active
              </span>
              <span className="font-semibold text-slate-900">{data.projects.active}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Planning
              </span>
              <span className="font-semibold text-slate-900">{data.projects.planning}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> On Hold
              </span>
              <span className="font-semibold text-slate-900">{data.projects.onHold}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-1.5">
              <span className="text-slate-600 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completed
              </span>
              <span className="font-semibold text-slate-900">{data.projects.completed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Recent Activity History</h2>
          </div>
          <span className="text-xs text-slate-400">Audit logs</span>
        </div>

        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No activity records logged yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.recentActivity.map((log) => (
              <div key={log.id} className="py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  {log.user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold text-slate-900">{log.user.name}</span>{' '}
                    <span className="text-slate-600">{log.details || log.action}</span>
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    {log.project && (
                      <span className="font-medium text-indigo-600">
                        Project: {log.project.name}
                      </span>
                    )}
                    <span>
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
