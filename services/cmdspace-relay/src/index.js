import { DesktopRelay } from "./desktop-relay.js";
import { validateRelayRequest } from "./relay-state.js";

export { DesktopRelay };

export default {
  async fetch(request, env) {
    const route = validateRelayRequest(request);
    if (!route) {
      return new Response("Expected WebSocket relay request", { status: 426 });
    }
    return env.DESKTOP_RELAY.getByName(route.relayId).fetch(request);
  },
};
