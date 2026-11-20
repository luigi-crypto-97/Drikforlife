import { appStart } from './app.js';

globalThis.__gdmStarted = true;
appStart();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
