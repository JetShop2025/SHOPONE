import styled from 'styled-components';

interface ThemeProps {
  theme: any;
}

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