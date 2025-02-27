interface CalcColumnSizesProps {
  totalWidth: number;
  columns: Record<string, number>;
  constCols?: string[];
  minColWidth?: number;
}

export const calcColumnSizes = (props: CalcColumnSizesProps) => {
  const { totalWidth, columns, constCols = ['icon', 'select', 'settings'], minColWidth = 30 } = props;
  let remainingWidth = totalWidth;
  let oldTotalWidth = 0;
  const newCols: Record<string, number> = {};
  const tempCols: Record<string, number> = {};

  for (const col in columns) {
    if (constCols.indexOf(col) !== -1) {
      newCols[col] = columns[col];
      remainingWidth -= columns[col];
      continue;
    }

    oldTotalWidth += columns[col];
    tempCols[col] = columns[col];
  }

  if (Object.keys(tempCols).length * minColWidth > remainingWidth) {
    for (const col in tempCols) {
      newCols[col] = minColWidth;
    }
    return newCols;
  }

  for (const col in tempCols) {
    newCols[col] = Math.floor(remainingWidth * (tempCols[col] / oldTotalWidth));
  }

  return newCols;
};
