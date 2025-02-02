/*
To do:
Allow user to create / save parameter presets
Choose and use a random default image upon startup (3 different choices?)
Add [x] other particles onto the canvas which have a different color and aren't attracted to edges (only follow flow field)
Button to show the original image underneath?
Add warning to the page upon startup if webgl load fails (ask user to try on Desktop Chrome instead)
*/

let canvas;
let imageInput = document.getElementById("imageInput");

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
  crimson: ["#300907", "#f49092"],
  sea: ["#2f5575", "#94f0dc"],
  cherry: ["#f1faee", "#e63946"],
  maroon: ["#360b1a", "#f6e3c7"],
  lakers: ["#2f0f5b", "#ffe35a"],
  copper: ["#2b1404", "#fec9b9"],
  foam: ["#780C28", "#EAFAEA"],
  retro: ["#feda62", "#8f1414"],
  galaxy: ["#0f0d2e", "#dda290"],
  ink: ["#441752", "#EFB6C8"],
  blackberry: ["#21062b", "#e78686"],
  emerald: ["#00261f", "#95e5bd"],
  slate: ["#ddc1a1", "#1c1c1c"],
  sakura: ["#FFB3A7", "#C93756"],
  indigo: ["#22117c", "#EAFAEA"],
};
const paletteNames = Object.keys(palettes);

// Configuration
let gui = new dat.gui.GUI( { autoPlace: false } );
gui.close();
let guiOpenToggle = false;
const CONFIG = {
    particleSpeed: { value: 12.0, min: 2.0, max: 80.0, step: 0.5 },
    attractionStrength: { value: 85.0, min: 1.0, max: 200.0, step: 1.0 },
    particleOpacity: { value: 0.2, min: 0.05, max: 1.0, step: 0.05 },
    particleSize: { value: 0.8, min: 0.3, max: 1.5, step: 0.1 },
    particleCount: { value: 300000, min: 200000, max: 600000, step: 1000 },
    edgeThreshold: { value: 0.4, min: 0.1, max: 1.5, step: 0.05 },
    noiseType: '2D',
    flowFieldScale: { value: 4.0, min: 1.0, max: 10.0, step: 1.0 },
    selectedPalette: 'galaxy',
    backgroundColor: '#0f0d2e',
    particleColor: '#dda290',
    IS_PLAYING: true
};

async function initWebGL() {
  canvas = document.getElementById('canvas');
  gl = canvas.getContext('webgl2');
  
  if (!gl) {
      alert('WebGL 2 not supported');
      throw new Error('WebGL 2 not supported');
  }

  // Initialize texture configuration
  const textureConfig = new TextureConfig(gl);
  
  // Enable color buffer float extension if available
  const ext = gl.getExtension('EXT_color_buffer_float');
  if (!ext) {
      console.log('EXT_color_buffer_float not supported, falling back to alternative format');
  }

  // Initialize managers with texture configuration
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
    
    // Initialize controllers object
    window.guiControllers = {};

    chooseRandomPalette();

    // Add palette selector
    window.guiControllers.selectedPalette = gui.add(CONFIG, 'selectedPalette', paletteNames)
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
    window.guiControllers.backgroundColor = gui.addColor(CONFIG, 'backgroundColor')
        .name('Background')
        .onChange(v => updateConfig('backgroundColor', v));

    window.guiControllers.particleColor = gui.addColor(CONFIG, 'particleColor')
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

    // Add noise type selector
    window.guiControllers.noiseType = gui.add(CONFIG, 'noiseType', ['2D', '3D'])
    .name('Noise Type')
    .onChange(value => {
        updateConfig('noiseType', value);
    });

    // Add play/pause button
    gui.add({ togglePlayPause }, 'togglePlayPause').name('Pause/Play (space)');

    // Add randomize button
    gui.add({ randomize: randomizeInputs }, 'randomize').name('Randomize Inputs (r)');

    CONFIG['uploadImage'] = function () {
      imageInput.click();
    };
    gui.add(CONFIG, 'uploadImage').name('Upload Image (u)');
    
    CONFIG['saveImage'] = function () {
      saveImage();
    };
    gui.add(CONFIG, 'saveImage').name("Save Image (s)");
    
    CONFIG['saveVideo'] = function () {
      toggleVideoRecord();
    };
    gui.add(CONFIG, 'saveVideo').name("Video Export (v)");
    
    customContainer = document.getElementById('gui');
    customContainer.appendChild(gui.domElement);
}

function chooseRandomPalette(){
  // Randomly select an initial palette
  const randomPaletteName = paletteNames[Math.floor(Math.random() * paletteNames.length)];
  const [randomBg, randomParticle] = palettes[randomPaletteName];
  
  // Update CONFIG with random palette
  CONFIG.selectedPalette = randomPaletteName;
  CONFIG.backgroundColor = randomBg;
  CONFIG.particleColor = randomParticle;

  // Update GUI controllers
  if (window.guiControllers.selectedPalette) {
    window.guiControllers.selectedPalette.setValue(randomPaletteName);
  }
  if (window.guiControllers.backgroundColor) {
    window.guiControllers.backgroundColor.setValue(randomBg);
  }
  if (window.guiControllers.particleColor) {
    window.guiControllers.particleColor.setValue(randomParticle);
  }

  updateBackgroundColor();

}

function setupEventListeners() {
  imageInput.addEventListener('change', handleImageUpload);
  document.getElementById('restartBtn').addEventListener('click', () => safeRestartAnimation());
  document.getElementById('randomizeColorBtn').addEventListener('click', () => chooseRandomPalette());
  document.getElementById('randomizeBtn').addEventListener('click', () => randomizeInputs());
  document.getElementById('exportVideoBtn').addEventListener('click', () => toggleVideoRecord());

  //shortcut hotkey presses
  document.addEventListener('keydown', function(event) {
    
    if (event.key === 's') {
        saveImage();
    } else if (event.key === 'v') {
        toggleVideoRecord();
    } else if (event.code === 'Space') {
      event.preventDefault();
      togglePlayPause();
    } else if(event.key === 'Enter'){
      safeRestartAnimation();
    } else if(event.key === 'r'){
      randomizeInputs();
    } else if(event.key === 'u'){
      imageInput.click();
    } else if(event.key === 'c'){
      chooseRandomPalette();
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

  // Randomly choose noise type
  CONFIG.noiseType = Math.random() < 0.5 ? '2D' : '3D';
  if (window.guiControllers.noiseType) {
      window.guiControllers.noiseType.setValue(CONFIG.noiseType);
  }
  
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
  //ratio vs. max value can be -30% to +40% vs. the value of the particleSpeed
  let speedRatio = CONFIG['particleSpeed'].value / CONFIG['particleSpeed'].max;
  let ratioAdjustment = (Math.random()*0.7 - 0.3);
  let attractionStrengthValue = CONFIG['attractionStrength'].max * Math.min(speedRatio+ratioAdjustment,1);
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

// Calculate dimensions that are divisible by 4 while maintaining aspect ratio
function calculateDivisibleDimensions(width, height, maxSize) {
  // Calculate initial scale to fit within maxSize
  const scale = Math.min(maxSize / width, maxSize / height);
  
  // Get initial scaled dimensions
  let scaledWidth = Math.round(width * scale);
  let scaledHeight = Math.round(height * scale);
  
  // Ensure dimensions are divisible by 4
  scaledWidth = Math.floor(scaledWidth / 4) * 4;
  scaledHeight = Math.floor(scaledHeight / 4) * 4;
  
  // Recalculate to maintain aspect ratio while ensuring both dimensions are divisible by 4
  const aspectRatio = width / height;
  
  if (scaledWidth / scaledHeight > aspectRatio) {
      // Height is the limiting factor
      scaledHeight = Math.floor(scaledHeight / 4) * 4;
      scaledWidth = Math.floor(scaledHeight * aspectRatio / 4) * 4;
  } else {
      // Width is the limiting factor
      scaledWidth = Math.floor(scaledWidth / 4) * 4;
      scaledHeight = Math.floor(scaledWidth / aspectRatio / 4) * 4;
  }
  
  // Ensure we don't exceed maxSize
  while (scaledWidth > maxSize || scaledHeight > maxSize) {
      if (scaledWidth > maxSize) {
          scaledWidth -= 4;
          scaledHeight = Math.floor(scaledWidth / aspectRatio / 4) * 4;
      }
      if (scaledHeight > maxSize) {
          scaledHeight -= 4;
          scaledWidth = Math.floor(scaledHeight * aspectRatio / 4) * 4;
      }
  }
  
  return { width: scaledWidth, height: scaledHeight };
}

// Modified resizeCanvasToImage function
function resizeCanvasToImage(image) {
  console.log("Original image size: "+image.width+", "+image.height);
  const maxSize = Math.min(window.innerWidth, window.innerHeight) - 40;
  const dimensions = calculateDivisibleDimensions(image.width, image.height, maxSize);
  
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  glState.setViewport(0, 0, canvas.width, canvas.height);
  
  console.log("New image size: "+dimensions.width+", "+dimensions.height);
  return dimensions;
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
  canvas.style.backgroundColor = CONFIG['backgroundColor'].valueOf;

  // Always set alpha to 1.0 for full coverage
  const [r, g, b] = WebGLUtils.hexToRGB(CONFIG.backgroundColor);
  glState.setClearColor(r, g, b, 1.0);
  
  // Force an immediate clear to update the background
  glState.clear();
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
  drawScene(currentTime);
  if (isAnimating && CONFIG.IS_PLAYING) {
    animationFrameId = requestAnimationFrame(animate);
  }
}

function drawScene(currentTime){
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
  }catch (error) {
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
      //const response = await fetch('https://github.com/collidingScopes/particleDissolve/assets/face.webp');
      //const blob = await response.blob();
      const defaultImg = document.querySelector("#defaultImage");
      currentImage = defaultImg;
      resizeCanvasToImage(defaultImg);
      await safeRestartAnimation();
  } catch (error) {
      console.error('Error loading default image:', error);
  }
}

// Initialize the application
window.addEventListener('load', async () => {
  await initWebGL();
  
  setTimeout(() => {
    loadDefaultImage();
  }, 1000);

});