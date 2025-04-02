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

// Shaders
const glowVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const glowFragmentShader = `
    uniform float time;
    uniform vec3 glowColor;
    varying vec2 vUv;
    
    void main() {
        float strength = sin(time) * 0.5 + 0.5;
        vec3 color = glowColor * strength;
        gl_FragColor = vec4(color, 1.0);
    }
`;

// Main App Component
const App = () => {
    const [currentView, setCurrentView] = React.useState('ast');
    const [loading, setLoading] = React.useState(true);
    const [selectedNode, setSelectedNode] = React.useState(null);

    React.useEffect(() => {
        // Initialize GSAP animations
        gsap.from('.loading-screen', {
            opacity: 1,
            duration: 1,
            delay: 2,
            onComplete: () => setLoading(false)
        });

        // Initialize Three.js scene
        initScene();
    }, []);

    const initScene = () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('canvas-container').appendChild(renderer.domElement);

        // Add post-processing effects
        const composer = new THREE.EffectComposer(renderer);
        const renderPass = new THREE.RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, 0.4, 0.85
        );
        composer.addPass(bloomPass);

        // Add ambient particles
        const particleGeometry = new THREE.BufferGeometry();
        const particleCount = 1000;
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 100;
            positions[i + 1] = (Math.random() - 0.5) * 100;
            positions[i + 2] = (Math.random() - 0.5) * 100;
        }
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.5
        });
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);

        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // Position camera
        camera.position.z = 50;

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            particles.rotation.x += 0.001;
            particles.rotation.y += 0.001;
            composer.render();
        }
        animate();

        // Handle window resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        });
    };

    const renderASTVisualization = () => {
        if (!astData) return null;

        const graph = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(0, 0));

        // Create nodes
        const nodes = astData.functions.map(func => ({
            id: func.id,
            name: func.name,
            type: 'function',
            x: func.x || 0,
            y: func.y || 0,
            z: func.z || 0
        }));

        // Create links
        const links = astData.dataflow.map(flow => ({
            source: flow.source,
            target: flow.target,
            value: flow.value
        }));

        graph.nodes(nodes);
        graph.links(links);

        // Render nodes and links using Three.js
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });

        // Create node meshes
        nodes.forEach(node => {
            const geometry = new THREE.SphereGeometry(1, 32, 32);
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    glowColor: { value: new THREE.Color(0x00ff00) }
                },
                vertexShader: glowVertexShader,
                fragmentShader: glowFragmentShader,
                transparent: true
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(node.x, node.y, node.z);
            scene.add(mesh);
        });

        // Create link lines
        links.forEach(link => {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array([
                link.source.x, link.source.y, link.source.z,
                link.target.x, link.target.y, link.target.z
            ]);
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            const line = new THREE.Line(geometry, material);
            scene.add(line);
        });

        // Add particle effects for data flow
        const particleSystem = new THREE.Points(
            new THREE.BufferGeometry(),
            new THREE.PointsMaterial({
                color: 0x00ff00,
                size: 0.1,
                transparent: true,
                opacity: 0.5
            })
        );
        scene.add(particleSystem);

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            nodes.forEach(node => {
                const mesh = scene.children.find(child => child.userData.id === node.id);
                if (mesh) {
                    mesh.position.set(node.x, node.y, node.z);
                }
            });
            renderer.render(scene, camera);
        }
        animate();
    };

    const renderModuleView = () => {
        // Module visualization with force-directed graph
        const width = window.innerWidth;
        const height = window.innerHeight;
        const svg = d3.select('#canvas-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(width / 2, height / 2));

        // Create nodes and links
        const nodes = analysisData.modules.map(module => ({
            id: module,
            type: 'module'
        }));

        const links = analysisData.dataflow
            .filter(flow => flow.type === 'module')
            .map(flow => ({
                source: flow.source,
                target: flow.target
            }));

        simulation.nodes(nodes);
        simulation.links(links);

        // Create links
        const link = svg.append('g')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);

        // Create nodes
        const node = svg.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter()
            .append('circle')
            .attr('r', 5)
            .attr('fill', '#69b3a2')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Add labels
        const label = svg.append('g')
            .selectAll('text')
            .data(nodes)
            .enter()
            .append('text')
            .text(d => d.id)
            .attr('font-size', 12)
            .attr('fill', '#333');

        // Update positions on each tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        // Drag functions
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
    };

    const renderVulnerabilityView = () => {
        const container = document.getElementById('canvas-container');
        container.innerHTML = `
            <div class="vulnerability-list">
                ${analysisData.vulnerabilities?.map(vuln => `
                    <div class="vulnerability-card ${vuln.severity}">
                        <div class="vulnerability-header">
                            <h3>${vuln.vulnerability}</h3>
                            <span class="severity-badge">${vuln.severity}</span>
                        </div>
                        <div class="vulnerability-content">
                            <p>${vuln.description}</p>
                            <div class="file-info">
                                <span class="file-path">${vuln.file}</span>
                                <span class="line-number">Line ${vuln.line}</span>
                            </div>
                        </div>
                    </div>
                `).join('') || '<div class="no-vulnerabilities">No vulnerabilities found</div>'}
            </div>
        `;
    };

    // Render current view
    React.useEffect(() => {
        const container = document.getElementById('canvas-container');
        container.innerHTML = '';
        
        switch (currentView) {
            case 'ast':
                renderASTVisualization();
                break;
            case 'modules':
                renderModuleView();
                break;
            case 'vulnerabilities':
                renderVulnerabilityView();
                break;
        }
    }, [currentView]);

    return (
        <div className="app-container">
            {loading && (
                <div className="loading-screen">
                    <div className="loading-content">
                        <div className="loading-spinner"></div>
                        <div className="loading-text">Initializing Visualization...</div>
                    </div>
                </div>
            )}
            <div className="main-container">
                <div className="sidebar">
                    <div className="sidebar-header">
                        <h2>SCode Analyzer</h2>
                    </div>
                    <div className="sidebar-content">
                        <div className="view-selector">
                            <button 
                                className={`view-button ${currentView === 'ast' ? 'active' : ''}`}
                                onClick={() => setCurrentView('ast')}
                            >
                                AST Visualization
                            </button>
                            <button 
                                className={`view-button ${currentView === 'modules' ? 'active' : ''}`}
                                onClick={() => setCurrentView('modules')}
                            >
                                Modules
                            </button>
                            <button 
                                className={`view-button ${currentView === 'vulnerabilities' ? 'active' : ''}`}
                                onClick={() => setCurrentView('vulnerabilities')}
                            >
                                Vulnerabilities
                            </button>
                        </div>
                        <div className="stats-panel">
                            <div className="stat-item">
                                <span className="stat-label">Functions</span>
                                <span className="stat-value">{analysisData.functions?.length || 0}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Modules</span>
                                <span className="stat-value">{analysisData.modules?.length || 0}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Vulnerabilities</span>
                                <span className="stat-value">{analysisData.vulnerabilities?.length || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="visualization-container">
                    <div id="canvas-container"></div>
                </div>
            </div>
        </div>
    );
};

// Render the app
ReactDOM.render(<App />, document.getElementById('root'));