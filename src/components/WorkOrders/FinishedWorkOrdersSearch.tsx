import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import HourmeterModal from './HourmeterModal';
import WorkOrderForm from './WorkOrderForm';
import { generateWorkOrderPDF, openPDFInNewTab } from '../../utils/pdfGenerator';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';
const FINISHED_WO_CACHE_TTL_MS = 5 * 60 * 1000;

// All available clients (same as in WorkOrdersTable)
const billToCoOptions = [
  "JETSHO","PRIGRE","GABGRE","GALGRE","RAN100","JCGLOG","JGTBAK","VIDBAK","JETGRE","ALLSAN","AGMGRE","TAYRET","TRUSAL","BRAGON","FRESAL","SEBSOL","LFLCOR","GARGRE","MCCGRE","LAZGRE","MEJADE","CHUSAL"
];

// Get trailer options by client (same as in WorkOrdersTable)
function getTrailerOptions(billToCo: string): string[] {
  if (billToCo === "GALGRE") {
    const especiales = [
      "1-100 TRK",
      "1-103 TRK",
      "1-101 TRK",
      "1-102 TRK",
      "1-105 TRK",
      "1-106 TRK",
      "1-107 TRK",
      "1-111 TRK"
    ];
    const normales = Array.from({length: 54}, (_, i) => `1-${100+i}`);
    return [...especiales, ...normales];
  }
  if (billToCo === "JETGRE") {
    const especiales = ["2-01 TRK"];
    const normales = Array.from({length: 16}, (_, i) => `2-${(i+1).toString().padStart(3, '0')}`);
    return [...especiales, ...normales];
  }
  if (billToCo === "PRIGRE") return Array.from({length: 24}, (_, i) => `3-${(300+i).toString()}`);
  if (billToCo === "RAN100") return Array.from({length: 20}, (_, i) => `4-${(400+i).toString()}`);
  if (billToCo === "GABGRE") return Array.from({length: 30}, (_, i) => `5-${(500+i).toString()}`);
  return [];
}

// Styled Components
const Container = styled.div`
  padding: 20px;
  background: #f5f5f5;
  min-height: 100vh;
`;

const SearchModeToggle = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  
  button {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    background: #f0f0f0;
    color: #333;
    
    &.active {
      background: #0A3854;
      color: white;
    }
    
    &:hover {
      background: ${props => props.theme?.colors?.primary || '#0A3854'};
      color: white;
    }
  }
`;

const SearchContainer = styled.div`
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 25px;
`;

const SearchLabel = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.3s;
  
  &:focus {
    outline: none;
    border-color: #0A3854;
    box-shadow: 0 0 0 3px rgba(10, 56, 84, 0.1);
  }
`;

const SearchSelect = styled.select`
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: border-color 0.3s;
  
  &:focus {
    outline: none;
    border-color: #0A3854;
    box-shadow: 0 0 0 3px rgba(10, 56, 84, 0.1);
  }
`;

const SearchButton = styled.button`
  width: 100%;
  padding: 12px;
  background: #0A3854;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
  margin-top: 15px;
  
  &:hover {
    background: #082a40;
  }
  
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const ResultsContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
`;

const DetailPanel = styled.div`
  padding: 25px;
`;

const DetailTitle = styled.h2`
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #0A3854;
  border-bottom: 2px solid #0A3854;
  padding-bottom: 10px;
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 25px;
`;

const DetailField = styled.div`
  display: flex;
  flex-direction: column;
  
  label {
    font-size: 12px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  
  div {
    font-size: 14px;
    color: #333;
    font-weight: 500;
  }
`;

const PartsSection = styled.div`
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
`;

const PartsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
  
  thead {
    background: #f0f0f0;
    
    th {
      padding: 12px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #666;
      border-bottom: 2px solid #e0e0e0;
    }
  }
  
  tbody {
    tr:nth-child(odd) {
      background: #fafafa;
    }
    
    td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 13px;
    }
  }
`;

const ReportSection = styled.div`
  margin-top: 30px;
`;

const ReportStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
  
  .stat-card {
    background: linear-gradient(135deg, #f5f9fc 0%, #eaf2f8 100%);
    border-left: 4px solid #0A3854;
    padding: 15px;
    border-radius: 8px;
    
    .stat-label {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #0A3854;
    }
  }
`;

const ReportTable = styled(PartsTable)`
  margin-top: 20px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
  
  button {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    
    &.primary {
      background: #0A3854;
      color: white;
      
      &:hover {
        background: #082a40;
      }
    }
    
    &.secondary {
      background: #f0f0f0;
      color: #333;
      border: 1px solid #e0e0e0;
      
      &:hover {
        background: #e0e0e0;
      }
    }
  }
`;

const LoadingText = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 14px;
`;

const ErrorText = styled.div`
  background: #fee;
  border: 1px solid #fcc;
  color: #c33;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
`;

const SuccessText = styled.div`
  background: #efe;
  border: 1px solid #cfc;
  color: #3c3;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
`;

const EditModalOverlay = styled.div<{ show?: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.show ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const EditModalContent = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  width: 95%;
  padding: 30px;
`;

interface WorkOrder {
  id: number;
  idClassic?: string;
  billToCo?: string;
  trailer?: string;
  date?: string;
  mechanic?: string;
  mechanics?: any[];
  description?: string;
  status?: string;
  totalLabAndParts?: number;
  totalHrs?: number;
  parts?: any[];
  [key: string]: any;
}

interface UnitStats {
  totalWOs: number;
  totalRevenue: number;
  totalHours: number;
  averageRevenuePerWO: number;
  dateRange: { earliest: string; latest: string };
}

const FinishedWorkOrdersSearch: React.FC = () => {
  const [searchMode, setSearchMode] = useState<'by-wo' | 'by-unit'>('by-wo');
  
  // Search by W.O ID
  const [woSearchInput, setWoSearchInput] = useState('');
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [woLoading, setWoLoading] = useState(false);
  const [woError, setWoError] = useState('');
  
  // Search by Unit/Trailer
  const [clientSearchInput, setClientSearchInput] = useState('');
  const [unitSearchInput, setUnitSearchInput] = useState('');
  const [allFinishedWOs, setAllFinishedWOs] = useState<WorkOrder[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitReferenceError, setUnitReferenceError] = useState('');
  const [unitWOs, setUnitWOs] = useState<WorkOrder[]>([]);
  const [unitStats, setUnitStats] = useState<UnitStats | null>(null);
  const [unitError, setUnitError] = useState('');
  
  // Inventory — loaded once at mount to resolve PDF invoice links
  const [inventory, setInventory] = useState<any[]>([]);

  // In-memory cache for finished WOs (avoids sessionStorage quota errors)
  const finishedWOCache = React.useRef<{ ts: number; data: WorkOrder[] } | null>(null);

  // Hourmeter state
  const [showHourmeter, setShowHourmeter] = useState(false);
  const [hourmeterWOs, setHourmeterWOs] = useState<WorkOrder[]>([]);

  // Edit mode state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWO, setEditingWO] = useState<WorkOrder | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Load inventory once for invoice-link resolution in PDFs
  useEffect(() => {
    axios.get(`${API_URL}/inventory`, { timeout: 15000 })
      .then(res => setInventory(Array.isArray(res.data) ? res.data : []))
      .catch(() => setInventory([]));
  }, []);
  
  const availableClients = billToCoOptions;
  
  const availableUnits = React.useMemo(() => {
    return clientSearchInput ? getTrailerOptions(clientSearchInput) : [];
  }, [clientSearchInput]);

  const loadFinishedReferenceData = useCallback(async (forceRefresh = false): Promise<WorkOrder[]> => {
    if (!forceRefresh) {
      const cached = finishedWOCache.current;
      if (cached && Array.isArray(cached.data) && (Date.now() - cached.ts) < FINISHED_WO_CACHE_TTL_MS) {
        setAllFinishedWOs(cached.data);
        setUnitReferenceError('');
        return cached.data;
      }
    }

    try {
      setUnitsLoading(true);
      setUnitReferenceError('');

      const res = await axios.get(`${API_URL}/work-orders`, {
        params: { status: 'FINISHED', pageSize: 10000 },
        timeout: 30000,
      });

      const allWOs = (res.data?.data || res.data || []) as WorkOrder[];
      setAllFinishedWOs(allWOs);
      // Store in memory only — avoids sessionStorage quota errors with large datasets
      finishedWOCache.current = { ts: Date.now(), data: allWOs };

      return allWOs;
    } catch (err) {
      console.error('Error loading finished work orders:', err);
      setUnitReferenceError('Could not load client/unit list. Please retry.');
      return [];
    } finally {
      setUnitsLoading(false);
    }
  }, []);

  // Load reference data only when user opens the Unit search mode.
  useEffect(() => {
    if (searchMode !== 'by-unit') return;
    if (allFinishedWOs.length > 0) return;
    void loadFinishedReferenceData();
  }, [searchMode, allFinishedWOs.length, loadFinishedReferenceData]);
  
  // Load W.O details
  const loadWorkOrderDetails = useCallback(async (orderId: number): Promise<boolean> => {
    try {
      setWoLoading(true);
      setWoError('');
      
      const [woRes, partsRes] = await Promise.all([
        axios.get(`${API_URL}/work-orders/${orderId}`),
        axios.get(`${API_URL}/work-order-parts/${orderId}`).catch(() => ({ data: [] }))
      ]);
      
      const wo = woRes.data || {};
      // Prefer embedded JSON parts on FINISHED W.O. to avoid repeated historical rows
      // in work_order_parts. Fallback to relational rows if embedded parts are missing.
      const rawParts = Array.isArray(partsRes.data) ? partsRes.data : [];
      const embeddedParts = (() => {
        if (Array.isArray(wo.parts)) return wo.parts;
        if (typeof wo.parts === 'string') { try { return JSON.parse(wo.parts); } catch { return []; } }
        return [];
      })();
      const normalizeAndDedupeParts = (sourceParts: any[]) => {
        const seen = new Set<string>();
        return sourceParts
          .map((part: any) => {
            const sku = String(part.sku || '').trim();
            const inventoryItem = inventory.find((item: any) =>
              String(item.sku || '').trim().toLowerCase() === sku.toLowerCase()
            );
            const invoiceLink =
              part.invoiceLink || part.invoice_link ||
              inventoryItem?.invoiceLink || inventoryItem?.invoice_link || null;
            const qty = Number(part.qty_used ?? part.qty) || 0;
            const normalized = {
              ...part,
              sku,
              part: part.part || part.part_name || part.description || '',
              part_name: part.part_name || part.part || part.description || '',
              qty,
              qty_used: qty,
              cost: Number(String(part.cost ?? 0).replace(/[^0-9.]/g, '')) || 0,
              invoiceLink,
              invoice_link: invoiceLink,
            };
            const signature = [
              String(normalized.sku || '').trim().toLowerCase(),
              String(normalized.part || '').trim().toLowerCase(),
              String(normalized.qty ?? '').trim(),
              String(normalized.cost ?? '').trim(),
              String(normalized.invoiceLink || '').trim(),
            ].join('|');
            if (seen.has(signature)) return null;
            seen.add(signature);
            return normalized;
          })
          .filter(Boolean) as any[];
      };

      const normalizedEmbedded = normalizeAndDedupeParts(Array.isArray(embeddedParts) ? embeddedParts : []);
      const normalizedRows = normalizeAndDedupeParts(rawParts);
      const normalizedParts = normalizedEmbedded.length > 0 ? normalizedEmbedded : normalizedRows;

      setSelectedWO({
        ...wo,
        parts: normalizedParts,
        _partsLoaded: true
      });
      return true;
    } catch (err) {
      setWoError('Work order not found');
      setSelectedWO(null);
      return false;
    } finally {
      setWoLoading(false);
    }
  }, []);
  
  // Search by ID Classic (non-numeric input)
  const loadWorkOrderDetailsByClassic = useCallback(async (idClassic: string): Promise<boolean> => {
    setWoLoading(true);
    setWoError('');
    try {
      const normalizedClassic = String(idClassic).trim().toLowerCase();

      const res = await axios.get(`${API_URL}/work-orders`, {
        params: { searchIdClassic: idClassic, status: 'FINISHED', pageSize: 500 }
      });
      const responseRows = Array.isArray(res.data)
        ? res.data
        : (Array.isArray(res.data?.data) ? res.data.data : []);

      // Some API deployments ignore searchIdClassic and return a generic list.
      // Filter client-side to guarantee exact ID Classic matching.
      let results = responseRows.filter((wo: any) =>
        String(wo?.idClassic || '').trim().toLowerCase() === normalizedClassic
      );

      // Fallback: if searchIdClassic query returns empty (or backend behaves inconsistently),
      // load finished WOs and match locally by idClassic.
      if (results.length === 0) {
        const fallbackRes = await axios.get(`${API_URL}/work-orders`, {
          params: { status: 'FINISHED', pageSize: 10000 },
          timeout: 30000,
        });
        const fallbackRows = Array.isArray(fallbackRes.data)
          ? fallbackRes.data
          : (Array.isArray(fallbackRes.data?.data) ? fallbackRes.data.data : []);

        results = fallbackRows.filter((wo: any) =>
          String(wo?.idClassic || '').trim().toLowerCase() === normalizedClassic
        );
      }

      if (results.length === 0) {
        setWoError('Work order not found');
        setSelectedWO(null);
        setWoLoading(false);
        return false;
      }
      // Prefer FINISHED; otherwise take the most recent match
      const match = results.find((wo: any) => wo.status === 'FINISHED') || results[0];
      // Delegate to normal loader — it will manage loading state
      return await loadWorkOrderDetails(match.id);
    } catch {
      setWoError('Work order not found');
      setSelectedWO(null);
      setWoLoading(false);
      return false;
    }
  }, [loadWorkOrderDetails]);

  // Search by W.O ID — Hybrid search: ID Classic or System ID
  const handleSearchWO = async () => {
    const searchId = woSearchInput.trim();
    if (!searchId) {
      setWoError('Enter a W.O # or ID Classic');
      return;
    }

    setWoLoading(true);
    setWoError('');
    
    try {
      // STEP 1: Try ID Classic search first
      const foundByClassic = await loadWorkOrderDetailsByClassic(searchId);
      if (foundByClassic) {
        setWoLoading(false);
        return;
      }

      // STEP 2: If not found by ID Classic, try System ID search
      const systemId = Number(searchId);
      if (Number.isFinite(systemId) && systemId > 0) {
        const found = await loadWorkOrderDetails(systemId);
        if (found) {
          setWoLoading(false);
          return;
        }
      }

      // STEP 3: No results in either field
      setWoError('Work order not found by ID Classic or System ID');
      setSelectedWO(null);
    } catch (error) {
      setWoError('Error searching work orders');
      setSelectedWO(null);
    } finally {
      setWoLoading(false);
    }
  };
  
  // Search by Unit/Trailer
  const handleSearchUnit = async () => {
    if (!clientSearchInput.trim()) {
      setUnitError('Select a client first');
      return;
    }

    if (!unitSearchInput.trim()) {
      setUnitError('Select a unit');
      return;
    }
    
    try {
      setUnitError('');

      const sourceWOs = allFinishedWOs.length > 0
        ? allFinishedWOs
        : await loadFinishedReferenceData();

      if (sourceWOs.length === 0) {
        setUnitError('Unable to build report because client/unit data is unavailable');
        setUnitWOs([]);
        setUnitStats(null);
        return;
      }

      const filtered = sourceWOs.filter((wo: WorkOrder) => {
        const client = String(wo.billToCo || '').trim();
        const unit = String(wo.trailer || '').trim();
        return client === clientSearchInput && unit === unitSearchInput;
      }).sort((a, b) => {
        const dateA = new Date(String(a.date || '')).getTime() || 0;
        const dateB = new Date(String(b.date || '')).getTime() || 0;
        if (dateA !== dateB) return dateB - dateA;
        return Number(b.id || 0) - Number(a.id || 0);
      });
      
      if (filtered.length === 0) {
        setUnitError('No finished work orders found for this client and unit');
        setUnitWOs([]);
        setUnitStats(null);
        return;
      }
      
      setUnitWOs(filtered);
      
      // Calculate stats
      const totalRevenue = filtered.reduce((sum, wo) => sum + (Number(wo.totalLabAndParts) || 0), 0);
      const totalHours = filtered.reduce((sum, wo) => sum + (Number(wo.totalHrs) || 0), 0);
      const dates = (filtered
        .map((wo: WorkOrder) => wo.date)
        .filter(Boolean) as string[])
        .sort();
      
      setUnitStats({
        totalWOs: filtered.length,
        totalRevenue,
        totalHours,
        averageRevenuePerWO: filtered.length > 0 ? totalRevenue / filtered.length : 0,
        dateRange: {
          earliest: dates.length > 0 ? dates[0]!.slice(0, 10) : 'N/A',
          latest: dates.length > 0 ? dates[dates.length - 1]!.slice(0, 10) : 'N/A'
        }
      });
    } catch (err) {
      setUnitError('Error loading unit report data');
      setUnitWOs([]);
      setUnitStats(null);
    }
  };

  const handleRetryReferenceLoad = () => {
    void loadFinishedReferenceData(true);
  };
  
  // Normalize parts from any source (work_order_parts rows or embedded JSON)
  // and remove exact duplicates caused by historical repeated sync saves.
  const normalizeParts = useCallback((rawParts: any[]) => {
    const seen = new Set<string>();
    return rawParts
    .map((part: any) => {
      const sku = String(part.sku || '').trim();
      const inventoryItem = inventory.find((item: any) =>
        String(item.sku || '').trim().toLowerCase() === sku.toLowerCase()
      );
      const invoiceLink =
        part.invoiceLink || part.invoice_link ||
        inventoryItem?.invoiceLink || inventoryItem?.invoice_link || null;
      // Unify qty field: work_order_parts uses qty_used; embedded JSON uses qty
      const qty = Number(part.qty_used ?? part.qty) || 0;
      const cost = Number(String(part.cost ?? 0).replace(/[^0-9.]/g, '')) || 0;
      // U/M priority: preserve what was saved in work_order_parts.um; ONLY use inventory if not saved; NEVER force 'EA' unless truly needed
      const savedUm = String(part.um || '').trim();
      const inventoryUm = String(inventoryItem?.um || inventoryItem?.uom || '').trim();
      // Only use savedUm if it has actual content; otherwise fall through chain
      const um = (savedUm.length > 0) ? savedUm : (inventoryUm.length > 0 ? inventoryUm : 'EA');
      const normalized = {
        sku,
        part: part.part || part.part_name || part.description || '',
        um,
        qty,
        cost,
        invoiceLink,
      };
      const signature = [
        String(normalized.sku || '').trim().toLowerCase(),
        String(normalized.part || '').trim().toLowerCase(),
        String(normalized.um || '').trim().toLowerCase(),
        String(normalized.qty ?? '').trim(),
        String(normalized.cost ?? '').trim(),
        String(normalized.invoiceLink || '').trim(),
      ].join('|');
      if (seen.has(signature)) return null;
      seen.add(signature);
      return normalized;
    })
    .filter(Boolean) as any[];
  }, [inventory]);

  // View PDF — uses ONLY stored values from DB; NEVER recalculates the final total
  const handleViewPDF = async (wo: WorkOrder) => {
    try {
      // Always fetch fresh from work_order_parts (authoritative relational data)
      // for accurate invoice links and quantities as originally saved.
      let partsForPDF: any[] = [];
      try {
        const partsRes = await axios.get(`${API_URL}/work-order-parts/${wo.id}`, { timeout: 10000 });
        if (Array.isArray(partsRes.data) && partsRes.data.length > 0) {
          partsForPDF = normalizeParts(partsRes.data);
        }
      } catch { /* 404 or network — fallback below */ }

      // Fallback: use parts already in state (normalized at load time)
      if (partsForPDF.length === 0) {
        const embedded = (() => {
          if (Array.isArray(wo.parts)) return wo.parts;
          if (typeof wo.parts === 'string') { try { return JSON.parse(wo.parts as any); } catch { return []; } }
          return [];
        })();
        partsForPDF = normalizeParts(embedded);
      }

      // Build mechanics string from stored data
      let mechanicsString = '';
      const totalHrs = Number(wo.totalHrs) || 0;
      if (wo.mechanic) {
        mechanicsString = wo.mechanic;
      } else if (wo.mechanics && Array.isArray(wo.mechanics)) {
        mechanicsString = wo.mechanics
          .map((m: any) => `${m.name} (${m.hrs || 0}h)`)
          .join(', ');
      }

      // RULE: FINISHED W.O. total is ALWAYS the stored value — never recalculated
      const storedTotal = Number(wo.totalLabAndParts) || 0;
      const subtotalParts = partsForPDF.reduce((sum, p) => sum + p.qty * p.cost, 0);

      const pdfData = {
        id: wo.id,
        idClassic: wo.idClassic || wo.id.toString(),
        customer: wo.billToCo || 'N/A',
        trailer: wo.trailer || '',
        date: wo.date ? wo.date.slice(0, 10) : '',
        mechanics: mechanicsString,
        description: wo.description || '',
        status: 'FINISHED',
        parts: partsForPDF.map((part: any) => ({
          sku: part.sku,
          description: part.part,
          um: part.um,
          qty: part.qty,
          unitCost: part.cost,
          total: part.qty * part.cost,
          invoiceLink: part.invoiceLink,
        })) as { sku: string; description: string; um: string; qty: number; unitCost: number; total: number; invoiceLink?: string }[],
        totalHrs,
        laborRate: 60,
        laborCost: totalHrs * 60,
        subtotalParts,
        totalCost: storedTotal,
        // Pass through stored adjustments so the PDF generator can show them correctly
        miscellaneousPercent: Number(wo.miscellaneous ?? wo.miscellaneousPercent) || 0,
        weldPercent: Number(wo.weldPercent) || 0,
        miscellaneousFixed: Number(wo.miscellaneousFixed) || 0,
        weldFixed: Number(wo.weldFixed) || 0,
        extraOptions: Array.isArray(wo.extraOptions) ? wo.extraOptions : [],
      };

      const pdf = await generateWorkOrderPDF(pdfData as any);
      openPDFInNewTab(pdf, `work_order_${pdfData.idClassic}_finished.pdf`);
    } catch (error) {
      alert('Error generating PDF');
    }
  };
  
  // Open Hourmeter for selected WO
  const handleOpenHourmeter = () => {
    if (selectedWO) {
      setHourmeterWOs([selectedWO]);
      setShowHourmeter(true);
    }
  };
  
  // Open Hourmeter for unit WOs
  const handleOpenHourmeterUnit = () => {
    if (unitWOs.length > 0) {
      setHourmeterWOs(unitWOs);
      setShowHourmeter(true);
    }
  };

  // Request Level 3 password and open edit modal
  const handleEditWithPassword = (wo: WorkOrder) => {
    const pwd = window.prompt('Enter password (Level 3) to edit this Work Order:');
    if (pwd === '6214') {
      setEditingWO({
        ...wo,
        date: wo.date ? wo.date.slice(0, 10) : '',
        parts: Array.isArray(wo.parts) ? wo.parts : [],
        mechanics: Array.isArray(wo.mechanics) ? wo.mechanics : [],
      });
      setEditError('');
      setEditSuccess('');
      setShowEditModal(true);
    } else if (pwd !== null) {
      alert('Incorrect password. Edit cancelled.');
    }
  };

  // Handle changes in edit form
  const handleEditChange = (e: React.ChangeEvent<any>, index?: number, field?: string) => {
    if (!editingWO) return;

    const { name, value } = e.target;
    
    if (index !== undefined && field && editingWO.parts) {
      // Part field change
      const updatedParts = [...editingWO.parts];
      updatedParts[index] = { ...updatedParts[index], [field]: value };
      setEditingWO({ ...editingWO, parts: updatedParts });
    } else {
      // Main WO field change
      setEditingWO({ ...editingWO, [name]: value });
    }
  };

  // Handle edit form submission
  const handleEditSubmit = async () => {
    if (!editingWO) return;
    
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    
    try {
      const payload = {
        billToCo: editingWO.billToCo,
        trailer: editingWO.trailer,
        date: editingWO.date,
        description: editingWO.description,
        mechanic: editingWO.mechanic,
        mechanics: editingWO.mechanics || [],
        totalHrs: editingWO.totalHrs,
        status: editingWO.status,
        parts: editingWO.parts || [],
        totalLabAndParts: editingWO.totalLabAndParts,
        miscellaneousPercent: editingWO.miscellaneousPercent,
        weldPercent: editingWO.weldPercent,
        miscellaneousFixed: editingWO.miscellaneousFixed,
        weldFixed: editingWO.weldFixed,
        extraOptions: editingWO.extraOptions,
      };

      await axios.put(`${API_URL}/work-orders/${editingWO.id}`, payload);
      
      setEditSuccess('Work Order updated successfully!');
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setShowEditModal(false);
        setEditingWO(null);
        // Refresh the selected WO
        if (selectedWO && selectedWO.id === editingWO.id) {
          setSelectedWO(editingWO);
        }
      }, 2000);
    } catch (error: any) {
      setEditError(error.response?.data?.error || 'Error updating Work Order');
    } finally {
      setEditLoading(false);
    }
  };

  // Cancel edit
  const handleEditCancel = () => {
    setShowEditModal(false);
    setEditingWO(null);
    setEditError('');
    setEditSuccess('');
  };
  
  const formatCurrency = (value: any) => {
    const num = Number(value) || 0;
    return `$${num.toFixed(2)}`;
  };
  
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return dayjs(dateStr).format('MM/DD/YYYY');
    } catch {
      return String(dateStr).slice(0, 10);
    }
  };

  return (
    <Container>
      <SearchModeToggle>
        <button
          className={searchMode === 'by-wo' ? 'active' : ''}
          onClick={() => {
            setSearchMode('by-wo');
            setWoError('');
            setSelectedWO(null);
          }}
        >
          🔍 Search by W.O ID
        </button>
        <button
          className={searchMode === 'by-unit' ? 'active' : ''}
          onClick={() => {
            setSearchMode('by-unit');
            setUnitError('');
            setClientSearchInput('');
            setUnitSearchInput('');
            setUnitWOs([]);
            setUnitStats(null);
          }}
        >
          🚛 Search by Unit
        </button>
      </SearchModeToggle>

      {/* Search by W.O ID */}
      {searchMode === 'by-wo' && (
        <>
          <SearchContainer>
            <SearchLabel>W.O # or ID Classic (Hybrid Search)</SearchLabel>
            <SearchInput
              type="text"
              placeholder="Example: 760 (System ID) or 21578 (ID Classic)"
              value={woSearchInput}
              onChange={(e) => setWoSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchWO()}
            />
            <SearchButton onClick={handleSearchWO} disabled={woLoading}>
              {woLoading ? 'Searching...' : 'Search'}
            </SearchButton>
          </SearchContainer>

          {woError && <ErrorText>{woError}</ErrorText>}

          {selectedWO && (
            <ResultsContainer>
              <DetailPanel>
                <DetailTitle>Work Order Details #{selectedWO.idClassic || selectedWO.id} (System ID: {selectedWO.id})</DetailTitle>

                <DetailGrid>
                  <DetailField>
                    <label>W.O ID</label>
                    <div>{selectedWO.idClassic || 'N/A'}</div>
                  </DetailField>
                  <DetailField>
                    <label>System ID</label>
                    <div>{selectedWO.id}</div>
                  </DetailField>
                  <DetailField>
                    <label>Client</label>
                    <div>{selectedWO.billToCo || 'N/A'}</div>
                  </DetailField>
                  <DetailField>
                    <label>Unit</label>
                    <div>{selectedWO.trailer || 'N/A'}</div>
                  </DetailField>
                  <DetailField>
                    <label>Date</label>
                    <div>{formatDate(selectedWO.date)}</div>
                  </DetailField>
                  <DetailField>
                    <label>Mechanic(s)</label>
                    <div>{selectedWO.mechanic || selectedWO.mechanics?.map((m: any) => `${m.name}`).join(', ') || 'N/A'}</div>
                  </DetailField>
                  <DetailField>
                    <label>Total Hours</label>
                    <div>{Number(selectedWO.totalHrs || 0).toFixed(2)}h</div>
                  </DetailField>
                  <DetailField>
                    <label>Labor</label>
                    <div>{formatCurrency((Number(selectedWO.totalHrs || 0) * 60))}</div>
                  </DetailField>
                  <DetailField>
                    <label>Total</label>
                    <div style={{ fontWeight: 700, color: '#0A3854' }}>
                      {formatCurrency(selectedWO.totalLabAndParts)}
                    </div>
                  </DetailField>
                </DetailGrid>

                {selectedWO.description && (
                  <DetailField>
                    <label>Description</label>
                    <div>{selectedWO.description}</div>
                  </DetailField>
                )}

                {selectedWO.parts && selectedWO.parts.length > 0 && (
                  <PartsSection>
                    <DetailTitle>Used Parts</DetailTitle>
                    <PartsTable>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Unit Cost</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWO.parts.map((part: any, idx: number) => (
                          <tr key={idx}>
                            <td>{part.sku}</td>
                            <td>{part.part || part.part_name || part.description}</td>
                            <td>{part.qty || part.qty_used}</td>
                            <td>{formatCurrency(part.cost)}</td>
                            <td>{formatCurrency((part.qty || part.qty_used) * (part.cost || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </PartsTable>
                  </PartsSection>
                )}

                <ActionButtons>
                  <button className="primary" onClick={() => handleViewPDF(selectedWO)}>
                    📄 View PDF
                  </button>
                  <button className="primary" onClick={handleOpenHourmeter}>
                    ⏱️ Hourmeter
                  </button>
                  <button className="primary" onClick={() => handleEditWithPassword(selectedWO)}>
                    ✏️ Edit (Level 3)
                  </button>
                </ActionButtons>
              </DetailPanel>
            </ResultsContainer>
          )}
        </>
      )}

      {/* Search by Unit/Trailer */}
      {searchMode === 'by-unit' && (
        <>
          <SearchContainer>
            <SearchLabel>Select Client</SearchLabel>
            {unitsLoading ? (
              <LoadingText>Loading clients and units...</LoadingText>
            ) : (
              <>
                {unitReferenceError && (
                  <>
                    <ErrorText>{unitReferenceError}</ErrorText>
                    <SearchButton onClick={handleRetryReferenceLoad}>Retry Loading List</SearchButton>
                  </>
                )}

                <SearchSelect
                  value={clientSearchInput}
                  onChange={(e) => {
                    setClientSearchInput(e.target.value);
                    setUnitSearchInput('');
                    setUnitWOs([]);
                    setUnitStats(null);
                    setUnitError('');
                  }}
                >
                  <option value="">-- Select a client --</option>
                  {availableClients.map((client) => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </SearchSelect>

                <SearchLabel style={{ marginTop: '15px' }}>Unit (Trailer / TRK) — select or type</SearchLabel>
                <SearchInput
                  type="text"
                  list="unit-options"
                  placeholder={clientSearchInput ? 'Select or type unit...' : 'Select a client first'}
                  value={unitSearchInput}
                  onChange={(e) => setUnitSearchInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchUnit()}
                  disabled={!clientSearchInput}
                />
                <datalist id="unit-options">
                  {availableUnits.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
                <SearchButton
                  onClick={handleSearchUnit}
                  disabled={!clientSearchInput || !unitSearchInput}
                >
                  Search Work Orders for This Unit
                </SearchButton>
              </>
            )}
          </SearchContainer>

          {unitError && <ErrorText>{unitError}</ErrorText>}

          {unitStats && unitWOs.length > 0 && (
            <ResultsContainer>
              <DetailPanel>
                <DetailTitle>Unit Report: {clientSearchInput} / {unitSearchInput}</DetailTitle>

                <ReportStats>
                  <div className="stat-card">
                    <div className="stat-label">Total Work Orders</div>
                    <div className="stat-value">{unitStats.totalWOs}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Total Revenue</div>
                    <div className="stat-value">{formatCurrency(unitStats.totalRevenue)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Total Hours</div>
                    <div className="stat-value">{unitStats.totalHours.toFixed(2)}h</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Average per W.O</div>
                    <div className="stat-value">{formatCurrency(unitStats.averageRevenuePerWO)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Period</div>
                    <div className="stat-value" style={{ fontSize: '12px' }}>
                      {unitStats.dateRange.earliest} to {unitStats.dateRange.latest}
                    </div>
                  </div>
                </ReportStats>

                <ReportSection>
                  <DetailTitle>All Work Orders for This Unit</DetailTitle>
                  <ReportTable>
                    <thead>
                      <tr>
                        <th>W.O ID</th>
                        <th>System ID</th>
                        <th>Client</th>
                        <th>Date</th>
                        <th>Mechanic(s)</th>
                        <th>Hours</th>
                        <th>Total</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitWOs.map((wo: WorkOrder) => (
                        <tr key={wo.id}>
                          <td><strong>{wo.idClassic || 'N/A'}</strong></td>
                          <td><strong>{wo.id}</strong></td>
                          <td>{wo.billToCo || 'N/A'}</td>
                          <td>{formatDate(wo.date || '')}</td>
                          <td>
                            {wo.mechanic ||
                              wo.mechanics?.map((m: any) => m.name).join(', ') ||
                              'N/A'}
                          </td>
                          <td>{Number(wo.totalHrs || 0).toFixed(2)}h</td>
                          <td style={{ fontWeight: 600, color: '#0A3854' }}>
                            {formatCurrency(wo.totalLabAndParts)}
                          </td>
                          <td>
                            <button
                              className="secondary"
                              style={{
                                padding: '5px 10px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                border: '1px solid #ccc',
                                background: 'white',
                                borderRadius: '4px',
                                marginRight: '5px'
                              }}
                              onClick={() => handleViewPDF(wo)}
                            >
                              PDF
                            </button>
                            <button
                              className="secondary"
                              style={{
                                padding: '5px 10px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                border: '1px solid #ccc',
                                background: 'white',
                                borderRadius: '4px'
                              }}
                              onClick={() => handleEditWithPassword(wo)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </ReportTable>
                </ReportSection>

                <ActionButtons>
                  <button className="primary" onClick={handleOpenHourmeterUnit}>
                    ⏱️ Unit Hourmeter
                  </button>
                </ActionButtons>
              </DetailPanel>
            </ResultsContainer>
          )}
        </>
      )}

      {/* Edit Modal */}
      <EditModalOverlay show={showEditModal}>
        <EditModalContent onClick={(e) => e.stopPropagation()}>
          {editingWO && (
            <>
              {editError && <ErrorText>{editError}</ErrorText>}
              {editSuccess && <SuccessText>{editSuccess}</SuccessText>}
              <WorkOrderForm
                workOrder={editingWO}
                workOrderNumber={editingWO.idClassic || editingWO.id}
                onChange={handleEditChange}
                onPartChange={(idx, field, value) => {
                  const updated = [...(editingWO.parts || [])];
                  updated[idx] = { ...updated[idx], [field]: value };
                  setEditingWO({ ...editingWO, parts: updated });
                }}
                onSubmit={handleEditSubmit}
                onCancel={handleEditCancel}
                title={`Edit Work Order #${editingWO.idClassic || editingWO.id}`}
                billToCoOptions={[editingWO.billToCo || '']}
                getTrailerOptions={() => [editingWO.trailer || '']}
                inventory={inventory}
                loading={editLoading}
                setLoading={setEditLoading}
              />
            </>
          )}
        </EditModalContent>
      </EditModalOverlay>

      {/* Hourmeter Modal */}
      <HourmeterModal
        show={showHourmeter}
        onClose={() => setShowHourmeter(false)}
        workOrders={hourmeterWOs}
        mechanics={[]}
        selectedWeek={dayjs().format('YYYY-[W]WW')}
      />
    </Container>
  );
};

export default FinishedWorkOrdersSearch;
