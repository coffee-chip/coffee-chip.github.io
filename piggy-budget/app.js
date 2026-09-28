const dateElement = document.querySelector('#current-date');

if (dateElement) {
  const today = new Date();
  dateElement.dateTime = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  dateElement.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(today);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('Offline mode is unavailable:', error);
    });
  });
}
