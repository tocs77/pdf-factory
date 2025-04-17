import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const PencilIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24' // Original used 32x32, using common 24x24
      fill={color} // Original Figma had fill="#287AFF", using prop color
      stroke='none'
      {...rest}>
      {/* Path from previous attempt, potentially scaled */}
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M25.5478 9.75871L22.2478 6.45871C21.6257 5.84889 20.63 5.84889 20.0078 6.45871L6.00781 20.4587V25.9987H11.5378L25.5378 11.9987C26.1476 11.3766 26.1476 10.3809 25.5378 9.75871H25.5478ZM10.7078 23.9987H8.00781V21.2987L17.4478 11.8487L20.1578 14.5587L10.7078 23.9987ZM18.8578 10.4387L21.5678 13.1487L23.8378 10.8787L21.1278 8.16871L18.8578 10.4387Z'
        transform='scale(0.75 0.75)' // Attempting to scale from 32x32 down to 24x24
      />
    </svg>
  );
};
