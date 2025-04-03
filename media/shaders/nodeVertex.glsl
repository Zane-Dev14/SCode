uniform float time;
uniform float size;
uniform float selected;
attribute float aScale;
attribute vec3 customColor;
attribute vec3 aInitPosition;
attribute float aType;
attribute float importance;

varying vec3 vColor;
varying float vDiscard;
varying float vSelected;
varying vec2 vUv;
varying float vProgress;
varying float vImportance;
varying float vType;

void main() {
    // Calculate vertex UV coordinates 
    vUv = uv;
    
    // Pass color to fragment shader
    vColor = customColor;
    
    // Pass other attributes to fragment shader
    vSelected = selected;
    vImportance = importance;
    vType = aType;
    
    // Calculate position with subtle animation
    vec3 pos = position;
    
    // Add subtle breathing animation based on time
    float breathe = sin(time * 0.5) * 0.03 + 1.0;
    
    // Scale by attribute and uniform size
    float scale = aScale * size * breathe;
    
    // Calculate vertex position
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Calculate particle progress based on time
    vProgress = fract(time * 0.1 + importance * 0.2);
    
    // Apply the point size based on scale and distance
    gl_PointSize = scale * (1.0 / -mvPosition.z);
    
    // Output position
    gl_Position = projectionMatrix * mvPosition;
} 