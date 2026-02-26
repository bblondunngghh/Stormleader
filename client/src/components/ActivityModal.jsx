import { useState } from 'react';
import { logActivity } from '../api/crm';
import { IconX } from './Icons';

const activityTypes = [
  { key: 'call', label: 'Call', icon: '📞' },
  { key: 'email', label: 'Email', icon: '📧' },
  { key: 'text', label: 'Text', icon: '💬' },
  { key: 'door_knock', label: 'Door Knock', icon: '🚪' },
  { key: 'note', label: 'Note', icon: '📝' },
];

const directionOptions = [
  { key: 'outbound', label: 'Outbound' },
  { key: 'inbound', label: 'Inbound' },
];

const outcomeOptions = {
  call: ['Connected', 'Left Voicemail', 'No Answer', 'Busy', 'Wrong Number'],
  email: ['Sent', 'Bounced', 'Replied'],
  text: ['Sent', 'Delivered', 'Replied'],
  door_knock: ['Spoke to Homeowner', 'Left Door Hanger', 'No One Home'],
  note: [],
};

export default function ActivityModal({ leadId, onSave, onClose }) {
  const [type, setType] = useState('call');
  const [direction, setDirection] = useState('outbound');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [duration, setDuration] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!subject.trim() && !notes.trim()) return;
    setSaving(true);
    try {
      await logActivity({
        lead_id: leadId,
        type,
        subject: subject.trim() || `${type} — ${outcome || direction}`,
        notes: notes.trim() || undefined,
        outcome: outcome || undefined,
        duration_seconds: duration ? parseInt(duration, 10) * 60 : undefined,
        next_follow_up: followUpDate || undefined,
        metadata: { direction },
      });
      onSave?.();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const outcomes = outcomeOptions[type] || [];

  return (
    <>
      <div className="slide-over-backdrop" onClick={onClose} />
      <div className="slide-over glass" style={{ width: 440 }}>
        <button className="slide-over__close" onClick={onClose}><IconX /></button>

        <div className="slide-over__header" style={{ paddingRight: 40 }}>
          <div className="slide-over__name">Log Activity</div>
        </div>

        <div className="divider" />

        {/* Activity Type Segmented Control */}
        <div className="detail-section">
          <div className="detail-section__title">Type</div>
          <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
            {activityTypes.map(at => (
              <button
                key={at.key}
                className={`activity-type-btn ${type === at.key ? 'activity-type-btn--active' : ''}`}
                onClick={() => { setType(at.key); setOutcome(''); }}
              >
                <span>{at.icon}</span> {at.label}
              </button>
            ))}
          </div>
        </div>

        {/* Direction Toggle */}
        {type !== 'note' && (
          <div className="detail-section">
            <div className="detail-section__title">Direction</div>
            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
              {directionOptions.map(d => (
                <button
                  key={d.key}
                  className={`activity-type-btn ${direction === d.key ? 'activity-type-btn--active' : ''}`}
                  onClick={() => setDirection(d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Subject */}
        <div className="detail-section">
          <div className="detail-section__title">Subject</div>
          <input
            className="form-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`${type === 'call' ? 'e.g., Follow-up call about inspection' : 'Brief description...'}`}
            autoFocus
          />
        </div>

        {/* Outcome */}
        {outcomes.length > 0 && (
          <div className="detail-section">
            <div className="detail-section__title">Outcome</div>
            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
              {outcomes.map(o => (
                <button
                  key={o}
                  className={`activity-type-btn ${outcome === o ? 'activity-type-btn--active' : ''}`}
                  onClick={() => setOutcome(o)}
                  style={{ fontSize: 12 }}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Duration (for calls) */}
        {(type === 'call' || type === 'door_knock') && (
          <div className="detail-section">
            <div className="detail-section__title">Duration (minutes)</div>
            <input
              className="form-input"
              type="number"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="0"
              style={{ maxWidth: 120 }}
            />
          </div>
        )}

        {/* Notes */}
        <div className="detail-section">
          <div className="detail-section__title">Notes</div>
          <textarea
            className="form-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Follow-up */}
        <div className="detail-section">
          <div className="detail-section__title">Schedule Follow-up</div>
          <input
            className="form-input"
            type="datetime-local"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
          />
        </div>

        <div className="divider" />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
          <button className="quick-action-btn" onClick={onClose}>Cancel</button>
          <button
            className="auth-btn"
            onClick={handleSave}
            disabled={(!subject.trim() && !notes.trim()) || saving}
            style={{ padding: '8px 24px', fontSize: 13 }}
          >
            {saving ? 'Saving...' : 'Log Activity'}
          </button>
        </div>
      </div>
    </>
  );
}
