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
  precio?: string;
  cantidad?: string;
  onHand?: string;
  [key: string]: string | undefined;
};

const API_URL = process.env.REACT_APP_API_URL || '';

const columns = [
  'SKU',
  'BAR CODE',
  'CATEGORY',
  'PART NAME',
  'PROVIDER',
  'BRAND',
  'U/M',
  'AREA',
  'RECEIVED',
  'WO OUTPUTS',
  'ON HAND',
  'IMAGE LINK',
  'PRICE (USD)'
];

const emptyPart: PartType = {
  sku: '', barCodes: '', category: '', part: '', provider: '', brand: '', um: '',
  area: '', imagen: '', precio: '', cantidad: '', onHand: ''
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
const inputStyle: React.CSSProperties = {
  flex: '1 1 120px',
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
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [editPart, setEditPart] = useState<PartType>({ ...emptyPart });
  const [editImagenFile, setEditImagenFile] = useState<File | null>(null);

  // Fetch inventory
  useEffect(() => {
    let isMounted = true;
    const fetchData = () => {
      axios.get(`${API_URL}/inventory`)
        .then(res => { if (isMounted) setInventory(res.data as any[]); })
        .catch(() => { if (isMounted) setInventory([]); });
    };
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  // Barcode auto
  useEffect(() => {
    if (newPart.sku) {
      setNewPart(prev => ({
        ...prev,
        barCodes: `BC-${prev.sku}`
      }));
    }
  }, [newPart.sku]);

  // Add Part
  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addPassword !== '6214') {
      setAddError('Incorrect password');
      return;
    }
    setAddError('');
    const data = new FormData();
    Object.entries(newPart).forEach(([key, value]) => {
      data.append(key, value || '');
    });
    data.append('usuario', localStorage.getItem('username') || '');

    try {
      await axios.post(`${API_URL}/inventory`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowForm(false);
      setNewPart({ ...emptyPart });
      const res = await axios.get(`${API_URL}/inventory`);
      setInventory(res.data as any[]);
    } catch (err: any) {
      setAddError(err.response?.data?.error || 'Error adding part');
    }
  };

  // Delete Part
  const handleDeletePart = async () => {
    if (deletePassword !== '6214' || selectedIdx === null) return;
    const part = inventory[selectedIdx];
    try {
      await axios.request({
        url: `${API_URL}/inventory/${part.sku}`,
        method: 'DELETE',
        data: { usuario: localStorage.getItem('username') || '' }
      });
      setShowDeleteForm(false);
      setSelectedIdx(null);
      const res = await axios.get(`${API_URL}/inventory`);
      setInventory(res.data as any[]);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error deleting part');
    }
  };

  // Edit Part
  const handleEditPart = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    try {
      await axios.put(`${API_URL}/inventory/${editPart.sku}`, {
        ...editPart,
        usuario: localStorage.getItem('username') || ''
      });
      setShowEditForm(false);
      setEditPart({ ...emptyPart });
      setSelectedIdx(null);
      const res = await axios.get(`${API_URL}/inventory`);
      setInventory(res.data as any[]);
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Error editing part');
    }
  };

  // Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPart({ ...newPart, [e.target.name]: e.target.value });
  };
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImagenFile(e.target.files[0]);
    }
  };
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditPart({ ...editPart, [e.target.name]: e.target.value });
  };
  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEditImagenFile(e.target.files[0]);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(90deg, #e3f2fd 0%, #ffffff 100%)',
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(25, 118, 210, 0.10)',
      maxWidth: 1800, // Aumenta el ancho máximo para evitar scroll horizontal
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
        <button onClick={() => setShowForm(true)} style={primaryBtn}>Add Part</button>
        <button
          onClick={async () => {
            if (selectedIdx !== null) {
              const pwd = window.prompt('Enter password to delete:');
              if (pwd === '6214') {
                setShowDeleteForm(true);
              } else if (pwd !== null) {
                alert('Incorrect password');
              }
            } else {
              alert('Selecciona una parte para eliminar');
            }
          }}
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
        >Delete</button>
        <button
          onClick={async () => {
            if (selectedIdx !== null) {
              const pwd = window.prompt('Enter password to edit:');
              if (pwd === '6214') {
                setEditPart({ ...inventory[selectedIdx] });
                setShowEditForm(true);
                setEditPassword('');
                setEditError('');
              } else if (pwd !== null) {
                alert('Incorrect password');
              }
            } else {
              alert('Selecciona una parte para editar');
            }
          }}
          style={secondaryBtn}
        >Edit</button>
      </div>

      {/* Add Part Modal */}
      {showForm && (
        <div style={modalStyle} onClick={() => setShowForm(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#1976d2', marginBottom: 16 }}>Add New Part</h3>
            <form onSubmit={handleAddPart} style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <input name="sku" value={newPart.sku} onChange={handleChange} placeholder="SKU" required style={inputStyle} />
              <input name="barCodes" value={newPart.barCodes} onChange={handleChange} placeholder="Bar Code" style={inputStyle} />
              <input name="category" value={newPart.category} onChange={handleChange} placeholder="Category" style={inputStyle} />
              <input name="part" value={newPart.part} onChange={handleChange} placeholder="Part Name" required style={inputStyle} />
              <input name="provider" value={newPart.provider} onChange={handleChange} placeholder="Provider" style={inputStyle} />
              <input name="brand" value={newPart.brand} onChange={handleChange} placeholder="Brand" style={inputStyle} />
              <input name="um" value={newPart.um} onChange={handleChange} placeholder="Unit" style={inputStyle} />
              <input name="area" value={newPart.area} onChange={handleChange} placeholder="Area" style={inputStyle} />
              <input
                name="precio"
                value={newPart.precio || ''}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  setNewPart({ ...newPart, precio: val });
                }}
                placeholder="Price"
                type="text"
                required
                style={inputStyle}
              />
              <input
                name="onHand"
                value={newPart.onHand || ''}
                onChange={handleChange}
                placeholder="On Hand"
                type="number"
                min={0}
                required
                style={inputStyle}
              />
              <input
                name="imagen"
                value={newPart.imagen || ''}
                onChange={handleChange}
                placeholder="Image Link (OneDrive, etc.)"
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password"
                value={addPassword}
                onChange={e => setAddPassword(e.target.value)}
                style={inputStyle}
              />
              {addError && <span style={{ color: 'red', width: '100%' }}>{addError}</span>}
              {/* Elimina el botón de Upload Image y el input file */}
              <div style={{ flexBasis: '100%', height: 0 }} />
              <button type="submit" style={primaryBtn}>Add Part</button>
              <button type="button" onClick={() => setShowForm(false)} style={secondaryBtn}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteForm && (
        <div style={modalStyle} onClick={() => setShowDeleteForm(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#d32f2f', marginBottom: 16 }}>Delete Part</h3>
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
              disabled={deletePassword !== '6214' || selectedIdx === null}
              style={{
                background: '#d32f2f',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 28px',
                fontWeight: 600,
                fontSize: 16,
                marginRight: 8,
                cursor: deletePassword !== '6214' || selectedIdx === null ? 'not-allowed' : 'pointer'
              }}
              onClick={handleDeletePart}
            >
              Delete Selected
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
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditForm && (
        <div style={modalStyle} onClick={() => setShowEditForm(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#1976d2', marginBottom: 16 }}>Edit Part</h3>
            <form onSubmit={handleEditPart} style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <input name="sku" value={editPart.sku} onChange={handleEditChange} placeholder="SKU" required style={inputStyle} disabled />
              <input name="barCodes" value={editPart.barCodes} onChange={handleEditChange} placeholder="Bar Codes" style={inputStyle} />
              <input name="category" value={editPart.category} onChange={handleEditChange} placeholder="Category" style={inputStyle} />
              <input name="part" value={editPart.part} onChange={handleEditChange} placeholder="Part Name" required style={inputStyle} />
              <input name="provider" value={editPart.provider} onChange={handleEditChange} placeholder="Provider" style={inputStyle} />
              <input name="brand" value={editPart.brand} onChange={handleEditChange} placeholder="Brand" style={inputStyle} />
              <input name="um" value={editPart.um} onChange={handleEditChange} placeholder="Unit" style={inputStyle} />
              <input name="area" value={editPart.area} onChange={handleEditChange} placeholder="Area" style={inputStyle} />
              <input
                name="precio"
                value={editPart.precio !== undefined ? editPart.precio : ''}
                onChange={e => {
                  // Permite solo números y formato de moneda
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  setEditPart({ ...editPart, precio: val });
                }}
                placeholder="Price"
                type="text"
                style={inputStyle}
              />
              <input
                name="imagen"
                value={editPart.imagen || ''}
                onChange={handleEditChange}
                placeholder="Image Link (OneDrive, etc.)"
                style={inputStyle}
              />
              <input
                name="onHand"
                value={editPart.onHand !== undefined ? editPart.onHand : ''}
                onChange={e => setEditPart({ ...editPart, onHand: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="On Hand"
                type="number"
                min={0}
                required
                style={inputStyle}
              />
              {editError && <span style={{ color: 'red', width: '100%' }}>{editError}</span>}
              <div style={{ flexBasis: '100%', height: 0 }} />
              <button type="submit" style={primaryBtn}>Save Changes</button>
              <button type="button" onClick={() => setShowEditForm(false)} style={secondaryBtn}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          minWidth: 1700, // Asegura que todas las columnas quepan y se vean completas
          tableLayout: 'fixed', // Hace que las columnas tengan el mismo ancho
          borderCollapse: 'collapse',
          background: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(25,118,210,0.07)'
        }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col} style={{
                  border: '1px solid #1976d2',
                  padding: 8,
                  background: '#1976d2',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13, // más pequeño
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  letterSpacing: 1
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inventory.map((item, idx) => (
              <tr
                key={idx}
                style={{
                  background: selectedIdx === idx ? '#e3f2fd' : (idx % 2 === 0 ? '#f9fafd' : '#fff'),
                  cursor: 'pointer',
                  fontSize: 12 // más pequeño para el contenido
                }}
                onClick={() => setSelectedIdx(idx)}
              >
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', wordBreak: 'break-all', maxWidth: 120 }}>{item.sku}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', maxWidth: 90, overflow: 'hidden' }}>
                  {item.barCodes && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                      <Barcode
                        value={item.barCodes.toString()}
                        width={1}
                        height={18}
                        fontSize={8}
                        margin={0}
                        displayValue={false} // Oculta el texto debajo del código de barras
                        background="#fff"
                      />
                    </div>
                  )}
                </td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', wordBreak: 'break-word', maxWidth: 120 }}>{item.category}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', wordBreak: 'break-word', maxWidth: 140 }}>{item.part}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', wordBreak: 'break-word', maxWidth: 120 }}>{item.provider}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', wordBreak: 'break-word', maxWidth: 100 }}>{item.brand}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', maxWidth: 60 }}>{item.um}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', maxWidth: 80 }}>{item.area}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', maxWidth: 80 }}>{item.receive ?? ''}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', maxWidth: 80 }}>{item.salidasWo ?? ''}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', maxWidth: 80 }}>{item.onHand ?? ''}</td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', maxWidth: 120, wordBreak: 'break-all' }}>
                  {item.imagen ? (
                    <a
                      href={item.imagen}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}
                    >
                      IMG
                    </a>
                  ) : (
                    'No image'
                  )}
                </td>
                <td style={{ border: '1px solid #b0c4de', padding: 6, textAlign: 'center', maxWidth: 80 }}>
                  {item.precio ? Number(item.precio).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryTable;