import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' width={size} height={size} viewBox='0 0 20 20' fill='none' {...rest}>
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M12.5 16.6L7.1 11.1C6.9 10.9 6.9 10.6 7.1 10.4L12.5 4.90001C12.7 4.70001 13 4.70001 13.2 4.90001C13.4 5.10001 13.4 5.40001 13.2 5.60001L8.3 10.8L13.3 15.9C13.5 16.1 13.5 16.4 13.3 16.6C13.2 16.7 13 16.8 12.9 16.8C12.8 16.8 12.6 16.7 12.5 16.6Z'
        fill={color}
      />
    </svg>
  );
};
