import React, { useContext, useState, useEffect } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { isLightColor } from '../../utils/textToolUtils';
import styles from './TextAreaTools.module.scss';

interface TextAreaToolsProps {
  pageNumber: number;
  onFinishClick: () => void;
  onHideTools?: () => void;
  textLayerElement?: HTMLElement | null;
}

export const TextAreaTools: React.FC<TextAreaToolsProps> = ({ onFinishClick, onHideTools, pageNumber }) => {
  const { state } = useContext(ViewerContext);
  const { drawingColor } = state;
  const [toolsVisible, setToolsVisible] = useState(true);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() !== '') {
        setToolsVisible(true);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  useEffect(() => {
    const handleDocumentClick = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
          setToolsVisible(false);
          onHideTools?.();
        } else {
          const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
          if (pageContainer) {
            let selectionInCurrentPage = false;

            for (let i = 0; i < selection.rangeCount; i++) {
              const range = selection.getRangeAt(i);
              if (pageContainer.contains(range.commonAncestorContainer)) {
                selectionInCurrentPage = true;
                break;
              }
            }

            if (!selectionInCurrentPage) {
              setToolsVisible(false);
              onHideTools?.();
            }
          }
        }
      }, 10);
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [pageNumber, onHideTools]);

  if (!toolsVisible) {
    return null;
  }

  return (
    <div className={styles.textToolsContainer}>
      <button
        className={styles.textToolButton}
        onClick={onFinishClick}
        title='Finish Annotation'
        style={{
          backgroundColor: drawingColor,
          color: isLightColor(drawingColor) ? '#333' : 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke={isLightColor(drawingColor) ? '#333' : 'white'}
          strokeWidth='3'
          strokeLinecap='round'
          strokeLinejoin='round'
          style={{ marginRight: '6px' }}>
          <polyline points='20 6 9 17 4 12'></polyline>
        </svg>
        <span style={{ color: isLightColor(drawingColor) ? '#333' : 'white' }}>Finish</span>
      </button>
    </div>
  );
};

export default TextAreaTools;
