import './GameUI.css';
import TouchControls from './TouchControls';

export type Screen = 'menu' | 'playing' | 'paused';
export type Mode = 'on-foot' | 'driving';

export interface GameUIProps {
  screen: Screen;
  mode: Mode;
  speedKmh: number;
  interactionPrompt: string | null;
  statusMessage: string | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onControlKey: (key: string, pressed: boolean) => void;
}

function BrandMark() {
  return (
    <span className="ks-brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Key({ children }: { children: string }) {
  return <kbd className="ks-key">{children}</kbd>;
}

export default function GameUI({
  screen,
  mode,
  speedKmh,
  interactionPrompt,
  statusMessage,
  onStart,
  onPause,
  onResume,
  onReset,
  onControlKey,
}: GameUIProps) {
  if (screen === 'menu') {
    return (
      <div className="ks-ui ks-menu">
        <div className="ks-menu-top">
          <div className="ks-brand">
            <BrandMark />
            <span>KANO / FIELD NOTES</span>
          </div>
          <span className="ks-build-tag"><i /> OPEN WORLD PROTOTYPE</span>
        </div>

        <main className="ks-menu-content">
          <div className="ks-edition">A SMALL PLACE, WIDE OPEN</div>
          <h1>Kano<br /><em>Streets</em></h1>
          <p className="ks-menu-intro">
            Take the long way home. Walk the lanes, find a ride, and see what’s around the next corner.
          </p>
          <button className="ks-button ks-button-primary" onClick={onStart}>
            <span>Enter the neighborhood</span>
            <span className="ks-button-arrow" aria-hidden="true">↗</span>
          </button>
          <div className="ks-menu-controls">
            <div className="ks-control-line"><span className="ks-control-label">MOVE</span><span><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> <small>or arrows</small></span></div>
            <div className="ks-control-line"><span className="ks-control-label">LOOK</span><span><Key>MOUSE</Key></span></div>
            <div className="ks-control-line"><span className="ks-control-label">INTERACT</span><span><Key>E</Key></span></div>
            <div className="ks-control-line"><span className="ks-control-label">RUN</span><span><Key>SHIFT</Key></span></div>
            <div className="ks-control-line"><span className="ks-control-label">JUMP</span><span><Key>SPACE</Key></span></div>
            <div className="ks-control-line"><span className="ks-control-label">RESET</span><span><Key>R</Key></span></div>
          </div>
          <p className="ks-touch-menu-hint">Touch controls are available on phones.</p>
        </main>

        <div className="ks-menu-aside" aria-hidden="true">
          <div className="ks-aside-crosshair"><span /><span /></div>
          <div className="ks-aside-caption"><span>12° 00′ N</span><span>THE CITY, AT YOUR PACE</span></div>
        </div>
        <footer className="ks-menu-footer">
          <span>AN ORIGINAL NEIGHBORHOOD, INSPIRED BY KANO</span>
          <span className="ks-prototype-note">World, car &amp; character are original procedural prototype geometry — not photorealistic scans or purchased models.</span>
        </footer>
      </div>
    );
  }

  return (
    <div className={`ks-ui ks-gameplay ${screen === 'paused' ? 'is-paused' : ''}`}>
      {screen === 'playing' && (
        <>
          <TouchControls
            mode={mode}
            onControlKey={onControlKey}
            onPause={onPause}
            onReset={onReset}
          />
          <header className="ks-hud-header">
            <div className="ks-hud-brand"><BrandMark /><span>KANO <i>/</i> STREETS</span></div>
            <div className="ks-hud-location"><span className="ks-live-dot" /> NEIGHBORHOOD <span className="ks-location-divider">/</span> FREE ROAM</div>
            <span className="ks-pause-hint"><Key>ESC</Key><span>PAUSE</span></span>
          </header>

          <div className="ks-mode-chip" aria-live="polite">
            <span className={`ks-mode-symbol ${mode}`} aria-hidden="true">{mode === 'driving' ? 'D' : '·'}</span>
            <span className="ks-mode-copy"><small>YOU ARE</small><strong>{mode === 'driving' ? 'DRIVING' : 'ON FOOT'}</strong></span>
            {mode === 'driving' && (
              <span className="ks-speed"><strong>{Math.max(0, Math.round(speedKmh))}</strong><small>KM/H</small></span>
            )}
          </div>

          <div className="ks-hud-bottom">
            <div className="ks-driving-hint">
              <span className="ks-hint-title">{mode === 'driving' ? 'DRIVE' : 'ON FOOT'}</span>
              <span><Key>W</Key> ACCELERATE</span>
              <span><Key>S</Key> {mode === 'driving' ? 'BRAKE / REVERSE' : 'BACK'}</span>
              <span><Key>A</Key><Key>D</Key> {mode === 'driving' ? 'STEER' : 'MOVE'}</span>
              {mode === 'on-foot' && <><span><Key>SHIFT</Key> RUN</span><span><Key>SPACE</Key> JUMP</span></>}
              {mode === 'driving' && <span><Key>SPACE</Key> BRAKE</span>}
              {mode === 'on-foot' && <span><Key>E</Key> INTERACT</span>}
              <span><Key>R</Key> RESET POSITION</span>
            </div>
            {interactionPrompt && (
              <div className="ks-interaction-prompt" role="status">
                <span className="ks-interaction-key"><Key>E</Key></span>
                <span>{interactionPrompt}</span>
              </div>
            )}
          </div>
          {statusMessage && <div className="ks-status-message" role="status">{statusMessage}</div>}
        </>
      )}

      {screen === 'paused' && (
        <div className="ks-pause-layer">
          <section className="ks-pause-panel" role="dialog" aria-modal="true" aria-labelledby="ks-pause-title">
            <div className="ks-edition">TAKE YOUR TIME</div>
            <h2 id="ks-pause-title">Paused<span>.</span></h2>
            <p>The neighborhood will be right where you left it.</p>
            <button className="ks-button ks-button-primary" onClick={onResume}>
              <span>Back to the streets</span><span className="ks-button-arrow" aria-hidden="true">↗</span>
            </button>
            <button className="ks-reset-button" onClick={onReset}>Start over <span aria-hidden="true">↺</span></button>
            <div className="ks-pause-foot"><BrandMark /><span>PROTOTYPE BUILD · KANO, NIGERIA</span></div>
          </section>
        </div>
      )}
    </div>
  );
}
