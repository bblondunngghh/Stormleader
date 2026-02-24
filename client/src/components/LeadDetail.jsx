import { IconX, IconPhone, IconMail, IconCalendar, IconClipboard, IconDollar, IconCamera, IconSend } from './Icons';

const stageLabels = {
  'new': 'New',
  'contacted': 'Contacted',
  'appt-set': 'Appt Set',
  'inspected': 'Inspected',
  'estimate-sent': 'Estimate Sent',
  'sold': 'Sold',
};

const mockTimeline = [
  { text: 'Lead created from storm canvass', time: 'Feb 19, 2026 — 9:14am' },
  { text: 'Automated SMS sent: "We noticed storm activity..."', time: 'Feb 19, 2026 — 9:15am' },
  { text: 'Outbound call — left voicemail', time: 'Feb 19, 2026 — 2:30pm' },
  { text: 'Homeowner called back, interested', time: 'Feb 20, 2026 — 10:05am' },
  { text: 'Inspection appointment scheduled', time: 'Feb 20, 2026 — 10:12am' },
];

export default function LeadDetail({ lead, onClose }) {
  if (!lead) return null;

  return (
    <>
      <div className="slide-over-backdrop" onClick={onClose} />
      <div className="slide-over glass">
        <button className="slide-over__close" onClick={onClose}>
          <IconX />
        </button>

        {/* Header */}
        <div className="slide-over__header">
          <div className="slide-over__priority-row">
            <span className={`slide-over__priority-badge slide-over__priority-badge--${lead.priority}`}>
              {lead.priority}
            </span>
            <span className="slide-over__stage-badge">{stageLabels[lead.stage]}</span>
          </div>
          <div className="slide-over__name">{lead.name}</div>
          <div className="slide-over__address">{lead.address}, {lead.city} TX</div>
          <div className="slide-over__value">${lead.value.toLocaleString()}</div>
        </div>

        <div className="divider" />

        {/* Contact Info */}
        <div className="detail-section">
          <div className="detail-section__title">Contact</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Phone</span>
              <span className="detail-item__value">{lead.phone}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Email</span>
              <span className="detail-item__value">{lead.email}</span>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Property Details */}
        <div className="detail-section">
          <div className="detail-section__title">Property</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Roof Type</span>
              <span className="detail-item__value">{lead.roofType}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Size</span>
              <span className="detail-item__value">{lead.sqft.toLocaleString()} sq ft</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Stories</span>
              <span className="detail-item__value">{lead.stories}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Rep</span>
              <span className="detail-item__value">{lead.rep}</span>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Storm Context */}
        <div className="detail-section">
          <div className="detail-section__title">Storm & Insurance</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Hail Size</span>
              <span className="detail-item__value">{lead.hailSize}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Storm Date</span>
              <span className="detail-item__value">{lead.stormDate}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Insurance</span>
              <span className="detail-item__value">{lead.insuranceCo}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Claim #</span>
              <span className="detail-item__value">{lead.claimNumber || '—'}</span>
            </div>
          </div>
          <div className="detail-notes">{lead.damageNotes}</div>
        </div>

        <div className="divider" />

        {/* Activity Timeline */}
        <div className="detail-section">
          <div className="detail-section__title">Activity</div>
          <div className="timeline">
            {mockTimeline.map((item, i) => (
              <div key={i} className="timeline-item">
                <span className="timeline-item__text">{item.text}</span>
                <span className="timeline-item__time">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="divider" />

        {/* Quick Actions */}
        <div className="detail-section">
          <div className="detail-section__title">Quick Actions</div>
          <div className="quick-actions">
            <button className="quick-action-btn"><IconPhone /> Call</button>
            <button className="quick-action-btn"><IconMail /> Email</button>
            <button className="quick-action-btn"><IconCalendar /> Schedule</button>
            <button className="quick-action-btn"><IconClipboard /> Add Note</button>
            <button className="quick-action-btn"><IconDollar /> Estimate</button>
            <button className="quick-action-btn"><IconCamera /> Photos</button>
            <button className="quick-action-btn"><IconSend /> SMS</button>
            <button className="quick-action-btn"><IconX /> Close Lead</button>
          </div>
        </div>
      </div>
    </>
  );
}
