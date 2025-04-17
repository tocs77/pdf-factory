import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const RotateCwIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
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
        d='M16 30H4C2.89589 29.9989 2.0011 29.1041 2 28V16C2.0011 14.8959 2.89589 14.0011 4 14H16C17.1041 14.0011 17.9989 14.8959 18 16V28C17.9989 29.1041 17.1041 29.9989 16 30ZM4 16V28H16.001L16 16H4ZM30 15L28.59 13.59L26 16.17V11C25.9956 7.13583 22.8642 4.00441 19 4H14V6H19C21.7601 6.00331 23.9967 8.23995 24 11V16.17L21.41 13.59L20 15L25 20L30 15Z'
        transform='scale(0.75 0.75)' // Attempting to scale from 32x32 down to 24x24
      />
    </svg>
  );
};
