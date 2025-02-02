/**
 * Utility class for handling texture configurations based on device capabilities
 */
class TextureConfig {
    constructor(gl) {
        this.gl = gl;
        this.setup();
    }

    setup() {
        const gl = this.gl;
        
        // Start with preferred configuration
        this.config = {
            internalFormat: gl.RGBA32F,
            format: gl.RGBA,
            type: gl.FLOAT,
            filterMode: gl.LINEAR
        };

        // Check for extensions
        const hasFloatLinear = gl.getExtension('OES_texture_float_linear');
        const hasHalfFloat = gl.getExtension('OES_texture_half_float');
        const hasHalfFloatLinear = gl.getExtension('OES_texture_half_float_linear');
        const hasColorBufferFloat = gl.getExtension('EXT_color_buffer_float');
        
        // Determine best available configuration
        if (!hasFloatLinear || !hasColorBufferFloat) {
            if (hasHalfFloat && hasHalfFloatLinear) {
                // Use half float as first fallback
                this.config.internalFormat = gl.RGBA16F;
                this.config.type = hasHalfFloat.HALF_FLOAT_OES || gl.HALF_FLOAT;
            } else {
                // Fallback to regular RGBA
                this.config.internalFormat = gl.RGBA;
                this.config.type = gl.UNSIGNED_BYTE;
            }
        }

        // If linear filtering isn't supported, fall back to nearest
        if (!hasFloatLinear && !hasHalfFloatLinear) {
            this.config.filterMode = gl.NEAREST;
        }
    }

    getConfig() {
        return this.config;
    }
}

class WebGLUtils {
    /**
     * Create and compile a WebGL shader
     */
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

    /**
     * Create and link a WebGL program
     */
    static createProgram(gl, vertexShader, fragmentShader, transformFeedbackVaryings = null) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        
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

    /**
     * Create and initialize a WebGL buffer
     */
    static createBuffer(gl, data, usage = gl.DYNAMIC_COPY) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, usage);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        return buffer;
    }

    /**
     * Create and initialize a WebGL texture with specified options and fallback support
     */
    static createAndSetupTexture(gl, options = {}) {
        // Get the best available texture configuration
        const textureConfig = new TextureConfig(gl);
        const defaultConfig = textureConfig.getConfig();

        const {
            width,
            height,
            internalFormat = defaultConfig.internalFormat,
            format = defaultConfig.format,
            type = defaultConfig.type,
            minFilter = defaultConfig.filterMode,
            magFilter = defaultConfig.filterMode,
            wrap = gl.CLAMP_TO_EDGE,
            data = null
        } = options;

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
        
        // Initialize texture data
        if (width && height) {
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                internalFormat,
                width,
                height,
                0,
                format,
                type,
                data
            );
        } else if (data) {
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                internalFormat,
                format,
                type,
                data
            );
        }
        
        // Handle potential errors
        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
            console.warn('WebGL error when creating texture:', error);
            // If we hit an error and we're not already using the fallback format,
            // try again with the most basic configuration
            if (internalFormat !== gl.RGBA || type !== gl.UNSIGNED_BYTE) {
                console.log('Falling back to basic texture format');
                return this.createAndSetupTexture(gl, {
                    ...options,
                    internalFormat: gl.RGBA,
                    format: gl.RGBA,
                    type: gl.UNSIGNED_BYTE,
                    minFilter: gl.LINEAR,
                    magFilter: gl.LINEAR
                });
            }
        }
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    /**
     * Set uniform values on a WebGL program
     */
    static setUniforms(gl, program, uniforms) {
        gl.useProgram(program);
        
        Object.entries(uniforms).forEach(([name, value]) => {
            const location = gl.getUniformLocation(program, name);
            if (location === null) return;

            if (Array.isArray(value)) {
                switch (value.length) {
                    case 2: gl.uniform2fv(location, value); break;
                    case 3: gl.uniform3fv(location, value); break;
                    case 4: gl.uniform4fv(location, value); break;
                    case 9: gl.uniformMatrix3fv(location, false, value); break;
                    case 16: gl.uniformMatrix4fv(location, false, value); break;
                    default: gl.uniform1fv(location, value);
                }
            } else if (typeof value === 'number') {
                gl.uniform1f(location, value);
            } else if (typeof value === 'boolean') {
                gl.uniform1i(location, value ? 1 : 0);
            }
        });
    }

    /**
     * Convert hex color string to RGB array
     */
    static hexToRGB(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b];
    }

    /**
     * Generate a random hex color
     */
    static getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    /**
     * Get a random value within a range
     */
    static getRandomValue(min, max, step) {
        const steps = Math.floor((max - min) / step);
        return min + (Math.floor(Math.random() * steps) * step);
    }

    /**
     * Create a full-screen quad (useful for post-processing)
     */
    static createFullscreenQuad(gl) {
        const positions = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            -1, 1,
            1, -1,
            1, 1
        ]);
        
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        
        const buffer = this.createBuffer(gl, positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        
        return { vao, buffer };
    }

    /**
     * Check if WebGL2 is supported
     */
    static isWebGL2Supported() {
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl2');
        } catch (e) {
            return false;
        }
    }

    /**
     * Get max texture size for the current WebGL context
     */
    static getMaxTextureSize(gl) {
        return gl.getParameter(gl.MAX_TEXTURE_SIZE);
    }

    /**
     * Resize a canvas to display size with the correct device pixel ratio
     */
    static resizeCanvasToDisplaySize(canvas, multiplier = 1) {
        const width = Math.floor(canvas.clientWidth * multiplier);
        const height = Math.floor(canvas.clientHeight * multiplier);

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            return true;
        }
        return false;
    }

    /**
     * Load texture from URL with automatic format selection
     */
    static async loadTexture(gl, url) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const texture = this.createAndSetupTexture(gl, { data: image });
                resolve(texture);
            };
            image.onerror = reject;
            image.src = url;
        });
    }

    /**
     * Load multiple textures from URLs
     */
    static async loadTextures(gl, urls) {
        const promises = urls.map(url => this.loadTexture(gl, url));
        return Promise.all(promises);
    }

    /**
     * Create framebuffer with texture attachment and format fallback support
     */
    static createFramebufferWithTexture(gl, width, height, options = {}) {
        // Get the best available texture configuration
        const textureConfig = new TextureConfig(gl);
        const defaultConfig = textureConfig.getConfig();

        const texture = this.createAndSetupTexture(gl, {
            width,
            height,
            internalFormat: defaultConfig.internalFormat,
            format: defaultConfig.format,
            type: defaultConfig.type,
            ...options
        });

        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0
        );

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            // If framebuffer is not complete with high precision format, try fallback
            if (options.internalFormat !== gl.RGBA || options.type !== gl.UNSIGNED_BYTE) {
                gl.deleteFramebuffer(framebuffer);
                gl.deleteTexture(texture);
                return this.createFramebufferWithTexture(gl, width, height, {
                    ...options,
                    internalFormat: gl.RGBA,
                    format: gl.RGBA,
                    type: gl.UNSIGNED_BYTE
                });
            }
            throw new Error('Framebuffer is not complete: ' + status);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        return { framebuffer, texture };
    }

    /**
     * Log WebGL capabilities and supported extensions
     */
    static logWebGLCapabilities(gl) {
        console.log('WebGL Capabilities:');
        console.log('WebGL version:', gl.getParameter(gl.VERSION));
        console.log('Shader version:', gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
        console.log('Vendor:', gl.getParameter(gl.VENDOR));
        console.log('Renderer:', gl.getParameter(gl.RENDERER));
        console.log('Max texture size:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
        console.log('Max viewport dimensions:', gl.getParameter(gl.MAX_VIEWPORT_DIMS));
        console.log('Available extensions:', gl.getSupportedExtensions());
    }
}