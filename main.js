/*
To do:
Adjust min/max/default values of sliders
Does search radius / attraction strength do anything? Remove if not
Default image upon startup
Adjusting edge threshold (and other toggles) shouldn't trigger a full restart of the animation
Export image / video from canvas
Pause / play button
Add toggle for color randomness around selected hue?
Add a persistent "push" force onto the particles -- like wind blowing across sand -- using wave movement
- Ability to select strength / direction of movement?
Show the original image underneath?
Footer / about info
Github readme
site OG
hotkeys
*/

// Initialize WebGL
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');
if (!gl) {
    alert('WebGL 2 not supported');
    throw new Error('WebGL 2 not supported');
}

// Enable required extensions
const requiredExtensions = [
    'EXT_color_buffer_float',
    'OES_texture_float_linear'
];

for (const ext of requiredExtensions) {
    if (!gl.getExtension(ext)) {
        alert(`Required extension ${ext} not supported`);
        throw new Error(`Required extension ${ext} not supported`);
    }
}

// Function to resize canvas based on image dimensions
function resizeCanvasToImage(image) {
    const maxSize = Math.min(window.innerWidth, window.innerHeight) - 40;
    const scale = Math.min(maxSize / image.width, maxSize / image.height);
    
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
}

// Configuration
const CONFIG = {
    PARTICLE_COUNT: 300000,
    EDGE_THRESHOLD: 0.5,
    PARTICLE_SPEED: 0.0040,
    SEARCH_RADIUS: 50,
    RANDOM_STRENGTH: 400,
    ATTRACTION_STRENGTH: 6.0,
    PARTICLE_OPACITY: 0.5,
    PARTICLE_COLOR: '#fadcdc',
    PARTICLE_SIZE: 1.0,
    BACKGROUND_COLOR: '#000000',
    IS_PLAYING: true // Add play/pause state
};

// Configuration ranges for randomization
const CONFIG_RANGES = {
    PARTICLE_COUNT: { min: 200000, max: 700000, step: 1000 },
    EDGE_THRESHOLD: { min: 0.1, max: 3.0, step: 0.1 },
    PARTICLE_SPEED: { min: 0.0001, max: 0.05, step: 0.0001 },
    SEARCH_RADIUS: { min: 0.1, max: 100.0, step: 0.1 },
    RANDOM_STRENGTH: { min: 0.0, max: 1000.0, step: 0.1 },
    ATTRACTION_STRENGTH: { min: 0.0, max: 50.0, step: 0.1 },
    PARTICLE_OPACITY: { min: 0.1, max: 1.0, step: 0.1 },
    PARTICLE_SIZE: { min: 1.0, max: 1.0, step: 0.5 }
};

// Function to get a random value within a range
function getRandomValue(min, max, step) {
    const steps = Math.floor((max - min) / step);
    return min + (Math.floor(Math.random() * steps) * step);
}

// Function to get a random color
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Function to randomize all inputs
function randomizeInputs() {
    for (const [key, range] of Object.entries(CONFIG_RANGES)) {
        CONFIG[key] = getRandomValue(range.min, range.max, range.step);
    }
    CONFIG.PARTICLE_COLOR = getRandomColor();
    CONFIG.BACKGROUND_COLOR = getRandomColor();
    
    // Update GUI controllers
    for (const controller of gui.__controllers) {
        controller.updateDisplay();
    }
    
    // Apply changes
    updateBackgroundColor();
    if (currentImage) {
        restartAnimation();
    }
}

// Function to update background color
function updateBackgroundColor() {
    gl.clearColor(
        ...hexToRGB(CONFIG.BACKGROUND_COLOR),
        1.0
    );
}

// Function to toggle play/pause
function togglePlayPause() {
    CONFIG.IS_PLAYING = !CONFIG.IS_PLAYING;
    if (CONFIG.IS_PLAYING) {
        startAnimation();
    } else {
        stopAnimation();
    }
    // Update button text
    playPauseBtn.name(CONFIG.IS_PLAYING ? 'Pause' : 'Play');
}

// Initialize dat.gui
const gui = new dat.GUI();
gui.add(CONFIG, 'PARTICLE_COUNT', 1000, 1000000, 1000).name('Particle Count').onChange(v => updateConfig('PARTICLE_COUNT', v));
gui.add(CONFIG, 'EDGE_THRESHOLD', 0.1, 5.0, 0.1).name('Edge Threshold').onChange(v => updateConfig('EDGE_THRESHOLD', v));
gui.add(CONFIG, 'PARTICLE_SPEED', 0.0001, 0.1, 0.0001).name('Particle Speed').onChange(v => updateConfig('PARTICLE_SPEED', v));
gui.add(CONFIG, 'SEARCH_RADIUS', 0.1, 100.0, 0.1).name('Search Radius').onChange(v => updateConfig('SEARCH_RADIUS', v));
gui.add(CONFIG, 'RANDOM_STRENGTH', 0.0, 1000.0, 0.1).name('Random Strength').onChange(v => updateConfig('RANDOM_STRENGTH', v));
gui.add(CONFIG, 'ATTRACTION_STRENGTH', 0.0, 50.0, 0.1).name('Attraction Strength').onChange(v => updateConfig('ATTRACTION_STRENGTH', v));
gui.add(CONFIG, 'PARTICLE_OPACITY', 0.1, 1.0, 0.1).name('Particle Opacity').onChange(v => updateConfig('PARTICLE_OPACITY', v));
gui.add(CONFIG, 'PARTICLE_SIZE', 1.0, 10.0, 0.5).name('Particle Size').onChange(v => updateConfig('PARTICLE_SIZE', v));
gui.addColor(CONFIG, 'PARTICLE_COLOR').name('Particle Color').onChange(v => updateConfig('PARTICLE_COLOR', v));
gui.addColor(CONFIG, 'BACKGROUND_COLOR').name('Background Color').onChange(v => {
    CONFIG.BACKGROUND_COLOR = v;
    updateBackgroundColor();
});

// Add play/pause button
const playPauseBtn = gui.add({ togglePlayPause }, 'togglePlayPause').name('Pause');

// Add randomize button
const randomizeBtn = { randomize: randomizeInputs };
gui.add(randomizeBtn, 'randomize').name('Randomize All');

// Helper function to convert hex to RGB
function hexToRGB(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}

// Create particle system
let particleSystem;
let currentImage = null;
try {
    particleSystem = new ParticleSystem(gl, CONFIG.PARTICLE_COUNT);
} catch (error) {
    console.error('Failed to create particle system:', error);
    alert('Failed to initialize WebGL particle system');
    throw error;
}

// Handle configuration changes
function updateConfig(key, value) {
    CONFIG[key] = value;
    if (currentImage) {
        restartAnimation();
    }
}

// Animation state
let lastTime = 0;
let animationFrameId = null;
let isAnimating = false;

function clearCanvas() {
    gl.clear(gl.COLOR_BUFFER_BIT);
}

// Initialize background color
updateBackgroundColor();

function animate(currentTime) {
    const deltaTime = lastTime ? currentTime - lastTime : 0;
    lastTime = currentTime;
    
    clearCanvas();
    
    particleSystem.update(deltaTime);
    particleSystem.render();
    
    if (isAnimating && CONFIG.IS_PLAYING) {
        animationFrameId = requestAnimationFrame(animate);
    }
}

function startAnimation() {
    if (!isAnimating) {
        isAnimating = true;
        lastTime = 0;
        animate(0);
    }
}

function stopAnimation() {
    isAnimating = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function restartAnimation() {
    if (currentImage) {
        stopAnimation();
        clearCanvas();
        particleSystem = new ParticleSystem(gl, CONFIG.PARTICLE_COUNT);
        particleSystem.processImage(currentImage);
        startAnimation();
    }
}

// Handle image upload
document.getElementById('imageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            stopAnimation();
            clearCanvas();
            
            try {
                currentImage = img;
                resizeCanvasToImage(img);
                particleSystem = new ParticleSystem(gl, CONFIG.PARTICLE_COUNT);
                particleSystem.processImage(currentImage);
                CONFIG.IS_PLAYING = true; // Reset to playing state when new image is loaded
                playPauseBtn.name('Pause'); // Update button text
                startAnimation();
            } catch (error) {
                console.error('Error processing image:', error);
                alert('Error processing image. Please try a different image.');
            }
        };
        img.onerror = () => {
            alert('Error loading image. Please try a different image.');
        };
        img.src = event.target.result;
    };
    reader.onerror = () => {
        alert('Error reading file. Please try again.');
    };
    reader.readAsDataURL(file);
});

// Handle restart button
document.getElementById('restartBtn').addEventListener('click', restartAnimation);

// Add keyboard shortcut for play/pause (spacebar)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && currentImage) {
        e.preventDefault(); // Prevent page scroll
        togglePlayPause();
    }
});

// Cleanup on page unload
window.addEventListener('unload', () => {
    stopAnimation();
});