/**
 * GLState manages WebGL state to prevent redundant state changes
 * and provide a cleaner interface for WebGL operations.
 */
class GLState {
  constructor(gl) {
      this.gl = gl;
      
      // Track current state
      this.currentState = {
          program: null,
          vao: null,
          activeTexture: null,
          boundTextures: new Array(gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)).fill(null),
          blendEnabled: null,
          framebuffer: null,
          viewport: { x: 0, y: 0, width: 0, height: 0 },
          clearColor: [0, 0, 0, 0],
          depthTest: null,
          cullFace: null,
          frontFace: null
      };

      // Initialize WebGL state
      this.gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  /**
   * Set the current WebGL program
   */
  useProgram(program) {
      if (this.currentState.program !== program) {
          this.gl.useProgram(program);
          this.currentState.program = program;
          return true;
      }
      return false;
  }

  /**
   * Bind a Vertex Array Object
   */
  bindVAO(vao) {
      if (this.currentState.vao !== vao) {
          this.gl.bindVertexArray(vao);
          this.currentState.vao = vao;
          return true;
      }
      return false;
  }

  /**
   * Set the active texture unit
   */
  activeTexture(unit) {
      if (this.currentState.activeTexture !== unit) {
          this.gl.activeTexture(this.gl.TEXTURE0 + unit);
          this.currentState.activeTexture = unit;
          return true;
      }
      return false;
  }

  /**
   * Bind a texture to the current active texture unit
   */
  bindTexture(texture, unit = 0) {
      this.activeTexture(unit);
      if (this.currentState.boundTextures[unit] !== texture) {
          this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
          this.currentState.boundTextures[unit] = texture;
          return true;
      }
      return false;
  }

  /**
   * Enable/disable blending
   */
  setBlending(enable) {
      if (this.currentState.blendEnabled !== enable) {
          if (enable) {
              this.gl.enable(this.gl.BLEND);
          } else {
              this.gl.disable(this.gl.BLEND);
          }
          this.currentState.blendEnabled = enable;
          return true;
      }
      return false;
  }

  /**
   * Set blend function
   */
  setBlendFunc(src, dst) {
      this.gl.blendFunc(src, dst);
  }

  /**
   * Bind framebuffer
   */
  bindFramebuffer(framebuffer) {
      if (this.currentState.framebuffer !== framebuffer) {
          this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
          this.currentState.framebuffer = framebuffer;
          return true;
      }
      return false;
  }

  /**
   * Set viewport dimensions
   */
  setViewport(x, y, width, height) {
      const viewport = { x, y, width, height };
      if (JSON.stringify(this.currentState.viewport) !== JSON.stringify(viewport)) {
          this.gl.viewport(x, y, width, height);
          this.currentState.viewport = viewport;
          return true;
      }
      return false;
  }

  /**
   * Set clear color
   */
  setClearColor(r, g, b, a = 1.0) {
    const color = [r, g, b, a];
    if (JSON.stringify(this.currentState.clearColor) !== JSON.stringify(color)) {
        this.gl.clearColor(r, g, b, 1.0); // Force alpha to 1.0
        this.currentState.clearColor = color;
        return true;
    }
    return false;
  }

  /**
   * Enable/disable depth testing
   */
  setDepthTest(enable) {
      if (this.currentState.depthTest !== enable) {
          if (enable) {
              this.gl.enable(this.gl.DEPTH_TEST);
          } else {
              this.gl.disable(this.gl.DEPTH_TEST);
          }
          this.currentState.depthTest = enable;
          return true;
      }
      return false;
  }

  /**
   * Enable/disable face culling
   */
  setCullFace(enable) {
      if (this.currentState.cullFace !== enable) {
          if (enable) {
              this.gl.enable(this.gl.CULL_FACE);
          } else {
              this.gl.disable(this.gl.CULL_FACE);
          }
          this.currentState.cullFace = enable;
          return true;
      }
      return false;
  }

  /**
   * Set front face orientation
   */
  setFrontFace(mode) {
      if (this.currentState.frontFace !== mode) {
          this.gl.frontFace(mode);
          this.currentState.frontFace = mode;
          return true;
      }
      return false;
  }

  /**
   * Clear the current framebuffer
   */
  clear(mask = this.gl.COLOR_BUFFER_BIT) {
    // Ensure we're clearing with proper alpha
    const currentColor = this.currentState.clearColor;
    this.gl.clearColor(currentColor[0], currentColor[1], currentColor[2], 1.0);
    
    // Clear the buffer
    this.gl.clear(mask);
    
    // Reset viewport to ensure full coverage
    const viewport = this.currentState.viewport;
    this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
  }

  /**
   * Reset all tracked state
   */
  reset() {
      this.currentState = {
          program: null,
          vao: null,
          activeTexture: null,
          boundTextures: new Array(this.gl.getParameter(this.gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)).fill(null),
          blendEnabled: null,
          framebuffer: null,
          viewport: { x: 0, y: 0, width: 0, height: 0 },
          clearColor: [0, 0, 0, 0],
          depthTest: null,
          cullFace: null,
          frontFace: null
      };
  }

  /**
   * Create a snapshot of current state
   */
  saveState() {
      return { ...this.currentState };
  }

  /**
   * Restore state from a snapshot
   */
  restoreState(savedState) {
      if (savedState.program !== this.currentState.program) {
          this.useProgram(savedState.program);
      }
      if (savedState.vao !== this.currentState.vao) {
          this.bindVAO(savedState.vao);
      }
      if (savedState.blendEnabled !== this.currentState.blendEnabled) {
          this.setBlending(savedState.blendEnabled);
      }
      if (savedState.framebuffer !== this.currentState.framebuffer) {
          this.bindFramebuffer(savedState.framebuffer);
      }
      if (JSON.stringify(savedState.viewport) !== JSON.stringify(this.currentState.viewport)) {
          this.setViewport(savedState.viewport.x, savedState.viewport.y, 
                         savedState.viewport.width, savedState.viewport.height);
      }
  }
}