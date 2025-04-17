import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const CompareDiffIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
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
      {/* First document slightly offset */}
      <rect x='5' y='3' width='12' height='16' rx='1' />
      {/* Second document overlapping */}
      <rect x='9' y='5' width='12' height='16' rx='1' />
      {/* Diff indicator lines */}
      <line x1='12' y1='9' x2='16' y2='9' />
      <line x1='12' y1='13' x2='18' y2='13' />
      <line x1='12' y1='17' x2='14' y2='17' />
    </svg>
  );
};
