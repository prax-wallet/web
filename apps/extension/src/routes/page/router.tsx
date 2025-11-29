import { createHashRouter, Outlet, RouteObject } from 'react-router-dom';
import { PageIndex, pageIndexLoader } from '.';
import { Onboarding } from './onboarding';
import { onboardingRoutes } from './onboarding/routes';
import { PagePath } from './paths';

export const pageRoutes: RouteObject[] = [
  {
    element: <Outlet />,
    children: [
      {
        path: PagePath.INDEX,
        element: <PageIndex />,
        loader: pageIndexLoader,
      },
      {
        path: PagePath.WELCOME,
        element: <Onboarding />,
        children: onboardingRoutes,
      },
    ],
  },
];

export const pageRouter = createHashRouter(pageRoutes, {
  future: {
    v7_relativeSplatPath: true,
  } as { v7_relativeSplatPath: boolean },
});
