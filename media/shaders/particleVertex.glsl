attribute vec3 position;
attribute vec3 velocity;
attribute float size;
attribute float life;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float time;

varying float vLife;
varying float vSize;

void main() {
    vLife = life;
    vSize = size;
    
    // Update position based on velocity
    vec3 pos = position + velocity * time;
    
    // Add some noise-based movement
    float noise = sin(time * 2.0 + position.x * 10.0) * 0.1;
    pos += vec3(noise, noise, 0.0);
    
    // Calculate final position
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Set point size
    gl_PointSize = size * (1.0 - life);
} 