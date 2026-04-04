// ============================================================
// FullscreenQuadGL — WebGL2 fullscreen quad (triangle-strip)
// ============================================================

export class FullscreenQuadGL {
  private _gl: WebGL2RenderingContext | WebGLRenderingContext;
  private _buffer: WebGLBuffer;
  private _attrLocation = -1;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    this._gl = gl;
    const buf = gl.createBuffer();
    if (!buf) throw new Error('Failed to create vertex buffer');
    this._buffer = buf;

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
  }

  /** Bind to the a_pos attribute of the given program */
  bind(program: WebGLProgram): void {
    const gl = this._gl;
    this._attrLocation = gl.getAttribLocation(program, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.enableVertexAttribArray(this._attrLocation);
    gl.vertexAttribPointer(this._attrLocation, 2, gl.FLOAT, false, 0, 0);
  }

  draw(): void {
    this._gl.drawArrays(this._gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose(): void {
    this._gl.deleteBuffer(this._buffer);
  }
}
