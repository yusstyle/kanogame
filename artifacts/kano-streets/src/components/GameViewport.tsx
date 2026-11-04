import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { GameEngine } from "../game/GameEngine";
import type { CareerPathChoice, GameScreen, GameSnapshot, GraphicsQuality, FurnitureInstance, PropertyId, PlayerHomeEntry, BusinessId, CurrencyType, CameraMode } from "../game/types";
import type { CityId, TravelMethod } from "../game/cityRegistry";

export type GameViewportHandle = {
  requestPointerLock: () => void;
  reset: () => void;
  setControlKey: (key: string, pressed: boolean) => void;
  setGPSTarget: (id: string | null) => void;
  acceptMission: (id: string) => boolean;
  cancelMission: () => boolean;
  examineStoryIndenture: () => boolean;
  chooseStoryInvestigation: (choice: "elders" | "bank") => unknown;
  chooseStoryCareer: (choice: CareerPathChoice) => unknown;
  resolveStoryChapter1: () => unknown;
  cycleWeather: () => unknown;
  toggleAudioMute: () => unknown;
  openFurnitureShop: () => void;
  closeFurnitureShop: () => void;
  purchaseFurniture: (catalogId: string) => { success: boolean; message: string };
  toggleFurnishingMode: () => { success: boolean; message: string };
  placeFurnitureItem: (
    instanceId: string,
    room: string,
    floor: number,
    position: { x: number; y: number; z: number },
    rotationY: number,
  ) => { success: boolean; message: string };
  moveFurnitureItem: (
    instanceId: string,
    position: { x: number; y: number; z: number },
    rotationY: number,
  ) => { success: boolean; message: string };
  storeFurnitureItem: (instanceId: string) => { success: boolean; message: string };
  rotateFurnitureItem: (instanceId: string, deltaYaw: number) => { success: boolean; message: string };
  getUnplacedFurniture: () => FurnitureInstance[];
  getPlacedFurniture: (propertyId?: PropertyId) => FurnitureInstance[];
  setSelectedHome: (propertyId: PropertyId) => { success: boolean; message: string };
  teleportHome: (destination?: "entrance" | "interior") => { success: boolean; message: string };
  findMyHome: () => { success: boolean; message: string };
  leaseProperty: (propertyId?: PropertyId) => { success: boolean; message: string };
  purchaseProperty: (propertyId: PropertyId) => { success: boolean; message: string };
  getPlayerHomes: () => PlayerHomeEntry[];
  executeFreelanceContract: (contractId?: string) => { success: boolean; message: string };
  toggleCameraMode: () => CameraMode | undefined;
  setCameraMode: (mode: CameraMode) => void;
  toggleSmartphone: (force?: boolean) => boolean | undefined;
  captureScreenshot: () => string | null;
  interactSocial: (contactId: string, choiceId: string) => any;
  toggleEmpireModal: (force?: boolean) => boolean | undefined;
  upgradeBusiness: (id: BusinessId) => { success: boolean; cost?: number; newLevel?: number; message: string };
  maintainBusiness: (id: BusinessId) => { success: boolean; cost?: number; message: string; newCondition?: number };
  renovateProperty: (id: PropertyId, useCoins?: boolean) => { success: boolean; costCash: number; costCoins: number; newLevel: number; message: string };
  purchaseVehicle: (vehicleId: string, currency?: CurrencyType) => { success: boolean; message: string; costCash?: number; costCoins?: number };
  purchaseVehicleSkin: (skinId: string, vehicleId: string, currency?: CurrencyType) => { success: boolean; message: string; costCash?: number; costCoins?: number };
  claimAchievement: (achievementId: string) => { success: boolean; rewardCash: number; rewardCoins: number; message: string };
  claimSeasonalChallenge: (challengeId: string) => { success: boolean; rewardCash: number; rewardCoins: number; message: string };
  claimSeasonalMilestone: () => { success: boolean; rewardCoins: number; rewardTitle?: string; message: string };
  dismissOnboarding: () => void;
  travelToCity: (targetCity: CityId, method?: TravelMethod) => Promise<boolean>;
  getCurrentCity: () => CityId;
};

const LOADING_TIPS = [
  "Rest at your Sabon Gari compound to restore stamina and preserve your empire progress.",
  "Press C to toggle between Third-Person, Cinematic, and Dash Cam views.",
  "Look out for keke napep and danfo minibuses along the commercial avenues.",
  "High heat index slows stamina recovery. Hydrate or seek shade under neem trees.",
  "Visit the local bazaar to buy and place authentic Sahelian furniture in your compounds.",
  "Complete delivery and freelance contracts across Fagge and Sabon Gari to build your empire.",
];

type GameViewportProps = {
  screen: GameScreen;
  graphicsQuality: GraphicsQuality;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onPause: () => void;
};

const GameViewport = forwardRef<GameViewportHandle, GameViewportProps>(
  function GameViewport({ screen, graphicsQuality, onSnapshot, onPause }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const callbacksRef = useRef({ onSnapshot, onPause });
    const screenRef = useRef(screen);
    const qualityRef = useRef(graphicsQuality);
    const [gameReady, setGameReady] = useState(false);
    const [webglUnavailable, setWebglUnavailable] = useState(false);
    const [loadingStage, setLoadingStage] = useState({ progress: 15, stage: "INITIALIZING 3D ENGINE" });
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
      if (gameReady) return;
      const interval = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
      }, 3500);
      return () => clearInterval(interval);
    }, [gameReady]);

    callbacksRef.current = { onSnapshot, onPause };
    screenRef.current = screen;
    qualityRef.current = graphicsQuality;

    useImperativeHandle(
      ref,
      () => ({
        requestPointerLock: () => engineRef.current?.requestPointerLock(),
        reset: () => engineRef.current?.reset(),
        setControlKey: (key, pressed) => engineRef.current?.setControlKey(key, pressed),
        setGPSTarget: (id) => engineRef.current?.setGPSTarget(id),
        acceptMission: (id) => engineRef.current?.acceptMission(id) ?? false,
        cancelMission: () => engineRef.current?.cancelMission() ?? false,
        examineStoryIndenture: () => engineRef.current?.examineStoryIndenture() ?? false,
        chooseStoryInvestigation: (choice) => engineRef.current?.chooseStoryInvestigation(choice),
        chooseStoryCareer: (choice) => engineRef.current?.chooseStoryCareer(choice),
        resolveStoryChapter1: () => engineRef.current?.resolveStoryChapter1(),
        cycleWeather: () => engineRef.current?.cycleWeather(),
        toggleAudioMute: () => engineRef.current?.toggleAudioMute(),
        openFurnitureShop: () => engineRef.current?.openFurnitureShop(),
        closeFurnitureShop: () => engineRef.current?.closeFurnitureShop(),
        purchaseFurniture: (catalogId) => engineRef.current?.purchaseFurniture(catalogId) ?? { success: false, message: "Engine not ready" },
        toggleFurnishingMode: () => engineRef.current?.toggleFurnishingMode() ?? { success: false, message: "Engine not ready" },
        placeFurnitureItem: (instId, rm, fl, pos, rot) =>
          engineRef.current?.placeFurnitureItem(instId, rm, fl, pos, rot) ?? { success: false, message: "Engine not ready" },
        moveFurnitureItem: (instId, pos, rot) =>
          engineRef.current?.moveFurnitureItem(instId, pos, rot) ?? { success: false, message: "Engine not ready" },
        storeFurnitureItem: (instId) =>
          engineRef.current?.storeFurnitureItem(instId) ?? { success: false, message: "Engine not ready" },
        rotateFurnitureItem: (instId, delta) =>
          engineRef.current?.rotateFurnitureItem(instId, delta) ?? { success: false, message: "Engine not ready" },
        getUnplacedFurniture: () => engineRef.current?.getUnplacedFurniture() ?? [],
        getPlacedFurniture: (propId) => engineRef.current?.getPlacedFurniture(propId) ?? [],
        setSelectedHome: (propId) => engineRef.current?.setSelectedHome(propId) ?? { success: false, message: "Engine not ready" },
        teleportHome: (dest) => engineRef.current?.teleportHome(dest) ?? { success: false, message: "Engine not ready" },
        findMyHome: () => engineRef.current?.findMyHome() ?? { success: false, message: "Engine not ready" },
        leaseProperty: (propId) => engineRef.current?.leaseProperty(propId) ?? { success: false, message: "Engine not ready" },
        purchaseProperty: (propId) => engineRef.current?.purchaseProperty(propId) ?? { success: false, message: "Engine not ready" },
        getPlayerHomes: () => engineRef.current?.getPlayerHomes() ?? [],
        executeFreelanceContract: (contractId) => engineRef.current?.executeFreelanceContract(contractId) ?? { success: false, message: "Engine not ready" },
        toggleCameraMode: () => engineRef.current?.toggleCameraMode(),
        setCameraMode: (mode) => engineRef.current?.setCameraMode(mode),
        toggleSmartphone: (force) => engineRef.current?.toggleSmartphone(force),
        captureScreenshot: () => engineRef.current?.captureScreenshot() ?? null,
        interactSocial: (contactId, choiceId) => engineRef.current?.interactSocial(contactId, choiceId) ?? null,
        toggleEmpireModal: (force) => engineRef.current?.toggleEmpireModal(force),
        upgradeBusiness: (id) => engineRef.current?.upgradeBusiness(id) ?? { success: false, message: "Engine not ready" },
        maintainBusiness: (id) => engineRef.current?.maintainBusiness(id) ?? { success: false, cost: 0, message: "Engine not ready", newCondition: 0 },
        renovateProperty: (id, useCoins) => engineRef.current?.renovateProperty(id, useCoins) ?? { success: false, costCash: 0, costCoins: 0, newLevel: 0, message: "Engine not ready" },
        purchaseVehicle: (vehId, curr) => engineRef.current?.purchaseVehicle(vehId, curr) ?? { success: false, message: "Engine not ready" },
        purchaseVehicleSkin: (sId, vId, curr) => engineRef.current?.purchaseVehicleSkin(sId, vId, curr) ?? { success: false, message: "Engine not ready" },
        claimAchievement: (achId) => engineRef.current?.claimAchievement(achId) ?? { success: false, rewardCash: 0, rewardCoins: 0, message: "Engine not ready" },
        claimSeasonalChallenge: (cId) => engineRef.current?.claimSeasonalChallenge(cId) ?? { success: false, rewardCash: 0, rewardCoins: 0, message: "Engine not ready" },
        claimSeasonalMilestone: () => engineRef.current?.claimSeasonalMilestone() ?? { success: false, rewardCoins: 0, message: "Engine not ready" },
        dismissOnboarding: () => engineRef.current?.dismissOnboarding(),
        travelToCity: (city, method) => engineRef.current?.travelToCity(city, method) ?? Promise.resolve(false),
        getCurrentCity: () => engineRef.current?.getCurrentCity() ?? "kano",
      }),
      [],
    );

    const gameRequested = screen !== "menu";
    useEffect(() => {
      if (!gameRequested) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      let cancelled = false;
      let localEngine: GameEngine | null = null;
      const handleBlur = () => {
        localEngine?.clearControls();
        if (document.pointerLockElement === canvas) document.exitPointerLock();
      };
      window.addEventListener("blur", handleBlur);

      const initialize = async () => {
        try {
          setLoadingStage({ progress: 20, stage: "INITIALIZING 3D ENGINE" });
          const { GameEngine } = await import("../game/GameEngine");
          if (cancelled) return;
          setLoadingStage({ progress: 50, stage: "STREAMING KANO DISTRICTS" });
          await new Promise((r) => setTimeout(r, 60));
          if (cancelled) return;
          const engine = new GameEngine(canvas, {
            onSnapshot: (snapshot) => callbacksRef.current.onSnapshot(snapshot),
            onPause: () => callbacksRef.current.onPause(),
          });
          localEngine = engine;
          engineRef.current = engine;
          (window as any).__kanoEngine = engine;
          setLoadingStage({ progress: 85, stage: "SPAWNING TRAFFIC AND CITIZENS" });
          await new Promise((r) => setTimeout(r, 40));
          if (cancelled) return;
          engine.setGraphicsQuality(qualityRef.current);
          engine.setScreen(screenRef.current);
          setLoadingStage({ progress: 100, stage: "ENTERING KANO STREETS" });
          await new Promise((r) => setTimeout(r, 60));
          if (cancelled) return;
          setGameReady(true);
        } catch (error) {
          if (cancelled) return;
          console.error("The browser could not initialize the game's WebGL renderer.", error);
          setWebglUnavailable(true);
        }
      };
      void initialize();

      return () => {
        cancelled = true;
        window.removeEventListener("blur", handleBlur);
        localEngine?.dispose();
        delete (window as any).__kanoEngine;
        if (engineRef.current === localEngine) engineRef.current = null;
      };
    }, [gameRequested]);

    useEffect(() => {
      engineRef.current?.setScreen(screen);
    }, [screen]);

    useEffect(() => {
      engineRef.current?.setGraphicsQuality(graphicsQuality);
    }, [graphicsQuality]);

    if (webglUnavailable) {
      return (
        <section className="ks-webgl-fallback" role="alert">
          <div className="ks-webgl-fallback-card">
            <p className="ks-webgl-kicker">KANO STREETS · 3D PROTOTYPE</p>
            <h1>WebGL is unavailable</h1>
            <p>
              This browser did not provide a WebGL 2 graphics context, so the 3D
              neighborhood cannot start. Enable hardware acceleration or try a
              current desktop browser with WebGL enabled.
            </p>
            <button onClick={() => window.location.reload()}>Try again</button>
          </div>
        </section>
      );
    }

    return (
      <>
        <canvas
          ref={canvasRef}
          className="ks-game-canvas"
          aria-label="Kano Streets interactive 3D neighborhood"
          role="img"
        />
        {gameRequested && !webglUnavailable && !gameReady && (
          <div className="ks-loading-overlay" aria-live="polite">
            <div className="ks-loading-card">
              <div className="ks-loading-badge">KANO STREETS · 3D WORLD</div>
              <h2 className="ks-loading-title">{loadingStage.stage}</h2>
              <div className="ks-loading-bar-track">
                <div
                  className="ks-loading-bar-fill"
                  style={{ width: `${loadingStage.progress}%` }}
                />
              </div>
              <div className="ks-loading-footer">
                <span className="ks-loading-percent">{loadingStage.progress}%</span>
                <span className="ks-loading-tip">{LOADING_TIPS[tipIndex]}</span>
              </div>
            </div>
          </div>
        )}
      </>
    );
  },
);

export default GameViewport;
