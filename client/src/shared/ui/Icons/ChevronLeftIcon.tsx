import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
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
        d='M10 16L20 6L21.4 7.4L12.8 16L21.4 24.6L20 26L10 16Z'
        transform='scale(0.75 0.75)' // Attempting to scale from 32x32 down to 24x24
      />
    </svg>
  );
};
