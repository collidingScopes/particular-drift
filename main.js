/*
To do:
Adjust min/max/default values of sliders
Does search radius do anything? Remove if not
Movement should take into consideration strength of edge as well? More attracted to strong edges
Default image upon startup
Adjusting edge threshold (and other toggles) shouldn't trigger a full restart of the animation
Export image / video from canvas
Pause / play button
Add toggle for color randomness around selected hue?
At low attraction level, the stuck particles should get displaced as well
Randomize All does not update the GUI display properly (not synced)
Show the original image underneath?
Footer / about info
Describe each variable and what it does
Github readme
site OG
hotkeys
*/

// Global state and managers
let gl, glState, resourceManager;
let particleSystem;
let currentImage = null;
let animationFrameId = null;
let isAnimating = false;
let lastTime = 0;
let isRestarting = false;

// Configuration
const CONFIG = {
    particleCount: { value: 300000, min: 200000, max: 700000, step: 1000 },
    edgeThreshold: { value: 0.5, min: 0.1, max: 3.0, step: 0.1 },
    particleSpeed: { value: 12.0, min: 1.0, max: 60.0, step: 0.5 },
    searchRadius: { value: 50, min: 0.1, max: 1000.0, step: 0.1 },
    attractionStrength: { value: 5.0, min: 0.1, max: 50.0, step: 0.1 },
    particleOpacity: { value: 0.3, min: 0.1, max: 1.0, step: 0.1 },
    particleSize: { value: 1.0, min: 0.5, max: 2.0, step: 0.1 },
    particleColor: '#fadcdc',
    backgroundColor: '#2c0b0b',
    IS_PLAYING: true
};

async function initWebGL() {
    const canvas = document.getElementById('canvas');
    gl = canvas.getContext('webgl2');
    
    if (!gl) {
        alert('WebGL 2 not supported');
        throw new Error('WebGL 2 not supported');
    }

    // Enable required extensions
    const requiredExtensions = ['EXT_color_buffer_float', 'OES_texture_float_linear'];
    for (const ext of requiredExtensions) {
        if (!gl.getExtension(ext)) {
            alert(`Required extension ${ext} not supported`);
            throw new Error(`Required extension ${ext} not supported`);
        }
    }

    // Initialize managers
    glState = new GLState(gl);
    resourceManager = new ResourceManager(gl);

    // Load shaders and create programs
    try {
        await resourceManager.createProgram(
            'particle',
            'particle',
            'particle'
        );

        await resourceManager.createProgram(
            'update',
            'update',
            'update',
            ['vPosition', 'vVelocity', 'vTarget']
        );

        await resourceManager.createProgram(
            'edge',
            'edge',
            'edge'
        );

        initGUI();
        setupEventListeners();
        updateBackgroundColor();

    } catch (error) {
        console.error('Failed to initialize WebGL:', error);
        alert('Failed to initialize WebGL. Please check console for details.');
    }
}

function initGUI() {
    const gui = new dat.GUI();
    
    // Add controls for each configuration value
    Object.entries(CONFIG).forEach(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value)) {
            gui.add(CONFIG[key], 'value', value.min, value.max, value.step)
               .name(key.replace(/_/g, ' '))
               .onChange(v => updateConfig(key, v));
        } else if (key.includes('Color')) {
            gui.addColor(CONFIG, key)
               .name(key.replace(/_/g, ' '))
               .onChange(v => updateConfig(key, v));
        }
    });

    // Add play/pause button
    gui.add({ togglePlayPause }, 'togglePlayPause').name('Pause/Play');

    // Add randomize button
    gui.add({ randomize: randomizeInputs }, 'randomize').name('Randomize All');
}

function setupEventListeners() {
    // Handle image upload
    document.getElementById('imageInput').addEventListener('change', handleImageUpload);
    
    // Handle restart button
    document.getElementById('restartBtn').addEventListener('click', () => safeRestartAnimation());
    
    // Add keyboard shortcut for play/pause (spacebar)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && currentImage) {
            e.preventDefault(); // Prevent page scroll
            togglePlayPause();
        }
    });

    // Cleanup on page unload
    window.addEventListener('unload', cleanup);
}

function updateConfig(key, value) {
    // Prevent updates while restarting
    if (isRestarting) return;

    const oldValue = CONFIG[key].value;
    
    // Update the configuration
    if (typeof value === 'object' && value.hasOwnProperty('value')) {
        CONFIG[key].value = value.value;
    } else if (key.includes('Color')) {
        CONFIG[key] = value;
    } else {
        CONFIG[key] = { ...CONFIG[key], value: value };
    }

    // These parameters can be updated without restarting
    const noRestartParams = [
        'particleOpacity',
        'particleSize',
        'particleColor'
    ];

    // Handle immediate visual updates
    if (key === 'backgroundColor') {
        updateBackgroundColor();
        return;
    }

    // Only restart if necessary and if we have an image
    if (!noRestartParams.includes(key) && currentImage && oldValue !== value) {
        safeRestartAnimation();
    }
}

function resizeCanvasToImage(image) {
    const maxSize = Math.min(window.innerWidth, window.innerHeight) - 40;
    const scale = Math.min(maxSize / image.width, maxSize / image.height);
    
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    glState.setViewport(0, 0, canvas.width, canvas.height);
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
    }
    
    try {
        const img = await loadImage(file);
        stopAnimation();
        glState.clear();
        
        currentImage = img;
        resizeCanvasToImage(img);
        
        await safeRestartAnimation();
        
    } catch (error) {
        console.error('Error processing image:', error);
        alert('Error processing image. Please try a different image.');
    }
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = event.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

function updateBackgroundColor() {
    glState.setClearColor(...WebGLUtils.hexToRGB(CONFIG.backgroundColor), 1.0);
}

function randomizeInputs() {
    if (isRestarting) return;
    
    Object.entries(CONFIG).forEach(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value)) {
            CONFIG[key].value = WebGLUtils.getRandomValue(value.min, value.max, value.step);
        } else if (key.includes('Color')) {
            CONFIG[key] = WebGLUtils.getRandomColor();
        }
    });
    
    updateBackgroundColor();
    if (currentImage) {
        safeRestartAnimation();
    }
}

function safeRestartAnimation() {
    if (!currentImage || isRestarting) return;
    
    return new Promise((resolve, reject) => {
        isRestarting = true;
        
        // Stop current animation
        stopAnimation();
        
        // Clean up existing particle system
        if (particleSystem) {
            try {
                particleSystem.dispose();
            } catch (error) {
                console.error('Error disposing particle system:', error);
            }
            particleSystem = null;
        }
        
        glState.clear();
        
        // Small delay to ensure cleanup is complete
        setTimeout(() => {
            try {
                // Create new particle system
                particleSystem = new ParticleSystem(gl, CONFIG.particleCount.value);
                particleSystem.processImage(currentImage);
                
                // Reset state and restart
                CONFIG.IS_PLAYING = true;
                isRestarting = false;
                startAnimation();
                resolve();
            } catch (error) {
                console.error('Error during restart:', error);
                isRestarting = false;
                reject(error);
                
                // Attempt to recover
                try {
                    glState.clear();
                    particleSystem = new ParticleSystem(gl, CONFIG.particleCount.value);
                    particleSystem.processImage(currentImage);
                    startAnimation();
                } catch (recoveryError) {
                    console.error('Failed to recover from restart error:', recoveryError);
                    alert('An error occurred. Please refresh the page.');
                }
            }
        }, 50); // Small delay for cleanup
    });
}

function startAnimation() {
    if (!isAnimating && !isRestarting && particleSystem) {
        isAnimating = true;
        lastTime = 0;
        animationFrameId = requestAnimationFrame(animate);
    }
}

function stopAnimation() {
    isAnimating = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function animate(currentTime) {
    if (!particleSystem || isRestarting) {
        isAnimating = false;
        return;
    }

    const deltaTime = lastTime ? currentTime - lastTime : 0;
    lastTime = currentTime;
    
    try {
        glState.clear();
        particleSystem.update(deltaTime);
        particleSystem.render();
        
        if (isAnimating && CONFIG.IS_PLAYING) {
            animationFrameId = requestAnimationFrame(animate);
        }
    } catch (error) {
        console.error('Animation error:', error);
        stopAnimation();
        safeRestartAnimation();
    }
}

function togglePlayPause() {
    if (isRestarting) return;
    
    CONFIG.IS_PLAYING = !CONFIG.IS_PLAYING;
    if (CONFIG.IS_PLAYING) {
        startAnimation();
    } else {
        stopAnimation();
    }
}

function cleanup() {
    stopAnimation();
    if (particleSystem) {
        try {
            particleSystem.dispose();
            particleSystem = null;
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
    if (resourceManager) {
        resourceManager.dispose();
    }
}

// Initialize the application
window.addEventListener('load', initWebGL);