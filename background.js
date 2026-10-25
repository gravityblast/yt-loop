// Clicking the toolbar icon opens the side panel instead of a popup.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error(err));

// Runs in the page (world: MAIN) to clear the loop started by the panel.
function stopLoop() {
  if (window.__ytLoop) clearInterval(window.__ytLoop.intervalId);
  window.__ytLoop = null;
}

// The panel holds a port open while it's visible. When the panel closes the
// port disconnects, and we stop any loop it left running.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panel') return;
  port.onDisconnect.addListener(async () => {
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    for (const tab of tabs) {
      chrome.scripting
        .executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: stopLoop })
        .catch(() => {});
    }
  });
});
