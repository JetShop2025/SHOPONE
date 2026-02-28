import styled from 'styled-components';
import styled, { DefaultTheme } from 'styled-components';

export const InventoryContainer = styled.div<{ theme: DefaultTheme }>`
  padding: ${(props) => props.theme.spacing.large};
  background-color: ${(props) => props.theme.colors.background};
  border-radius: ${(props) => props.theme.borderRadius};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

export const InventoryTitle = styled.h2<{ theme: DefaultTheme }>`
  font-size: 24px;
  color: ${(props) => props.theme.colors.text};
  margin-bottom: ${(props) => props.theme.spacing.large};
`;

export const InventoryTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

export const InventoryTableHeader = styled.th<{ theme: DefaultTheme }>`
  background-color: ${(props) => props.theme.colors.primary};
  color: ${(props) => props.theme.colors.surface};
  padding: 10px;
  text-align: left;
`;

export const InventoryTableCell = styled.td<{ theme: DefaultTheme }>`
  padding: 10px;
  border: 1px solid ${(props) => props.theme.colors.secondary};
`;

export const InventoryButton = styled.button<{ theme: DefaultTheme }>`
  background-color: ${(props) => props.theme.colors.success};
  color: ${(props) => props.theme.colors.surface};
  border: none;
  padding: 10px 15px;
  border-radius: 5px;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => props.theme.colors.success};
  }
`;