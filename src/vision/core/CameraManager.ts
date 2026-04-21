export type CameraErrorCode =
  | 'denied'
  | 'in-use'
  | 'not-found'
  | 'unavailable'
  | 'unsupported'
  | 'unknown';

export class CameraError extends Error {
  readonly code: CameraErrorCode;
  constructor(code: CameraErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'CameraError';
  }
}

function classify(err: unknown): CameraError {
  if (!(err instanceof Error)) return new CameraError('unknown', String(err));
  switch (err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraError('denied', 'Camera permission was denied');
    case 'NotReadableError':
    case 'TrackStartError':
      return new CameraError('in-use', 'Camera is in use by another application');
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new CameraError('not-found', 'No camera found');
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return new CameraError('unavailable', 'Requested camera settings unavailable');
    default:
      return new CameraError('unknown', err.message || err.name);
  }
}

export interface CameraStartOptions {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
  deviceId?: string;
}

export class CameraManager {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private owned: boolean;

  constructor(video?: HTMLVideoElement) {
    if (video) {
      this.video = video;
      this.owned = false;
    } else {
      const el = document.createElement('video');
      el.autoplay = true;
      el.muted = true;
      el.playsInline = true;
      this.video = el;
      this.owned = true;
    }
  }

  get isActive(): boolean {
    return this.stream !== null;
  }

  async start(opts: CameraStartOptions = {}): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError('unsupported', 'getUserMedia is not supported in this browser');
    }
    if (this.stream) return this.stream;

    // Pre-flight: if Permissions API says "denied", short-circuit instead of
    // letting getUserMedia hang waiting for a prompt the browser won't show.
    if ('permissions' in navigator) {
      try {
        const status = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        console.log('[Camera] permission state:', status.state);
        if (status.state === 'denied') {
          throw new CameraError(
            'denied',
            'Camera is blocked for this site. Open Chrome site settings and set Camera to Ask/Allow, then reload.',
          );
        }
      } catch (err) {
        if (err instanceof CameraError) throw err;
        // Some browsers (Safari) don't support the 'camera' name; fall through.
      }
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        width: { ideal: opts.width ?? 1280 },
        height: { ideal: opts.height ?? 720 },
        facingMode: opts.facingMode ?? 'user',
        ...(opts.deviceId ? { deviceId: { exact: opts.deviceId } } : {}),
      },
    };

    console.log('[Camera] calling getUserMedia', constraints);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('[Camera] getUserMedia rejected', err);
      throw classify(err);
    }
    console.log('[Camera] got stream', stream.getVideoTracks()[0]?.label);

    this.stream = stream;
    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.playsInline = true;
    try {
      await this.video.play();
    } catch {
      // autoplay may reject before user gesture — caller will retry
    }
    return stream;
  }

  stop(): void {
    if (!this.stream) return;
    for (const track of this.stream.getTracks()) track.stop();
    this.stream = null;
    this.video.srcObject = null;
  }

  dispose(): void {
    this.stop();
    if (this.owned) this.video.remove();
  }

  async listCameras(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  }
}
