import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckIcon } from '@heroicons/react/24/outline';

// Keys must be `lead_stage` enum values. `completed` is a WORK ORDER status, not a lead
// stage, so its "Job Complete" milestone could never be reached and every customer's
// timeline was permanently one step short of the end. `lost` and `on_hold` are real
// stages but are deliberately not customer-facing milestones - see currentIdx below.
const STAGE_LABELS = {
  new: 'Lead Received',
  contacted: 'Initial Contact',
  appt_set: 'Inspection Scheduled',
  inspected: 'Inspection Complete',
  estimate_sent: 'Estimate Sent',
  negotiating: 'In Review',
  sold: 'Contract Signed',
  in_production: 'In Production',
};

const STAGE_ORDER = Object.keys(STAGE_LABELS);

export default function ClientStatusPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`/api/leads/status/public/${token}`)
      .then(res => setData(res.data))
      .catch(() => setError('Status page not found or link has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.loadingPulse}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>!</div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: 'oklch(0.9 0 0)', marginBottom: 8 }}>
              Page Not Found
            </h1>
            <div style={{ fontSize: 14, color: 'oklch(0.65 0 0)' }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  const { companyName, customer, currentStage, stageHistory, workOrder, milestones } = data;

  // Build a set of stages the lead has passed through, from the status_change activities.
  // The endpoint (routes/leads.js:55) selects `subject, notes, created_at` - it has never
  // sent a `description`, so reading that field left this map permanently empty and no
  // milestone ever showed its date. The stored subject reads "Status changed from New to
  // Contacted" / "Status changed to Lost — went with competitor", so anchor on the last
  // " to " and take the whole stage name: a `(\w+)` capture stopped at the first word and
  // turned "Appt Set" into "appt", which matches no stage key.
  const stageHistoryDates = {};
  for (const entry of stageHistory) {
    const text = entry.subject || entry.notes || '';
    const match = text.match(/\bto\s+([A-Za-z][A-Za-z ]*?)\s*(?:[—–-]|$)/i);
    if (match) {
      const stage = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      if (!stageHistoryDates[stage]) {
        stageHistoryDates[stage] = entry.created_at;
      }
    }
  }

  // Current stage index. `lost` and `on_hold` are off the customer-facing pipeline, so
  // indexOf returns -1 for them and `idx <= currentIdx` was false for every step - a lead
  // that reached Contract Signed and then went on hold showed the customer a timeline
  // claiming nothing had happened yet. Fall back to the furthest stage actually reached.
  const reachedIdx = Object.keys(stageHistoryDates)
    .reduce((max, s) => Math.max(max, STAGE_ORDER.indexOf(s)), -1);
  const currentIdx = Math.max(STAGE_ORDER.indexOf(currentStage), reachedIdx);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.companyName}>{companyName}</h1>
          <div style={styles.subtitle}>Project Status</div>
        </div>

        {/* Customer info */}
        <div style={styles.customerSection}>
          <div style={styles.customerName}>{customer.name || 'Customer'}</div>
          {customer.address && (
            <div style={styles.customerAddress}>{customer.address}</div>
          )}
        </div>

        <div style={styles.divider} />

        {/* Stage Timeline */}
        <div style={styles.sectionTitle}>Progress Timeline</div>
        <div style={styles.timeline}>
          {STAGE_ORDER.map((stage, idx) => {
            const isPast = idx <= currentIdx;
            const isCurrent = stage === currentStage;
            const date = stageHistoryDates[stage];

            return (
              <div key={stage} style={styles.timelineItem}>
                {/* Connector line */}
                {idx > 0 && (
                  <div style={{
                    ...styles.timelineConnector,
                    background: isPast
                      ? 'oklch(0.65 0.2 145)'
                      : 'oklch(0.3 0 0)',
                  }} />
                )}
                {/* Dot */}
                <div style={{
                  ...styles.timelineDot,
                  background: isCurrent
                    ? 'oklch(0.7 0.2 145)'
                    : isPast
                      ? 'oklch(0.55 0.15 145)'
                      : 'oklch(0.3 0.02 250)',
                  boxShadow: isCurrent
                    ? '0 0 12px oklch(0.7 0.2 145 / 0.5)'
                    : 'none',
                  transform: isCurrent ? 'scale(1.3)' : 'scale(1)',
                }}>
                  {isPast && (
                    <CheckIcon style={{ width: 12, height: 12, color: 'oklch(1 0 0)', strokeWidth: 3 }} />
                  )}
                </div>
                {/* Label + date */}
                <div style={styles.timelineContent}>
                  <div style={{
                    ...styles.timelineLabel,
                    color: isCurrent
                      ? 'oklch(0.95 0 0)'
                      : isPast
                        ? 'oklch(0.75 0 0)'
                        : 'oklch(0.45 0 0)',
                    fontWeight: isCurrent ? 700 : 500,
                  }}>
                    {STAGE_LABELS[stage]}
                    {isCurrent && (
                      <span style={styles.currentBadge}>Current</span>
                    )}
                  </div>
                  {date && (
                    <div style={styles.timelineDate}>
                      {new Date(date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Work Order / Milestones */}
        {workOrder && (
          <>
            <div style={styles.divider} />
            <div style={styles.sectionTitle}>Work Order</div>
            <div style={styles.workOrderCard}>
              <div style={styles.workOrderTitle}>{workOrder.title || 'Untitled'}</div>
              <div style={styles.workOrderMeta}>
                <span style={{
                  ...styles.woStatusBadge,
                  background: workOrder.status === 'completed'
                    ? 'oklch(0.45 0.12 145 / 0.3)'
                    : workOrder.status === 'in_progress'
                      ? 'oklch(0.5 0.12 250 / 0.3)'
                      : 'oklch(0.4 0.05 250 / 0.3)',
                  color: workOrder.status === 'completed'
                    ? 'oklch(0.8 0.15 145)'
                    : workOrder.status === 'in_progress'
                      ? 'oklch(0.8 0.15 250)'
                      : 'oklch(0.7 0.05 250)',
                }}>
                  {(workOrder.status || 'pending').replace(/_/g, ' ')}
                </span>
                {workOrder.scheduled_date && (
                  <span style={styles.woDate}>
                    Scheduled: {new Date(workOrder.scheduled_date).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>

            {milestones.length > 0 && (
              <div style={styles.milestoneList}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.7 0 0)', marginBottom: 8 }}>
                  Milestones
                </div>
                {milestones.map(ms => (
                  <div key={ms.id} style={styles.milestoneItem}>
                    <div style={{
                      ...styles.milestoneCheck,
                      background: ms.completed
                        ? 'oklch(0.55 0.15 145)'
                        : 'transparent',
                      borderColor: ms.completed
                        ? 'oklch(0.55 0.15 145)'
                        : 'oklch(0.4 0 0)',
                    }}>
                      {ms.completed && (
                        <CheckIcon style={{ width: 10, height: 10, color: 'oklch(1 0 0)', strokeWidth: 3 }} />
                      )}
                    </div>
                    <span style={{
                      color: ms.completed ? 'oklch(0.7 0 0)' : 'oklch(0.55 0 0)',
                      textDecoration: ms.completed ? 'line-through' : 'none',
                    }}>
                      {ms.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          Powered by StormLeads
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'oklch(0.13 0.02 260)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    background: 'oklch(0.18 0.02 260 / 0.7)',
    backdropFilter: 'blur(40px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
    border: '1px solid oklch(1 0 0 / 0.08)',
    borderRadius: 20,
    padding: '32px 28px',
    boxShadow: '0 8px 32px oklch(0 0 0 / 0.4)',
  },
  loadingPulse: {
    textAlign: 'center',
    padding: '60px 20px',
    fontSize: 15,
    color: 'oklch(0.6 0 0)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  header: {
    textAlign: 'center',
    marginBottom: 24,
  },
  companyName: {
    fontSize: 22,
    fontWeight: 700,
    color: 'oklch(0.95 0 0)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 13,
    color: 'oklch(0.55 0 0)',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 600,
  },
  customerSection: {
    textAlign: 'center',
    marginBottom: 20,
  },
  customerName: {
    fontSize: 17,
    fontWeight: 600,
    color: 'oklch(0.85 0 0)',
  },
  customerAddress: {
    fontSize: 13,
    color: 'oklch(0.55 0 0)',
    marginTop: 4,
  },
  divider: {
    height: 1,
    background: 'oklch(1 0 0 / 0.06)',
    margin: '20px 0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'oklch(0.75 0 0)',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  timeline: {
    position: 'relative',
    paddingLeft: 0,
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'flex-start',
    position: 'relative',
    paddingBottom: 20,
    paddingLeft: 36,
    minHeight: 36,
  },
  timelineConnector: {
    position: 'absolute',
    left: 10,
    top: -10,
    width: 2,
    height: 'calc(100%)',
    zIndex: 0,
  },
  timelineDot: {
    position: 'absolute',
    left: 2,
    top: 2,
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    transition: 'all 0.2s ease',
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  currentBadge: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    background: 'oklch(0.65 0.2 145 / 0.25)',
    color: 'oklch(0.8 0.2 145)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  timelineDate: {
    fontSize: 12,
    color: 'oklch(0.5 0 0)',
    marginTop: 2,
  },
  workOrderCard: {
    background: 'oklch(0.15 0.02 260 / 0.6)',
    border: '1px solid oklch(1 0 0 / 0.06)',
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 12,
  },
  workOrderTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'oklch(0.85 0 0)',
    marginBottom: 8,
  },
  workOrderMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  woStatusBadge: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'capitalize',
    padding: '3px 10px',
    borderRadius: 6,
  },
  woDate: {
    fontSize: 12,
    color: 'oklch(0.55 0 0)',
  },
  milestoneList: {
    marginTop: 8,
  },
  milestoneItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 0',
    fontSize: 13,
  },
  milestoneCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  footer: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 11,
    color: 'oklch(0.4 0 0)',
    letterSpacing: '0.04em',
  },
};
