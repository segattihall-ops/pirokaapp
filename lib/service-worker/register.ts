// Service Worker registration and lifecycle management

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('Service Worker registered:', registration);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW ready, notify app
          window.dispatchEvent(
            new CustomEvent('sw-update-ready', { detail: { registration } })
          );
        }
      });
    });

    // Check for updates periodically
    setInterval(() => {
      registration.update().catch((err) => {
        console.error('Error checking SW updates:', err);
      });
    }, 60000); // Every minute

    return registration;
  } catch (err) {
    console.error('Service Worker registration failed:', err);
    return null;
  }
}

export async function handleSWUpdate(registration: ServiceWorkerRegistration): Promise<void> {
  const newWorker = registration.waiting;
  if (!newWorker) return;

  newWorker.postMessage({ type: 'SKIP_WAITING' });

  // Reload when new worker activates
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    await registration.unregister();
  }
}
