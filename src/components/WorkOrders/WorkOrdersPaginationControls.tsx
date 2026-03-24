import React from 'react';

interface WorkOrdersPaginationControlsProps {
  currentPageData: number;
  totalPages: number;
  totalRecords: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchingData: boolean;
  onGoFirst: () => void;
  onGoPrev: () => void;
  onGoPage: (page: number) => void;
  onGoNext: () => void;
  onGoLast: () => void;
}

const WorkOrdersPaginationControls: React.FC<WorkOrdersPaginationControlsProps> = ({
  currentPageData,
  totalPages,
  totalRecords,
  hasNextPage,
  hasPreviousPage,
  fetchingData,
  onGoFirst,
  onGoPrev,
  onGoPage,
  onGoNext,
  onGoLast,
}) => {
  return (
    <div
      style={{
        margin: '16px 0',
        padding: '12px 16px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid #dee2e6',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#495057' }}>
          📄 Página {currentPageData} de {totalPages}
        </span>
        <span style={{ fontSize: '12px', color: '#6c757d' }}>
          Total: {totalRecords.toLocaleString()} W.O. | Mostrando 1000 por página
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onGoFirst}
          disabled={!hasPreviousPage || fetchingData}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: hasPreviousPage && !fetchingData ? '#1976d2' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: hasPreviousPage && !fetchingData ? 'pointer' : 'not-allowed',
          }}
        >
          « Primera
        </button>

        <button
          onClick={onGoPrev}
          disabled={!hasPreviousPage || fetchingData}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: hasPreviousPage && !fetchingData ? '#1976d2' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: hasPreviousPage && !fetchingData ? 'pointer' : 'not-allowed',
          }}
        >
          ← Anterior
        </button>

        <select
          value={currentPageData}
          onChange={(e) => onGoPage(parseInt(e.target.value, 10))}
          disabled={fetchingData}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
          }}
        >
          {Array.from({ length: Math.min(totalPages, 20) }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Página {i + 1}
            </option>
          ))}
          {totalPages > 20 && currentPageData > 20 && (
            <option value={currentPageData}>Página {currentPageData}</option>
          )}
        </select>

        <button
          onClick={onGoNext}
          disabled={!hasNextPage || fetchingData}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: hasNextPage && !fetchingData ? '#1976d2' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: hasNextPage && !fetchingData ? 'pointer' : 'not-allowed',
          }}
        >
          Siguiente →
        </button>

        <button
          onClick={onGoLast}
          disabled={!hasNextPage || fetchingData}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: hasNextPage && !fetchingData ? '#1976d2' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: hasNextPage && !fetchingData ? 'pointer' : 'not-allowed',
          }}
        >
          Última »
        </button>
      </div>
    </div>
  );
};

export default WorkOrdersPaginationControls;
