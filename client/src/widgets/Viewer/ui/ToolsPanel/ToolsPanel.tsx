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

type ToolButtonConfig = {
  key: string;
  mode: DrawingMode;
  icon: React.ReactNode;
  title: (active: boolean) => string;
  show?: boolean;
};

type ToolGroup = {
  key: string;
  buttons: ToolButtonConfig[];
};

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

  const toolGroups: ToolGroup[] = [
    {
      key: 'drawing',
      buttons: [
        {
          key: 'freehand',
          mode: 'freehand',
          icon: <PencilIcon />,
          title: (active) => (active ? 'Отключить рисование от руки' : 'Включить рисование от руки'),
        },
        {
          key: 'rectangle',
          mode: 'rectangle',
          icon: <RectangleIcon />,
          title: (active) => (active ? 'Отключить инструмент прямоугольник' : 'Включить инструмент прямоугольник'),
          show: !mobile,
        },
        {
          key: 'extensionLine',
          mode: 'extensionLine',
          icon: <ExtensionLineIcon />,
          title: (active) => (active ? 'Отключить инструмент выноска' : 'Включить инструмент выноска'),
          show: !mobile,
        },
        {
          key: 'line',
          mode: 'line',
          icon: <LineIcon />,
          title: (active) => (active ? 'Отключить инструмент линия' : 'Включить инструмент линия'),
          show: !mobile,
        },
        {
          key: 'ruler',
          mode: 'ruler',
          icon: <RulerIcon />,
          title: (active) => (active ? 'Отключить инструмент линейка' : 'Включить инструмент линейка'),
        },
        {
          key: 'textArea',
          mode: 'textArea',
          icon: <TextAreaIcon />,
          title: (active) => (active ? 'Отключить инструмент область текста' : 'Включить инструмент область текста'),
        },
        {
          key: 'image',
          mode: 'image',
          icon: <ImageIcon />,
          title: (active) => (active ? 'Отменить добавление изображения' : 'Добавить изображение'),
        },
      ],
    },
    {
      key: 'selection',
      buttons: [
        {
          key: 'drawArea',
          mode: 'drawArea',
          icon: <DrawAreaIcon />,
          title: (active) => (active ? 'Отключить инструмент область рисования' : 'Включить инструмент область рисования'),
        },
        {
          key: 'rectSelection',
          mode: 'rectSelection',
          icon: <RectSelectionIcon />,
          title: (active) =>
            active ? 'Отключить инструмент выделения прямоугольником' : 'Включить инструмент выделения прямоугольником',
          show: !mobile,
        },
        {
          key: 'pinSelection',
          mode: 'pinSelection',
          icon: <PinSelectionIcon />,
          title: (active) => (active ? 'Отключить инструмент выбора пином' : 'Включить инструмент выбора пином'),
        },
      ],
    },
    {
      key: 'text',
      buttons: [
        {
          key: 'textHighlight',
          mode: 'textHighlight',
          icon: <TextHighlightIcon />,
          title: (active) => (active ? 'Отключить выделение текста' : 'Включить выделение текста'),
        },
        {
          key: 'textUnderline',
          mode: 'textUnderline',
          icon: <TextUnderlineIcon />,
          title: (active) => (active ? 'Отключить подчеркивание текста' : 'Включить подчеркивание текста'),
        },
        {
          key: 'textCrossedOut',
          mode: 'textCrossedOut',
          icon: <TextStrikethroughIcon />,
          title: (active) => (active ? 'Отключить зачеркивание текста' : 'Включить зачеркивание текста'),
        },
      ],
    },
  ];

  const renderButton = (button: ToolButtonConfig) => {
    const isActive = drawingMode === button.mode;
    const onClick =
      button.mode === 'textHighlight'
        ? toggleTextHighlight
        : button.mode === 'textUnderline'
          ? toggleTextUnderline
          : button.mode === 'textCrossedOut'
            ? toggleTextCrossedOut
            : () => changeDrawingMode(button.mode);

    return (
      <button
        key={button.key}
        className={`${classes.toolButton} ${isActive ? classes.active : ''}`}
        onClick={onClick}
        title={button.title(isActive)}>
        {button.icon}
      </button>
    );
  };

  return (
    <>
      {toolGroups.map((group, groupIndex) => (
        <div key={group.key} className={classes.toolGroupWrapper}>
          {groupIndex > 0 && <div className={classes.separator}></div>}
          <div className={classes.toolGroup}>{group.buttons.filter((button) => button.show !== false).map(renderButton)}</div>
        </div>
      ))}
    </>
  );
};
