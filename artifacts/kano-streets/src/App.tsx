import { useCallback, useRef, useState } from "react";
import GameUI from "./components/GameUI";
import GameViewport, { type GameViewportHandle } from "./components/GameViewport";
import type { GameScreen, GameSnapshot } from "./game/types";

const INITIAL_SNAPSHOT: GameSnapshot = {
  mode: "on-foot",
  speedKmh: 0,
  interactionPrompt: null,
  statusMessage: null,
};

function App() {
  const viewportRef = useRef<GameViewportHandle>(null);
  const [screen, setScreen] = useState<GameScreen>("menu");
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);

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

  const receiveSnapshot = useCallback((next: GameSnapshot) => {
    setSnapshot((current) => {
      if (
        current.mode === next.mode &&
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
        onSnapshot={receiveSnapshot}
        onPause={pause}
      />
      <GameUI
        screen={screen}
        mode={snapshot.mode}
        speedKmh={snapshot.speedKmh}
        interactionPrompt={snapshot.interactionPrompt}
        statusMessage={snapshot.statusMessage}
        onStart={start}
        onResume={resume}
        onReset={reset}
      />
    </main>
  );
}

export default App;
