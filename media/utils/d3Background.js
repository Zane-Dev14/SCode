import * as d3 from 'd3';

export function initD3Background(container) {
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0)
        .style('width', '100%')
        .style('height', '100%')
        .style('pointer-events', 'none')
        .style('z-index', 0);

    // Create background group
    const g = svg.append('g');

    // Create nodes
    const nodeCount = 50;
    const nodes = d3.range(nodeCount).map(() => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1
    }));

    // Create circles
    const circles = g.selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', d => d.radius)
        .attr('fill', '#4a9eff')
        .attr('opacity', 0.3);

    // Update function
    function update() {
        nodes.forEach(node => {
            // Update position
            node.x += node.vx;
            node.y += node.vy;

            // Bounce off edges
            if (node.x < 0 || node.x > window.innerWidth) node.vx *= -1;
            if (node.y < 0 || node.y > window.innerHeight) node.vy *= -1;

            // Keep in bounds
            node.x = Math.max(0, Math.min(window.innerWidth, node.x));
            node.y = Math.max(0, Math.min(window.innerHeight, node.y));
        });

        // Update circles
        circles
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    }

    // Handle resize
    window.addEventListener('resize', () => {
        svg
            .attr('width', window.innerWidth)
            .attr('height', window.innerHeight);
    });

    // Cleanup function
    function cleanup() {
        svg.remove();
    }

    return {
        update,
        cleanup
    };
} 