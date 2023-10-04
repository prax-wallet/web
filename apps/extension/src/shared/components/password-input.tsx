import { EyeClosedIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import { ReactElement, useMemo, useState } from 'react';
import { Input, InputProps } from 'ui';
import { cn } from 'ui/lib/utils';

interface Validation {
  checkFn: (txt: string) => boolean;
  type: 'warn' | 'error'; // corresponds to red or yellow
  issue: string;
}

interface PasswordInputProps {
  passwordValue: string;
  label: string | ReactElement;
  validations: Validation[];
  onChange: InputProps['onChange'];
}

export const PasswordInput = ({
  passwordValue,
  label,
  validations,
  onChange,
}: PasswordInputProps) => {
  const [reveal, setReveal] = useState(false);

  const validationResult = useMemo(() => {
    const results = validations.filter(v => v.checkFn(passwordValue));
    const error = results.find(v => v.type === 'error');
    return error ? error : results.find(v => v.type === 'warn');
  }, [validations, passwordValue]);

  return (
    <div className='flex flex-col items-center justify-center gap-2'>
      <div className='flex items-center gap-2 self-start'>
        <div className='text-base font-bold'>{label}</div>
        {validationResult ? (
          <div
            className={cn(
              'italic',
              validationResult.type === 'warn' ? 'text-yellow-300' : 'text-red-400',
            )}
          >
            {validationResult.issue}
          </div>
        ) : null}
      </div>
      <div className='relative w-full'>
        <div className='absolute inset-y-0 right-4 flex cursor-pointer items-center'>
          {reveal ? (
            <EyeOpenIcon onClick={() => setReveal(false)} />
          ) : (
            <EyeClosedIcon onClick={() => setReveal(true)} className='text-gray-500' />
          )}
        </div>
        <Input
          type={reveal ? 'text' : 'password'}
          variant={validationResult?.type ?? 'default'}
          value={passwordValue}
          onChange={onChange}
        />
      </div>
    </div>
  );
};