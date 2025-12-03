import { useContext } from 'react';

import {
  DrawAreaIcon,
  ExtensionLineIcon,
  ImageIcon,
  LineIcon,
  PencilIcon,
  PinSelectionIcon,
  RectangleIcon,
  RectSelectionIcon,
  RulerIcon,
  TextAreaIcon,
  TextHighlightIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from '../Icons';

import { ViewerContext } from '../../model/context/viewerContext';
import { DrawingMode } from '../../model/types/viewerSchema';

import classes from './ToolsPanel.module.scss';

interface ToolsPanelProps {
  mobile: boolean;
}

export const ToolsPanel = ({ mobile }: ToolsPanelProps) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { drawingMode } = state;

  const changeDrawingMode = (mode: DrawingMode) => {
    if (mode === drawingMode) {
      dispatch({ type: 'setDrawingMode', payload: 'none' });
    } else {
      dispatch({ type: 'setDrawingMode', payload: mode });
    }
  };

  const toggleTextHighlight = () => {
    dispatch({
      type: 'setDrawingMode',
      payload: drawingMode === 'textHighlight' ? 'none' : 'textHighlight',
    });
  };

  const toggleTextUnderline = () => {
    dispatch({
      type: 'setDrawingMode',
      payload: drawingMode === 'textUnderline' ? 'none' : 'textUnderline',
    });
  };

  const toggleTextCrossedOut = () => {
    dispatch({
      type: 'setDrawingMode',
      payload: drawingMode === 'textCrossedOut' ? 'none' : 'textCrossedOut',
    });
  };

  return (
    <div className={classes.toolPanel}>
      <div className={classes.toolButtons}>
        <div className={classes.toolGroup}>
          <button
            className={`${classes.toolButton} ${drawingMode === 'textHighlight' ? classes.active : ''}`}
            onClick={toggleTextHighlight}
            title={drawingMode === 'textHighlight' ? 'Отключить выделение текста' : 'Включить выделение текста'}>
            <TextHighlightIcon />
          </button>
          <button
            className={`${classes.toolButton} ${drawingMode === 'textUnderline' ? classes.active : ''}`}
            onClick={toggleTextUnderline}
            title={drawingMode === 'textUnderline' ? 'Отключить подчеркивание текста' : 'Включить подчеркивание текста'}>
            <TextUnderlineIcon />
          </button>
          <button
            className={`${classes.toolButton} ${drawingMode === 'textCrossedOut' ? classes.active : ''}`}
            onClick={toggleTextCrossedOut}
            title={drawingMode === 'textCrossedOut' ? 'Отключить зачеркивание текста' : 'Включить зачеркивание текста'}>
            <TextStrikethroughIcon />
          </button>
        </div>

        <div className={classes.separator}></div>

        <div className={classes.toolGroup}>
          <button
            className={`${classes.toolButton} ${drawingMode === 'freehand' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('freehand')}
            title={drawingMode === 'freehand' ? 'Отключить рисование от руки' : 'Включить рисование от руки'}>
            <PencilIcon />
          </button>

          {!mobile && (
            <button
              className={`${classes.toolButton} ${drawingMode === 'rectangle' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('rectangle')}
              title={drawingMode === 'rectangle' ? 'Отключить инструмент прямоугольник' : 'Включить инструмент прямоугольник'}>
              <RectangleIcon />
            </button>
          )}

          {!mobile && (
            <button
              className={`${classes.toolButton} ${drawingMode === 'extensionLine' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('extensionLine')}
              title={drawingMode === 'extensionLine' ? 'Отключить инструмент выноска' : 'Включить инструмент выноска'}>
              <ExtensionLineIcon />
            </button>
          )}

          {!mobile && (
            <button
              className={`${classes.toolButton} ${drawingMode === 'line' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('line')}
              title={drawingMode === 'line' ? 'Отключить инструмент линия' : 'Включить инструмент линия'}>
              <LineIcon />
            </button>
          )}

          <button
            className={`${classes.toolButton} ${drawingMode === 'ruler' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('ruler')}
            title={drawingMode === 'ruler' ? 'Отключить инструмент линейка' : 'Включить инструмент линейка'}>
            <RulerIcon />
          </button>

          <button
            className={`${classes.toolButton} ${drawingMode === 'textArea' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('textArea')}
            title={drawingMode === 'textArea' ? 'Отключить инструмент область текста' : 'Включить инструмент область текста'}>
            <TextAreaIcon />
          </button>

          <button
            className={`${classes.toolButton} ${drawingMode === 'image' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('image')}
            title={drawingMode === 'image' ? 'Отменить добавление изображения' : 'Добавить изображение'}>
            <ImageIcon />
          </button>
        </div>

        <div className={classes.separator}></div>

        <div className={classes.toolGroup}>
          <button
            className={`${classes.toolButton} ${drawingMode === 'drawArea' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('drawArea')}
            title={
              drawingMode === 'drawArea' ? 'Отключить инструмент область рисования' : 'Включить инструмент область рисования'
            }>
            <DrawAreaIcon />
          </button>
          {!mobile && (
            <button
              className={`${classes.toolButton} ${drawingMode === 'rectSelection' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('rectSelection')}
              title={
                drawingMode === 'rectSelection'
                  ? 'Отключить инструмент выделения прямоугольником'
                  : 'Включить инструмент выделения прямоугольником'
              }>
              <RectSelectionIcon />
            </button>
          )}
          <button
            className={`${classes.toolButton} ${drawingMode === 'pinSelection' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('pinSelection')}
            title={drawingMode === 'pinSelection' ? 'Отключить инструмент выбора пином' : 'Включить инструмент выбора пином'}>
            <PinSelectionIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
