#version 300 es
in vec2 aPosition;
out vec2 vTexCoord;

void main() {
    vTexCoord = vec2(aPosition.x * 0.5 + 0.5, (aPosition.y * 0.5 + 0.5));
    gl_Position = vec4(aPosition, 0.0, 1.0);
}