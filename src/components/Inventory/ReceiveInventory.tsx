import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const billToCoOptions = [
  "JETSHO","PRIGRE","GABGRE","GALGRE","RAN100","JCGLOG","JGTBAK","VIDBAK","JETGRE","ALLSAN","AGMGRE","TAYRET","TRUSAL","BRAGON","FRESAL","SEBSOL","LFLCOR","GARGRE","MCCGRE","LAZGRE","MEJADE"
];

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com';

function getTrailerOptions(billToCo: string): string[] {
  if (billToCo === "GALGRE") return Array.from({length: 54}, (_, i) => `1-${100+i}`);
  if (billToCo === "JETGRE") return Array.from({length: 16}, (_, i) => `2-${(i+1).toString().padStart(3, '0')}`);
  if (billToCo === "PRIGRE") return Array.from({length: 24}, (_, i) => `3-${(300+i).toString()}`);
  if (billToCo === "RAN100") return Array.from({length: 20}, (_, i) => `4-${(400+i).toString()}`);
  if (billToCo === "GABGRE") return Array.from({length: 30}, (_, i) => `5-${(500+i).toString()}`);
  return [];
}

const modalStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};
const modalContentStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: 32,
  minWidth: 400,
  maxWidth: 520,
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 4px 24px rgba(25,118,210,0.10)'
};

const ReceiveInventory: React.FC = () => {
  const [receives, setReceives] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    sku: '',
    category: '',
    item: '',
    provider: '',
    brand: '',
    um: '',
    billToCo: '',
    destino_trailer: '',
    invoice: '',
    invoiceLink: '',
    qty: '',
    costTax: '',
    totalPOClassic: '',
    fecha: new Date().toISOString().slice(0, 10),
    estatus: 'PENDING'
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editPassword, setEditPassword] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [providerFilter, setProviderFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/inventory`).then(res => setInventory(res.data as any[]));
    axios.get(`${API_URL}/receive`).then(res => setReceives(res.data as any[]));
  }, []);

  useEffect(() => {
    const selected = inventory.find((item: any) => item.sku === form.sku);
    if (selected) {
      setForm(prev => ({
        ...prev,
        category: selected.category || '',
        item: selected.part || '',
        provider: selected.provider || '',
        brand: selected.brand || '',
        um: selected.um || ''
      }));
    }
  }, [form.sku, inventory]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'billToCo' ? { destino_trailer: '' } : {})
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Calcula el nuevo precio con 10% extra
    const newPrice = form.costTax ? (Number(form.costTax) * 1.1).toFixed(2) : '';

    // Guarda el recibo
    const data = { ...form, usuario: localStorage.getItem('username') || '' };   
    await axios.post(`${API_URL}/receive`, data);

    // ACTUALIZA onHand Y precio EN UNA SOLA PETICIÓN
    if (form.sku && form.qty) {
      const invRes = await axios.get(`${API_URL}/inventory`);
      const inventoryList = invRes.data as any[];
      const part = inventoryList.find((p: any) => p.sku === form.sku);
      const currentOnHand = part && part.onHand ? Number(part.onHand) : 0;
      const newOnHand = currentOnHand + Number(form.qty);

      if (part) {
        await axios.put(`${API_URL}/inventory/${form.sku}`, {
          ...part,
          onHand: newOnHand,
          precio: newPrice || part.precio,
          usuario: localStorage.getItem('username') || ''
        });
      }
    }

    setShowForm(false);
    setForm({
      sku: '',
      category: '',
      item: '',
      provider: '',
      brand: '',
      um: '',
      billToCo: '',
      destino_trailer: '',
      invoice: '',
      invoiceLink: '',
      qty: '',
      costTax: '',
      totalPOClassic: '',
      fecha: new Date().toISOString().slice(0, 10),
      estatus: 'PENDING'
    });
    const res = await axios.get(`${API_URL}/receive`);
    setReceives(res.data as any[]);
  };

  const trailerOptions = getTrailerOptions(form.billToCo);

  const handleEditIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditId(Number(value));
    const found = receives.find(r => r.id === Number(value));
    if (found) {
      setEditForm({ ...found });
    } else {
      setEditForm({ id: value });
    }
  };

  // NUEVO: handleEdit y handleDelete para selección por fila
  const handleEdit = () => {
    if (selectedRow === null) return;
    const pwd = window.prompt('Enter password to edit:');
    if (pwd === '6214') {
      const found = receives.find(r => r.id === selectedRow);
      if (found) {
        // Asegura que billToCo tenga valor, ya sea en camelCase o snake_case
        setEditId(found.id);
        setEditForm({
          ...found,
          billToCo: found.billToCo || found.bill_to_co || ''
        });
        setShowEditForm(true);
      }
    } else if (pwd !== null) {
      alert('Incorrect password');
    }
  };

  const handleDelete = async () => {
    if (selectedRow === null) return;
    const pwd = window.prompt('Enter password to delete:');
    if (pwd === '6214') {
      if (window.confirm('Are you sure you want to delete this receipt?')) {
        try {
          await axios.request({
            url: `${API_URL}/receive/${selectedRow}`,
            method: 'DELETE',
            data: { usuario: localStorage.getItem('username') || '' }
          });
          setReceives(receives.filter(r => r.id !== selectedRow));
          setSelectedRow(null);
          alert('Receipt deleted successfully');
        } catch {
          alert('Error deleting receipt');
        }
      }
    } else if (pwd !== null) {
      alert('Incorrect password');
    }
  };

  const filteredReceives = receives.filter(r => {
    // Filtro por provider
    const providerOk = providerFilter ? r.provider === providerFilter : true;
    // Filtro por mes
    let monthOk = true;
    if (monthFilter && r.fecha) {
      const fecha = new Date(r.fecha);
      const [year, month] = monthFilter.split('-');
      monthOk = fecha.getFullYear() === Number(year) && (fecha.getMonth() + 1) === Number(month);
    }
    return providerOk && monthOk;
  });

  return (
    <div style={{ maxWidth: 1200, margin: '32px auto', background: '#f5faff', borderRadius: 16, padding: 32 }}>
      <h1 style={{ color: '#1976d2', fontWeight: 800, fontSize: 32, marginBottom: 24 }}>
        Inventory Receives
      </h1>
      <div style={{ marginBottom: 24 }}>
        <button
          style={{
            background: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 28px',
            fontWeight: 600,
            fontSize: 16,
            marginRight: 8,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
          }}
          onClick={() => setShowForm(true)}
        >
          Add Receipt
        </button>
        <button
          style={{
            background: '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 28px',
            fontWeight: 600,
            fontSize: 16,
            marginRight: 8,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(211,47,47,0.10)'
          }}
          disabled={selectedRow === null}
          onClick={handleDelete}
        >
          Delete
        </button>
        <button
          style={{
            background: '#fff',
            color: '#1976d2',
            border: '1px solid #1976d2',
            borderRadius: 6,
            padding: '10px 28px',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
          }}
          disabled={selectedRow === null}
          onClick={handleEdit}
        >
          Edit
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
        {/* Filtro por Provider */}
        <label>
          Provider:&nbsp;
          <select
            value={providerFilter}
            onChange={e => setProviderFilter(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">All</option>
            {Array.from(new Set(receives.map(r => r.provider).filter(Boolean))).map(provider => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
        </label>
        {/* Filtro por Mes */}
        <label>
          Month:&nbsp;
          <input
            type="month"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            style={{ minWidth: 140 }}
          />
        </label>
      </div>

      {/* ADD RECEIPT FORM */}
      {showForm && (
        <div style={modalStyle} onClick={() => setShowForm(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
              <h2 style={{
                color: '#1976d2',
                fontWeight: 800,
                fontSize: 26,
                marginBottom: 20,
                letterSpacing: 1
              }}>Add Receipt</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <input name="sku" value={form.sku} onChange={handleChange} placeholder="SKU" required style={inputStyle} />
                <input name="category" value={form.category} onChange={handleChange} placeholder="Category" style={inputStyle} />
                {/* Autocomplete para Item */}
                <input
                  name="item"
                  value={form.item}
                  onChange={handleChange}
                  placeholder="Item"
                  list="items-list"
                  style={inputStyle}
                  required
                />
                <datalist id="items-list">
                  {inventory.map((part: any) => (
                    <option key={part.sku} value={part.part} />
                  ))}
                </datalist>
                <input name="provider" value={form.provider} onChange={handleChange} placeholder="Provider" style={inputStyle} />
                <input name="brand" value={form.brand} onChange={handleChange} placeholder="Brand" style={inputStyle} />
                <input name="um" value={form.um} onChange={handleChange} placeholder="U/M" style={inputStyle} />
                <select name="billToCo" value={form.billToCo} onChange={handleChange} required style={inputStyle}>
                  <option value="">Bill To Co</option>
                  {billToCoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {["GALGRE", "JETGRE", "PRIGRE", "RAN100", "GABGRE"].includes(form.billToCo) ? (
                  <select
                    name="destino_trailer"
                    value={form.destino_trailer}
                    onChange={handleChange}
                    style={inputStyle}
                    required
                  >
                    <option value="">Destination Trailer</option>
                    {getTrailerOptions(form.billToCo).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="destino_trailer"
                    value={form.destino_trailer}
                    onChange={handleChange}
                    placeholder="Destination Trailer"
                    style={inputStyle}
                    required
                  />
                )}
                {/* Campo para número de invoice */}
                <input
                  type="text"
                  name="invoice"
                  value={form.invoice}
                  onChange={handleChange}
                  placeholder="Número de Invoice"
                  style={inputStyle}
                />
                {/* Campo para link de OneDrive */}
                <input
                  name="invoiceLink"
                  value={form.invoiceLink || ''}
                  onChange={handleChange}
                  placeholder="Invoice Link (OneDrive, etc.)"
                  style={inputStyle}
                  required
                />
                <input name="qty" value={form.qty} onChange={handleChange} placeholder="Quantity" required style={inputStyle} />
                <input name="costTax" value={form.costTax} onChange={handleChange} placeholder="Cost + Tax" required style={inputStyle} />
                <input name="totalPOClassic" value={form.totalPOClassic} onChange={handleChange} placeholder="P.O Classic" style={inputStyle} />
                <input name="fecha" value={form.fecha} onChange={handleChange} type="date" required style={inputStyle} />
              </div>
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button type="submit" style={primaryBtn}>Save</button>
                <button type="button" onClick={() => setShowForm(false)} style={secondaryBtn}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BY ID */}
      {showEditForm && (
        <div style={modalStyle} onClick={() => setShowEditForm(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            {editForm && (
              <form onSubmit={async e => {
                e.preventDefault();
                await axios.put(`${API_URL}/receive/${editForm.id}`, { ...editForm, usuario: localStorage.getItem('username') || '' });
                setShowEditForm(false);
                const res = await axios.get(`${API_URL}/receive`);
                setReceives(res.data as any[]);
              }} style={{ maxWidth: 520 }}>
                <h2 style={{
                  color: '#1976d2',
                  fontWeight: 800,
                  fontSize: 26,
                  marginBottom: 20,
                  letterSpacing: 1
                }}>Edit Receipt</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <input name="sku" value={editForm.sku} onChange={e => setEditForm({ ...editForm, sku: e.target.value })} placeholder="SKU" required style={inputStyle} />
                  <input name="category" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} placeholder="Category" style={inputStyle} />
                  <input name="item" value={editForm.item} onChange={e => setEditForm({ ...editForm, item: e.target.value })} placeholder="Item" style={inputStyle} />
                  <input name="provider" value={editForm.provider} onChange={e => setEditForm({ ...editForm, provider: e.target.value })} placeholder="Provider" style={inputStyle} />
                  <input name="brand" value={editForm.brand} onChange={e => setEditForm({ ...editForm, brand: e.target.value })} placeholder="Brand" style={inputStyle} />
                  <input name="um" value={editForm.um} onChange={e => setEditForm({ ...editForm, um: e.target.value })} placeholder="U/M" style={inputStyle} />
                  {/* Bill To Co solo lectura */}
                  <input
                    name="billToCo"
                    value={editForm.billToCo || ''}
                    readOnly
                    style={inputStyle}
                    placeholder="Bill To Co"
                  />
                  {["GALGRE", "JETGRE", "PRIGRE", "RAN100", "GABGRE"].includes(editForm.billToCo) ? (
                    <select
                      name="destino_trailer"
                      value={editForm.destino_trailer}
                      onChange={e => setEditForm({ ...editForm, destino_trailer: e.target.value })}
                      style={inputStyle}
                      required
                    >
                      <option value="">Destination Trailer</option>
                      {getTrailerOptions(editForm.billToCo).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="destino_trailer"
                      value={editForm.destino_trailer}
                      onChange={e => setEditForm({ ...editForm, destino_trailer: e.target.value })}
                      placeholder="Destination Trailer"
                      style={inputStyle}
                      required
                    />
                  )}
                  <input name="qty" value={editForm.qty} onChange={e => setEditForm({ ...editForm, qty: e.target.value })} placeholder="Quantity" required style={inputStyle} />
                  <input name="costTax" value={editForm.costTax} onChange={e => setEditForm({ ...editForm, costTax: e.target.value })} placeholder="Cost + Tax" required style={inputStyle} />
                  <input name="totalPOClassic" value={editForm.totalPOClassic} onChange={e => setEditForm({ ...editForm, totalPOClassic: e.target.value })} placeholder="P.O Classic" style={inputStyle} />
                  <input name="fecha" value={editForm.fecha} onChange={e => setEditForm({ ...editForm, fecha: e.target.value })} type="date" required style={inputStyle} />
                </div>
                <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                  <button type="submit" style={primaryBtn}>Save</button>
                  <button type="button" onClick={() => setShowEditForm(false)} style={secondaryBtn}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          background: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(25,118,210,0.07)',
          marginTop: 24,
        }}
      >
        <thead>
          <tr style={{ background: '#1976d2', color: '#fff' }}>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>ID</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>Date</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>SKU</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>Item</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>Provider</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>Brand</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>U/M</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>Destination Trailer</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>Invoice</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>Qty</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>Cost + Tax</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>Total</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>P.O Classic</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredReceives.map((r, idx) => (
            <tr
              key={r.id}
              style={{
                background: selectedRow === r.id ? '#e3f2fd' : (idx % 2 === 0 ? '#f9fafd' : '#fff'),
                borderBottom: '1px solid #e3eaf2',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedRow(r.id)}
            >
              <td style={{ padding: '8px 6px', textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>{r.id}</td>
              <td style={{ padding: '8px 6px', textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>
                {r.fecha || r.date ? dayjs(r.fecha || r.date).format('MM-DD-YYYY') : ''}
              </td>
              <td style={{ padding: '8px 6px', borderRight: '1px solid #e3eaf2' }}>{r.sku}</td>
              <td style={{ padding: '8px 6px', borderRight: '1px solid #e3eaf2' }}>{r.item}</td>
              <td style={{ padding: '8px 6px', borderRight: '1px solid #e3eaf2' }}>{r.provider}</td>
              <td style={{ padding: '8px 6px', borderRight: '1px solid #e3eaf2' }}>{r.brand}</td>
              <td style={{ padding: '8px 6px', textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>{r.um}</td>
              <td style={{ padding: '8px 6px', textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>{r.destino_trailer}</td>
              <td style={{ padding: '8px 6px', textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>
                {r.invoice && r.invoiceLink ? (
                  <a
                    href={r.invoiceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1976d2', textDecoration: 'underline' }}
                  >
                    {r.invoice}
                  </a>
                ) : r.invoice ? r.invoice : '—'}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>{r.qty}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>{r.costTax}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>
                {r.qty && r.costTax ? (Number(r.qty) * Number(r.costTax)).toFixed(2) : ''}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>{r.totalPOClassic}</td>
              <td
                style={{
                  padding: '8px 6px',
                  textAlign: 'center',
                  fontWeight: 600,
                  color:
                    r.estatus === 'USED'
                      ? '#d32f2f'
                      : r.estatus === 'PENDING'
                      ? '#388e3c'
                      : '#333'
                }}
              >
                {r.estatus}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Agrega estos estilos arriba del componente o en tu archivo:
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1.5px solid #1976d2',
  fontSize: 15,
  marginBottom: 8,
  background: '#f5faff',
  boxSizing: 'border-box'
};
const primaryBtn: React.CSSProperties = {
  background: '#1976d2',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '10px 28px',
  fontWeight: 600,
  fontSize: 16,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
};
const secondaryBtn: React.CSSProperties = {
  background: '#fff',
  color: '#1976d2',
  border: '1.5px solid #1976d2',
  borderRadius: 6,
  padding: '10px 28px',
  fontWeight: 600,
  fontSize: 16,
  cursor: 'pointer'
};

export default ReceiveInventory;