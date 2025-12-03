import React, { useContext, useState, useEffect } from 'react';

import { DraggableDialog } from '@/shared/UI/DraggableDialog';

import { ViewerContext } from '../../model/context/viewerContext';
import styles from './RulerCalibrationMenu.module.scss';

interface RulerCalibrationMenuProps {
  pixelValue: number; // The pixel distance of the selected/newest ruler
}

export const RulerCalibrationMenu: React.FC<RulerCalibrationMenuProps> = ({ pixelValue }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { calibration } = state;

  // Local state for real value and units
  const [realValue, setRealValue] = useState<string>(pixelValue > 0 ? pixelValue.toString() : '');
  const [units, setUnits] = useState<string>(calibration.unitName || 'px');

  // Update local state when pixelValue changes (new ruler selected/created)
  useEffect(() => {
    if (pixelValue <= 0) {
      setRealValue('');
      setUnits(calibration.unitName || 'px');
      return;
    }

    // If calibration is default (pixelsPerUnit === 1 and unitName === 'px'), use pixel value
    if (calibration.pixelsPerUnit === 1 && calibration.unitName === 'px') {
      setRealValue(Math.round(pixelValue).toString());
      setUnits('px');
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
            actualSize: numValue,
            unitName: newUnits,
            pixelDistance: pixelValue,
          },
        });
      }
    }
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
              <label className={styles.label}>Реальное значение:</label>
              <input
                type='number'
                step='1'
                min='1'
                value={realValue}
                onChange={handleRealValueChange}
                className={styles.input}
                placeholder='Введите значение'
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
          </div>
        </div>
      </DraggableDialog>
    </div>
  );
};
