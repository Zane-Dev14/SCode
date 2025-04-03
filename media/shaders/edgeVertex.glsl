attribute vec3 position;
attribute vec3 target;
attribute float progress;
attribute float thickness;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float time;
uniform float selectedEdge;

varying float vProgress;
varying float vThickness;
varying float vSelected;

void main() {
    vProgress = progress;
    vThickness = thickness;
    vSelected = selectedEdge;
    
    // Calculate position along the edge
    vec3 pos = mix(position, target, progress);
    
    // Add some wave motion
    float wave = sin(time * 2.0 + progress * 10.0) * 0.1;
    pos += vec3(wave, wave, 0.0);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
} 