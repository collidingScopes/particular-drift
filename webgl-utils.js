class WebGLUtils {
  static createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error('Shader compile error:', gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
      }
      
      return shader;
  }

  static createProgram(gl, vertexShader, fragmentShader, transformFeedbackVaryings = null) {
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      if (fragmentShader) {
          gl.attachShader(program, fragmentShader);
      }
      
      if (transformFeedbackVaryings) {
          gl.transformFeedbackVaryings(
              program,
              transformFeedbackVaryings,
              gl.SEPARATE_ATTRIBS
          );
      }
      
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error('Program link error:', gl.getProgramInfoLog(program));
          gl.deleteProgram(program);
          return null;
      }
      
      return program;
  }

  static createBuffer(gl, data, usage = gl.DYNAMIC_COPY) {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      return buffer;
  }

  static createEdgeProgram(gl) {
    const vertexShaderSource = `#version 300 es
        in vec2 aPosition;
        out vec2 vTexCoord;

        void main() {
            // Flip the y coordinate here for texture coordinates
            vTexCoord = vec2(aPosition.x * 0.5 + 0.5, 1.0 - (aPosition.y * 0.5 + 0.5));
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `;

    // Use the edge detection shader from HTML
    const fragmentShaderSource = document.getElementById('edgeFragmentShader').textContent;

    const vertShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertShader || !fragShader) {
        throw new Error('Failed to create edge detection shaders');
    }
    
    const program = this.createProgram(gl, vertShader, fragShader);
    if (!program) {
        throw new Error('Failed to create edge detection program');
    }
    
    return program;
  }

  static getShaderSource(id) {
      const element = document.getElementById(id);
      if (!element) {
          throw new Error(`Shader source not found for ID: ${id}`);
      }
      return element.textContent;
  }
}