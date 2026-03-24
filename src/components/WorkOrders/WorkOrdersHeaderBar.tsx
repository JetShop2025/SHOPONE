import React from 'react';

interface WorkOrdersHeaderBarProps {
  searchIdClassic: string;
  totalWorkOrders: number;
  serverStatus: 'online' | 'waking' | 'offline';
  reconnecting: boolean;
  fetchingData: boolean;
  onSearchIdChange: (value: string) => void;
  onClearSearch: () => void;
  onReconnect: () => void;
  onGoToFinalWO: () => void;
}

const WorkOrdersHeaderBar: React.FC<WorkOrdersHeaderBarProps> = ({
  searchIdClassic,
  totalWorkOrders,
  serverStatus,
  reconnecting,
  fetchingData,
  onSearchIdChange,
  onClearSearch,
  onReconnect,
  onGoToFinalWO,
}) => {
  return (
    <>
      <div className="wo-header">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#1976d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 22 }}>✓</span>
          </div>

          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#0A3854',
              fontFamily: 'Courier New, Courier, monospace',
              letterSpacing: 2,
              textShadow: '1px 1px 2px rgba(10,56,84,0.15)',
            }}
          >
            W.O ENTRY
            {searchIdClassic && (
              <span
                style={{
                  marginLeft: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#ff9800',
                  backgroundColor: '#fff3e0',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  border: '1px solid #ff9800',
                }}
              >
                🔍 Searching: "{searchIdClassic}"
              </span>
            )}
          </span>

          <div
            style={{
              marginTop: '4px',
              fontSize: '13px',
              color: '#0A3854',
              fontWeight: '600',
            }}
          >
            📋 Total: {totalWorkOrders} Work Orders
          </div>

          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              padding: '8px 16px',
              borderRadius: '20px',
              background:
                serverStatus === 'online'
                  ? '#e8f5e8'
                  : serverStatus === 'waking'
                    ? '#fff3e0'
                    : '#ffebee',
              border: `1px solid ${
                serverStatus === 'online'
                  ? '#4caf50'
                  : serverStatus === 'waking'
                    ? '#ff9800'
                    : '#f44336'
              }`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background:
                  serverStatus === 'online'
                    ? '#4caf50'
                    : serverStatus === 'waking'
                      ? '#ff9800'
                      : '#f44336',
                marginRight: 8,
                animation: serverStatus === 'waking' ? 'pulse 1.5s infinite' : 'none',
              }}
            />

            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color:
                  serverStatus === 'online'
                    ? '#2e7d32'
                    : serverStatus === 'waking'
                      ? '#ef6c00'
                      : '#c62828',
              }}
            >
              {serverStatus === 'online'
                ? 'Online'
                : serverStatus === 'waking'
                  ? 'Waking up...'
                  : 'Offline'}
            </span>

            {serverStatus === 'offline' && (
              <button className="reconnect-btn" onClick={onReconnect} disabled={reconnecting}>
                {reconnecting ? 'Reconnecting...' : 'Reconnect'}
              </button>
            )}

            {fetchingData && (
              <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>
                Loading...
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 8, marginTop: -8 }}>
        <label className="wo-filter-label">
          <span style={{ fontWeight: 'bold', color: '#1976d2' }}>🔍 Search ID Classic:</span>&nbsp;
          <input
            type="text"
            value={searchIdClassic}
            onChange={(e) => onSearchIdChange(e.target.value)}
            className="wo-filter-input"
            style={{
              minWidth: 160,
              backgroundColor: searchIdClassic ? '#e3f2fd' : 'white',
              border: searchIdClassic ? '2px solid #1976d2' : '1px solid #ddd',
            }}
            placeholder="W.O. 19417"
          />
          {searchIdClassic && (
            <button
              onClick={onClearSearch}
              style={{
                marginLeft: '5px',
                padding: '2px 6px',
                fontSize: '12px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
              title="Clear search and show all work orders"
            >
              ✕
            </button>
          )}
        </label>

        <button
          onClick={onGoToFinalWO}
          style={{
            marginTop: '12px',
            padding: '10px 24px',
            background: '#e65100',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(230,81,0,0.4)',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#d84315';
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(216,67,21,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#e65100';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 3px 10px rgba(230,81,0,0.4)';
          }}
        >
          ➡️ Go to FINAL W.O
        </button>
      </div>
    </>
  );
};

export default WorkOrdersHeaderBar;
