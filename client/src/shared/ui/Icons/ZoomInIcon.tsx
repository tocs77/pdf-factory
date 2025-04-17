import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ZoomInIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...rest }) => {
  // Original SVG was just a plus sign. Replicating with simple paths.
  // The Figma version had path d="M17 15V7H15V15H7V17H15V25H17V17H25V15H17Z" in 32x32 viewbox
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill={color} // Use fill for simple shape
      stroke='none'
      {...rest}>
      <path d='M11 5H13V11H19V13H13V19H11V13H5V11H11z' />
    </svg>
  );
};
