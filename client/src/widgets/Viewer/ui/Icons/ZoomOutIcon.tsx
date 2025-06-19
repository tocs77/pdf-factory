import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ZoomOutIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' width={size} height={size} viewBox='0 0 24 24' fill={color} stroke='none' {...rest}>
      <path d='M5 11H19V13H5z' />
    </svg>
  );
};
