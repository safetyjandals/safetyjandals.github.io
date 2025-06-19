// Magnet Turner - Converted from p5.js to vanilla JavaScript

class MagnetTurner {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = 400;
        this.height = 400;
        
        // Set canvas size
        canvas.width = this.width;
        canvas.height = this.height;
        
        // Variables
        this.isAutoAngle = false;
        this.isTorqueRipple = false;
        this.isBackEMF = false;
        this.isFieldWeakening = false;
        
        this.angle = 0;
        this.bar_length = 100;
        this.bar_centre_x = 200;
        this.bar_centre_y = 200;
        
        this.stator_angle = 0;
        this.stator_diameter = 130;
        this.stator_diameter2 = 130;
        this.stator_length = 20;
        
        // Physics settings
        this.FrictionDynamicCoefficient = 10;
        this.FrictionStaticCoefficient = 0;
        this.rotationalInertia = 3;
        this.timeStep = 1/60;
        
        this.torque = 0;
        this.angularAcceleration = 0;
        this.angularVelocity = 0;
        this.angularAngle = 0;
        this.torqueFrictionStatic = 0;
        this.torqueFrictionDynamic = 0;
        this.backEMFSimulate = 0;
        
        // Mouse interaction
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMousePressed = false;
        
        // Slider value
        this.sliderAngle = 90;
        
        // Oscilloscope
        this.oscope = new Oscope();
        
        // Frame rate tracking
        this.lastTime = performance.now();
        this.frameRate = 60;
        
        // Run/stop state for performance control
        this.isRunning = true;
        
        this.setupEventListeners();
        this.animate();
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Checkbox events
        document.getElementById('autoAngle').addEventListener('change', (e) => {
            this.isAutoAngle = e.target.checked;
        });
        
        document.getElementById('backEMF').addEventListener('change', (e) => {
            this.isBackEMF = e.target.checked;
        });
        
        document.getElementById('torqueRipple').addEventListener('change', (e) => {
            this.isTorqueRipple = e.target.checked;
        });
        
        document.getElementById('fieldWeakening').addEventListener('change', (e) => {
            this.isFieldWeakening = e.target.checked;
        });
        
        // Slider event
        document.getElementById('angleSlider').addEventListener('input', (e) => {
            this.sliderAngle = parseInt(e.target.value);
        });
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        
        // Check if clicking on run/stop button (bottom-right corner)
        if (this.isRunStopButtonClick(this.mouseX, this.mouseY)) {
            this.toggleRunStop();
            return;
        }
        
        this.isMousePressed = true;
        this.updateStatorAngleFromMouse();
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        if (this.isMousePressed) {
            this.updateStatorAngleFromMouse();
        }
    }
    
    handleMouseUp(e) {
        this.isMousePressed = false;
    }
    
    updateStatorAngleFromMouse() {
        if (this.mouseY > 400) return;
        
        const len_x = this.mouseX - this.bar_centre_x;
        const len_y = this.mouseY - this.bar_centre_y;
        this.stator_angle = Math.atan2(len_y, len_x);
    }
    
    isRunStopButtonClick(x, y) {
        // Button is 60x30 pixels in bottom-right corner with 10px margin
        const buttonWidth = 60;
        const buttonHeight = 30;
        const margin = 10;
        
        const buttonX = this.width - buttonWidth - margin;
        const buttonY = this.height - buttonHeight - margin;
        
        return x >= buttonX && x <= buttonX + buttonWidth && 
               y >= buttonY && y <= buttonY + buttonHeight;
    }
    
    toggleRunStop() {
        this.isRunning = !this.isRunning;
        console.log(`Magnet Turner ${this.isRunning ? 'Running' : 'Stopped'}`);
    }
    
    drawRunStopButton() {
        const buttonWidth = 60;
        const buttonHeight = 30;
        const margin = 10;
        
        const buttonX = this.width - buttonWidth - margin;
        const buttonY = this.height - buttonHeight - margin;
        
        // Draw button background
        this.ctx.fillStyle = this.isRunning ? '#0f0' : '#4f4';
        this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Draw button border
        this.ctx.strokeStyle = '#0f0';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Draw button text
        this.ctx.fillStyle = this.isRunning ? '#000' : '#0f0';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            this.isRunning ? 'STOP' : 'RUN',
            buttonX + buttonWidth / 2,
            buttonY + buttonHeight / 2
        );
    }
    
    computeStatorDiameter(angle) {
        return this.stator_diameter + 20 * Math.sin(10 * angle);
    }
    
    drawStatorLine() {
        this.ctx.strokeStyle = '#000';
        this.ctx.fillStyle = 'transparent';
        this.ctx.beginPath();
        
        for (let i = 0; i < Math.PI * 2; i += 0.01) {
            const diameter = this.computeStatorDiameter(i);
            const x = this.bar_centre_x + diameter/2 * Math.sin(i);
            const y = this.bar_centre_y + diameter/2 * Math.cos(i);
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        this.ctx.stroke();
    }
    
    drawText(text, x, y, align = 'center') {
        this.ctx.fillStyle = '#000';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x, y);
    }
    
    drawLine(x1, y1, x2, y2) {
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }
    
    drawCircle(x, y, radius, fill = true) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        if (fill) {
            this.ctx.fillStyle = '#000';
            this.ctx.fill();
        } else {
            this.ctx.strokeStyle = '#000';
            this.ctx.stroke();
        }
    }
    
    animate() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        this.frameRate = 1 / deltaTime;
        
        // Only update physics if running
        if (this.isRunning) {
            this.update(deltaTime);
        }
        
        this.draw();
        
        requestAnimationFrame(() => this.animate());
    }
    
    update(deltaTime) {
        // Update stator diameter
        if (this.isTorqueRipple) {
            this.stator_diameter2 = this.computeStatorDiameter(this.stator_angle);
        } else {
            this.stator_diameter2 = this.stator_diameter;
        }
        
        // Physics calculations
        this.timeStep = deltaTime;
        
        // Calculate forces
        const add_x = this.bar_length/2 * Math.cos(this.angle);
        const add_y = this.bar_length/2 * Math.sin(this.angle);
        
        const start_x = this.stator_diameter2/2 * Math.cos(this.stator_angle);
        const start_y = this.stator_diameter/2 * Math.sin(this.stator_angle);
        
        const dist1_x = start_x - add_x;
        const dist1_y = start_y - add_y;
        const dist1 = Math.sqrt(dist1_x * dist1_x + dist1_y * dist1_y);
        
        const dist2_x = start_x + add_x;
        const dist2_y = start_y + add_y;
        const dist2 = Math.sqrt(dist2_x * dist2_x + dist2_y * dist2_y);
        
        const max_dist = 110;
        const force1 = (max_dist - dist1) * Math.sin(this.angle - this.stator_angle);
        const force2 = (max_dist - dist2) * Math.sin(this.angle - this.stator_angle);
        
        const TorqueApplied = (force2 + force1) / 1;
        const signOfAngVelocity = Math.sign(this.angularVelocity);
        
        this.torqueFrictionDynamic = this.FrictionDynamicCoefficient * this.angularVelocity;
        this.torqueFrictionStatic = signOfAngVelocity * this.FrictionStaticCoefficient;
        
        this.backEMFSimulate = signOfAngVelocity * this.angularVelocity * 30 * Math.sin(this.angle - this.stator_angle);
        
        this.torque = TorqueApplied - this.torqueFrictionDynamic + this.torqueFrictionStatic;
        
        this.angularAcceleration = this.torque / this.rotationalInertia;
        this.angularVelocity = this.angularVelocity + this.angularAcceleration * this.timeStep;
        this.angularAngle = this.angularAngle + this.angularVelocity * this.timeStep;
        
        this.angle = this.angularAngle;
        
        // Auto angle control
        if (this.isAutoAngle) {
            this.stator_angle = this.angle + (this.sliderAngle * Math.PI / 180);
        }
        
        // Add data to oscilloscope
        this.oscope.addPoint(this.angularVelocity * 10);
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#ddd';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw stator line if torque ripple is enabled
        if (this.isTorqueRipple) {
            this.drawStatorLine();
        }
        
        // Draw bar (rotor)
        const add_x = this.bar_length/2 * Math.cos(this.angle);
        const add_y = this.bar_length/2 * Math.sin(this.angle);
        this.drawLine(
            this.bar_centre_x - add_x, 
            this.bar_centre_y - add_y, 
            this.bar_centre_x + add_x, 
            this.bar_centre_y + add_y
        );
        this.drawText("N", this.bar_centre_x + add_x, this.bar_centre_y + add_y);
        this.drawText("S", this.bar_centre_x - add_x, this.bar_centre_y - add_y);
        
        // Draw stator
        const start_x = this.stator_diameter2/2 * Math.cos(this.stator_angle);
        const start_y = this.stator_diameter/2 * Math.sin(this.stator_angle);
        const end_x = (this.stator_diameter2/2 + this.stator_length) * Math.cos(this.stator_angle);
        const end_y = (this.stator_diameter2/2 + this.stator_length) * Math.sin(this.stator_angle);
        
        this.drawLine(
            this.bar_centre_x + start_x, 
            this.bar_centre_y + start_y, 
            this.bar_centre_x + end_x, 
            this.bar_centre_y + end_y
        );
        this.drawText("N", this.bar_centre_x + start_x, this.bar_centre_y + start_y);
        
        // Draw mouse cursor
        this.drawCircle(this.mouseX, this.mouseY, 5);
        
        // Draw slider value
        this.drawText(this.sliderAngle.toString(), 380, 390);
        
        // Draw oscilloscope
        this.oscope.draw(this.ctx);
        
        // Draw run/stop button
        this.drawRunStopButton();
    }
}

class Oscope {
    constructor() {
        this.ypos = 0.5;
        this.xpos = 0;
        this.yscale = 40;
        this.xscale = 1/60;
        this.xarray = [];
        this.yarray = [];
        this.canvasLeftX = 50;
        this.canvasRightX = 350;
        this.canvasUpY = 300;
        this.canvasDownY = 400;
        
        this.ticksLengthX = 10;
        this.ticksLengthY = 10;
        this.yGridSquares = 6;
        this.xGridSquares = 5;
        this.showGridLines = false;
        this.showGridTicks = false;
        this.xCount = 0;
        this.xOld1 = [];
        this.yOld1 = [];
    }
    
    addPoint(y) {
        this.xarray.push(this.xCount);
        this.xCount += 1;
        
        const xCanvasSpacing = (this.canvasRightX - this.canvasLeftX) / this.xGridSquares;
        const xscalec = this.xscale * xCanvasSpacing;
        const xposc = this.canvasLeftX + (this.canvasRightX - this.canvasLeftX) * this.xpos;
        
        if (xposc + xscalec * this.xarray[this.xarray.length - 1] > this.canvasRightX) {
            this.yOld1 = [...this.yarray];
            this.xOld1 = [...this.xarray];
            this.xarray = [];
            this.xCount = 0;
            this.yarray = [];
        }
        
        this.yarray.push(y);
    }
    
    draw(ctx) {
        // Calculations
        const yCanvasSpacing = (this.canvasDownY - this.canvasUpY) / this.yGridSquares;
        const xCanvasSpacing = (this.canvasRightX - this.canvasLeftX) / this.xGridSquares;
        const xposc = this.canvasLeftX + (this.canvasRightX - this.canvasLeftX) * this.xpos;
        const yposc = this.canvasDownY - (this.canvasDownY - this.canvasUpY) * this.ypos;
        const xscalec = this.xscale * xCanvasSpacing;
        const yscalec = (1/this.yscale) * yCanvasSpacing;
        
        // Draw outer bounds
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.rect(this.canvasLeftX, this.canvasUpY, 
                this.canvasRightX - this.canvasLeftX, 
                this.canvasDownY - this.canvasUpY);
        ctx.stroke();
        
        // Draw grid lines
        if (this.showGridLines) {
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = '#ccc';
            for (let i = 1; i < this.yGridSquares; i++) {
                const y = this.canvasDownY - yCanvasSpacing * i;
                ctx.beginPath();
                ctx.moveTo(this.canvasLeftX, y);
                ctx.lineTo(this.canvasRightX, y);
                ctx.stroke();
            }
            for (let i = 1; i < this.xGridSquares; i++) {
                const x = this.canvasLeftX + xCanvasSpacing * i;
                ctx.beginPath();
                ctx.moveTo(x, this.canvasDownY);
                ctx.lineTo(x, this.canvasUpY);
                ctx.stroke();
            }
        }
        
        // Draw grid numbers
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let i = 1; i < this.yGridSquares; i++) {
            const value = this.yscale * i - this.ypos * (this.yscale * this.yGridSquares);
            ctx.fillText(value.toFixed(1), this.canvasLeftX + 2, this.canvasDownY - yCanvasSpacing * i);
        }
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 1; i < this.xGridSquares; i++) {
            const value = (1/this.xscale) * i;
            ctx.fillText(value.toFixed(1), this.canvasLeftX + xCanvasSpacing * i, this.canvasDownY + 2);
        }
        
        // Plot old data
        ctx.setLineDash([]);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        if (this.xOld1.length > 0) {
            ctx.beginPath();
            for (let i = 0; i < this.xOld1.length; i++) {
                const xTemp = xposc + xscalec * this.xOld1[i];
                const yTemp = yposc - yscalec * this.yOld1[i];
                if (yTemp >= this.canvasUpY && yTemp <= this.canvasDownY) {
                    if (i === 0) {
                        ctx.moveTo(xTemp, yTemp);
                    } else {
                        ctx.lineTo(xTemp, yTemp);
                    }
                }
            }
            ctx.stroke();
        }
        
        // Plot current data
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        if (this.xarray.length > 0) {
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < this.xarray.length; i++) {
                const xTemp = xposc + xscalec * this.xarray[i];
                const yTemp = yposc - yscalec * this.yarray[i];
                if (yTemp >= this.canvasUpY && yTemp <= this.canvasDownY) {
                    if (!started) {
                        ctx.moveTo(xTemp, yTemp);
                        started = true;
                    } else {
                        ctx.lineTo(xTemp, yTemp);
                    }
                }
            }
            ctx.stroke();
        }
        
        // Draw overflow indicators
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        for (let i = 0; i < this.yarray.length; i++) {
            const yTemp = yposc - yscalec * this.yarray[i];
            if (yTemp < this.canvasUpY) {
                ctx.fillText("↑", this.canvasRightX - 10, this.canvasUpY + 10);
                break;
            }
            if (yTemp > this.canvasDownY) {
                ctx.fillText("↓", this.canvasRightX - 10, this.canvasDownY - 5);
                break;
            }
        }
        
        // Draw timestamp
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText((Date.now() / 1000).toFixed(1), this.canvasRightX, this.canvasDownY);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('magnetTurnerCanvas');
    if (canvas) {
        new MagnetTurner(canvas);
    }
});