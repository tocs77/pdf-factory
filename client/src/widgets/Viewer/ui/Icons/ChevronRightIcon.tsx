import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' width={size} height={size} viewBox='0 0 20 20' fill='none' {...rest}>
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M7.5 16.6L12.9 11.1C13.1 10.9 13.1 10.6 12.9 10.4L7.5 4.90001C7.3 4.70001 7 4.70001 6.8 4.90001C6.6 5.10001 6.6 5.40001 6.8 5.60001L11.7 10.8L6.7 15.9C6.5 16.1 6.5 16.4 6.7 16.6C6.8 16.7 7 16.8 7.1 16.8C7.2 16.8 7.4 16.7 7.5 16.6Z'
        fill={color}
      />
    </svg>
  );
};
