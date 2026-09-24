import { ROUTES } from '../constants/routes';

export const routesConfig = [
  {
    path: ROUTES.HOME,
    name: 'Home',
    isProtected: true,
  },
  {
    path: ROUTES.MONITORING,
    name: 'Monitoring Hub',
    isProtected: true,
  },
  {
    path: ROUTES.TABLE_LOGS,
    name: 'Table Logs',
    isProtected: true,
  },
  {
    path: ROUTES.TABLE_LOG_CONFIG,
    name: 'Table Log Config',
    isProtected: true,
    roles: ['admin'],
  },
  {
    path: ROUTES.ADMIN,
    name: 'Admin Console',
    isProtected: true,
    roles: ['admin'],
  },
];
