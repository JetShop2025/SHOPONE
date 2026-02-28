import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      primary: string;
      secondary: string;
      success: string;
      danger: string;
      info: string;
      background: string;
      surface: string;
      text: string;
      header: string;
      accent: string;
    };
    spacing: {
      small: string;
      medium: string;
      large: string;
    };
    borderRadius: string;
  }
}
