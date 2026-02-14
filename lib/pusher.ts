import Pusher from 'pusher-js';

let pusher: Pusher | null = null;

export const getPusher = () => {
  if (!pusher && typeof window !== 'undefined') {
    pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return pusher;
};

export const subscribeToChannel = (channelName: string) => {
  const pusherClient = getPusher();
  if (pusherClient) {
    return pusherClient.subscribe(channelName);
  }
  return null;
};
