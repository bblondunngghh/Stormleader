import { useState, useEffect, useCallback } from 'react';
import { getTerritories, createTerritory, updateTerritory, deleteTerritory, getTeamMembers } from '../api/crm';
import { MapPinIcon, TrashIcon, PencilSquareIcon, PlusIcon, XMarkIcon, UserCircleIcon } from '@heroicons/react/24/outline';

const TERRITORY_COLORS = [
  'oklch(0.65 0.27 29)',   // red
  'oklch(0.75 0.18 145)',  // green
  'oklch(0.7 0.15 220)',   // blue
  'oklch(0.75 0.15 55)',   // orange
  'oklch(0.7 0.12 280)',   // purple
  'oklch(0.75 0.18 85)',   // yellow
  'oklch(0.65 0.15 180)',  // teal
  'oklch(0.7 0.2 340)',    // pink
];

export default function TerritoryManager({ mapRef, mapsApi, onTerritoryPolygonsChange }) {
  const [territories, setTerritories] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawnCoords, setDrawnCoords] = useState([]);
  const [formData, setFormData] = useState({ name: '', color: TERRITORY_COLORS[0], assigned_user_id: '', notes: '' });
  const [drawingOverlay, setDrawingOverlay] = useState(null);
  const [toast, setToast] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [tRes, mRes] = await Promise.all([getTerritories(), getTeamMembers()]);
      setTerritories(tRes.data || []);
      setTeamMembers(mRes.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Render territory polygons on the map
  useEffect(() => {
    if (!mapRef?.current || !mapsApi || !territories.length) {
      onTerritoryPolygonsChange?.([]);
      return;
    }

    const polygons = territories
      .filter(t => t.geojson?.coordinates)
      .map(t => {
        const coords = t.geojson.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        const polygon = new mapsApi.Polygon({
          paths: coords,
          map: mapRef.current,
          strokeColor: t.color || TERRITORY_COLORS[0],
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: t.color || TERRITORY_COLORS[0],
          fillOpacity: 0.15,
          clickable: false,
        });
        return polygon;
      });

    onTerritoryPolygonsChange?.(polygons);

    return () => polygons.forEach(p => p.setMap(null));
  }, [territories, mapRef, mapsApi]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const startDrawing = () => {
    if (!mapRef?.current || !mapsApi) return;

    setDrawingMode(true);
    setDrawnCoords([]);

    const dm = new mapsApi.drawing.DrawingManager({
      drawingMode: mapsApi.drawing.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: {
        fillColor: formData.color,
        fillOpacity: 0.25,
        strokeColor: formData.color,
        strokeWeight: 2,
        editable: true,
      },
    });

    dm.setMap(mapRef.current);

    mapsApi.event.addListener(dm, 'polygoncomplete', (polygon) => {
      const path = polygon.getPath();
      const coords = [];
      for (let i = 0; i < path.getLength(); i++) {
        const pt = path.getAt(i);
        coords.push([pt.lng(), pt.lat()]);
      }
      setDrawnCoords(coords);
      dm.setDrawingMode(null);
      setDrawingOverlay(polygon);
    });

    // Store ref for cleanup
    setDrawingOverlay(dm);
  };

  const cancelDrawing = () => {
    if (drawingOverlay) {
      if (drawingOverlay.setMap) drawingOverlay.setMap(null);
      if (drawingOverlay instanceof mapsApi.Polygon) drawingOverlay.setMap(null);
    }
    setDrawingMode(false);
    setDrawnCoords([]);
    setDrawingOverlay(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return showToast('Name is required');
    if (drawnCoords.length < 3 && !editingId) return showToast('Draw a territory polygon first');

    try {
      const payload = {
        name: formData.name,
        color: formData.color,
        assigned_user_id: formData.assigned_user_id || null,
        notes: formData.notes,
      };

      if (drawnCoords.length >= 3) {
        payload.coordinates = drawnCoords;
      }

      if (editingId) {
        await updateTerritory(editingId, payload);
        showToast('Territory updated');
      } else {
        await createTerritory(payload);
        showToast('Territory created');
      }

      // Clean up drawing
      if (drawingOverlay) {
        if (drawingOverlay.setMap) drawingOverlay.setMap(null);
      }
      setDrawingMode(false);
      setDrawnCoords([]);
      setDrawingOverlay(null);
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', color: TERRITORY_COLORS[0], assigned_user_id: '', notes: '' });
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save territory');
    }
  };

  const handleEdit = (t) => {
    setEditingId(t.id);
    setFormData({
      name: t.name,
      color: t.color || TERRITORY_COLORS[0],
      assigned_user_id: t.assigned_user_id || '',
      notes: t.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteTerritory(id);
      showToast('Territory deleted');
      await loadData();
    } catch { showToast('Failed to delete'); }
  };

  const openNewForm = () => {
    setEditingId(null);
    setFormData({ name: '', color: TERRITORY_COLORS[territories.length % TERRITORY_COLORS.length], assigned_user_id: '', notes: '' });
    setDrawnCoords([]);
    setShowForm(true);
  };

  return (
    <div style={{
      position: 'absolute', top: 70, right: 12, width: 320, zIndex: 10,
      maxHeight: 'calc(100vh - 100px)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div className="glass" style={{ borderRadius: 'var(--radius-md)', padding: 16, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Territories</h3>
          {!showForm && (
            <button onClick={openNewForm} className="auth-btn" style={{ fontSize: 12, padding: '4px 12px', height: 28, display: 'flex', alignItems: 'center', gap: 4 }}>
              <PlusIcon style={{ width: 14, height: 14 }} /> Add
            </button>
          )}
        </div>

        {showForm && (
          <div style={{ marginBottom: 12, padding: 12, background: 'oklch(0.15 0.01 260 / 0.5)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingId ? 'Edit Territory' : 'New Territory'}
              </span>
              <button onClick={() => { setShowForm(false); cancelDrawing(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <XMarkIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <input
              className="form-input"
              placeholder="Territory name"
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              style={{ marginBottom: 8, fontSize: 13 }}
            />

            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Color</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {TERRITORY_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setFormData(f => ({ ...f, color: c }))}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', border: formData.color === c ? '2px solid white' : '2px solid transparent',
                      background: c, cursor: 'pointer', transition: 'border-color 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Assign to Rep</label>
              <select
                className="form-input"
                value={formData.assigned_user_id}
                onChange={e => setFormData(f => ({ ...f, assigned_user_id: e.target.value }))}
                style={{ fontSize: 13 }}
              >
                <option value="">Unassigned</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </div>

            <textarea
              className="form-input"
              placeholder="Notes (optional)"
              value={formData.notes}
              onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              style={{ marginBottom: 8, fontSize: 13, resize: 'vertical' }}
            />

            {!editingId && (
              <div style={{ marginBottom: 8 }}>
                {!drawingMode ? (
                  <button onClick={startDrawing} className="quick-action-btn" style={{ fontSize: 12, width: '100%', padding: '6px 0' }}>
                    {drawnCoords.length > 0 ? `✓ ${drawnCoords.length} points drawn — Redraw?` : 'Draw Territory on Map'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'oklch(0.75 0.15 55)', flex: 1, alignSelf: 'center' }}>
                      Click map to draw polygon...
                    </span>
                    <button onClick={cancelDrawing} className="quick-action-btn" style={{ fontSize: 11, padding: '4px 8px' }}>Cancel</button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleSubmit} className="auth-btn" style={{ fontSize: 12, flex: 1, padding: '6px 0', height: 32 }}>
                {editingId ? 'Update' : 'Create Territory'}
              </button>
              <button onClick={() => { setShowForm(false); cancelDrawing(); }} className="quick-action-btn" style={{ fontSize: 12, padding: '6px 12px' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>Loading...</div>
        ) : territories.length === 0 && !showForm ? (
          <div style={{ textAlign: 'center', padding: '20px 12px' }}>
            <MapPinIcon style={{ width: 32, height: 32, color: 'var(--text-muted)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No territories yet</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Create territories to assign canvassing regions to reps</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {territories.map(t => (
              <div key={t.id} style={{
                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'oklch(0.15 0.01 260 / 0.3)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t.assigned_user_name ? (
                      <><UserCircleIcon style={{ width: 12, height: 12 }} /> {t.assigned_user_name}</>
                    ) : 'Unassigned'}
                    <span style={{ margin: '0 2px' }}>·</span>
                    {t.pin_count || 0} pins
                  </div>
                </div>
                <button onClick={() => handleEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  <PencilSquareIcon style={{ width: 14, height: 14 }} />
                </button>
                <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.65 0.2 25)', padding: 2 }}>
                  <TrashIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: 'oklch(0.25 0.02 260)', color: 'var(--text-primary)', padding: '8px 16px',
          borderRadius: 'var(--radius-sm)', fontSize: 13, boxShadow: '0 4px 12px oklch(0 0 0 / 0.4)',
          animation: 'toast-slide-in 0.2s ease-out',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
