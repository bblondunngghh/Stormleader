import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { generateContent, generateContentBatch, getContentLibrary, saveContentToLibrary, deleteContentFromLibrary } from '../api/crm';
import { showToast } from './Toast';
import CustomSelect from './CustomSelect';
import { SparklesIcon, ClipboardDocumentIcon, ArrowPathIcon, BookmarkIcon, FolderOpenIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';

const CONTENT_TYPES = [
  { value: 'social_post', label: 'Social Posts', icon: 'share', description: 'Facebook, Instagram, LinkedIn posts' },
  { value: 'door_hanger', label: 'Door Hangers', icon: 'doorbell', description: 'Leave-behind flyers for neighborhoods' },
  { value: 'email_template', label: 'Email Templates', icon: 'mail', description: 'Follow-ups, drip campaigns, outreach' },
  { value: 'blog_outline', label: 'Blog Outlines', icon: 'article', description: 'SEO-friendly blog post structures' },
  { value: 'ad_copy', label: 'Ad Copy', icon: 'campaign', description: 'Google Ads, Facebook Ads headlines' },
  { value: 'cold_call_script', label: 'Cold Call Scripts', icon: 'call', description: 'Phone scripts with objection handling' },
  { value: 'landing_page', label: 'Landing Pages', icon: 'web', description: 'Storm response landing page copy' },
];

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'urgent', label: 'Urgent / Storm Response' },
  { value: 'seasonal', label: 'Seasonal' },
];

function getCurrentSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'Spring';
  if (m >= 5 && m <= 7) return 'Summer';
  if (m >= 8 && m <= 10) return 'Fall';
  return 'Winter';
}

const VARIABLE_FIELDS = [
  { key: 'company', label: 'Company Name', placeholder: 'Acme Roofing' },
  { key: 'city', label: 'City', placeholder: 'Dallas' },
  { key: 'state', label: 'State', placeholder: 'TX' },
  { key: 'storm_date', label: 'Storm Date', placeholder: 'March 15, 2026' },
  { key: 'hail_size', label: 'Hail Size (inches)', placeholder: '1.75' },
  { key: 'service', label: 'Service Type', placeholder: 'roof replacement' },
  { key: 'phone', label: 'Phone', placeholder: '(555) 123-4567' },
  { key: 'website', label: 'Website', placeholder: 'www.acmeroofing.com' },
  { key: 'first_name', label: 'Customer First Name', placeholder: 'John' },
  { key: 'season', label: 'Season', placeholder: getCurrentSeason() },
];

const LIBRARY_KEY = 'stormleads_content_library';

function loadLibrary() {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
  } catch { return []; }
}

function saveLibrary(items) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
}

function formatContent(content) {
  if (typeof content === 'string') return content;
  if (!content) return '';

  // Door hanger
  if (content.front && content.back) {
    return `FRONT:\n${content.front}\n\nBACK:\n${content.back}`;
  }
  // Email
  if (content.subject && content.body) {
    return `SUBJECT: ${content.subject}\n\n${content.body}`;
  }
  // Blog outline
  if (content.title && content.sections) {
    return `${content.title}\n\n${content.sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  }
  // Ad copy
  if (content.headline && content.description) {
    return `HEADLINE: ${content.headline}\n\nDESCRIPTION: ${content.description}`;
  }
  return JSON.stringify(content, null, 2);
}

function ContentCard({ item, index, onSave, onDelete, isSaved }) {
  const text = formatContent(item.content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  return (
    <div className="content-studio__card glass">
      {index !== undefined && (
        <div className="content-studio__card-badge">#{index + 1}</div>
      )}
      {item.type && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '2px 8px', borderRadius: 999,
            background: 'oklch(0.72 0.19 250 / 0.12)', color: 'oklch(0.72 0.19 250)',
          }}>
            {CONTENT_TYPES.find(t => t.value === item.type)?.label || item.type}
          </span>
          {item.tone && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: 'oklch(0.55 0.02 260 / 0.2)', color: 'var(--text-muted)',
            }}>
              {TONES.find(t => t.value === item.tone)?.label || item.tone}
            </span>
          )}
          {item.savedAt && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {new Date(item.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      )}
      <pre className="content-studio__card-text">{text}</pre>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="content-studio__copy-btn" onClick={handleCopy} title="Copy to clipboard">
          <ClipboardDocumentIcon width={16} height={16} />
          Copy
        </button>
        {onSave && (
          <button
            className="content-studio__copy-btn"
            onClick={() => onSave(item)}
            title={isSaved ? 'Already saved' : 'Save to library'}
            style={isSaved ? { opacity: 0.5, cursor: 'default' } : {}}
            disabled={isSaved}
          >
            {isSaved
              ? <><BookmarkSolidIcon width={16} height={16} /> Saved</>
              : <><BookmarkIcon width={16} height={16} /> Save</>
            }
          </button>
        )}
        {onDelete && (
          <button
            className="content-studio__copy-btn"
            onClick={() => onDelete(item)}
            title="Remove from library"
            style={{ color: 'oklch(0.68 0.22 25)' }}
          >
            <TrashIcon width={16} height={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LIVE PREVIEW MOCKUPS (Rooftops.ai competitive feature)
// ============================================================
function SocialPostPreview({ content, variables, type }) {
  const text = typeof content === 'string' ? content : formatContent(content);
  const companyName = variables.company || 'Your Company';
  const isFacebook = type === 'social_post' || type === 'ad_copy';

  return (
    <div style={{
      background: 'oklch(0.98 0 0)', borderRadius: 12, overflow: 'hidden',
      color: 'oklch(0.15 0 0)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 2px 12px oklch(0 0 0 / 0.08)',
    }}>
      {/* Post header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg, oklch(0.62 0.21 255), oklch(0.72 0.14 200))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 16, fontWeight: 700,
        }}>
          {companyName[0]?.toUpperCase() || 'C'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.15 0 0)' }}>{companyName}</div>
          <div style={{ fontSize: 12, color: 'oklch(0.5 0 0)' }}>Just now · {isFacebook ? 'Public' : 'Sponsored'}</div>
        </div>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="oklch(0.5 0 0)">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </div>
      {/* Post text */}
      <div style={{ padding: '0 16px 12px', fontSize: 14, lineHeight: 1.5, color: 'oklch(0.2 0 0)', whiteSpace: 'pre-wrap' }}>
        {text || 'Your content will appear here...'}
      </div>
      {/* Placeholder image */}
      <div style={{
        height: 200, background: 'linear-gradient(135deg, oklch(0.88 0.05 220), oklch(0.82 0.08 200))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'oklch(0.5 0.05 220)', fontSize: 14, fontWeight: 500,
      }}>
        [Ad Image / Photo]
      </div>
      {/* Engagement bar */}
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid oklch(0.9 0 0)' }}>
        <span style={{ fontSize: 13, color: 'oklch(0.5 0 0)' }}>42 likes</span>
        <span style={{ fontSize: 13, color: 'oklch(0.5 0 0)' }}>12 comments · 5 shares</span>
      </div>
      {/* Action bar */}
      <div style={{ display: 'flex', borderTop: '1px solid oklch(0.9 0 0)', padding: '6px 0' }}>
        {['Like', 'Comment', 'Share'].map(action => (
          <button key={action} style={{
            flex: 1, padding: '8px 0', border: 'none', background: 'none', cursor: 'default',
            fontSize: 13, fontWeight: 600, color: 'oklch(0.45 0 0)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmailPreview({ content, variables }) {
  const companyName = variables.company || 'Your Company';
  let subject = '';
  let body = '';
  if (typeof content === 'object' && content?.subject) {
    subject = content.subject;
    body = content.body || '';
  } else {
    const text = typeof content === 'string' ? content : formatContent(content);
    const match = text.match(/^SUBJECT:\s*(.+?)\n\n([\s\S]*)$/);
    if (match) { subject = match[1]; body = match[2]; }
    else { body = text; subject = 'Storm Damage? Free Roof Inspection'; }
  }

  return (
    <div style={{
      background: 'oklch(0.98 0 0)', borderRadius: 12, overflow: 'hidden',
      color: 'oklch(0.15 0 0)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 2px 12px oklch(0 0 0 / 0.08)',
    }}>
      {/* Email header */}
      <div style={{ padding: '16px', borderBottom: '1px solid oklch(0.9 0 0)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'oklch(0.5 0 0)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>From</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.2 0 0)', marginBottom: 8 }}>{companyName} &lt;info@{(variables.website || 'company.com').replace(/^www\./, '')}&gt;</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'oklch(0.5 0 0)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Subject</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'oklch(0.15 0 0)' }}>{subject || 'Email Subject Line'}</div>
      </div>
      {/* Email body */}
      <div style={{ padding: '16px', fontSize: 14, lineHeight: 1.6, color: 'oklch(0.25 0 0)', whiteSpace: 'pre-wrap', minHeight: 120 }}>
        {body || 'Your email content will appear here...'}
      </div>
    </div>
  );
}

function DoorHangerPreview({ content, variables }) {
  const companyName = variables.company || 'Your Company';
  let front = '';
  let back = '';
  if (typeof content === 'object' && content?.front) {
    front = content.front;
    back = content.back || '';
  } else {
    const text = typeof content === 'string' ? content : formatContent(content);
    const match = text.match(/^FRONT:\n([\s\S]*?)\n\nBACK:\n([\s\S]*)$/);
    if (match) { front = match[1]; back = match[2]; }
    else { front = text; }
  }

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {[{ label: 'Front', text: front }, { label: 'Back', text: back }].map(side => (
        <div key={side.label} style={{
          flex: 1, borderRadius: 10, overflow: 'hidden',
          background: 'oklch(0.98 0 0)', boxShadow: '0 2px 12px oklch(0 0 0 / 0.08)',
          color: 'oklch(0.15 0 0)', fontFamily: '-apple-system, sans-serif',
        }}>
          <div style={{
            padding: '8px 12px', background: 'linear-gradient(135deg, oklch(0.62 0.21 255), oklch(0.72 0.14 200))',
            color: 'white', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            textAlign: 'center',
          }}>{side.label}</div>
          <div style={{ padding: '12px', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', minHeight: 80 }}>
            {side.text || `${side.label} content...`}
          </div>
          {side.label === 'Front' && (
            <div style={{ padding: '6px 12px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'oklch(0.3 0.15 250)' }}>
              {companyName} · {variables.phone || '(555) 123-4567'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ColdCallScriptPreview({ content, variables }) {
  const text = typeof content === 'string' ? content : formatContent(content);
  // Parse script sections (OPENING, HOOK, ASK, OBJECTION, CLOSE, VALUE)
  const sections = [];
  const lines = text.split('\n');
  let current = null;
  for (const line of lines) {
    const match = line.match(/^(OPENING|HOOK|ASK|OBJECTION[^:]*|CLOSE|VALUE):\s*(.*)/);
    if (match) {
      current = { label: match[1], text: match[2] };
      sections.push(current);
    } else if (current && line.trim()) {
      current.text += '\n' + line;
    }
  }
  const sectionColors = {
    OPENING: 'oklch(0.72 0.19 250)',
    HOOK: 'oklch(0.78 0.17 85)',
    ASK: 'oklch(0.75 0.18 155)',
    CLOSE: 'oklch(0.68 0.22 25)',
    VALUE: 'oklch(0.70 0.15 200)',
  };
  return (
    <div style={{
      background: 'oklch(0.12 0.02 260)', borderRadius: 12, padding: 20,
      color: 'oklch(0.90 0 0)', fontFamily: '-apple-system, sans-serif',
      boxShadow: '0 2px 12px oklch(0 0 0 / 0.2)', minHeight: 120,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>📞</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Cold Call Script — {variables.company || 'Your Company'}</span>
      </div>
      {sections.length > 0 ? sections.map((sec, i) => {
        const baseLabel = sec.label.startsWith('OBJECTION') ? 'OBJECTION' : sec.label;
        const color = sectionColors[baseLabel] || 'oklch(0.65 0.10 260)';
        return (
          <div key={i} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: `3px solid ${color}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 4 }}>{sec.label}</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'oklch(0.85 0 0)' }}>{sec.text.replace(/^"|"$/g, '')}</div>
          </div>
        );
      }) : (
        <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text || 'Your script will appear here...'}</div>
      )}
    </div>
  );
}

function LandingPagePreview({ content, variables }) {
  const companyName = variables.company || 'Your Company';
  let headline = '', subheadline = '', cta = '', body = '', testimonial = '';
  if (typeof content === 'object' && content?.headline) {
    headline = content.headline;
    subheadline = content.subheadline || '';
    cta = content.cta || 'Get Started';
    body = content.body || '';
    testimonial = content.testimonial || '';
  } else {
    body = typeof content === 'string' ? content : formatContent(content);
  }
  return (
    <div style={{
      background: 'linear-gradient(180deg, oklch(0.15 0.04 250), oklch(0.10 0.02 260))',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 2px 12px oklch(0 0 0 / 0.2)', minHeight: 120,
      fontFamily: '-apple-system, sans-serif',
    }}>
      {/* Hero section */}
      <div style={{ padding: '32px 24px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.72 0.19 250)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{companyName}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'oklch(0.95 0 0)', margin: '0 0 8px', lineHeight: 1.3 }}>{headline || 'Your Headline Here'}</h2>
        {subheadline && <p style={{ fontSize: 14, color: 'oklch(0.70 0 0)', margin: '0 0 16px', lineHeight: 1.5 }}>{subheadline}</p>}
        <button style={{
          padding: '10px 24px', fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none',
          background: 'oklch(0.72 0.19 250)', color: 'white', cursor: 'default',
        }}>{cta || 'Get Started'}</button>
      </div>
      {/* Body */}
      {body && (
        <div style={{ padding: '0 24px 20px', fontSize: 13, lineHeight: 1.7, color: 'oklch(0.80 0 0)', whiteSpace: 'pre-wrap' }}>
          {body.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 700, color: 'oklch(0.92 0 0)', marginTop: 12, marginBottom: 4 }}>{line.replace(/\*\*/g, '')}</div>;
            if (line.startsWith('✅') || line.startsWith('-')) return <div key={i} style={{ paddingLeft: 8 }}>{line}</div>;
            return <div key={i}>{line}</div>;
          })}
        </div>
      )}
      {/* Testimonial */}
      {testimonial && (
        <div style={{ padding: '16px 24px', background: 'oklch(0.18 0.03 250)', borderTop: '1px solid oklch(0.25 0.02 260)' }}>
          <p style={{ fontSize: 12, fontStyle: 'italic', color: 'oklch(0.70 0 0)', margin: 0, lineHeight: 1.5 }}>{testimonial}</p>
        </div>
      )}
    </div>
  );
}

function GenericPreview({ content, type }) {
  const text = typeof content === 'string' ? content : formatContent(content);
  const typeLabel = CONTENT_TYPES.find(t => t.value === type)?.label || type;
  return (
    <div style={{
      background: 'oklch(0.98 0 0)', borderRadius: 12, padding: 20,
      color: 'oklch(0.15 0 0)', fontFamily: '-apple-system, sans-serif',
      boxShadow: '0 2px 12px oklch(0 0 0 / 0.08)', minHeight: 120,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.5 0 0)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        {typeLabel} Preview
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {text || 'Your content will appear here...'}
      </div>
    </div>
  );
}

function LivePreviewPanel({ content, type, variables }) {
  const previewMap = {
    social_post: SocialPostPreview,
    ad_copy: SocialPostPreview,
    email_template: EmailPreview,
    door_hanger: DoorHangerPreview,
    blog_outline: GenericPreview,
    cold_call_script: ColdCallScriptPreview,
    landing_page: LandingPagePreview,
  };
  const PreviewComponent = previewMap[type] || GenericPreview;

  return (
    <div style={{
      padding: 16, borderRadius: 14,
      background: 'oklch(0.14 0.01 260 / 0.6)',
      border: '1px solid oklch(1 0 0 / 0.06)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        Live Preview
      </div>
      <PreviewComponent content={content} type={type} variables={variables} />
    </div>
  );
}

export default function ContentStudio() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' | 'library'
  const [type, setType] = useState('social_post');
  const [tone, setTone] = useState('professional');
  const [variables, setVariables] = useState(() => ({
    company: '',
    city: '',
    state: '',
    storm_date: '',
    hail_size: '',
    service: 'roof replacement',
    phone: '',
    website: '',
    first_name: '',
    season: getCurrentSeason(),
  }));
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [batchMode, setBatchMode] = useState(false);

  // Library state — persisted to DB, with localStorage fallback for migration
  const [library, setLibrary] = useState([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryTypeFilter, setLibraryTypeFilter] = useState('');
  const [savedIds, setSavedIds] = useState(new Set());

  // Load library from DB on mount; migrate localStorage items if any
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getContentLibrary({ limit: 500 });
        if (cancelled) return;
        const dbItems = (data.items || []).map(i => ({
          id: i.id,
          content: typeof i.content === 'string' ? JSON.parse(i.content) : i.content,
          type: i.content_type,
          tone: i.tone,
          savedAt: i.saved_at,
        }));
        setLibrary(dbItems);

        // Migrate localStorage items to DB (one-time)
        const localRaw = localStorage.getItem(LIBRARY_KEY);
        if (localRaw) {
          try {
            const localItems = JSON.parse(localRaw);
            if (Array.isArray(localItems) && localItems.length > 0) {
              for (const item of localItems) {
                await saveContentToLibrary({ content: item.content, content_type: item.type, tone: item.tone });
              }
              localStorage.removeItem(LIBRARY_KEY);
              // Re-fetch after migration
              const { data: refreshed } = await getContentLibrary({ limit: 500 });
              if (!cancelled) {
                setLibrary((refreshed.items || []).map(i => ({
                  id: i.id,
                  content: typeof i.content === 'string' ? JSON.parse(i.content) : i.content,
                  type: i.content_type,
                  tone: i.tone,
                  savedAt: i.saved_at,
                })));
              }
            }
          } catch { /* localStorage parse error — ignore */ }
        }
      } catch {
        // DB unavailable — fall back to localStorage
        setLibrary(loadLibrary());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredLibrary = useMemo(() => {
    let items = library;
    if (libraryTypeFilter) items = items.filter(i => i.type === libraryTypeFilter);
    if (librarySearch) {
      const q = librarySearch.toLowerCase();
      items = items.filter(i => {
        const text = formatContent(i.content).toLowerCase();
        return text.includes(q);
      });
    }
    return items;
  }, [library, librarySearch, libraryTypeFilter]);

  const updateVar = useCallback((key, val) => {
    setVariables(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setSavedIds(new Set());
    try {
      if (batchMode) {
        const { data } = await generateContentBatch({ type, tone, variables, count: 5 });
        setResults((data.results || []).map((r, i) => ({ ...r, type, tone, _idx: i })));
      } else {
        const { data } = await generateContent({ type, tone, variables });
        setResults([{ ...data, type, tone, _idx: 0 }]);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Generation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToLibrary = async (item) => {
    try {
      const { data: saved } = await saveContentToLibrary({
        content: item.content,
        content_type: item.type || type,
        tone: item.tone || tone,
      });
      const entry = {
        id: saved.id,
        content: typeof saved.content === 'string' ? JSON.parse(saved.content) : saved.content,
        type: saved.content_type,
        tone: saved.tone,
        savedAt: saved.saved_at,
      };
      setLibrary(prev => [entry, ...prev]);
      setSavedIds(prev => new Set(prev).add(item._idx));
      showToast('Saved to library', 'success');
    } catch {
      showToast('Failed to save', 'error');
    }
  };

  const handleDeleteFromLibrary = async (item) => {
    try {
      await deleteContentFromLibrary(item.id);
      setLibrary(prev => prev.filter(i => i.id !== item.id));
      showToast('Removed from library', 'success');
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const libraryTypeOptions = [
    { value: '', label: 'All Types' },
    ...CONTENT_TYPES,
  ];

  return (
    <div className="main-content content-studio">
      {/* Header */}
      <div className="content-studio__header">
        <div className="content-studio__title">
          <SparklesIcon width={28} height={28} className="content-studio__title-icon" />
          <h1>AI Content Studio</h1>
        </div>
        <p className="content-studio__subtitle">
          Generate marketing content for your roofing business — social posts, door hangers, emails, blog outlines, and ad copy.
        </p>
        {/* Tab Switcher */}
        <div style={{
          display: 'flex', gap: 4, marginTop: 16,
          background: 'oklch(0.12 0.02 260 / 0.5)', borderRadius: 10, padding: 3, width: 'fit-content',
        }}>
          <button
            onClick={() => setActiveTab('generate')}
            style={{
              padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: activeTab === 'generate' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'generate' ? 'oklch(0.15 0.04 200)' : 'var(--text-muted)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <SparklesIcon width={15} height={15} />
            Generate
          </button>
          <button
            onClick={() => setActiveTab('library')}
            style={{
              padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: activeTab === 'library' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'library' ? 'oklch(0.15 0.04 200)' : 'var(--text-muted)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <FolderOpenIcon width={15} height={15} />
            Library
            {library.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
                background: activeTab === 'library' ? 'oklch(0.15 0.04 200 / 0.3)' : 'oklch(0.72 0.19 250 / 0.2)',
                color: activeTab === 'library' ? 'oklch(0.15 0.04 200)' : 'oklch(0.72 0.19 250)',
              }}>
                {library.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* GENERATE TAB */}
      {activeTab === 'generate' && (
        <div className="content-studio__body">
          {/* Controls panel */}
          <div className="content-studio__controls glass">
            <h3 className="content-studio__section-title">Content Settings</h3>

            <div className="content-studio__field">
              <label>Content Type</label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 'var(--space-sm)',
              }}>
                {CONTENT_TYPES.map((ct) => {
                  const selected = type === ct.value;
                  return (
                    <button
                      key={ct.value}
                      type="button"
                      onClick={() => setType(ct.value)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 6,
                        padding: 'var(--space-md)',
                        background: 'oklch(0.16 0.02 260 / 0.4)',
                        border: `1px solid ${selected ? 'var(--accent-blue)' : 'var(--glass-border)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        boxShadow: selected ? '0 0 12px oklch(0.72 0.19 250 / 0.2)' : 'none',
                        transition: 'all 0.15s ease',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 22,
                          color: selected ? 'var(--accent-blue)' : 'var(--text-muted)',
                          transition: 'color 0.15s ease',
                        }}
                      >
                        {ct.icon}
                      </span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        lineHeight: 1.2,
                      }}>
                        {ct.label}
                      </span>
                      <span style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        lineHeight: 1.3,
                      }}>
                        {ct.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="content-studio__field">
              <label>Tone</label>
              <CustomSelect
                value={tone}
                onChange={setTone}
                options={TONES}
                style={{ width: '100%' }}
              />
            </div>

            <h3 className="content-studio__section-title" style={{ marginTop: 20 }}>Variables</h3>

            <div className="content-studio__vars">
              {VARIABLE_FIELDS.map(({ key, label, placeholder }) => (
                <div className="content-studio__var-field" key={key}>
                  <label>{label}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={variables[key]}
                    onChange={(e) => updateVar(key, e.target.value)}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>

            <div className="content-studio__batch-toggle">
              <label className="content-studio__toggle-label">
                <input
                  type="checkbox"
                  checked={batchMode}
                  onChange={(e) => setBatchMode(e.target.checked)}
                />
                <span>Generate 5 variations</span>
              </label>
            </div>

            <button
              className="content-studio__generate-btn"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="storm-map-loading__spinner" style={{ width: 16, height: 16 }} />
                  Generating...
                </>
              ) : (
                <>
                  <SparklesIcon width={18} height={18} />
                  {batchMode ? 'Generate 5 Variations' : 'Generate Content'}
                </>
              )}
            </button>
          </div>

          {/* Results + Live Preview panel */}
          <div className="content-studio__results">
            {/* Live Preview for latest result */}
            {results.length > 0 && (
              <LivePreviewPanel
                content={results[0]?.content}
                type={type}
                variables={variables}
              />
            )}

            {results.length === 0 && !loading && (
              <div className="content-studio__empty glass">
                <SparklesIcon width={48} height={48} style={{ opacity: 0.3 }} />
                <p>Your generated content will appear here</p>
                <span>Select a content type and tone, fill in your variables, then hit Generate</span>
              </div>
            )}

            {results.length > 0 && (
              <>
                <div className="content-studio__results-header">
                  <h3>
                    {results.length} {results.length === 1 ? 'Result' : 'Results'}
                    <span className="content-studio__results-meta">
                      {CONTENT_TYPES.find(t => t.value === type)?.label} &middot; {TONES.find(t => t.value === tone)?.label}
                    </span>
                  </h3>
                  <button className="content-studio__regen-btn" onClick={handleGenerate} disabled={loading}>
                    <ArrowPathIcon width={16} height={16} />
                    Regenerate
                  </button>
                </div>
                {results.map((item, i) => (
                  <ContentCard
                    key={i}
                    item={item}
                    index={batchMode ? i : undefined}
                    onSave={handleSaveToLibrary}
                    isSaved={savedIds.has(item._idx)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* LIBRARY TAB */}
      {activeTab === 'library' && (
        <div className="content-studio__body" style={{ flexDirection: 'column' }}>
          {/* Library toolbar */}
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
            padding: '0 0 16px',
          }}>
            <div style={{
              flex: 1, minWidth: 200, position: 'relative',
            }}>
              <MagnifyingGlassIcon width={16} height={16} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }} />
              <input
                className="form-input"
                type="text"
                placeholder="Search saved content..."
                value={librarySearch}
                onChange={e => setLibrarySearch(e.target.value)}
                style={{ paddingLeft: 36, width: '100%' }}
              />
            </div>
            <CustomSelect
              value={libraryTypeFilter}
              onChange={setLibraryTypeFilter}
              options={libraryTypeOptions}
              placeholder="All Types"
              style={{ minWidth: 160 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              {filteredLibrary.length} item{filteredLibrary.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Library items */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}>
            {filteredLibrary.length === 0 && (
              <div className="content-studio__empty glass" style={{ gridColumn: '1 / -1' }}>
                <FolderOpenIcon width={48} height={48} style={{ opacity: 0.3 }} />
                <p>{library.length === 0 ? 'Your content library is empty' : 'No matching content'}</p>
                <span>{library.length === 0
                  ? 'Generate content and click Save to build your library'
                  : 'Try a different search or filter'
                }</span>
              </div>
            )}
            {filteredLibrary.map(item => (
              <ContentCard
                key={item.id}
                item={item}
                onDelete={handleDeleteFromLibrary}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
