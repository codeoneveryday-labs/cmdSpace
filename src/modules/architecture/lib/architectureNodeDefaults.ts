import type { ShapeKind } from "./architectureCanvasTypes";

export function defaultTechnology(kind: ShapeKind): string {
  switch (kind) {
    case "actor":
      return "Person / client";
    case "external":
      return "External system";
    case "service":
      return "Service";
    case "api":
      return "HTTP / RPC";
    case "worker":
      return "Async worker";
    case "function":
      return "Serverless";
    case "ai":
      return "LLM / model";
    case "editor":
      return "CodeMirror";
    case "database":
      return "SQL / NoSQL";
    case "cache":
      return "Redis / memory";
    case "queue":
      return "Queue / stream";
    case "storage":
      return "Blob storage";
    case "gateway":
      return "Ingress";
    case "security":
      return "Auth / policy";
    case "boundary":
      return "Boundary";
    case "rectangle":
    case "circle":
    case "frame":
    case "text":
    case "image":
      return "";
    case "terminal":
      return "Shell";
    case "line":
    case "arrow":
    case "pen":
      return "";
  }
}
