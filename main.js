/*
To do:
Creation / destruction should ebb and flow more (one part of the image creating / one part destroying at all times)
Adjust palettes / add more natural looking palettes
Choose and use a random palette upon startup
Toggle for different noise modes (perlin, simplex, other flow field types, etc.)
Export image / video from canvas
Improve UI (check ASCII / past projects)
Mobile testing
project naming
User control / modification of flow field
Show the original image underneath?
Footer / about info
Describe each variable and what it does
Github readme -- get Claude to write it, including overview, installation instructions, parameter descriptions, etc.
site OG
hotkeys
Create image / video examples
*/

// Global state and managers
let gl, glState, resourceManager;
let particleSystem;
let currentImage = null;
let animationFrameId = null;
let isAnimating = false;
let lastTime = 0;
let isRestarting = false;

let palettes =
{
  noir: ["#000000", "#FFFFFF"],
  crimson: ["#5B1A18", "#FD6467"],
  sea: ["#2f5575", "#94f0dc"],
  cherry: ["#f1faee", "#e63946"],
  violet: ["#e0c3fc", "#4d194d"],
  lakers: ["#652EC7", "#FFD300"],
  tangerine: ["#B2FAFF", "#FF9472"],
  vapor: ["#C6FFF1", "#FF36AB"],
  retro: ["#f6d166", "#df2d2d"],
  analog: ["#1A1831", "#5bada6"],
  primary: ["#FFFF00", "#0000FF"],
  euphoria: ["#361944", "#86BFE7"],
  emerald: ["#02190C", "#900C3F"],
  slate: ["#141415", "#9F978D"],
  sakura: ["#FFB3A7", "#C93756"],
};

// Configuration
const CONFIG = {
    particleCount: { value: 300000, min: 200000, max: 700000, step: 1000 },
    edgeThreshold: { value: 0.4, min: 0.1, max: 1.5, step: 0.1 },
    particleSpeed: { value: 12.0, min: 2.0, max: 70.0, step: 0.5 },
    attractionStrength: { value: 85.0, min: 1.0, max: 200.0, step: 1.0 },
    particleOpacity: { value: 0.2, min: 0.05, max: 1.0, step: 0.05 },
    particleSize: { value: 0.8, min: 0.3, max: 1.5, step: 0.1 },
    selectedPalette: 'analog',
    backgroundColor: '#1A1831',
    particleColor: '#5bada6',
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
    
    // Initialize controllers object
    window.guiControllers = {};
    
    // Create a folder for color settings
    const colorFolder = gui.addFolder('Colors');
    colorFolder.open(); // Open the colors folder by default
    
    // Add palette selector
    const paletteNames = Object.keys(palettes);
    window.guiControllers.selectedPalette = colorFolder.add(CONFIG, 'selectedPalette', paletteNames)
        .name('Color Palette')
        .onChange(value => {
            const [bg, particle] = palettes[value];
            CONFIG.backgroundColor = bg;
            CONFIG.particleColor = particle;
            updateConfig('backgroundColor', bg);
            updateConfig('particleColor', particle);
            // Update the color controllers
            window.guiControllers.backgroundColor.updateDisplay();
            window.guiControllers.particleColor.updateDisplay();
        });
    
    // Add individual color controls
    window.guiControllers.backgroundColor = colorFolder.addColor(CONFIG, 'backgroundColor')
        .name('Background')
        .onChange(v => updateConfig('backgroundColor', v));
    
    window.guiControllers.particleColor = colorFolder.addColor(CONFIG, 'particleColor')
        .name('Particles')
        .onChange(v => updateConfig('particleColor', v));
    
    // Add other controls
    Object.entries(CONFIG).forEach(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value) && key !== 'selectedPalette') {
            window.guiControllers[key] = gui.add(CONFIG[key], 'value', value.min, value.max, value.step)
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

  // These parameters can be updated without restarting
  const noRestartParams = [
      'particleOpacity',
      'particleSpeed',
      'attractionStrength',
      'particleSize',
      'particleColor',
      'backgroundColor',
      'IS_PLAYING'
  ];

  // Update the configuration
  if (key.includes('Color')) {
      CONFIG[key] = value;
  } else if (typeof CONFIG[key] === 'object' && CONFIG[key].hasOwnProperty('value')) {
      CONFIG[key] = {
          ...CONFIG[key],
          value: typeof value === 'object' ? value.value : value
      };
  } else {
      CONFIG[key] = value;
  }

  // Handle special cases
  if (key === 'backgroundColor') {
      updateBackgroundColor();
      return;
  }

  // Only restart if:
  // 1. The parameter requires restart
  // 2. We have an image
  if (!noRestartParams.includes(key) && 
      currentImage) {
      safeRestartAnimation();
  }
}

function randomizeInputs() {
  if (isRestarting) return;
  
  // Randomly select a palette
  const paletteKeys = Object.keys(palettes);
  const randomPaletteKey = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];
  const [newBgColor, newParticleColor] = palettes[randomPaletteKey];
  
  // Update colors and palette selection
  CONFIG.selectedPalette = randomPaletteKey;
  CONFIG.backgroundColor = newBgColor;
  CONFIG.particleColor = newParticleColor;
  
  // Randomize other parameters
  Object.entries(CONFIG).forEach(([key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value) && key !== 'selectedPalette' && key !== 'attractionStrength') {
          const newValue = WebGLUtils.getRandomValue(value.min, value.max, value.step);
          CONFIG[key].value = newValue;
          // Update the GUI controller
          if (window.guiControllers[key]) {
              window.guiControllers[key].setValue(newValue);
          }
      }
  });

  //set attractionStrength based on randomly chosen particleSpeed
  //ratio vs. max value can be -20% to +40% vs. the value of the particleSpeed
  let speedRatio = CONFIG['particleSpeed'].value / CONFIG['particleSpeed'].max;
  let ratioAdjustment = (Math.random()*0.6 - 0.2);
  let attractionStrengthValue = CONFIG['attractionStrength'].max * (speedRatio+ratioAdjustment);
  CONFIG['attractionStrength'].value = attractionStrengthValue;
  window.guiControllers['attractionStrength'].setValue(attractionStrengthValue);

  // Update GUI controllers for colors and palette
  if (window.guiControllers.selectedPalette) {
      CONFIG.selectedPalette = randomPaletteKey; // Update the config value first
      window.guiControllers.selectedPalette.updateDisplay(); // Then update the display
  }
  if (window.guiControllers.backgroundColor) {
      window.guiControllers.backgroundColor.setValue(newBgColor);
  }
  if (window.guiControllers.particleColor) {
      window.guiControllers.particleColor.setValue(newParticleColor);
  }
  
  updateBackgroundColor();
  if (currentImage) {
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
      }, 25); // Small delay for cleanup
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

// Load the default image
async function loadDefaultImage() {
  try {
      const response = await fetch('https://github.com/collidingScopes/particleDissolve/blob/f1064ded5afb1aa2dc55b5d0e834a79781cd71e1/assets/face.webp');
      const blob = await response.blob();
      const img = await loadImage(blob);
      currentImage = img;
      resizeCanvasToImage(img);
      await safeRestartAnimation();
  } catch (error) {
      console.error('Error loading default image:', error);
  }
}

// Initialize the application
window.addEventListener('load', async () => {
  await initWebGL();
  await loadDefaultImage();
});