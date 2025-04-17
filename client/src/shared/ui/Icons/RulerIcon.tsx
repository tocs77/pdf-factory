import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const RulerIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke={color}
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
      {...rest}>
      {/* Original path had fill="rgba(255,255,255,0.15)", omitting for simplicity */}
      {/* <path d="M2 8h20v8H2z" fill="rgba(255,255,255,0.15)"></path> */}
      <rect x='2' y='8' width='20' height='8' fill='none'></rect> {/* Changed from self-closing */}
      <line x1='6' y1='8' x2='6' y2='12'></line>
      <line x1='10' y1='8' x2='10' y2='16'></line>
      <line x1='14' y1='8' x2='14' y2='12'></line>
      <line x1='18' y1='8' x2='18' y2='16'></line>
    </svg>
  );
};
