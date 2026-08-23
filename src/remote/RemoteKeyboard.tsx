import { useCallback, useEffect, useRef, useState } from "react";

type RemoteKeyboardProps = {
  onKey: (value: string) => void;
};

const KEY_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
] as const;

const BACKSPACE_REPEAT_DELAY_MS = 350;
const BACKSPACE_REPEAT_INTERVAL_MS = 60;

export function RemoteKeyboard({ onKey }: RemoteKeyboardProps) {
  const [shift, setShift] = useState(false);
  const [control, setControl] = useState(false);
  const backspaceRepeatTimeoutRef = useRef<number | null>(null);
  const backspaceRepeatIntervalRef = useRef<number | null>(null);

  const stopBackspaceRepeat = useCallback(() => {
    if (backspaceRepeatTimeoutRef.current !== null) {
      window.clearTimeout(backspaceRepeatTimeoutRef.current);
      backspaceRepeatTimeoutRef.current = null;
    }
    if (backspaceRepeatIntervalRef.current !== null) {
      window.clearInterval(backspaceRepeatIntervalRef.current);
      backspaceRepeatIntervalRef.current = null;
    }
  }, []);

  const startBackspaceRepeat = useCallback(() => {
    stopBackspaceRepeat();
    backspaceRepeatTimeoutRef.current = window.setTimeout(() => {
      backspaceRepeatIntervalRef.current = window.setInterval(
        () => onKey("\u007f"),
        BACKSPACE_REPEAT_INTERVAL_MS,
      );
    }, BACKSPACE_REPEAT_DELAY_MS);
  }, [onKey, stopBackspaceRepeat]);

  useEffect(() => stopBackspaceRepeat, [stopBackspaceRepeat]);

  const send = (key: string) => {
    let value = shift ? key.toUpperCase() : key;
    if (control && /^[a-z]$/i.test(value)) value = String.fromCharCode(value.toUpperCase().charCodeAt(0) - 64);
    onKey(value);
    setShift(false);
    setControl(false);
  };

  return (
    <section className="remote-keyboard" aria-label="Terminal keyboard">
      {KEY_ROWS.map((row, index) => (
        <div className="remote-keyboard-row" key={index}>
          {row.map((key) => (
            <KeyButton key={key} label={shift ? key.toUpperCase() : key} onPress={() => send(key)} />
          ))}
        </div>
      ))}
      <div className="remote-keyboard-row">
        <KeyButton label="shift" active={shift} onPress={() => setShift((value) => !value)} />
        <KeyButton label="ctrl" active={control} onPress={() => setControl((value) => !value)} />
        <KeyButton label="tab" onPress={() => onKey("\t")} />
        <KeyButton label="space" wide onPress={() => onKey(" ")} />
        <KeyButton label="←" onPress={() => onKey("\u001b[D")} />
        <KeyButton label="↓" onPress={() => onKey("\u001b[B")} />
        <KeyButton label="↑" onPress={() => onKey("\u001b[A")} />
        <KeyButton label="→" onPress={() => onKey("\u001b[C")} />
        <KeyButton
          label="⌫"
          onPress={() => onKey("\u007f")}
          onHoldStart={startBackspaceRepeat}
          onHoldEnd={stopBackspaceRepeat}
        />
        <KeyButton label="↵" onPress={() => onKey("\r")} />
      </div>
    </section>
  );
}

function KeyButton({
  label,
  onPress,
  onHoldStart,
  onHoldEnd,
  active = false,
  wide = false,
}: {
  label: string;
  onPress: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  active?: boolean;
  wide?: boolean;
}) {
  const touchActiveRef = useRef(false);

  const triggerTouch = (event: React.TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    touchActiveRef.current = true;
    onPress();
    onHoldStart?.();
  };

  const releaseTouch = (event: React.TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onHoldEnd?.();
  };

  const triggerMouse = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (touchActiveRef.current) {
      touchActiveRef.current = false;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onPress();
    onHoldStart?.();
  };

  const releaseMouse = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onHoldEnd?.();
  };

  const triggerKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onPress();
  };

  return (
    <button
      type="button"
      className="remote-keyboard-key"
      data-active={active || undefined}
      data-wide={wide || undefined}
      onTouchStart={triggerTouch}
      onTouchEnd={releaseTouch}
      onTouchCancel={releaseTouch}
      onMouseDown={triggerMouse}
      onMouseUp={releaseMouse}
      onMouseLeave={releaseMouse}
      onKeyDown={triggerKeyboard}
    >
      {label}
    </button>
  );
}
