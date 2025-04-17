import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const TextStrikethroughIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
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
        d='M28 15.0001H17.956C17.512 14.8807 17.0659 14.769 16.618 14.6651C13.81 14.0011 12.222 13.5151 12.222 11.2421C12.1759 10.4489 12.4609 9.67219 13.009 9.09706C13.8584 8.39856 14.9223 8.01367 16.022 8.00706C18.852 7.93706 20.157 8.89706 21.224 10.3571L22.839 9.17706C21.2999 6.96681 18.6906 5.75573 16.009 6.00706C14.391 6.01739 12.8302 6.6066 11.609 7.66806C10.6735 8.61701 10.1719 9.91049 10.223 11.2421C10.1339 12.7063 10.7851 14.1176 11.957 15.0001H4V17.0001H17.652C19.619 17.5701 20.795 18.3121 20.825 20.3581C20.8907 21.242 20.5773 22.1121 19.963 22.7511C18.9048 23.5852 17.5901 24.0266 16.243 24.0001C14.2057 23.941 12.3086 22.9488 11.098 21.3091L9.565 22.5931C11.1389 24.6905 13.5903 25.947 16.212 26.0001H16.312C18.1588 26.0213 19.9512 25.3754 21.36 24.1811C22.3711 23.1616 22.9034 21.7618 22.825 20.3281C22.8623 19.1153 22.4531 17.931 21.675 17.0001H28V15.0001Z'
        transform='scale(0.75 0.75)' // Attempting to scale from 32x32 down to 24x24
      />
    </svg>
  );
};
