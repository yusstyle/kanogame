import { useCallback, useRef, useState } from "react";
import GameUI from "./components/GameUI";
import GameViewport, { type GameViewportHandle } from "./components/GameViewport";
import type { GameScreen, GameSnapshot, GraphicsQuality } from "./game/types";

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
        current.availableMissionsCount === next.availableMissionsCount
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
        graphicsQuality={graphicsQuality}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onReset={reset}
        onControlKey={setControlKey}
        onSetGPSTarget={setGPSTarget}
        onAcceptMission={acceptMission}
        onCancelMission={cancelMission}
        onQualityChange={setGraphicsQuality}
      />
    </main>
  );
}

export default App;
