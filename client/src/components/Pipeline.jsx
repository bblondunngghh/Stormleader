import { useState, useEffect, useCallback } from 'react';
import { getLeads, getPipelineStages, updateLead } from '../api/crm';
import LeadDetail from './LeadDetail';

function cleanAddr(str) {
  if (!str) return '';
  return str.replace(/[\s,]+$/, '').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
}
function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
function formatOwner(raw) {
  if (!raw?.trim()) return '';
  const upper = raw.toUpperCase();
  const bizWords = ['LLC', 'INC', 'CORP', 'TRUST', 'ESTATE', 'LTD', 'PARTNERSHIP', 'LP', 'LLP', 'CHURCH', 'ASSOCIATION'];
  if (bizWords.some(w => upper.includes(w))) return titleCase(raw);
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2) {
    const lastName = parts[0];
    const rest = parts.slice(1).join(' ');
    return titleCase(rest + ' ' + lastName);
  }
  return titleCase(raw);
}

const fallbackColumns = [
  { key: 'new', label: 'New', color: 'oklch(0.72 0.19 250)', position: 0 },
  { key: 'contacted', label: 'Contacted', color: 'oklch(0.75 0.15 200)', position: 1 },
  { key: 'appt_set', label: 'Appt Set', color: 'oklch(0.78 0.17 85)', position: 2 },
  { key: 'inspected', label: 'Inspected', color: 'oklch(0.72 0.20 50)', position: 3 },
  { key: 'estimate_sent', label: 'Estimate Sent', color: 'oklch(0.70 0.18 330)', position: 4 },
  { key: 'negotiating', label: 'Negotiating', color: 'oklch(0.65 0.15 280)', position: 5 },
  { key: 'sold', label: 'Sold', color: 'oklch(0.75 0.18 155)', position: 6 },
];

export default function Pipeline() {
  const [columns, setColumns] = useState(fallbackColumns);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [dragState, setDragState] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [stagesRes, leadsRes] = await Promise.all([
        getPipelineStages().catch(() => null),
        getLeads({ limit: 200, sort_by: 'created_at', sort_dir: 'DESC' }),
      ]);

      const stageData = stagesRes?.data?.stages || stagesRes?.data;
      if (Array.isArray(stageData) && stageData.length) {
        setColumns(stageData.filter(s => s.key !== 'lost'));
      }

      setLeads(leadsRes.data.leads || []);
    } catch {
      // fallback columns already set
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDragStart = (e, lead) => {
    setDragState({ leadId: lead.id, fromStage: lead.stage });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead.id);
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDragState(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, toStage) => {
    e.preventDefault();
    if (!dragState || dragState.fromStage === toStage) return;

    const leadId = dragState.leadId;

    // Optimistic update
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, stage: toStage } : l
    ));

    try {
      await updateLead(leadId, { stage: toStage });
    } catch {
      // Revert on error
      fetchData();
    }
    setDragState(null);
  };

  const handleLeadUpdated = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="main-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading pipeline...</span>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ paddingBottom: 0 }}>
      <div className="kanban">
        {columns.map((col) => {
          const colLeads = leads.filter((l) => l.stage === col.key);
          const isDropTarget = dragState && dragState.fromStage !== col.key;

          return (
            <div
              key={col.key}
              className="kanban-column"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
              style={isDropTarget ? { outline: `2px dashed ${col.color}`, outlineOffset: -2, borderRadius: 'var(--radius-md)' } : undefined}
            >
              <div className="kanban-column__header">
                <span className="kanban-column__dot" style={{ background: col.color }} />
                <span className="kanban-column__title">{col.label}</span>
                <span className="kanban-column__count">{colLeads.length}</span>
              </div>
              <div className="kanban-column__cards">
                {colLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="lead-card glass"
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedLeadId(lead.id)}
                  >
                    <div className="lead-card__top">
                      <span className={`lead-card__priority lead-card__priority--${lead.priority}`} />
                      {lead.estimated_value && (
                        <span className="lead-card__value">
                          ${(Number(lead.estimated_value) / 1000).toFixed(1)}K
                        </span>
                      )}
                    </div>
                    {lead.address && (() => {
                      const city = lead.city?.trim() || '';
                      const st = (lead.property_state || lead.state || '').trim();
                      const zip = (lead.property_zip || lead.zip || '').trim();
                      const cityLine = [city ? titleCase(city) : '', st, zip && zip !== '0' ? zip : ''].filter(Boolean).join(', ').replace(/, (\d)/, ' $1');
                      return (
                        <div className="lead-card__address">
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Address</div>
                          <div>{titleCase(cleanAddr(lead.address))}</div>
                          {cityLine && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cityLine}</div>}
                        </div>
                      );
                    })()}
                    {lead.contact_name && (
                      <div className="lead-card__name">
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Owner</div>
                        {formatOwner(lead.contact_name)}
                      </div>
                    )}
                    <div className="lead-card__footer">
                      {lead.hail_size_in && (
                        <span className="lead-card__hail">
                          {`\u{1F9CA} ${lead.hail_size_in}"`}
                        </span>
                      )}
                      {lead.rep_first_name && (
                        <span className="lead-card__rep">
                          {lead.rep_first_name[0]}{lead.rep_last_name?.[0] || ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedLeadId && (
        <LeadDetail
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdated={handleLeadUpdated}
        />
      )}
    </div>
  );
}
