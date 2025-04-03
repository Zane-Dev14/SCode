uniform float time;
attribute float size;
attribute float speed;
attribute vec3 customColor;
attribute vec3 destination;
varying vec3 vColor;
varying float vProgress;

void main() {
    vec3 pos = position;
    vColor = customColor;
    
    // Calculate progress for particles flowing to destinations
    float progress = fract(time * speed * 0.1);
    vProgress = progress;
    
    // Interpolate position between start and destination
    if (length(destination) > 0.0) {
        pos = mix(position, destination, progress);
        
        // Add some oscillation for a more dynamic effect
        float oscillation = sin(time * 5.0 + position.x * 10.0) * 0.1;
        pos.y += oscillation * (1.0 - progress) * progress * 4.0; // Max at progress = 0.5
    } else {
        // For particles without a destination, add some movement
        pos.x += sin(time * speed + position.y * 2.0) * 0.05;
        pos.y += cos(time * speed + position.x * 2.0) * 0.05;
        pos.z += sin(time * speed * 0.7 + position.z * 2.0) * 0.05;
    }
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = size * (10.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
} 