import styled, { DefaultTheme } from 'styled-components';

export const MenuContainer = styled.div<{ theme: DefaultTheme }>`
  display: flex;
  justify-content: space-around;
  padding: 20px;
  background-color: ${(props) => props.theme.colors.background};
`;

export const MenuItem = styled.button<{ theme: DefaultTheme }>`
  background-color: ${(props) => props.theme.colors.primary};
  color: ${(props) => props.theme.colors.surface};
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${(props) => props.theme.colors.accent};
  }
`;