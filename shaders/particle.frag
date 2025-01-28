#version 300 es
precision highp float;

in vec2 vPosition;
uniform vec3 uParticleColor;
uniform float uParticleOpacity;

out vec4 fragColor;

void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    fragColor = vec4(uParticleColor, uParticleOpacity);
}