/*
To do:
function to randomize inputs
Adjust min/max/default values of sliders
Toggle for background color
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
};

// Initialize dat.gui
const gui = new dat.GUI();
gui.add(CONFIG, 'PARTICLE_COUNT', 1000, 1000000, 1000).name('Particle Count').onChange(v => updateConfig('PARTICLE_COUNT', v));
gui.add(CONFIG, 'EDGE_THRESHOLD', 0.1, 5.0, 0.1).name('Edge Threshold').onChange(v => updateConfig('EDGE_THRESHOLD', v));
gui.add(CONFIG, 'PARTICLE_SPEED', 0.0001, 0.1, 0.0001).name('Particle Speed').onChange(v => updateConfig('PARTICLE_SPEED', v));
gui.add(CONFIG, 'SEARCH_RADIUS', 0.1, 100.0, 0.1).name('Search Radius').onChange(v => updateConfig('SEARCH_RADIUS', v));
gui.add(CONFIG, 'RANDOM_STRENGTH', 0.0, 1000.0, 0.1).name('Random Strength').onChange(v => updateConfig('RANDOM_STRENGTH', v));
gui.add(CONFIG, 'ATTRACTION_STRENGTH', 0.0, 50.0, 0.1).name('Attraction Strength').onChange(v => updateConfig('ATTRACTION_STRENGTH', v));
gui.add(CONFIG, 'PARTICLE_OPACITY', 0.1, 1.0, 0.1).name('Particle Opacity').onChange(v => updateConfig('PARTICLE_OPACITY', v));
gui.addColor(CONFIG, 'PARTICLE_COLOR').name('Particle Color').onFinishChange(v => updateConfig('PARTICLE_COLOR', v));

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
                currentImage = img;
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