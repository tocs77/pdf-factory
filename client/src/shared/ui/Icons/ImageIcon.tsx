import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ImageIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
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
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
      <circle cx='8.5' cy='8.5' r='1.5'></circle>
      <polyline points='21 15 16 10 5 21'></polyline>
    </svg>
  );
};
