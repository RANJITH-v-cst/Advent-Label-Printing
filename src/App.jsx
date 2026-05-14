import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, ArrowLeft, Check, Tag, Package, Barcode, Lock, LogOut } from 'lucide-react';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import './index.css';

// ─── Suggestion Data ──────────────────────────────────────────────────────────
const SUGGESTIONS = {
  models: [
    "NEW YORK MEMORY PUF", "PARIS SPRING COMFORT", "NEW YORK MEMORY MAGIC",
    "LONDON MAX FOAM", "SYDNEY ORTHO FOAM"
  ],
  categories: [
    "PUF MATTRESS", "BONNEL SPRING MATTRESS"
  ],
  productNames: [
    "Memory Foam Mattress", "Ortho Foam Mattress", "Bonnel Spring Mattress",
    "PUF Mattress", "Latex Mattress", "Coir Mattress"
  ],
  plantNames: [
    "Plant1", "Plant2", "Plant3", "Krishnagiri Plant", "Bengaluru Plant"
  ],
  productCodes: [
    "72 x 30", "72 x 36", "72 x 48", "72 x 60", "72 x 66", "72 x 72",
    "75 x 30", "75 x 36", "75 x 48", "75 x 60", "75 x 66", "75 x 72",
    "78 x 36", "78 x 48", "78 x 60", "78 x 66", "78 x 72"
  ].flatMap(code => [`${code} x 4`, `${code} x 5`, `${code} x 6`]),
  dimensions: [
    "1.83 m x 0.76 m", "1.83 m x 0.92 m", "1.83 m x 1.22 m", "1.83 m x 1.52 m",
    "1.83 m x 1.68 m", "1.83 m x 1.83 m", "1.91 m x 0.76 m", "1.91 m x 0.92 m",
    "1.91 m x 1.22 m", "1.91 m x 1.52 m", "1.91 m x 1.68 m", "1.91 m x 1.83 m",
    "1.98 m x 0.92 m", "1.98 m x 1.22 m", "1.98 m x 1.52 m", "1.98 m x 1.68 m",
    "1.98 m x 1.83 m"
  ].flatMap(dim => [`${dim} x 0.10 m`, `${dim} x 0.12 m`, `${dim} x 0.15 m`]),
  mrps: [
    "₹ 4 166.00", "₹ 4 321.00", "₹ 4 523.00", "₹ 4 750.00", "₹ 4 762.00",
    "₹ 4 881.00", "₹ 4 916.00", "₹ 5 000.00", "₹ 5 119.00", "₹ 5 166.00",
    "₹ 5 286.00", "₹ 5 357.00", "₹ 5 476.00", "₹ 5 655.00", "₹ 5 714.00",
    "₹ 5 833.00", "₹ 6 024.00", "₹ 6 190.00", "₹ 6 393.00", "₹ 6 429.00",
    "₹ 6 667.00", "₹ 6 845.00", "₹ 6 893.00", "₹ 6 905.00", "₹ 7 071.00",
    "₹ 7 143.00", "₹ 7 381.00", "₹ 7 619.00", "₹ 7 738.00", "₹ 7 857.00",
    "₹ 7 976.00", "₹ 8 096.00", "₹ 8 334.00", "₹ 8 358.00", "₹ 8 691.00",
    "₹ 8 810.00", "₹ 8 929.00", "₹ 9 071.00", "₹ 9 167.00", "₹ 9 260.00",
    "₹ 9 405.00", "₹ 9 524.00", "₹ 9 723.00", "₹ 9 882.00", "₹ 10 001.00"
  ]
};

// ─── Regex: exactly 3 uppercase letters followed by 1+ digits ─────────────────
const SALES_ORDER_REGEX = /^[A-Z]{3}[0-9]+$/;

// ─── Helper: extract only the numeric part of the sales order ─────────────────
function getNumericPart(salesOrder) {
  const match = salesOrder.match(/[0-9]+$/);
  return match ? match[0] : '';
}

// ─── Helper: QC date from mfgDate "MM/YYYY" → "YY-MM" ────────────────────────
function getQcDate(mfgDate) {
  // If user provides MM/YYYY, we want YY-MM
  const m = mfgDate.match(/^(\d{2})\/(\d{4})$/);
  if (m) return `${m[2].slice(2)}-${m[1]}`;
  return '26-02'; // Default to match image if format fails
}

// ═════════════════════════════════════════════════════════════════════════════
function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home');

  // ── Auth: check session on mount ───────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ── Sales Order ────────────────────────────────────────────────────────────
  const [salesOrder, setSalesOrder] = useState('DUR8904309253551');
  const [soError, setSoError] = useState('');

  // ── Print Copies ───────────────────────────────────────────────────────────
  const [copies, setCopies] = useState(1);

  // ── Top margin offset for pre-printed label paper (in inches) ─────────────────
  const [topMarginIn, setTopMarginIn] = useState(0.55);

  // ── All label fields ───────────────────────────────────────────────────────
  const [fields, setFields] = useState({
    content: 'MATTRESS',
    category: 'PUF MATTRESS',
    model: 'NEW YORK MEMORY PUF',
    productCode: '72 x 30 x 6',
    dimension: '1.83 m x 0.76 m x 0.15 m',
    quantity: '1 Number',
    mfgDate: '01/2026',
    mrp: '₹ 9 071.00',
    plantName: 'P004 SAQ',
    alterCode: '',
  });

  const barcodeRef = useRef(null);

  // ── Barcode: render only numeric part ──────────────────────────────────────
  useEffect(() => {
    if (currentView !== 'sale') return;
    const numericPart = getNumericPart(salesOrder);
    if (!numericPart || !SALES_ORDER_REGEX.test(salesOrder)) {
      if (barcodeRef.current) barcodeRef.current.innerHTML = '';
      return;
    }
    try {
      JsBarcode(barcodeRef.current, numericPart, {
        format: 'CODE128',
        displayValue: false,
        height: 40, /* Reduced from 50 to save space */
        width: 1.8,
        margin: 5,
        background: 'transparent',
        lineColor: '#000000',
      });
    } catch (e) {
      console.error('Barcode generation failed', e);
    }
  }, [salesOrder, currentView]);

  // ── Sales Order change: auto-uppercase + validate ──────────────────────────
  const handleSalesOrderChange = (e) => {
    const raw = e.target.value.toUpperCase();
    setSalesOrder(raw);
    if (!raw) {
      setSoError('Sales Order Number is required');
    } else if (!SALES_ORDER_REGEX.test(raw)) {
      setSoError('Format: 3 letters + numbers only (e.g. ABC123456)');
    } else {
      setSoError('');
    }
  };

  const handleFieldChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  function handlePrint() {
    // Hide all label copies except the first one
    const allLabels = document.querySelectorAll('.print-label');

    // Store original display values
    const hidden = [];
    allLabels.forEach((label, index) => {
      if (index > 0) {
        hidden.push({ el: label, display: label.style.display });
        label.style.display = 'none';
      }
    });

    // Print
    window.print();

    // Restore after print dialog closes
    setTimeout(() => {
      hidden.forEach(({ el, display }) => {
        el.style.display = display || '';
      });
    }, 1000);
  }


  // ── QR data: plantName#productName#salesOrderNumber#alterCode ─────────────
  const qrData = `${fields.plantName}#${fields.productName}#${salesOrder}#${fields.alterCode}`;

  // ── Derived ───────────────────────────────────────────────────────────────
  const numericPart = getNumericPart(salesOrder);
  const isValidOrder = SALES_ORDER_REGEX.test(salesOrder);

  if (authLoading) {
    return (
      <div className="auth-wrapper">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">
            <div className="brand">ADVENT</div>
            <div className="subtitle">AUTHENTICATING...</div>
          </div>
          <div className="animate-spin" style={{ margin: '0 auto', width: 40, height: 40, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HOME VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (currentView === 'home') {
    return (
      <div className="home-page">
        <h1 className="animated-title">Advent Labels</h1>
        <h2 className="home-title">LABEL TYPES</h2>

        <div className="label-types-grid">
          {/* Sale Label */}
          <div className="label-card selected" onClick={() => setCurrentView('sale')}>
            <div className="card-radio"><Check size={16} color="white" /></div>
            <div className="icon-wrapper">
              <Tag size={40} color="#e5a075" style={{ position: 'absolute', top: 5, left: 5, zIndex: 2 }} />
              <Package size={40} color="#d4b494" style={{ position: 'absolute', bottom: 5, right: 5, zIndex: 1 }} />
            </div>
            <div className="card-title">SALE LABEL</div>
          </div>

          {/* Warehouse Label (placeholder) */}
          <div className="label-card" style={{ opacity: 0.7, backgroundColor: '#f1f5f9' }}>
            <div className="card-radio"></div>
            <div className="icon-wrapper">
              <Barcode size={40} color="#475569" style={{ position: 'absolute', top: 5, left: 20 }} />
              <Package size={24} color="#d4b494" style={{ position: 'absolute', bottom: 5, left: 15 }} />
              <Package size={16} color="#d4b494" style={{ position: 'absolute', bottom: 5, right: 20 }} />
            </div>
            <div className="card-title" style={{ color: '#64748b' }}>WAREHOUSE LABEL</div>
          </div>

        </div>
      </div>
    );
  }


  // ════════════════════════════════════════════════════════════════════════════
  // SALE LABEL VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="app-container">

      {/* ── LEFT SIDEBAR ── */}
      <div className="sidebar">
        <button className="back-button" onClick={() => setCurrentView('home')}>
          <ArrowLeft size={16} /> Back to Label Types
        </button>

        <h2>Sale Label Settings</h2>

        {/* ── Section: Sales Order ── */}
        <div className="section-label">SALES ORDER</div>
        <div className="form-group">
          <label htmlFor="salesOrder">
            Sales Order Number <span className="required-star">*</span>
          </label>
          <input
            id="salesOrder"
            type="text"
            className={`primary-input ${soError ? 'input-error' : isValidOrder ? 'input-valid' : ''}`}
            value={salesOrder}
            onChange={handleSalesOrderChange}
            placeholder="e.g. ABC123456"
            maxLength={20}
          />

        </div>

        <div className="divider" />

        {/* ── Section: Label Details ── */}
        <div className="section-label">LABEL DETAILS</div>

        <div className="form-group">
          <label>Product Name <span className="required-star">*</span></label>
          <input
            list="productNames-list"
            value={fields.productName}
            onChange={(e) => handleFieldChange('productName', e.target.value)}
            placeholder="e.g. Memory Foam Mattress"
          />
          <datalist id="productNames-list">
            {SUGGESTIONS.productNames.map(v => <option key={v} value={v} />)}
          </datalist>
        </div>

        <div className="form-group">
          <label>Model</label>
          <input list="models-list" value={fields.model} onChange={(e) => handleFieldChange('model', e.target.value)} />
          <datalist id="models-list">
            {SUGGESTIONS.models.map(v => <option key={v} value={v} />)}
          </datalist>
        </div>

        <div className="form-group">
          <label>Category</label>
          <input list="categories-list" value={fields.category} onChange={(e) => handleFieldChange('category', e.target.value)} />
          <datalist id="categories-list">
            {SUGGESTIONS.categories.map(v => <option key={v} value={v} />)}
          </datalist>
        </div>

        <div className="form-group">
          <label>Product Code</label>
          <input list="productCodes-list" value={fields.productCode} onChange={(e) => handleFieldChange('productCode', e.target.value)} />
          <datalist id="productCodes-list">
            {SUGGESTIONS.productCodes.map(v => <option key={v} value={v} />)}
          </datalist>
        </div>

        <div className="form-group">
          <label>Dimension</label>
          <input list="dimensions-list" value={fields.dimension} onChange={(e) => handleFieldChange('dimension', e.target.value)} />
          <datalist id="dimensions-list">
            {SUGGESTIONS.dimensions.map(v => <option key={v} value={v} />)}
          </datalist>
        </div>

        <div className="form-group">
          <label>Net Quantity</label>
          <input
            value={fields.quantity}
            onChange={(e) => handleFieldChange('quantity', e.target.value)}
            placeholder="e.g. 1 Number"
          />
        </div>

        <div className="form-group">
          <label>Month &amp; Year of Manufacture</label>
          <input
            value={fields.mfgDate}
            onChange={(e) => handleFieldChange('mfgDate', e.target.value)}
            placeholder="MM/YYYY"
          />
        </div>

        <div className="form-group">
          <label>MRP (incl. of all taxes)</label>
          <input list="mrps-list" value={fields.mrp} onChange={(e) => handleFieldChange('mrp', e.target.value)} />
          <datalist id="mrps-list">
            {SUGGESTIONS.mrps.map(v => <option key={v} value={v} />)}
          </datalist>
        </div>

        <div className="divider" />

        {/* ── Section: QR Code Data ── */}
        <div className="section-label">QR CODE DATA</div>

        <div className="form-group">
          <label>Plant Name</label>
          <input
            list="plantNames-list"
            value={fields.plantName}
            onChange={(e) => handleFieldChange('plantName', e.target.value)}
            placeholder="e.g. P004 SAQ"
          />
          <datalist id="plantNames-list">
            {SUGGESTIONS.plantNames.map(v => <option key={v} value={v} />)}
          </datalist>
        </div>

        <div className="form-group">
          <label className="alter-code-label">
            <Lock size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            Alter Code
          </label>
          <input
            type="password"
            className="alter-code-input"
            value={fields.alterCode}
            onChange={(e) => handleFieldChange('alterCode', e.target.value)}
            placeholder="Enter Alter Code"
            autoComplete="off"
          />

        </div>

        <div className="divider" />

        {/* ── Section: Print Options ── */}
        <div className="section-label">PRINT OPTIONS</div>
        <div className="form-group">
          <label htmlFor="copies">Number of Copies</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="copies-btn" onClick={() => setCopies(c => Math.max(1, c - 1))} aria-label="Decrease copies">−</button>
            <input
              id="copies" type="number" min="1" max="99" value={copies}
              onChange={e => setCopies(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="copies-input"
            />
            <button className="copies-btn" onClick={() => setCopies(c => Math.min(99, c + 1))} aria-label="Increase copies">+</button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="topMargin">Top Margin (inches)</label>
          <span className="field-hint" style={{ marginBottom: 4 }}>Offset for pre-printed label position</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="copies-btn" onClick={() => setTopMarginIn(v => Math.max(0, parseFloat((v - 0.05).toFixed(2))))} aria-label="Decrease margin">−</button>
            <input
              id="topMargin" type="number" min="0" max="6" step="0.05"
              value={topMarginIn}
              onChange={e => setTopMarginIn(Math.max(0, parseFloat(e.target.value) || 0))}
              className="copies-input"
              style={{ width: 72 }}
            />
            <button className="copies-btn" onClick={() => setTopMarginIn(v => parseFloat((v + 0.05).toFixed(2)))} aria-label="Increase margin">+</button>
          </div>
        </div>

        <div className="divider" />
        <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* ── Dynamic @page margin for pre-printed label alignment ── */}
      <style>{`
        @media print {
          @page { 
            size: 80mm 150mm !important;
            margin: 0 !important;
            margin-top: ${topMarginIn}in !important; 
          }
          /* Header is now printed to match full logo details */
        }
      `}</style>

      {/* ── MAIN PREVIEW ── */}
      <div className="preview-area">
        <div className="print-actions">
          <button
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={!isValidOrder}
            title={!isValidOrder ? 'Fix Sales Order format first' : ''}
          >
            <Printer size={18} />
            Print {copies} {copies === 1 ? 'Copy' : 'Copies'}
          </button>
          {!isValidOrder && (
            <span style={{ fontSize: 12, color: '#dc2626', alignSelf: 'center' }}>
              Fix Sales Order to enable printing
            </span>
          )}
        </div>

        <div className="label-container">
          {Array.from({ length: copies }).map((_, i) => (
            <div
              key={i}
              className={`print-copy-wrapper ${i > 0 ? 'print-only' : ''}`}
              style={i < copies - 1 ? { pageBreakAfter: 'always', breakAfter: 'page' } : {}}
            >
              <div className="print-label">

                {/* ── HEADER ── */}
                <div className="label-header">
                  <div className="header-main">
                    <div>PERFECT REST</div>
                  </div>
                </div>

                {/* ── DATA TABLE ── */}
                <table className="label-table">
                  <tbody>
                    <tr>
                      <td className="col-label">Content</td>
                      <td className="col-value">MATTRESS</td>
                    </tr>
                    <tr>
                      <td className="col-label">Category</td>
                      <td className="col-value">{fields.category}</td>
                    </tr>
                    <tr>
                      <td className="col-label">Model</td>
                      <td className="col-value">{fields.model}</td>
                    </tr>
                    <tr>
                      <td className="col-label">Product Code</td>
                      <td className="col-value">{fields.productCode}</td>
                    </tr>
                    <tr>
                      <td className="col-label">Dimension</td>
                      <td className="col-value">{fields.dimension}</td>
                    </tr>
                    <tr>
                      <td className="col-label">Net Quantity</td>
                      <td className="col-value qty-cell">{fields.quantity}</td>
                    </tr>
                    <tr>
                      <td className="col-label">Month & Year of<br />Manufacture</td>
                      <td className="col-value">{fields.mfgDate}</td>
                    </tr>
                    <tr>
                      <td className="col-label">MRP<br />(incl.of all taxes)</td>
                      <td className="col-value mrp-cell">{fields.mrp}</td>
                    </tr>
                  </tbody>
                </table>

                {/* ── BARCODE ── */}
                <div className="label-barcode-section">
                  {isValidOrder
                    ? <svg ref={i === 0 ? barcodeRef : el => {
                      if (el) {
                        const np = getNumericPart(salesOrder);
                        if (np) try {
                          JsBarcode(el, np, {
                            format: 'CODE128', displayValue: false,
                            height: 35, width: 1.6, margin: 2,
                            background: 'transparent', lineColor: '#000000',
                          });
                        } catch (e) { console.error(e); }
                      }
                    }}></svg>
                    : <div className="barcode-placeholder">[ Invalid Sales Order ]</div>
                  }
                  <div className="barcode-number">{numericPart || salesOrder}</div>
                </div>

                {/* ── MANUFACTURER INFO ── */}
                <div className="label-mfg-info">
                  <div className="mfg-title">Manufactured By</div>
                  <div className="mfg-address serif-text">
                    M/S.Duroflex Limited (formerly known as<br />
                    Duroflex Pvt. Ltd.) Karimangalam # Pannendur<br />
                    Road,, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Gunaikottai village,<br />
                    sathinaickenpatti,post, Dhamodharahalli panchayat,<br />
                    Pochampalli Taluk,Krishnagiri, &nbsp;Tamil Nadu 635123<br />
                    Packing Lic No: TN/KRG 1014/14
                  </div>

                  <div className="complaints-section">
                    <div className="complaints-title">For further information / complaints</div>
                    <div className="complaints-text serif-text">
                      Please contact customer care officer at below address<br />
                      30/6,NR Trident tech park, Sector 6, HSR Main road,<br />
                      HSR Layout, Bengaluru, Karnataka 560 068<br />
                      <div className="or-text">or</div>
                      call us at 1800 108 5008<br />
                      EmailID:support@duroflexworld.com<br />
                      Website:www.duroflexworld.com
                    </div>
                  </div>
                </div>

                {/* ── FOOTER ── */}
                <div className="label-footer">
                  <div className="footer-left-col">
                    <div className="plant-id">{fields.plantName}</div>
                    <div className="qr-code-wrapper">
                      <QRCodeSVG value={qrData} size={70} level="H" includeMargin={false} />
                    </div>
                  </div>

                  <div className="footer-right-col">
                    <div className="footer-model-display">
                      <div>NEW YORK</div>
                      <div>MEMORY PUF</div>
                    </div>
                    <div className="footer-pc-label">Product Code</div>
                    <div className="footer-pc-value">{fields.productCode.replace(/\s+/g, '')}</div>
                  </div>
                </div>


              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
