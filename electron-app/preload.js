const { contextBridge, ipcRenderer } = require('electron');

console.log("Preload script running!"); // Debug Proof

contextBridge.exposeInMainWorld('kasabaNative', {
    listPorts: () => ipcRenderer.invoke('scale-list-ports'),
    connectToScale: (path) => ipcRenderer.invoke('scale-connect', path),
    sendToScale: (data) => ipcRenderer.invoke('scale-send-data', data),
    testConnection: () => ipcRenderer.invoke('scale-test-connection'),
    onScaleError: (callback) => ipcRenderer.on('scale-error', (event, error) => callback(error))
});
