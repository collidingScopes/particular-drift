class ParticleSystem {
  constructor(gl, particleCount) {
      this.gl = gl;
      this.particleCount = particleCount;
      this.currentIndex = 0;
      
      // Create transform feedback objects
      this.transformFeedback = gl.createTransformFeedback();
      
      this.initShaders();
      this.initBuffers();
      this.setupEdgeDetection();
  }
  
  initShaders() {
      const gl = this.gl;
      
      // Create update vertex shader
      const updateVertShader = WebGLUtils.createShader(
          gl,
          gl.VERTEX_SHADER,
          WebGLUtils.getShaderSource('updateVertexShader')
      );

      // Create a minimal fragment shader for the update program
      const updateFragShader = WebGLUtils.createShader(
          gl,
          gl.FRAGMENT_SHADER,
          `#version 300 es
          precision highp float;
          out vec4 fragColor;
          void main() {
              fragColor = vec4(0.0);
          }`
      );
      
      // Create render shaders
      const renderVertShader = WebGLUtils.createShader(
          gl, 
          gl.VERTEX_SHADER, 
          WebGLUtils.getShaderSource('particleVertexShader')
      );
      const renderFragShader = WebGLUtils.createShader(
          gl, 
          gl.FRAGMENT_SHADER, 
          WebGLUtils.getShaderSource('particleFragmentShader')
      );
      
      if (!updateVertShader || !updateFragShader || !renderVertShader || !renderFragShader) {
          throw new Error('Failed to create shaders');
      }
      
      // Create update program with transform feedback
      this.updateProgram = WebGLUtils.createProgram(
          gl,
          updateVertShader,
          updateFragShader,
          ['vPosition', 'vVelocity', 'vTarget']
      );
      
      // Create render program
      this.renderProgram = WebGLUtils.createProgram(gl, renderVertShader, renderFragShader);
      
      if (!this.renderProgram || !this.updateProgram) {
          throw new Error('Failed to create shader programs');
      }

      // Create edge detection program
      this.edgeProgram = WebGLUtils.createEdgeProgram(gl);
      if (!this.edgeProgram) {
          throw new Error('Failed to create edge detection program');
      }

      // Store uniform locations
      this.uniforms = {
          update: {
              deltaTime: gl.getUniformLocation(this.updateProgram, 'deltaTime'),
              resolution: gl.getUniformLocation(this.updateProgram, 'resolution'),
              edgeTexture: gl.getUniformLocation(this.updateProgram, 'edgeTexture'),
              particleSpeed: gl.getUniformLocation(this.updateProgram, 'particleSpeed'),
              searchRadius: gl.getUniformLocation(this.updateProgram, 'searchRadius'),
              randomSpeed: gl.getUniformLocation(this.updateProgram, 'randomSpeed'),
              randomStrength: gl.getUniformLocation(this.updateProgram, 'randomStrength'),
              attractionStrength: gl.getUniformLocation(this.updateProgram, 'attractionStrength')
          },
          edge: {
              resolution: gl.getUniformLocation(this.edgeProgram, 'uResolution'),
              image: gl.getUniformLocation(this.edgeProgram, 'uImage'),
              threshold: gl.getUniformLocation(this.edgeProgram, 'threshold')
          },
          render: {
              particleColor: gl.getUniformLocation(this.renderProgram, 'uParticleColor'),
              particleOpacity: gl.getUniformLocation(this.renderProgram, 'uParticleOpacity')
          }
      };

      // Create VAO for edge detection quad
      this.edgeVAO = gl.createVertexArray();
      gl.bindVertexArray(this.edgeVAO);
  }
  
  setupEdgeDetection() {
      const gl = this.gl;

      // Create framebuffer for edge detection
      this.edgeFramebuffer = gl.createFramebuffer();
      
      // Create edge detection texture
      this.edgeTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.edgeTexture);
      gl.texImage2D(
          gl.TEXTURE_2D, 
          0, 
          gl.RGBA, 
          gl.canvas.width, 
          gl.canvas.height, 
          0, 
          gl.RGBA, 
          gl.UNSIGNED_BYTE, 
          null
      );
      
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      // Attach texture to framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeFramebuffer);
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER, 
          gl.COLOR_ATTACHMENT0, 
          gl.TEXTURE_2D, 
          this.edgeTexture, 
          0
      );

      // Check framebuffer status
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error('Framebuffer is not complete: ' + status);
      }
  }
  
  initBuffers() {
      const gl = this.gl;
      
      // Create particle data
      const positions = new Float32Array(this.particleCount * 2);
      const velocities = new Float32Array(this.particleCount * 2);
      const targets = new Float32Array(this.particleCount * 2);
      
      for (let i = 0; i < this.particleCount; i++) {
          const i2 = i * 2;
          // Position
          positions[i2] = Math.random();
          positions[i2 + 1] = Math.random();
          // Velocity
          velocities[i2] = (Math.random() - 0.5) * 0.001;
          velocities[i2 + 1] = (Math.random() - 0.5) * 0.001;
          // Target (initially no target)
          targets[i2] = -1;
          targets[i2 + 1] = -1;
      }
      
      // Create buffers for transform feedback ping-pong
      this.positionBuffers = [
          WebGLUtils.createBuffer(gl, positions),
          WebGLUtils.createBuffer(gl, positions)
      ];
      
      this.velocityBuffers = [
          WebGLUtils.createBuffer(gl, velocities),
          WebGLUtils.createBuffer(gl, velocities)
      ];
      
      this.targetBuffers = [
          WebGLUtils.createBuffer(gl, targets),
          WebGLUtils.createBuffer(gl, targets)
      ];
      
      // Create quad for edge detection
      this.quadBuffer = WebGLUtils.createBuffer(gl, new Float32Array([
          -1, -1,
          1, -1,
          -1, 1,
          -1, 1,
          1, -1,
          1, 1
      ]));

      // Set up edge detection VAO
      gl.bindVertexArray(this.edgeVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      const positionLoc = gl.getAttribLocation(this.edgeProgram, 'aPosition');
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
      
      // Create VAOs for particle rendering and updating
      this.vaos = [
          this.createVAO(
              this.positionBuffers[0],
              this.velocityBuffers[0],
              this.targetBuffers[0]
          ),
          this.createVAO(
              this.positionBuffers[1],
              this.velocityBuffers[1],
              this.targetBuffers[1]
          )
      ];
  }
  
  createVAO(positionBuffer, velocityBuffer, targetBuffer) {
      const gl = this.gl;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      
      // Position attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      
      // Velocity attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
      
      // Target attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, targetBuffer);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
      
      // Cleanup
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindVertexArray(null);
      
      return vao;
  }

  processImage(image) {
    const gl = this.gl;
    
    // Create and setup input texture
    const inputTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    // Upload image data
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    
    // Bind framebuffer and set viewport
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeFramebuffer);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    
    // Use edge detection program
    gl.useProgram(this.edgeProgram);
    
    // Set uniforms
    gl.uniform2f(
        this.uniforms.edge.resolution,
        gl.canvas.width,
        gl.canvas.height
    );
    gl.uniform1f(this.uniforms.edge.threshold, CONFIG.EDGE_THRESHOLD);
    
    // Bind input texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.uniform1i(this.uniforms.edge.image, 0);
    
    // Draw quad using edge VAO
    gl.bindVertexArray(this.edgeVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    // Cleanup
    gl.deleteTexture(inputTexture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    // Set edge texture for particle update shader
    gl.useProgram(this.updateProgram);
    gl.uniform1i(this.uniforms.update.edgeTexture, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.edgeTexture);
}

  update(deltaTime) {
    const gl = this.gl;
    
    gl.useProgram(this.updateProgram);
    
    // Set uniforms
    gl.uniform1f(this.uniforms.update.deltaTime, deltaTime * 0.001);
    gl.uniform2f(
        this.uniforms.update.resolution,
        gl.canvas.width,
        gl.canvas.height
    );
    
    // Set configurable uniforms
    gl.uniform1f(this.uniforms.update.particleSpeed, CONFIG.PARTICLE_SPEED);
    gl.uniform1f(this.uniforms.update.searchRadius, CONFIG.SEARCH_RADIUS);
    gl.uniform1f(this.uniforms.update.randomSpeed, CONFIG.PARTICLE_SPEED * 0.5);
    gl.uniform1f(this.uniforms.update.randomStrength, CONFIG.RANDOM_STRENGTH);
    gl.uniform1f(this.uniforms.update.attractionStrength, CONFIG.ATTRACTION_STRENGTH);

    // Bind VAO for input
    gl.bindVertexArray(this.vaos[this.currentIndex]);
    
    // Unbind any potentially bound buffers from GL_ARRAY_BUFFER target
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
    // Set up transform feedback
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedback);
    
    // Bind output buffers
    gl.bindBufferBase(
        gl.TRANSFORM_FEEDBACK_BUFFER,
        0,
        this.positionBuffers[1 - this.currentIndex]
    );
    gl.bindBufferBase(
        gl.TRANSFORM_FEEDBACK_BUFFER,
        1,
        this.velocityBuffers[1 - this.currentIndex]
    );
    gl.bindBufferBase(
        gl.TRANSFORM_FEEDBACK_BUFFER,
        2,
        this.targetBuffers[1 - this.currentIndex]
    );
    
    // Perform transform feedback
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.particleCount);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    
    // Cleanup
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, null);
    
    // Swap buffers
    this.currentIndex = 1 - this.currentIndex;
}

// Helper method to convert hex color to RGB
hexToRGB(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}

render() {
    const gl = this.gl;
    
    gl.useProgram(this.renderProgram);
    gl.bindVertexArray(this.vaos[this.currentIndex]);
    
    // Set color and opacity uniforms
    const rgb = this.hexToRGB(CONFIG.PARTICLE_COLOR);
    gl.uniform3f(this.uniforms.render.particleColor, rgb[0], rgb[1], rgb[2]);
    gl.uniform1f(this.uniforms.render.particleOpacity, CONFIG.PARTICLE_OPACITY);
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    gl.drawArrays(gl.POINTS, 0, this.particleCount);
    
    gl.disable(gl.BLEND);
}
}