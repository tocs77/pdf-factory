import { Outlet, Link } from 'react-router';
import classes from './Layout.module.scss';

export const Layout = () => {
  return (
    <div className={classes.Layout}>
      <Header />
      <div className={classes.content}>
        <Outlet />
      </div>
    </div>
  );
};

const Header = () => {
  return (
    <div className={classes.header}>
      <Link to='/' className={classes.homeLink}>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'>
          <path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'></path>
          <polyline points='9 22 9 12 15 12 15 22'></polyline>
        </svg>
        <span>Home</span>
      </Link>
    </div>
  );
};
