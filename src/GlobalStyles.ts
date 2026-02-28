import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    color: ${(props) => props.theme.colors.text};
    background-color: ${(props) => props.theme.colors.surface};
  }

  h1, h2, h3, h4, h5, h6 {
    color: ${(props) => props.theme.colors.header};
  }

  a {
    color: ${(props) => props.theme.colors.primary};
    text-decoration: none;
  }

  button {
    font-family: inherit;
  }
`;
