import * as THREE from 'three';
import { initShaderBackground } from './shaders';
import { initParticleSystem } from './particles';
import { initD3Background } from './d3Background';
import * as d3 from 'd3';

export function initCodeVisualizer(root, analysisData, selectedEntrypoint) {
    // Create container
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    root.appendChild(container);

    // Initialize background effects
    const { scene, camera, renderer, animate: animateShader } = initShaderBackground(container);
    const particles = initParticleSystem(scene);
    const d3Background = initD3Background(container);

    // Create D3 container
    const d3Container = document.createElement('div');
    d3Container.style.width = '100%';
    d3Container.style.height = '100%';
    d3Container.style.position = 'absolute';
    d3Container.style.zIndex = '1';
    container.appendChild(d3Container);

    // Create SVG
    const svg = d3.select(d3Container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%');

    // Create zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoom);

    // Create main group
    const g = svg.append('g');

    // Create graph data
    const nodes = analysisData.nodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        x: Math.random() * 1000,
        y: Math.random() * 1000
    }));

    const links = analysisData.links.map(link => ({
        source: link.source,
        target: link.target,
        type: link.type
    }));

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .force('collision', d3.forceCollide().radius(50));

    // Create links
    const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', d => Math.sqrt(d.value));

    // Create nodes
    const node = g.append('g')
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', 5)
        .attr('fill', d => {
            switch(d.type) {
                case 'function': return '#4a9eff';
                case 'class': return '#ff4a4a';
                case 'module': return '#4aff4a';
                default: return '#999';
            }
        })
        .call(drag(simulation));

    // Add labels
    const label = g.append('g')
        .selectAll('text')
        .data(nodes)
        .join('text')
        .text(d => d.name)
        .attr('font-size', 12)
        .attr('dx', 12)
        .attr('dy', 4)
        .attr('fill', 'white');

    // Update positions
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

    // Drag behavior
    function drag(simulation) {
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

        return d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
    }

    // Animation loop
    function animateLoop() {
        requestAnimationFrame(animateLoop);
        particles.update();
        renderer.render(scene, camera);
        d3Background.update();
    }
    animateLoop();

    // Handle window resize
    window.addEventListener('resize', () => {
        simulation.force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2));
    });

    // Return cleanup function
    const cleanup = () => {
        simulation.stop();
        renderer.dispose();
        d3Background.cleanup();
        svg.remove(); // Remove D3 SVG element
        cancelAnimationFrame(animationFrameId); // Assuming animateLoop sets an ID
        window.removeEventListener('resize', resizeHandler); // Assuming resize event listener exists
        // Remove other listeners if added
    };
    
    return { cleanup }; // Return cleanup function
} 