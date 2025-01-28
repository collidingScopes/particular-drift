class ResourceManager {
  constructor(gl) {
      this.gl = gl;
      this.resources = new Map();
      this.shaders = new Map();
      this.programs = new Map();
  }

  async loadShader(name, type) {
      try {
          const response = await fetch(`shaders/${name}`);
          if (!response.ok) {
              throw new Error(`Failed to load shader: ${name}`);
          }
          const source = await response.text();
          const shader = WebGLUtils.createShader(this.gl, type, source);
          if (!shader) {
              throw new Error(`Failed to compile shader: ${name}`);
          }
          this.shaders.set(name, shader);
          return shader;
      } catch (error) {
          console.error(`Error loading shader: ${name}`, error);
          throw error;
      }
  }

  async createProgram(name, vertexShaderName, fragmentShaderName, transformFeedbackVaryings = null) {
      try {
          const vertexShader = await this.loadShader(`${vertexShaderName}.vert`, this.gl.VERTEX_SHADER);
          const fragmentShader = await this.loadShader(`${fragmentShaderName}.frag`, this.gl.FRAGMENT_SHADER);
          
          const program = WebGLUtils.createProgram(
              this.gl, 
              vertexShader, 
              fragmentShader, 
              transformFeedbackVaryings
          );
          
          if (!program) {
              throw new Error(`Failed to create program: ${name}`);
          }
          
          this.programs.set(name, program);
          return program;
      } catch (error) {
          console.error(`Error creating program: ${name}`, error);
          throw error;
      }
  }

  createBuffer(data, usage = this.gl.DYNAMIC_COPY) {
      const buffer = WebGLUtils.createBuffer(this.gl, data, usage);
      this.resources.set(buffer, { type: 'buffer', data, usage });
      return buffer;
  }

  createTexture(options = {}) {
      const texture = WebGLUtils.createAndSetupTexture(this.gl, options);
      this.resources.set(texture, { type: 'texture', ...options });
      return texture;
  }

  createFramebuffer() {
      const framebuffer = this.gl.createFramebuffer();
      this.resources.set(framebuffer, { type: 'framebuffer' });
      return framebuffer;
  }

  deleteResource(resource) {
      const resourceInfo = this.resources.get(resource);
      if (!resourceInfo) return;

      const gl = this.gl;
      switch (resourceInfo.type) {
          case 'texture':
              gl.deleteTexture(resource);
              break;
          case 'buffer':
              gl.deleteBuffer(resource);
              break;
          case 'framebuffer':
              gl.deleteFramebuffer(resource);
              break;
      }

      this.resources.delete(resource);
  }

  dispose() {
      const gl = this.gl;

      // Delete all resources
      this.resources.forEach((info, resource) => {
          this.deleteResource(resource);
      });
      
      // Delete all shaders
      this.shaders.forEach(shader => {
          gl.deleteShader(shader);
      });
      this.shaders.clear();
      
      // Delete all programs
      this.programs.forEach(program => {
          gl.deleteProgram(program);
      });
      this.programs.clear();
  }

  // Utility methods
  getProgram(name) {
      return this.programs.get(name);
  }

  hasProgram(name) {
      return this.programs.has(name);
  }

  getShader(name) {
      return this.shaders.get(name);
  }

  hasShader(name) {
      return this.shaders.has(name);
  }
}