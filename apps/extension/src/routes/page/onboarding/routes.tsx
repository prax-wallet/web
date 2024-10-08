import { PagePath } from '../paths';
import { OnboardingStart } from './start';
import { GenerateSeedPhrase } from './generate';
import { ConfirmBackup } from './confirm-backup';
import { ImportSeedPhrase } from './import';
import { OnboardingSuccess } from './success';
import { SetPassword } from './set-password';
import { pageIndexLoader } from '..';
import { SetGrpcEndpoint } from './set-grpc-endpoint';
import { SetDefaultFrontendPage } from './default-frontend';
import { SetNumerairesPage } from './set-numeraire';
import { ImportWalletCreationHeight } from './height';

export const onboardingRoutes = [
  {
    path: PagePath.WELCOME,
    element: <OnboardingStart />,
  },
  {
    path: PagePath.GENERATE_SEED_PHRASE,
    element: <GenerateSeedPhrase />,
  },
  {
    path: PagePath.CONFIRM_BACKUP,
    element: <ConfirmBackup />,
  },
  {
    path: PagePath.IMPORT_SEED_PHRASE,
    element: <ImportSeedPhrase />,
  },
  {
    path: PagePath.IMPORT_WALLET_CREATION_HEIGHT,
    element: <ImportWalletCreationHeight />,
  },
  {
    path: PagePath.SET_PASSWORD,
    element: <SetPassword />,
  },
  {
    path: PagePath.SET_GRPC_ENDPOINT,
    element: <SetGrpcEndpoint />,
  },
  {
    path: PagePath.SET_DEFAULT_FRONTEND,
    element: <SetDefaultFrontendPage />,
  },
  {
    path: PagePath.SET_NUMERAIRES,
    element: <SetNumerairesPage />,
  },
  {
    path: PagePath.ONBOARDING_SUCCESS,
    element: <OnboardingSuccess />,
    loader: pageIndexLoader,
  },
];
