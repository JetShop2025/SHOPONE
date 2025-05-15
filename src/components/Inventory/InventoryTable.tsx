import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Barcode from 'react-barcode'; 

type PartType = {
  sku: string;
  barCodes: string;
  category: string;
  part: string;
  provider: string;
  brand: string;
  um: string;
  area: string;
  imagen: string;
  [key: string]: string; // <-- Esto permite indexar por string
};

const API_URL = process.env.REACT_APP_API_URL || '';

const columns = [
  'SKU', 'BAR CODES', 'CATEGORY', 'PART', 'PROVIDER', 'BRAND', 'U/M', 'AREA',
  'RECEIVE', 'SALIDAS W.O.', 'ON HAND', 'IMAGEN', 'PRECIO'
];

const emptyPart: PartType = {
  sku: '', barCodes: '', category: '', part: '', provider: '', brand: '', um: '',
  area: '', imagen: ''
};

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
  maxWidth: 420,
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 4px 24px rgba(25,118,210,0.10)'
};

const InventoryTable: React.FC = () => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newPart, setNewPart] = useState<PartType>({ ...emptyPart });
  const [cantidad, setCantidad] = useState<number>(0);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [addPassword, setAddPassword] = useState('');
  const [addError, setAddError] = useState('');
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [editStep, setEditStep] = useState<'ask' | 'form' | null>(null);
  const [editSku, setEditSku] = useState('');
  const [editPart, setEditPart] = useState<PartType>({ ...emptyPart });
  const [editImagenFile, setEditImagenFile] = useState<File | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = () => {
      axios.get(`${API_URL}/inventory`)
        .then(res => { if (isMounted) setInventory(res.data as any[]); })
        .catch(() => { if (isMounted) setInventory([]); });
    };
    fetchData();
    const interval = setInterval(fetchData, 4000); // cada 4 segundos
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  // Actualiza barCodes automáticamente cuando cambia el SKU
  useEffect(() => {
    if (newPart.sku) {
      setNewPart(prev => ({
        ...prev,
        barCodes: `BC-${prev.sku}` // Puedes cambiar el formato aquí
      }));
    }
  }, [newPart.sku]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPart({ ...newPart, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImagenFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addPassword !== '6214') {
      setAddError('Password incorrecto');
      return;
    }
    setAddError('');
    const data = new FormData();
    Object.entries(newPart).forEach(([key, value]) => {
      data.append(key, value);
    });
    data.append('cantidad', cantidad.toString());
    if (imagenFile) {
      data.append('imagen', imagenFile);
    }
    data.append('usuario', localStorage.getItem('username') || '');

    await axios.post(`${API_URL}/inventory`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setShowForm(false);
    setNewPart({ ...emptyPart });
    setCantidad(0);
    setImagenFile(null);
    const res = await axios.get(`${API_URL}/inventory`);
    setInventory(res.data as any[]);
  };

  return (
    <div style={{
      background: 'linear-gradient(90deg, #e3f2fd 0%, #ffffff 100%)',
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(25, 118, 210, 0.10)',
      maxWidth: 1400,
      margin: '32px auto',
      padding: 32
    }}>
      <h1 style={{
        color: '#1976d2',
        fontWeight: 800,
        letterSpacing: 2,
        fontSize: 36,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center'
      }}>
        <span style={{
          display: 'inline-block',
          background: '#1976d2',
          color: '#fff',
          borderRadius: '50%',
          width: 48,
          height: 48,
          textAlign: 'center',
          lineHeight: '48px',
          marginRight: 16,
          fontSize: 28,
          fontWeight: 900,
          boxShadow: '0 2px 8px rgba(25, 118, 210, 0.15)'
        }}>INV</span>
        Inventory
      </h1>
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 28px',
            fontWeight: 600,
            fontSize: 16,
            marginBottom: 24,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
          }}
        >
          Agregar Parte
        </button>
        <button
          onClick={() => setShowDeleteForm(true)}
          style={{
            background: '#fff',
            color: '#d32f2f',
            border: '1px solid #d32f2f',
            borderRadius: 6,
            padding: '10px 28px',
            fontWeight: 600,
            fontSize: 16,
            marginLeft: 8,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(211,47,47,0.10)'
          }}
        >
          Eliminar
        </button>
        <button
          onClick={() => {
            setShowEditForm(true);
            setEditStep('ask');
            setEditSku('');
            setEditPassword('');
            setEditError('');
          }}
          style={{
            background: '#fff',
            color: '#1976d2',
            border: '1px solid #1976d2',
            borderRadius: 6,
            padding: '10px 28px',
            fontWeight: 600,
            fontSize: 16,
            marginLeft: 8,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
          }}
        >
          Modificar
        </button>
      </div>
      {showForm && (
        <div style={modalStyle} onClick={() => setShowForm(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#1976d2', marginBottom: 16 }}>Agregar Nueva Parte</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <input name="sku" value={newPart.sku} onChange={handleChange} placeholder="SKU" required style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
              <input name="barCodes" value={newPart.barCodes} onChange={handleChange} placeholder="Bar Codes" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
              <input name="category" value={newPart.category} onChange={handleChange} placeholder="Categoría" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
              <input name="part" value={newPart.part} onChange={handleChange} placeholder="Nombre de parte" required style={{ flex: '2 1 200px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
              <input name="provider" value={newPart.provider} onChange={handleChange} placeholder="Proveedor" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
              <input name="brand" value={newPart.brand} onChange={handleChange} placeholder="Marca" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
              <input name="um" value={newPart.um} onChange={handleChange} placeholder="Unidad de medida" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
              <input name="area" value={newPart.area} onChange={handleChange} placeholder="Área" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
              <input name="cantidad" value={cantidad} onChange={e => setCantidad(Number(e.target.value))} placeholder="Cantidad" type="number" required style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
              <input
                type="password"
                placeholder="Password"
                value={addPassword}
                onChange={e => setAddPassword(e.target.value)}
                style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }}
              />
              {addError && <span style={{ color: 'red', width: '100%' }}>{addError}</span>}
              <button type="button" onClick={() => document.getElementById('imagenInput')?.click()} style={{
                background: '#fff',
                color: '#1976d2',
                border: '1px solid #1976d2',
                borderRadius: 6,
                padding: '8px 18px',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer'
              }}>
                Subir Imagen
              </button>
              <input
                id="imagenInput"
                name="imagen"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageChange}
              />
              {imagenFile && <span style={{ color: '#1976d2', fontWeight: 500 }}>Imagen seleccionada: {imagenFile.name}</span>}
              <div style={{ flexBasis: '100%', height: 0 }} />
              <button type="submit" style={{
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 28px',
                fontWeight: 600,
                fontSize: 16,
                marginRight: 8,
                cursor: 'pointer'
              }}>Agregar Parte</button>
              <button type="button" onClick={() => setShowForm(false)} style={{
                background: '#fff',
                color: '#1976d2',
                border: '1px solid #1976d2',
                borderRadius: 6,
                padding: '10px 28px',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                marginTop: 12
              }}>Cancelar</button>
            </form>
          </div>
        </div>
      )}
      {showDeleteForm && (
        <div style={modalStyle} onClick={() => setShowDeleteForm(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#d32f2f', marginBottom: 16 }}>Eliminar Partes Seleccionadas</h3>
            <div style={{ marginBottom: 12 }}>
              <label>
                Password:
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #b0c4de' }}
                />
              </label>
            </div>
            <button
              disabled={deletePassword !== '6214' || selectedIds.length === 0}
              style={{
                background: '#d32f2f',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 28px',
                fontWeight: 600,
                fontSize: 16,
                marginRight: 8,
                cursor: deletePassword !== '6214' || selectedIds.length === 0 ? 'not-allowed' : 'pointer'
              }}
              onClick={async () => {
                // Elimina por ID real si tienes un campo id, aquí por índice
                const toDelete = selectedIds.map(idx => inventory[idx]);
                for (const part of toDelete) {
                  await axios.request({
                    url: `${API_URL}/inventory/${part.sku}`,
                    method: 'DELETE',
                    data: { usuario: localStorage.getItem('username') || '' }
                  });
                }
                setShowDeleteForm(false);
                setSelectedIds([]);
              }}
            >
              Eliminar seleccionados
            </button>
            <button
              onClick={() => setShowDeleteForm(false)}
              style={{
                background: '#fff',
                color: '#d32f2f',
                border: '1px solid #d32f2f',
                borderRadius: 6,
                padding: '10px 28px',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                marginTop: 12
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {showEditForm && editStep === 'ask' && (
        <div style={modalStyle} onClick={() => setShowEditForm(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#1976d2', marginBottom: 16 }}>Modificar Parte</h3>
            {/* ...tu formulario aquí... */}
            <button
              type="button"
              onClick={() => setShowEditForm(false)}
              style={{
                background: '#fff',
                color: '#1976d2',
                border: '1px solid #1976d2',
                borderRadius: 6,
                padding: '10px 28px',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                marginTop: 12
              }}
            >Cancelar</button>
          </div>
        </div>
      )}
      {showEditForm && editStep === 'form' && (
        <div style={{
          border: '1px solid #1976d2',
          padding: 24,
          marginBottom: 24,
          background: '#f5faff',
          maxWidth: 700,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(25,118,210,0.07)'
        }}>
          <h3 style={{ color: '#1976d2', marginBottom: 16 }}>Editar Parte</h3>
          <form
            onSubmit={async e => {
              e.preventDefault();
              if (editImagenFile) {
                const data = new FormData();
                Object.entries(editPart).forEach(([key, value]) => {
                  data.append(key, value ?? '');
                });
                data.append('imagen', editImagenFile);
                data.append('usuario', localStorage.getItem('username') || ''); 
                await axios.put(`${API_URL}/inventory/${editPart.sku}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
                });
              } else {
                await axios.put(`${API_URL}/inventory/${editPart.sku}`, {
                  ...editPart,
                  usuario: localStorage.getItem('username') || ''
          });
              }
              setShowEditForm(false);
              setEditStep(null);
              setEditSku('');
              setEditPassword('');
              setEditPart({ ...emptyPart });
              setEditImagenFile(null);
              const res = await axios.get(`${API_URL}/inventory`);
              setInventory(res.data as any[]);
            }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
          >
            <input name="sku" value={editPart.sku} disabled style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de', background: '#eee' }} />
            <input name="barCodes" value={editPart.barCodes} onChange={e => setEditPart({ ...editPart, barCodes: e.target.value })} placeholder="Bar Codes" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <input name="category" value={editPart.category} onChange={e => setEditPart({ ...editPart, category: e.target.value })} placeholder="Categoría" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <input name="part" value={editPart.part} onChange={e => setEditPart({ ...editPart, part: e.target.value })} placeholder="Nombre de parte" style={{ flex: '2 1 200px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <input name="provider" value={editPart.provider} onChange={e => setEditPart({ ...editPart, provider: e.target.value })} placeholder="Proveedor" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <input name="brand" value={editPart.brand} onChange={e => setEditPart({ ...editPart, brand: e.target.value })} placeholder="Marca" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <input name="um" value={editPart.um} onChange={e => setEditPart({ ...editPart, um: e.target.value })} placeholder="Unidad de medida" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <input name="area" value={editPart.area} onChange={e => setEditPart({ ...editPart, area: e.target.value })} placeholder="Área" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <input name="receive" value={editPart.receive || ''} onChange={e => setEditPart({ ...editPart, receive: e.target.value })} placeholder="Receive" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <input name="salidasWo" value={editPart.salidasWo || ''} onChange={e => setEditPart({ ...editPart, salidasWo: e.target.value })} placeholder="Salidas W.O." style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <input name="onHand" value={editPart.onHand || ''} onChange={e => setEditPart({ ...editPart, onHand: e.target.value })} placeholder="On Hand" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <input name="precio" value={editPart.precio || ''} onChange={e => setEditPart({ ...editPart, precio: e.target.value })} placeholder="Precio" style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }} />
            <div style={{ flexBasis: '100%', height: 0 }} />
            <div style={{ flexBasis: '100%' }}>
              {editPart.imagen ? (
                <a
                  href={`${API_URL}${editPart.imagen}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer', marginRight: 12 }}
                >
                  Ver Imagen Actual
                </a>
              ) : (
                <span style={{ color: '#888' }}>Sin imagen</span>
              )}
              <button
                type="button"
                onClick={() => document.getElementById('editImagenInput')?.click()}
                style={{
                  background: '#fff',
                  color: '#1976d2',
                  border: '1px solid #1976d2',
                  borderRadius: 6,
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: 15,
                  marginLeft: 12,
                  cursor: 'pointer'
                }}
              >
                Actualizar Imagen
              </button>
              <input
                id="editImagenInput"
                name="imagen"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setEditImagenFile(e.target.files[0]);
                  }
                }}
              />
              {editImagenFile && (
                <span style={{ color: '#1976d2', fontWeight: 500, marginLeft: 8 }}>
                  Nueva imagen: {editImagenFile.name}
                </span>
              )}
            </div>
            <button type="submit" style={{
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 28px',
              fontWeight: 600,
              fontSize: 16,
              marginRight: 8,
              cursor: 'pointer'
            }}>Guardar Cambios</button>
            <button type="button" onClick={() => setShowEditForm(false)} style={{
              background: '#fff',
              color: '#1976d2',
              border: '1px solid #1976d2',
              borderRadius: 6,
              padding: '10px 28px',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer'
            }}>Cancelar</button>
          </form>
        </div>
      )}
      {showEditForm && selectedIds.length === 1 && (
        <div style={{
          border: '1px solid #1976d2',
          padding: 24,
          marginBottom: 24,
          background: '#f5faff',
          maxWidth: 700,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(25,118,210,0.07)'
        }}>
          <h3 style={{ color: '#1976d2', marginBottom: 16 }}>Modificar Parte</h3>
          <form onSubmit={async e => {
            e.preventDefault();
            if (editPassword !== 'tu_password') {
              setEditError('Password incorrecto');
              return;
            }
            setEditError('');
            // Aquí tu lógica para modificar la parte seleccionada
            // Por ejemplo, usa inventory[selectedIds[0]] para obtener la parte
            // y haz un PUT o PATCH a tu backend
            setShowEditForm(false);
            setSelectedIds([]);
            setEditPassword('');
            const res = await axios.get(`${API_URL}/inventory`);
            setInventory(res.data as any[]);
          }} style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {/* Aquí los campos para editar, puedes rellenarlos con el estado de la parte seleccionada */}
            <input
              type="password"
              placeholder="Password"
              value={editPassword}
              onChange={e => setEditPassword(e.target.value)}
              style={{ flex: '1 1 120px', padding: 8, borderRadius: 6, border: '1px solid #b0c4de' }}
            />
            {editError && <span style={{ color: 'red', width: '100%' }}>{editError}</span>}
            <button type="submit" style={{
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 28px',
              fontWeight: 600,
              fontSize: 16,
              marginRight: 8,
              cursor: 'pointer'
            }}>Guardar Cambios</button>
            <button type="button" onClick={() => setShowEditForm(false)} style={{
              background: '#fff',
              color: '#1976d2',
              border: '1px solid #1976d2',
              borderRadius: 6,
              padding: '10px 28px',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer'
            }}>Cancelar</button>
          </form>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          tableLayout: 'auto',
          borderCollapse: 'collapse',
          background: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(25,118,210,0.07)'
        }}>
          <thead>
            <tr>
              {showDeleteForm && (
                <th style={{
                  padding: 8,
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word',
                  textAlign: 'center'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === inventory.length && inventory.length > 0}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedIds(inventory.map((_, idx) => idx));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </th>
              )}
              {columns.map(col => (
                <th key={col} style={{
                  border: '1px solid #1976d2',
                  padding: 8,
                  background: '#1976d2',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word',
                  textAlign: 'center'
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inventory.map((item, idx) => (
              <tr key={idx}>
                {showDeleteForm && (
                  <td style={{ textAlign: 'center', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(idx)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedIds([...selectedIds, idx]);
                        } else {
                          setSelectedIds(selectedIds.filter(id => id !== idx));
                        }
                      }}
                    />
                  </td>
                )}
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.sku}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>
                  {item.barCodes && <Barcode value={item.barCodes.toString()} width={2} height={40} fontSize={14} />}
                </td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.category}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.part}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.provider}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.brand}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.um}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.area}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.receive ?? ''}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.salidasWo ?? ''}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.onHand ?? ''}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>
                  {item.imagen ? (
                    <a
                      href={`${API_URL}${item.imagen}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      IMG
                    </a>
                  ) : (
                    'Sin imagen'
                  )}
                </td>
                <td style={{ border: '1px solid #b0c4de', padding: 8, whiteSpace: 'pre-line', wordBreak: 'break-word', textAlign: 'center' }}>{item.precio ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};	

export default InventoryTable;
