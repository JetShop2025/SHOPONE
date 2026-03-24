import React from 'react';

interface TrailersFiltersBarProps {
  selectedClient: string;
  setSelectedClient: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  uniqueClients: (string | undefined)[];
}

const TrailersFiltersBar: React.FC<TrailersFiltersBarProps> = ({
  selectedClient,
  setSelectedClient,
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
  uniqueClients,
}) => {
  return (
    <div style={{
      background: 'white',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', marginBottom: '4px', display: 'block' }}>
            Filtrar por Cliente:
          </label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px',
              minWidth: '150px'
            }}
          >
            <option value="ALL">Todos los Clientes</option>
            {uniqueClients.map(client => (
              <option key={client} value={client}>{client}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', marginBottom: '4px', display: 'block' }}>
            Filtrar por Estado:
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px',
              minWidth: '150px'
            }}
          >
            <option value="ALL">All</option>
            <option value="DISPONIBLE">Available</option>
            <option value="RENTADO">Rental</option>
            <option value="MANTENIMIENTO">Maintenance</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', marginBottom: '4px', display: 'block' }}>
            Search:
          </label>
          <input
            type="text"
            placeholder="Search by name or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default TrailersFiltersBar;
