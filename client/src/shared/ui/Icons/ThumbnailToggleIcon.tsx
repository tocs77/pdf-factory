import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ThumbnailToggleIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' width={size} height={size} viewBox='0 0 24 24' fill={color} stroke='none' {...rest}>
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M23.9995 14H25.9995V5.99999C26.0319 5.46026 25.8317 4.93249 25.4493 4.55015C25.067 4.16782 24.5392 3.96755 23.9995 3.99999H15.9995V5.99999H23.9995V14ZM23.9995 19V17H29.9995V23H27.9995V20.6L23.1995 26H25.9995V28H19.9995V22H21.9995V24.4L26.7995 19H23.9995ZM19.9995 19H21.9995V9.99999C22.0319 9.46027 21.8317 8.93249 21.4493 8.55015C21.067 8.16782 20.5392 7.96755 19.9995 7.99999H9.9995V9.99999H19.9995V19ZM3.9995 28H15.9995C16.5392 28.0324 17.067 27.8322 17.4493 27.4498C17.8317 27.0675 18.0319 26.5397 17.9995 26V14C18.0319 13.4603 17.8317 12.9325 17.4493 12.5502C17.067 12.1678 16.5392 11.9675 15.9995 12H3.9995C3.45978 11.9675 2.932 12.1678 2.54967 12.5502C2.16733 12.9325 1.96706 13.4603 1.9995 14V26C1.96706 26.5397 2.16733 27.0675 2.54967 27.4498C2.932 27.8322 3.45978 28.0324 3.9995 28ZM3.9995 26V14H15.9995V26H3.9995Z'
        transform='scale(0.75 0.75)'
      />
    </svg>
  );
};
