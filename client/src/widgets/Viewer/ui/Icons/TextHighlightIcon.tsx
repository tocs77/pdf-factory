import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const TextHighlightIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' width={size} height={size} viewBox='0 0 24 24' fill='none' {...rest}>
      {/* Fat crayon/highlighter body */}
      <rect x='13' y='2' width='6' height='14' rx='1' fill={color} stroke={color} strokeWidth='1.5' />

      {/* Crayon tip (tapered end) */}
      <path d='M13 16L16 20L19 16H13Z' fill={color} stroke={color} strokeWidth='1.5' strokeLinejoin='round' />

      {/* Crayon band/label */}
      <rect x='13' y='5' width='6' height='2.5' fill={color} opacity='0.3' />

      {/* Highlighted text marks */}
      <rect x='2' y='10' width='9' height='2.5' rx='1' fill={color} opacity='0.25' />
      <rect x='2' y='14' width='7' height='2.5' rx='1' fill={color} opacity='0.25' />
      <rect x='2' y='18' width='8' height='2.5' rx='1' fill={color} opacity='0.25' />
    </svg>
  );
};
