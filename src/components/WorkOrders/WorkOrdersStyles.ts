import styled, { keyframes } from 'styled-components';

interface ThemeProps {
  theme: any;
}

// Animación de parpadeo para MISSING PARTS
const blink = keyframes`
  0% { background-color: #ffebee; }
  50% { background-color: #ff5252; }
  100% { background-color: #ffebee; }
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

// Celda parpadeante para MISSING PARTS
export const BlinkingTableCell = styled.td<ThemeProps>`
  border: 1px solid ${(props: any) => props.theme.colors.secondary};
  padding: 8px;
  animation: ${blink} 1.5s ease-in-out infinite;
  font-weight: bold;
  color: #c62828;
`;

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