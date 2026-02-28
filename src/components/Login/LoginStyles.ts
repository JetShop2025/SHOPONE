import styled from 'styled-components';
import styled, { DefaultTheme } from 'styled-components';

export const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: ${(props) => props.theme.colors.background};
`;

export const LoginFormWrapper = styled.form`
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

export const InputField = styled.input<{ theme: DefaultTheme }>`
  width: 100%;
  padding: 0.5rem;
  margin: 0.5rem 0;
  border: 1px solid ${(props) => props.theme.colors.secondary};
  border-radius: 4px;
`;

export const SubmitButton = styled.button<{ theme: DefaultTheme }>`
  width: 100%;
  padding: 0.5rem;
  background-color: ${(props) => props.theme.colors.primary};
  color: ${(props) => props.theme.colors.surface};
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => props.theme.colors.accent};
  }
`;