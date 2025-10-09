import { app } from "/scripts/app.js";

app.registerExtension({
    name: "SBCODE.ImageCompareNode",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ImageCompareNode") return;

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (origOnNodeCreated) origOnNodeCreated.apply(this, arguments);

            console.log("[SBCODE.ImageCompareNode] Node created:", this.title);

            if (!this.size || this.size[0] < 100 || this.size[1] < 100) {
                this.size = [532, 582];
            }

            this.sliderPos = 0.5;
            this.dragging = false;
            this.hovered = false;

            this.onMouseDown = function (e, pos) {
                const margin = 10;
                const width = this.size[0] - margin * 2;
                const height = this.size[1] - margin * 2;

                const x = pos[0] - margin;
                const y = pos[1] - margin;

                const splitX = width * this.sliderPos;
                const handleX = margin + splitX;
                const handleY = margin + height / 2;
                const dist = Math.hypot(pos[0] - handleX, pos[1] - handleY);

                if (dist < 15) {
                    this.dragging = true;
                    return true;
                }

                if (x >= 0 && x <= width && y >= 0 && y <= height) {
                    this.dragging = true;
                    this.sliderPos = x / width;
                    app.graph.setDirtyCanvas(true);
                    return true;
                }

                return false;
            };

            this.onMouseMove = function (e, pos) {
                const margin = 10;
                const width = this.size[0] - margin * 2;
                const height = this.size[1] - margin * 2;

                const splitX = margin + width * this.sliderPos;
                const handleY = margin + height / 2;
                const dist = Math.hypot(pos[0] - splitX, pos[1] - handleY);
                this.hovered = dist < 15;

                if (this.dragging) {
                    let x = pos[0] - margin;
                    x = Math.max(0, Math.min(width, x));
                    this.sliderPos = x / width;
                    app.graph.setDirtyCanvas(true);
                }
            };

            this.onMouseUp = function () {
                this.dragging = false;
                app.graph.setDirtyCanvas(true);
            };

            this.onDrawForeground = function (ctx) {
                ctx.save();

                const margin = 10;
                const topOffset = 40;
                const drawWidth = this.size[0] - margin * 2;
                const drawHeight = (this.size[1] - margin * 2) - topOffset;

                ctx.fillStyle = "#111";
                ctx.fillRect(margin, margin + topOffset, drawWidth, drawHeight);

                if (this.imgB) ctx.drawImage(this.imgB, margin, margin + topOffset, drawWidth, drawHeight);

                if (this.imgA) {
                    const splitX = margin + drawWidth * this.sliderPos;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(margin, margin + topOffset, splitX - margin, drawHeight);
                    ctx.clip();

                    ctx.drawImage(this.imgA, margin, margin + topOffset, drawWidth, drawHeight);
                    ctx.restore();

                    ctx.strokeStyle = "#00e0ff";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(splitX, margin + topOffset);
                    ctx.lineTo(splitX, margin + drawHeight + topOffset);
                    ctx.stroke();
                }

                ctx.fillStyle = "white";
                ctx.font = "bold 14px sans-serif";
                ctx.shadowColor = "black";
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                ctx.fillText("A", margin + 8, margin + topOffset + 20);
                ctx.fillText("B", margin + drawWidth - 20, margin + topOffset + 20);

                ctx.restore();
            };

            const origOnExecuted = this.onExecuted;
            this.onExecuted = function (output) {
                if (origOnExecuted) origOnExecuted.apply(this, arguments);

                if (output?.b64_a && output?.b64_b) {
                    this.imgA = new Image();
                    this.imgA.src = output.b64_a.join("");
                    this.imgB = new Image();
                    this.imgB.src = output.b64_b.join("");

                    this.imgA.onload = this.imgB.onload = () => app.graph.setDirtyCanvas(true);
                } else {
                    console.warn("[SBCODE.ImageCompareNode] Missing image base64 data.");
                }
            };
        };
    },
});
