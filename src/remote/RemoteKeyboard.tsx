import { useRef, useState } from "react";

type RemoteKeyboardProps = {
  onKey: (value: string) => void;
};

const KEY_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
] as const;

export function RemoteKeyboard({ onKey }: RemoteKeyboardProps) {
  const [shift, setShift] = useState(false);
  const [control, setControl] = useState(false);

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
        <KeyButton label="⌫" onPress={() => onKey("\u007f")} />
        <KeyButton label="↵" onPress={() => onKey("\r")} />
      </div>
    </section>
  );
}

function KeyButton({
  label,
  onPress,
  active = false,
  wide = false,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  wide?: boolean;
}) {
  const touchActiveRef = useRef(false);

  const triggerTouch = (event: React.TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    touchActiveRef.current = true;
    onPress();
  };

  const releaseTouch = (event: React.TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const triggerMouse = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (touchActiveRef.current) {
      touchActiveRef.current = false;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onPress();
  };

  const releaseMouse = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
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
