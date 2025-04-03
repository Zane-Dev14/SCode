uniform float time;
attribute float strength;
varying vec3 vPosition;
varying float vStrength;

void main() {
    vPosition = position;
    vStrength = strength;
    
    // Calculate position with time-based animation
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    // Apply a subtle wave effect to edges
    float wave = sin(position.x * 5.0 + time) * 0.02 * strength;
    mvPosition.y += wave;
    
    gl_Position = projectionMatrix * mvPosition;
} 