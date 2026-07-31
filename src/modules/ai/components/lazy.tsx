import { lazy, Suspense } from "react";
import type { AgentRunBridgeProps } from "./AgentRunBridge";

const AgentRunBridgeInner = lazy(() =>
  import("./AgentRunBridge").then((m) => ({ default: m.AgentRunBridge })),
);

const AiMiniWindowInner = lazy(() =>
  import("./AiMiniWindow").then((m) => ({ default: m.AiMiniWindow })),
);

const AiInputBarModule = () => import("./AiInputBar");

const AiInputBarInner = lazy(() =>
  AiInputBarModule().then((m) => ({ default: m.AiInputBar })),
);

const AiInputBarConnectInner = lazy(() =>
  AiInputBarModule().then((m) => ({ default: m.AiInputBarConnect })),
);

const AiSidebarHelperInner = lazy(() =>
  import("./AiSidebarHelper").then((m) => ({ default: m.AiSidebarHelper })),
);


export function AgentRunBridge(props: AgentRunBridgeProps) {
  return (
    <Suspense fallback={null}>
      <AgentRunBridgeInner {...props} />
    </Suspense>
  );
}

export function AiMiniWindow() {
  return (
    <Suspense fallback={null}>
      <AiMiniWindowInner />
    </Suspense>
  );
}

export function AiInputBar({
  openMiniOnSubmit,
}: {
  openMiniOnSubmit?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <AiInputBarInner openMiniOnSubmit={openMiniOnSubmit} />
    </Suspense>
  );
}

export function AiInputBarConnect({ onAdd }: { onAdd: () => void }) {
  return (
    <Suspense fallback={null}>
      <AiInputBarConnectInner onAdd={onAdd} />
    </Suspense>
  );
}

export function AiSidebarHelper({
  hasComposer,
  onConnectProvider,
}: {
  hasComposer: boolean;
  onConnectProvider: () => void;
}) {
  return (
    <Suspense fallback={null}>
      <AiSidebarHelperInner
        hasComposer={hasComposer}
        onConnectProvider={onConnectProvider}
      />
    </Suspense>
  );
}
