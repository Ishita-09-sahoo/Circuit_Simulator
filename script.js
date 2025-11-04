class CircuitSimulator {
    constructor() {
        this.canvas = document.getElementById('circuitCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.components = [];
        this.wires = [];
        this.selectedComponent = null;
        this.draggedComponent = null;
        this.isDrawingWire = false;
        this.wireStartPoint = null;
        this.currentWire = null;
        this.activeTool = null;
        this.connectionPoints = [];
        this.componentCounter = { resistor: 1, capacitor: 1, inductor: 1, 'voltage-source': 1, 'current-source': 1 };
        
        this.pendingComponent = null;
        this.initializeEventListeners();
        this.setupCanvas();
    }

    initializeEventListeners() {
        // Component library drag events
        document.querySelectorAll('.component-item[data-component]').forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleDragStart(e));
            item.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });

        // Tool selection events
        document.querySelectorAll('.component-item[data-tool]').forEach(item => {
            item.addEventListener('click', (e) => this.handleToolSelection(e));
        });

        // Canvas events
        this.canvas.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.canvas.addEventListener('drop', (e) => this.handleDrop(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

        // Control buttons
        document.getElementById('clearCanvas').addEventListener('click', () => this.clearCanvas());
        document.getElementById('exportCircuit').addEventListener('click', () => this.exportCircuit());

        // Modal events
        document.getElementById('saveValue').addEventListener('click', () => this.saveComponentValue());
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('valueModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    setupCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.redrawCanvas();
    }

    handleDragStart(e) {
        const componentType = e.target.closest('.component-item').dataset.component;
        e.dataTransfer.setData('text/plain', componentType);
        e.target.classList.add('dragging');
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    handleToolSelection(e) {
        const tool = e.target.closest('.component-item').dataset.tool;
        
        // Remove active class from all tools
        document.querySelectorAll('.component-item[data-tool]').forEach(item => {
            item.classList.remove('active-tool');
        });
        
        // Add active class to selected tool
        e.target.closest('.component-item').classList.add('active-tool');
        
        this.activeTool = tool;
        this.canvas.style.cursor = tool === 'wire' ? 'crosshair' : 'default';
    }

    handleDragOver(e) {
        e.preventDefault();
    }

    handleDrop(e) {
        e.preventDefault();
        const componentType = e.dataTransfer.getData('text/plain');
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.addComponent(componentType, x, y);
    }

    addComponent(type, x, y) {
        const component = {
            id: this.generateComponentId(type),
            type: type,
            x: x,
            y: y,
            width: 60,
            height: 30,
            value: '',
            node1: null,
            node2: null,
            rotation: 0
        };

        this.components.push(component);
        this.redrawCanvas();
        this.openValueModal(component);
    }

    openValueModal(component) {
        this.pendingComponent = component;
        const modal = document.getElementById('valueModal');
        const node1 = document.getElementById('node1Input');
        const node2 = document.getElementById('node2Input');
        const value = document.getElementById('componentValue');
        node1.value = component.node1 ?? '';
        node2.value = component.node2 ?? '';
        value.value = component.value ?? '';
        modal.style.display = 'block';
    }

    saveComponentValue() {
        if (!this.pendingComponent) return;
        const node1 = parseInt(document.getElementById('node1Input').value, 10);
        const node2 = parseInt(document.getElementById('node2Input').value, 10);
        const value = document.getElementById('componentValue').value.trim();
        
        if (Number.isNaN(node1) || Number.isNaN(node2) || value === '') {
            alert('Please provide Node 1, Node 2 (numbers) and Value.');
            return;
        }
        
        this.pendingComponent.node1 = node1;
        this.pendingComponent.node2 = node2;
        this.pendingComponent.value = value;
        
        this.selectedComponent = this.pendingComponent;
        this.pendingComponent = null;
        this.closeModal();
        this.redrawCanvas();
        this.showComponentProperties(this.selectedComponent);
    }

    generateComponentId(type) {
        const count = this.componentCounter[type] || 1;
        this.componentCounter[type] = count + 1;
        return `${type.charAt(0).toUpperCase()}${count}`;
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on a component
        const clickedComponent = this.getComponentAt(x, y);
        
        if (this.activeTool === 'wire') {
            // Wire tool is active - start wire drawing
            this.startWireDrawing(x, y);
        } else if (clickedComponent) {
            // No wire tool - select component
            this.selectedComponent = clickedComponent;
            this.draggedComponent = clickedComponent;
            this.redrawCanvas();
            this.showComponentProperties(clickedComponent);
        } else {
            this.selectedComponent = null;
            this.redrawCanvas();
        }
    }

    handleMouseMove(e) {
        if (this.draggedComponent) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.draggedComponent.x = x - this.draggedComponent.width / 2;
            this.draggedComponent.y = y - this.draggedComponent.height / 2;
            this.redrawCanvas();
        }

        if (this.isDrawingWire && this.currentWire) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.currentWire.endX = x;
            this.currentWire.endY = y;
            this.redrawCanvas();
        }
    }

    handleMouseUp(e) {
        this.draggedComponent = null;
        
        if (this.isDrawingWire) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.finishWireDrawing(x, y);
        }
    }

    handleCanvasClick(e) {
        // Handle component selection
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedComponent = this.getComponentAt(x, y);
        if (clickedComponent) {
            this.selectedComponent = clickedComponent;
            this.redrawCanvas();
            this.showComponentProperties(clickedComponent);
        }
    }

    handleDoubleClick(e) {
        // Rotate component on double click
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedComponent = this.getComponentAt(x, y);
        if (clickedComponent) {
            this.rotateComponent(clickedComponent);
        }
    }

    getComponentAt(x, y) {
        return this.components.find(component => {
            const centerX = component.x + component.width / 2;
            const centerY = component.y + component.height / 2;
            const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            return distance <= 30; // Clickable area around component
        });
    }

    getConnectionPoint(x, y) {
        // Returns nearest terminal (end point) of any component within snap radius
        const snapRadius = 16;
        let nearest = null;
        let nearestDist = Infinity;
        for (let component of this.components) {
            const terminals = this.getComponentTerminals(component);
            for (let term of terminals) {
                const dx = x - term.x;
                const dy = y - term.y;
                const d = Math.hypot(dx, dy);
                if (d < nearestDist && d <= snapRadius) {
                    nearestDist = d;
                    nearest = { x: term.x, y: term.y, component, terminal: term.name };
                }
            }
        }
        return nearest;
    }

    getComponentTerminals(component) {
        // Two endpoints along the local X axis of the component
        const centerX = component.x + component.width / 2;
        const centerY = component.y + component.height / 2;
        const half = Math.max(component.width, component.height) / 2 + 10; // include lead length
        const angle = (component.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        // Local points (-half,0) and (half,0) rotated to world
        const x1 = centerX + (-half) * cos - (0) * sin;
        const y1 = centerY + (-half) * sin + (0) * cos;
        const x2 = centerX + (half) * cos - (0) * sin;
        const y2 = centerY + (half) * sin + (0) * cos;
        return [
            { x: x1, y: y1, name: 'A' },
            { x: x2, y: y2, name: 'B' },
        ];
    }

    startWireDrawing(x, y) {
        const connectionPoint = this.getConnectionPoint(x, y);
        console.log('Starting wire drawing at:', x, y);
        console.log('Connection point found:', connectionPoint);
        
        if (connectionPoint) {
            this.isDrawingWire = true;
            this.wireStartPoint = connectionPoint;
            this.currentWire = {
                startX: connectionPoint.x,
                startY: connectionPoint.y,
                endX: x,
                endY: y,
                startComponent: connectionPoint.component
            };
            console.log('Wire drawing started successfully');
        } else {
            console.log('No connection point found - wire not started');
        }
    }

    finishWireDrawing(x, y) {
        if (this.currentWire) {
            const endConnectionPoint = this.getConnectionPoint(x, y);
            if (endConnectionPoint) {
                this.currentWire.endX = endConnectionPoint.x;
                this.currentWire.endY = endConnectionPoint.y;
                this.currentWire.endComponent = endConnectionPoint.component;
            } else {
                this.currentWire.endX = x;
                this.currentWire.endY = y;
            }
            this.wires.push(this.currentWire);
            this.currentWire = null;
        }
        this.isDrawingWire = false;
        this.wireStartPoint = null;
        this.redrawCanvas();
    }

    redrawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw wires
        this.wires.forEach(wire => this.drawWire(wire));
        
        // Draw current wire being drawn
        if (this.currentWire) {
            this.drawWire(this.currentWire, true);
        }
        
        // Draw components
        this.components.forEach(component => this.drawComponent(component));
    }

    drawGrid() {
        const gridSize = 20;
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawComponent(component) {
        const isSelected = this.selectedComponent === component;
        
        this.ctx.save();
        
        // Apply rotation
        const centerX = component.x + component.width / 2;
        const centerY = component.y + component.height / 2;
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate(component.rotation * Math.PI / 180);
        this.ctx.translate(-centerX, -centerY);
        
        // Draw component symbol only (no background box)
        this.drawComponentSymbol(component);
        
        // Draw small terminal dots to help user see endpoints
        const terms = this.getComponentTerminals(component);
        this.ctx.fillStyle = '#666';
        terms.forEach(t => {
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, 2.5, 0, 2 * Math.PI);
            this.ctx.fill();
        });
        
        this.ctx.restore();
        
        // Draw selection indicator
        if (isSelected) {
            this.ctx.strokeStyle = '#4CAF50';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
        
        // Draw component label (not rotated)
        this.ctx.fillStyle = '#333';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        const label = component.name || component.id;
        this.ctx.fillText(label, centerX, centerY + 25);
        
        if (component.value) {
            this.ctx.fillText(component.value, centerX, centerY + 40);
        }
    }

    drawComponentSymbol(component) {
        const centerX = component.x + component.width / 2;
        const centerY = component.y + component.height / 2;
        
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        
        switch (component.type) {
            case 'resistor':
                this.drawResistor(centerX, centerY);
                break;
            case 'capacitor':
                this.drawCapacitor(centerX, centerY);
                break;
            case 'inductor':
                this.drawInductor(centerX, centerY);
                break;
            case 'voltage-source':
                this.drawVoltageSource(centerX, centerY);
                break;
            case 'current-source':
                this.drawCurrentSource(centerX, centerY);
                break;
        }
    }

    drawResistor(x, y) {
        const width = 40;
        const height = 8;
        
        // Main resistor body
        this.ctx.fillStyle = '#b8860b';
        this.ctx.fillRect(x - width/2, y - height/2, width, height);
        
        // Connection lines
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - width/2 - 10, y);
        this.ctx.lineTo(x - width/2, y);
        this.ctx.moveTo(x + width/2, y);
        this.ctx.lineTo(x + width/2 + 10, y);
        this.ctx.stroke();
    }

    drawCapacitor(x, y) {
        const width = 20;
        const height = 20;
        
        // Connection lines
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - width/2 - 10, y);
        this.ctx.lineTo(x - width/2, y);
        this.ctx.moveTo(x + width/2, y);
        this.ctx.lineTo(x + width/2 + 10, y);
        this.ctx.stroke();
        
        // Capacitor plates
        this.ctx.beginPath();
        this.ctx.moveTo(x - width/2, y - height/2);
        this.ctx.lineTo(x - width/2, y + height/2);
        this.ctx.moveTo(x + width/2, y - height/2);
        this.ctx.lineTo(x + width/2, y + height/2);
        this.ctx.stroke();
    }

    drawInductor(x, y) {
        const width = 40;
        const height = 20;
        const coils = 4;
        
        // Connection lines
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - width/2 - 10, y);
        this.ctx.lineTo(x - width/2, y);
        this.ctx.moveTo(x + width/2, y);
        this.ctx.lineTo(x + width/2 + 10, y);
        this.ctx.stroke();
        
        // Inductor coils
        this.ctx.beginPath();
        for (let i = 0; i < coils; i++) {
            const coilX = x - width/2 + (i * width / coils);
            const nextX = x - width/2 + ((i + 1) * width / coils);
            this.ctx.moveTo(coilX, y - height/2);
            this.ctx.quadraticCurveTo((coilX + nextX) / 2, y, nextX, y - height/2);
        }
        this.ctx.stroke();
    }

    drawVoltageSource(x, y) {
        const radius = 12;
        
        // Connection lines
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - radius - 10, y);
        this.ctx.lineTo(x - radius, y);
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + radius + 10, y);
        this.ctx.stroke();
        
        // Circle
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Plus sign
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - 4, y);
        this.ctx.lineTo(x + 4, y);
        this.ctx.moveTo(x, y - 4);
        this.ctx.lineTo(x, y + 4);
        this.ctx.stroke();
    }

    drawCurrentSource(x, y) {
        const radius = 12;
        
        // Connection lines
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - radius - 10, y);
        this.ctx.lineTo(x - radius, y);
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + radius + 10, y);
        this.ctx.stroke();
        
        // Circle
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Arrow (current direction)
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - 6, y);
        this.ctx.lineTo(x + 6, y);
        this.ctx.moveTo(x + 4, y - 2);
        this.ctx.lineTo(x + 6, y);
        this.ctx.lineTo(x + 4, y + 2);
        this.ctx.stroke();
    }

    drawWire(wire, isTemporary = false) {
        // Make wires more visible
        this.ctx.strokeStyle = isTemporary ? '#ff6b6b' : '#2c3e50'; // Red for temporary, dark blue for permanent
        this.ctx.lineWidth = isTemporary ? 4 : 3; // Thicker lines
        this.ctx.setLineDash(isTemporary ? [8, 4] : []); // More visible dashes
        
        this.ctx.beginPath();
        this.ctx.moveTo(wire.startX, wire.startY);
        this.ctx.lineTo(wire.endX, wire.endY);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        // Draw connection dots
        if (!isTemporary) {
            this.ctx.fillStyle = '#e74c3c'; // Red dots for visibility
            this.ctx.beginPath();
            this.ctx.arc(wire.startX, wire.startY, 4, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(wire.endX, wire.endY, 4, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    showComponentProperties(component) {
        const propertiesDiv = document.getElementById('componentProperties');
        const componentType = component.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        propertiesDiv.innerHTML = `
            <div class="form-group">
                <label>Component: ${componentType}</label>
            </div>
            <div class="form-group">
                <label>Node 1:</label>
                <input type="number" id="propNode1" value="${component.node1 ?? ''}" placeholder="e.g., 1" min="0">
            </div>
            <div class="form-group">
                <label>Node 2:</label>
                <input type="number" id="propNode2" value="${component.node2 ?? ''}" placeholder="e.g., 2" min="0">
            </div>
            <div class="form-group">
                <label>Value:</label>
                <input type="text" id="propValue" value="${component.value}" placeholder="e.g., 5V, 2A, 100Ω">
            </div>
            <div class="form-group">
                <label>Rotation:</label>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-secondary" onclick="circuitSimulator.rotateComponent(circuitSimulator.selectedComponent, -90)" style="flex: 1;">↺ -90°</button>
                    <button class="btn btn-secondary" onclick="circuitSimulator.rotateComponent(circuitSimulator.selectedComponent, 90)" style="flex: 1;">↻ +90°</button>
                </div>
            </div>
            <button class="btn btn-primary" onclick="circuitSimulator.updateComponentProperties()">Update</button>
            <button class="btn btn-secondary" onclick="circuitSimulator.deleteComponent()">Delete</button>
        `;
    }

    updateComponentProperties() {
        if (this.selectedComponent) {
            const node1Input = document.getElementById('propNode1');
            const node2Input = document.getElementById('propNode2');
            const valueInput = document.getElementById('propValue');
            
            const node1 = parseInt(node1Input.value, 10);
            const node2 = parseInt(node2Input.value, 10);
            if (Number.isNaN(node1) || Number.isNaN(node2)) {
                alert('Node 1 and Node 2 must be numbers.');
                return;
            }
            this.selectedComponent.node1 = node1;
            this.selectedComponent.node2 = node2;
            this.selectedComponent.value = valueInput.value;
            
            this.redrawCanvas();
        }
    }

    rotateComponent(component, angle = 90) {
        if (component) {
            component.rotation = (component.rotation + angle) % 360;
            this.redrawCanvas();
        }
    }

    deleteComponent() {
        if (this.selectedComponent) {
            const index = this.components.indexOf(this.selectedComponent);
            if (index > -1) {
                this.components.splice(index, 1);
                this.selectedComponent = null;
                this.redrawCanvas();
                document.getElementById('componentProperties').innerHTML = '<p>Select a component to edit its properties</p>';
            }
        }
    }

    clearCanvas() {
        if (confirm('Are you sure you want to clear the canvas?')) {
            this.components = [];
            this.wires = [];
            this.selectedComponent = null;
            this.redrawCanvas();
            document.getElementById('componentProperties').innerHTML = '<p>Select a component to edit its properties</p>';
        }
    }

    exportCircuit() {
        const circuitData = {
            components: this.components.map(comp => ({
                type: comp.type,
                node1: comp.node1,
                node2: comp.node2,
                value: comp.value
            }))
        };
        
        console.log('Circuit Data:', circuitData);
        
        // Create downloadable JSON file
        const dataStr = JSON.stringify(circuitData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'circuit.json';
        link.click();
        
        URL.revokeObjectURL(url);
        
        alert('Circuit exported successfully!');
    }

    closeModal() {
        document.getElementById('valueModal').style.display = 'none';
    }
}

// Initialize the circuit simulator when the page loads
let circuitSimulator;
document.addEventListener('DOMContentLoaded', () => {
    circuitSimulator = new CircuitSimulator();
});

// Handle window resize
window.addEventListener('resize', () => {
    if (circuitSimulator) {
        circuitSimulator.setupCanvas();
    }
});
