import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { getCalendarEvents, updateTask } from '../api/crm';

const typeLabels = {
  task: 'Task',
  call: 'Call',
  email: 'Email',
  door_knock: 'Door Knock',
};

export default function CalendarView() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const calendarRef = useRef(null);

  const fetchEvents = useCallback(async (fetchInfo) => {
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
      console.error('Failed to load calendar events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
    } catch (err) {
      console.error('Failed to reschedule task:', err);
      info.revert();
    }
  }, []);

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
        events={events}
        datesSet={fetchEvents}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        editable={true}
        eventContent={renderEventContent}
        height="auto"
        dayMaxEvents={4}
        nowIndicator={true}
        eventDisplay="block"
      />
    </div>
  );
}
