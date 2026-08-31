export function CanvasFocusIcon({ focused }: { focused: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="3.5" />
      {focused ? (
        <>
          <path d="m5.5 18.5 5-5" />
          <path d="M5.5 13.5h5v5" />
          <path d="m18.5 5.5-5 5" />
          <path d="M18.5 10.5h-5v-5" />
        </>
      ) : (
        <>
          <path d="m5.5 18.5 13-13" />
          <path d="M13.5 5.5h5v5" />
          <path d="M5.5 13.5v5h5" />
        </>
      )}
    </svg>
  );
}
