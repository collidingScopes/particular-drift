/*
To do:
dat.gui inputs
function to randomize inputs
Adjust min/max/default values of sliders
Toggle for background color
Does search radius / attraction strength do anything? Remove if not
Default image upon startup
Adjusting edge threshold (and other toggles) shouldn't trigger a full restart of the animation
Export image / video from canvas
Pause / play button
color toggle should only fire refresh upon finishChange (too much lag otherwise)
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

// Function to resize canvas based on image dimensions while maintaining max size constraints
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
  EDGE_THRESHOLD: 2,
  PARTICLE_SPEED: 0.0030,
  SEARCH_RADIUS: 2,
  RANDOM_STRENGTH: 600,
  ATTRACTION_STRENGTH: 1.0,
  PARTICLE_OPACITY: 0.5,
  PARTICLE_COLOR: '#fadcdc',
};

// Initialize sliders with default values
document.getElementById('particleCount').value = CONFIG.PARTICLE_COUNT;
document.getElementById('edgeThreshold').value = CONFIG.EDGE_THRESHOLD;
document.getElementById('particleSpeed').value = CONFIG.PARTICLE_SPEED;
document.getElementById('searchRadius').value = CONFIG.SEARCH_RADIUS;
document.getElementById('randomStrength').value = CONFIG.RANDOM_STRENGTH;
document.getElementById('attractionStrength').value = CONFIG.ATTRACTION_STRENGTH;

// Update value displays
document.getElementById('particleCountValue').textContent = CONFIG.PARTICLE_COUNT;
document.getElementById('edgeThresholdValue').textContent = CONFIG.EDGE_THRESHOLD;
document.getElementById('particleSpeedValue').textContent = CONFIG.PARTICLE_SPEED;
document.getElementById('searchRadiusValue').textContent = CONFIG.SEARCH_RADIUS;
document.getElementById('randomStrengthValue').textContent = CONFIG.RANDOM_STRENGTH;
document.getElementById('attractionStrengthValue').textContent = CONFIG.ATTRACTION_STRENGTH;

// Add event listeners for new sliders
document.getElementById('randomStrength').addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  document.getElementById('randomStrengthValue').textContent = value;
  updateConfig('RANDOM_STRENGTH', value);
});

document.getElementById('attractionStrength').addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  document.getElementById('attractionStrengthValue').textContent = value;
  updateConfig('ATTRACTION_STRENGTH', value);
});

// Add event listeners after existing ones
document.getElementById('particleOpacity').addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  document.getElementById('particleOpacityValue').textContent = value;
  updateConfig('PARTICLE_OPACITY', value);
});

document.getElementById('particleColor').addEventListener('input', (e) => {
  const value = e.target.value;
  updateConfig('PARTICLE_COLOR', value);
});

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

// Handle slider changes
function updateConfig(key, value) {
    CONFIG[key] = value;
    if (currentImage) {
        restartAnimation();
    }
}

document.getElementById('particleCount').addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    document.getElementById('particleCountValue').textContent = value;
    updateConfig('PARTICLE_COUNT', value);
});

document.getElementById('edgeThreshold').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('edgeThresholdValue').textContent = value;
    updateConfig('EDGE_THRESHOLD', value);
});

document.getElementById('particleSpeed').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('particleSpeedValue').textContent = value;
    updateConfig('PARTICLE_SPEED', value);
});

document.getElementById('searchRadius').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('searchRadiusValue').textContent = value;
    updateConfig('SEARCH_RADIUS', value);
});

// Animation state
let lastTime = 0;
let animationFrameId = null;
let isAnimating = false;

function clearCanvas() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

function animate(currentTime) {
    const deltaTime = lastTime ? currentTime - lastTime : 0;
    lastTime = currentTime;
    
    clearCanvas();
    
    particleSystem.update(deltaTime);
    particleSystem.render();
    
    if (isAnimating) {
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
                // Store current image for restart functionality
                currentImage = img;
                // Resize canvas to match image dimensions
                resizeCanvasToImage(img);
                particleSystem = new ParticleSystem(gl, CONFIG.PARTICLE_COUNT);
                particleSystem.processImage(currentImage);
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

// Cleanup on page unload
window.addEventListener('unload', () => {
    stopAnimation();
});