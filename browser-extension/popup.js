const toggle = document.getElementById('toggle');

chrome.storage.sync.get(['wuhlaEnabled'], ({ wuhlaEnabled }) => {
  toggle.checked = wuhlaEnabled !== false;
});

toggle.addEventListener('change', () => {
  chrome.storage.sync.set({ wuhlaEnabled: toggle.checked });
});
