#version 300 es
precision highp float;

in vec2 vTexCoord;
uniform sampler2D uImage;
uniform vec2 uResolution;
uniform float threshold;
out vec4 fragColor;

void main() {
    vec2 texel = 1.0 / uResolution;
    vec2 tc = vTexCoord;
    
    vec3 tl = texture(uImage, tc + texel * vec2(-1, -1)).rgb;
    vec3 t  = texture(uImage, tc + texel * vec2( 0, -1)).rgb;
    vec3 tr = texture(uImage, tc + texel * vec2( 1, -1)).rgb;
    vec3 l  = texture(uImage, tc + texel * vec2(-1,  0)).rgb;
    vec3 c  = texture(uImage, tc).rgb;
    vec3 r  = texture(uImage, tc + texel * vec2( 1,  0)).rgb;
    vec3 bl = texture(uImage, tc + texel * vec2(-1,  1)).rgb;
    vec3 b  = texture(uImage, tc + texel * vec2( 0,  1)).rgb;
    vec3 br = texture(uImage, tc + texel * vec2( 1,  1)).rgb;

    vec3 gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
    vec3 gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
    
    float edge = length(gx) + length(gy);
    edge = edge > threshold ? 1.0 : 0.0;
    
    fragColor = vec4(edge, edge, edge, 1.0);
}