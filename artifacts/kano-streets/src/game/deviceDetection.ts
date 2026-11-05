import type { GraphicsQuality } from "./types";

export interface DeviceCapability {
  isMobile: boolean;
  isTablet: boolean;
  isLowEnd: boolean;
  isIntegratedGpu: boolean;
  devicePixelRatio: number;
  recommendedQuality: GraphicsQuality;
  hardwareConcurrency: number;
  maxTouchPoints: number;
  gpuRenderer?: string;
}

let cachedCapability: DeviceCapability | null = null;

export function detectDeviceCapability(): DeviceCapability {
  if (cachedCapability) return cachedCapability;

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isMobile: false,
      isTablet: false,
      isLowEnd: false,
      isIntegratedGpu: false,
      devicePixelRatio: 1,
      recommendedQuality: "balanced",
      hardwareConcurrency: 4,
      maxTouchPoints: 0,
    };
  }

  const ua = navigator.userAgent || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA = /iPad|tablet/i.test(ua) || (maxTouchPoints > 1 && /Macintosh/i.test(ua)); // iPadOS
  const isSmallScreen = window.innerWidth <= 768;
  const isMobile = isMobileUA || (maxTouchPoints > 0 && isSmallScreen);
  const isTablet = isTabletUA || (maxTouchPoints > 0 && !isMobile && window.innerWidth <= 1024);

  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;

  // Detect GPU vendor / unmasked renderer if available
  let gpuRenderer = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
      }
    }
  } catch {}

  const isMaliOrAdrenoLow = /Mali-4|Mali-G3|Mali-G5|Adreno \(TM\) 3|Adreno \(TM\) 50/i.test(gpuRenderer);
  const isIntegratedGpu =
    /Intel|UHD|HD Graphics|Iris/i.test(gpuRenderer) ||
    (/ANGLE/i.test(gpuRenderer) && !/NVIDIA|GeForce|Radeon RX|RTX|Discrete/i.test(gpuRenderer));
  const isLowEnd = hardwareConcurrency <= 4 || deviceMemory <= 3 || isMaliOrAdrenoLow;

  let recommendedQuality: GraphicsQuality = "balanced";
  if (isMobile || isLowEnd) {
    recommendedQuality = "performance";
  } else if (!isTablet && !isIntegratedGpu && hardwareConcurrency >= 8 && deviceMemory >= 8) {
    recommendedQuality = "quality";
  } else {
    recommendedQuality = "balanced";
  }

  cachedCapability = {
    isMobile,
    isTablet,
    isLowEnd,
    isIntegratedGpu,
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    recommendedQuality,
    hardwareConcurrency,
    maxTouchPoints,
    gpuRenderer,
  };

  return cachedCapability;
}

export function getRecommendedGraphicsQuality(): GraphicsQuality {
  // Check if player has explicitly saved a quality preference
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("kano_streets_graphics_quality");
      if (saved && (saved === "performance" || saved === "balanced" || saved === "quality")) {
        return saved as GraphicsQuality;
      }
    }
  } catch {}

  return detectDeviceCapability().recommendedQuality;
}

export function saveGraphicsQualityPreference(quality: GraphicsQuality): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("kano_streets_graphics_quality", quality);
    }
  } catch {}
}
