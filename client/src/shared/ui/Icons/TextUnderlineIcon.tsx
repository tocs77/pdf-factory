import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const TextUnderlineIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
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
        d='M4 26H28V28H4V26ZM16 23C12.134 23 9 19.866 9 16V5H11V16C11 18.7614 13.2386 21 16 21C18.7614 21 21 18.7614 21 16V5H23V16C23 19.866 19.866 23 16 23Z'
        transform='scale(0.75 0.75)' // Attempting to scale from 32x32 down to 24x24
      />
    </svg>
  );
};
