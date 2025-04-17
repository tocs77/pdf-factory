import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const RectSelectionIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke={color}
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeDasharray='4 4'
      {...rest}>
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
    </svg>
  );
};
