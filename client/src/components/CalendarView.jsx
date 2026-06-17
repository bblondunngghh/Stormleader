import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { getCalendarEvents, updateTask, createTask } from '../api/crm';
import { IconX, IconCheck, IconPlusCircle } from './Icons';
import CustomSelect from './CustomSelect';
import DatePicker from './DatePicker';
import { showToast } from './Toast';

const typeLabels = {
  task: 'Task',
  call: 'Call',
  email: 'Email',
  door_knock: 'Door Knock',
};

const typeOptions = [
  { value: 'task', label: 'Task' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'door_knock', label: 'Door Knock' },
];

const priorityOptions = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];

export default function CalendarView() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const calendarRef = useRef(null);
  const lastFetchInfo = useRef(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDate, setCreateDate] = useState('');

  const fetchEvents = useCallback(async (fetchInfo) => {
    lastFetchInfo.current = fetchInfo;
    setLoading(true);
    try {
      const { data } = await getCalendarEvents(
        fetchInfo.startStr,
        fetchInfo.endStr
      );
      const mapped = data.map((ev) => ({
        id: ev.id,
        title: ev.title,
        start: ev.start,
        backgroundColor: ev.color,
        borderColor: ev.color,
        textColor: 'oklch(0.95 0 0)',
        editable: ev.type === 'task',
        extendedProps: {
          type: ev.type,
          leadId: ev.leadId,
          contactName: ev.contactName,
          address: ev.address,
          priority: ev.priority,
          status: ev.status,
        },
      }));
      setEvents(mapped);
    } catch (err) {
      showToast('Failed to load calendar events', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // FullCalendar's prev/next buttons carry their own aria-labels, but the inner
  // icon spans render with role="img" and no alt text (axe: role-img-alt).
  // They're purely decorative, so strip the role and hide them after each render.
  const handleDatesSet = useCallback((info) => {
    // Defer to the next frame so the header toolbar is in the DOM, then strip
    // the decorative icons' role so they no longer need alt text.
    requestAnimationFrame(() => {
      const root = calendarRef.current?.getApi()?.el || document;
      root.querySelectorAll('.fc-icon[role="img"]').forEach((el) => {
        el.setAttribute('aria-hidden', 'true');
        el.removeAttribute('role');
      });
    });
    return fetchEvents(info);
  }, [fetchEvents]);

  const handleEventClick = useCallback(
    (info) => {
      const { leadId } = info.event.extendedProps;
      if (leadId) {
        navigate(`/leads?leadId=${leadId}`);
      }
    },
    [navigate]
  );

  const handleEventDrop = useCallback(async (info) => {
    const eventId = info.event.id;
    if (!eventId.startsWith('task-')) {
      info.revert();
      return;
    }
    const taskId = eventId.replace('task-', '');
    try {
      await updateTask(taskId, { due_date: info.event.start.toISOString() });
      showToast('Task rescheduled', 'success');
    } catch (err) {
      showToast('Failed to reschedule task', 'error');
      info.revert();
    }
  }, []);

  const handleDateClick = useCallback((info) => {
    setCreateDate(info.dateStr);
    setShowCreateModal(true);
  }, []);

  const handleTaskCreated = useCallback(() => {
    setShowCreateModal(false);
    if (lastFetchInfo.current) {
      fetchEvents(lastFetchInfo.current);
    }
  }, [fetchEvents]);

  const renderEventContent = useCallback((eventInfo) => {
    const { type, contactName, priority } = eventInfo.event.extendedProps;
    return (
      <div className="calendar-event-content">
        <span className="calendar-event-content__badge">{typeLabels[type] || type}</span>
        <span className="calendar-event-content__title">{eventInfo.event.title}</span>
        {contactName && (
          <span className="calendar-event-content__contact">{contactName}</span>
        )}
        {priority && (
          <span className={`calendar-event-content__priority calendar-event-content__priority--${priority}`}>
            {priority}
          </span>
        )}
      </div>
    );
  }, []);

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
    <div className="calendar-view glass">
      {loading && (
        <div className="calendar-view__loading">
          <div className="storm-map-loading__spinner" />
        </div>
      )}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
        }}
        buttonText={{
          today: 'Today',
          month: 'Month',
          week: 'Week',
          day: 'Day',
          list: 'List',
        }}
        allDayText="All Day"
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          omitZeroMinute: true,
          meridiem: 'short',
        }}
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
        events={events}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        dateClick={handleDateClick}
        editable={true}
        selectable={true}
        eventContent={renderEventContent}
        height="auto"
        dayMaxEvents={4}
        nowIndicator={true}
        eventDisplay="block"
        noEventsContent={() => (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No events in this range</div>
            <div style={{ fontSize: 12 }}>Click any date to create a task</div>
          </div>
        )}
      />
    </div>

    {showCreateModal && (
      <CalendarCreateModal
        initialDate={createDate}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleTaskCreated}
      />
    )}
    </div>
  );
}

// ============================================================
// CALENDAR CREATE MODAL — JobNimbus-style click-to-create
// ============================================================

function CalendarCreateModal({ initialDate, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('warm');
  const [dueDate, setDueDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast('Enter a task title', 'error');
      return;
    }
    setSaving(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
        priority,
      });
      showToast('Task created', 'success');
      onCreated();
    } catch {
      showToast('Failed to create task', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = initialDate
    ? new Date(initialDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div className="glass modal-scale-in" onClick={e => e.stopPropagation()} style={{
        borderRadius: 20, padding: 'var(--space-xl)', width: 440, maxWidth: '95vw',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Create Task</h3>
            {formattedDate && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{formattedDate}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <IconX style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="form-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Title</label>
            <input
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Follow up with homeowner"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSubmit(); }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Type</label>
              <CustomSelect
                value={type}
                onChange={setType}
                options={typeOptions}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Priority</label>
              <CustomSelect
                value={priority}
                onChange={setPriority}
                options={priorityOptions}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Due Date</label>
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
            />
          </div>

          <div className="form-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Description (optional)</label>
            <textarea
              className="form-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-lg)' }}>
          <button className="quick-action-btn" onClick={onClose} style={{ padding: '10px 20px', fontSize: 13 }}>Cancel</button>
          <button className="auth-btn" onClick={handleSubmit} disabled={saving || !title.trim()} style={{
            padding: '10px 24px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <IconCheck style={{ width: 14, height: 14 }} /> {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
