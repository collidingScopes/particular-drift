class ParticleSystem {
  constructor(gl, particleCount) {
      this.gl = gl;
      this.particleCount = particleCount;
      this.currentIndex = 0;
      this.time = 0;
      
      // Get programs from resource manager
      this.updateProgram = resourceManager.programs.get('update');
      this.renderProgram = resourceManager.programs.get('particle');
      this.edgeProgram = resourceManager.programs.get('edge');
      
      if (!this.updateProgram || !this.renderProgram || !this.edgeProgram) {
          throw new Error('Required programs not initialized');
      }

      // Create transform feedback
      this.transformFeedback = gl.createTransformFeedback();
      
      this.initUniformLocations();
      this.initBuffers();
      this.setupEdgeDetection();
  }
  
  initUniformLocations() {
      const gl = this.gl;
      
      this.uniforms = {
          update: {
              deltaTime: gl.getUniformLocation(this.updateProgram, 'deltaTime'),
              resolution: gl.getUniformLocation(this.updateProgram, 'resolution'),
              edgeTexture: gl.getUniformLocation(this.updateProgram, 'edgeTexture'),
              particleSpeed: gl.getUniformLocation(this.updateProgram, 'particleSpeed'),
              searchRadius: gl.getUniformLocation(this.updateProgram, 'searchRadius'),
              attractionStrength: gl.getUniformLocation(this.updateProgram, 'attractionStrength'),
              time: gl.getUniformLocation(this.updateProgram, 'time')
          },
          edge: {
              resolution: gl.getUniformLocation(this.edgeProgram, 'uResolution'),
              image: gl.getUniformLocation(this.edgeProgram, 'uImage'),
              threshold: gl.getUniformLocation(this.edgeProgram, 'threshold')
          },
          render: {
              particleColor: gl.getUniformLocation(this.renderProgram, 'uParticleColor'),
              particleOpacity: gl.getUniformLocation(this.renderProgram, 'uParticleOpacity'),
              particleSize: gl.getUniformLocation(this.renderProgram, 'particleSize')
          }
      };
  }
  
  setupEdgeDetection() {
      // Create framebuffer and texture for edge detection
      this.edgeFramebuffer = resourceManager.createFramebuffer();
      this.edgeTexture = resourceManager.createTexture({
          width: this.gl.canvas.width,
          height: this.gl.canvas.height,
          internalFormat: this.gl.RGBA,
          format: this.gl.RGBA,
          type: this.gl.UNSIGNED_BYTE,
          minFilter: this.gl.LINEAR,
          magFilter: this.gl.LINEAR,
          wrap: this.gl.CLAMP_TO_EDGE
      });
      
      // Attach texture to framebuffer
      glState.bindFramebuffer(this.edgeFramebuffer);
      this.gl.framebufferTexture2D(
          this.gl.FRAMEBUFFER,
          this.gl.COLOR_ATTACHMENT0,
          this.gl.TEXTURE_2D,
          this.edgeTexture,
          0
      );

      // Check framebuffer status
      const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
      if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
          throw new Error('Framebuffer is not complete: ' + status);
      }
      
      glState.bindFramebuffer(null);
  }
  
  initBuffers() {
      const gl = this.gl;
      
      // Create particle data arrays
      const positions = new Float32Array(this.particleCount * 2);
      const velocities = new Float32Array(this.particleCount * 2);
      const targets = new Float32Array(this.particleCount * 2);
      
      // Initialize particle data
      for (let i = 0; i < this.particleCount; i++) {
          const i2 = i * 2;
          positions[i2] = Math.random();
          positions[i2 + 1] = Math.random();
          velocities[i2] = (Math.random() - 0.5) * 0.001;
          velocities[i2 + 1] = (Math.random() - 0.5) * 0.001;
          targets[i2] = -1;
          targets[i2 + 1] = -1;
      }
      
      // Create ping-pong buffers
      this.positionBuffers = [
          resourceManager.createBuffer(positions),
          resourceManager.createBuffer(positions)
      ];
      
      this.velocityBuffers = [
          resourceManager.createBuffer(velocities),
          resourceManager.createBuffer(velocities)
      ];
      
      this.targetBuffers = [
          resourceManager.createBuffer(targets),
          resourceManager.createBuffer(targets)
      ];
      
      // Create quad buffer for edge detection
      this.quadBuffer = resourceManager.createBuffer(new Float32Array([
          -1, -1, 1, -1, -1, 1,
          -1, 1, 1, -1, 1, 1
      ]));

      // Create VAOs
      this.edgeVAO = this.createEdgeVAO();
      this.vaos = [
          this.createParticleVAO(0),
          this.createParticleVAO(1)
      ];
  }
  
  createEdgeVAO() {
      const vao = this.gl.createVertexArray();
      glState.bindVAO(vao);
      
      // Set up position attribute
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
      const positionLoc = this.gl.getAttribLocation(this.edgeProgram, 'aPosition');
      this.gl.enableVertexAttribArray(positionLoc);
      this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0);
      
      return vao;
  }
  
  createParticleVAO(index) {
      const vao = this.gl.createVertexArray();
      glState.bindVAO(vao);
      
      // Position attribute
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffers[index]);
      this.gl.enableVertexAttribArray(0);
      this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);
      
      // Velocity attribute
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.velocityBuffers[index]);
      this.gl.enableVertexAttribArray(1);
      this.gl.vertexAttribPointer(1, 2, this.gl.FLOAT, false, 0, 0);
      
      // Target attribute
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.targetBuffers[index]);
      this.gl.enableVertexAttribArray(2);
      this.gl.vertexAttribPointer(2, 2, this.gl.FLOAT, false, 0, 0);
      
      return vao;
  }

  processImage(image) {
      const gl = this.gl;
      
      // Create and set up input texture
      const inputTexture = resourceManager.createTexture({
          width: image.width,
          height: image.height,
          internalFormat: gl.RGBA,
          format: gl.RGBA,
          type: gl.UNSIGNED_BYTE,
          minFilter: gl.LINEAR,
          magFilter: gl.LINEAR,
          wrap: gl.CLAMP_TO_EDGE,
          data: image
      });
      
      // Perform edge detection
      glState.bindFramebuffer(this.edgeFramebuffer);
      glState.setViewport(0, 0, gl.canvas.width, gl.canvas.height);
      glState.useProgram(this.edgeProgram);
      
      // Set uniforms
      gl.uniform2f(
          this.uniforms.edge.resolution,
          gl.canvas.width,
          gl.canvas.height
      );
      gl.uniform1f(this.uniforms.edge.threshold, CONFIG.edgeThreshold.value);
      
      // Bind input texture and draw
      glState.bindTexture(inputTexture, 0);
      gl.uniform1i(this.uniforms.edge.image, 0);
      
      glState.bindVAO(this.edgeVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      // Cleanup
      resourceManager.deleteResource(inputTexture);
      glState.bindFramebuffer(null);
      
      // Set edge texture for particle update shader
      glState.useProgram(this.updateProgram);
      gl.uniform1i(this.uniforms.update.edgeTexture, 0);
      glState.bindTexture(this.edgeTexture, 0);
  }

  update(deltaTime) {
      const gl = this.gl;
      
      // Update time
      this.time += deltaTime * 0.001;
      
      glState.useProgram(this.updateProgram);
      
      // Set uniforms
      gl.uniform1f(this.uniforms.update.deltaTime, deltaTime * 0.001);
      gl.uniform2f(
          this.uniforms.update.resolution,
          gl.canvas.width,
          gl.canvas.height
      );
      gl.uniform1f(this.uniforms.update.time, this.time);
      gl.uniform1f(this.uniforms.update.particleSpeed, CONFIG.particleSpeed.value);
      gl.uniform1f(this.uniforms.update.searchRadius, CONFIG.searchRadius.value);
      gl.uniform1f(this.uniforms.update.attractionStrength, CONFIG.attractionStrength.value);

      // Set up transform feedback
      glState.bindVAO(this.vaos[this.currentIndex]);
      gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
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

  render() {
      const gl = this.gl;
      
      glState.useProgram(this.renderProgram);
      glState.bindVAO(this.vaos[this.currentIndex]);
      
      // Set uniforms
      const rgb = WebGLUtils.hexToRGB(CONFIG.particleColor);
      gl.uniform3f(this.uniforms.render.particleColor, rgb[0], rgb[1], rgb[2]);
      gl.uniform1f(this.uniforms.render.particleOpacity, CONFIG.particleOpacity.value);
      gl.uniform1f(this.uniforms.render.particleSize, CONFIG.particleSize.value);

      // Set up blending
      glState.setBlending(true);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      
      // Draw particles
      gl.drawArrays(gl.POINTS, 0, this.particleCount);
      
      glState.setBlending(false);
  }

  dispose() {
      // Clean up WebGL resources
      this.gl.deleteTransformFeedback(this.transformFeedback);
      
      // Clean up VAOs
      this.gl.deleteVertexArray(this.edgeVAO);
      this.vaos.forEach(vao => this.gl.deleteVertexArray(vao));
      
      // The ResourceManager will handle cleaning up textures, buffers, and framebuffers
  }
}