import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const RotateCcwIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
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
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M14 28V16C14.0011 14.8959 14.8959 14.0011 16 14H28C29.1041 14.0011 29.9989 14.8959 30 16V28C29.9989 29.1041 29.1041 29.9989 28 30H16C14.8959 29.9989 14.0011 29.1041 14 28ZM16 16L15.999 28H28V16H16ZM2 15L3.41 13.59L6 16.17V11C6.00441 7.13583 9.13583 4.00441 13 4H18V6H13C10.2399 6.00331 8.00331 8.23995 8 11V16.17L10.59 13.59L12 15L7 20L2 15Z'
        transform='scale(0.75 0.75)' // Attempting to scale from 32x32 down to 24x24
      />
    </svg>
  );
};
