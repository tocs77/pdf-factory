import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const TextHighlightIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
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
      <g transform='scale(0.75 0.75)'>
        <path fillRule='evenodd' clipRule='evenodd' d='M2 24H14V26H2V24Z' />
        <path fillRule='evenodd' clipRule='evenodd' d='M2 28H30V30H2V28Z' />
        <path
          fillRule='evenodd'
          clipRule='evenodd'
          d='M25.2914 6.49096L21.6289 2.82843L12.3267 12.1307L15.9892 15.7932L25.2914 6.49096ZM23.0431 1.41421C22.2621 0.633165 20.9957 0.633165 20.2147 1.41421L9.49825 12.1307L15.9892 18.6216L26.7057 7.90518C27.4867 7.12413 27.4867 5.8578 26.7057 5.07675L23.0431 1.41421Z'
        />
        <path d='M9.5 12.1309L15.991 18.6218L10.4905 19.7719L8.54359 17.825L9.5 12.1309Z' />
        <path d='M8.57055 17.8538L10.4798 19.763L8.95824 20.7759L6.39999 20.7762L6.39996 19.9768L8.57055 17.8538Z' />
      </g>
    </svg>
  );
};
