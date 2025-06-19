import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const LineIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24' // Original used 32x32, using common 24x24
      fill={color} // Changed from original stroke
      stroke='none'
      {...rest}>
      {/* Path from previous attempt (arrow--down-left), potentially scaled */}
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M5.60156 24.6921L24.7413 5.55151L26.4384 7.24853L7.29866 26.3892L5.60156 24.6921Z'
        transform='scale(0.75 0.75)' // Attempting to scale from 32x32 down to 24x24
      />
    </svg>
  );
};
