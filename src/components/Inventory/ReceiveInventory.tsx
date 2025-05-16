import React, { useEffect, useState } from 'react';
import axios from 'axios';

const billToCoOptions = [
  "JETSHO","PRIGRE","GABGRE","GALGRE","RAN100","JCGLOG","JGTBAK","VIDBAK","JETGRE","ALLSAN","AGMGRE","TAYRET","TRUSAL","BRAGON","FRESAL","SEBSOL","LFLCOR","GARGRE","MCCGRE","LAZGRE","MEJADE"
];

const API_URL = process.env.REACT_APP_API_URL || '';

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
    invoice: null as File | null,
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setForm(prev => ({ ...prev, invoice: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === 'invoice' && value) {
        data.append('invoice', value as File);
      } else if (key !== 'invoice' && value !== null) {
        data.append(key, value as string);
      }
    });
    data.append('usuario', localStorage.getItem('username') || '');

    await axios.post(`${API_URL}/receive`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
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
      invoice: null,
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
        setEditId(found.id);
        setEditForm({ ...found });
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

  return (
    <div style={{ maxWidth: 1200, margin: '32px auto', background: '#f5faff', borderRadius: 16, padding: 32 }}>
      <h1 style={{ color: '#1976d2', fontWeight: 800, fontSize: 32, marginBottom: 24 }}>Inventory Receipts</h1>
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

      {/* ADD RECEIPT FORM */}
      {showForm && (
        <div style={modalStyle} onClick={() => setShowForm(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            {/* ...formulario de agregar... */}
            {/* (sin cambios aquí) */}
            {/* ... */}
          </div>
        </div>
      )}

      {/* EDIT BY ID */}
      {showEditForm && (
        <div style={modalStyle} onClick={() => setShowEditForm(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            {/* ...formulario de editar... */}
            {/* (sin cambios aquí) */}
            {/* ... */}
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
          {receives.map((r, idx) => (
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
                {r.fecha ? new Date(r.fecha).toLocaleDateString() : ''}
              </td>
              <td style={{ padding: '8px 6px', borderRight: '1px solid #e3eaf2' }}>{r.sku}</td>
              <td style={{ padding: '8px 6px', borderRight: '1px solid #e3eaf2' }}>{r.item}</td>
              <td style={{ padding: '8px 6px', borderRight: '1px solid #e3eaf2' }}>{r.provider}</td>
              <td style={{ padding: '8px 6px', borderRight: '1px solid #e3eaf2' }}>{r.brand}</td>
              <td style={{ padding: '8px 6px', textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>{r.um}</td>
              <td style={{ padding: '8px 6px', textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>{r.destino_trailer}</td>
              <td style={{ padding: '8px 6px', textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>
                {r.invoice ? (
                  <a
                    href={`${API_URL}${r.invoice}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1976d2', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    View
                  </a>
                ) : (
                  <span style={{ color: '#888' }}>No file</span>
                )}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>{r.qty}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>{r.costTax}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>
                {r.qty && r.costTax ? (Number(r.qty) * Number(r.costTax)).toFixed(2) : ''}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>{r.totalPOClassic}</td>
              <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: r.estatus === 'PENDING' ? '#d32f2f' : '#388e3c' }}>
                {r.estatus}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReceiveInventory;