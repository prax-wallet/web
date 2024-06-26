export const DisplayOriginURL = ({ url: { protocol, hostname, port } }: { url: URL }) => (
  <span className='whitespace-nowrap font-mono'>
    <span className='inline-block tracking-[-0.11em] brightness-90 saturate-50'>
      {protocol.split(':')[0]}
      <span className='tracking-[-0.21em]'>{':/'}</span>
      {'/'}
    </span>
    <span className='tracking-tighter brightness-150 saturate-150'>{hostname}</span>
    {port ? (
      <>
        <span className='ml-[-0.05em] inline-block tracking-[-0.11em] brightness-90 saturate-50'>
          {':'}
        </span>
        <span className='tracking-tighter brightness-150 saturate-150'>{port}</span>
      </>
    ) : null}
  </span>
);
