import { useState } from 'react';
import { pipelineColumns, leads } from '../data/mockData';
import LeadDetail from './LeadDetail';

export default function Pipeline() {
  const [selectedLead, setSelectedLead] = useState(null);

  return (
    <div className="main-content" style={{ paddingBottom: 0 }}>
      <div className="kanban">
        {pipelineColumns.map((col) => {
          const colLeads = leads.filter((l) => l.stage === col.id);
          return (
            <div key={col.id} className="kanban-column">
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
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="lead-card__top">
                      <span className={`lead-card__priority lead-card__priority--${lead.priority}`} />
                      <span className="lead-card__value">${(lead.value / 1000).toFixed(1)}K</span>
                    </div>
                    <div className="lead-card__address">{lead.address}</div>
                    <div className="lead-card__name">{lead.name}</div>
                    <div className="lead-card__footer">
                      <span className="lead-card__hail">🧊 {lead.hailSize}</span>
                      <span className="lead-card__rep">{lead.rep}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedLead && (
        <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
    </div>
  );
}
