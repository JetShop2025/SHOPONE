import React from 'react';
import styled from 'styled-components';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  maxHeight?: string;
}

const ModalOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div<{ maxWidth?: string; maxHeight?: string }>`
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(21, 101, 192, 0.15);
  padding: 30px;
  width: 96vw;
  max-width: ${props => props.maxWidth || '800px'};
  max-height: ${props => props.maxHeight || '90vh'};
  overflow-y: auto;
  animation: slideIn 0.3s ease-out;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;

  h2 {
    margin: 0;
    color: #0A3854;
    font-size: 20px;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;

  &:hover {
    background: #f0f0f0;
  }
`;

/**
 * Reusable Modal Component
 * Eliminates duplication of modal styling/behavior across components
 * 
 * Usage:
 * ```tsx
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="My Modal">
 *   <p>Modal content goes here</p>
 * </Modal>
 * ```
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth,
  maxHeight
}) => {
  return (
    <ModalOverlay isOpen={isOpen} onClick={onClose}>
      <ModalContent
        maxWidth={maxWidth}
        maxHeight={maxHeight}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <ModalHeader>
            <h2>{title}</h2>
            <CloseButton onClick={onClose} title="Close">
              ×
            </CloseButton>
          </ModalHeader>
        )}
        {children}
      </ModalContent>
    </ModalOverlay>
  );
};

export default Modal;
