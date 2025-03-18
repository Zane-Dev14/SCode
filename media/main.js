// main.js
document.addEventListener('DOMContentLoaded', () => {
    // Initialize tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // Deactivate all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activate the selected tab
            button.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            
            // If visualization tab is selected, initialize or resize the visualization
            if (tabName === 'visualization' && astData) {
                if (!window.visualization) {
                    initVisualization();
                } else {
                    window.visualization.resize();
                }
            }
        });
    });
    
    // Add event listeners for file links
    const fileLinks = document.querySelectorAll('.file-link');
    fileLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const file = link.getAttribute('data-file');
            vscode.postMessage({
                command: 'openFile',
                file: file,
                line: 0 // Default to line 0
            });
        });
    });
    
    // Initialize visualization if we have AST data
    if (astData) {
        initVisualization();
    }
});

function initVisualization() {
    // Get the container element
    const container = document.getElementById('3d-container');
    
    // Create a scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // Create a camera
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 15;
    
    // Create a renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    
    // Add orbit controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    
    // Create a graph layout
    const graph = createGraph(astData);
    
    // Add the graph to the scene
    scene.add(graph);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
    
    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    
    animate();
    
    // Store the visualization components
    window.visualization = {
        scene: scene,
        camera: camera,
        renderer: renderer,
        controls: controls,
        resize: () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    };
}

function createGraph(astData) {
    // Create a group to hold all the graph elements
    const graphGroup = new THREE.Group();
    
    // Create a simple force-directed layout
    const nodes = [];
    const links = [];
    
    // Process the AST data
    const files = Object.keys(astData);
    
    // Create nodes for each file
    files.forEach((file, index) => {
        const node = {
            id: file,
            type: 'file',
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 10,
            z: (Math.random() - 0.5) * 10
        };
        nodes.push(node);
    });
    
    // Create file nodes
    nodes.forEach(node => {
        let mesh;
        
        if (node.type === 'file') {
            // Create a sphere for files
            const geometry = new THREE.SphereGeometry(0.5, 32, 32);
            const material = new THREE.MeshPhongMaterial({ color: 0x3366ff });
            mesh = new THREE.Mesh(geometry, material);
        } else {
            // Default node type
            const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
            const material = new THREE.MeshPhongMaterial({ color: 0xffa500 });
            mesh = new THREE.Mesh(geometry, material);
        }
        
        mesh.position.set(node.x, node.y, node.z);
        mesh.userData = { id: node.id, type: node.type };
        graphGroup.add(mesh);
        
        // Add text label
        const fileName = node.id.split('/').pop();
        const textSprite = createTextSprite(fileName);
        textSprite.position.set(node.x, node.y - 0.7, node.z);
        graphGroup.add(textSprite);
    });
    
    // Create links between nodes if there are relationships
    links.forEach(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        
        if (sourceNode && targetNode) {
            const points = [
                new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
                new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
            ];
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: 0x999999 });
            const line = new THREE.Line(geometry, material);
            graphGroup.add(line);
        }
    });
    
    return graphGroup;
}

function createTextSprite(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    context.font = '24px Arial';
    context.fillStyle = 'rgba(0, 0, 0, 1.0)';
    context.fillText(text, 0, 48);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);
    
    return sprite;
}