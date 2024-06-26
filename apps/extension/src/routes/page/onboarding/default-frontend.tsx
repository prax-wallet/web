import { Card, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { FadeTransition } from '@repo/ui/components/ui/fade-transition';
import { usePageNav } from '../../../utils/navigate';
import { PagePath } from '../paths';
import { DefaultFrontendForm } from '../../../shared/components/default-frontend-form';
import { FormEventHandler } from 'react';

export const SetDefaultFrontendPage = () => {
  const navigate = usePageNav();

  const onSubmit: FormEventHandler = (event): void => {
    event.preventDefault();
    navigate(PagePath.SET_NUMERAIRES);
  };

  return (
    <FadeTransition>
      <Card className='w-[400px]' gradient>
        <CardHeader>
          <CardTitle>Select your preferred frontend app</CardTitle>
        </CardHeader>

        <CardDescription>
          Prax has a shortcut for your portfolio page. You can always change this later
        </CardDescription>

        <form className='mt-6' onSubmit={onSubmit}>
          <DefaultFrontendForm isOnboarding />
        </form>
      </Card>
    </FadeTransition>
  );
};
