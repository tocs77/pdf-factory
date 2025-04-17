import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ZoomAreaIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', ...rest }) => {
  // Original size was 14x14
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
      {...rest}>
      <circle cx='11' cy='11' r='8'></circle>
      <line x1='21' y1='21' x2='16.65' y2='16.65'></line>
      <line x1='11' y1='8' x2='11' y2='14'></line>
      <line x1='8' y1='11' x2='14' y2='11'></line>
    </svg>
  );
};
