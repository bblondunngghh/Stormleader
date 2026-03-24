import { useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { generateContent, generateContentBatch } from '../api/crm';
import { showToast } from './Toast';
import CustomSelect from './CustomSelect';
import { SparklesIcon, ClipboardDocumentIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const CONTENT_TYPES = [
  { value: 'social_post', label: 'Social Posts' },
  { value: 'door_hanger', label: 'Door Hangers' },
  { value: 'email_template', label: 'Email Templates' },
  { value: 'blog_outline', label: 'Blog Outlines' },
  { value: 'ad_copy', label: 'Ad Copy' },
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

function ContentCard({ item, index }) {
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
      <pre className="content-studio__card-text">{text}</pre>
      <button className="content-studio__copy-btn" onClick={handleCopy} title="Copy to clipboard">
        <ClipboardDocumentIcon width={16} height={16} />
        Copy
      </button>
    </div>
  );
}

export default function ContentStudio() {
  const { user } = useAuth();
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

  const updateVar = useCallback((key, val) => {
    setVariables(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      if (batchMode) {
        const { data } = await generateContentBatch({ type, tone, variables, count: 5 });
        setResults(data.results || []);
      } else {
        const { data } = await generateContent({ type, tone, variables });
        setResults([data]);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Generation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  return (
    <div className="content-studio">
      {/* Header */}
      <div className="content-studio__header">
        <div className="content-studio__title">
          <SparklesIcon width={28} height={28} className="content-studio__title-icon" />
          <h1>AI Content Studio</h1>
        </div>
        <p className="content-studio__subtitle">
          Generate marketing content for your roofing business — social posts, door hangers, emails, blog outlines, and ad copy.
        </p>
      </div>

      <div className="content-studio__body">
        {/* Controls panel */}
        <div className="content-studio__controls glass">
          <h3 className="content-studio__section-title">Content Settings</h3>

          <div className="content-studio__field">
            <label>Content Type</label>
            <CustomSelect
              value={type}
              onChange={setType}
              options={CONTENT_TYPES}
              style={{ width: '100%' }}
            />
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

        {/* Results panel */}
        <div className="content-studio__results">
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
                <button className="content-studio__regen-btn" onClick={handleRegenerate} disabled={loading}>
                  <ArrowPathIcon width={16} height={16} />
                  Regenerate
                </button>
              </div>
              {results.map((item, i) => (
                <ContentCard key={i} item={item} index={batchMode ? i : undefined} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
