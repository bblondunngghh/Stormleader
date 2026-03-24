import { useState, useRef, useEffect, useCallback } from 'react';

const TOOLS = [
  { id: 'pen', label: 'Draw', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  { id: 'arrow', label: 'Arrow', icon: 'M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25' },
  { id: 'rect', label: 'Rectangle', icon: 'M3 3h18v18H3z' },
  { id: 'circle', label: 'Circle', icon: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0' },
  { id: 'text', label: 'Text', icon: 'M4 6h16M8 6v12m8-12v12' },
];

const COLORS = [
  'oklch(0.65 0.27 29)',   // red
  'oklch(0.80 0.18 85)',   // yellow
  'oklch(0.75 0.18 145)',  // green
  'oklch(0.72 0.19 250)',  // blue
  'oklch(0.95 0 0)',       // white
];

const STROKE_WIDTHS = [2, 4, 6];

export default function PhotoAnnotator({ imageUrl, onSave, onClose }) {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [annotations, setAnnotations] = useState([]); // history of drawn shapes
  const [textInput, setTextInput] = useState(null); // { x, y } if placing text
  const [textValue, setTextValue] = useState('');
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef(null);
  const pathRef = useRef([]);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Render canvas when image loads or annotations change
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;

    // Fit to container
    const container = containerRef.current;
    const maxW = container.clientWidth;
    const maxH = container.clientHeight - 60;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    canvas.width = w;
    canvas.height = h;
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.width = w;
      overlayCanvasRef.current.height = h;
    }

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // Replay annotations
    for (const ann of annotations) {
      drawAnnotation(ctx, ann);
    }
  }, [imgLoaded, annotations]);

  const getPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleStart = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(e);

    if (tool === 'text') {
      setTextInput(pos);
      setTextValue('');
      return;
    }

    setDrawing(true);
    setStartPos(pos);
    pathRef.current = [pos];

    if (tool === 'pen') {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [tool, color, strokeWidth, getPos]);

  const handleMove = useCallback((e) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = overlayCanvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);

    if (tool === 'pen') {
      pathRef.current.push(pos);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = pathRef.current;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    } else if (tool === 'arrow') {
      drawArrowPreview(ctx, startPos, pos, color, strokeWidth);
    } else if (tool === 'rect') {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
    } else if (tool === 'circle') {
      const rx = Math.abs(pos.x - startPos.x) / 2;
      const ry = Math.abs(pos.y - startPos.y) / 2;
      const cx = (startPos.x + pos.x) / 2;
      const cy = (startPos.y + pos.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }, [drawing, tool, color, strokeWidth, startPos, getPos]);

  const handleEnd = useCallback((e) => {
    if (!drawing) return;
    setDrawing(false);

    const pos = e.changedTouches ? { x: e.changedTouches[0].clientX - canvasRef.current.getBoundingClientRect().left, y: e.changedTouches[0].clientY - canvasRef.current.getBoundingClientRect().top } : getPos(e);

    // Clear overlay
    const octx = overlayCanvasRef.current.getContext('2d');
    octx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);

    const ann = { tool, color, strokeWidth };

    if (tool === 'pen') {
      ann.path = [...pathRef.current];
    } else {
      ann.start = startPos;
      ann.end = pos;
    }

    setAnnotations(prev => [...prev, ann]);
    pathRef.current = [];
  }, [drawing, tool, color, strokeWidth, startPos, getPos]);

  const handleTextSubmit = () => {
    if (!textValue.trim() || !textInput) return;
    setAnnotations(prev => [...prev, { tool: 'text', color, text: textValue, pos: textInput, fontSize: strokeWidth * 6 }]);
    setTextInput(null);
    setTextValue('');
  };

  const handleUndo = () => {
    setAnnotations(prev => prev.slice(0, -1));
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      onSave(blob);
    }, 'image/png');
  };

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'oklch(0.03 0.02 260 / 0.85)', backdropFilter: 'blur(8px)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', inset: 'var(--space-lg)', zIndex: 201,
        display: 'flex', flexDirection: 'column', gap: 'var(--space-md)',
      }}>
        {/* Toolbar */}
        <div className="glass" style={{
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-md) var(--space-lg)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap',
        }}>
          {/* Tools */}
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            {TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setTool(t.id)}
                style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: tool === t.id ? 'oklch(0.30 0.08 250 / 0.6)' : 'transparent',
                  color: tool === t.id ? 'var(--accent-blue)' : 'var(--text-muted)',
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={t.icon} />
                </svg>
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }} />

          {/* Colors */}
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{
                  width: 24, height: 24, borderRadius: '50%', border: color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                  background: c, cursor: 'pointer', padding: 0,
                }} />
            ))}
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }} />

          {/* Stroke width */}
          <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
            {STROKE_WIDTHS.map(w => (
              <button key={w} onClick={() => setStrokeWidth(w)}
                style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: strokeWidth === w ? 'oklch(0.30 0.05 250 / 0.6)' : 'transparent',
                }}>
                <div style={{ width: w * 3, height: w, borderRadius: w, background: strokeWidth === w ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Actions */}
          <button onClick={handleUndo} disabled={annotations.length === 0}
            className="quick-action-btn" style={{ fontSize: 12, padding: '6px 14px', opacity: annotations.length === 0 ? 0.4 : 1 }}>
            Undo
          </button>
          <button onClick={handleSave} className="auth-btn" style={{ fontSize: 12, padding: '6px 20px', height: 32 }}>
            Save Annotated Photo
          </button>
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'none', color: 'var(--text-muted)', fontSize: 18 }}>
            &times;
          </button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative',
        }}>
          {!imgLoaded && (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading image...</div>
          )}
          <div style={{ position: 'relative', display: imgLoaded ? 'block' : 'none' }}>
            <canvas ref={canvasRef} style={{ borderRadius: 'var(--radius-md)', cursor: tool === 'text' ? 'text' : 'crosshair' }} />
            <canvas ref={overlayCanvasRef}
              style={{ position: 'absolute', top: 0, left: 0, borderRadius: 'var(--radius-md)', cursor: tool === 'text' ? 'text' : 'crosshair' }}
              onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}
              onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
            />
          </div>

          {/* Text input overlay */}
          {textInput && (
            <div style={{
              position: 'absolute',
              left: canvasRef.current?.getBoundingClientRect().left - containerRef.current?.getBoundingClientRect().left + textInput.x,
              top: textInput.y,
              zIndex: 10,
            }}>
              <input
                autoFocus
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') setTextInput(null); }}
                onBlur={handleTextSubmit}
                className="form-input"
                style={{ fontSize: strokeWidth * 6, color, background: 'oklch(0.1 0.02 260 / 0.8)', border: `1px solid ${color}`, borderRadius: 4, padding: '2px 6px', minWidth: 100 }}
                placeholder="Type text..."
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function drawAnnotation(ctx, ann) {
  ctx.save();
  ctx.strokeStyle = ann.color;
  ctx.fillStyle = ann.color;
  ctx.lineWidth = ann.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (ann.tool === 'pen' && ann.path) {
    ctx.beginPath();
    ctx.moveTo(ann.path[0].x, ann.path[0].y);
    for (let i = 1; i < ann.path.length; i++) ctx.lineTo(ann.path[i].x, ann.path[i].y);
    ctx.stroke();
  } else if (ann.tool === 'arrow' && ann.start && ann.end) {
    drawArrowPreview(ctx, ann.start, ann.end, ann.color, ann.strokeWidth);
  } else if (ann.tool === 'rect' && ann.start && ann.end) {
    ctx.strokeRect(ann.start.x, ann.start.y, ann.end.x - ann.start.x, ann.end.y - ann.start.y);
  } else if (ann.tool === 'circle' && ann.start && ann.end) {
    const rx = Math.abs(ann.end.x - ann.start.x) / 2;
    const ry = Math.abs(ann.end.y - ann.start.y) / 2;
    const cx = (ann.start.x + ann.end.x) / 2;
    const cy = (ann.start.y + ann.end.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ann.tool === 'text' && ann.pos) {
    ctx.font = `bold ${ann.fontSize || 24}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(ann.text, ann.pos.x, ann.pos.y);
  }

  ctx.restore();
}

function drawArrowPreview(ctx, start, end, color, lineWidth) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const headLen = Math.max(lineWidth * 4, 12);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';

  // Line
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
