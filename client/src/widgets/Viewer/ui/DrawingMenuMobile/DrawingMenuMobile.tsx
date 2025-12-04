import { useContext, useEffect, useRef, useState } from 'react';

import { DraggableDialog } from '@/shared/UI/DraggableDialog';
import { Portal } from '@/shared/UI/Portal';

import { ViewerContext } from '../../model/context/viewerContext';
import { DrawingMode } from '../../model/types/viewerSchema';
import { isLightColor } from '../../utils/textToolUtils';
import styles from './DrawingMenuMobile.module.scss';

// Dropdown styling constants
const DROPDOWN_PADDING = 6;
const DROPDOWN_GAP = 4;
const DROPDOWN_OFFSET_FROM_BUTTON = 4;

export const DrawingMenuMobile = () => {
  const { state, dispatch } = useContext(ViewerContext);
  const { drawingMode, drawingColor, drawingLineWidth, drawingOpacity } = state;
  const [dialogPosition, setDialogPosition] = useState({ x: 20, y: 100 });
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const [widthDropdownOpen, setWidthDropdownOpen] = useState(false);
  const [opacityDropdownOpen, setOpacityDropdownOpen] = useState(false);

  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const widthButtonRef = useRef<HTMLButtonElement>(null);
  const opacityButtonRef = useRef<HTMLButtonElement>(null);

  const getDropdownPosition = (buttonRef: React.RefObject<HTMLButtonElement | null>) => {
    if (!buttonRef.current) return { top: 0, left: 0 };
    const rect = buttonRef.current.getBoundingClientRect();
    // Offset by padding to align content with button
    return {
      top: rect.bottom + DROPDOWN_OFFSET_FROM_BUTTON,
      left: rect.left - DROPDOWN_PADDING,
    };
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (colorDropdownOpen && colorButtonRef.current && !colorButtonRef.current.contains(target)) {
        const dropdownMenus = document.querySelectorAll(`.${styles.dropdownMenu}`);
        let clickedInDropdown = false;
        dropdownMenus.forEach((menu) => {
          if (menu.contains(target)) {
            clickedInDropdown = true;
          }
        });
        if (!clickedInDropdown) {
          setColorDropdownOpen(false);
        }
      }

      if (widthDropdownOpen && widthButtonRef.current && !widthButtonRef.current.contains(target)) {
        const dropdownMenus = document.querySelectorAll(`.${styles.dropdownMenu}`);
        let clickedInDropdown = false;
        dropdownMenus.forEach((menu) => {
          if (menu.contains(target)) {
            clickedInDropdown = true;
          }
        });
        if (!clickedInDropdown) {
          setWidthDropdownOpen(false);
        }
      }

      if (opacityDropdownOpen && opacityButtonRef.current && !opacityButtonRef.current.contains(target)) {
        const dropdownMenus = document.querySelectorAll(`.${styles.dropdownMenu}`);
        let clickedInDropdown = false;
        dropdownMenus.forEach((menu) => {
          if (menu.contains(target)) {
            clickedInDropdown = true;
          }
        });
        if (!clickedInDropdown) {
          setOpacityDropdownOpen(false);
        }
      }
    };

    if (colorDropdownOpen || widthDropdownOpen || opacityDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
    return undefined;
  }, [colorDropdownOpen, widthDropdownOpen, opacityDropdownOpen]);

  // Don't need to check visibility as the parent component (Viewer) handles this
  if (drawingMode === 'none') {
    return null;
  }

  // Check if we're in a selection-only mode
  const onlyColorModes: DrawingMode[] = ['rectSelection', 'pinSelection', 'drawArea', 'ruler'];
  const autoFinishModes: DrawingMode[] = ['rectSelection', 'pinSelection', 'drawArea'];
  const isOnlyColorMode = onlyColorModes.includes(drawingMode);
  const isAutoFinishMode = autoFinishModes.includes(drawingMode);

  // Check if we're in textArea mode
  const isTextAreaMode = drawingMode === 'textArea';

  const handleFinishClick = () => {
    dispatch({ type: 'requestFinishDrawing', payload: true });
    // Reset the request flag after a short delay
    setTimeout(() => {
      dispatch({ type: 'requestFinishDrawing', payload: false });
    }, 100);
  };

  const handleCancelClick = () => {
    dispatch({ type: 'requestCancelDrawing', payload: true });
    // Reset the request flag after a short delay
    setTimeout(() => {
      dispatch({ type: 'requestCancelDrawing', payload: false });
    }, 100);
  };

  const changeDrawingColor = (color: string) => {
    dispatch({ type: 'setDrawingColor', payload: color });
    setColorDropdownOpen(false);
  };

  const changeLineWidth = (width: number) => {
    dispatch({ type: 'setDrawingLineWidth', payload: width });
    setWidthDropdownOpen(false);
  };

  const changeOpacity = (opacity: number) => {
    dispatch({ type: 'setDrawingOpacity', payload: opacity });
    setOpacityDropdownOpen(false);
  };

  // Color options
  const colorOptions = ['#2196f3', '#4caf50', '#f44336', '#ff9800', '#9c27b0', '#000000'];

  // Line width options
  const lineWidthOptions = [1, 2, 3, 5, 8];

  // Opacity options: 75% transparency (0.25 opacity), 50% transparency (0.5 opacity), 25% transparency (0.75 opacity), 0% transparency (1.0 opacity - fully opaque)
  const opacityOptions = [0.25, 0.5, 0.75, 1];

  return (
    <DraggableDialog
      initialXPos={dialogPosition.x}
      initialYPos={dialogPosition.y}
      showHeader={false}
      grabAreas={['left', 'right']}
      onPositionChange={setDialogPosition}
      resizable={false}>
      <div className={styles.drawingMenuContainer} data-dragscroll-ignore='true'>
        <div className={styles.drawingOptions}>
          {!isAutoFinishMode && (
            <div className={styles.actionButtons}>
              <button
                className={styles.actionButton}
                onClick={handleFinishClick}
                title='Завершить рисование'
                style={{
                  backgroundColor: drawingColor,
                  color: isLightColor(drawingColor) ? '#333' : 'white',
                }}>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='3'
                  strokeLinecap='round'
                  strokeLinejoin='round'>
                  <polyline points='20 6 9 17 4 12'></polyline>
                </svg>
              </button>
              <button
                className={`${styles.actionButton} ${styles.cancelButton}`}
                onClick={handleCancelClick}
                title='Отменить рисование'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'>
                  <line x1='18' y1='6' x2='6' y2='18'></line>
                  <line x1='6' y1='6' x2='18' y2='18'></line>
                </svg>
              </button>
            </div>
          )}

          <div className={styles.dropdownContainer}>
            <button
              ref={colorButtonRef}
              className={`${styles.dropdownButton} ${colorDropdownOpen ? styles.active : ''}`}
              onClick={() => setColorDropdownOpen(!colorDropdownOpen)}
              style={{ backgroundColor: drawingColor }}
              aria-label='Выбрать цвет'
            />
            {colorDropdownOpen && (
              <Portal>
                <div
                  className={styles.dropdownMenu}
                  style={{
                    position: 'fixed',
                    top: `${getDropdownPosition(colorButtonRef).top}px`,
                    left: `${getDropdownPosition(colorButtonRef).left}px`,
                    padding: `${DROPDOWN_PADDING}px`,
                    gap: `${DROPDOWN_GAP}px`,
                  }}>
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      className={`${styles.dropdownOption} ${color === drawingColor ? styles.active : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => changeDrawingColor(color)}
                      aria-label={`Установить цвет: ${color}`}
                    />
                  ))}
                </div>
              </Portal>
            )}
          </div>

          {!isOnlyColorMode && (
            <div className={styles.dropdownContainer}>
              <button
                ref={widthButtonRef}
                className={`${styles.dropdownButton} ${widthDropdownOpen ? styles.active : ''}`}
                onClick={() => setWidthDropdownOpen(!widthDropdownOpen)}
                aria-label={isTextAreaMode ? 'Выбрать размер текста' : 'Выбрать толщину линии'}>
                {isTextAreaMode ? (
                  <div style={{ fontSize: `${10 + drawingLineWidth * 2}px`, fontWeight: 'bold' }}>T</div>
                ) : (
                  <div style={{ height: `${drawingLineWidth}px`, width: '20px', backgroundColor: '#333' }}></div>
                )}
              </button>
              {widthDropdownOpen && (
                <Portal>
                  <div
                    className={styles.dropdownMenu}
                    style={{
                      position: 'fixed',
                      top: `${getDropdownPosition(widthButtonRef).top}px`,
                      left: `${getDropdownPosition(widthButtonRef).left}px`,
                      padding: `${DROPDOWN_PADDING}px`,
                      gap: `${DROPDOWN_GAP}px`,
                    }}>
                    {lineWidthOptions.map((width) => (
                      <button
                        key={width}
                        className={`${styles.dropdownOption} ${width === drawingLineWidth ? styles.active : ''}`}
                        onClick={() => changeLineWidth(width)}
                        aria-label={isTextAreaMode ? `Установить размер текста: ${width}` : `Установить толщину линии: ${width}`}>
                        {isTextAreaMode ? (
                          <div style={{ fontSize: `${10 + width * 2}px`, fontWeight: 'bold' }}>T</div>
                        ) : (
                          <div style={{ height: `${width}px`, width: '14px', backgroundColor: '#333' }}></div>
                        )}
                      </button>
                    ))}
                  </div>
                </Portal>
              )}
            </div>
          )}

          {!isOnlyColorMode && (
            <div className={styles.dropdownContainer}>
              <button
                ref={opacityButtonRef}
                className={`${styles.dropdownButton} ${opacityDropdownOpen ? styles.active : ''}`}
                onClick={() => setOpacityDropdownOpen(!opacityDropdownOpen)}
                aria-label='Выбрать прозрачность'>
                <div
                  style={{
                    width: '20px',
                    height: '16px',
                    backgroundColor: drawingColor,
                    opacity: drawingOpacity,
                    border: '1px solid #ccc',
                    borderRadius: '2px',
                  }}
                />
              </button>
              {opacityDropdownOpen && (
                <Portal>
                  <div
                    className={styles.dropdownMenu}
                    style={{
                      position: 'fixed',
                      top: `${getDropdownPosition(opacityButtonRef).top}px`,
                      left: `${getDropdownPosition(opacityButtonRef).left}px`,
                      padding: `${DROPDOWN_PADDING}px`,
                      gap: `${DROPDOWN_GAP}px`,
                    }}>
                    {opacityOptions.map((opacity) => {
                      const transparencyPercent = Math.round((1 - opacity) * 100);
                      return (
                        <button
                          key={opacity}
                          className={`${styles.dropdownOption} ${opacity === drawingOpacity ? styles.active : ''}`}
                          onClick={() => changeOpacity(opacity)}
                          aria-label={`Установить прозрачность: ${transparencyPercent}%`}>
                          <div
                            style={{
                              width: '20px',
                              height: '16px',
                              backgroundColor: drawingColor,
                              opacity: opacity,
                              border: '1px solid #ccc',
                              borderRadius: '2px',
                            }}
                          />
                          <span style={{ fontSize: '10px', marginLeft: '4px' }}>{transparencyPercent}%</span>
                        </button>
                      );
                    })}
                  </div>
                </Portal>
              )}
            </div>
          )}
        </div>
      </div>
    </DraggableDialog>
  );
};
