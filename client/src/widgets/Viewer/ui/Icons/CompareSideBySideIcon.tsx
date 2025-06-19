import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const CompareSideBySideIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
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
      <rect x='3' y='3' width='7' height='18' rx='1'></rect>
      <rect x='14' y='3' width='7' height='18' rx='1'></rect>
      <line x1='10' y1='12' x2='14' y2='12'></line>
    </svg>
  );
};
