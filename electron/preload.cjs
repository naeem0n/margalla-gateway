const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("margallaDesktop", {
  isDesktop: true,
  apiBase: "http://localhost:3847/api",
});

contextBridge.exposeInMainWorld("electronAPI", {
  onNavigate: (callback) => {
    ipcRenderer.on("navigate", callback);
    return () => {
      ipcRenderer.off("navigate", callback);
    };
  },
  getApartments: async () => {
    try {
      const res = await fetch("http://localhost:3847/api/thirdparty/apartments");
      if (!res.ok) throw new Error("Failed to fetch thirdparty apartments");
      return await res.json();
    } catch (err) {
      console.error("Failed to get apartments via IPC:", err);
      return [];
    }
  }
});
