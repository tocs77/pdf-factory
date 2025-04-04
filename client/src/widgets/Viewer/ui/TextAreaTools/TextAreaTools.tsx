import React, { useContext, useState, useEffect } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { isLightColor } from '../../utils/textToolUtils';
import styles from './TextAreaTools.module.scss';

interface TextAreaToolsProps {
  pageNumber: number;
  onUnderlineClick: () => void;
  onCrossOutClick: () => void;
  onHighlightClick: () => void;
  onHideTools?: () => void;
  textLayerElement?: HTMLElement | null;
}

export const TextAreaTools: React.FC<TextAreaToolsProps> = ({
  onUnderlineClick,
  onCrossOutClick,
  onHighlightClick,
  onHideTools,
  pageNumber,
}) => {
  const { state } = useContext(ViewerContext);
  const { drawingColor } = state;
  // Add state to track if tools are visible or hidden
  const [toolsVisible, setToolsVisible] = useState(true);

  // Listen for selection changes to show tools again when user makes a new selection
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

  // Hide tools when user clicks elsewhere and clears selection
  useEffect(() => {
    const handleDocumentClick = () => {
      // Use setTimeout to allow the selection to update before checking it
      setTimeout(() => {
        const selection = window.getSelection();
        // Hide tools if selection is empty or not in the current page
        if (!selection || selection.toString().trim() === '') {
          setToolsVisible(false);
          // Notify parent component to hide copy button as well
          onHideTools?.();
        } else {
          // Check if selection is within the current page
          const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
          if (pageContainer) {
            let selectionInCurrentPage = false;

            // Check if any selected nodes are within the current page
            for (let i = 0; i < selection.rangeCount; i++) {
              const range = selection.getRangeAt(i);
              if (pageContainer.contains(range.commonAncestorContainer)) {
                selectionInCurrentPage = true;
                break;
              }
            }

            // Hide tools if selection is not in current page
            if (!selectionInCurrentPage) {
              setToolsVisible(false);
              // Notify parent component to hide copy button as well
              onHideTools?.();
            }
          }
        }
      }, 10); // Small delay to ensure selection is updated
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [pageNumber, onHideTools]);

  // Only render the buttons if tools are visible
  if (!toolsVisible) {
    return null;
  }

  return (
    <div className={styles.textToolsContainer}>
      <button
        className={styles.textToolButton}
        onClick={onUnderlineClick}
        title='Underline text'
        style={{ backgroundColor: drawingColor }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', pointerEvents: 'none' }}>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'>
            <path d='M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3' />
            <line x1='4' y1='21' x2='20' y2='21' />
          </svg>
          <span style={{ display: 'inline-block', color: isLightColor(drawingColor) ? '#333' : 'white', marginLeft: '5px' }}>
            Underline
          </span>
        </div>
      </button>

      <button
        className={styles.textToolButton}
        onClick={onCrossOutClick}
        title='Cross out text'
        style={{ backgroundColor: drawingColor }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', pointerEvents: 'none' }}>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'>
            <line x1='4' y1='12' x2='20' y2='12' />
            <path d='M6 20v-8a6 6 0 0 1 12 0v8' />
          </svg>
          <span style={{ display: 'inline-block', color: isLightColor(drawingColor) ? '#333' : 'white', marginLeft: '5px' }}>
            Cross Out
          </span>
        </div>
      </button>

      <button
        className={styles.textToolButton}
        onClick={onHighlightClick}
        title='Highlight text'
        style={{
          backgroundColor: drawingColor,
          color: isLightColor(drawingColor) ? '#333' : 'white',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', pointerEvents: 'none' }}>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'>
            <rect x='3' y='5' width='18' height='14' rx='2' ry='2' />
            <path d='M8 5v14' />
            <path d='M16 5v14' />
          </svg>
          <span style={{ display: 'inline-block', color: isLightColor(drawingColor) ? '#333' : 'white', marginLeft: '5px' }}>
            Highlight
          </span>
        </div>
      </button>
    </div>
  );
};

export default TextAreaTools;
