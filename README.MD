# Particular Drift

Turn images into flowing particle animations! This javascript / WebGL tool creates particle animations from any image, with particles that dynamically respond to edge detection and flow fields.

<img src="/assets/example.gif">

## Live Demo

Try it out at: [https://collidingscopes.github.io/particular-drift/](https://collidingscopes.github.io/particular-drift/)

## Features

- Upload any image and convert it to a dynamic particle animation
- Real-time parameter controls for customizing the animation
- Edge detection with dynamic particle attraction
- Perlin noise-based flow fields for organic movement
- Export animations as images or videos
- Fully client-side processing - no server uploads required
- MIT licensed and free for both personal and commercial use

## Technical Details

The animation combines several techniques:

- **Edge Detection** using Sobel filters
- **Perlin Noise** for generating organic flow fields
- **WebGL** for high-performance GPU-accelerated rendering
- **GLSL Shaders** for particle physics and rendering
- **Transform Feedback** for efficient particle system updates

## Parameters

Users can control various aspects of the animation:

- **Particle Speed**: Controls how fast particles move through the scene
- **Attraction Strength**: Determines how strongly particles are drawn to detected edges
- **Particle Opacity**: Sets the transparency of individual particles
- **Particle Size**: Adjusts the size of each particle
- **Particle Count**: Sets the total number of particles in the system
- **Edge Threshold**: Controls the sensitivity of edge detection
- **Color Palette**: Choose from preset color combinations or customize your own
- **Background Color**: Set the background color
- **Particle Color**: Set the color of the particles

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/collidingScopes/particular-drift.git
   ```

2. No build process is required - this is a pure frontend application. Simply serve the files using any web server. For example, using Python:
   ```bash
   python -m http.server
   ```
   Or using Node.js and a package like `serve`:
   ```bash
   npx serve
   ```

3. Open your browser and navigate to the local server address (typically `http://localhost:8000`)

## Keyboard Shortcuts

- `[r]`: Randomize all inputs
- `[space]`: Pause/play the animation
- `[enter]`: Restart the animation
- `[v]`: Start and stop video export
- `[s]`: Save a screenshot image
- `[u]`: Upload new image

## Donations
If you found this tool useful, feel free to buy me a coffee. This would be much appreciated during late-night coding sessions!

<a href="https://www.buymeacoffee.com/stereoDrift" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/yellow_img.png" alt="Buy Me A Coffee"></a>

## Browser Requirements

- WebGL2 support
- Required WebGL extensions:
  - EXT_color_buffer_float
  - OES_texture_float_linear

## Performance Considerations

The animation is computationally intensive due to the large number of particles and real-time processing. Performance may vary based on:
- Your device's GPU capabilities
- Screen resolution
- Number of particles
- Size of the input image

If you experience lag:
- Reduce the particle count
- Close unnecessary browser tabs
- Ensure your device is not in power-saving mode
- Try a smaller input image

## Video Export

The tool uses the WebCodecs API and mp4-muxer for video export. If video export doesn't work in your browser:
- Try using Chrome or Edge, which have better support for the WebCodecs API
- Consider using an external screen recording tool like OBS Studio

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Other Projects

Check out my other free/open source projects:
- [Video-to-ASCII](https://collidingScopes.github.io/ascii): Turn videos into ASCII pixel art
- [Shape Shimmer](https://collidingScopes.github.io/shimmer): Turn photos into funky wave animations
- [Colliding Scopes](https://collidingScopes.github.io): Turn photos into kaleidoscope animations
- [Force-Field Animation](https://collidingScopes.github.io/forcefield): Turn photos into particle animations