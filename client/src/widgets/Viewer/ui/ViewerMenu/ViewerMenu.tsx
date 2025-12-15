import { useContext, useEffect, useRef } from 'react';

import { ViewerContext } from '../../model/context/viewerContext';
import { DrawingMode } from '../../model/types/viewerSchema';
import { classNames } from '../../utils/classNames';

import {
  CompareDiffIcon,
  CompareSideBySideIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ThumbnailToggleIcon,
  ZoomAreaIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../Icons';
import { ToolsPanel } from '../ToolsPanel/ToolsPanel';

import classes from './ViewerMenu.module.scss';

interface ViewerMenuProps {
  currentPage: number;
  onPageChange?: (pageNumber: number) => void;
  hasCompare?: boolean;
  viewOnly?: boolean;
  extendedControls?: React.ReactNode;
  mobile: boolean;
}

export const ViewerMenu = (props: ViewerMenuProps) => {
  const { currentPage, onPageChange, hasCompare, viewOnly = false, extendedControls, mobile } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingMode, showThumbnails, compareMode, zoomWithCtrl } = state;

  // Refs to track rotation in progress and prevent rapid clicks
  const isRotationInProgressRef = useRef(false);
  const rotationDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up rotation timer on unmount
  useEffect(() => {
    return () => {
      if (rotationDebounceTimerRef.current) {
        clearTimeout(rotationDebounceTimerRef.current);
      }
    };
  }, []);

  const zoomIn = () => dispatch({ type: 'setScale', payload: scale + 0.25 });
  const zoomOut = () => dispatch({ type: 'setScale', payload: scale - 0.25 });

  const rotatePageClockwise = () => {
    // Prevent rapid clicks by checking if rotation is already in progress
    if (isRotationInProgressRef.current) {
      return;
    }

    // Set the rotation in progress flag
    isRotationInProgressRef.current = true;

    // First make sure the page is scrolled into view
    if (onPageChange) {
      // First trigger the page change to ensure it's scrolled into view
      onPageChange(currentPage);

      // Then, after a small delay, apply the rotation
      setTimeout(() => {
        // First try to scroll directly to the page element
        const pageElement = document.getElementById(`pdf-page-${currentPage}`);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'auto', block: 'center' });

          // Apply rotation after scrolling
          setTimeout(() => {
            dispatch({ type: 'rotatePageClockwise', payload: currentPage });

            // Reset the rotation in progress flag after sufficient time for rendering
            // This prevents rapid clicks from breaking renders
            if (rotationDebounceTimerRef.current) {
              clearTimeout(rotationDebounceTimerRef.current);
            }
            rotationDebounceTimerRef.current = setTimeout(() => {
              isRotationInProgressRef.current = false;
              rotationDebounceTimerRef.current = null;
            }, 500); // 500ms debounce between rotations
          }, 100);
        } else {
          // If element not found, just rotate
          dispatch({ type: 'rotatePageClockwise', payload: currentPage });

          // Reset the rotation in progress flag
          if (rotationDebounceTimerRef.current) {
            clearTimeout(rotationDebounceTimerRef.current);
          }
          rotationDebounceTimerRef.current = setTimeout(() => {
            isRotationInProgressRef.current = false;
            rotationDebounceTimerRef.current = null;
          }, 500);
        }
      }, 50);
    } else {
      // If no page change handler, just rotate
      dispatch({ type: 'rotatePageClockwise', payload: currentPage });

      // Reset the rotation in progress flag
      if (rotationDebounceTimerRef.current) {
        clearTimeout(rotationDebounceTimerRef.current);
      }
      rotationDebounceTimerRef.current = setTimeout(() => {
        isRotationInProgressRef.current = false;
        rotationDebounceTimerRef.current = null;
      }, 500);
    }
  };

  const rotatePageCounterClockwise = () => {
    // Prevent rapid clicks by checking if rotation is already in progress
    if (isRotationInProgressRef.current) {
      return;
    }

    // Set the rotation in progress flag
    isRotationInProgressRef.current = true;

    // First make sure the page is scrolled into view
    if (onPageChange) {
      // First trigger the page change to ensure it's scrolled into view
      onPageChange(currentPage);

      // Then, after a small delay, apply the rotation
      setTimeout(() => {
        // First try to scroll directly to the page element
        const pageElement = document.getElementById(`pdf-page-${currentPage}`);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'auto', block: 'center' });

          // Apply rotation after scrolling
          setTimeout(() => {
            dispatch({ type: 'rotatePageCounterClockwise', payload: currentPage });

            // Reset the rotation in progress flag after sufficient time for rendering
            // This prevents rapid clicks from breaking renders
            if (rotationDebounceTimerRef.current) {
              clearTimeout(rotationDebounceTimerRef.current);
            }
            rotationDebounceTimerRef.current = setTimeout(() => {
              isRotationInProgressRef.current = false;
              rotationDebounceTimerRef.current = null;
            }, 500); // 500ms debounce between rotations
          }, 100);
        } else {
          // If element not found, just rotate
          dispatch({ type: 'rotatePageCounterClockwise', payload: currentPage });

          // Reset the rotation in progress flag
          if (rotationDebounceTimerRef.current) {
            clearTimeout(rotationDebounceTimerRef.current);
          }
          rotationDebounceTimerRef.current = setTimeout(() => {
            isRotationInProgressRef.current = false;
            rotationDebounceTimerRef.current = null;
          }, 500);
        }
      }, 50);
    } else {
      // If no page change handler, just rotate
      dispatch({ type: 'rotatePageCounterClockwise', payload: currentPage });

      // Reset the rotation in progress flag
      if (rotationDebounceTimerRef.current) {
        clearTimeout(rotationDebounceTimerRef.current);
      }
      rotationDebounceTimerRef.current = setTimeout(() => {
        isRotationInProgressRef.current = false;
        rotationDebounceTimerRef.current = null;
      }, 500);
    }
  };

  const changeDrawingMode = (mode: DrawingMode) => {
    if (mode === drawingMode) {
      dispatch({ type: 'setDrawingMode', payload: 'none' });
    } else {
      dispatch({ type: 'setDrawingMode', payload: mode });
    }
  };

  type MenuButton = {
    key: string;
    element: React.ReactNode;
    show?: boolean;
  };

  const menuButtons: MenuButton[] = [
    {
      key: 'thumbnailToggle',
      element: (
        <button
          key='thumbnailToggle'
          className={classNames(classes.thumbnailToggle, { [classes.active]: showThumbnails }, [])}
          onClick={() => dispatch({ type: 'toggleThumbnails' })}
          title={showThumbnails ? 'Скрыть миниатюры' : 'Показать миниатюры'}>
          <ThumbnailToggleIcon />
        </button>
      ),
    },
    {
      key: 'rotateCounterClockwise',
      show: !mobile,
      element: (
        <button
          key='rotateCounterClockwise'
          onClick={rotatePageCounterClockwise}
          className={classes.rotationButton}
          title='Повернуть против часовой стрелки'>
          <RotateCcwIcon />
        </button>
      ),
    },
    {
      key: 'rotateClockwise',
      show: !mobile,
      element: (
        <button
          key='rotateClockwise'
          onClick={rotatePageClockwise}
          className={classes.rotationButton}
          title='Повернуть по часовой стрелке'>
          <RotateCwIcon />
        </button>
      ),
    },
    {
      key: 'zoomOut',
      show: !mobile,
      element: (
        <button key='zoomOut' onClick={zoomOut} className={classes.zoomButton} title='Уменьшить масштаб'>
          <ZoomOutIcon />
        </button>
      ),
    },
    {
      key: 'zoomPercentage',
      show: !mobile,
      element: (
        <span key='zoomPercentage' className={classes.zoomPercentage}>
          {Math.round(scale * 100)}%
        </span>
      ),
    },
    {
      key: 'zoomIn',
      show: !mobile,
      element: (
        <button key='zoomIn' onClick={zoomIn} className={classes.zoomButton} title='Увеличить масштаб'>
          <ZoomInIcon />
        </button>
      ),
    },
    {
      key: 'zoomArea',
      show: !viewOnly && !mobile,
      element: (
        <button
          key='zoomArea'
          onClick={() => changeDrawingMode('zoomArea')}
          className={`${classes.zoomButton} ${drawingMode === 'zoomArea' ? classes.active : ''}`}
          style={{ padding: '4px' }}
          title='Увеличить выбранную область'>
          <ZoomAreaIcon />
        </button>
      ),
    },
    {
      key: 'zoomCheckbox',
      show: !mobile,
      element: (
        <label key='zoomCheckbox' className={classes.zoomCheckbox} title='Масштабирование колесиком мыши только с клавишей Ctrl'>
          <input
            type='checkbox'
            checked={zoomWithCtrl}
            onChange={(e) => dispatch({ type: 'setZoomWithCtrl', payload: e.target.checked })}
          />
          <span>Масштаб с Ctrl</span>
        </label>
      ),
    },
    {
      key: 'compareDiff',
      show: hasCompare,
      element: (
        <button
          key='compareDiff'
          onClick={() =>
            dispatch({
              type: 'setCompareMode',
              payload: compareMode === 'diff' ? 'none' : 'diff',
            })
          }
          className={`${classes.zoomButton} ${compareMode === 'diff' ? classes.active : ''}`}
          title={compareMode === 'diff' ? 'Отключить сравнение изменений' : 'Включить сравнение изменений'}>
          <CompareDiffIcon />
        </button>
      ),
    },
    {
      key: 'compareSideBySide',
      show: hasCompare,
      element: (
        <button
          key='compareSideBySide'
          onClick={() =>
            dispatch({
              type: 'setCompareMode',
              payload: compareMode === 'sideBySide' ? 'none' : 'sideBySide',
            })
          }
          className={`${classes.zoomButton} ${compareMode === 'sideBySide' ? classes.active : ''}`}
          title={compareMode === 'sideBySide' ? 'Отключить сравнение бок о бок' : 'Включить сравнение бок о бок'}>
          <CompareSideBySideIcon />
        </button>
      ),
    },
  ];

  return (
    <div className={classNames(classes.ViewerMenu, { [classes.mobile]: mobile })}>
      {extendedControls}
      {menuButtons.filter((button) => button.show !== false).map((button) => button.element)}
      {!viewOnly && (
        <>
          <div className={classes.spacer}></div>
          <ToolsPanel mobile={mobile} />
        </>
      )}
    </div>
  );
};
