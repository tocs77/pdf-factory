import React, { useContext, useState, useEffect } from 'react';

import { DraggableDialog } from '@/shared/UI/DraggableDialog';

import { ViewerContext, getCalibrationForPage } from '../../model/context/viewerContext';
import { Ruler, Rulers, Drawing } from '../../model/types/Drawings';
import { isLightColor } from '../../utils/textToolUtils';

import styles from './RulerCalibrationMenu.module.scss';

interface RulerCalibrationMenuProps {
  pixelValue: number; // The pixel distance of the selected/newest ruler
  rulers: Array<Ruler & { id: number }>; // All rulers being created
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void; // Callback to send Rulers drawing to DraftLayer
  onClearRulers: () => void; // Callback to clear rulers in RulerDrawingLayer
}

export const RulerCalibrationMenu: React.FC<RulerCalibrationMenuProps> = ({
  pixelValue,
  rulers,
  pageNumber,
  onDrawingCreated,
  onClearRulers,
}) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { calibration: calibrationMap, drawingColor } = state;
  const calibration = getCalibrationForPage(calibrationMap, pageNumber);

  // Local state for real value and units
  const [realValue, setRealValue] = useState<string>(pixelValue > 0 ? pixelValue.toString() : '');
  const [units, setUnits] = useState<string>(calibration.unitName || 'px');

  // Update local state when pixelValue changes (new ruler selected/created)
  useEffect(() => {
    if (pixelValue <= 0) {
      setRealValue('');
      setUnits(calibration.unitName || 'mm');
      return;
    }

    // If calibration is default (pixelsPerUnit === 1 and unitName === 'px'), use pixel value
    if (calibration.pixelsPerUnit === 1 && calibration.unitName === 'mm') {
      setRealValue(Math.round(pixelValue).toString());
      setUnits('mm');
    } else {
      // Convert pixel value to calibrated units and round to whole number
      const calibratedValue = pixelValue / calibration.pixelsPerUnit;
      setRealValue(Math.round(calibratedValue).toString());
      setUnits(calibration.unitName);
    }
  }, [pixelValue, calibration.pixelsPerUnit, calibration.unitName]);

  // Handle real value change
  const handleRealValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRealValue(value);

    // Apply calibration immediately if valid and pixelValue > 0
    if (pixelValue > 0) {
      const numValue = Number.parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0) {
        dispatch({
          type: 'applyCalibration',
          payload: {
            pageNumber,
            actualSize: numValue,
            unitName: units || 'px',
            pixelDistance: pixelValue,
          },
        });
      }
    }
  };

  // Handle units change
  const handleUnitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUnits = e.target.value.trim() || 'px';
    setUnits(newUnits);

    // Apply calibration with new units if pixelValue > 0
    if (pixelValue > 0) {
      const numValue = Number.parseInt(realValue, 10);
      if (!isNaN(numValue) && numValue > 0) {
        dispatch({
          type: 'applyCalibration',
          payload: {
            pageNumber,
            actualSize: numValue,
            unitName: newUnits,
            pixelDistance: pixelValue,
          },
        });
      }
    }
  };

  // Handle finish button click - send all rulers as Rulers drawing
  const handleFinishClick = () => {
    if (rulers.length === 0) {
      return;
    }

    // Calculate bounding box from all rulers
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = 0;
    let maxY = 0;

    // Text label dimensions (matching renderRulerCompleted.ts)
    const textHeight = 20; // Approximate text height
    const padding = 6; // Padding around text
    const labelOffset = 15; // Offset to position text above the line
    const labelTotalHeight = textHeight + padding; // Total label box height
    const labelExtensionAbove = labelOffset + labelTotalHeight / 2; // How far label extends above midpoint
    // Estimate max label width (for longest possible text like "999.9 mm" or similar)
    const estimatedMaxLabelWidth = 80; // Approximate max width for label text
    const labelExtensionHorizontal = estimatedMaxLabelWidth / 2 + padding; // Half width + padding

    rulers.forEach((ruler) => {
      minX = Math.min(minX, ruler.startPoint.x, ruler.endPoint.x);
      minY = Math.min(minY, ruler.startPoint.y, ruler.endPoint.y);
      maxX = Math.max(maxX, ruler.startPoint.x, ruler.endPoint.x);
      maxY = Math.max(maxY, ruler.startPoint.y, ruler.endPoint.y);

      // Account for text label extending above the ruler line
      // Label is positioned at midpoint with offset above, so subtract from minY
      const midPointX = (ruler.startPoint.x + ruler.endPoint.x) / 2;
      const midPointY = (ruler.startPoint.y + ruler.endPoint.y) / 2;
      const labelTopY = midPointY - labelExtensionAbove;
      minY = Math.min(minY, labelTopY);

      // Account for label extending horizontally from midpoint
      minX = Math.min(minX, midPointX - labelExtensionHorizontal);
      maxX = Math.max(maxX, midPointX + labelExtensionHorizontal);
    });

    // Remove the id property from rulers before creating the drawing
    const rulersWithoutId = rulers.map(({ id, ...ruler }) => ruler);

    const rulersDrawing: Rulers = {
      id: '',
      type: 'rulers' as const,
      pageNumber: pageNumber,
      rulers: rulersWithoutId,
      pixelsPerUnit: calibration.pixelsPerUnit,
      units: calibration.unitName,
      boundingBox: {
        left: minX === Number.MAX_VALUE ? 0 : minX,
        top: minY === Number.MAX_VALUE ? 0 : minY,
        right: maxX,
        bottom: maxY,
      },
    };

    // Send drawing to DraftLayer
    onDrawingCreated(rulersDrawing);

    // Clear rulers in RulerDrawingLayer
    onClearRulers();
  };

  return (
    <div className={styles.wrapper}>
      <DraggableDialog
        initialXPos={100}
        initialYPos={100}
        showHeader={false}
        grabAreas={['left', 'right']}
        onPositionChange={() => {}} // Position not stored in state for now
        resizable={false}>
        <div className={styles.calibrationMenuContainer} data-dragscroll-ignore='true'>
          <div className={styles.calibrationRow}>
            <div className={styles.calibrationColumn}>
              <label className={styles.label}>Пиксели:</label>
              <input
                type='text'
                value={pixelValue > 0 ? Math.round(pixelValue) : ''}
                readOnly
                className={`${styles.input} ${styles.readonly}`}
              />
            </div>
            <div className={styles.calibrationColumn}>
              <label className={styles.label}>Значение:</label>
              <input
                type='number'
                step='0.1'
                min='0.1'
                value={realValue}
                onChange={handleRealValueChange}
                className={styles.input}
                placeholder='Значение'
                disabled={pixelValue <= 0}
              />
            </div>
            <div className={styles.calibrationColumn}>
              <label className={styles.label}>Единицы:</label>
              <input
                type='text'
                value={units}
                onChange={handleUnitsChange}
                className={styles.input}
                placeholder='см, мм, дюйм'
                disabled={pixelValue <= 0}
              />
            </div>
            <div className={styles.actionButtons}>
              <button
                className={styles.finishButton}
                onClick={handleFinishClick}
                disabled={rulers.length === 0}
                title='Завершить создание линеек'
                style={{
                  backgroundColor: drawingColor,
                  color: isLightColor(drawingColor) ? '#333' : 'white',
                }}>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='16'
                  height='16'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='3'
                  strokeLinecap='round'
                  strokeLinejoin='round'>
                  <polyline points='20 6 9 17 4 12'></polyline>
                </svg>
                <span>Готово</span>
              </button>
            </div>
          </div>
        </div>
      </DraggableDialog>
    </div>
  );
};
