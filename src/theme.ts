import { DefaultTheme } from 'styled-components';

export const theme: DefaultTheme = {
  colors: {
    primary: '#005b96',        // deep blue
    secondary: '#6c757d',      // gray
    success: '#28a745',        // green
    danger: '#dc3545',         // red
    info: '#17a2b8',           // teal
    background: '#f8f9fa',     // light gray
    surface: '#ffffff',        // white
    text: '#343a40',           // dark gray
    header: '#212529',         // almost black
    accent: '#007bff',         // bright blue for highlights
  },
  spacing: {
    small: '8px',
    medium: '16px',
    large: '24px',
  },
  borderRadius: '8px',
};
