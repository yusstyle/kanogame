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

  const receiveSnapshot = useCallback((next: GameSnapshot) => {
    setSnapshot((current) => {
      if (
        current.mode === next.mode &&
        current.location === next.location &&
        current.speedKmh === next.speedKmh &&
        current.interactionPrompt === next.interactionPrompt &&
        current.statusMessage === next.statusMessage
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
        location={snapshot.location}
        speedKmh={snapshot.speedKmh}
        interactionPrompt={snapshot.interactionPrompt}
        statusMessage={snapshot.statusMessage}
        graphicsQuality={graphicsQuality}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onReset={reset}
        onControlKey={setControlKey}
        onQualityChange={setGraphicsQuality}
      />
    </main>
  );
}

export default App;
