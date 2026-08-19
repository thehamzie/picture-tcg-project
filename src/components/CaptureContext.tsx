import { createContext, useContext, type ReactNode } from 'react';

// Whether the subtree is currently being rasterized by react-native-view-shot.
//
// `mixBlendMode` and `isolation` make a view render into its own compositing layer. That is
// exactly what the on-screen foil needs, and exactly what a view snapshot handles worst —
// `captureRef` either crashes or returns a black/blank frame when it walks a subtree with
// blend layers in it. So anything that opts into a blend mode checks this flag and falls back
// to a plain-alpha approximation while a capture is in flight.
//
// It also makes exports deterministic: the saved image no longer depends on whether the
// snapshot backend happened to support blending on that OS version.

const CaptureContext = createContext(false);

export function CaptureProvider({ capturing, children }: { capturing: boolean; children: ReactNode }) {
  return <CaptureContext.Provider value={capturing}>{children}</CaptureContext.Provider>;
}

export function useIsCapturing(): boolean {
  return useContext(CaptureContext);
}
