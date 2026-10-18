import { useEffect, useRef } from "react";
import type { GameMode } from "../game/types";

type TouchControlsProps = {
  mode: GameMode;
  onControlKey: (key: string, pressed: boolean) => void;
  onPause: () => void;
  onReset: () => void;
};

type TouchKeyButtonProps = {
  label: string;
  keyName: string;
  ariaLabel: string;
  className?: string;
  onControlKey: TouchControlsProps["onControlKey"];
};

function TouchKeyButton({
  label,
  keyName,
  ariaLabel,
  className = "",
  onControlKey,
}: TouchKeyButtonProps) {
  const pressed = useRef(false);
  const callback = useRef(onControlKey);
  callback.current = onControlKey;

  useEffect(
    () => () => {
      if (pressed.current) {
        pressed.current = false;
        callback.current(keyName, false);
      }
    },
    [keyName],
  );

  const release = () => {
    if (!pressed.current) return;
    pressed.current = false;
    callback.current(keyName, false);
  };

  return (
    <button
      className={`ks-touch-key ${className}`}
      type="button"
      aria-label={ariaLabel}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        if (pressed.current) return;
        pressed.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        callback.current(keyName, true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {label}
    </button>
  );
}

export default function TouchControls({
  mode,
  onControlKey,
  onPause,
  onReset,
}: TouchControlsProps) {
  return (
    <div className="ks-touch-controls" aria-label="Touch game controls">
      <div className="ks-touch-look-hint" aria-hidden="true">DRAG TO LOOK</div>
      <div className="ks-touch-pad" aria-label="Movement pad">
        <TouchKeyButton label="▲" keyName="w" ariaLabel="Move forward" className="ks-pad-up" onControlKey={onControlKey} />
        <TouchKeyButton label="◀" keyName="a" ariaLabel="Move left" className="ks-pad-left" onControlKey={onControlKey} />
        <TouchKeyButton label="▼" keyName="s" ariaLabel={mode === "driving" ? "Brake and reverse" : "Move backward"} className="ks-pad-down" onControlKey={onControlKey} />
        <TouchKeyButton label="▶" keyName="d" ariaLabel="Move right or steer" className="ks-pad-right" onControlKey={onControlKey} />
      </div>

      <div className="ks-touch-actions" aria-label="Actions">
        {mode === "on-foot" ? (
          <>
            <TouchKeyButton label="RUN" keyName="shift" ariaLabel="Run" className="ks-touch-action-secondary" onControlKey={onControlKey} />
            <TouchKeyButton label="JUMP" keyName=" " ariaLabel="Jump" className="ks-touch-action-primary" onControlKey={onControlKey} />
          </>
        ) : (
          <TouchKeyButton label="BRAKE" keyName=" " ariaLabel="Brake" className="ks-touch-action-primary" onControlKey={onControlKey} />
        )}
        <TouchKeyButton
          label={mode === "driving" ? "EXIT" : "USE"}
          keyName="e"
          ariaLabel={mode === "driving" ? "Exit car" : "Enter car"}
          className="ks-touch-action-interact"
          onControlKey={onControlKey}
        />
      </div>

      <div className="ks-touch-utility">
        <button className="ks-touch-utility-button" type="button" onClick={onReset} aria-label="Reset position">↺</button>
        <button className="ks-touch-utility-button" type="button" onClick={onPause} aria-label="Pause game">Ⅱ</button>
      </div>
    </div>
  );
}
