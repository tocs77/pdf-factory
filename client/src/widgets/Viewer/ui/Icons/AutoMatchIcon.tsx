import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const AutoMatchIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
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
      {/* Two linked pages */}
      <rect x='3' y='4' width='8' height='12' rx='1' />
      <rect x='13' y='8' width='8' height='12' rx='1' />
      <path d='M7 16l-1.5 3L4 16l-3-1.5L4 13l1.5-3L7 13l3 1.5z' />
      <line x1='6' y1='8' x2='8' y2='8' />
      <line x1='16' y1='12' x2='18' y2='12' />
      <line x1='16' y1='15' x2='18' y2='15' />
    </svg>
  );
};
