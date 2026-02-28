import styled from 'styled-components';

export const InventoryContainer = styled.div`
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

export const InventoryTitle = styled.h2`
  font-size: 24px;
  color: #333;
  margin-bottom: 20px;
`;

export const InventoryTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

export const InventoryTableHeader = styled.th`
  background-color: #007bff;
  color: white;
  padding: 10px;
  text-align: left;
`;

export const InventoryTableCell = styled.td`
  padding: 10px;
  border: 1px solid #ddd;
`;

export const InventoryButton = styled.button`
  background-color: #28a745;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 5px;
  cursor: pointer;

  &:hover {
    background-color: #218838;
  }
`;