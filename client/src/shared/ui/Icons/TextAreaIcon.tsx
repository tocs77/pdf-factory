import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const TextAreaIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
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
          d='M4 30C2.89543 30 2 29.1046 2 28V4.40003C2 3.29546 2.89543 2.40002 4 2.40002H28C29.1046 2.40002 30 3.29545 30 4.40002V28C30 29.1046 29.1046 30 28 30H4ZM4 28L4 4.40002H28V28H4Z'
        />
        <path fillRule='evenodd' clipRule='evenodd' d='M8 10H24V12H8V10Z' />
        <path fillRule='evenodd' clipRule='evenodd' d='M8 14H24V16H8V14Z' />
        <path fillRule='evenodd' clipRule='evenodd' d='M8 18H16V20H8V18Z' />
      </g>
    </svg>
  );
};
