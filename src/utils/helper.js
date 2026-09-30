export const getHardwareFingerprint = () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  let debugInfo = "";

  if (gl) {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      debugInfo = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    }
  }

  const rawId = [screen.width, screen.height, screen.colorDepth, navigator.hardwareConcurrency || 1, navigator.deviceMemory || 0, debugInfo, navigator.platform].join("|");

  let hash = 0;
  for (let i = 0; i < rawId.length; i++) {
    const char = rawId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return "HW-" + Math.abs(hash).toString(16);
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};
