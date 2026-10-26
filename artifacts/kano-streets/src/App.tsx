import { useCallback, useRef, useState } from "react";
import GameUI from "./components/GameUI";
import GameViewport, { type GameViewportHandle } from "./components/GameViewport";
import type { CareerPathChoice, GameScreen, GameSnapshot, GraphicsQuality, PropertyId } from "./game/types";

const INITIAL_SNAPSHOT: GameSnapshot = {
  mode: "on-foot",
  location: "DALA · OLD KANO",
  speedKmh: 0,
  interactionPrompt: null,
  statusMessage: null,
  vehicleType: null,
};

function App() {
  const viewportRef = useRef<GameViewportHandle>(null);
  const [screen, setScreen] = useState<GameScreen>("menu");
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>("balanced");

  const start = useCallback(() => {
    setSnapshot(INITIAL_SNAPSHOT);
    setScreen("playing");
  }, []);

  const pause = useCallback(() => setScreen("paused"), []);

  const resume = useCallback(() => {
    viewportRef.current?.requestPointerLock();
    setScreen("playing");
  }, []);

  const reset = useCallback(() => {
    viewportRef.current?.reset();
    viewportRef.current?.requestPointerLock();
    setSnapshot(INITIAL_SNAPSHOT);
    setScreen("playing");
  }, []);

  const setControlKey = useCallback((key: string, pressed: boolean) => {
    viewportRef.current?.setControlKey(key, pressed);
  }, []);

  const setGPSTarget = useCallback((id: string | null) => {
    viewportRef.current?.setGPSTarget(id);
  }, []);

  const acceptMission = useCallback((id: string) => {
    return viewportRef.current?.acceptMission(id) ?? false;
  }, []);

  const cancelMission = useCallback(() => {
    return viewportRef.current?.cancelMission() ?? false;
  }, []);

  const examineIndenture = useCallback(() => {
    return viewportRef.current?.examineStoryIndenture() ?? false;
  }, []);

  const chooseInvestigation = useCallback((choice: "elders" | "bank") => {
    return viewportRef.current?.chooseStoryInvestigation(choice);
  }, []);

  const chooseCareer = useCallback((choice: CareerPathChoice) => {
    return viewportRef.current?.chooseStoryCareer(choice);
  }, []);

  const resolveChapter1 = useCallback(() => {
    return viewportRef.current?.resolveStoryChapter1();
  }, []);

  const cycleWeather = useCallback(() => {
    return viewportRef.current?.cycleWeather();
  }, []);

  const toggleAudioMute = useCallback(() => {
    return viewportRef.current?.toggleAudioMute();
  }, []);

  const openFurnitureShop = useCallback(() => {
    viewportRef.current?.openFurnitureShop();
  }, []);

  const closeFurnitureShop = useCallback(() => {
    viewportRef.current?.closeFurnitureShop();
  }, []);

  const purchaseFurniture = useCallback((catalogId: string) => {
    return viewportRef.current?.purchaseFurniture(catalogId) ?? { success: false, message: "Engine not ready" };
  }, []);

  const toggleFurnishingMode = useCallback(() => {
    return viewportRef.current?.toggleFurnishingMode() ?? { success: false, message: "Engine not ready" };
  }, []);

  const placeFurnitureItem = useCallback(
    (instanceId: string, room: string, floor: number, position: { x: number; y: number; z: number }, rotationY: number) => {
      return (
        viewportRef.current?.placeFurnitureItem(instanceId, room, floor, position, rotationY) ?? {
          success: false,
          message: "Engine not ready",
        }
      );
    },
    [],
  );

  const moveFurnitureItem = useCallback(
    (instanceId: string, position: { x: number; y: number; z: number }, rotationY: number) => {
      return (
        viewportRef.current?.moveFurnitureItem(instanceId, position, rotationY) ?? {
          success: false,
          message: "Engine not ready",
        }
      );
    },
    [],
  );

  const storeFurnitureItem = useCallback((instanceId: string) => {
    return viewportRef.current?.storeFurnitureItem(instanceId) ?? { success: false, message: "Engine not ready" };
  }, []);

  const rotateFurnitureItem = useCallback((instanceId: string, deltaYaw: number) => {
    return viewportRef.current?.rotateFurnitureItem(instanceId, deltaYaw) ?? { success: false, message: "Engine not ready" };
  }, []);

  const getUnplacedFurniture = useCallback(() => {
    return viewportRef.current?.getUnplacedFurniture() ?? [];
  }, []);

  const getPlacedFurniture = useCallback((propertyId?: PropertyId) => {
    return viewportRef.current?.getPlacedFurniture(propertyId) ?? [];
  }, []);

  const receiveSnapshot = useCallback((next: GameSnapshot) => {
    setSnapshot((current) => {
      if (
        current.mode === next.mode &&
        current.location === next.location &&
        current.speedKmh === next.speedKmh &&
        current.interactionPrompt === next.interactionPrompt &&
        current.statusMessage === next.statusMessage &&
        current.vehicleType === next.vehicleType &&
        current.cash === next.cash &&
        current.trafficFine === next.trafficFine &&
        current.hasApartmentRental === next.hasApartmentRental &&
        current.activeInterior === next.activeInterior &&
        current.timeString === next.timeString &&
        current.gameScore === next.gameScore &&
        current.featuredContact === next.featuredContact &&
        current.dailyIncome === next.dailyIncome &&
        current.dayCount === next.dayCount &&
        current.gpsTarget === next.gpsTarget &&
        current.activeMission === next.activeMission &&
        current.availableMissionsCount === next.availableMissionsCount &&
        current.playerCoords?.x === next.playerCoords?.x &&
        current.playerCoords?.z === next.playerCoords?.z &&
        current.playerHeading === next.playerHeading &&
        current.storyInfo?.stageName === next.storyInfo?.stageName &&
        current.storyInfo?.currentObjective === next.storyInfo?.currentObjective &&
        current.weatherPreset === next.weatherPreset &&
        current.weatherDisplayName === next.weatherDisplayName &&
        current.audioMuted === next.audioMuted &&
        current.isFurnishingMode === next.isFurnishingMode &&
        current.furnishingTargetName === next.furnishingTargetName &&
        current.unplacedFurnitureCount === next.unplacedFurnitureCount &&
        current.placedFurnitureCount === next.placedFurnitureCount &&
        current.isFurnitureShopOpen === next.isFurnitureShopOpen
      ) {
        return current;
      }
      return next;
    });
  }, []);

  return (
    <main className="ks-game-root">
      <GameViewport
        ref={viewportRef}
        screen={screen}
        graphicsQuality={graphicsQuality}
        onSnapshot={receiveSnapshot}
        onPause={pause}
      />
      <GameUI
        screen={screen}
        mode={snapshot.mode}
        vehicleType={snapshot.vehicleType}
        location={snapshot.location}
        speedKmh={snapshot.speedKmh}
        interactionPrompt={snapshot.interactionPrompt}
        statusMessage={snapshot.statusMessage}
        cash={snapshot.cash}
        trafficFine={snapshot.trafficFine}
        hasApartmentRental={snapshot.hasApartmentRental}
        activeInterior={snapshot.activeInterior}
        timeString={snapshot.timeString}
        gameScore={snapshot.gameScore}
        featuredContact={snapshot.featuredContact}
        ownedProperties={snapshot.ownedProperties}
        ownedBusinesses={snapshot.ownedBusinesses}
        dailyIncome={snapshot.dailyIncome}
        dayCount={snapshot.dayCount}
        gpsTarget={snapshot.gpsTarget}
        activeMission={snapshot.activeMission}
        availableMissionsCount={snapshot.availableMissionsCount}
        playerCoords={snapshot.playerCoords}
        playerHeading={snapshot.playerHeading}
        storyInfo={snapshot.storyInfo}
        weatherPreset={snapshot.weatherPreset}
        weatherDisplayName={snapshot.weatherDisplayName}
        audioMuted={snapshot.audioMuted}
        isFurnishingMode={snapshot.isFurnishingMode}
        furnishingTargetName={snapshot.furnishingTargetName}
        unplacedFurnitureCount={snapshot.unplacedFurnitureCount}
        placedFurnitureCount={snapshot.placedFurnitureCount}
        isFurnitureShopOpen={snapshot.isFurnitureShopOpen}
        graphicsQuality={graphicsQuality}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onReset={reset}
        onControlKey={setControlKey}
        onSetGPSTarget={setGPSTarget}
        onAcceptMission={acceptMission}
        onCancelMission={cancelMission}
        onExamineIndenture={examineIndenture}
        onChooseInvestigation={chooseInvestigation}
        onChooseCareer={chooseCareer}
        onResolveChapter1={resolveChapter1}
        onCycleWeather={cycleWeather}
        onToggleAudioMute={toggleAudioMute}
        onOpenFurnitureShop={openFurnitureShop}
        onCloseFurnitureShop={closeFurnitureShop}
        onPurchaseFurniture={purchaseFurniture}
        onToggleFurnishingMode={toggleFurnishingMode}
        onPlaceFurnitureItem={placeFurnitureItem}
        onMoveFurnitureItem={moveFurnitureItem}
        onStoreFurnitureItem={storeFurnitureItem}
        onRotateFurnitureItem={rotateFurnitureItem}
        getUnplacedFurniture={getUnplacedFurniture}
        getPlacedFurniture={getPlacedFurniture}
        onQualityChange={setGraphicsQuality}
      />
    </main>
  );
}

export default App;
