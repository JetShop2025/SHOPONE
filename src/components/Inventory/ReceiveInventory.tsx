import React, { useEffect, useState } from 'react';
import axios from 'axios';

const billToCoOptions = [
  "JETSHO","PRIGRE","GABGRE","GALGRE","RAN100","JCGLOG","JGTBAK","VIDBAK","JETGRE","ALLSAN","AGMGRE","TAYRET","TRUSAL","BRAGON","FRESAL","SEBSOL","LFLCOR","GARGRE","MCCGRE","LAZGRE","MEJADE"
];

function getTrailerOptions(billToCo: string): string[] {
  if (billToCo === "GALGRE") return Array.from({length: 54}, (_, i) => `1-${100+i}`);
  if (billToCo === "JETGRE") return Array.from({length: 16}, (_, i) => `2-${(i+1).toString().padStart(3, '0')}`);
  if (billToCo === "PRIGRE") return Array.from({length: 24}, (_, i) => `3-${(300+i).toString()}`);
  if (billToCo === "RAN100") return Array.from({length: 20}, (_, i) => `4-${(400+i).toString()}`);
  if (billToCo === "GABGRE") return Array.from({length: 30}, (_, i) => `5-${(500+i).toString()}`);
  return [];
}

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
    estatus: 'EN ESPERA'
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    axios.get('/inventory').then(res => setInventory(res.data as any[]));
    axios.get('/receive').then(res => setReceives(res.data as any[]));
  }, []);

  // Cuando seleccionas SKU, autocompleta los campos relacionados
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

    await axios.post('/receive', data, { headers: { 'Content-Type': 'multipart/form-data' } });
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
      estatus: 'EN ESPERA'
    });
    const res = await axios.get('/receive');
    setReceives(res.data as any[]);
  };

  const trailerOptions = getTrailerOptions(form.billToCo);

  const handleEditIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditId(Number(value));
    // Busca el registro cuando el usuario termina de escribir el ID
    const found = receives.find(r => r.id === Number(value));
    if (found) {
      setEditForm({ ...found });
    } else {
      setEditForm({ id: value }); // Limpia el form si no existe
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '32px auto', background: '#f5faff', borderRadius: 16, padding: 32 }}>
      <h1 style={{ color: '#1976d2', fontWeight: 800, fontSize: 32, marginBottom: 24 }}>Recepciones de Inventario</h1>
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
          Agregar Recepción
        </button>
        <button
          style={{
            background: '#fff',
            color: '#d32f2f',
            border: '1px solid #d32f2f',
            borderRadius: 6,
            padding: '10px 28px',
            fontWeight: 600,
            fontSize: 16,
            marginRight: 8,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(211,47,47,0.10)'
          }}
          onClick={() => setShowDeleteForm(!showDeleteForm)}
        >
          Eliminar
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
          onClick={() => setShowEditForm(!showEditForm)}
        >
          Modificar
        </button>
      </div>

      {/* FORMULARIO PARA AGREGAR RECEPCIÓN */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            marginBottom: 24,
            background: '#fff',
            padding: 32,
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(25,118,210,0.10)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
            alignItems: 'center',
            border: '1px solid #e3eaf2'
          }}
        >
          {/* DATE */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            DATE
            <input
              name="fecha"
              type="date"
              value={form.fecha}
              onChange={handleChange}
              required
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* SKU */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            SKU
            <input name="sku" value={form.sku} onChange={handleChange} required style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }} />
          </label>
          {/* ITEM */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            ITEM
            <input name="item" value={form.item} onChange={handleChange} style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }} />
          </label>
          {/* PROVIDER */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            PROVIDER
            <input name="provider" value={form.provider} onChange={handleChange} style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }} />
          </label>
          {/* BRAND */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            BRAND
            <input name="brand" value={form.brand} onChange={handleChange} style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }} />
          </label>
          {/* U/M */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            U/M
            <input name="um" value={form.um} onChange={handleChange} style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }} />
          </label>
          {/* Bill To Co */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            Bill To Co
            <select
              name="billToCo"
              value={form.billToCo}
              onChange={handleChange}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            >
              <option value="">Selecciona...</option>
              {billToCoOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          {/* TRL DE DESTINO */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            TRL DE DESTINO
            <select
              name="destino_trailer"
              value={form.destino_trailer}
              onChange={handleChange}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
              disabled={!form.billToCo}
            >
              <option value="">Selecciona...</option>
              {trailerOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          {/* INVOICE */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            INVOICE
            <input name="invoice" type="file" accept="application/pdf,image/*" onChange={handleFile} style={{ marginTop: 6 }} />
          </label>
          {/* QTY */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            QTY
            <input name="qty" type="number" value={form.qty} onChange={handleChange} style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }} />
          </label>
          {/* COST + TAX */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            COST + TAX
            <input name="costTax" type="number" value={form.costTax} onChange={handleChange} style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }} />
          </label>
          {/* TOTAL solo lectura */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            TOTAL
            <input
              value={
                form.qty && form.costTax
                  ? (Number(form.qty) * Number(form.costTax)).toFixed(2)
                  : ''
              }
              disabled
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3', background: '#f3f6fa' }}
            />
          </label>
          {/* P.O CLASSIC */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            P.O CLASSIC
            <input name="totalPOClassic" type="number" value={form.totalPOClassic} onChange={handleChange} style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }} />
          </label>
          {/* ESTATUS */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            ESTATUS
            <select
              name="estatus"
              value={form.estatus}
              onChange={handleChange}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            >
              <option value="EN ESPERA">EN ESPERA</option>
              <option value="USADO">USADO</option>
            </select>
          </label>
          {/* Botones */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
            <button type="submit" style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 28px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              Guardar
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: '#fff', color: '#1976d2', border: '1px solid #1976d2', borderRadius: 6, padding: '10px 28px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Eliminar múltiples */}
      {showDeleteForm && (
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (deletePassword !== '6214') {   // PASSWORD DE ELIMINACION EN RECEIVE
              alert('Password incorrecto');
              return;
            }
            await Promise.all(selectedIds.map(id =>
              axios.delete(`/receive/${id}`, {
                data: { usuario: localStorage.getItem('username') || '' }
              }as any)
            ));
            setDeletePassword('');
            setSelectedIds([]);
            setShowDeleteForm(false);
            const res = await axios.get('/receive');
            setReceives(res.data as any[]);
          }}
          style={{ marginBottom: 24, background: '#fffbe6', padding: 24, borderRadius: 8 }}
        >
          <h3 style={{ color: '#d32f2f' }}>Eliminar Recepciones Seleccionadas</h3>
          <label>
            Password:
            <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} style={{ marginLeft: 8 }} />
          </label>
          <button type="submit" style={{ marginLeft: 16, background: '#d32f2f', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            Confirmar Eliminar
          </button>
          <button type="button" onClick={() => { setShowDeleteForm(false); setSelectedIds([]); setDeletePassword(''); }} style={{ marginLeft: 8, background: '#fff', color: '#1976d2', border: '1px solid #1976d2', borderRadius: 6, padding: '8px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            Cancelar
          </button>
        </form>
      )}

      {/* Modificar por ID */}
      {showEditForm && (
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!editId) {
              alert('Selecciona un ID');
              return;
            }
            if (editPassword !== '6214') {
              alert('Password incorrecto');
              return;
            }
            const data = new FormData();
            Object.entries(editForm).forEach(([key, value]) => {
              if (key === 'invoice' && value) {
                data.append('invoice', value as File);
              } else if (key !== 'invoice' && value !== null) {
                data.append(key, value as string);
              }
            });
            await axios.put(`/receive/${editId}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            setEditId(null);
            setEditForm(null);
            setEditPassword('');
            setShowEditForm(false);
            const res = await axios.get('/receive');
            setReceives(res.data as any[]);
          }}
          style={{ marginBottom: 24, background: '#fffbe6', padding: 24, borderRadius: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}
        >
          {/* ID editable */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            ID
            <input
              value={editId ?? ''}
              onChange={handleEditIdChange}
              type="number"
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
              placeholder="Escribe el ID y presiona Enter"
            />
          </label>
          {/* DATE */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            DATE
            <input
              type="date"
              name="fecha"
              value={editForm?.fecha ? editForm.fecha.slice(0, 10) : ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, fecha: e.target.value }))}
              required
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* SKU */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            SKU
            <input
              name="sku"
              value={editForm?.sku ?? ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, sku: e.target.value }))}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* ITEM */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            ITEM
            <input
              name="item"
              value={editForm?.item ?? ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, item: e.target.value }))}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* PROVIDER */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            PROVIDER
            <input
              name="provider"
              value={editForm?.provider ?? ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, provider: e.target.value }))}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* BRAND */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            BRAND
            <input
              name="brand"
              value={editForm?.brand ?? ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, brand: e.target.value }))}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* U/M */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            U/M
            <input
              name="um"
              value={editForm?.um ?? ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, um: e.target.value }))}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* TRL DE DESTINO */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            TRL DE DESTINO
            <input
              name="destino_trailer"
              value={editForm?.destino_trailer ?? ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, destino_trailer: e.target.value }))}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* INVOICE */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            INVOICE
            <input
              name="invoice"
              type="file"
              accept="application/pdf,image/*"
              onChange={e => setEditForm((prev: any) => ({ ...prev, invoice: e.target.files?.[0] }))}
              style={{ marginTop: 6 }}
            />
            {editForm?.invoice && typeof editForm.invoice === 'string' && (
              <a
                href={`http://localhost:5050${editForm.invoice}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#1976d2', textDecoration: 'underline', marginTop: 4 }}
              >
                Ver archivo actual
              </a>
            )}
          </label>
          {/* QTY */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            QTY
            <input
              name="qty"
              type="number"
              value={editForm?.qty ?? ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, qty: e.target.value }))}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* COST + TAX */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            COST + TAX
            <input
              name="costTax"
              type="number"
              value={editForm?.costTax ?? ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, costTax: e.target.value }))}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* TOTAL solo lectura */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            TOTAL
            <input
              value={
                editForm?.qty && editForm?.costTax
                  ? (Number(editForm.qty) * Number(editForm.costTax)).toFixed(2)
                  : ''
              }
              disabled
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3', background: '#f3f6fa' }}
            />
          </label>
          {/* P.O CLASSIC */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            P.O CLASSIC
            <input
              name="totalPOClassic"
              type="number"
              value={editForm?.totalPOClassic ?? ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, totalPOClassic: e.target.value }))}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* ESTATUS */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            ESTATUS
            <select
              name="estatus"
              value={editForm?.estatus ?? ''}
              onChange={e => setEditForm((prev: any) => ({ ...prev, estatus: e.target.value }))}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            >
              <option value="EN ESPERA">EN ESPERA</option>
              <option value="USADO">USADO</option>
            </select>
          </label>
          {/* PASSWORD */}
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 600, color: '#1976d2' }}>
            Password
            <input
              type="password"
              value={editPassword}
              onChange={e => setEditPassword(e.target.value)}
              style={{ marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #b6c7e3' }}
            />
          </label>
          {/* BOTONES */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
            <button type="submit" style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 28px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              Guardar Cambios
            </button>
            <button type="button" onClick={() => { setShowEditForm(false); setEditId(null); setEditForm(null); setEditPassword(''); }} style={{ background: '#fff', color: '#1976d2', border: '1px solid #1976d2', borderRadius: 6, padding: '10px 28px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
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
            {showDeleteForm && (
              <th>
                <input
                  type="checkbox"
                  checked={selectedIds.length === receives.length && receives.length > 0}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedIds(receives.map(r => r.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              </th>
            )}
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>ID</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>DATE</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>SKU</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>ITEM</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>PROVIDER</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>BRAND</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>U/M</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>TRL DE DESTINO</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>INVOICE</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>QTY</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>COST + TAX</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>TOTAL</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>P.O CLASSIC</th>
            <th style={{ padding: '10px 8px', borderRight: '1px solid #e3eaf2' }}>ESTATUS</th>
          </tr>
        </thead>
        <tbody>
          {receives.map((r, idx) => (
            <tr
              key={r.id}
              style={{
                background: idx % 2 === 0 ? '#f9fafd' : '#fff',
                borderBottom: '1px solid #e3eaf2',
              }}
            >
              {showDeleteForm && (
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedIds([...selectedIds, r.id]);
                      } else {
                        setSelectedIds(selectedIds.filter(id => id !== r.id));
                      }
                    }}
                  />
                </td>
              )}
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
                    href={`http://localhost:5050${r.invoice}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1976d2', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    Ver
                  </a>
                ) : (
                  <span style={{ color: '#888' }}>Sin archivo</span>
                )}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>{r.qty}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>{r.costTax}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>
                {r.qty && r.costTax ? (Number(r.qty) * Number(r.costTax)).toFixed(2) : ''}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'right', borderRight: '1px solid #e3eaf2' }}>{r.totalPOClassic}</td>
              <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: r.estatus === 'PENDIENTE' ? '#d32f2f' : '#388e3c' }}>
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