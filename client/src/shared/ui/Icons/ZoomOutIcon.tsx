import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ZoomOutIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
  // Original SVG was just a minus sign. Replicating with a simple line.
  // The Figma version had path d="M8 15H24V17H8V15Z" in 32x32 viewbox
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill={color} // Use fill for simple shape
      stroke='none'
      {...rest}>
      <path d='M5 11H19V13H5z' />
    </svg>
  );
};
