import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const DrawAreaIcon: React.FC<IconProps> = ({ size = 16, color = 'black', ...rest }) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24' // Original used 32x32, using common 24x24
      fill={color}
      stroke='none'
      {...rest}>
      {/* Path from previous attempt (paintsquare icon), potentially scaled */}
      <g transform='scale(0.75 0.75)'>
        <path
          fillRule='evenodd'
          clipRule='evenodd'
          d='M27.5984 2.40002H4.39844C3.29387 2.40002 2.39844 3.29545 2.39844 4.40002V27.6C2.39844 28.7046 3.29387 29.6 4.39844 29.6H27.5984C28.703 29.6 29.5984 28.7046 29.5984 27.6V4.40002C29.5984 3.29545 28.703 2.40002 27.5984 2.40002ZM4.39844 27.6V4.40002H27.5984V27.6H4.39844Z'
        />
        <path
          fillRule='evenodd'
          clipRule='evenodd'
          d='M22.7617 9.81547C22.4699 7.68456 20.9078 5.92849 18.8047 5.367C17.4268 4.99502 15.9596 5.17988 14.7277 5.88065L10.354 8.3658C7.82287 9.83927 6.97859 13.0595 8.46105 15.5859C9.13008 16.726 10.1605 17.5331 11.3253 17.945C9.60012 19.5949 9.17124 22.2554 10.4361 24.4109C11.9185 26.9373 15.1751 27.8282 17.7378 26.4084L22.1125 23.9235C23.9926 22.8569 25.0286 20.7714 24.7367 18.6405C24.4641 16.6498 23.0829 14.9863 21.1877 14.3182C22.3881 13.1708 22.9934 11.5074 22.7617 9.81547ZM13.0931 16.2679C12.5099 16.2698 11.9253 16.1207 11.4017 15.8209C10.3681 15.2289 9.72885 14.1395 9.72468 12.9629C9.72051 11.7864 10.3521 10.7014 11.3814 10.1167L15.7552 7.63155C16.7845 7.04687 18.0553 7.05132 19.0889 7.64322C20.1224 8.23513 20.7617 9.32456 20.7659 10.5011C20.77 11.6777 20.1385 12.7627 19.1091 13.3474L18.8814 13.4768C18.3557 13.648 17.9758 14.1421 17.9758 14.725C17.9758 15.4498 18.5634 16.0375 19.2883 16.0375C19.3554 16.0375 19.4214 16.0324 19.4859 16.0227C20.0312 16.0392 20.5742 16.1878 21.0639 16.4682C22.0974 17.0601 22.7367 18.1496 22.7409 19.3261C22.745 20.5027 22.1135 21.5877 21.0841 22.1724L16.7104 24.6575C15.681 25.2422 14.4102 25.2378 13.3767 24.6459C12.3431 24.0539 11.7039 22.9645 11.6997 21.7879C11.6955 20.6114 12.3271 19.5264 13.3564 18.9417L13.5119 18.8533C14.0929 18.7181 14.5258 18.1971 14.5258 17.575C14.5258 16.8501 13.9382 16.2625 13.2133 16.2625C13.1728 16.2643 13.1327 16.2643 13.0931 16.2679Z'
        />
      </g>
    </svg>
  );
};
