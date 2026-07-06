const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  cleanImages: (filePaths) => ipcRenderer.invoke('clean-images', filePaths),
  getPath: (file) => {
    if (typeof webUtils !== 'undefined' && webUtils.getPathForFile) {
      return webUtils.getPathForFile(file);
    }
    return file.path;
  }
});
