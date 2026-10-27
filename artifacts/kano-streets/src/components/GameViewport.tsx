import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { GameEngine } from "../game/GameEngine";
import type { CareerPathChoice, GameScreen, GameSnapshot, GraphicsQuality, FurnitureInstance, PropertyId, PlayerHomeEntry, BusinessId, CurrencyType } from "../game/types";

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
  toggleCameraMode: () => "third-person" | "first-person" | undefined;
  setCameraMode: (mode: "third-person" | "first-person") => void;
  toggleEmpireModal: (force?: boolean) => boolean | undefined;
  upgradeBusiness: (id: BusinessId) => { success: boolean; cost?: number; newLevel?: number; message: string };
  renovateProperty: (id: PropertyId, useCoins?: boolean) => { success: boolean; costCash: number; costCoins: number; newLevel: number; message: string };
  purchaseVehicle: (vehicleId: string, currency?: CurrencyType) => { success: boolean; message: string; costCash?: number; costCoins?: number };
  purchaseVehicleSkin: (skinId: string, vehicleId: string, currency?: CurrencyType) => { success: boolean; message: string; costCash?: number; costCoins?: number };
  claimAchievement: (achievementId: string) => { success: boolean; rewardCash: number; rewardCoins: number; message: string };
  claimSeasonalChallenge: (challengeId: string) => { success: boolean; rewardCash: number; rewardCoins: number; message: string };
  claimSeasonalMilestone: () => { success: boolean; rewardCoins: number; rewardTitle?: string; message: string };
};

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
        toggleEmpireModal: (force) => engineRef.current?.toggleEmpireModal(force),
        upgradeBusiness: (id) => engineRef.current?.upgradeBusiness(id) ?? { success: false, message: "Engine not ready" },
        renovateProperty: (id, useCoins) => engineRef.current?.renovateProperty(id, useCoins) ?? { success: false, costCash: 0, costCoins: 0, newLevel: 0, message: "Engine not ready" },
        purchaseVehicle: (vehId, curr) => engineRef.current?.purchaseVehicle(vehId, curr) ?? { success: false, message: "Engine not ready" },
        purchaseVehicleSkin: (sId, vId, curr) => engineRef.current?.purchaseVehicleSkin(sId, vId, curr) ?? { success: false, message: "Engine not ready" },
        claimAchievement: (achId) => engineRef.current?.claimAchievement(achId) ?? { success: false, rewardCash: 0, rewardCoins: 0, message: "Engine not ready" },
        claimSeasonalChallenge: (cId) => engineRef.current?.claimSeasonalChallenge(cId) ?? { success: false, rewardCash: 0, rewardCoins: 0, message: "Engine not ready" },
        claimSeasonalMilestone: () => engineRef.current?.claimSeasonalMilestone() ?? { success: false, rewardCoins: 0, message: "Engine not ready" },
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
          const { GameEngine } = await import("../game/GameEngine");
          if (cancelled) return;
          const engine = new GameEngine(canvas, {
            onSnapshot: (snapshot) => callbacksRef.current.onSnapshot(snapshot),
            onPause: () => callbacksRef.current.onPause(),
          });
          localEngine = engine;
          engineRef.current = engine;
          engine.setGraphicsQuality(qualityRef.current);
          engine.setScreen(screenRef.current);
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
          <div className="ks-game-loading" aria-live="polite">Loading the neighborhood…</div>
        )}
      </>
    );
  },
);

export default GameViewport;
