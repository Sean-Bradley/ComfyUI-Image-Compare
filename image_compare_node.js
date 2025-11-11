import { app } from "/scripts/app.js";

app.registerExtension({
    name: "SBCODE.ImageCompareNode",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ImageCompareNode") return;

        // --- helper for aspect-correct "contain" fit inside a box ---
        function fitContain(srcW, srcH, maxW, maxH) {
            if (!srcW || !srcH || !maxW || !maxH) {
                return { x: 0, y: 0, w: 0, h: 0 };
            }
            const s = Math.min(maxW / srcW, maxH / srcH);
            const w = Math.max(1, Math.floor(srcW * s));
            const h = Math.max(1, Math.floor(srcH * s));
            const x = Math.floor((maxW - w) / 2);
            const y = Math.floor((maxH - h) / 2);
            return { x, y, w, h };
        }

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

            // property to control aspect-keeping (default ON)
            this.properties = this.properties || {};
            if (this.properties.keep_aspect === undefined) {
                this.properties.keep_aspect = true;
            }

            // Optional toggle widget in the node
            if (!this._aspectWidgetAdded && this.addWidget) {
                this.addWidget("checkbox", "Keep Aspect", this.properties.keep_aspect, (v) => {
                    this.properties.keep_aspect = !!v;
                    this.setDirtyCanvas?.(true, true);
                    app.graph.setDirtyCanvas(true, true);
                });
                this._aspectWidgetAdded = true;
            }

            // Common geometry used across mouse + draw
            const getDrawGeom = () => {
                const margin = 10;
                const topOffset = 40; // leave space for title/widgets
                const drawX = margin;
                const drawY = margin + topOffset;
                const drawW = this.size[0] - margin * 2;
                const drawH = (this.size[1] - margin * 2) - topOffset;
                return { margin, topOffset, drawX, drawY, drawW, drawH };
            };

            this.onMouseDown = function (e, pos) {
                const { drawX, drawY, drawW, drawH } = getDrawGeom();

                const x = pos[0] - drawX;
                const y = pos[1] - drawY;

                // Only react if inside draw area
                if (x < 0 || x > drawW || y < 0 || y > drawH) return false;

                const splitX = drawX + Math.floor(drawW * this.sliderPos);
                const handleX = splitX;
                const handleY = drawY + Math.floor(drawH / 2);
                const dist = Math.hypot(pos[0] - handleX, pos[1] - handleY);

                // Grab handle if close; otherwise jump slider to clicked x
                if (dist < 15) {
                    this.dragging = true;
                    return true;
                }

                this.dragging = true;
                this.sliderPos = Math.max(0, Math.min(1, x / drawW));
                app.graph.setDirtyCanvas(true, true);
                return true;
            };

            this.onMouseMove = function (e, pos) {
                const { drawX, drawY, drawW, drawH } = getDrawGeom();

                const splitX = drawX + Math.floor(drawW * this.sliderPos);
                const handleY = drawY + Math.floor(drawH / 2);
                const dist = Math.hypot(pos[0] - splitX, pos[1] - handleY);
                this.hovered = dist < 15;

                if (this.dragging) {
                    let x = pos[0] - drawX;
                    x = Math.max(0, Math.min(drawW, x));
                    this.sliderPos = x / drawW;
                    app.graph.setDirtyCanvas(true, true);
                }
            };

            this.onMouseUp = function () {
                this.dragging = false;
                app.graph.setDirtyCanvas(true, true);
            };

            this.onDrawForeground = function (ctx) {
                ctx.save();

                const { margin, topOffset, drawX, drawY, drawW, drawH } = getDrawGeom();

                // Background for preview area
                ctx.fillStyle = "#111";
                ctx.fillRect(drawX, drawY, drawW, drawH);

                // Determine rects for A and B (aspect-correct if enabled)
                let rectA = { x: 0, y: 0, w: drawW, h: drawH };
                let rectB = { x: 0, y: 0, w: drawW, h: drawH };

                if (this.properties.keep_aspect) {
                    if (this.imgA?.width && this.imgA?.height) {
                        rectA = fitContain(this.imgA.width, this.imgA.height, drawW, drawH);
                    }
                    if (this.imgB?.width && this.imgB?.height) {
                        rectB = fitContain(this.imgB.width, this.imgB.height, drawW, drawH);
                    }
                }

                // Draw B as the base (full area or letterboxed)
                if (this.imgB && rectB.w > 0 && rectB.h > 0) {
                    ctx.drawImage(
                        this.imgB,
                        drawX + rectB.x,
                        drawY + rectB.y,
                        rectB.w,
                        rectB.h
                    );
                }

                // Draw A clipped by the slider (left part)
                if (this.imgA && rectA.w > 0 && rectA.h > 0) {
                    const splitX = drawX + Math.floor(drawW * this.sliderPos);

                    ctx.save();
                    // Clip the left portion of the whole draw area
                    ctx.beginPath();
                    ctx.rect(drawX, drawY, splitX - drawX, drawH);
                    ctx.clip();

                    ctx.drawImage(
                        this.imgA,
                        drawX + rectA.x,
                        drawY + rectA.y,
                        rectA.w,
                        rectA.h
                    );
                    ctx.restore();

                    // Slider line
                    ctx.strokeStyle = "#00e0ff";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(splitX, drawY);
                    ctx.lineTo(splitX, drawY + drawH);
                    ctx.stroke();

                    // Optional handle highlight when hovered/dragging
                    if (this.hovered || this.dragging) {
                        ctx.fillStyle = "#00e0ff";
                        ctx.beginPath();
                        ctx.arc(splitX, drawY + drawH / 2, 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // Labels
                ctx.fillStyle = "white";
                ctx.font = "bold 14px sans-serif";
                ctx.shadowColor = "black";
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                ctx.fillText("A", drawX + 8, drawY + 20);
                ctx.fillText("B", drawX + drawW - 20, drawY + 20);
                //draw dimensions
                ctx.font = "normal 10px sans-serif";
                if (this.imgA && this.imgB) {
                    ctx.fillText(this.imgA.width + "x" + this.imgA.height, drawX + 8, drawY + 34);
                    ctx.textAlign = "right";
                    ctx.fillText(this.imgB.width + "x" + this.imgB.height, drawX + drawW - 10, drawY + 34);
                }

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

                    const refresh = () => app.graph.setDirtyCanvas(true, true);
                    this.imgA.onload = refresh;
                    this.imgB.onload = refresh;
                } else {
                    console.warn("[SBCODE.ImageCompareNode] Missing image base64 data.");
                }
            };
        };
    },
});
