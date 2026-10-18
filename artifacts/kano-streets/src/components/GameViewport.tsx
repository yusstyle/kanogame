import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { GameEngine } from "../game/GameEngine";
import type { GameScreen, GameSnapshot } from "../game/types";

export type GameViewportHandle = {
  requestPointerLock: () => void;
  reset: () => void;
  setControlKey: (key: string, pressed: boolean) => void;
};

type GameViewportProps = {
  screen: GameScreen;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onPause: () => void;
};

const GameViewport = forwardRef<GameViewportHandle, GameViewportProps>(
  function GameViewport({ screen, onSnapshot, onPause }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const callbacksRef = useRef({ onSnapshot, onPause });
    const screenRef = useRef(screen);
    const [gameReady, setGameReady] = useState(false);
    const [webglUnavailable, setWebglUnavailable] = useState(false);

    callbacksRef.current = { onSnapshot, onPause };
    screenRef.current = screen;

    useImperativeHandle(
      ref,
      () => ({
        requestPointerLock: () => engineRef.current?.requestPointerLock(),
        reset: () => engineRef.current?.reset(),
        setControlKey: (key, pressed) => engineRef.current?.setControlKey(key, pressed),
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
