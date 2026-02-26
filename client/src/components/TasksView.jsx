import { useState, useEffect, useCallback } from 'react';
import { getTasks, createTask, updateTask } from '../api/crm';
import { IconCheckSquare, IconX } from './Icons';

const priorityColors = {
  hot: 'var(--accent-red)',
  warm: 'var(--accent-amber)',
  cold: 'var(--accent-blue)',
};

export default function TasksView() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending | completed | all
  const [showCreate, setShowCreate] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filter === 'pending') params.completed = 'false';
      else if (filter === 'completed') params.completed = 'true';

      const res = await getTasks(params);
      setTasks(res.data.tasks || []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleToggleComplete = async (task) => {
    const newVal = task.completed_at ? null : new Date().toISOString();
    // Optimistic
    setTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, completed_at: newVal } : t
    ));
    try {
      await updateTask(task.id, { completed_at: newVal });
    } catch {
      fetchTasks();
    }
  };

  const handleCreate = async (data) => {
    try {
      await createTask(data);
      setShowCreate(false);
      fetchTasks();
    } catch {
      // silent
    }
  };

  const overdue = (t) => !t.completed_at && t.due_date && new Date(t.due_date) < new Date();
  const dueToday = (t) => {
    if (!t.due_date || t.completed_at) return false;
    const d = new Date(t.due_date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };

  const pendingTasks = tasks.filter(t => !t.completed_at);
  const completedTasks = tasks.filter(t => t.completed_at);
  const overdueTasks = pendingTasks.filter(overdue);
  const todayTasks = pendingTasks.filter(dueToday);

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <div className="task-filter-tabs">
            {[
              { key: 'pending', label: 'Pending', count: pendingTasks.length },
              { key: 'completed', label: 'Completed', count: completedTasks.length },
              { key: 'all', label: 'All', count: tasks.length },
            ].map(tab => (
              <button
                key={tab.key}
                className={`task-filter-tab ${filter === tab.key ? 'is-active' : ''}`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
                <span className="task-filter-tab__count">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          className="auth-btn"
          onClick={() => setShowCreate(true)}
          style={{ padding: '8px 20px', fontSize: 13 }}
        >
          + New Task
        </button>
      </div>

      {/* Summary Cards */}
      {filter === 'pending' && (overdueTasks.length > 0 || todayTasks.length > 0) && (
        <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
          {overdueTasks.length > 0 && (
            <div className="glass" style={{
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg) var(--space-xl)',
              flex: 1, borderLeft: '3px solid var(--accent-red)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-red)', marginBottom: 4 }}>
                Overdue
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{overdueTasks.length}</div>
            </div>
          )}
          {todayTasks.length > 0 && (
            <div className="glass" style={{
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg) var(--space-xl)',
              flex: 1, borderLeft: '3px solid var(--accent-amber)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-amber)', marginBottom: 4 }}>
                Due Today
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{todayTasks.length}</div>
            </div>
          )}
        </div>
      )}

      {/* Task List */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading && tasks.length === 0 ? (
          <div style={{ padding: 'var(--space-3xl)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: 'var(--space-3xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
            {filter === 'completed' ? 'No completed tasks' : 'No tasks yet — create one to get started'}
          </div>
        ) : (
          <div className="task-list">
            {tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => handleToggleComplete(task)}
                isOverdue={overdue(task)}
                isDueToday={dueToday(task)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateTaskModal
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, isOverdue, isDueToday }) {
  const done = !!task.completed_at;

  return (
    <div className={`task-row ${done ? 'task-row--done' : ''} ${isOverdue ? 'task-row--overdue' : ''}`}>
      <button className={`task-check ${done ? 'task-check--done' : ''}`} onClick={onToggle}>
        {done && <IconCheckSquare style={{ width: 14, height: 14 }} />}
      </button>

      <div className="task-row__body">
        <div className="task-row__title">{task.title}</div>
        {task.description && (
          <div className="task-row__desc">{task.description}</div>
        )}
        <div className="task-row__meta">
          {task.priority && (
            <span className="task-row__priority" style={{ color: priorityColors[task.priority] }}>
              {task.priority}
            </span>
          )}
          {task.assignee_first_name && (
            <span className="task-row__assignee">
              {task.assignee_first_name} {task.assignee_last_name?.[0] || ''}
            </span>
          )}
          {task.lead_id && task.address && (
            <span className="task-row__lead">{task.address}</span>
          )}
        </div>
      </div>

      <div className="task-row__right">
        {task.due_date && (
          <span className={`task-row__due ${isOverdue ? 'task-row__due--overdue' : ''} ${isDueToday ? 'task-row__due--today' : ''}`}>
            {formatDueDate(task.due_date)}
          </span>
        )}
        {done && (
          <span className="task-row__completed-at">
            Done {new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

function CreateTaskModal({ onSave, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('warm');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      due_date: dueDate || undefined,
      priority,
    });
    setSaving(false);
  };

  return (
    <>
      <div className="slide-over-backdrop" onClick={onClose} />
      <div className="slide-over glass" style={{ width: 420 }}>
        <button className="slide-over__close" onClick={onClose}><IconX /></button>

        <div className="slide-over__header" style={{ paddingRight: 40 }}>
          <div className="slide-over__name">New Task</div>
        </div>

        <div className="divider" />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div className="form-group">
            <label>Title</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Due Date</label>
              <input
                className="form-input"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Priority</label>
              <select
                className="form-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
            <button type="button" className="quick-action-btn" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="auth-btn"
              disabled={!title.trim() || saving}
              style={{ padding: '8px 24px', fontSize: 13 }}
            >
              {saving ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function formatDueDate(d) {
  const date = new Date(d);
  const now = new Date();
  const diff = date - now;
  const days = Math.ceil(diff / 86400000);

  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
