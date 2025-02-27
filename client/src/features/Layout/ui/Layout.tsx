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
      <Link to='/'>Home</Link>
    </div>
  );
};
