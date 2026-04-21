import type { Landmark } from './types';

export interface FitScales {
  sx: number;
  sy: number;
}

export function coverFit(viewportAspect: number, videoAspect: number): FitScales {
  if (viewportAspect > videoAspect) {
    return { sx: 1, sy: videoAspect / viewportAspect };
  }
  return { sx: viewportAspect / videoAspect, sy: 1 };
}

export interface MapContext {
  viewportAspect: number;
  videoAspect: number;
  mirror: boolean;
}

export function landmarkToNDC(
  landmark: Pick<Landmark, 'x' | 'y'>,
  ctx: MapContext,
): [number, number] {
  const { sx, sy } = coverFit(ctx.viewportAspect, ctx.videoAspect);
  const xCentered = ctx.mirror ? 0.5 - landmark.x : landmark.x - 0.5;
  const yCentered = 0.5 - landmark.y;
  return [(xCentered * 2) / sx, (yCentered * 2) / sy];
}

export function landmarkToPlaneUV(
  landmark: Pick<Landmark, 'x' | 'y'>,
  ctx: MapContext,
): [number, number] {
  const [nx, ny] = landmarkToNDC(landmark, ctx);
  return [nx * 0.5 + 0.5, ny * 0.5 + 0.5];
}
