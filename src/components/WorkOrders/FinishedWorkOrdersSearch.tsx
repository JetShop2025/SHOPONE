import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import HourmeterModal from './HourmeterModal';
import { generateWorkOrderPDF, openPDFInNewTab } from '../../utils/pdfGenerator';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';
const FINISHED_WO_CACHE_KEY = 'finished_wo_search_cache_v1';
const FINISHED_WO_CACHE_TTL_MS = 5 * 60 * 1000;

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

  // Hourmeter state
  const [showHourmeter, setShowHourmeter] = useState(false);
  const [hourmeterWOs, setHourmeterWOs] = useState<WorkOrder[]>([]);

  // Load inventory once for invoice-link resolution in PDFs
  useEffect(() => {
    axios.get(`${API_URL}/inventory`, { timeout: 15000 })
      .then(res => setInventory(Array.isArray(res.data) ? res.data : []))
      .catch(() => setInventory([]));
  }, []);
  
  const availableClients = React.useMemo(() => {
    const uniqueClients = Array.from(
      new Set(
        allFinishedWOs
          .map((wo: WorkOrder) => String(wo.billToCo || '').trim())
          .filter(Boolean)
      )
    ) as string[];

    return uniqueClients.sort();
  }, [allFinishedWOs]);

  const availableUnits = React.useMemo(() => {
    const filteredByClient = allFinishedWOs.filter((wo: WorkOrder) => {
      if (!clientSearchInput) return true;
      return String(wo.billToCo || '').trim() === clientSearchInput;
    });

    const uniqueUnits = Array.from(
      new Set(
        filteredByClient
          .map((wo: WorkOrder) => String(wo.trailer || '').trim())
          .filter(Boolean)
      )
    ) as string[];

    return uniqueUnits.sort();
  }, [allFinishedWOs, clientSearchInput]);

  const loadFinishedReferenceData = useCallback(async (forceRefresh = false): Promise<WorkOrder[]> => {
    if (!forceRefresh) {
      try {
        const rawCache = sessionStorage.getItem(FINISHED_WO_CACHE_KEY);
        if (rawCache) {
          const parsed = JSON.parse(rawCache) as { ts: number; data: WorkOrder[] };
          const cacheIsFresh = Date.now() - Number(parsed?.ts || 0) < FINISHED_WO_CACHE_TTL_MS;
          if (cacheIsFresh && Array.isArray(parsed?.data)) {
            setAllFinishedWOs(parsed.data);
            setUnitReferenceError('');
            return parsed.data;
          }
        }
      } catch {
        // Ignore cache parsing errors and fetch from API.
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

      sessionStorage.setItem(
        FINISHED_WO_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), data: allWOs })
      );

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
  const loadWorkOrderDetails = useCallback(async (orderId: number) => {
    try {
      setWoLoading(true);
      setWoError('');
      
      const [woRes, partsRes] = await Promise.all([
        axios.get(`${API_URL}/work-orders/${orderId}`),
        axios.get(`${API_URL}/work-order-parts/${orderId}`).catch(() => ({ data: [] }))
      ]);
      
      const wo = woRes.data || {};
      const parts = Array.isArray(partsRes.data) ? partsRes.data : [];
      
      setSelectedWO({
        ...wo,
        parts: parts.length > 0 ? parts : (wo.parts || []),
        _partsLoaded: true
      });
    } catch (err) {
      setWoError('Work order not found');
      setSelectedWO(null);
    } finally {
      setWoLoading(false);
    }
  }, []);
  
  // Search by W.O ID
  const handleSearchWO = () => {
    const searchId = woSearchInput.trim();
    if (!searchId) {
      setWoError('Enter a work order ID');
      return;
    }
    
    loadWorkOrderDetails(Number(searchId));
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
  
  // View PDF
  const handleViewPDF = async (wo: WorkOrder) => {
    try {
      // For PDF links we need the full parts from the work-order-parts table.
      // If the WO was loaded without detailed parts (e.g. from the unit report list),
      // fetch them now so invoice links are available.
      let resolvedParts: any[] = wo.parts || [];
      if (!wo._partsLoaded) {
        try {
          const partsRes = await axios.get(`${API_URL}/work-order-parts/${wo.id}`).catch(() => ({ data: [] }));
          if (Array.isArray(partsRes.data) && partsRes.data.length > 0) {
            resolvedParts = partsRes.data;
          }
        } catch { /* keep existing parts */ }
      }

      let workOrderParts: any[] = [];
      if (resolvedParts.length > 0) {
        workOrderParts = resolvedParts.map((part: any) => {
          const sku = String(part.sku || '').trim();
          const inventoryItem = inventory.find((item: any) =>
            String(item.sku || '').trim().toLowerCase() === sku.toLowerCase()
          );
          // Prefer invoiceLink from work_order_parts row; fall back to inventory
          const invoiceLink =
            part.invoiceLink ||
            part.invoice_link ||
            inventoryItem?.invoiceLink ||
            inventoryItem?.invoice_link ||
            null;
          return {
            sku,
            part_name: part.part || part.part_name || part.description || '',
            um: part.um || inventoryItem?.um || inventoryItem?.uom || 'EA',
            qty_used: Number(part.qty_used ?? part.qty) || 0,
            cost: Number(String(part.cost).replace(/[^0-9.]/g, '')) || 0,
            invoiceLink
          };
        });
      }
      
      let mechanicsString = '';
      let totalHrs = Number(wo.totalHrs) || 0;
      if (wo.mechanic) {
        mechanicsString = wo.mechanic;
      } else if (wo.mechanics && Array.isArray(wo.mechanics)) {
        mechanicsString = wo.mechanics
          .map((m: any) => `${m.name} (${m.hrs || 0}h)`)
          .join(', ');
        totalHrs = wo.mechanics.reduce((sum: number, m: any) => sum + (Number(m.hrs) || 0), 0);
      }
      
      const pdfData = {
        id: wo.id,
        idClassic: wo.idClassic || wo.id.toString(),
        customer: wo.billToCo || 'N/A',
        trailer: wo.trailer || '',
        date: wo.date ? wo.date.slice(0, 10) : '',
        mechanics: mechanicsString,
        description: wo.description || '',
        status: 'FINISHED',
        parts: workOrderParts.map((part: any) => ({
          sku: part.sku,
          description: part.part_name,
          um: part.um,
          qty: part.qty_used,
          unitCost: part.cost,
          total: part.qty_used * part.cost,
          invoiceLink: part.invoiceLink
        })) as { sku: string; description: string; um: string; qty: number; unitCost: number; total: number; invoiceLink?: string }[],
        totalHrs,
        laborRate: 60,
        laborCost: totalHrs * 60,
        subtotalParts: workOrderParts.reduce((sum, part) => sum + (part.qty_used * part.cost), 0),
        totalCost: Number(wo.totalLabAndParts) || 0
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
            <SearchLabel>Work Order ID</SearchLabel>
            <SearchInput
              type="number"
              placeholder="Example: 12345"
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
                <DetailTitle>Work Order Details #{selectedWO.idClassic || selectedWO.id}</DetailTitle>

                <DetailGrid>
                  <DetailField>
                    <label>ID</label>
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

                <SearchLabel style={{ marginTop: '15px' }}>Select Unit (Trailer/TRK)</SearchLabel>
                <SearchSelect
                  value={unitSearchInput}
                  onChange={(e) => setUnitSearchInput(e.target.value)}
                  disabled={!clientSearchInput}
                >
                  <option value="">-- Select a unit --</option>
                  {availableUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </SearchSelect>
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
                        <th>ID</th>
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
                          <td><strong>{wo.idClassic || wo.id}</strong></td>
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
                                borderRadius: '4px'
                              }}
                              onClick={() => handleViewPDF(wo)}
                            >
                              PDF
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
