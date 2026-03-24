import { useState, useEffect, useCallback } from 'react';
import { getTasks, createTask, updateTask } from '../api/crm';
import { IconCheckSquare, IconX } from './Icons';
import CustomSelect from './CustomSelect';
import DatePicker from './DatePicker';
import useIsMobile from '../hooks/useIsMobile';

import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

const priorityColors = {
  hot: 'var(--accent-red)',
  warm: 'var(--accent-amber)',
  cold: 'var(--accent-blue)',
};

export default function TasksView() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending | completed | all
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showFilterOps, setShowFilterOps] = useState(false);

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

  const upcomingTasks = pendingTasks.filter(t => !overdue(t) && !dueToday(t));

  const tasks = filter === 'pending' ? pendingTasks : filter === 'completed' ? completedTasks : allTasks;

  // Compute completion rate for efficiency index
  const completionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;
  const criticalPathVelocity = overdueTasks.length > 0 && pendingTasks.length > 0
    ? Math.round(((pendingTasks.length - overdueTasks.length) / pendingTasks.length) * 100)
    : pendingTasks.length === 0 ? 100 : 64;

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1321', color: '#dde2f6', fontFamily: 'Manrope, sans-serif', paddingBottom: 100 }}>
        {/* Mobile Header */}
        <div style={{ padding: '24px 24px 0' }}>
          {/* Status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: '#00daf3',
              boxShadow: '0 0 0 0 rgba(0, 218, 243, 0.7)',
              animation: 'mobilePulse 2s infinite',
            }} />
            <p style={{
              fontFamily: '"Space Grotesk", sans-serif', fontSize: 10, letterSpacing: '0.15em',
              textTransform: 'uppercase', color: '#00daf3', fontWeight: 500, margin: 0,
            }}>Operational Status: Active</p>
          </div>
          <style>{`
            @keyframes mobilePulse {
              0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 218, 243, 0.7); }
              70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0, 218, 243, 0); }
              100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 218, 243, 0); }
            }
          `}</style>

          {/* Title */}
          <h2 style={{
            fontSize: 32, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif',
            color: '#dde2f6', letterSpacing: '-0.02em', margin: '0 0 4px',
          }}>Mission Log</h2>
          <p style={{ color: '#bac9cc', fontSize: 14, margin: '0 0 24px' }}>
            Tactical task management and field deployment queue.
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            <button
              onClick={() => setShowFilterOps(!showFilterOps)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', background: '#161b2a', color: '#dde2f6',
                borderBottom: '2px solid rgba(59,73,76,0.3)', border: 'none',
                borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'rgba(59,73,76,0.3)',
                fontFamily: '"Space Grotesk", sans-serif', fontSize: 13, cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_list</span>
              FILTER OPS
            </button>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 24px', background: 'linear-gradient(135deg, #c3f5ff, #00e5ff)',
                color: '#00626e', fontFamily: '"Space Grotesk", sans-serif', fontSize: 13,
                fontWeight: 700, border: 'none', borderRadius: 6, cursor: 'pointer',
                boxShadow: '0 0 15px rgba(0,229,255,0.2)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              NEW TASK
            </button>
          </div>

          {/* Filter ops dropdown */}
          {showFilterOps && (
            <div style={{
              display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap',
            }}>
              {['pending', 'completed', 'all'].map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setShowFilterOps(false); }}
                  style={{
                    padding: '6px 14px', fontSize: 11, fontFamily: '"Space Grotesk", sans-serif',
                    textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600,
                    background: filter === f ? 'rgba(0,229,255,0.15)' : '#1a1f2e',
                    color: filter === f ? '#00e5ff' : '#bac9cc',
                    border: filter === f ? '1px solid rgba(0,229,255,0.3)' : '1px solid transparent',
                    borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && allTasks.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#bac9cc' }}>Loading...</div>
        ) : (
          <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* OVERDUE SECTION */}
            {overdueTasks.length > 0 && (
              <MobileTaskSection
                icon="priority_high"
                iconColor="#ffb4ab"
                title="Overdue"
                badgeText={`${String(overdueTasks.length).padStart(2, '0')} BLOCKED`}
                badgeBg="#93000a"
                badgeColor="#ffdad6"
                borderColor="#ffb4ab"
                tasks={overdueTasks}
                completedTasks={[]}
                cardStyle="overdue"
                onToggle={handleToggleComplete}
                onEdit={setEditingTask}
              />
            )}

            {/* TODAY SECTION */}
            {(todayTasks.length > 0 || completedTasks.some(t => dueToday(t) || !t.due_date)) && (
              <MobileTaskSection
                icon="today"
                iconColor="#00daf3"
                title="Today"
                badgeText={`${String(todayTasks.length).padStart(2, '0')} ACTIVE`}
                badgeBg="rgba(0,229,255,0.2)"
                badgeColor="#00daf3"
                borderColor="#00daf3"
                tasks={todayTasks}
                completedTasks={completedTasks}
                cardStyle="today"
                onToggle={handleToggleComplete}
                onEdit={setEditingTask}
              />
            )}

            {/* UPCOMING SECTION */}
            {upcomingTasks.length > 0 && (
              <MobileTaskSection
                icon="calendar_month"
                iconColor="#849396"
                title="Upcoming"
                badgeText={`${String(upcomingTasks.length).padStart(2, '0')} QUEUED`}
                badgeBg="#242a39"
                badgeColor="#bac9cc"
                borderColor="#3b494c"
                tasks={upcomingTasks}
                completedTasks={[]}
                cardStyle="upcoming"
                onToggle={handleToggleComplete}
                onEdit={setEditingTask}
              />
            )}

            {/* EFFICIENCY INDEX */}
            <div style={{
              background: 'rgba(0,229,255,0.05)', borderRadius: 8, padding: 24,
              border: '1px solid rgba(0,229,255,0.1)',
            }}>
              <h5 style={{
                fontFamily: '"Space Grotesk", sans-serif', fontSize: 10, letterSpacing: '0.2em',
                textTransform: 'uppercase', color: '#00daf3', marginBottom: 16, fontWeight: 600,
                margin: '0 0 16px',
              }}>Efficiency Index</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700,
                    marginBottom: 4, fontFamily: '"Space Grotesk", sans-serif',
                    textTransform: 'uppercase', letterSpacing: '0.1em', color: '#dde2f6',
                  }}>
                    <span>Task Completion Rate</span>
                    <span>{completionRate}%</span>
                  </div>
                  <div style={{
                    width: '100%', height: 6, background: '#242a39', borderRadius: 99, overflow: 'hidden',
                  }}>
                    <div style={{ background: '#00e5ff', height: '100%', width: `${completionRate}%`, borderRadius: 99 }} />
                  </div>
                </div>
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700,
                    marginBottom: 4, fontFamily: '"Space Grotesk", sans-serif',
                    textTransform: 'uppercase', letterSpacing: '0.1em', color: '#dde2f6',
                  }}>
                    <span>Critical Path Velocity</span>
                    <span>{criticalPathVelocity}%</span>
                  </div>
                  <div style={{
                    width: '100%', height: 6, background: '#242a39', borderRadius: 99, overflow: 'hidden',
                  }}>
                    <div style={{ background: '#ffd799', height: '100%', width: `${criticalPathVelocity}%`, borderRadius: 99 }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {showCreate && (
          <CreateTaskModal
            onSave={handleCreate}
            onClose={() => setShowCreate(false)}
          />
        )}
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

function MobileTaskSection({ icon, iconColor, title, badgeText, badgeBg, badgeColor, borderColor, tasks, completedTasks, cardStyle, onToggle, onEdit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardDocumentListIcon width={20} height={20} style={{ opacity: 0.9 }} />
          <h3 style={{
            fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, letterSpacing: '0.15em',
            textTransform: 'uppercase', fontSize: 13, margin: 0,
          }}>{title}</h3>
        </div>
        <span style={{
          background: badgeBg, color: badgeColor, padding: '2px 8px', borderRadius: 2,
          fontSize: 10, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif',
          letterSpacing: '-0.02em',
        }}>{badgeText}</span>
      </div>

      {/* Task cards */}
      {tasks.map(task => (
        <MobileTaskCard
          key={task.id}
          task={task}
          borderColor={borderColor}
          cardStyle={cardStyle}
          onToggle={() => onToggle(task)}
          onEdit={() => onEdit(task)}
        />
      ))}

      {/* Show completed tasks in today section */}
      {completedTasks.map(task => (
        <div
          key={task.id}
          onClick={() => onEdit(task)}
          style={{
            background: 'rgba(8,14,28,0.4)', padding: 20, borderRadius: 8,
            borderLeft: '2px solid #849396', opacity: 0.6, cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{
              background: '#3b494c', color: '#bac9cc', padding: '2px 8px',
              fontSize: 10, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif',
              textTransform: 'uppercase', letterSpacing: '0.15em', borderRadius: 2,
            }}>Completed</span>
            <input
              type="checkbox"
              checked
              onChange={() => onToggle(task)}
              onClick={e => e.stopPropagation()}
              style={{
                width: 16, height: 16, accentColor: '#00e5ff', opacity: 0.5, cursor: 'pointer',
              }}
            />
          </div>
          <h4 style={{
            fontFamily: '"Space Grotesk", sans-serif', fontSize: 18, fontWeight: 700,
            color: '#bac9cc', marginBottom: 4, textDecoration: 'line-through', margin: '0 0 8px',
          }}>{task.title}</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(0,229,255,0.5)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
            <span style={{
              fontSize: 11, fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>Verified</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileTaskCard({ task, borderColor, cardStyle, onToggle, onEdit }) {
  const isUrgent = task.priority === 'hot';
  const isGlass = cardStyle === 'today';

  const cardBg = isGlass ? 'rgba(47,52,68,0.6)' : '#080e1c';
  const backdropFilter = isGlass ? 'blur(20px)' : 'none';

  return (
    <div
      onClick={onEdit}
      style={{
        position: 'relative', background: cardBg, padding: 20, borderRadius: 8,
        borderLeft: `2px solid ${borderColor}`, cursor: 'pointer',
        backdropFilter, WebkitBackdropFilter: backdropFilter,
        transition: 'background 0.3s',
      }}
    >
      {/* Priority badge + checkbox */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{
          background: isUrgent ? '#ffc1c0' : '#2f3444',
          color: isUrgent ? '#b4002b' : (cardStyle === 'today' ? '#c3f5ff' : '#bac9cc'),
          padding: '2px 8px', fontSize: 10, fontWeight: 700,
          fontFamily: '"Space Grotesk", sans-serif', textTransform: 'uppercase',
          letterSpacing: '0.15em', borderRadius: 2,
        }}>
          {isUrgent ? 'Urgent' : 'Standard'}
        </span>
        <input
          type="checkbox"
          checked={false}
          onChange={onToggle}
          onClick={e => e.stopPropagation()}
          style={{
            width: 16, height: 16, accentColor: '#00e5ff', cursor: 'pointer',
            background: '#2f3444', borderRadius: 2,
          }}
        />
      </div>

      {/* Title */}
      <h4 style={{
        fontFamily: '"Space Grotesk", sans-serif', fontSize: 18, fontWeight: 700,
        color: '#dde2f6', margin: '0 0 4px',
      }}>{task.title}</h4>

      {/* Description */}
      {task.description && (
        <p style={{ color: '#bac9cc', fontSize: 14, margin: '0 0 16px', lineHeight: 1.4 }}>
          {task.description}
        </p>
      )}

      {/* Footer: time + assignee */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: task.description ? 0 : 16 }}>
        {task.due_date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: getMobileTimeColor(task, cardStyle) }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {cardStyle === 'overdue' ? 'schedule' : cardStyle === 'today' ? 'timer' : 'calendar_today'}
            </span>
            <span style={{
              fontSize: 11, fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
              letterSpacing: '0.1em',
            }}>{getMobileTimeLabel(task, cardStyle)}</span>
          </div>
        )}
        {task.assignee_first_name && (
          <div style={{ display: 'flex' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: '#2f3444',
              border: '2px solid #080e1c', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#dde2f6',
            }}>
              {task.assignee_first_name[0]}{task.assignee_last_name?.[0] || ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getMobileTimeColor(task, cardStyle) {
  if (cardStyle === 'overdue') return '#ffb4ab';
  if (cardStyle === 'today') return '#00daf3';
  return '#64748b';
}

function getMobileTimeLabel(task, cardStyle) {
  const date = new Date(task.due_date);
  const now = new Date();
  const diffMs = date - now;
  const diffHours = Math.round(Math.abs(diffMs) / 3600000);
  const diffDays = Math.round(Math.abs(diffMs) / 86400000);

  if (cardStyle === 'overdue') {
    if (diffHours < 24) return `DELAYED ${diffHours}H`;
    return `DELAYED ${diffDays}D`;
  }
  if (cardStyle === 'today') {
    if (diffHours <= 12) return `T-MINUS ${diffHours}H`;
    const h = date.getHours();
    const m = date.getMinutes();
    return `BY ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  // upcoming
  if (diffDays <= 1) return 'TOMORROW';
  if (diffDays <= 7) return `IN ${diffDays} DAYS`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
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
