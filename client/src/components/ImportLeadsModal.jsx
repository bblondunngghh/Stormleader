import { useState, useRef, useEffect } from 'react';
import client from '../api/client';
import { IconUpload, IconX, IconCheckCircle, IconXCircle, IconWarning } from './Icons';
import CustomSelect from './CustomSelect';

const REQUIRED_FIELDS = ['address'];
const OPTIONAL_FIELDS = ['city', 'state', 'zip', 'contact_name', 'contact_phone', 'contact_email'];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const FIELD_ALIASES = {
  address: ['address', 'address_line1', 'street', 'street_address', 'property_address'],
  city: ['city', 'town'],
  state: ['state', 'st'],
  zip: ['zip', 'zipcode', 'zip_code', 'postal', 'postal_code'],
  contact_name: ['contact_name', 'name', 'owner', 'owner_name', 'homeowner', 'customer', 'customer_name'],
  contact_phone: ['contact_phone', 'phone', 'telephone', 'mobile', 'cell'],
  contact_email: ['contact_email', 'email', 'e-mail'],
};

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const rows = lines.slice(1).map(line => {
    const cells = parseRow(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] || '';
    });
    return obj;
  });

  return { headers, rows };
}

function autoMapColumns(csvHeaders) {
  const mapping = {};
  for (const field of ALL_FIELDS) {
    const aliases = FIELD_ALIASES[field] || [field];
    const match = csvHeaders.find(h => aliases.includes(h));
    if (match) mapping[field] = match;
  }
  return mapping;
}

function mapRow(row, columnMapping) {
  const mapped = {};
  for (const [field, csvCol] of Object.entries(columnMapping)) {
    if (csvCol && row[csvCol]) {
      mapped[field] = row[csvCol];
    }
  }
  return mapped;
}

export default function ImportLeadsModal({ onClose, onImported }) {
  const [step, setStep] = useState('upload'); // upload | mapping | preview | importing | results
  const [csvData, setCsvData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setError('Please upload a CSV file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large (max 10 MB)');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result);
      if (rows.length === 0) {
        setError('No data rows found in file');
        return;
      }
      if (rows.length > 10000) {
        setError('Maximum 10,000 rows per import');
        return;
      }
      setCsvData({ headers, rows, fileName: file.name });
      const mapping = autoMapColumns(headers);
      setColumnMapping(mapping);
      setStep('mapping');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleFileInput = (e) => {
    handleFile(e.target.files?.[0]);
  };

  const mappedRows = csvData?.rows.map(r => mapRow(r, columnMapping)) || [];
  const validRows = mappedRows.filter(r => r.address?.trim());
  const invalidRows = mappedRows.length - validRows.length;

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      const { data } = await client.post('/properties/import-csv', { rows: validRows });
      setImportResults(data);
      setStep('results');
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'address,city,state,zip,contact_name,contact_phone,contact_email\n"123 Main St","Springfield","IL","62701","John Smith","555-123-4567","john@example.com"\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stormleads-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(8px)',
    }}>
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 720, maxHeight: '85vh', overflow: 'auto',
        borderRadius: 'var(--radius-xl)', padding: 'var(--space-2xl)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Import Leads from CSV</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Upload a CSV file to bulk-import leads with free geocoding
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <IconX width={20} height={20} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)',
            borderRadius: 'var(--radius-lg)', background: 'oklch(0.30 0.08 25 / 0.5)',
            color: 'oklch(0.80 0.15 25)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <IconWarning width={16} height={16} />
            {error}
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent-blue)' : 'var(--glass-border)'}`,
                borderRadius: 'var(--radius-xl)', padding: 'var(--space-3xl)',
                textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'oklch(0.25 0.05 250 / 0.3)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <IconUpload width={40} height={40} style={{ color: 'var(--accent-blue)', marginBottom: 'var(--space-md)' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Drop CSV file here or click to browse
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Max 10,000 rows &middot; Addresses geocoded free via US Census
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileInput} style={{ display: 'none' }} />

            <div style={{ marginTop: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <button onClick={downloadTemplate} className="quick-action-btn" style={{ fontSize: 12 }}>
                Download Template
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Required: address &middot; Optional: city, state, zip, contact_name, contact_phone, contact_email
              </span>
            </div>
          </div>
        )}

        {/* Step: Column Mapping */}
        {step === 'mapping' && csvData && (
          <div>
            <div style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-lg)', background: 'oklch(0.25 0.04 250 / 0.3)', fontSize: 13, color: 'var(--text-secondary)' }}>
              <strong>{csvData.fileName}</strong> &middot; {csvData.rows.length} rows &middot; {csvData.headers.length} columns
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-md)' }}>
              Map CSV Columns
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              {ALL_FIELDS.map(field => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', width: 110, textAlign: 'right' }}>
                    {field.replace(/_/g, ' ')}
                    {REQUIRED_FIELDS.includes(field) && <span style={{ color: 'var(--accent-red)' }}> *</span>}
                  </label>
                  <CustomSelect
                    value={columnMapping[field] || ''}
                    onChange={v => setColumnMapping(prev => ({ ...prev, [field]: v }))}
                    options={[
                      { value: '', label: '— skip —' },
                      ...csvData.headers.map(h => ({ value: h, label: h }))
                    ]}
                  />
                </div>
              ))}
            </div>

            {/* Preview table */}
            <div style={{ marginTop: 'var(--space-xl)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
              Preview (first 5 rows)
            </div>
            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {ALL_FIELDS.filter(f => columnMapping[f]).map(f => (
                      <th key={f} style={{ padding: '6px 10px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>
                        {f.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {ALL_FIELDS.filter(f => columnMapping[f]).map(f => (
                        <td key={f} style={{
                          padding: '5px 10px', borderBottom: '1px solid var(--glass-border)',
                          color: !row.address?.trim() && f === 'address' ? 'var(--accent-red)' : 'var(--text-primary)',
                          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {row[f] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidRows > 0 && (
              <div style={{ marginTop: 'var(--space-sm)', fontSize: 12, color: 'oklch(0.80 0.15 60)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconWarning width={14} height={14} />
                {invalidRows} row{invalidRows > 1 ? 's' : ''} missing address — will be skipped
              </div>
            )}

            <div style={{ marginTop: 'var(--space-xl)', display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => { setStep('upload'); setCsvData(null); setColumnMapping({}); }} className="quick-action-btn" style={{ fontSize: 13 }}>
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0 || !columnMapping.address}
                className="auth-btn"
                style={{ fontSize: 13, padding: '8px 24px', opacity: validRows.length === 0 ? 0.5 : 1 }}
              >
                Import {validRows.length} Lead{validRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' || importing ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
            <div className="skeleton-shimmer" style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto var(--space-lg)' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Importing leads...
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Geocoding {validRows.length} addresses via US Census API
            </div>
          </div>
        ) : null}

        {/* Step: Results */}
        {step === 'results' && importResults && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
              <IconCheckCircle width={48} height={48} style={{ color: 'oklch(0.72 0.19 145)', marginBottom: 'var(--space-md)' }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Import Complete</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
              <div style={{ textAlign: 'center', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', background: 'oklch(0.25 0.04 250 / 0.3)' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{importResults.total}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Rows</div>
              </div>
              <div style={{ textAlign: 'center', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', background: 'oklch(0.25 0.06 145 / 0.3)' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'oklch(0.72 0.19 145)' }}>{importResults.created}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Created</div>
              </div>
              <div style={{ textAlign: 'center', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', background: 'oklch(0.25 0.06 60 / 0.3)' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'oklch(0.80 0.15 60)' }}>{importResults.skipped}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Skipped</div>
              </div>
              <div style={{ textAlign: 'center', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', background: 'oklch(0.25 0.06 25 / 0.3)' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'oklch(0.80 0.15 25)' }}>{importResults.failed}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Failed</div>
              </div>
            </div>

            {importResults.geocoded < importResults.total && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
                {importResults.geocoded} of {importResults.total} addresses matched by Census geocoder
              </div>
            )}

            {/* Show failed/skipped details */}
            {importResults.results?.some(r => r.status !== 'created') && (
              <details style={{ marginBottom: 'var(--space-lg)' }}>
                <summary style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 'var(--space-sm)' }}>
                  View skipped/failed rows ({importResults.skipped + importResults.failed})
                </summary>
                <div style={{ maxHeight: 200, overflow: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '5px 8px', borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>Row</th>
                        <th style={{ padding: '5px 8px', borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '5px 8px', borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResults.results.filter(r => r.status !== 'created').map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>{r.row + 1}</td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--glass-border)' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-pill)',
                              background: r.status === 'duplicate' ? 'oklch(0.35 0.1 60 / 0.4)' : r.status === 'no_match' ? 'oklch(0.35 0.1 250 / 0.4)' : 'oklch(0.35 0.1 25 / 0.4)',
                              color: r.status === 'duplicate' ? 'oklch(0.80 0.15 60)' : r.status === 'no_match' ? 'oklch(0.80 0.12 250)' : 'oklch(0.80 0.15 25)',
                            }}>
                              {r.status === 'duplicate' ? 'Duplicate' : r.status === 'no_match' ? 'No Match' : 'Error'}
                            </span>
                          </td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.address || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)' }}>
              <button onClick={() => { onImported?.(); onClose(); }} className="auth-btn" style={{ fontSize: 13, padding: '8px 24px' }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
