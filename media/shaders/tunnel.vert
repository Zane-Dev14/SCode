uniform float time;
uniform float progress;
varying vec2 vUv;
varying float vDepth;

const float PI = 3.14159265359;

void main() {
    vUv = uv;
    vec3 pos = position;

    // Animate radius and twist over time/progress
    float radius = 1.5 + sin(uv.y * PI * 2.0 + time * 0.5) * 0.3;
    float angle = uv.x * PI * 2.0 + uv.y * 0.5 * sin(time * 0.3);
    
    pos.x = cos(angle) * radius;
    pos.z = sin(angle) * radius;
    pos.y = uv.y * -20.0; // Stretch along Y for tunnel length

    // Camera fly-through effect controlled by progress (0 to 1)
    float cameraZ = mix(10.0, -15.0, progress);
    
    vDepth = smoothstep(5.0, -10.0, pos.y + cameraZ); // Depth for fading

    vec4 mvPosition = modelViewMatrix * vec4(pos.x, pos.y + cameraZ, pos.z, 1.0);
    gl_Position = projectionMatrix * mvPosition;
} 