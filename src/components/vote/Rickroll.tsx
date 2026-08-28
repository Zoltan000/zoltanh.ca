import { useEffect, useRef, useState } from "react";

/**
 * Full-screen takeover, fired from the admin panel.
 *
 * The whole difficulty is iOS: Safari refuses a programmatic play() that
 * doesn't originate from a tap, and our trigger arrives on a 4s poll. The
 * workaround is to "arm" the element during an earlier real tap (sign-in) by
 * playing it muted for an instant — after that, Safari treats later play()
 * calls on the SAME element as permitted. Hence one persistent <video> that
 * is never unmounted, only resized from 1px to full-screen.
 *
 * Anything that still refuses gets a tap-to-play card, which is a gesture and
 * therefore always allowed.
 */

export const RICK_SRC = "/rickroll.mp4";

/** Arm the element from inside a real user gesture. Safe to call repeatedly. */
export function armRickroll(video: HTMLVideoElement | null): void {
  if (!video) return;
  video.muted = true;
  const p = video.play();
  if (p && typeof p.then === "function") {
    p.then(() => {
      video.pause();
      video.currentTime = 0;
    }).catch(() => {
      /* not armed — the tap-to-play card will cover it */
    });
  }
}

/**
 * Arm on the FIRST interaction anywhere on the page, whatever it is.
 *
 * Arming only at sign-in missed the common case: someone already identified
 * from a previous visit opens the page, taps nothing in particular, and is
 * never armed. A capture-phase listener on the document catches every route
 * into the app — a tap, a key, a scroll-then-tap — and removes itself once
 * it has fired. Returns a cleanup function.
 */
export function armOnFirstGesture(getVideo: () => HTMLVideoElement | null): () => void {
  const events: (keyof DocumentEventMap)[] = ["pointerdown", "touchstart", "keydown"];
  const onGesture = () => {
    armRickroll(getVideo());
    for (const e of events) document.removeEventListener(e, onGesture, true);
  };
  for (const e of events) document.addEventListener(e, onGesture, true);
  return () => {
    for (const e of events) document.removeEventListener(e, onGesture, true);
  };
}

export default function Rickroll({
  videoRef,
  active,
  onDismiss,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  active: boolean;
  onDismiss: () => void;
}) {
  const [needsTap, setNeedsTap] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!active) {
      started.current = false;
      setNeedsTap(false);
      return;
    }
    if (started.current) return;
    started.current = true;

    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    v.volume = 1;
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.catch(() => setNeedsTap(true));
    }
  }, [active, videoRef]);

  // Escape also gets you out, for anyone on a laptop.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onDismiss]);

  function tapPlay() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    v.play().catch(() => {});
    setNeedsTap(false);
  }

  if (!active) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        // Transparent, and inert: the <video> sits just beneath at z-index 99
        // and supplies the black. Only the controls below take pointer events.
        background: "transparent",
        pointerEvents: "none",
      }}
    >
      {needsTap && (
        <button
          onClick={tapPlay}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            border: 0,
            cursor: "pointer",
            pointerEvents: "auto",
            background: "var(--color-accent-900)",
            color: "var(--color-bg)",
            fontFamily: "var(--font-heading)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-4)",
            padding: "var(--space-4)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              opacity: 0.7,
            }}
          >
            A message from your host
          </span>
          <span style={{ fontSize: 34, fontWeight: 600 }}>Tap to play</span>
        </button>
      )}

      {!needsTap && (
        <>
          {/* The whole screen dismisses. Nobody should have to hunt for an X
              while their phone blares at a party. */}
          <button
            onClick={onDismiss}
            aria-label="Stop and close"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              pointerEvents: "auto",
              border: 0,
              background: "transparent",
              cursor: "pointer",
            }}
          />
          <button
            onClick={onDismiss}
            aria-label="Stop and close"
            style={{
              position: "absolute",
              top: "max(14px, env(safe-area-inset-top))",
              right: 14,
              zIndex: 3,
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 52,
              padding: "0 20px",
              borderRadius: 26,
              border: "1px solid rgba(255,255,255,0.5)",
              background: "rgba(0,0,0,0.65)",
              color: "#fff",
              fontFamily: "var(--font-heading)",
              fontSize: 17,
              fontWeight: 600,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 21 }}>×</span> Close
          </button>
          <span
            style={{
              position: "absolute",
              bottom: "max(24px, env(safe-area-inset-bottom))",
              left: 0,
              right: 0,
              textAlign: "center",
              color: "rgba(255,255,255,0.75)",
              fontSize: 14,
              pointerEvents: "none",
            }}
          >
            tap anywhere to stop
          </span>
        </>
      )}
    </div>
  );
}
