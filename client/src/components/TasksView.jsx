import { useState, useEffect, useCallback } from 'react';
import { getTasks, createTask, updateTask } from '../api/crm';
import { IconCheckSquare, IconX } from './Icons';
import CustomSelect from './CustomSelect';
import DatePicker from './DatePicker';

const priorityColors = {
  hot: 'var(--accent-red)',
  warm: 'var(--accent-amber)',
  cold: 'var(--accent-blue)',
};

export default function TasksView() {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending | completed | all
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [allTasks, setAllTasks] = useState([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTasks({ limit: 200 });
      setAllTasks(res.data.tasks || []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleToggleComplete = async (task) => {
    const newVal = task.completed_at ? null : new Date().toISOString();
    // Optimistic
    setAllTasks(prev => prev.map(t =>
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

  const handleEdit = async (id, data) => {
    try {
      await updateTask(id, data);
      setEditingTask(null);
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

  const pendingTasks = allTasks.filter(t => !t.completed_at);
  const completedTasks = allTasks.filter(t => t.completed_at);
  const overdueTasks = pendingTasks.filter(overdue);
  const todayTasks = pendingTasks.filter(dueToday);

  const tasks = filter === 'pending' ? pendingTasks : filter === 'completed' ? completedTasks : allTasks;

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <div className="task-filter-tabs">
            {[
              { key: 'pending', label: 'Pending', count: pendingTasks.length },
              { key: 'completed', label: 'Completed', count: completedTasks.length },
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
        >
          + New Task
        </button>
      </div>

      {/* Task List */}
      <div className="glass" style={{ borderRadius: '20px / 18px', overflow: 'hidden' }}>
        {/* Summary header */}
        {filter === 'pending' && (overdueTasks.length > 0 || todayTasks.length > 0) && (
          <div style={{ display: 'flex', gap: 'var(--space-3xl)', padding: 'var(--space-lg) var(--space-xl)', borderBottom: '1px solid var(--glass-border)' }}>
            {overdueTasks.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-red)', marginBottom: 2 }}>
                  Overdue
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>{overdueTasks.length}</div>
              </div>
            )}
            {todayTasks.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-amber)', marginBottom: 2 }}>
                  Due Today
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>{todayTasks.length}</div>
              </div>
            )}
          </div>
        )}
        {loading && allTasks.length === 0 ? (
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
                onEdit={() => setEditingTask(task)}
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

      {/* Edit Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onSave={(data) => handleEdit(editingTask.id, data)}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onEdit, isOverdue, isDueToday }) {
  const done = !!task.completed_at;

  return (
    <div className={`task-row ${done ? 'task-row--done' : ''} ${isOverdue ? 'task-row--overdue' : ''}`}>
      <button className={`task-check ${done ? 'task-check--done' : ''}`} onClick={onToggle}>
        {done && <IconCheckSquare style={{ width: 14, height: 14 }} />}
      </button>

      <div className="task-row__body" onClick={onEdit} style={{ cursor: 'pointer' }}>
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

          <div style={{ display: 'flex', gap: 'var(--space-lg)', overflow: 'visible', position: 'relative', zIndex: 10 }}>
            <div className="form-group" style={{ flex: 1, overflow: 'visible' }}>
              <label>Due Date</label>
              <DatePicker value={dueDate} onChange={v => setDueDate(v)} placeholder="Select date" />
            </div>
            <div className="form-group" style={{ flex: 1, overflow: 'visible' }}>
              <label>Priority</label>
              <CustomSelect
                value={priority}
                onChange={v => setPriority(v)}
                options={[
                  { value: 'hot', label: 'High' },
                  { value: 'warm', label: 'Medium' },
                  { value: 'cold', label: 'Low' },
                ]}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
            <button type="button" className="quick-action-btn" onClick={onClose} style={{ height: 36 }}>Cancel</button>
            <button
              type="submit"
              className="auth-btn"
              disabled={!title.trim() || saving}
            >
              {saving ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function EditTaskModal({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : '');
  const [priority, setPriority] = useState(task.priority || 'warm');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
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
          <div className="slide-over__name">Edit Task</div>
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

          <div className="form-group" style={{ flex: 1 }}>
            <label>Description</label>
            <textarea
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={8}
              style={{ resize: 'vertical', flex: 1 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-lg)', overflow: 'visible', position: 'relative', zIndex: 10 }}>
            <div className="form-group" style={{ flex: 1, overflow: 'visible' }}>
              <label>Due Date</label>
              <DatePicker value={dueDate} onChange={v => setDueDate(v)} placeholder="Select date" />
            </div>
            <div className="form-group" style={{ flex: 1, overflow: 'visible' }}>
              <label>Priority</label>
              <CustomSelect
                value={priority}
                onChange={v => setPriority(v)}
                options={[
                  { value: 'hot', label: 'High' },
                  { value: 'warm', label: 'Medium' },
                  { value: 'cold', label: 'Low' },
                ]}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
            <button type="button" className="quick-action-btn" onClick={onClose} style={{ height: 36 }}>Cancel</button>
            <button
              type="submit"
              className="auth-btn"
              disabled={!title.trim() || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
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
