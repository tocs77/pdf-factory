import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ExtensionLineIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24' // Original used 32x32, using common 24x24
      fill={color}
      stroke='none'
      {...rest}>
      {/* Path from previous attempt, potentially scaled */}
      <g transform='scale(0.75 0.75)'>
        <path
          fillRule='evenodd'
          clipRule='evenodd'
          d='M0.994257 26H11.9943V24H4.40426L18.9883 9.41596L17.5691 8.00596L2.99426 22.59V15H0.994257V26Z'
        />
        <path d='M17.5625 8H30V10H17.5625V8Z' />
      </g>
    </svg>
  );
};
