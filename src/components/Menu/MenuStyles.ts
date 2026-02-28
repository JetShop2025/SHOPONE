import styled from 'styled-components';

export const MenuContainer = styled.div`
  display: flex;
  justify-content: space-around;
  padding: 20px;
  background-color: #f8f9fa;
`;

export const MenuItem = styled.button`
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #0056b3;
  }
`;