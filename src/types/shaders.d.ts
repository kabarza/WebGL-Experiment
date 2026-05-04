declare module '*.wgsl' {
  const shader: string;
  export default shader;
}

declare module '*.glsl' {
  const shader: string;
  export default shader;
}

declare module '*.vert' {
  const shader: string;
  export default shader;
}

declare module '*.frag' {
  const shader: string;
  export default shader;
}

// Vite ?raw imports — used by generateExport.ts to inline the
// pre-built ESM bundle as a string at React-app build time.
declare module '*?raw' {
  const content: string;
  export default content;
}
