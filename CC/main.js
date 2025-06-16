let nextId = 1;
function generateId() {
    return 'id_' + (nextId++);
}

class Camera {
    constructor() {
        this.x = 0;
        this.y = -300; // Offset to show sine generator (at y=-450) near bottom of 600px canvas
        this.zoom = 1;
    }
    
    screenToWorld(screenX, screenY, canvas) {
        const x = (screenX - canvas.width / 2) / this.zoom + this.x;
        const y = (screenY - canvas.height / 2) / this.zoom + this.y;
        return { x, y };
    }
    
    worldToScreen(worldX, worldY, canvas) {
        const x = (worldX - this.x) * this.zoom + canvas.width / 2;
        const y = (worldY - this.y) * this.zoom + canvas.height / 2;
        return { x, y };
    }
    
    pan(dx, dy) {
        this.x += dx / this.zoom;
        this.y += dy / this.zoom;
    }
    
    zoomAt(factor, screenX, screenY, canvas) {
        const worldPos = this.screenToWorld(screenX, screenY, canvas);
        this.zoom *= factor;
        this.zoom = Math.max(0.1, Math.min(5, this.zoom));
        const newWorldPos = this.screenToWorld(screenX, screenY, canvas);
        this.x += worldPos.x - newWorldPos.x;
        this.y += worldPos.y - newWorldPos.y;
    }
}

class PhysicsBlock {
    constructor(x, y, windowWidth, windowHeight, type = 'basic') {
        this.windowX = x;
        this.windowY = y;
        this.windowWidth = windowWidth;
        this.windowHeight = windowHeight;
        
        this.x = windowWidth / 2;
        this.y = windowHeight - 40;
        this.type = type;
        this.velocity = { x: 0, y: 0 };
        this.acceleration = { x: 0, y: 0 };
        this.mass = 0.1;
        this.friction = 0.1;
        this.size = 15;
        this.force = { x: 0, y: 0 };
        this.groundY = windowHeight - 40;
        
        if (type === 'springMassDamper') {
            this.restPosition = windowWidth / 2;
            this.springConstant = 50; // N/m - reduced for Euler stability
            this.dampingCoeff = 10; // N⋅s/m - increased damping for stability
            this.springAttachX = 30;
        }
    }
    
    update(dt, windowX, windowY) {
        this.windowX = windowX;
        this.windowY = windowY;
        
        if (this.type === 'springMassDamper') {
            const displacement = this.x - this.restPosition;
            const springForce = -this.springConstant * displacement;
            const dampingForce = -this.dampingCoeff * this.velocity.x;
            
            const totalForce = this.force.x + springForce + dampingForce;
            this.acceleration.x = totalForce / this.mass;
            this.acceleration.y = 0;
            
            this.velocity.x += this.acceleration.x * dt;
            this.velocity.y = 0;
            
            this.x += this.velocity.x * dt;
            this.y = this.groundY - this.size / 2;
            
            const margin = this.size / 2;
            if (this.x - margin <= this.springAttachX) {
                this.x = this.springAttachX + margin;
                this.velocity.x = 0;
            }
            if (this.x + margin >= this.windowWidth) {
                this.x = this.windowWidth - margin;
                this.velocity.x = 0;
            }
        } else {
            this.acceleration.x = this.force.x / this.mass;
            this.acceleration.y = 0;
            
            this.velocity.x += this.acceleration.x * dt;
            this.velocity.y = 0;
            
            this.velocity.x *= (1 - this.friction * dt);
            
            this.x += this.velocity.x * dt;
            this.y = this.groundY - this.size / 2;
            
            const margin = this.size / 2;
            if (this.x - margin <= 0) {
                this.x = margin;
                this.velocity.x = 0;
            }
            if (this.x + margin >= this.windowWidth) {
                this.x = this.windowWidth - margin;
                this.velocity.x = 0;
            }
        }
        
        this.force.x = 0;
        this.force.y = 0;
    }
    
    draw(ctx, camera, canvas) {
        const windowTopLeft = camera.worldToScreen(this.windowX, this.windowY, canvas);
        const localX = windowTopLeft.x + this.x * camera.zoom;
        const localY = windowTopLeft.y + this.y * camera.zoom;
        const size = this.size * camera.zoom;
        
        ctx.strokeStyle = '#0f0';
        ctx.fillStyle = '#004400';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0f0';
        
        // Draw spring for spring-mass-damper system
        if (this.type === 'springMassDamper') {
            const springStartX = windowTopLeft.x + this.springAttachX * camera.zoom;
            const springStartY = localY;
            const springEndX = localX - size/2;
            const springEndY = localY;
            
            // Draw spring attachment point
            ctx.fillStyle = '#0f0';
            ctx.fillRect(springStartX - 3 * camera.zoom, springStartY - 15 * camera.zoom, 6 * camera.zoom, 30 * camera.zoom);
            
            // Draw spring coils (bottom)
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(springStartX, springStartY);
            
            const springLength = springEndX - springStartX;
            const coils = 8;
            const amplitude = 6 * camera.zoom;
            
            for (let i = 0; i <= coils * 4; i++) {
                const t = i / (coils * 4);
                const x = springStartX + t * springLength;
                const y = springStartY + Math.sin(i * Math.PI / 2) * amplitude;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(springEndX, springEndY);
            ctx.stroke();
            
            // Draw damper (above spring)
            const damperStartX = springStartX;
            const damperEndX = localX - size/2;
            const damperY = springStartY - 12 * camera.zoom;
            const damperHeight = 8 * camera.zoom;
            const damperWidth = 16 * camera.zoom;
            
            // Damper cylinder (fixed part)
            const cylinderX = damperStartX + springLength * 0.3;
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 2;
            ctx.strokeRect(cylinderX - damperWidth/2, damperY - damperHeight/2, damperWidth, damperHeight);
            
            // Damper piston rod (moves with mass)
            ctx.beginPath();
            ctx.moveTo(damperStartX, damperY);
            ctx.lineTo(damperEndX, damperY);
            ctx.stroke();
            
            // Damper piston (inside cylinder, moves with mass)
            const pistonX = Math.min(cylinderX + damperWidth/2 - 2 * camera.zoom, 
                                   Math.max(cylinderX - damperWidth/2 + 2 * camera.zoom, damperEndX - 2 * camera.zoom));
            ctx.fillStyle = '#0f0';
            ctx.fillRect(pistonX, damperY - damperHeight/2 + 1 * camera.zoom, 
                        2 * camera.zoom, damperHeight - 2 * camera.zoom);
        }
        
        // Draw mass
        ctx.fillStyle = '#004400';
        ctx.fillRect(localX - size/2, localY - size/2, size, size);
        ctx.strokeRect(localX - size/2, localY - size/2, size, size);
        
        // Draw ground line
        const groundY = windowTopLeft.y + this.groundY * camera.zoom;
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(windowTopLeft.x, groundY);
        ctx.lineTo(windowTopLeft.x + this.windowWidth * camera.zoom, groundY);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
    }
    
    applyForce(fx) {
        this.force.x += fx;
    }
}

class Port {
    constructor(x, y, type, id = null) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.id = id || generateId();
        this.value = 0;
        this.connections = [];
    }
    
    draw(ctx, camera, canvas, colors) {
        const screen = camera.worldToScreen(this.x, this.y, canvas);
        const radius = 8 * camera.zoom;
        
        const themeColors = colors || { primary: '#0f0' };
        ctx.strokeStyle = themeColors.primary;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 5;
        ctx.shadowColor = themeColors.primary;
        
        if (this.type === 'input') {
            ctx.fillStyle = themeColors.primary;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
    }
    
    contains(x, y, camera, canvas) {
        const screen = camera.worldToScreen(this.x, this.y, canvas);
        const radius = 8 * camera.zoom;
        const dx = x - screen.x;
        const dy = y - screen.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
    }
}

class Connector {
    constructor(startPort, endPort) {
        this.startPort = startPort;
        this.endPort = endPort;
        this.nodes = [];
        this.id = generateId();
    }
    
    addNode(x, y) {
        this.nodes.push({ x, y });
    }
    
    draw(ctx, camera, canvas, colors) {
        const themeColors = colors || { primary: '#0f0' };
        
        ctx.strokeStyle = themeColors.primary;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 5;
        ctx.shadowColor = themeColors.primary;
        
        ctx.beginPath();
        let start = camera.worldToScreen(this.startPort.x, this.startPort.y, canvas);
        ctx.moveTo(start.x, start.y);
        
        for (let node of this.nodes) {
            let nodeScreen = camera.worldToScreen(node.x, node.y, canvas);
            ctx.lineTo(nodeScreen.x, nodeScreen.y);
        }
        
        let end = camera.worldToScreen(this.endPort.x, this.endPort.y, canvas);
        ctx.lineTo(end.x, end.y);
        
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        for (let node of this.nodes) {
            let nodeScreen = camera.worldToScreen(node.x, node.y, canvas);
            ctx.fillStyle = themeColors.primary;
            ctx.beginPath();
            ctx.arc(nodeScreen.x, nodeScreen.y, 4 * camera.zoom, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class BlockWindow {
    constructor(x, y, width, height, title, type) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.title = title;
        this.type = type;
        this.id = generateId();
        this.focused = false;
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.ports = [];
        this.value = 0;
        this.min = 0;
        this.max = 100;
        this.step = 1;
        this.physics = null;
        this.editing = false;
        this.editText = '';
        this.editCursor = 0;
        
        if (type === 'graph') {
            this.graphData1 = [];
            this.graphData2 = [];
            this.maxDataPoints = 200;
            this.timeStep = 0;
            // Y-axis limits
            this.leftYMin = -100;
            this.leftYMax = 100;
            this.rightYMin = -20;
            this.rightYMax = 20;
            this.editingYLimits = false;
            this.editingField = null; // 'leftMin', 'leftMax', 'rightMin', 'rightMax'
        } else if (type === 'gain') {
            this.value = 1.0; // Default gain value
        } else if (type === 'offset') {
            this.value = 0.0; // Default offset value
        } else if (type === 'sineGen') {
            this.amplitude = 1.0;
            this.frequency = 1.0;
            this.phase = 0.0; // Phase in radians
            this.accumulatedPhase = 0; // Accumulated phase for smooth frequency changes
            this.lastOutput = 0;
        } else if (type === 'sineAnalyser') {
            this.topFrequency = 0;
            this.topAmplitude = 0;
            this.bottomFrequency = 0;
            this.bottomAmplitude = 0;
            this.phaseDifference = 0;
            this.sampleHistory1 = [];
            this.sampleHistory2 = [];
            this.maxSamples = 150; // Reduced for faster response to frequency changes
            this.minSamplesForAnalysis = 20; // Reduced minimum samples for quicker analysis
        } else if (type === 'springMassDamper') {
            this.editingSpringParams = false;
            this.editingSpringField = null; // 'mass', 'springConstant', 'dampingCoeff'
        } else if (type === 'clock') {
            this.interval = 1.0; // seconds between pulses
            this.timer = 0; // internal timer
            this.pulseOutput = 0; // current pulse state (0 or 1)
            this.pulseDuration = 0.05; // pulse width in seconds (50ms)
            this.pulseTimer = 0; // timer for pulse duration
        } else if (type === 'counter') {
            this.count = 0;
            this.startValue = 0;
            this.stopValue = 10;
            this.stepSize = 1;
            this.lastInput = 0; // for edge detection on pulse input
            this.lastResetInput = 0; // for edge detection on reset input
            this.editingCounterParams = false;
            this.editingCounterField = null; // 'startValue', 'stopValue', 'stepSize'
        } else if (type === 'selector') {
            this.selectedInput = 0; // 0 = top input, 1 = bottom input
        } else if (type === 'xyPlot') {
            this.plotData = []; // Array of {x, y} points
            this.lastClkInput = 0; // For edge detection
            this.lastClearInput = 0; // For edge detection
            this.xMin = -10; this.xMax = 10;
            this.yMin = -10; this.yMax = 10;
            this.xLogScale = false; this.yLogScale = false;
            this.editingXYLimits = false;
            this.editingXYField = null; // 'xMin', 'xMax', 'yMin', 'yMax'
        }
        
        this.setupPorts();
        if (type.startsWith('physics') || type === 'springMassDamper') {
            this.physics = new PhysicsBlock(x, y, width, height, type);
        }
    }
    
    setupPorts() {
        switch (this.type) {
            case 'inputNumber':
            case 'inputSlider':
                this.ports.push(new Port(this.x + this.width, this.y + this.height/2, 'output'));
                break;
            case 'outputNumber':
                this.ports.push(new Port(this.x, this.y + this.height/2, 'input'));
                break;
            case 'multiply':
                this.ports.push(new Port(this.x, this.y + this.height/3, 'input'));
                this.ports.push(new Port(this.x, this.y + 2*this.height/3, 'input'));
                this.ports.push(new Port(this.x + this.width, this.y + this.height/2, 'output'));
                break;
            case 'divide':
                this.ports.push(new Port(this.x, this.y + this.height/3, 'input'));
                this.ports.push(new Port(this.x, this.y + 2*this.height/3, 'input'));
                this.ports.push(new Port(this.x + this.width, this.y + this.height/2, 'output'));
                break;
            case '20log10':
            case '10log10':
            case 'deg2rad':
            case 'rad2deg':
                this.ports.push(new Port(this.x, this.y + this.height/2, 'input'));
                this.ports.push(new Port(this.x + this.width, this.y + this.height/2, 'output'));
                break;
            case 'gain':
                this.ports.push(new Port(this.x, this.y + this.height/2, 'input'));
                this.ports.push(new Port(this.x + this.width, this.y + this.height/2, 'output'));
                break;
            case 'offset':
                this.ports.push(new Port(this.x, this.y + this.height/2, 'input'));
                this.ports.push(new Port(this.x + this.width, this.y + this.height/2, 'output'));
                break;
            case 'sineGen':
                this.ports.push(new Port(this.x, this.y + this.height/4, 'input')); // Amplitude input
                this.ports.push(new Port(this.x, this.y + this.height/2, 'input')); // Frequency input
                this.ports.push(new Port(this.x, this.y + 3*this.height/4, 'input')); // Phase input
                this.ports.push(new Port(this.x + this.width, this.y + this.height/2, 'output'));
                break;
            case 'physicsBasic':
                this.ports.push(new Port(this.x, this.y + this.height/2, 'input'));
                this.ports.push(new Port(this.x + this.width, this.y + this.height/5, 'output'));
                this.ports.push(new Port(this.x + this.width, this.y + 2*this.height/5, 'output'));
                this.ports.push(new Port(this.x + this.width, this.y + 3*this.height/5, 'output'));
                break;
            case 'springMassDamper':
                this.ports.push(new Port(this.x, this.y + this.height/2, 'input'));
                this.ports.push(new Port(this.x + this.width, this.y + this.height/5, 'output'));
                this.ports.push(new Port(this.x + this.width, this.y + 2*this.height/5, 'output'));
                this.ports.push(new Port(this.x + this.width, this.y + 3*this.height/5, 'output'));
                break;
            case 'graph':
                this.ports.push(new Port(this.x, this.y + this.height/4, 'input'));
                this.ports.push(new Port(this.x, this.y + 3*this.height/4, 'input'));
                break;
            case 'sineAnalyser':
                // 2 inputs
                this.ports.push(new Port(this.x, this.y + this.height/3, 'input')); // Top sine input
                this.ports.push(new Port(this.x, this.y + 2*this.height/3, 'input')); // Bottom sine input
                // 5 outputs
                this.ports.push(new Port(this.x + this.width, this.y + this.height/6, 'output')); // Top frequency
                this.ports.push(new Port(this.x + this.width, this.y + 2*this.height/6, 'output')); // Top amplitude
                this.ports.push(new Port(this.x + this.width, this.y + 3*this.height/6, 'output')); // Bottom frequency
                this.ports.push(new Port(this.x + this.width, this.y + 4*this.height/6, 'output')); // Bottom amplitude
                this.ports.push(new Port(this.x + this.width, this.y + 5*this.height/6, 'output')); // Phase difference
                break;
            case 'clock':
                // 1 output for pulse
                this.ports.push(new Port(this.x + this.width, this.y + this.height/2, 'output'));
                break;
            case 'counter':
                // 2 inputs (pulse, reset), 1 output for count
                this.ports.push(new Port(this.x, this.y + this.height/3, 'input')); // Pulse input
                this.ports.push(new Port(this.x, this.y + 2*this.height/3, 'input')); // Reset input
                this.ports.push(new Port(this.x + this.width, this.y + this.height/2, 'output')); // Count output
                break;
            case 'selector':
                // 2 inputs, 1 output
                this.ports.push(new Port(this.x, this.y + this.height/3, 'input')); // Input A
                this.ports.push(new Port(this.x, this.y + 2*this.height/3, 'input')); // Input B
                this.ports.push(new Port(this.x + this.width, this.y + this.height/2, 'output')); // Selected output
                break;
            case 'xyPlot':
                // 4 inputs: x, y, clk, clear
                this.ports.push(new Port(this.x, this.y + this.height/5, 'input')); // X input
                this.ports.push(new Port(this.x, this.y + 2*this.height/5, 'input')); // Y input  
                this.ports.push(new Port(this.x, this.y + 3*this.height/5, 'input')); // Clock input
                this.ports.push(new Port(this.x, this.y + 4*this.height/5, 'input')); // Clear input
                break;
        }
        
        this.updatePortPositions();
    }
    
    updatePortPositions() {
        for (let i = 0; i < this.ports.length; i++) {
            let port = this.ports[i];
            switch (this.type) {
                case 'inputNumber':
                case 'inputSlider':
                    port.x = this.x + this.width;
                    port.y = this.y + this.height/2;
                    break;
                case 'outputNumber':
                    port.x = this.x;
                    port.y = this.y + this.height/2;
                    break;
                case 'multiply':
                    if (i === 0) {
                        port.x = this.x;
                        port.y = this.y + this.height/3;
                    } else if (i === 1) {
                        port.x = this.x;
                        port.y = this.y + 2*this.height/3;
                    } else {
                        port.x = this.x + this.width;
                        port.y = this.y + this.height/2;
                    }
                    break;
                case 'divide':
                    if (i === 0) {
                        port.x = this.x;
                        port.y = this.y + this.height/3;
                    } else if (i === 1) {
                        port.x = this.x;
                        port.y = this.y + 2*this.height/3;
                    } else {
                        port.x = this.x + this.width;
                        port.y = this.y + this.height/2;
                    }
                    break;
                case '20log10':
                case '10log10':
                case 'deg2rad':
                case 'rad2deg':
                    if (i === 0) {
                        port.x = this.x;
                        port.y = this.y + this.height/2;
                    } else {
                        port.x = this.x + this.width;
                        port.y = this.y + this.height/2;
                    }
                    break;
                case 'gain':
                case 'offset':
                case 'clock':
                    if (i === 0) {
                        port.x = this.x;
                        port.y = this.y + this.height/2;
                    } else {
                        port.x = this.x + this.width;
                        port.y = this.y + this.height/2;
                    }
                    break;
                case 'counter':
                case 'selector':
                    if (i === 0) {
                        port.x = this.x;
                        port.y = this.y + this.height/3;
                    } else if (i === 1) {
                        port.x = this.x;
                        port.y = this.y + 2*this.height/3;
                    } else {
                        port.x = this.x + this.width;
                        port.y = this.y + this.height/2;
                    }
                    break;
                case 'xyPlot':
                    if (i === 0) { // X input
                        port.x = this.x;
                        port.y = this.y + this.height/5;
                    } else if (i === 1) { // Y input
                        port.x = this.x;
                        port.y = this.y + 2*this.height/5;
                    } else if (i === 2) { // Clock input
                        port.x = this.x;
                        port.y = this.y + 3*this.height/5;
                    } else if (i === 3) { // Clear input
                        port.x = this.x;
                        port.y = this.y + 4*this.height/5;
                    }
                    break;
                case 'sineGen':
                    if (i === 0) { // Amplitude input
                        port.x = this.x;
                        port.y = this.y + this.height/4;
                    } else if (i === 1) { // Frequency input
                        port.x = this.x;
                        port.y = this.y + this.height/2;
                    } else if (i === 2) { // Phase input
                        port.x = this.x;
                        port.y = this.y + 3*this.height/4;
                    } else { // Output
                        port.x = this.x + this.width;
                        port.y = this.y + this.height/2;
                    }
                    break;
                case 'physicsBasic':
                    if (i === 0) {
                        port.x = this.x;
                        port.y = this.y + this.height/2;
                    } else if (i === 1) {
                        port.x = this.x + this.width;
                        port.y = this.y + this.height/5;
                    } else if (i === 2) {
                        port.x = this.x + this.width;
                        port.y = this.y + 2*this.height/5;
                    } else if (i === 3) {
                        port.x = this.x + this.width;
                        port.y = this.y + 3*this.height/5;
                    }
                    break;
                case 'springMassDamper':
                    if (i === 0) {
                        port.x = this.x;
                        port.y = this.y + this.height/2;
                    } else if (i === 1) {
                        port.x = this.x + this.width;
                        port.y = this.y + this.height/5;
                    } else if (i === 2) {
                        port.x = this.x + this.width;
                        port.y = this.y + 2*this.height/5;
                    } else if (i === 3) {
                        port.x = this.x + this.width;
                        port.y = this.y + 3*this.height/5;
                    }
                    break;
                case 'graph':
                    if (i === 0) {
                        port.x = this.x;
                        port.y = this.y + this.height/4;
                    } else if (i === 1) {
                        port.x = this.x;
                        port.y = this.y + 3*this.height/4;
                    }
                    break;
                case 'sineAnalyser':
                    if (i === 0) { // Top sine input
                        port.x = this.x;
                        port.y = this.y + this.height/3;
                    } else if (i === 1) { // Bottom sine input
                        port.x = this.x;
                        port.y = this.y + 2*this.height/3;
                    } else if (i === 2) { // Top frequency output
                        port.x = this.x + this.width;
                        port.y = this.y + this.height/6;
                    } else if (i === 3) { // Top amplitude output
                        port.x = this.x + this.width;
                        port.y = this.y + 2*this.height/6;
                    } else if (i === 4) { // Bottom frequency output
                        port.x = this.x + this.width;
                        port.y = this.y + 3*this.height/6;
                    } else if (i === 5) { // Bottom amplitude output
                        port.x = this.x + this.width;
                        port.y = this.y + 4*this.height/6;
                    } else if (i === 6) { // Phase difference output
                        port.x = this.x + this.width;
                        port.y = this.y + 5*this.height/6;
                    }
                    break;
            }
        }
        
        if (this.physics) {
            this.physics.windowX = this.x;
            this.physics.windowY = this.y;
            this.physics.windowWidth = this.width;
            this.physics.windowHeight = this.height;
        }
    }
    
    contains(x, y, camera, canvas) {
        const topLeft = camera.worldToScreen(this.x, this.y, canvas);
        const bottomRight = camera.worldToScreen(this.x + this.width, this.y + this.height, canvas);
        return x >= topLeft.x && x <= bottomRight.x && y >= topLeft.y && y <= bottomRight.y;
    }
    
    containsValueArea(x, y, camera, canvas) {
        if (this.type !== 'inputNumber' && this.type !== 'gain' && this.type !== 'offset' && this.type !== 'clock' && this.type !== 'sineGen') return false;
        const topLeft = camera.worldToScreen(this.x, this.y, canvas);
        const size = {
            width: this.width * camera.zoom,
            height: this.height * camera.zoom
        };
        const valueY = topLeft.y + 25 * camera.zoom;
        return x >= topLeft.x && x <= topLeft.x + size.width && 
               y >= valueY && y <= valueY + 20 * camera.zoom;
    }
    
    startEdit() {
        if (this.type === 'inputNumber') {
            this.editing = true;
            this.editText = this.value.toString();
            this.editCursor = this.editText.length;
        } else if (this.type === 'gain') {
            this.editing = true;
            this.editText = this.value.toString();
            this.editCursor = this.editText.length;
        } else if (this.type === 'offset') {
            this.editing = true;
            this.editText = this.value.toString();
            this.editCursor = this.editText.length;
        } else if (this.type === 'clock') {
            this.editing = true;
            this.editText = this.interval.toString();
            this.editCursor = this.editText.length;
        }
    }
    
    startYAxisEdit() {
        if (this.type === 'graph') {
            this.editingYLimits = true;
            this.editingField = 'leftMax';
            this.editText = this.leftYMax.toString();
            this.editCursor = this.editText.length;
        }
    }
    
    startSpringParamsEdit() {
        if (this.type === 'springMassDamper') {
            this.editingSpringParams = true;
            this.editingSpringField = 'mass';
            this.editText = this.physics.mass.toString();
            this.editCursor = this.editText.length;
        }
    }
    
    startCounterParamsEdit() {
        if (this.type === 'counter') {
            this.editingCounterParams = true;
            this.editingCounterField = 'startValue';
            this.editText = this.startValue.toString();
            this.editCursor = this.editText.length;
        }
    }
    
    startXYLimitsEdit() {
        if (this.type === 'xyPlot') {
            this.editingXYLimits = true;
            this.editingXYField = 'xMin';
            this.editText = this.xMin.toString();
            this.editCursor = this.editText.length;
        }
    }
    
    stopEdit() {
        if (this.editing) {
            const newValue = parseFloat(this.editText);
            if (!isNaN(newValue)) {
                if (this.type === 'gain' || this.type === 'inputNumber' || this.type === 'offset') {
                    this.value = newValue;
                } else if (this.type === 'clock') {
                    this.interval = Math.max(0.01, newValue); // Minimum 10ms interval
                }
            }
            this.editing = false;
            this.editText = '';
            this.editCursor = 0;
        }
    }
    
    handleEditKey(key) {
        if (!this.editing && !this.editingYLimits && !this.editingSpringParams && !this.editingCounterParams && !this.editingXYLimits) return false;
        
        // Handle Y-axis limits editing for graph blocks
        if (this.editingYLimits) {
            return this.handleYAxisEditKey(key);
        }
        
        // Handle spring parameter editing for spring-mass-damper blocks
        if (this.editingSpringParams) {
            return this.handleSpringParamsEditKey(key);
        }
        
        if (this.editingCounterParams) {
            return this.handleCounterParamsEditKey(key);
        }
        
        // Handle XY limits editing for xyPlot blocks
        if (this.editingXYLimits) {
            return this.handleXYLimitsEditKey(key);
        }
        
        if (key === 'Enter') {
            this.stopEdit();
            return true;
        } else if (key === 'Escape') {
            this.editing = false;
            this.editText = '';
            this.editCursor = 0;
            return true;
        } else if (key === 'Backspace') {
            if (this.editCursor > 0) {
                this.editText = this.editText.slice(0, this.editCursor - 1) + this.editText.slice(this.editCursor);
                this.editCursor--;
            }
            return true;
        } else if (key === 'ArrowLeft') {
            this.editCursor = Math.max(0, this.editCursor - 1);
            return true;
        } else if (key === 'ArrowRight') {
            this.editCursor = Math.min(this.editText.length, this.editCursor + 1);
            return true;
        } else if (key.length === 1 && (key.match(/[0-9.\-]/) || key === '.')) {
            this.editText = this.editText.slice(0, this.editCursor) + key + this.editText.slice(this.editCursor);
            this.editCursor++;
            return true;
        }
        
        return false;
    }
    
    handleYAxisEditKey(key) {
        if (key === 'Enter') {
            // Save current field and move to next or finish
            this.saveCurrentYAxisField();
            this.moveToNextYAxisField();
            return true;
        } else if (key === 'ArrowDown') {
            // Save current field and move to next
            this.saveCurrentYAxisField();
            this.moveToNextYAxisField();
            return true;
        } else if (key === 'ArrowUp') {
            // Save current field and move to previous
            this.saveCurrentYAxisField();
            this.moveToPreviousYAxisField();
            return true;
        } else if (key === 'Escape') {
            this.editingYLimits = false;
            this.editingField = null;
            this.editText = '';
            this.editCursor = 0;
            return true;
        } else if (key === 'Backspace') {
            if (this.editCursor > 0) {
                this.editText = this.editText.slice(0, this.editCursor - 1) + this.editText.slice(this.editCursor);
                this.editCursor--;
            }
            return true;
        } else if (key === 'Delete') {
            if (this.editCursor < this.editText.length) {
                this.editText = this.editText.slice(0, this.editCursor) + this.editText.slice(this.editCursor + 1);
            }
            return true;
        } else if (key === 'ArrowLeft') {
            this.editCursor = Math.max(0, this.editCursor - 1);
            return true;
        } else if (key === 'ArrowRight') {
            this.editCursor = Math.min(this.editText.length, this.editCursor + 1);
            return true;
        } else if (key === 'Home') {
            this.editCursor = 0;
            return true;
        } else if (key === 'End') {
            this.editCursor = this.editText.length;
            return true;
        } else if (key.length === 1 && key.match(/[0-9.\-]/)) {
            this.editText = this.editText.slice(0, this.editCursor) + key + this.editText.slice(this.editCursor);
            this.editCursor++;
            return true;
        }
        return false;
    }
    
    saveCurrentYAxisField() {
        const newValue = parseFloat(this.editText);
        if (!isNaN(newValue)) {
            switch (this.editingField) {
                case 'leftMax':
                    this.leftYMax = newValue;
                    break;
                case 'leftMin':
                    this.leftYMin = newValue;
                    break;
                case 'rightMax':
                    this.rightYMax = newValue;
                    break;
                case 'rightMin':
                    this.rightYMin = newValue;
                    break;
            }
        }
    }
    
    moveToNextYAxisField() {
        const fields = ['leftMax', 'leftMin', 'rightMax', 'rightMin'];
        const currentIndex = fields.indexOf(this.editingField);
        
        if (currentIndex < fields.length - 1) {
            // Move to next field
            this.editingField = fields[currentIndex + 1];
            const currentValue = this.getCurrentYAxisFieldValue();
            this.editText = currentValue.toString();
            this.editCursor = this.editText.length;
        } else {
            // Finished editing all fields
            this.editingYLimits = false;
            this.editingField = null;
            this.editText = '';
            this.editCursor = 0;
        }
    }
    
    moveToPreviousYAxisField() {
        const fields = ['leftMax', 'leftMin', 'rightMax', 'rightMin'];
        const currentIndex = fields.indexOf(this.editingField);
        
        if (currentIndex > 0) {
            // Move to previous field
            this.editingField = fields[currentIndex - 1];
            const currentValue = this.getCurrentYAxisFieldValue();
            this.editText = currentValue.toString();
            this.editCursor = this.editText.length;
        }
        // If already at first field, stay there
    }
    
    getCurrentYAxisFieldValue() {
        switch (this.editingField) {
            case 'leftMax': return this.leftYMax;
            case 'leftMin': return this.leftYMin;
            case 'rightMax': return this.rightYMax;
            case 'rightMin': return this.rightYMin;
            default: return 0;
        }
    }
    
    handleSpringParamsEditKey(key) {
        if (key === 'Enter') {
            // Save current field and move to next or finish
            this.saveCurrentSpringField();
            this.moveToNextSpringField();
            return true;
        } else if (key === 'ArrowDown') {
            // Save current field and move to next
            this.saveCurrentSpringField();
            this.moveToNextSpringField();
            return true;
        } else if (key === 'ArrowUp') {
            // Save current field and move to previous
            this.saveCurrentSpringField();
            this.moveToPreviousSpringField();
            return true;
        } else if (key === 'Escape') {
            this.editingSpringParams = false;
            this.editingSpringField = null;
            this.editText = '';
            this.editCursor = 0;
            return true;
        } else if (key === 'Backspace') {
            if (this.editCursor > 0) {
                this.editText = this.editText.slice(0, this.editCursor - 1) + this.editText.slice(this.editCursor);
                this.editCursor--;
            }
            return true;
        } else if (key === 'Delete') {
            if (this.editCursor < this.editText.length) {
                this.editText = this.editText.slice(0, this.editCursor) + this.editText.slice(this.editCursor + 1);
            }
            return true;
        } else if (key === 'ArrowLeft') {
            this.editCursor = Math.max(0, this.editCursor - 1);
            return true;
        } else if (key === 'ArrowRight') {
            this.editCursor = Math.min(this.editText.length, this.editCursor + 1);
            return true;
        } else if (key === 'Home') {
            this.editCursor = 0;
            return true;
        } else if (key === 'End') {
            this.editCursor = this.editText.length;
            return true;
        } else if (key.length === 1 && key.match(/[0-9.\-]/)) {
            this.editText = this.editText.slice(0, this.editCursor) + key + this.editText.slice(this.editCursor);
            this.editCursor++;
            return true;
        }
        return false;
    }
    
    saveCurrentSpringField() {
        const newValue = parseFloat(this.editText);
        if (!isNaN(newValue) && newValue > 0) { // Ensure positive values
            switch (this.editingSpringField) {
                case 'mass':
                    this.physics.mass = newValue;
                    break;
                case 'springConstant':
                    this.physics.springConstant = newValue;
                    break;
                case 'dampingCoeff':
                    this.physics.dampingCoeff = newValue;
                    break;
            }
        }
    }
    
    moveToNextSpringField() {
        const fields = ['mass', 'springConstant', 'dampingCoeff'];
        const currentIndex = fields.indexOf(this.editingSpringField);
        
        if (currentIndex < fields.length - 1) {
            // Move to next field
            this.editingSpringField = fields[currentIndex + 1];
            const currentValue = this.getCurrentSpringFieldValue();
            this.editText = currentValue.toString();
            this.editCursor = this.editText.length;
        } else {
            // Finished editing all fields
            this.editingSpringParams = false;
            this.editingSpringField = null;
            this.editText = '';
            this.editCursor = 0;
        }
    }
    
    moveToPreviousSpringField() {
        const fields = ['mass', 'springConstant', 'dampingCoeff'];
        const currentIndex = fields.indexOf(this.editingSpringField);
        
        if (currentIndex > 0) {
            // Move to previous field
            this.editingSpringField = fields[currentIndex - 1];
            const currentValue = this.getCurrentSpringFieldValue();
            this.editText = currentValue.toString();
            this.editCursor = this.editText.length;
        }
        // If already at first field, stay there
    }
    
    getCurrentSpringFieldValue() {
        switch (this.editingSpringField) {
            case 'mass': return this.physics.mass;
            case 'springConstant': return this.physics.springConstant;
            case 'dampingCoeff': return this.physics.dampingCoeff;
            default: return 0;
        }
    }
    
    startDrag(x, y, camera, canvas) {
        const worldPos = camera.screenToWorld(x, y, canvas);
        this.dragging = true;
        this.dragOffset.x = worldPos.x - this.x;
        this.dragOffset.y = worldPos.y - this.y;
    }
    
    updateDrag(x, y, camera, canvas, draggableWindows = null) {
        if (this.dragging) {
            const worldPos = camera.screenToWorld(x, y, canvas);
            let newX = worldPos.x - this.dragOffset.x;
            let newY = worldPos.y - this.dragOffset.y;
            
            if (draggableWindows && draggableWindows.gridEnabled) {
                const snapped = draggableWindows.snapPointToGrid(newX, newY);
                newX = snapped.x;
                newY = snapped.y;
            }
            
            this.x = newX;
            this.y = newY;
            this.updatePortPositions();
        }
    }
    
    handleCounterParamsEditKey(key) {
        if (key === 'Enter') {
            // Save current field and move to next or finish
            this.saveCurrentCounterField();
            this.moveToNextCounterField();
            return true;
        } else if (key === 'ArrowDown') {
            // Save current field and move to next
            this.saveCurrentCounterField();
            this.moveToNextCounterField();
            return true;
        } else if (key === 'ArrowUp') {
            // Save current field and move to previous
            this.saveCurrentCounterField();
            this.moveToPreviousCounterField();
            return true;
        } else if (key === 'Escape') {
            this.editingCounterParams = false;
            this.editingCounterField = null;
            this.editText = '';
            this.editCursor = 0;
            return true;
        } else if (key === 'Backspace') {
            if (this.editCursor > 0) {
                this.editText = this.editText.slice(0, this.editCursor - 1) + this.editText.slice(this.editCursor);
                this.editCursor--;
            }
            return true;
        } else if (key === 'ArrowLeft') {
            this.editCursor = Math.max(0, this.editCursor - 1);
            return true;
        } else if (key === 'ArrowRight') {
            this.editCursor = Math.min(this.editText.length, this.editCursor + 1);
            return true;
        } else if (key.length === 1 && (key.match(/[0-9.\-]/) || key === '.')) {
            this.editText = this.editText.slice(0, this.editCursor) + key + this.editText.slice(this.editCursor);
            this.editCursor++;
            return true;
        }
        return false;
    }
    
    handleXYLimitsEditKey(key) {
        if (key === 'Enter') {
            // Save current field and move to next or finish
            this.saveCurrentXYField();
            this.moveToNextXYField();
            return true;
        } else if (key === 'ArrowDown') {
            // Save current field and move to next
            this.saveCurrentXYField();
            this.moveToNextXYField();
            return true;
        } else if (key === 'ArrowUp') {
            // Save current field and move to previous
            this.saveCurrentXYField();
            this.moveToPreviousXYField();
            return true;
        } else if (key === 'x' || key === 'X') {
            // Toggle X-axis log scale
            this.xLogScale = !this.xLogScale;
            console.log(`X-axis log scale toggled to: ${this.xLogScale}`);
            return true;
        } else if (key === 'y' || key === 'Y') {
            // Toggle Y-axis log scale
            this.yLogScale = !this.yLogScale;
            console.log(`Y-axis log scale toggled to: ${this.yLogScale}`);
            return true;
        } else if (key === 'Escape') {
            this.editingXYLimits = false;
            this.editingXYField = null;
            this.editText = '';
            this.editCursor = 0;
            return true;
        } else if (key === 'Backspace') {
            if (this.editCursor > 0) {
                this.editText = this.editText.slice(0, this.editCursor - 1) + this.editText.slice(this.editCursor);
                this.editCursor--;
            }
            return true;
        } else if (key === 'ArrowLeft') {
            this.editCursor = Math.max(0, this.editCursor - 1);
            return true;
        } else if (key === 'ArrowRight') {
            this.editCursor = Math.min(this.editText.length, this.editCursor + 1);
            return true;
        } else if (key.length === 1 && (key.match(/[0-9.\-]/) || key === '.')) {
            this.editText = this.editText.slice(0, this.editCursor) + key + this.editText.slice(this.editCursor);
            this.editCursor++;
            return true;
        }
        return false;
    }
    
    saveCurrentCounterField() {
        const value = parseFloat(this.editText);
        if (!isNaN(value)) {
            switch (this.editingCounterField) {
                case 'startValue':
                    this.startValue = value;
                    break;
                case 'stopValue':
                    this.stopValue = value;
                    break;
                case 'stepSize':
                    this.stepSize = value;
                    break;
            }
        }
    }
    
    getCurrentCounterFieldValue() {
        switch (this.editingCounterField) {
            case 'startValue': return this.startValue;
            case 'stopValue': return this.stopValue;
            case 'stepSize': return this.stepSize;
            default: return 0;
        }
    }
    
    moveToNextCounterField() {
        const fields = ['startValue', 'stopValue', 'stepSize'];
        const currentIndex = fields.indexOf(this.editingCounterField);
        
        if (currentIndex < fields.length - 1) {
            // Move to next field
            this.editingCounterField = fields[currentIndex + 1];
            const currentValue = this.getCurrentCounterFieldValue();
            this.editText = currentValue.toString();
            this.editCursor = this.editText.length;
        } else {
            // Finished editing all fields
            this.editingCounterParams = false;
            this.editingCounterField = null;
            this.editText = '';
            this.editCursor = 0;
        }
    }
    
    moveToPreviousCounterField() {
        const fields = ['startValue', 'stopValue', 'stepSize'];
        const currentIndex = fields.indexOf(this.editingCounterField);
        
        if (currentIndex > 0) {
            // Move to previous field
            this.editingCounterField = fields[currentIndex - 1];
            const currentValue = this.getCurrentCounterFieldValue();
            this.editText = currentValue.toString();
            this.editCursor = this.editText.length;
        }
    }
    
    saveCurrentXYField() {
        const value = parseFloat(this.editText);
        if (!isNaN(value)) {
            switch (this.editingXYField) {
                case 'xMin':
                    this.xMin = value;
                    break;
                case 'xMax':
                    this.xMax = value;
                    break;
                case 'yMin':
                    this.yMin = value;
                    break;
                case 'yMax':
                    this.yMax = value;
                    break;
            }
        }
    }
    
    getCurrentXYFieldValue() {
        switch (this.editingXYField) {
            case 'xMin': return this.xMin;
            case 'xMax': return this.xMax;
            case 'yMin': return this.yMin;
            case 'yMax': return this.yMax;
            default: return 0;
        }
    }
    
    moveToNextXYField() {
        const fields = ['xMin', 'xMax', 'yMin', 'yMax'];
        const currentIndex = fields.indexOf(this.editingXYField);
        
        if (currentIndex < fields.length - 1) {
            // Move to next field
            this.editingXYField = fields[currentIndex + 1];
            const currentValue = this.getCurrentXYFieldValue();
            this.editText = currentValue.toString();
            this.editCursor = this.editText.length;
        } else {
            // Finished editing all fields
            this.editingXYLimits = false;
            this.editingXYField = null;
            this.editText = '';
            this.editCursor = 0;
        }
    }
    
    moveToPreviousXYField() {
        const fields = ['xMin', 'xMax', 'yMin', 'yMax'];
        const currentIndex = fields.indexOf(this.editingXYField);
        
        if (currentIndex > 0) {
            // Move to previous field
            this.editingXYField = fields[currentIndex - 1];
            const currentValue = this.getCurrentXYFieldValue();
            this.editText = currentValue.toString();
            this.editCursor = this.editText.length;
        }
    }
    
    stopDrag() {
        this.dragging = false;
    }
    
    update(dt, inputs) {
        switch (this.type) {
            case 'multiply':
                const input1 = inputs[this.ports[0].id] || 0;
                const input2 = inputs[this.ports[1].id] || 0;
                this.value = input1 * input2;
                this.ports[2].value = this.value;
                break;
            case 'divide':
                const divideInput1 = inputs[this.ports[0].id] || 1; // Top input (numerator)
                const divideInput2 = inputs[this.ports[1].id] || 1; // Bottom input (denominator)
                this.value = divideInput2 !== 0 ? divideInput1 / divideInput2 : 0; // Avoid division by zero
                this.ports[2].value = this.value;
                break;
            case '20log10':
                const log20Input = inputs[this.ports[0].id] || 1;
                this.value = log20Input > 0 ? 20 * Math.log10(Math.abs(log20Input)) : -Infinity;
                this.ports[1].value = this.value;
                break;
            case '10log10':
                const log10Input = inputs[this.ports[0].id] || 1;
                this.value = log10Input > 0 ? 10 * Math.log10(Math.abs(log10Input)) : -Infinity;
                this.ports[1].value = this.value;
                break;
            case 'deg2rad':
                const degInput = inputs[this.ports[0].id] || 0;
                this.value = degInput * Math.PI / 180; // Convert degrees to radians
                this.ports[1].value = this.value;
                break;
            case 'rad2deg':
                const radInput = inputs[this.ports[0].id] || 0;
                this.value = radInput * 180 / Math.PI; // Convert radians to degrees
                this.ports[1].value = this.value;
                break;
            case 'inputNumber':
            case 'inputSlider':
                this.ports[0].value = this.value;
                break;
            case 'outputNumber':
                this.value = inputs[this.ports[0].id] || 0;
                break;
            case 'gain':
                const gainInput = inputs[this.ports[0].id] || 0;
                this.ports[1].value = gainInput * this.value;
                break;
            case 'offset':
                const offsetInput = inputs[this.ports[0].id] || 0;
                this.ports[1].value = offsetInput + this.value;
                break;
            case 'sineGen':
                const amplitudeInput = inputs[this.ports[0].id] || this.amplitude;
                const frequencyInput = inputs[this.ports[1].id] || this.frequency;
                const phaseInput = inputs[this.ports[2].id] || this.phase;
                
                // Update amplitude and phase immediately
                this.amplitude = amplitudeInput;
                this.phase = phaseInput;
                
                // Update accumulated phase with current frequency
                if (!this.accumulatedPhase) this.accumulatedPhase = 0;
                this.accumulatedPhase += 2 * Math.PI * this.frequency * dt;
                
                // Update frequency immediately for smooth transitions
                this.frequency = frequencyInput;
                
                // Generate output using accumulated phase for smooth frequency changes
                const currentOutput = this.amplitude * Math.sin(this.accumulatedPhase + this.phase);
                
                this.lastOutput = currentOutput;
                this.ports[3].value = currentOutput;
                this.value = currentOutput;
                break;
            case 'physicsBasic':
                if (this.physics) {
                    const forceX = inputs[this.ports[0].id] || 0;
                    this.physics.applyForce(forceX);
                    this.physics.update(dt, this.x, this.y);
                    
                    const displacement = this.physics.x - this.physics.windowWidth / 2;
                    const velocity = this.physics.velocity.x;
                    const acceleration = Math.abs(this.physics.acceleration.x);
                    
                    this.ports[1].value = displacement;
                    this.ports[2].value = velocity;
                    this.ports[3].value = acceleration;
                    
                    this.value = velocity;
                }
                break;
            case 'springMassDamper':
                if (this.physics) {
                    const forceX = inputs[this.ports[0].id] || 0;
                    this.physics.applyForce(forceX);
                    this.physics.update(dt, this.x, this.y);
                    
                    const displacement = this.physics.x - this.physics.restPosition;
                    const velocity = this.physics.velocity.x;
                    const acceleration = Math.abs(this.physics.acceleration.x);
                    
                    this.ports[1].value = displacement;
                    this.ports[2].value = velocity;
                    this.ports[3].value = acceleration;
                    
                    this.value = velocity;
                }
                break;
            case 'graph':
                const graphInput1 = inputs[this.ports[0].id] || 0;
                const graphInput2 = inputs[this.ports[1].id] || 0;
                
                this.timeStep++;
                this.graphData1.push({ x: this.timeStep, y: graphInput1 });
                this.graphData2.push({ x: this.timeStep, y: graphInput2 });
                
                if (this.graphData1.length > this.maxDataPoints) {
                    this.graphData1.shift();
                }
                if (this.graphData2.length > this.maxDataPoints) {
                    this.graphData2.shift();
                }
                break;
            case 'sineAnalyser':
                const topSineInput = inputs[this.ports[0].id] || 0;
                const bottomSineInput = inputs[this.ports[1].id] || 0;
                
                // Store samples for analysis
                this.sampleHistory1.push(topSineInput);
                this.sampleHistory2.push(bottomSineInput);
                
                if (this.sampleHistory1.length > this.maxSamples) {
                    this.sampleHistory1.shift();
                }
                if (this.sampleHistory2.length > this.maxSamples) {
                    this.sampleHistory2.shift();
                }
                
                // Analyze frequencies and amplitudes with improved algorithms
                if (this.sampleHistory1.length >= this.minSamplesForAnalysis) {
                    this.topAmplitude = this.analyzeAmplitude(this.sampleHistory1);
                    this.topFrequency = this.analyzeFrequency(this.sampleHistory1, dt);
                }
                
                if (this.sampleHistory2.length >= this.minSamplesForAnalysis) {
                    this.bottomAmplitude = this.analyzeAmplitude(this.sampleHistory2);
                    this.bottomFrequency = this.analyzeFrequency(this.sampleHistory2, dt);
                }
                
                // Calculate phase difference using cross-correlation
                if (this.sampleHistory1.length >= this.minSamplesForAnalysis && this.sampleHistory2.length >= this.minSamplesForAnalysis) {
                    this.phaseDifference = this.calculatePhaseDifference(this.sampleHistory1, this.sampleHistory2, dt);
                }
                
                // Set output port values
                this.ports[2].value = this.topFrequency;      // Top frequency output
                this.ports[3].value = this.topAmplitude;      // Top amplitude output
                this.ports[4].value = this.bottomFrequency;   // Bottom frequency output
                this.ports[5].value = this.bottomAmplitude;   // Bottom amplitude output
                this.ports[6].value = this.phaseDifference;   // Phase difference output
                break;
            case 'clock':
                this.timer += dt;
                
                if (this.pulseOutput > 0) {
                    // Currently in pulse, check if pulse duration is over
                    this.pulseTimer += dt;
                    if (this.pulseTimer >= this.pulseDuration) {
                        this.pulseOutput = 0;
                        this.pulseTimer = 0;
                    }
                } else {
                    // Not in pulse, check if it's time for next pulse
                    if (this.timer >= this.interval) {
                        this.pulseOutput = 1;
                        this.timer = 0;
                        this.pulseTimer = 0;
                    }
                }
                
                this.ports[0].value = this.pulseOutput;
                break;
            case 'counter':
                const pulseInput = inputs[this.ports[0].id] || 0;
                const resetInput = inputs[this.ports[1].id] || 0;
                
                // Reset edge detection - reset when input goes from 0 to 1
                if (resetInput > 0.5 && this.lastResetInput <= 0.5) {
                    this.count = this.startValue;
                }
                
                // Pulse edge detection - count when input goes from 0 to 1
                if (pulseInput > 0.5 && this.lastInput <= 0.5) {
                    this.count += this.stepSize;
                    
                    // Check bounds and wrap if necessary
                    if (this.stepSize > 0 && this.count > this.stopValue) {
                        this.count = this.startValue;
                    } else if (this.stepSize < 0 && this.count < this.stopValue) {
                        this.count = this.startValue;
                    }
                }
                
                this.lastInput = pulseInput;
                this.lastResetInput = resetInput;
                this.ports[2].value = this.count;
                break;
            case 'selector':
                const inputA = inputs[this.ports[0].id] || 0;
                const inputB = inputs[this.ports[1].id] || 0;
                
                // Output the selected input
                this.ports[2].value = this.selectedInput === 0 ? inputA : inputB;
                break;
            case 'xyPlot':
                const xInput = inputs[this.ports[0].id] || 0;
                const yInput = inputs[this.ports[1].id] || 0;
                const clkInput = inputs[this.ports[2].id] || 0;
                const clearInput = inputs[this.ports[3].id] || 0;
                
                // Clear graph on clear edge (0 to 1 transition)
                if (clearInput > 0.5 && this.lastClearInput <= 0.5) {
                    this.plotData = [];
                }
                
                // Add point on clock edge (0 to 1 transition)
                if (clkInput > 0.5 && this.lastClkInput <= 0.5) {
                    this.plotData.push({x: xInput, y: yInput});
                    // Limit number of points to prevent memory issues
                    if (this.plotData.length > 10000) {
                        this.plotData.shift();
                    }
                }
                
                this.lastClkInput = clkInput;
                this.lastClearInput = clearInput;
                break;
        }
    }
    
    analyzeAmplitude(samples) {
        if (samples.length < this.minSamplesForAnalysis) return 0;
        
        // Remove DC offset first
        const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length;
        const centeredSamples = samples.map(val => val - mean);
        
        // Find peaks and troughs for more accurate amplitude measurement
        const peaks = [];
        const troughs = [];
        
        for (let i = 1; i < centeredSamples.length - 1; i++) {
            if (centeredSamples[i] > centeredSamples[i-1] && centeredSamples[i] > centeredSamples[i+1]) {
                peaks.push(centeredSamples[i]);
            } else if (centeredSamples[i] < centeredSamples[i-1] && centeredSamples[i] < centeredSamples[i+1]) {
                troughs.push(centeredSamples[i]);
            }
        }
        
        if (peaks.length === 0 && troughs.length === 0) {
            // Fallback to RMS amplitude for very low frequencies
            const rms = Math.sqrt(centeredSamples.reduce((sum, val) => sum + val * val, 0) / centeredSamples.length);
            return rms * Math.sqrt(2); // Convert RMS to peak amplitude for sine wave
        }
        
        // Average peak amplitude
        const avgPeak = peaks.length > 0 ? peaks.reduce((sum, val) => sum + val, 0) / peaks.length : 0;
        const avgTrough = troughs.length > 0 ? Math.abs(troughs.reduce((sum, val) => sum + val, 0) / troughs.length) : 0;
        
        return Math.max(avgPeak, avgTrough);
    }
    
    analyzeFrequency(samples, dt) {
        if (samples.length < this.minSamplesForAnalysis) return 0;
        
        // Remove DC offset for better zero-crossing detection
        const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length;
        const centeredSamples = samples.map(val => val - mean);
        
        // Find zero crossings with hysteresis to avoid noise
        const threshold = 0.01; // Small threshold to avoid noise-induced crossings
        let crossings = 0;
        let lastState = centeredSamples[0] > threshold ? 1 : (centeredSamples[0] < -threshold ? -1 : 0);
        
        for (let i = 1; i < centeredSamples.length; i++) {
            let currentState = centeredSamples[i] > threshold ? 1 : (centeredSamples[i] < -threshold ? -1 : 0);
            
            if (currentState !== 0 && lastState !== 0 && currentState !== lastState) {
                crossings++;
                lastState = currentState;
            } else if (currentState !== 0) {
                lastState = currentState;
            }
        }
        
        // Frequency = crossings / (2 * time_period)
        const totalTime = samples.length * dt;
        return crossings / (2 * totalTime);
    }
    
    calculatePhaseDifference(samples1, samples2, dt) {
        if (samples1.length < this.minSamplesForAnalysis || samples2.length < this.minSamplesForAnalysis) {
            return this.phaseDifference || 0;
        }
        
        // Remove DC offsets
        const mean1 = samples1.reduce((sum, val) => sum + val, 0) / samples1.length;
        const mean2 = samples2.reduce((sum, val) => sum + val, 0) / samples2.length;
        const centered1 = samples1.map(val => val - mean1);
        const centered2 = samples2.map(val => val - mean2);
        
        // Use cross-correlation for more robust phase detection
        const maxLag = Math.min(50, Math.floor(samples1.length / 4)); // Limit search range
        let maxCorrelation = -Infinity;
        let bestLag = 0;
        
        for (let lag = -maxLag; lag <= maxLag; lag++) {
            let correlation = 0;
            let count = 0;
            
            for (let i = Math.max(0, lag); i < Math.min(centered1.length, centered2.length + lag); i++) {
                const j = i - lag;
                if (j >= 0 && j < centered2.length) {
                    correlation += centered1[i] * centered2[j];
                    count++;
                }
            }
            
            if (count > 0) {
                correlation /= count;
                if (correlation > maxCorrelation) {
                    maxCorrelation = correlation;
                    bestLag = lag;
                }
            }
        }
        
        // Convert lag to phase difference
        const avgFreq = (this.topFrequency + this.bottomFrequency) / 2;
        if (avgFreq === 0) return this.phaseDifference || 0;
        
        const period = 1.0 / avgFreq; // Period in seconds
        const periodInSamples = period / dt;
        
        let phaseDiff = (bestLag / periodInSamples) * 2 * Math.PI;
        
        // Normalise to [-π, π] range
        while (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
        while (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
        
        // Apply stronger low-pass filtering for stability
        const alpha = 0.05; // Reduced for more stability
        if (this.phaseDifference !== undefined && Math.abs(maxCorrelation) > 0.1) {
            // Only update if correlation is strong enough
            let diff = phaseDiff - this.phaseDifference;
            if (diff > Math.PI) diff -= 2 * Math.PI;
            if (diff < -Math.PI) diff += 2 * Math.PI;
            phaseDiff = this.phaseDifference + alpha * diff;
        }
        
        return phaseDiff;
    }
    
    draw(ctx, camera, canvas, colors) {
        const topLeft = camera.worldToScreen(this.x, this.y, canvas);
        const size = {
            width: this.width * camera.zoom,
            height: this.height * camera.zoom
        };
        
        const themeColors = colors || { 
            primary: '#0f0', 
            secondary: '#4f4', 
            fill: '#001100' 
        };
        
        ctx.strokeStyle = this.focused ? themeColors.secondary : themeColors.primary;
        ctx.fillStyle = themeColors.fill;
        ctx.lineWidth = 2;
        ctx.shadowBlur = this.focused ? 15 : 10;
        ctx.shadowColor = themeColors.primary;
        
        if (this.type === 'gain') {
            // Draw triangle shape for gain block
            ctx.beginPath();
            ctx.moveTo(topLeft.x, topLeft.y); // Top left
            ctx.lineTo(topLeft.x, topLeft.y + size.height); // Bottom left
            ctx.lineTo(topLeft.x + size.width, topLeft.y + size.height/2); // Right point
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            // Draw normal rectangle for other blocks
            ctx.fillRect(topLeft.x, topLeft.y, size.width, size.height);
            ctx.strokeRect(topLeft.x, topLeft.y, size.width, size.height);
        }
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = themeColors.primary;
        ctx.font = `${12 * camera.zoom}px Courier New`;
        ctx.textAlign = 'center';
        
        ctx.fillText(this.title, topLeft.x + size.width/2, topLeft.y + 15 * camera.zoom);
        
        if (this.type === 'inputSlider') {
            const sliderY = topLeft.y + 30 * camera.zoom;
            const sliderWidth = size.width - 20 * camera.zoom;
            const sliderX = topLeft.x + 10 * camera.zoom;
            
            ctx.strokeStyle = '#0f0';
            ctx.beginPath();
            ctx.moveTo(sliderX, sliderY);
            ctx.lineTo(sliderX + sliderWidth, sliderY);
            ctx.stroke();
            
            const knobX = sliderX + (this.value - this.min) / (this.max - this.min) * sliderWidth;
            ctx.beginPath();
            ctx.arc(knobX, sliderY, 5 * camera.zoom, 0, Math.PI * 2);
            ctx.fill();
        }
        
        if (this.type === 'inputNumber' || this.type === 'outputNumber') {
            if (this.editing && this.type === 'inputNumber') {
                ctx.fillStyle = themeColors.primary;
                ctx.fillRect(topLeft.x + 5, topLeft.y + 25 * camera.zoom, size.width - 10, 15 * camera.zoom);
                ctx.fillStyle = themeColors.background;
                ctx.fillText(this.editText, topLeft.x + size.width/2, topLeft.y + 35 * camera.zoom);
                
                const textWidth = ctx.measureText(this.editText.slice(0, this.editCursor)).width;
                ctx.strokeStyle = themeColors.background;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(topLeft.x + size.width/2 - ctx.measureText(this.editText).width/2 + textWidth, topLeft.y + 25 * camera.zoom);
                ctx.lineTo(topLeft.x + size.width/2 - ctx.measureText(this.editText).width/2 + textWidth, topLeft.y + 40 * camera.zoom);
                ctx.stroke();
                ctx.fillStyle = themeColors.primary;
            } else {
                ctx.fillText(this.value.toFixed(2), topLeft.x + size.width/2, topLeft.y + 35 * camera.zoom);
            }
        }
        
        if (this.type === 'multiply') {
            ctx.fillText('×', topLeft.x + size.width/2, topLeft.y + 35 * camera.zoom);
        }
        
        if (this.type === 'divide') {
            ctx.fillText('÷', topLeft.x + size.width/2, topLeft.y + 35 * camera.zoom);
        }
        
        if (this.type === '20log10') {
            ctx.font = `${10 * camera.zoom}px Courier New`;
            ctx.fillText('20log10', topLeft.x + size.width/2, topLeft.y + 25 * camera.zoom);
            ctx.font = `${8 * camera.zoom}px Courier New`;
            ctx.fillText(this.value.toFixed(2), topLeft.x + size.width/2, topLeft.y + 45 * camera.zoom);
        }
        
        if (this.type === '10log10') {
            ctx.font = `${10 * camera.zoom}px Courier New`;
            ctx.fillText('10log10', topLeft.x + size.width/2, topLeft.y + 25 * camera.zoom);
            ctx.font = `${8 * camera.zoom}px Courier New`;
            ctx.fillText(this.value.toFixed(2), topLeft.x + size.width/2, topLeft.y + 45 * camera.zoom);
        }
        
        if (this.type === 'deg2rad') {
            ctx.font = `${10 * camera.zoom}px Courier New`;
            ctx.fillText('deg2rad', topLeft.x + size.width/2, topLeft.y + 25 * camera.zoom);
            ctx.font = `${8 * camera.zoom}px Courier New`;
            ctx.fillText(this.value.toFixed(4), topLeft.x + size.width/2, topLeft.y + 45 * camera.zoom);
        }
        
        if (this.type === 'rad2deg') {
            ctx.font = `${10 * camera.zoom}px Courier New`;
            ctx.fillText('rad2deg', topLeft.x + size.width/2, topLeft.y + 25 * camera.zoom);
            ctx.font = `${8 * camera.zoom}px Courier New`;
            ctx.fillText(this.value.toFixed(2), topLeft.x + size.width/2, topLeft.y + 45 * camera.zoom);
        }
        
        if (this.type === 'gain') {
            if (this.editing) {
                ctx.fillStyle = themeColors.primary;
                ctx.fillRect(topLeft.x + 5, topLeft.y + size.height/2 - 10 * camera.zoom, size.width - 10, 15 * camera.zoom);
                ctx.fillStyle = themeColors.background;
                ctx.fillText(this.editText, topLeft.x + size.width/3, topLeft.y + size.height/2 + 4 * camera.zoom);
                ctx.fillStyle = themeColors.primary;
            } else {
                ctx.fillText(this.value.toFixed(1), topLeft.x + size.width/3, topLeft.y + size.height/2 + 4 * camera.zoom);
            }
        }
        
        if (this.type === 'offset') {
            if (this.editing) {
                ctx.fillStyle = themeColors.primary;
                ctx.fillRect(topLeft.x + 5, topLeft.y + size.height/2 - 10 * camera.zoom, size.width - 10, 15 * camera.zoom);
                ctx.fillStyle = themeColors.background;
                ctx.fillText(this.editText, topLeft.x + size.width/2, topLeft.y + size.height/2 + 4 * camera.zoom);
                ctx.fillStyle = themeColors.primary;
            } else {
                ctx.fillText(this.value.toFixed(1), topLeft.x + size.width/2, topLeft.y + size.height/2 + 4 * camera.zoom);
            }
        }
        
        if (this.type === 'clock') {
            if (this.editing) {
                ctx.fillStyle = themeColors.primary;
                ctx.fillRect(topLeft.x + 5, topLeft.y + size.height/2 - 10 * camera.zoom, size.width - 10, 15 * camera.zoom);
                ctx.fillStyle = themeColors.background;
                ctx.fillText(this.editText, topLeft.x + size.width/2, topLeft.y + size.height/2 + 4 * camera.zoom);
                ctx.fillStyle = themeColors.primary;
            } else {
                ctx.fillText(this.interval.toFixed(2) + 's', topLeft.x + size.width/2, topLeft.y + size.height/2 + 4 * camera.zoom);
            }
        }
        
        if (this.type === 'sineGen') {
            ctx.font = `${8 * camera.zoom}px Courier New`;
            ctx.textAlign = 'left';
            
            // Port labels
            ctx.fillText('A', topLeft.x - 15 * camera.zoom, topLeft.y + size.height/4 + 3 * camera.zoom);
            ctx.fillText('f', topLeft.x - 15 * camera.zoom, topLeft.y + size.height/2 + 3 * camera.zoom);
            ctx.fillText('φ', topLeft.x - 15 * camera.zoom, topLeft.y + 3*size.height/4 + 3 * camera.zoom);
            
            ctx.textAlign = 'center';
            ctx.font = `${10 * camera.zoom}px Courier New`;
            ctx.fillText('sin(2πft+φ)', topLeft.x + size.width/2, topLeft.y + 25 * camera.zoom);
            
            ctx.font = `${8 * camera.zoom}px Courier New`;
            ctx.fillText(`${this.value.toFixed(3)}`, topLeft.x + size.width/2, topLeft.y + 60 * camera.zoom);
        }
        
        if (this.type === 'sineAnalyser') {
            // Single heading at the top
            ctx.font = `${8 * camera.zoom}px Courier New`;
            ctx.textAlign = 'center';
            ctx.fillText('Sine Analyser', topLeft.x + size.width/2, topLeft.y + 15 * camera.zoom);
            
            // Output labels and values with proper positioning
            ctx.font = `${6 * camera.zoom}px Courier New`;
            
            // Position labels and values inside the block with better spacing
            const labelX = topLeft.x + size.width - 60 * camera.zoom; // Labels further left
            const valueX = topLeft.x + size.width - 20 * camera.zoom; // Values inside block
            
            // Output labels (right-aligned)
            ctx.textAlign = 'right';
            ctx.fillText('f1:', labelX, topLeft.y + size.height/6 + 3 * camera.zoom);
            ctx.fillText('A1:', labelX, topLeft.y + 2*size.height/6 + 3 * camera.zoom);
            ctx.fillText('f2:', labelX, topLeft.y + 3*size.height/6 + 3 * camera.zoom);
            ctx.fillText('A2:', labelX, topLeft.y + 4*size.height/6 + 3 * camera.zoom);
            ctx.fillText('Δφ:', labelX, topLeft.y + 5*size.height/6 + 3 * camera.zoom);
            
            // Output values (right-aligned to stay inside block)
            ctx.textAlign = 'right';
            ctx.fillText(this.topFrequency.toFixed(2), valueX, topLeft.y + size.height/6 + 3 * camera.zoom);
            ctx.fillText(this.topAmplitude.toFixed(2), valueX, topLeft.y + 2*size.height/6 + 3 * camera.zoom);
            ctx.fillText(this.bottomFrequency.toFixed(2), valueX, topLeft.y + 3*size.height/6 + 3 * camera.zoom);
            ctx.fillText(this.bottomAmplitude.toFixed(2), valueX, topLeft.y + 4*size.height/6 + 3 * camera.zoom);
            ctx.fillText(this.phaseDifference.toFixed(3), valueX, topLeft.y + 5*size.height/6 + 3 * camera.zoom);
            
            ctx.textAlign = 'center';
        }
        
        if (this.type === 'counter') {
            if (this.editingCounterParams) {
                // Show parameter editing interface
                ctx.font = `${8 * camera.zoom}px Courier New`;
                ctx.fillStyle = themeColors.primary;
                
                const fields = ['startValue', 'stopValue', 'stepSize'];
                const labels = ['Start:', 'Stop:', 'Step:'];
                const values = [this.startValue, this.stopValue, this.stepSize];
                
                for (let i = 0; i < fields.length; i++) {
                    const y = topLeft.y + (i + 1) * 20 * camera.zoom;
                    
                    // Label
                    ctx.textAlign = 'left';
                    ctx.fillText(labels[i], topLeft.x + 5 * camera.zoom, y);
                    
                    // Value with highlight if currently editing
                    const valueX = topLeft.x + 45 * camera.zoom;
                    if (this.editingCounterField === fields[i]) {
                        // Highlight current field
                        ctx.fillStyle = themeColors.secondary;
                        ctx.fillRect(valueX - 2, y - 10 * camera.zoom, 40 * camera.zoom, 12 * camera.zoom);
                        ctx.fillStyle = themeColors.background;
                        ctx.fillText(this.editText, valueX, y);
                        ctx.fillStyle = themeColors.primary;
                    } else {
                        ctx.fillText(values[i].toString(), valueX, y);
                    }
                }
                
                ctx.textAlign = 'center';
            } else {
                // Show current count and port labels
                ctx.font = `${12 * camera.zoom}px Courier New`;
                ctx.fillStyle = themeColors.primary;
                ctx.textAlign = 'center';
                ctx.fillText(this.count.toString(), topLeft.x + size.width/2, topLeft.y + size.height/2 + 4 * camera.zoom);
                
                // Port labels
                ctx.font = `${6 * camera.zoom}px Courier New`;
                ctx.textAlign = 'left';
                ctx.fillText('CLK', topLeft.x + 8 * camera.zoom, topLeft.y + size.height/3 + 3 * camera.zoom);
                ctx.fillText('RST', topLeft.x + 8 * camera.zoom, topLeft.y + 2*size.height/3 + 3 * camera.zoom);
                ctx.textAlign = 'center';
            }
        }
        
        if (this.type === 'selector') {
            // Draw switch diagram
            ctx.font = `${8 * camera.zoom}px Courier New`;
            ctx.fillStyle = themeColors.primary;
            ctx.textAlign = 'left';
            
            // Input labels
            ctx.fillText('A', topLeft.x + 8 * camera.zoom, topLeft.y + size.height/3 + 3 * camera.zoom);
            ctx.fillText('B', topLeft.x + 8 * camera.zoom, topLeft.y + 2*size.height/3 + 3 * camera.zoom);
            
            // Draw switch representation
            const centerX = topLeft.x + size.width/2;
            const centerY = topLeft.y + size.height/2;
            const switchRadius = 8 * camera.zoom;
            
            // Common point (output side)
            ctx.beginPath();
            ctx.arc(centerX + 10 * camera.zoom, centerY, 2 * camera.zoom, 0, 2 * Math.PI);
            ctx.fill();
            
            // Contact points
            const contactAY = topLeft.y + size.height/3;
            const contactBY = topLeft.y + 2*size.height/3;
            
            ctx.beginPath();
            ctx.arc(centerX - 10 * camera.zoom, contactAY, 2 * camera.zoom, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(centerX - 10 * camera.zoom, contactBY, 2 * camera.zoom, 0, 2 * Math.PI);
            ctx.fill();
            
            // Switch arm pointing to selected input
            const selectedY = this.selectedInput === 0 ? contactAY : contactBY;
            ctx.strokeStyle = themeColors.primary;
            ctx.lineWidth = 2 * camera.zoom;
            ctx.beginPath();
            ctx.moveTo(centerX + 10 * camera.zoom, centerY);
            ctx.lineTo(centerX - 8 * camera.zoom, selectedY);
            ctx.stroke();
            
            ctx.textAlign = 'center';
        }
        
        if (this.type === 'xyPlot') {
            // Draw input labels
            ctx.font = `${8 * camera.zoom}px Courier New`;
            ctx.fillStyle = themeColors.primary;
            ctx.textAlign = 'left';
            
            ctx.fillText('X', topLeft.x + 8 * camera.zoom, topLeft.y + size.height/5 + 3 * camera.zoom);
            ctx.fillText('Y', topLeft.x + 8 * camera.zoom, topLeft.y + 2*size.height/5 + 3 * camera.zoom);
            ctx.fillText('CLK', topLeft.x + 8 * camera.zoom, topLeft.y + 3*size.height/5 + 3 * camera.zoom);
            ctx.fillText('CLR', topLeft.x + 8 * camera.zoom, topLeft.y + 4*size.height/5 + 3 * camera.zoom);
            
            // Draw plot area (inner rectangle) - matching graph block styling
            const plotMargin = 25 * camera.zoom;
            const plotX = topLeft.x + plotMargin;
            const plotY = topLeft.y + plotMargin;
            const plotWidth = size.width - 2 * plotMargin;
            const plotHeight = size.height - 2 * plotMargin;
            
            // Graph background border - match regular graph block
            ctx.strokeStyle = '#055505';
            ctx.lineWidth = 1;
            ctx.strokeRect(plotX, plotY, plotWidth, plotHeight);
            
            // Draw axes - match regular graph block styling
            const centerX = plotX + plotWidth / 2;
            const centerY = plotY + plotHeight / 2;
            
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(plotX, centerY);
            ctx.lineTo(plotX + plotWidth, centerY);
            ctx.moveTo(centerX, plotY);
            ctx.lineTo(centerX, plotY + plotHeight);
            ctx.stroke();
            
            // Draw data points
            if (this.plotData.length > 0) {
                ctx.fillStyle = themeColors.primary;
                
                for (let point of this.plotData) {
                    let screenX, screenY;
                    
                    if (this.xLogScale && point.x > 0) {
                        const logX = Math.log10(point.x);
                        const logXMin = this.xMin > 0 ? Math.log10(this.xMin) : Math.log10(0.1);
                        const logXMax = this.xMax > 0 ? Math.log10(this.xMax) : Math.log10(10);
                        screenX = plotX + ((logX - logXMin) / (logXMax - logXMin)) * plotWidth;
                    } else {
                        screenX = plotX + ((point.x - this.xMin) / (this.xMax - this.xMin)) * plotWidth;
                    }
                    
                    if (this.yLogScale && point.y > 0) {
                        const logY = Math.log10(point.y);
                        const logYMin = this.yMin > 0 ? Math.log10(this.yMin) : Math.log10(0.1);
                        const logYMax = this.yMax > 0 ? Math.log10(this.yMax) : Math.log10(10);
                        screenY = plotY + plotHeight - ((logY - logYMin) / (logYMax - logYMin)) * plotHeight;
                    } else {
                        screenY = plotY + plotHeight - ((point.y - this.yMin) / (this.yMax - this.yMin)) * plotHeight;
                    }
                    
                    // Only draw if point is within plot area
                    if (screenX >= plotX && screenX <= plotX + plotWidth && 
                        screenY >= plotY && screenY <= plotY + plotHeight) {
                        ctx.fillRect(screenX - 1 * camera.zoom, screenY - 1 * camera.zoom, 2 * camera.zoom, 2 * camera.zoom);
                    }
                }
            }
            
            // Draw axis labels and ranges
            ctx.font = `${6 * camera.zoom}px Courier New`;
            ctx.textAlign = 'center';
            ctx.fillText(this.xMin.toFixed(1), plotX, plotY + plotHeight + 12 * camera.zoom);
            ctx.fillText(this.xMax.toFixed(1), plotX + plotWidth, plotY + plotHeight + 12 * camera.zoom);
            
            ctx.save();
            ctx.translate(plotX - 12 * camera.zoom, plotY);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(this.yMax.toFixed(1), 0, 0);
            ctx.restore();
            
            ctx.save();
            ctx.translate(plotX - 12 * camera.zoom, plotY + plotHeight);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(this.yMin.toFixed(1), 0, 0);
            ctx.restore();
            
            ctx.textAlign = 'center';
            
            // Show XY limits editing interface if editing
            if (this.editingXYLimits) {
                ctx.fillStyle = themeColors.background;
                ctx.fillRect(topLeft.x + 5, topLeft.y + 5, size.width - 10, 80 * camera.zoom);
                ctx.strokeStyle = themeColors.primary;
                ctx.strokeRect(topLeft.x + 5, topLeft.y + 5, size.width - 10, 80 * camera.zoom);
                
                ctx.fillStyle = themeColors.primary;
                ctx.font = `${7 * camera.zoom}px Courier New`;
                ctx.textAlign = 'left';
                
                // Show current limits and highlight the field being edited
                const fields = [
                    { label: 'X Min:', value: this.xMin, key: 'xMin' },
                    { label: 'X Max:', value: this.xMax, key: 'xMax' },
                    { label: 'Y Min:', value: this.yMin, key: 'yMin' },
                    { label: 'Y Max:', value: this.yMax, key: 'yMax' }
                ];
                
                for (let i = 0; i < fields.length; i++) {
                    const field = fields[i];
                    const x = topLeft.x + 10 + (i % 2) * (size.width/2 - 10);
                    const y = topLeft.y + 20 + Math.floor(i / 2) * 15 * camera.zoom;
                    
                    if (this.editingXYField === field.key) {
                        // Highlight current editing field
                        ctx.fillStyle = themeColors.primary;
                        ctx.fillRect(x, y - 8 * camera.zoom, 80 * camera.zoom, 12 * camera.zoom);
                        ctx.fillStyle = themeColors.background;
                        
                        const displayText = `${field.label} ${this.editText}`;
                        ctx.fillText(displayText, x + 2, y);
                        
                        // Draw cursor
                        const textWidth = ctx.measureText(`${field.label} ${this.editText.substring(0, this.editCursor)}`).width;
                        ctx.fillRect(x + 2 + textWidth, y - 8 * camera.zoom, 1, 12 * camera.zoom);
                    } else {
                        ctx.fillStyle = themeColors.primary;
                        ctx.fillText(`${field.label} ${field.value.toFixed(2)}`, x + 2, y);
                    }
                }
                
                // Instructions
                ctx.fillStyle = themeColors.primary;
                ctx.font = `${6 * camera.zoom}px Courier New`;
                ctx.textAlign = 'center';
                ctx.fillText('Tab: next field, Shift+Tab: prev field, Enter: save, Esc: cancel', topLeft.x + size.width/2, topLeft.y + 70 * camera.zoom);
            }
        }
        
        if (this.type === 'physicsBasic') {
            ctx.fillStyle = '#0f0';
            ctx.font = `${10 * camera.zoom}px Courier New`;
            ctx.textAlign = 'right';
            
            ctx.fillText('x', topLeft.x + size.width - 15 * camera.zoom, topLeft.y + this.height/5 * camera.zoom + 3 * camera.zoom);
            ctx.fillText('ẋ', topLeft.x + size.width - 15 * camera.zoom, topLeft.y + 2*this.height/5 * camera.zoom + 3 * camera.zoom);
            ctx.fillText('ẍ', topLeft.x + size.width - 15 * camera.zoom, topLeft.y + 3*this.height/5 * camera.zoom + 3 * camera.zoom);
        }
        
        if (this.type === 'graph') {
            const margin = 25 * camera.zoom;
            const graphArea = {
                x: topLeft.x + margin,
                y: topLeft.y + 20 * camera.zoom,
                width: size.width - margin - 20 * camera.zoom,
                height: size.height - 40 * camera.zoom
            };
            
            // Graph background
            ctx.strokeStyle = '#055505';
            ctx.lineWidth = 1;
            ctx.strokeRect(graphArea.x, graphArea.y, graphArea.width, graphArea.height);
            
            // Axes
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 1;
            
            // Y axis (left)
            ctx.beginPath();
            ctx.moveTo(graphArea.x, graphArea.y);
            ctx.lineTo(graphArea.x, graphArea.y + graphArea.height);
            ctx.stroke();
            
            // Y axis (right)
            ctx.beginPath();
            ctx.moveTo(graphArea.x + graphArea.width, graphArea.y);
            ctx.lineTo(graphArea.x + graphArea.width, graphArea.y + graphArea.height);
            ctx.stroke();
            
            // X axis
            ctx.beginPath();
            ctx.moveTo(graphArea.x, graphArea.y + graphArea.height);
            ctx.lineTo(graphArea.x + graphArea.width, graphArea.y + graphArea.height);
            ctx.stroke();
            
            // Axis labels
            ctx.fillStyle = '#0f0';
            ctx.font = `${8 * camera.zoom}px Courier New`;
            ctx.textAlign = 'right';
            
            // Left Y axis labels (dynamic)
            const leftLabels = [this.leftYMax, (this.leftYMax + this.leftYMin)/2, 0, (this.leftYMin + this.leftYMax)/2, this.leftYMin];
            for (let i = 0; i < leftLabels.length; i++) {
                const y = graphArea.y + (i / (leftLabels.length - 1)) * graphArea.height;
                ctx.fillText(leftLabels[i].toFixed(0), graphArea.x - 3 * camera.zoom, y + 3 * camera.zoom);
            }
            
            // Right Y axis labels (dynamic)
            ctx.textAlign = 'left';
            const rightLabels = [this.rightYMax, (this.rightYMax + this.rightYMin)/2, 0, (this.rightYMin + this.rightYMax)/2, this.rightYMin];
            for (let i = 0; i < rightLabels.length; i++) {
                const y = graphArea.y + (i / (rightLabels.length - 1)) * graphArea.height;
                ctx.fillText(rightLabels[i].toFixed(0), graphArea.x + graphArea.width + 3 * camera.zoom, y + 3 * camera.zoom);
            }
            
            // X axis labels (time)
            ctx.textAlign = 'center';
            const numTimeLabels = 5;
            for (let i = 0; i < numTimeLabels; i++) {
                const x = graphArea.x + (i / (numTimeLabels - 1)) * graphArea.width;
                const timeValue = Math.max(0, this.timeStep - this.maxDataPoints + (i / (numTimeLabels - 1)) * this.maxDataPoints);
                ctx.fillText(Math.round(timeValue).toString(), x, graphArea.y + graphArea.height + 12 * camera.zoom);
            }
            
            // Plot data
            const drawLine = (data, color, minVal, maxVal) => {
                if (data.length < 2) return;
                
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                
                for (let i = 0; i < data.length; i++) {
                    const x = graphArea.x + (i / (this.maxDataPoints - 1)) * graphArea.width;
                    const normalizedY = Math.max(0, Math.min(1, (data[i].y - minVal) / (maxVal - minVal)));
                    const y = graphArea.y + graphArea.height * (1 - normalizedY);
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
            };
            
            // Draw lines with dynamic scales
            drawLine(this.graphData1, '#0f0', this.leftYMin, this.leftYMax);  // Left axis scale
            drawLine(this.graphData2, '#f80', this.rightYMin, this.rightYMax);    // Right axis scale
            
            // Show Y-axis limits editing interface if editing
            if (this.editingYLimits) {
                ctx.fillStyle = themeColors.background;
                ctx.fillRect(topLeft.x + 5, topLeft.y + 5, size.width - 10, 50 * camera.zoom);
                ctx.strokeStyle = themeColors.primary;
                ctx.strokeRect(topLeft.x + 5, topLeft.y + 5, size.width - 10, 50 * camera.zoom);
                
                ctx.fillStyle = themeColors.primary;
                ctx.font = `${7 * camera.zoom}px Courier New`;
                ctx.textAlign = 'left';
                
                // Show current limits and highlight the field being edited
                const fields = [
                    { label: 'L+:', value: this.leftYMax, key: 'leftMax' },
                    { label: 'L-:', value: this.leftYMin, key: 'leftMin' },
                    { label: 'R+:', value: this.rightYMax, key: 'rightMax' },
                    { label: 'R-:', value: this.rightYMin, key: 'rightMin' }
                ];
                
                for (let i = 0; i < fields.length; i++) {
                    const field = fields[i];
                    const x = topLeft.x + 10 + (i % 2) * (size.width/2 - 10);
                    const y = topLeft.y + 20 + Math.floor(i/2) * 20 * camera.zoom;
                    
                    if (this.editingField === field.key) {
                        // Highlight current editing field
                        ctx.fillStyle = themeColors.primary;
                        ctx.fillRect(x, y - 8 * camera.zoom, 70 * camera.zoom, 12 * camera.zoom);
                        ctx.fillStyle = themeColors.background;
                        
                        const displayText = `${field.label}${this.editText}`;
                        ctx.fillText(displayText, x + 2, y);
                        
                        // Draw cursor
                        const textBeforeCursor = `${field.label}${this.editText.slice(0, this.editCursor)}`;
                        const textWidth = ctx.measureText(textBeforeCursor).width;
                        ctx.strokeStyle = themeColors.background;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(x + 2 + textWidth, y - 6 * camera.zoom);
                        ctx.lineTo(x + 2 + textWidth, y + 2 * camera.zoom);
                        ctx.stroke();
                        
                        ctx.fillStyle = themeColors.primary;
                    } else {
                        ctx.fillText(`${field.label}${field.value}`, x, y);
                    }
                }
                
                ctx.fillStyle = themeColors.primary;
                ctx.font = `${6 * camera.zoom}px Courier New`;
                ctx.textAlign = 'center';
                ctx.fillText('↓/↑: navigate fields, Enter: save, Esc: cancel', topLeft.x + size.width/2, topLeft.y + 50 * camera.zoom);
            }
        }
        
        // Show spring parameter editing interface if editing
        if (this.editingSpringParams) {
            ctx.fillStyle = themeColors.background;
            ctx.fillRect(topLeft.x + 5, topLeft.y + 5, size.width - 10, 60 * camera.zoom);
            ctx.strokeStyle = themeColors.primary;
            ctx.strokeRect(topLeft.x + 5, topLeft.y + 5, size.width - 10, 60 * camera.zoom);
            
            ctx.fillStyle = themeColors.primary;
            ctx.font = `${7 * camera.zoom}px Courier New`;
            ctx.textAlign = 'left';
            
            // Show current parameters and highlight the field being edited
            const fields = [
                { label: 'Mass:', value: this.physics.mass, key: 'mass' },
                { label: 'Spring:', value: this.physics.springConstant, key: 'springConstant' },
                { label: 'Damping:', value: this.physics.dampingCoeff, key: 'dampingCoeff' }
            ];
            
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                const x = topLeft.x + 10;
                const y = topLeft.y + 20 + i * 15 * camera.zoom;
                
                if (this.editingSpringField === field.key) {
                    // Highlight current editing field
                    ctx.fillStyle = themeColors.primary;
                    ctx.fillRect(x, y - 8 * camera.zoom, 80 * camera.zoom, 12 * camera.zoom);
                    ctx.fillStyle = themeColors.background;
                    
                    const displayText = `${field.label} ${this.editText}`;
                    ctx.fillText(displayText, x + 2, y);
                    
                    // Draw cursor
                    const textBeforeCursor = `${field.label} ${this.editText.slice(0, this.editCursor)}`;
                    const textWidth = ctx.measureText(textBeforeCursor).width;
                    ctx.strokeStyle = themeColors.background;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x + 2 + textWidth, y - 6 * camera.zoom);
                    ctx.lineTo(x + 2 + textWidth, y + 2 * camera.zoom);
                    ctx.stroke();
                    
                    ctx.fillStyle = themeColors.primary;
                } else {
                    ctx.fillText(`${field.label} ${field.value.toFixed(2)}`, x, y);
                }
            }
            
            ctx.fillStyle = themeColors.primary;
            ctx.font = `${6 * camera.zoom}px Courier New`;
            ctx.textAlign = 'center';
            ctx.fillText('↓/↑: navigate fields, Enter: save, Esc: cancel', topLeft.x + size.width/2, topLeft.y + 60 * camera.zoom);
        }
        
        // Show XY limits editing interface if editing
        if (this.editingXYLimits) {
            ctx.fillStyle = themeColors.background;
            ctx.fillRect(topLeft.x + 5, topLeft.y + 5, size.width - 10, 80 * camera.zoom);
            ctx.strokeStyle = themeColors.primary;
            ctx.strokeRect(topLeft.x + 5, topLeft.y + 5, size.width - 10, 80 * camera.zoom);
            
            ctx.fillStyle = themeColors.primary;
            ctx.font = `${7 * camera.zoom}px Courier New`;
            ctx.textAlign = 'left';
            
            // Show current parameters and highlight the field being edited
            const fields = [
                { label: 'X Min:', value: this.xMin, key: 'xMin' },
                { label: 'X Max:', value: this.xMax, key: 'xMax' },
                { label: 'Y Min:', value: this.yMin, key: 'yMin' },
                { label: 'Y Max:', value: this.yMax, key: 'yMax' }
            ];
            
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                const x = topLeft.x + 10;
                const y = topLeft.y + 20 + i * 12 * camera.zoom;
                
                if (this.editingXYField === field.key) {
                    // Highlight current editing field
                    ctx.fillStyle = themeColors.primary;
                    ctx.fillRect(x, y - 8 * camera.zoom, 80 * camera.zoom, 10 * camera.zoom);
                    ctx.fillStyle = themeColors.background;
                    
                    const displayText = `${field.label} ${this.editText}`;
                    ctx.fillText(displayText, x + 2, y);
                    
                    // Draw cursor
                    const textBeforeCursor = `${field.label} ${this.editText.slice(0, this.editCursor)}`;
                    const textWidth = ctx.measureText(textBeforeCursor).width;
                    ctx.strokeStyle = themeColors.background;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x + 2 + textWidth, y - 6 * camera.zoom);
                    ctx.lineTo(x + 2 + textWidth, y + 2 * camera.zoom);
                    ctx.stroke();
                    
                    ctx.fillStyle = themeColors.primary;
                } else {
                    ctx.fillText(`${field.label} ${field.value.toFixed(2)}`, x, y);
                }
            }
            
            // Show log scale status
            ctx.font = `${6 * camera.zoom}px Courier New`;
            ctx.fillText(`X Log: ${this.xLogScale ? 'ON' : 'OFF'}`, topLeft.x + 100, topLeft.y + 20);
            ctx.fillText(`Y Log: ${this.yLogScale ? 'ON' : 'OFF'}`, topLeft.x + 100, topLeft.y + 35);
            
            ctx.fillStyle = themeColors.primary;
            ctx.font = `${5 * camera.zoom}px Courier New`;
            ctx.textAlign = 'center';
            ctx.fillText('↓/↑: navigate, x/y: toggle log scales, Enter: save, Esc: cancel', topLeft.x + size.width/2, topLeft.y + 75 * camera.zoom);
        }
        
        for (let port of this.ports) {
            port.draw(ctx, camera, canvas);
        }
        
        if (this.physics) {
            this.physics.draw(ctx, camera, canvas);
        }
    }
}

class CommandWindow {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 300;
        this.height = 140;
        this.active = true;
        this.text = '';
        this.cursor = 0;
        this.commands = [
            'inNum', 'inSlider', 'outNum', 
            'multiply', 'divide', 'gain', 'offset', '20log10', '10log10', 'deg2rad', 'rad2deg', 'sineGen', 'sineAnalyser', 'clock', 'counter', 'selector', 'massOnPlane', 'springMassDamper', 'graph', 'grid', 'a2g', 'delete', 'save', 'load'
        ];
        this.completions = [];
        this.completionIndex = -1;
    }
    
    handleKey(key) {
        if (key === 'Backspace') {
            if (this.cursor > 0) {
                this.text = this.text.slice(0, this.cursor - 1) + this.text.slice(this.cursor);
                this.cursor--;
                this.updateCompletions();
            }
        } else if (key === 'ArrowLeft') {
            this.cursor = Math.max(0, this.cursor - 1);
        } else if (key === 'ArrowRight') {
            this.cursor = Math.min(this.text.length, this.cursor + 1);
        } else if (key === 'ArrowUp') {
            if (this.completions.length > 0) {
                this.completionIndex = Math.max(0, this.completionIndex - 1);
            }
        } else if (key === 'ArrowDown') {
            if (this.completions.length > 0) {
                this.completionIndex = Math.min(this.completions.length - 1, this.completionIndex + 1);
            }
        } else if (key === 'Tab') {
            if (this.completions.length > 0) {
                const selectedCompletion = this.completions[Math.max(0, this.completionIndex)];
                this.text = selectedCompletion;
                this.cursor = this.text.length;
                this.updateCompletions();
            }
        } else if (key.length === 1) {
            this.text = this.text.slice(0, this.cursor) + key + this.text.slice(this.cursor);
            this.cursor++;
            this.updateCompletions();
        }
    }
    
    updateCompletions() {
        if (this.text.length === 0) {
            this.completions = [];
            this.completionIndex = -1;
        } else {
            this.completions = this.commands.filter(cmd => 
                cmd.toLowerCase().startsWith(this.text.toLowerCase())
            );
            this.completionIndex = this.completions.length > 0 ? 0 : -1;
        }
    }
    
    draw(ctx, camera, canvas, colors) {
        const topLeft = camera.worldToScreen(this.x, this.y, canvas);
        const size = {
            width: this.width * camera.zoom,
            height: this.height * camera.zoom
        };
        
        const themeColors = colors || { 
            primary: '#0f0', 
            fill: '#002200',
            secondary: '#055505'
        };
        
        ctx.fillStyle = themeColors.fill;
        ctx.strokeStyle = themeColors.primary;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = themeColors.primary;
        
        ctx.fillRect(topLeft.x, topLeft.y, size.width, size.height);
        ctx.strokeRect(topLeft.x, topLeft.y, size.width, size.height);
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = themeColors.primary;
        ctx.font = `${14 * camera.zoom}px Courier New`;
        ctx.textAlign = 'left';
        
        ctx.fillText(this.text, topLeft.x + 5 * camera.zoom, topLeft.y + 20 * camera.zoom);
        
        const textWidth = ctx.measureText(this.text.slice(0, this.cursor)).width;
        ctx.strokeStyle = themeColors.primary;
        ctx.beginPath();
        ctx.moveTo(topLeft.x + 5 * camera.zoom + textWidth, topLeft.y + 5 * camera.zoom);
        ctx.lineTo(topLeft.x + 5 * camera.zoom + textWidth, topLeft.y + 25 * camera.zoom);
        ctx.stroke();
        
        ctx.fillStyle = themeColors.secondary;
        ctx.font = `${11 * camera.zoom}px Courier New`;
        
        if (this.completions.length > 0 && this.text.length > 0) {
            ctx.fillText('Completions (↑↓ to select, Tab to complete):', topLeft.x + 5 * camera.zoom, topLeft.y + 45 * camera.zoom);
            
            let yOffset = 60 * camera.zoom;
            for (let i = 0; i < this.completions.length; i++) {
                if (i > 0 && i % 2 === 0) {
                    yOffset += 15 * camera.zoom;
                }
                const xOffset = (i % 2) * 140 * camera.zoom;
                const x = topLeft.x + 5 * camera.zoom + xOffset;
                const y = topLeft.y + yOffset;
                
                // Highlight selected completion
                if (i === this.completionIndex) {
                    ctx.fillStyle = themeColors.primary;
                    ctx.fillRect(x - 2, y - 12 * camera.zoom, 135 * camera.zoom, 14 * camera.zoom);
                    ctx.fillStyle = themeColors.background;
                } else {
                    ctx.fillStyle = themeColors.secondary;
                }
                
                ctx.fillText(this.completions[i], x, y);
            }
        } else {
            ctx.fillText('Available commands:', topLeft.x + 5 * camera.zoom, topLeft.y + 45 * camera.zoom);
            
            let yOffset = 60 * camera.zoom;
            for (let i = 0; i < this.commands.length; i++) {
                if (i > 0 && i % 2 === 0) {
                    yOffset += 15 * camera.zoom;
                }
                const xOffset = (i % 2) * 140 * camera.zoom;
                ctx.fillText(this.commands[i], topLeft.x + 5 * camera.zoom + xOffset, topLeft.y + yOffset);
            }
        }
    }
}

class DraggableWindows {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = new Camera();
        this.windows = [];
        this.connectors = [];
        this.commandWindow = null;
        this.dragConnection = null;
        this.draggingCamera = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.currentMousePos = { x: 0, y: 0 };
        this.commandMenuPos = null;
        this.gridEnabled = true;
        this.gridSize = 25; // Half the size of output block (50)
        this.deleteMode = false;
        this.theme = this.getCurrentTheme();
        
        // Double-click detection
        this.lastClickTime = 0;
        this.lastClickWindow = null;
        
        this.setupEventListeners();
        this.animate();
    }
    
    getCurrentTheme() {
        return document.body.hasAttribute('data-theme') ? 'light' : 'dark';
    }
    
    getThemeColors() {
        if (this.getCurrentTheme() === 'light') {
            return {
                primary: '#008b8b',
                secondary: '#20b2aa',
                background: '#fafafa',
                fill: '#f0ffff',
                grid: '#20b2aa40',
                gridDots: '#20b2aa',
                crosshair: '#ff6347'
            };
        } else {
            return {
                primary: '#0f0',
                secondary: '#4f4',
                background: '#000',
                fill: '#001100',
                grid: '#004400',
                gridDots: '#006600',
                crosshair: '#ff0000'
            };
        }
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Make canvas focusable and focus it
        this.canvas.tabIndex = 0;
        this.canvas.style.outline = 'none';
        
        this.currentMousePos = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        
        // Add keydown listener directly to this canvas only with proper event isolation
        this.canvas.addEventListener('keydown', (e) => {
            console.log(`[${this.canvas.id}] Canvas keydown:`, e.key, 'activeElement:', document.activeElement?.id);
            e.stopPropagation(); // Prevent event from bubbling to other canvases
            this.handleKeyDown(e);
        });
        
        // Add mouse enter/leave to manage focus better
        this.canvas.addEventListener('mouseenter', () => {
            console.log(`[${this.canvas.id}] Mouse entered - focusing canvas`);
            this.canvas.focus();
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            console.log(`[${this.canvas.id}] Mouse left canvas`);
        });
        
        console.log('Event listeners set up for canvas:', this.canvas.id);
    }
    
    handleMouseDown(e) {
        this.canvas.focus();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.currentMousePos = { x, y };
        
        if (e.button === 2) {
            this.draggingCamera = true;
            this.lastMousePos = { x, y };
            return;
        }
        
        if (this.commandWindow) {
            this.commandWindow = null;
            return;
        }
        
        // Check for delete mode - delete window under cursor
        if (this.deleteMode) {
            for (let i = this.windows.length - 1; i >= 0; i--) {
                let window = this.windows[i];
                if (window.contains(x, y, this.camera, this.canvas)) {
                    console.log(`[${this.canvas.id}] Deleting window:`, window.title);
                    this.deleteWindow(window);
                    this.deleteMode = false; // Exit delete mode after deletion
                    return;
                }
            }
            // If no window was clicked, exit delete mode
            this.deleteMode = false;
            return;
        }
        
        const worldPos = this.camera.screenToWorld(x, y, this.canvas);
        
        for (let window of this.windows) {
            for (let port of window.ports) {
                if (port.contains(x, y, this.camera, this.canvas)) {
                    if (port.type === 'input') {
                        // Clicking input port disconnects all connections to it
                        if (port.connections.length > 0) {
                            // Disconnect all connectors connected to this input port
                            const connectorsToRemove = [...port.connections];
                            for (let connector of connectorsToRemove) {
                                this.removeConnector(connector);
                            }
                        }
                    } else if (port.type === 'output') {
                        // Clicking output port starts a drag connection
                        this.dragConnection = { port, startX: x, startY: y };
                    }
                    return;
                }
            }
        }
        
        for (let i = this.windows.length - 1; i >= 0; i--) {
            let window = this.windows[i];
            if (window.containsValueArea(x, y, this.camera, this.canvas)) {
                this.stopAllEditing();
                this.focusWindow(window);
                window.startEdit();
                return;
            }
            if (window.contains(x, y, this.camera, this.canvas)) {
                this.stopAllEditing();
                this.focusWindow(window);
                
                // Check for double-click on special blocks
                const currentTime = Date.now();
                if (this.lastClickWindow === window && currentTime - this.lastClickTime < 300) {
                    // Double-click detected
                    if (window.type === 'graph') {
                        window.startYAxisEdit();
                    } else if (window.type === 'springMassDamper') {
                        window.startSpringParamsEdit();
                    } else if (window.type === 'counter') {
                        window.startCounterParamsEdit();
                    } else if (window.type === 'xyPlot') {
                        window.startXYLimitsEdit();
                    } else if (window.type === 'selector') {
                        // Toggle the selector
                        window.selectedInput = window.selectedInput === 0 ? 1 : 0;
                        console.log(`[${this.canvas.id}] Selector switched to input ${window.selectedInput === 0 ? 'A' : 'B'}`);
                    } else {
                        // Single click - start dragging
                        window.startDrag(x, y, this.camera, this.canvas);
                    }
                } else {
                    // Single click - start dragging
                    window.startDrag(x, y, this.camera, this.canvas);
                }
                
                // Update click tracking
                this.lastClickTime = currentTime;
                this.lastClickWindow = window;
                return;
            }
        }
        
        this.stopAllEditing();
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.currentMousePos = { x, y };
        
        if (this.draggingCamera) {
            const dx = x - this.lastMousePos.x;
            const dy = y - this.lastMousePos.y;
            this.camera.pan(-dx, -dy);
            this.lastMousePos = { x, y };
            return;
        }
        
        for (let window of this.windows) {
            window.updateDrag(x, y, this.camera, this.canvas, this);
        }
    }
    
    handleMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.draggingCamera = false;
        
        if (this.dragConnection) {
            // Only allow connections from output to input
            if (this.dragConnection.port.type === 'output') {
                for (let window of this.windows) {
                    for (let port of window.ports) {
                        if (port.contains(x, y, this.camera, this.canvas) && 
                            port !== this.dragConnection.port &&
                            port.type === 'input') {
                            // Disconnect any existing connection to this input port first
                            if (port.connections.length > 0) {
                                const connectorsToRemove = [...port.connections];
                                for (let connector of connectorsToRemove) {
                                    this.removeConnector(connector);
                                }
                            }
                            // Create new connection
                            this.createConnector(this.dragConnection.port, port);
                            break;
                        }
                    }
                }
            }
            this.dragConnection = null;
        }
        
        for (let window of this.windows) {
            window.stopDrag();
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        this.camera.zoomAt(factor, x, y, this.canvas);
    }
    
    handleKeyDown(e) {
        console.log(`[${this.canvas.id}] Key pressed:`, e.key, 'Code:', e.code, 'Target:', e.target.id);
        
        if (this.commandWindow) {
            console.log(`[${this.canvas.id}] Command window active, handling key:`, e.key);
            if (e.key === 'Enter') {
                this.executeCommand(this.commandWindow.text);
                this.commandWindow = null;
            } else if (e.key === 'Escape') {
                this.commandWindow = null;
            } else {
                this.commandWindow.handleKey(e.key);
            }
            e.preventDefault();
            return;
        }
        
        for (let window of this.windows) {
            if ((window.editing || window.editingYLimits || window.editingSpringParams || window.editingCounterParams || window.editingXYLimits) && window.handleEditKey(e.key)) {
                console.log(`[${this.canvas.id}] Window editing handled key:`, e.key);
                e.preventDefault();
                return;
            }
        }
        
        if (e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar') {
            console.log(`[${this.canvas.id}] SPACEBAR DETECTED! Mouse pos:`, this.currentMousePos);
            e.preventDefault();
            e.stopPropagation();
            
            const worldPos = this.camera.screenToWorld(this.currentMousePos.x, this.currentMousePos.y, this.canvas);
            this.commandMenuPos = { x: worldPos.x, y: worldPos.y };
            this.commandWindow = new CommandWindow(worldPos.x - 150, worldPos.y + 20);
            console.log(`[${this.canvas.id}] Command window created at world pos:`, worldPos);
            
            return false;
        }
        
        // Delete key toggles delete mode
        if (e.key === 'Delete') {
            this.deleteMode = !this.deleteMode;
            console.log(`[${this.canvas.id}] Delete mode ${this.deleteMode ? 'enabled' : 'disabled'}`);
            e.preventDefault();
            return;
        }
        
        // Test key for debugging - remove this later
        if (e.key === 't' || e.key === 'T') {
            console.log(`[${this.canvas.id}] TEST KEY: Creating command window at mouse pos`);
            const worldPos = this.camera.screenToWorld(this.currentMousePos.x, this.currentMousePos.y, this.canvas);
            this.commandMenuPos = { x: worldPos.x, y: worldPos.y };
            this.commandWindow = new CommandWindow(worldPos.x - 150, worldPos.y + 20);
            e.preventDefault();
        }
    }
    
    stopAllEditing() {
        for (let window of this.windows) {
            window.stopEdit();
            if (window.editingYLimits) {
                window.editingYLimits = false;
                window.editingField = null;
                window.editText = '';
                window.editCursor = 0;
            }
            if (window.editingSpringParams) {
                window.editingSpringParams = false;
                window.editingSpringField = null;
                window.editText = '';
                window.editCursor = 0;
            }
            if (window.editingCounterParams) {
                window.editingCounterParams = false;
                window.editingCounterField = null;
                window.editText = '';
                window.editCursor = 0;
            }
            if (window.editingXYLimits) {
                window.editingXYLimits = false;
                window.editingXYField = null;
                window.editText = '';
                window.editCursor = 0;
            }
        }
    }
    
    handleKeyUp(e) {
    }
    
    executeCommand(command) {
        const worldPos = this.commandMenuPos || this.camera.screenToWorld(this.currentMousePos.x, this.currentMousePos.y, this.canvas);
        console.log(`[${this.canvas.id}] Executing command:`, command, 'at world pos:', worldPos);
        console.log(`[${this.canvas.id}] Current windows before command:`, this.windows.length);
        
        switch (command.toLowerCase()) {
            case 'innum':
                this.createWindow(worldPos.x - 50, worldPos.y + 50, 100, 50, 'Number', 'inputNumber');
                break;
            case 'inslider':
                this.createWindow(worldPos.x - 60, worldPos.y + 50, 120, 60, 'Slider', 'inputSlider');
                break;
            case 'outnum':
                this.createWindow(worldPos.x - 50, worldPos.y + 50, 100, 50, 'Output', 'outputNumber');
                break;
            case 'multiply':
                this.createWindow(worldPos.x - 40, worldPos.y + 50, 80, 60, 'Multiply', 'multiply');
                break;
            case 'divide':
                this.createWindow(worldPos.x - 40, worldPos.y + 50, 80, 60, 'Divide', 'divide');
                break;
            case 'gain':
                this.createWindow(worldPos.x - 30, worldPos.y + 50, 60, 40, 'Gain', 'gain');
                break;
            case 'offset':
                console.log(`[${this.canvas.id}] Creating offset block at:`, worldPos);
                this.createWindow(worldPos.x - 30, worldPos.y + 50, 60, 40, 'Offset', 'offset');
                break;
            case '20log10':
                this.createWindow(worldPos.x - 50, worldPos.y + 50, 100, 60, '20log10', '20log10');
                break;
            case '10log10':
                this.createWindow(worldPos.x - 50, worldPos.y + 50, 100, 60, '10log10', '10log10');
                break;
            case 'deg2rad':
                this.createWindow(worldPos.x - 50, worldPos.y + 50, 100, 60, 'deg2rad', 'deg2rad');
                break;
            case 'rad2deg':
                this.createWindow(worldPos.x - 50, worldPos.y + 50, 100, 60, 'rad2deg', 'rad2deg');
                break;
            case 'sinegen':
                this.createWindow(worldPos.x - 60, worldPos.y + 50, 120, 80, 'Sine Generator', 'sineGen');
                break;
            case 'sineanalyser':
                this.createWindow(worldPos.x - 80, worldPos.y + 50, 160, 120, 'Sine Analyser', 'sineAnalyser');
                break;
            case 'clock':
                this.createWindow(worldPos.x - 40, worldPos.y + 50, 80, 50, 'Clock', 'clock');
                break;
            case 'counter':
                this.createWindow(worldPos.x - 50, worldPos.y + 50, 100, 60, 'Counter', 'counter');
                break;
            case 'selector':
                this.createWindow(worldPos.x - 40, worldPos.y + 50, 80, 60, 'Selector', 'selector');
                break;
            case 'xyplot':
                this.createWindow(worldPos.x - 100, worldPos.y + 50, 200, 140, 'XY Plot', 'xyPlot');
                break;
            case 'massonplane':
                this.createWindow(worldPos.x - 100, worldPos.y + 50, 200, 140, 'Mass on Plane', 'physicsBasic');
                break;
            case 'springmassdamper':
                this.createWindow(worldPos.x - 100, worldPos.y + 50, 200, 140, 'Spring-Mass-Damper', 'springMassDamper');
                break;
            case 'graph':
                this.createWindow(worldPos.x - 100, worldPos.y + 50, 200, 140, 'Graph', 'graph');
                break;
            case 'grid':
                this.gridEnabled = !this.gridEnabled;
                console.log(`[${this.canvas.id}] Grid ${this.gridEnabled ? 'enabled' : 'disabled'}`);
                break;
            case 'a2g':
                this.alignAllToGrid();
                console.log(`[${this.canvas.id}] Aligned ${this.windows.length} blocks to grid`);
                break;
            case 'delete':
                this.deleteMode = !this.deleteMode;
                console.log(`[${this.canvas.id}] Delete mode ${this.deleteMode ? 'enabled' : 'disabled'}`);
                break;
            case 'save':
                console.log(`[${this.canvas.id}] Save command executed on system with`, this.windows.length, 'windows');
                this.saveState();
                break;
            case 'load':
                this.loadState();
                break;
            default:
                console.log(`[${this.canvas.id}] Unknown command:`, command);
        }
        
        console.log(`[${this.canvas.id}] Current windows after command:`, this.windows.length);
        this.commandMenuPos = null;
    }
    
    snapToGrid(value) {
        if (!this.gridEnabled) return value;
        return Math.round(value / this.gridSize) * this.gridSize;
    }
    
    snapPointToGrid(x, y) {
        return {
            x: this.snapToGrid(x),
            y: this.snapToGrid(y)
        };
    }
    
    alignAllToGrid() {
        if (!this.gridEnabled) {
            console.log(`[${this.canvas.id}] Grid not enabled, cannot align to grid`);
            return;
        }
        
        for (let window of this.windows) {
            // Snap window position to grid
            const snappedPos = this.snapPointToGrid(window.x, window.y);
            window.x = snappedPos.x;
            window.y = snappedPos.y;
            
            // Update port positions after moving the window
            window.updatePortPositions();
        }
    }
    
    drawGrid() {
        const colors = this.getThemeColors();
        
        // Calculate visible area in world coordinates
        const topLeft = this.camera.screenToWorld(0, 0, this.canvas);
        const bottomRight = this.camera.screenToWorld(this.canvas.width, this.canvas.height, this.canvas);
        
        // Find starting grid positions
        const startX = Math.floor(topLeft.x / this.gridSize) * this.gridSize;
        const startY = Math.floor(topLeft.y / this.gridSize) * this.gridSize;
        
        // Draw fine grid lines
        this.ctx.strokeStyle = colors.grid;
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 0;
        
        this.ctx.beginPath();
        
        // Draw vertical lines
        for (let x = startX; x <= bottomRight.x + this.gridSize; x += this.gridSize) {
            const screenX = this.camera.worldToScreen(x, 0, this.canvas).x;
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, this.canvas.height);
        }
        
        // Draw horizontal lines
        for (let y = startY; y <= bottomRight.y + this.gridSize; y += this.gridSize) {
            const screenY = this.camera.worldToScreen(0, y, this.canvas).y;
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(this.canvas.width, screenY);
        }
        
        this.ctx.stroke();
        
        // Draw light dots at intersections
        this.ctx.fillStyle = colors.gridDots;
        
        for (let x = startX; x <= bottomRight.x + this.gridSize; x += this.gridSize) {
            for (let y = startY; y <= bottomRight.y + this.gridSize; y += this.gridSize) {
                const screenPos = this.camera.worldToScreen(x, y, this.canvas);
                
                // Only draw dots that are visible on screen
                if (screenPos.x >= 0 && screenPos.x <= this.canvas.width && 
                    screenPos.y >= 0 && screenPos.y <= this.canvas.height) {
                    
                    this.ctx.beginPath();
                    this.ctx.arc(screenPos.x, screenPos.y, 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
    }
    
    drawCrosshairs() {
        const colors = this.getThemeColors();
        this.ctx.strokeStyle = colors.crosshair;
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 5;
        this.ctx.shadowColor = colors.crosshair;
        
        this.ctx.beginPath();
        
        // Vertical line spanning full height
        this.ctx.moveTo(this.currentMousePos.x, 0);
        this.ctx.lineTo(this.currentMousePos.x, this.canvas.height);
        
        // Horizontal line spanning full width
        this.ctx.moveTo(0, this.currentMousePos.y);
        this.ctx.lineTo(this.canvas.width, this.currentMousePos.y);
        
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }
    
    createWindow(x, y, width, height, title, type, skipFocus = false) {
        const snappedPos = this.snapPointToGrid(x, y);
        const window = new BlockWindow(snappedPos.x, snappedPos.y, width, height, title, type);
        this.windows.push(window);
        if (!skipFocus) {
            this.focusWindow(window);
        }
        console.log(`[${this.canvas.id}] Created window:`, title, 'at pos:', snappedPos.x, snappedPos.y, 'Total windows now:', this.windows.length);
        return window;
    }
    
    focusWindow(window) {
        for (let w of this.windows) {
            w.focused = false;
        }
        window.focused = true;
        
        const index = this.windows.indexOf(window);
        if (index > -1) {
            this.windows.splice(index, 1);
            this.windows.push(window);
        }
    }
    
    clearAllFocus() {
        for (let w of this.windows) {
            w.focused = false;
        }
    }
    
    createConnector(startPort, endPort) {
        const connector = new Connector(startPort, endPort);
        this.connectors.push(connector);
        startPort.connections.push(connector);
        endPort.connections.push(connector);
    }
    
    removeConnector(connector) {
        const index = this.connectors.indexOf(connector);
        if (index > -1) {
            this.connectors.splice(index, 1);
            
            connector.startPort.connections = connector.startPort.connections.filter(c => c !== connector);
            connector.endPort.connections = connector.endPort.connections.filter(c => c !== connector);
        }
    }
    
    deleteWindow(window) {
        // Remove all connections to/from this window's ports
        for (let port of window.ports) {
            // Create a copy of connections array to avoid modification during iteration
            const connectionsToRemove = [...port.connections];
            for (let connector of connectionsToRemove) {
                this.removeConnector(connector);
            }
        }
        
        // Remove the window from the windows array
        const index = this.windows.indexOf(window);
        if (index > -1) {
            this.windows.splice(index, 1);
            console.log(`[${this.canvas.id}] Window deleted:`, window.title, 'Remaining windows:', this.windows.length);
        }
    }
    
    updateConnections() {
        const values = {};
        
        for (let window of this.windows) {
            for (let port of window.ports) {
                if (port.type === 'output') {
                    values[port.id] = port.value;
                }
            }
        }
        
        for (let connector of this.connectors) {
            if (connector.startPort.type === 'output' && connector.endPort.type === 'input') {
                values[connector.endPort.id] = connector.startPort.value;
            }
        }
        
        return values;
    }
    
    saveState() {
        console.log('Saving state. Windows count:', this.windows.length);
        console.log('Connectors count:', this.connectors.length);
        console.log('Windows array:', this.windows);
        console.log('Connectors array:', this.connectors);
        
        const state = {
            camera: {
                x: this.camera.x,
                y: this.camera.y,
                zoom: this.camera.zoom
            },
            windows: this.windows.map(w => {
                const windowData = {
                    x: w.x,
                    y: w.y,
                    width: w.width,
                    height: w.height,
                    title: w.title,
                    type: w.type,
                    value: w.value,
                    min: w.min,
                    max: w.max,
                    step: w.step,
                    id: w.id,
                    focused: w.focused,
                    editing: w.editing,
                    editText: w.editText,
                    editCursor: w.editCursor,
                    ports: w.ports.map(p => ({
                        id: p.id,
                        x: p.x,
                        y: p.y,
                        type: p.type,
                        value: p.value
                    })),
                    physics: w.physics ? {
                        x: w.physics.x,
                        y: w.physics.y,
                        velocity: w.physics.velocity,
                        acceleration: w.physics.acceleration,
                        type: w.physics.type,
                        restPosition: w.physics.restPosition,
                        springConstant: w.physics.springConstant,
                        dampingCoeff: w.physics.dampingCoeff,
                        windowX: w.physics.windowX,
                        windowY: w.physics.windowY,
                        windowWidth: w.physics.windowWidth,
                        windowHeight: w.physics.windowHeight,
                        mass: w.physics.mass,
                        friction: w.physics.friction,
                        size: w.physics.size,
                        groundY: w.physics.groundY,
                        springAttachX: w.physics.springAttachX
                    } : null,
                    graphData1: w.graphData1 || [],
                    graphData2: w.graphData2 || [],
                    timeStep: w.timeStep || 0,
                    maxDataPoints: w.maxDataPoints || 200,
                    // Graph Y-axis limits
                    leftYMin: w.leftYMin,
                    leftYMax: w.leftYMax,
                    rightYMin: w.rightYMin,
                    rightYMax: w.rightYMax,
                    // Sine generator properties
                    amplitude: w.amplitude,
                    frequency: w.frequency,
                    phase: w.phase,
                    time: w.time,
                    // Sine analyzer properties
                    topFrequency: w.topFrequency,
                    topAmplitude: w.topAmplitude,
                    bottomFrequency: w.bottomFrequency,
                    bottomAmplitude: w.bottomAmplitude,
                    phaseDifference: w.phaseDifference,
                    // XY Plot properties
                    plotData: w.plotData || [],
                    xMin: w.xMin,
                    xMax: w.xMax,
                    yMin: w.yMin,
                    yMax: w.yMax,
                    xLogScale: w.xLogScale,
                    yLogScale: w.yLogScale
                };
                console.log('Saving window:', windowData.title, 'type:', windowData.type);
                return windowData;
            }),
            connectors: this.connectors.map(c => ({
                id: c.id,
                startPortId: c.startPort.id,
                endPortId: c.endPort.id,
                nodes: c.nodes || []
            }))
        };
        
        console.log('Final state object:', state);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `simulation-${timestamp}.json`;
        
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    loadState() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        console.log('Loading file contents:', e.target.result);
                        const state = JSON.parse(e.target.result);
                        console.log('Parsed state:', state);
                        this.restoreState(state);
                        console.log('State restored successfully');
                    } catch (error) {
                        console.error('Failed to load state:', error);
                        alert('Failed to load file: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    restoreState(state) {
        console.log('Restoring state with', state.windows.length, 'windows and', state.connectors.length, 'connectors');
        
        this.windows = [];
        this.connectors = [];
        
        this.camera.x = state.camera.x;
        this.camera.y = state.camera.y;
        this.camera.zoom = state.camera.zoom;
        
        console.log('Camera restored to:', this.camera);
        
        const portMap = {};
        
        for (let windowData of state.windows) {
            console.log('Restoring window:', windowData.title, 'type:', windowData.type);
            const window = this.createWindow(
                windowData.x, windowData.y, 
                windowData.width, windowData.height,
                windowData.title, windowData.type
            );
            console.log('Window created successfully');
            window.value = windowData.value;
            window.min = windowData.min;
            window.max = windowData.max;
            window.step = windowData.step;
            window.id = windowData.id;
            window.focused = windowData.focused || false;
            window.editing = windowData.editing || false;
            window.editText = windowData.editText || '';
            window.editCursor = windowData.editCursor || 0;
            
            // Restore physics state
            if (windowData.physics && window.physics) {
                window.physics.x = windowData.physics.x;
                window.physics.y = windowData.physics.y;
                window.physics.velocity = windowData.physics.velocity || { x: 0, y: 0 };
                window.physics.acceleration = windowData.physics.acceleration || { x: 0, y: 0 };
                if (windowData.physics.restPosition !== undefined) {
                    window.physics.restPosition = windowData.physics.restPosition;
                }
                if (windowData.physics.springConstant !== undefined) {
                    window.physics.springConstant = windowData.physics.springConstant;
                }
                if (windowData.physics.dampingCoeff !== undefined) {
                    window.physics.dampingCoeff = windowData.physics.dampingCoeff;
                }
                if (windowData.physics.mass !== undefined) {
                    window.physics.mass = windowData.physics.mass;
                }
                if (windowData.physics.friction !== undefined) {
                    window.physics.friction = windowData.physics.friction;
                }
                if (windowData.physics.size !== undefined) {
                    window.physics.size = windowData.physics.size;
                }
                if (windowData.physics.groundY !== undefined) {
                    window.physics.groundY = windowData.physics.groundY;
                }
                if (windowData.physics.springAttachX !== undefined) {
                    window.physics.springAttachX = windowData.physics.springAttachX;
                }
            }
            
            // Restore graph data
            if (windowData.graphData1) {
                window.graphData1 = windowData.graphData1;
            }
            if (windowData.graphData2) {
                window.graphData2 = windowData.graphData2;
            }
            if (windowData.timeStep !== undefined) {
                window.timeStep = windowData.timeStep;
            }
            if (windowData.maxDataPoints !== undefined) {
                window.maxDataPoints = windowData.maxDataPoints;
            }
            
            // Restore graph Y-axis limits
            if (windowData.leftYMin !== undefined) {
                window.leftYMin = windowData.leftYMin;
            }
            if (windowData.leftYMax !== undefined) {
                window.leftYMax = windowData.leftYMax;
            }
            if (windowData.rightYMin !== undefined) {
                window.rightYMin = windowData.rightYMin;
            }
            if (windowData.rightYMax !== undefined) {
                window.rightYMax = windowData.rightYMax;
            }
            
            // Restore sine generator properties
            if (windowData.amplitude !== undefined) {
                window.amplitude = windowData.amplitude;
            }
            if (windowData.frequency !== undefined) {
                window.frequency = windowData.frequency;
            }
            if (windowData.phase !== undefined) {
                window.phase = windowData.phase;
            }
            if (windowData.time !== undefined) {
                window.time = windowData.time;
            }
            
            // Restore sine analyzer properties
            if (windowData.topFrequency !== undefined) {
                window.topFrequency = windowData.topFrequency;
            }
            if (windowData.topAmplitude !== undefined) {
                window.topAmplitude = windowData.topAmplitude;
            }
            if (windowData.bottomFrequency !== undefined) {
                window.bottomFrequency = windowData.bottomFrequency;
            }
            if (windowData.bottomAmplitude !== undefined) {
                window.bottomAmplitude = windowData.bottomAmplitude;
            }
            if (windowData.phaseDifference !== undefined) {
                window.phaseDifference = windowData.phaseDifference;
            }
            
            // Restore XY Plot properties
            if (windowData.plotData !== undefined) {
                window.plotData = windowData.plotData;
            }
            if (windowData.xMin !== undefined) {
                window.xMin = windowData.xMin;
            }
            if (windowData.xMax !== undefined) {
                window.xMax = windowData.xMax;
            }
            if (windowData.yMin !== undefined) {
                window.yMin = windowData.yMin;
            }
            if (windowData.yMax !== undefined) {
                window.yMax = windowData.yMax;
            }
            if (windowData.xLogScale !== undefined) {
                window.xLogScale = windowData.xLogScale;
            }
            if (windowData.yLogScale !== undefined) {
                window.yLogScale = windowData.yLogScale;
            }
            
            // Restore port data
            if (windowData.ports) {
                for (let i = 0; i < window.ports.length && i < windowData.ports.length; i++) {
                    window.ports[i].id = windowData.ports[i].id;
                    window.ports[i].value = windowData.ports[i].value || 0;
                }
            }
            
            for (let port of window.ports) {
                portMap[port.id] = port;
            }
        }
        
        console.log('Restoring connectors...');
        for (let connectorData of state.connectors) {
            const startPort = portMap[connectorData.startPortId];
            const endPort = portMap[connectorData.endPortId];
            console.log('Connector from', connectorData.startPortId, 'to', connectorData.endPortId);
            console.log('Start port found:', !!startPort, 'End port found:', !!endPort);
            if (startPort && endPort) {
                const connector = new Connector(startPort, endPort);
                connector.nodes = connectorData.nodes;
                this.connectors.push(connector);
                startPort.connections.push(connector);
                endPort.connections.push(connector);
                console.log('Connector restored successfully');
            } else {
                console.error('Failed to restore connector - missing ports');
            }
        }
        console.log('All connectors restored. Total:', this.connectors.length);
    }
    
    populateExample() {
        console.log('Populating example...');
        
        // Sine generator with input controls -> Gain -> Graph example (top)
        const amplitudeInput = this.createWindow(-500, -500, 100, 50, 'Amplitude', 'inputNumber');
        amplitudeInput.value = 2.0;
        
        const frequencyInput = this.createWindow(-500, -430, 100, 50, 'Frequency', 'inputNumber'); 
        frequencyInput.value = 0.5;
        
        const phaseDegreesInput = this.createWindow(-500, -360, 100, 50, 'Phase (deg)', 'inputNumber');
        phaseDegreesInput.value = 0;
        
        const deg2radWindow = this.createWindow(-350, -360, 80, 50, 'deg2rad', 'deg2rad');
        
        const sineGenWindow = this.createWindow(-200, -450, 120, 80, 'Sine Generator', 'sineGen');
        
        const gainWindow = this.createWindow(-50, -450, 60, 40, 'Gain', 'gain');
        gainWindow.value = 5.0;
        
        const sineGraphWindow = this.createWindow(100, -450, 200, 140, 'Sine Graph', 'graph');
        
        // Sine generator input connections
        this.createConnector(amplitudeInput.ports[0], sineGenWindow.ports[0]); // Amplitude
        this.createConnector(frequencyInput.ports[0], sineGenWindow.ports[1]); // Frequency  
        this.createConnector(phaseDegreesInput.ports[0], deg2radWindow.ports[0]); // Phase degrees to converter
        this.createConnector(deg2radWindow.ports[1], sineGenWindow.ports[2]); // Converted radians to sine gen
        
        // Sine generator output connections
        this.createConnector(sineGenWindow.ports[3], gainWindow.ports[0]);
        this.createConnector(gainWindow.ports[1], sineGraphWindow.ports[0]);
        
        // Spring-Mass-Damper system (middle)
        const springForceInput = this.createWindow(-300, -300, 100, 50, 'Spring Force', 'inputNumber');
        springForceInput.value = 20;
        console.log('Created spring force input, total windows:', this.windows.length);
        
        const springWindow = this.createWindow(-150, -300, 200, 140, 'Spring-Mass-Damper', 'springMassDamper');
        
        const springDispOutput = this.createWindow(100, -330, 100, 50, 'S-Position', 'outputNumber');
        const springVelOutput = this.createWindow(100, -260, 100, 50, 'S-Velocity', 'outputNumber');
        const springAccOutput = this.createWindow(100, -190, 100, 50, 'S-Accel', 'outputNumber');
        
        // Physics system input (middle)
        const forceXInput = this.createWindow(-300, -120, 100, 50, 'Force', 'inputNumber');
        forceXInput.value = 15;
        
        // Physics block
        const physicsWindow = this.createWindow(-150, -120, 200, 140, 'Physics', 'physicsBasic');
        
        // Physics outputs
        const dispOutput = this.createWindow(100, -150, 100, 50, 'Position', 'outputNumber');
        const velOutput = this.createWindow(100, -80, 100, 50, 'Velocity', 'outputNumber');
        const accOutput = this.createWindow(100, -10, 100, 50, 'Accel', 'outputNumber');
        
        // Graph block for physics
        const graphWindow = this.createWindow(250, -120, 200, 140, 'Graph', 'graph');
        
        // Graph block for spring-mass-damper
        const springGraphWindow = this.createWindow(250, -300, 200, 140, 'Spring Graph', 'graph');
        
        // Original multiply system (moved down)
        const inputWindow = this.createWindow(-200, 80, 100, 50, 'Input', 'inputNumber');
        inputWindow.value = 5;
        
        const multiplyWindow = this.createWindow(-50, 85, 80, 60, 'Multiply', 'multiply');
        
        const outputWindow = this.createWindow(100, 80, 100, 50, 'Output', 'outputNumber');
        
        const input2Window = this.createWindow(-200, 155, 100, 50, 'Input 2', 'inputNumber');
        input2Window.value = 3;
        
        // Spring-Mass-Damper connections
        this.createConnector(springForceInput.ports[0], springWindow.ports[0]);
        this.createConnector(springWindow.ports[1], springDispOutput.ports[0]);
        this.createConnector(springWindow.ports[2], springVelOutput.ports[0]);
        this.createConnector(springWindow.ports[3], springAccOutput.ports[0]);
        
        // Physics connections
        this.createConnector(forceXInput.ports[0], physicsWindow.ports[0]);
        this.createConnector(physicsWindow.ports[1], dispOutput.ports[0]);
        this.createConnector(physicsWindow.ports[2], velOutput.ports[0]);
        this.createConnector(physicsWindow.ports[3], accOutput.ports[0]);
        
        // Spring graph connections
        this.createConnector(springWindow.ports[1], springGraphWindow.ports[0]);
        this.createConnector(springWindow.ports[2], springGraphWindow.ports[1]);
        
        // Physics graph connections
        this.createConnector(physicsWindow.ports[1], graphWindow.ports[0]);
        this.createConnector(physicsWindow.ports[2], graphWindow.ports[1]);
        
        // Original multiply connections
        this.createConnector(inputWindow.ports[0], multiplyWindow.ports[0]);
        this.createConnector(input2Window.ports[0], multiplyWindow.ports[1]);
        this.createConnector(multiplyWindow.ports[2], outputWindow.ports[0]);
        
        // Clear focus from all demo windows so user can interact with them
        this.clearAllFocus();
    }
    
    populateSineAnalyzerDemo() {
        console.log('Populating sine analyzer demo...');
        
        // Shared amplitude and frequency inputs
        const sharedAmplitudeInput = this.createWindow(-600, -300, 100, 50, 'Amplitude', 'inputNumber');
        sharedAmplitudeInput.value = 3.0;
        
        const sharedFrequencyInput = this.createWindow(-600, -220, 100, 50, 'Frequency', 'inputNumber');
        sharedFrequencyInput.value = 1.5;
        
        // Separate phase inputs
        const phase1DegreesInput = this.createWindow(-600, -140, 100, 50, 'Phase1 (deg)', 'inputNumber');
        phase1DegreesInput.value = 0;
        
        const phase2DegreesInput = this.createWindow(-600, -60, 100, 50, 'Phase2 (deg)', 'inputNumber');
        phase2DegreesInput.value = 45; // 45 degree phase difference
        
        // Degree to radian converters
        const deg2rad1 = this.createWindow(-450, -140, 80, 50, 'deg2rad', 'deg2rad');
        const deg2rad2 = this.createWindow(-450, -60, 80, 50, 'deg2rad', 'deg2rad');
        
        // Two sine generators
        const sineGen1 = this.createWindow(-300, -250, 120, 80, 'Sine Gen 1', 'sineGen');
        const sineGen2 = this.createWindow(-300, -120, 120, 80, 'Sine Gen 2', 'sineGen');
        
        // Sine analyzer
        const sineAnalyser = this.createWindow(-100, -200, 160, 120, 'Sine Analyzer', 'sineAnalyser');
        
        // Output displays for the 5 analyzer outputs
        const freq1Output = this.createWindow(120, -280, 100, 50, 'Freq 1', 'outputNumber');
        const amp1Output = this.createWindow(120, -220, 100, 50, 'Amp 1', 'outputNumber');
        const freq2Output = this.createWindow(120, -160, 100, 50, 'Freq 2', 'outputNumber');
        const amp2Output = this.createWindow(120, -100, 100, 50, 'Amp 2', 'outputNumber');
        const phaseOutput = this.createWindow(120, -40, 100, 50, 'Phase Diff', 'outputNumber');
        
        // Connect shared inputs to both sine generators
        // Sine generator 1 connections
        this.createConnector(sharedAmplitudeInput.ports[0], sineGen1.ports[0]); // Amplitude
        this.createConnector(sharedFrequencyInput.ports[0], sineGen1.ports[1]); // Frequency
        this.createConnector(phase1DegreesInput.ports[0], deg2rad1.ports[0]); // Phase degrees to converter
        this.createConnector(deg2rad1.ports[1], sineGen1.ports[2]); // Converted radians to sine gen
        
        // Sine generator 2 connections  
        this.createConnector(sharedAmplitudeInput.ports[0], sineGen2.ports[0]); // Amplitude
        this.createConnector(sharedFrequencyInput.ports[0], sineGen2.ports[1]); // Frequency
        this.createConnector(phase2DegreesInput.ports[0], deg2rad2.ports[0]); // Phase degrees to converter
        this.createConnector(deg2rad2.ports[1], sineGen2.ports[2]); // Converted radians to sine gen
        
        // Connect sine generators to analyzer inputs
        this.createConnector(sineGen1.ports[3], sineAnalyser.ports[0]); // Top sine input
        this.createConnector(sineGen2.ports[3], sineAnalyser.ports[1]); // Bottom sine input
        
        // Connect analyzer outputs to display blocks
        this.createConnector(sineAnalyser.ports[2], freq1Output.ports[0]); // Top frequency
        this.createConnector(sineAnalyser.ports[3], amp1Output.ports[0]); // Top amplitude
        this.createConnector(sineAnalyser.ports[4], freq2Output.ports[0]); // Bottom frequency
        this.createConnector(sineAnalyser.ports[5], amp2Output.ports[0]); // Bottom amplitude
        this.createConnector(sineAnalyser.ports[6], phaseOutput.ports[0]); // Phase difference
        
        // Clear focus from all demo windows so user can interact with them
        this.clearAllFocus();
    }
    
    animate() {
        // Update theme if it changed
        const currentTheme = this.getCurrentTheme();
        if (currentTheme !== this.theme) {
            this.theme = currentTheme;
        }
        
        const colors = this.getThemeColors();
        this.ctx.fillStyle = colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.gridEnabled) {
            this.drawGrid();
        }
        
        const dt = 1/60;
        const inputs = this.updateConnections();
        
        for (let window of this.windows) {
            window.update(dt, inputs);
        }
        
        for (let connector of this.connectors) {
            connector.draw(this.ctx, this.camera, this.canvas, colors);
        }
        
        for (let window of this.windows) {
            window.draw(this.ctx, this.camera, this.canvas, colors);
        }
        
        if (this.dragConnection) {
            this.ctx.strokeStyle = colors.primary;
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = colors.primary;
            
            const startPort = this.dragConnection.port;
            const start = this.camera.worldToScreen(startPort.x, startPort.y, this.canvas);
            
            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(this.dragConnection.startX, this.dragConnection.startY);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
        
        if (this.commandWindow) {
            console.log('Drawing command window at:', this.commandWindow.x, this.commandWindow.y);
            this.commandWindow.draw(this.ctx, this.camera, this.canvas, colors);
        }
        
        if (this.deleteMode) {
            this.drawCrosshairs();
        }
        
        requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas1 = document.getElementById('canvas1');
    const canvas2 = document.getElementById('canvas2');
    
    console.log('Creating system1 for canvas1');
    const system1 = new DraggableWindows(canvas1);
    console.log('Creating system2 for canvas2');
    const system2 = new DraggableWindows(canvas2);
    
    console.log('Populating example on system1');
    system1.populateExample();
    
    console.log('Populating sine analyzer demo on system2');
    system2.populateSineAnalyzerDemo();
    
    console.log('Physics Simulation and Block Diagram Editor initialized');
    console.log('System1 (canvas1) windows after populate:', system1.windows.length);
    console.log('System1 (canvas1) connectors after populate:', system1.connectors.length);
    console.log('System2 (canvas2) windows after populate:', system2.windows.length);
    console.log('System2 (canvas2) connectors after populate:', system2.connectors.length);
    console.log('Press SPACEBAR to open command menu');
    console.log('Available commands: inputNumber, inputSlider, outputNumber, multiply, physicsBasic, save, load');
});