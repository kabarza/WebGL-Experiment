# Aurora Drift — Mint Lilac Prompt

Drop this into Webflow AI (or any code-gen tool) to get a React component that recreates the Aurora Drift shader locked to the **Mint Lilac** look — no controls, no presets, no DialKit.

---

## Prompt

Build a single React component called `AuroraDrift` that fills its parent and renders a full-screen WebGL fragment shader. No props, no controls, no UI — just the visual.

### Setup
- Plain `<canvas>` with WebGL1 context, full-bleed (`position:absolute; inset:0; width:100%; height:100%`).
- Resize via `ResizeObserver`; set `canvas.width/height` to `clientWidth * dpr` and `clientHeight * dpr` (cap dpr at 2). Update the `u_resolution` uniform.
- Vertex shader is a fullscreen triangle/quad passing `vUv` in `[0,1]`.
- `requestAnimationFrame` loop; `u_time` in seconds since mount.
- Track mouse on the canvas: store normalized `[0..1]` cursor in `u_mousePos` (default `0.5, 0.5`).
- Cleanup: cancel RAF, disconnect observer, delete GL resources on unmount.

### Fixed uniforms (Mint Lilac, Swell mouse mode)

```js
const U = {
  // Colors
  u_color1: [0.043, 0.078, 0.094],   // #0b1418
  u_color2: [0.137, 0.290, 0.267],   // #234a44
  u_color3: [0.722, 0.925, 0.831],   // #b8ecd4
  u_color4: [0.863, 0.776, 1.000],   // #dcc6ff
  u_bgColor: [0.016, 0.039, 0.047],  // #040a0c
  u_colorShift: 0.01,

  // Warp
  u_warpOn: 1, u_warpStrength: 1.6, u_warpScale: 0.5,
  u_warpOctaves: 3, u_seed: 0.25, u_seedSpeed: 0.06,

  // Blobs
  u_blobOn: 1, u_blobCount: 4, u_blobSize: 1.1, u_blobSpacing: 0.58,
  u_blendSoftness: 1.55, u_blobRotation: -0.2, u_autoRotation: 0.007,
  u_blobSpread: 5.0, u_blobOffsetX: -0.3, u_blobOffsetY: -0.1,
  u_tileSpacing: 5.0,

  // Transform
  u_zoom: 0.85, u_offsetX: -0.08, u_offsetY: -0.22,

  // Mouse — Swell
  u_mouseOn: 1, u_mouseMode: 1, u_mouseStr: 0.85, u_mouseRadius: 1.1,
  u_mouseWind: [0, 0],

  // Pulse (unused, keep zeroed)
  u_pulsePos: [0.5, 0.5], u_pulseStr: 0, u_pulseAge: 0,
  u_pulseSpeed: 1.6, u_pulseWidth: 0.12,

  // Grain
  u_grainOn: 1, u_grainAmount: 0.04, u_grainScale: 0.5, u_grainSpeed: 24.0,

  // Speed multiplier on u_time
  speed: 0.85,
};
```

Apply `speed` by feeding `u_time = elapsedSeconds * 0.85` into the shader.

### Fragment shader

Use this verbatim — it is the entire look:

```glsl
precision highp float;
varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_color1, u_color2, u_color3, u_color4, u_bgColor;
uniform float u_warpOn, u_warpStrength, u_warpScale, u_warpOctaves, u_seed, u_seedSpeed;
uniform float u_blobOn, u_blobSize, u_blobSpacing, u_blobRotation, u_blobSpread;
uniform float u_blobOffsetX, u_blobOffsetY, u_tileSpacing, u_blobCount, u_blendSoftness, u_autoRotation;
uniform float u_colorShift, u_zoom, u_offsetX, u_offsetY;
uniform float u_mouseOn; uniform vec2 u_mousePos, u_mouseWind;
uniform float u_mouseStr, u_mouseRadius, u_mouseMode;
uniform vec2 u_pulsePos; uniform float u_pulseStr, u_pulseAge, u_pulseSpeed, u_pulseWidth;
uniform float u_grainOn, u_grainAmount, u_grainScale, u_grainSpeed;

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
  vec3 i1=min(g,l.zxy); vec3 i2=max(g,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod(i,289.0);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p, int oct){ float v=0.0,a=0.55,f=1.0;
  for(int i=0;i<6;i++){ if(i>=oct) break; v+=a*snoise(p*f); f*=1.9; a*=0.48; } return v; }
float hash2s(vec2 p){ vec3 q=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));
  q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z)*2.0-1.0; }
float valNoise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  float a=hash2s(i),b=hash2s(i+vec2(1,0)),c=hash2s(i+vec2(0,1)),d=hash2s(i+vec2(1,1));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
vec2 rot2d(vec2 p, float a){ float c=cos(a),s=sin(a); return vec2(p.x*c-p.y*s,p.x*s+p.y*c); }
vec2 aspectCorrect(vec2 p, float ar){ p.x*=min(1.0,ar); p.y*=min(1.0,1.0/ar); return p; }

void main(){
  vec2 uv=vUv*2.0-1.0; vec2 pos=uv;
  float aspect=u_resolution.x/u_resolution.y;
  pos=aspectCorrect(pos,aspect); pos/=max(u_zoom,0.01);
  pos+=vec2(u_offsetX,u_offsetY);
  float t=u_time; float animSeed=u_seed+t*u_seedSpeed;

  float warpBoost=1.0;
  if(u_mouseOn>0.5 && u_mouseStr>0.0){
    vec2 sUV=aspectCorrect(uv,aspect);
    vec2 cur=aspectCorrect(u_mousePos*2.0-1.0,aspect);
    vec2 toCur=sUV-cur; float md=length(toCur);
    float sig2=max(u_mouseRadius*u_mouseRadius,0.04);
    float prox=exp(-md*md/sig2);
    int mode=int(u_mouseMode+0.5);
    if(mode==0){ pos+=u_mouseWind*u_mouseStr; }
    else if(mode==1){ warpBoost=1.0+prox*u_mouseStr*2.5; }
    else if(mode==2){ float g=1.0/(1.0+md*md*0.8); pos-=toCur*g*u_mouseStr*0.7; }
    else if(mode==3){ vec2 d=(u_mousePos-vec2(0.5))*2.0; d=aspectCorrect(d,aspect); pos+=d*u_mouseStr*0.6; }
    else { float s1=snoise(vec3(pos*u_warpScale*3.5+vec2(4.7,2.1),t*0.6));
           float s2=snoise(vec3(pos*u_warpScale*3.5+vec2(11.2,8.3),t*0.6+5.5));
           pos+=vec2(s1,s2)*prox*u_mouseStr*0.4; }
  }

  if(u_warpOn>0.5){
    int oct=int(u_warpOctaves);
    float d1=fbm(vec3(pos*u_warpScale+0.5,animSeed),oct);
    float d2=fbm(vec3(pos*u_warpScale+0.5+5.3,animSeed+1.7),oct);
    pos+=vec2(d1,d2)*u_warpStrength*warpBoost;
  }

  vec3 col=u_bgColor;
  if(u_blobOn>0.5){
    vec2 op=pos-vec2(u_blobOffsetX,u_blobOffsetY);
    float sp=u_tileSpacing; op=mod(op-sp,vec2(sp*2.0))-sp;
    float totalRot=u_blobRotation+u_autoRotation*t;
    op=rot2d(op,-totalRot);
    op/=max(u_blobSize,0.01); op*=vec2(1.0/max(u_blobSpread,0.01),1.0);
    float cs=u_blobSpacing; float half_=cs*(u_blobCount-1.0)*0.5;
    float bs=max(u_blendSoftness,0.01);
    float y0=half_, y1=half_-cs, y2=half_-cs*2.0, y3=half_-cs*3.0, y4=half_-cs*4.0, y5=half_-cs*5.0;
    col=mix(u_color1,col,smoothstep(0.0,bs,distance(op,vec2(0.0,y0))));
    if(u_blobCount>1.5) col=mix(u_color2,col,smoothstep(0.0,bs,distance(op,vec2(0.0,y1))));
    if(u_blobCount>2.5) col=mix(u_color3,col,smoothstep(0.0,bs,distance(op,vec2(0.0,y2))));
    if(u_blobCount>3.5) col=mix(u_color4,col,smoothstep(0.0,bs,distance(op,vec2(0.0,y3))));
    if(u_blobCount>4.5) col=mix(u_color1,col,smoothstep(0.0,bs,distance(op,vec2(0.0,y4))));
    if(u_blobCount>5.5) col=mix(u_color2,col,smoothstep(0.0,bs,distance(op,vec2(0.0,y5))));
  }

  if(abs(u_colorShift)>0.001){
    float a=u_colorShift*t; float c=cos(a),s=sin(a);
    col=mat3(
      0.299+0.701*c+0.168*s, 0.587-0.587*c+0.330*s, 0.114-0.114*c-0.497*s,
      0.299-0.299*c-0.328*s, 0.587+0.413*c+0.035*s, 0.114-0.114*c+0.292*s,
      0.299-0.300*c+1.250*s, 0.587-0.588*c-1.050*s, 0.114+0.886*c-0.203*s
    )*col;
  }

  if(u_grainOn>0.5){
    vec2 gp=uv*u_resolution/max(u_grainScale,0.01);
    float tStep=floor(t*max(u_grainSpeed,0.0));
    gp+=vec2(tStep*13.17,tStep*7.91);
    col+=valNoise(gp)*u_grainAmount;
  }

  gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
}
```

### Acceptance
- Renders an animated mint/lilac aurora with subtle film grain.
- Hovering the cursor makes the aurora "breathe harder" near it (Swell, no displacement).
- Resizes cleanly with the parent. No layout shift, no controls.
