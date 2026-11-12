// The only bridge between the window and the engine. The page itself has no
// access to files, Node or the network.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cloak', {
  call: (name, args) => ipcRenderer.invoke('cloak', name, args),
  onProgress: (fn) => ipcRenderer.on('progress', (event, p) => fn(p)),
});
