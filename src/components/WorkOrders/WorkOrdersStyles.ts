import styled, { keyframes } from 'styled-components';

interface ThemeProps {
  theme: any;
}

// Animación de parpadeo para MISSING PARTS (ROJO)
const blinkRed = keyframes`
  0% { background-color: #ffebee; }
  50% { background-color: #ff5252; }
  100% { background-color: #ffebee; }
`;

// Animación de parpadeo para PROCESSING (AZUL)
const blinkBlue = keyframes`
  0% { background-color: #e3f2fd; }
  50% { background-color: #42a5f5; }
  100% { background-color: #e3f2fd; }
`;

// Animación de parpadeo para APPROVED (VERDE)
const blinkGreen = keyframes`
  0% { background-color: #e8f5e9; }
  50% { background-color: #66bb6a; }
  100% { background-color: #e8f5e9; }
`;

export const WorkOrdersContainer = styled.div<ThemeProps>`
  padding: ${(props: any) => props.theme.spacing.large};
  background-color: ${(props: any) => props.theme.colors.background};
`;

export const WorkOrdersTableWrapper = styled.div`
  margin-top: 20px;
  overflow-x: auto;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

export const TableHeader = styled.th`
  background-color: #4CAF50;
  color: white;
  padding: 10px;
  text-align: left;
`;

export const TableCell = styled.td<ThemeProps>`
  border: 1px solid ${(props: any) => props.theme.colors.secondary};
  padding: 8px;
`;

// Celda parpadeante para MISSING PARTS (ROJO)
export const BlinkingTableCellRed = styled.td<ThemeProps>`
  border: 1px solid ${(props: any) => props.theme.colors.secondary};
  padding: 8px;
  animation: ${blinkRed} 1.5s ease-in-out infinite;
  font-weight: bold;
  color: #c62828;
`;

// Celda parpadeante para PROCESSING (AZUL)
export const BlinkingTableCellBlue = styled.td<ThemeProps>`
  border: 1px solid ${(props: any) => props.theme.colors.secondary};
  padding: 8px;
  animation: ${blinkBlue} 1.5s ease-in-out infinite;
  font-weight: bold;
  color: #1565c0;
`;

// Celda parpadeante para APPROVED (VERDE)
export const BlinkingTableCellGreen = styled.td<ThemeProps>`
  border: 1px solid ${(props: any) => props.theme.colors.secondary};
  padding: 8px;
  animation: ${blinkGreen} 1.5s ease-in-out infinite;
  font-weight: bold;
  color: #2e7d32;
`;

// Legacy alias for backward compatibility
export const BlinkingTableCell = BlinkingTableCellRed;

export const ButtonContainer = styled.div`
  margin-top: 20px;
`;

export const Button = styled.button<ThemeProps>`
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  margin-right: 10px;
  border: none;
  cursor: pointer;

  &:hover {
    background-color: ${(props: any) => props.theme.colors.success};
  }
`;