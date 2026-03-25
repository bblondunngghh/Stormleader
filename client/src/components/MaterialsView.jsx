import { useState, useEffect, useCallback, useRef } from 'react';
import * as materialsApi from '../api/materials';
import { IconSearch, IconX, IconPackage, IconShoppingCart, IconTruck, IconMinus, IconPlus, IconCheck, IconPlusCircle, IconArrowLeft } from './Icons';
import { showToast } from './Toast';

const CATEGORIES = ['All', 'Shingles', 'Underlayment', 'Flashing', 'Ventilation', 'Accessories', 'Ice & Water Shield'];

const STATUS_COLORS = {
  draft: 'var(--text-muted)',
  submitted: 'var(--accent-blue)',
  confirmed: 'var(--accent-amber)',
  shipped: 'oklch(0.70 0.15 200)',
  delivered: 'var(--accent-green)',
};

function formatCurrency(val) {
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MaterialsView() {
  const [tab, setTab] = useState('catalog');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      // Don't filter by category server-side — fetch all and filter client-side for instant tab switching
      const res = await materialsApi.searchProducts(params);
      setProducts(res.data.products || []);
    } catch {
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await materialsApi.getOrders();
      setOrders(res.data.orders || []);
    } catch {
      showToast('Failed to load orders', 'error');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await materialsApi.getBranches();
      setBranches(res.data.branches || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { if (tab === 'orders') fetchOrders(); }, [tab, fetchOrders]);
  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const addToCart = (product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id);
      if (existing) {
        return prev.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + qty } : c);
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        unit: product.unit,
        unit_price: product.price,
        quantity: qty,
        manufacturer: product.manufacturer,
      }];
    });
    showToast(`Added ${product.name} to cart`, 'success');
  };

  const updateCartQty = (productId, delta) => {
    setCart(prev => prev.map(c => {
      if (c.product_id !== productId) return c;
      const newQty = Math.max(1, c.quantity + delta);
      return { ...c, quantity: newQty };
    }));
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(c => c.product_id !== productId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.quantity * c.unit_price, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      await materialsApi.createOrder({
        items: cart,
        branch_id: selectedBranch?.id || null,
        branch_name: selectedBranch?.name || null,
      });
      showToast('Order submitted successfully', 'success');
      setCart([]);
      setCartOpen(false);
      setTab('orders');
      fetchOrders();
    } catch {
      showToast('Failed to submit order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconPackage style={{ width: 24, height: 24, color: 'var(--accent-blue)' }} />
            SRS Materials
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Browse and order roofing materials from SRS Distribution</p>
        </div>
        <button
          className="quick-action-btn"
          onClick={() => setCartOpen(true)}
          style={{
            padding: '10px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
            position: 'relative',
          }}
        >
          <IconShoppingCart style={{ width: 16, height: 16 }} />
          Cart
          {cartCount > 0 && (
            <span style={{
              position: 'absolute', top: -6, right: -6,
              background: 'var(--accent-blue)', color: 'oklch(1 0 0)',
              borderRadius: '50%', width: 20, height: 20, fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{cartCount}</span>
          )}
        </button>
      </div>

      {/* Tab bar */}
      <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-sm)', display: 'flex', gap: 'var(--space-xs)' }}>
        {['catalog', 'orders'].map(t => (
          <button
            key={t}
            className="quick-action-btn"
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 600,
              background: tab === t ? 'var(--accent-blue)' : 'transparent',
              color: tab === t ? 'oklch(1 0 0)' : 'var(--text-muted)',
              border: 'none', borderRadius: '14px / 12px',
              textTransform: 'capitalize',
            }}
          >
            {t === 'catalog' ? 'Product Catalog' : 'Order History'}
          </button>
        ))}
      </div>

      {tab === 'catalog' ? (
        <CatalogTab
          products={products}
          loading={loading}
          search={search}
          setSearch={setSearch}
          category={category}
          setCategory={setCategory}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
          addToCart={addToCart}
        />
      ) : (
        <OrdersTab
          orders={orders}
          loading={ordersLoading}
          selectedOrder={selectedOrder}
          setSelectedOrder={setSelectedOrder}
        />
      )}

      {/* Cart sidebar */}
      {cartOpen && (
        <CartSidebar
          cart={cart}
          cartTotal={cartTotal}
          branches={branches}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
          updateCartQty={updateCartQty}
          removeFromCart={removeFromCart}
          onClose={() => setCartOpen(false)}
          onSubmit={handleSubmitOrder}
          submitting={submitting}
        />
      )}

      {/* Product detail modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
        />
      )}
    </div>
  );
}

// ============================================================
// CATALOG TAB
// ============================================================

function CatalogTab({ products, loading, search, setSearch, category, setCategory, selectedProduct, setSelectedProduct, addToCart }) {
  const [slideDir, setSlideDir] = useState('right');
  const [animKey, setAnimKey] = useState(0);
  const prevCatIdx = useRef(CATEGORIES.indexOf(category));
  const tabRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Update indicator position when category changes
  useEffect(() => {
    const el = tabRefs.current[category];
    if (el) {
      const parent = el.parentElement;
      const parentRect = parent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicatorStyle({
        left: elRect.left - parentRect.left + parent.scrollLeft,
        width: elRect.width,
      });
    }
  }, [category]);

  const handleCategoryChange = (cat) => {
    const newIdx = CATEGORIES.indexOf(cat);
    const oldIdx = prevCatIdx.current;
    setSlideDir(newIdx > oldIdx ? 'right' : 'left');
    prevCatIdx.current = newIdx;
    setAnimKey(k => k + 1);
    setCategory(cat);
  };

  const filteredProducts = category === 'All' ? products : products.filter(p => p.category === category);

  return (
    <div className="glass" style={{
      borderRadius: '20px / 18px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
    }}>
      {/* Category tabs + search on same line */}
      <div style={{
        display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--glass-border)',
        flexShrink: 0, position: 'relative', padding: '0 var(--space-md) 0 0',
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            ref={el => { if (el) tabRefs.current[cat] = el; }}
            onClick={() => handleCategoryChange(cat)}
            style={{
              padding: '12px 20px', fontSize: 12, fontWeight: 600,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: category === cat ? 'var(--accent-blue)' : 'var(--text-muted)',
              borderBottom: '2px solid transparent',
              transition: 'color 0.3s',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {cat}
          </button>
        ))}
        {/* Sliding blue underline */}
        <div style={{
          position: 'absolute', bottom: 0, height: 2,
          background: 'var(--accent-blue)',
          borderRadius: 1,
          transition: 'left 0.4s cubic-bezier(0.22, 1, 0.36, 1), width 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }} />

        {/* Search — right side of tab bar */}
        <div style={{ marginLeft: 'auto', position: 'relative', flex: 1, minWidth: 140 }}>
          <IconSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', width: 14, height: 14 }} />
          <input
            className="form-input"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box', height: 32, fontSize: 12 }}
          />
        </div>
      </div>

      {/* Product grid — slides on category change */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>
            <div className="storm-map-loading__spinner" style={{ marginRight: 12 }} /> Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ padding: 'var(--space-3xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
            No products found matching your search
          </div>
        ) : (
          <div
            key={animKey}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--space-md)',
              padding: 'var(--space-lg)',
              animation: `slide-${slideDir} 0.25s ease-out`,
            }}
          >
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => setSelectedProduct(product)}
                onAddToCart={() => addToCart(product)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PRODUCT CARD
// ============================================================

function ProductCard({ product, onClick, onAddToCart }) {
  const categoryColors = {
    Shingles: '250',
    Underlayment: '155',
    Flashing: '40',
    Ventilation: '200',
    Accessories: '330',
    'Ice & Water Shield': '280',
  };
  const hue = categoryColors[product.category] || '250';

  return (
    <div
      className="glass"
      onClick={onClick}
      style={{
        borderRadius: '20px / 18px', padding: 'var(--space-lg)', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Category badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '3px 10px', borderRadius: 'var(--radius-pill)',
          background: `oklch(0.55 0.15 ${hue} / 0.15)`,
          color: `oklch(0.70 0.15 ${hue})`,
        }}>
          {product.category}
        </span>
        {product.in_stock ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <IconCheck style={{ width: 12, height: 12 }} /> In Stock
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-red)' }}>Out of Stock</span>
        )}
      </div>

      {/* Product image */}
      <div style={{
        width: '100%', height: 100, borderRadius: '14px / 12px',
        background: `oklch(0.18 0.03 ${hue} / 0.5)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative',
      }}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            decoding="async"
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              position: 'absolute', inset: 0,
            }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : null}
        <IconPackage style={{ width: 36, height: 36, color: `oklch(0.55 0.12 ${hue})`, opacity: 0.6 }} />
      </div>

      {/* Info */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{product.manufacturer}</div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{product.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SKU: {product.sku}</div>

      {/* Price + Add */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 'var(--space-sm)' }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(product.price)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>/ {product.unit}</span>
        </div>
        <button
          className="quick-action-btn"
          onClick={e => { e.stopPropagation(); onAddToCart(); }}
          style={{
            padding: '6px 14px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
            background: 'oklch(0.55 0.18 250 / 0.15)', color: 'var(--accent-blue)',
            border: '1px solid oklch(0.55 0.18 250 / 0.3)', borderRadius: '12px',
          }}
        >
          <IconPlus style={{ width: 12, height: 12 }} /> Add
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PRODUCT DETAIL MODAL
// ============================================================

function ProductDetailModal({ product, onClose, onAddToCart }) {
  const [qty, setQty] = useState(1);

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-xl)',
    }} onClick={onClose}>
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        borderRadius: '20px / 18px', padding: 'var(--space-2xl)',
        maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {product.manufacturer}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{product.name}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <IconX />
          </button>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-pill)',
            background: 'oklch(0.55 0.15 250 / 0.15)', color: 'oklch(0.70 0.15 250)',
          }}>{product.category}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-pill)',
            background: product.in_stock ? 'oklch(0.55 0.15 155 / 0.15)' : 'oklch(0.55 0.15 25 / 0.15)',
            color: product.in_stock ? 'var(--accent-green)' : 'var(--accent-red)',
          }}>{product.in_stock ? 'In Stock' : 'Out of Stock'}</span>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>{product.description}</p>

        {/* Specs */}
        <div style={{
          background: 'oklch(0.16 0.02 260 / 0.4)', borderRadius: '14px / 12px',
          padding: 'var(--space-lg)', border: '1px solid var(--glass-border)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>Specifications</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
            <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>SKU</span><div style={{ fontSize: 13, fontWeight: 600 }}>{product.sku}</div></div>
            <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unit</span><div style={{ fontSize: 13, fontWeight: 600 }}>{product.unit}</div></div>
            {product.coverage_per_unit && (
              <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Coverage</span><div style={{ fontSize: 13, fontWeight: 600 }}>{product.coverage_per_unit}</div></div>
            )}
            {product.weight_per_unit && (
              <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Weight</span><div style={{ fontSize: 13, fontWeight: 600 }}>{product.weight_per_unit}</div></div>
            )}
          </div>
        </div>

        {/* Colors */}
        {product.colors && product.colors.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>Available Colors</div>
            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
              {product.colors.map(color => (
                <span key={color} style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 'var(--radius-pill)',
                  background: 'oklch(0.20 0.02 260 / 0.6)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)',
                }}>{color}</span>
              ))}
            </div>
          </div>
        )}

        {/* Price + Add to order */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 'var(--space-md)', borderTop: '1px solid var(--glass-border)',
        }}>
          <div>
            <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(product.price)}</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 6 }}>/ {product.unit}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 0,
              background: 'oklch(0.18 0.02 260)', borderRadius: '12px',
              border: '1px solid var(--glass-border)', overflow: 'hidden',
            }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{
                background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                padding: '8px 10px', display: 'flex', alignItems: 'center',
              }}>
                <IconMinus style={{ width: 14, height: 14 }} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)} style={{
                background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                padding: '8px 10px', display: 'flex', alignItems: 'center',
              }}>
                <IconPlus style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <button
              className="auth-btn"
              onClick={() => { onAddToCart(product, qty); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', fontSize: 13 }}
            >
              <IconShoppingCart style={{ width: 14, height: 14 }} /> Add to Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CART SIDEBAR
// ============================================================

function CartSidebar({ cart, cartTotal, branches, selectedBranch, setSelectedBranch, updateCartQty, removeFromCart, onClose, onSubmit, submitting }) {
  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'oklch(0 0 0 / 0.5)',
      display: 'flex', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        width: 420, maxWidth: '90vw', height: '100%',
        borderRadius: '20px 0 0 20px', padding: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: 'none',
        animation: 'slideInRight 0.25s ease-out',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-lg) var(--space-xl)',
          borderBottom: '1px solid var(--glass-border)',
          flexShrink: 0,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconShoppingCart style={{ width: 18, height: 18, color: 'var(--accent-blue)' }} />
            Order Cart
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <IconX />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg) var(--space-xl)' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-3xl) 0' }}>
              <IconShoppingCart style={{ width: 40, height: 40, opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: 14 }}>Your cart is empty</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Browse the catalog to add products</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {cart.map(item => (
                <div key={item.product_id} style={{
                  background: 'oklch(0.16 0.02 260 / 0.4)', borderRadius: '14px / 12px',
                  padding: 'var(--space-md)', border: '1px solid var(--glass-border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.manufacturer} | {item.sku}</div>
                      <div style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600, marginTop: 4 }}>
                        {formatCurrency(item.unit_price)} / {item.unit}
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.product_id)} style={{
                      background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 4, flexShrink: 0,
                    }}>
                      <IconX style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-sm)' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      background: 'oklch(0.18 0.02 260)', borderRadius: '10px',
                      border: '1px solid var(--glass-border)', overflow: 'hidden',
                    }}>
                      <button onClick={() => updateCartQty(item.product_id, -1)} style={{
                        background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 8px', display: 'flex',
                      }}>
                        <IconMinus style={{ width: 12, height: 12 }} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.product_id, 1)} style={{
                        background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 8px', display: 'flex',
                      }}>
                        <IconPlus style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{formatCurrency(item.quantity * item.unit_price)}</span>
                  </div>
                </div>
              ))}

              {/* Branch selection */}
              <div style={{ marginTop: 'var(--space-sm)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)' }}>
                  Delivery Branch
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  {branches.map(branch => (
                    <button
                      key={branch.id}
                      onClick={() => setSelectedBranch(selectedBranch?.id === branch.id ? null : branch)}
                      style={{
                        background: selectedBranch?.id === branch.id ? 'oklch(0.55 0.18 250 / 0.15)' : 'oklch(0.16 0.02 260 / 0.4)',
                        border: selectedBranch?.id === branch.id ? '1px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                        borderRadius: '12px', padding: 'var(--space-sm) var(--space-md)',
                        cursor: 'pointer', textAlign: 'left', color: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{branch.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{branch.address}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{branch.phone} | {branch.hours}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div style={{
            padding: 'var(--space-lg) var(--space-xl)',
            borderTop: '1px solid var(--glass-border)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(cartTotal)}</span>
            </div>
            <button
              className="auth-btn"
              onClick={onSubmit}
              disabled={submitting || cart.length === 0}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', fontSize: 14, fontWeight: 700,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              <IconTruck style={{ width: 16, height: 16 }} />
              {submitting ? 'Submitting...' : 'Submit Order'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// ORDERS TAB
// ============================================================

function OrdersTab({ orders, loading, selectedOrder, setSelectedOrder }) {
  if (selectedOrder) {
    return <OrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} />;
  }

  return (
    <div className="glass" style={{ borderRadius: '20px / 18px', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="lead-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Status</th>
              <th>Items</th>
              <th>Branch</th>
              <th>Total</th>
              <th>Date</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>Loading orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>
                No orders yet -- browse the catalog to create your first order
              </td></tr>
            ) : orders.map(order => {
              const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
              return (
                <tr key={order.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>{order.srs_order_id}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                      background: `color-mix(in oklch, ${STATUS_COLORS[order.status] || 'var(--text-muted)'} 15%, transparent)`,
                      color: STATUS_COLORS[order.status] || 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{order.status}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>{items.length} item{items.length !== 1 ? 's' : ''}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.branch_name || '--'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(order.total_cost)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="quick-action-btn" onClick={() => setSelectedOrder(order)} style={{ padding: '6px 14px', fontSize: 11 }}>
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// ORDER DETAIL
// ============================================================

function OrderDetail({ order, onBack }) {
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <button className="quick-action-btn" onClick={onBack} style={{
        padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      }}>
        <IconArrowLeft style={{ width: 14, height: 14 }} /> Back to Orders
      </button>

      <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Order</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>{order.srs_order_id}</div>
          </div>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '5px 16px', borderRadius: 'var(--radius-pill)',
            background: `color-mix(in oklch, ${STATUS_COLORS[order.status] || 'var(--text-muted)'} 15%, transparent)`,
            color: STATUS_COLORS[order.status] || 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{order.status}</span>
        </div>

        {/* Order info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Branch</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{order.branch_name || 'Not specified'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Created</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(order.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Total</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(order.total_cost)}</div>
          </div>
        </div>

        {/* Items table */}
        <div style={{
          background: 'oklch(0.16 0.02 260 / 0.4)', borderRadius: '14px / 12px',
          border: '1px solid var(--glass-border)', overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 80px 100px 100px',
            gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)',
            borderBottom: '1px solid var(--glass-border)',
          }}>
            <span>Product</span><span>SKU</span><span style={{ textAlign: 'center' }}>Qty</span><span style={{ textAlign: 'center' }}>Unit Price</span><span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {items.map((item, idx) => (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 80px 100px 100px',
              gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)',
              alignItems: 'center', borderBottom: idx < items.length - 1 ? '1px solid var(--glass-border)' : 'none',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{item.product_name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.sku}</span>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{item.quantity} {item.unit}{item.quantity !== 1 ? 's' : ''}</span>
              <span style={{ fontSize: 12, textAlign: 'center' }}>{formatCurrency(item.unit_price)}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', textAlign: 'right' }}>{formatCurrency(item.quantity * item.unit_price)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SRS CATALOG MODAL — for use in EstimateBuilder
// ============================================================

export function SRSCatalogModal({ onClose, onSelect }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category && category !== 'All') params.category = category;
      const res = await materialsApi.searchProducts(params);
      setProducts(res.data.products || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-xl)',
    }} onClick={onClose}>
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        borderRadius: '20px / 18px', padding: 'var(--space-xl)',
        maxWidth: 720, width: '100%', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-md)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconPackage style={{ width: 18, height: 18, color: 'var(--accent-blue)' }} />
            SRS Product Catalog
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <IconX />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <IconSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', width: 14, height: 14 }} />
          <input
            className="form-input"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 'var(--radius-pill)',
                background: category === cat ? 'var(--accent-blue)' : 'oklch(0.20 0.02 260 / 0.6)',
                color: category === cat ? 'oklch(1 0 0)' : 'var(--text-secondary)',
                border: category === cat ? '1px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                cursor: 'pointer',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>Loading...</div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>No products found</div>
          ) : products.map(product => (
            <button
              key={product.id}
              onClick={() => {
                onSelect({
                  description: product.name,
                  quantity: 1,
                  unit: product.unit,
                  unit_price: product.price,
                  section: product.category,
                  srs_product_id: product.id,
                  srs_sku: product.sku,
                });
                onClose();
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)',
                padding: 'var(--space-sm) var(--space-md)',
                background: 'oklch(0.16 0.02 260 / 0.3)', borderRadius: '12px',
                border: '1px solid var(--glass-border)', cursor: 'pointer',
                color: 'inherit', textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.20 0.04 250 / 0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'oklch(0.16 0.02 260 / 0.3)'; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{product.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{product.manufacturer} | {product.sku} | {product.category}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(product.price)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>/ {product.unit}</div>
              </div>
              {product.in_stock ? (
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-green)', flexShrink: 0 }}>IN STOCK</span>
              ) : (
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-red)', flexShrink: 0 }}>OUT</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
