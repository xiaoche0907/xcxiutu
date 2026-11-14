





Object.assign(ImageGeneratorAppExtended.prototype, {

  centerImage() {
    const canvas = this.elements.imageCanvas,
    container = canvas.parentElement,
    containerWidth = container.offsetWidth,
    containerHeight = container.offsetHeight,
    scaledWidth = canvas.offsetWidth * this.scale,
    scaledHeight = canvas.offsetHeight * this.scale;
    canvas.style.left = `${containerWidth / 2 - scaledWidth / 2}px`,
    canvas.style.top = `${containerHeight / 2 - scaledHeight / 2}px`
  },

  zoomTo(scale, centerX, centerY) {
    scale = Math.max(.1, Math.min(scale, 5));
    const canvas = this.elements.imageCanvas,
    container = canvas.parentElement,
    containerRect = container.getBoundingClientRect(),
    pivotX = centerX !== undefined ? centerX : containerRect.left + container.offsetWidth / 2,
    pivotY = centerY !== undefined ? centerY : containerRect.top + container.offsetHeight / 2,
    rect = canvas.getBoundingClientRect(),
    currentLeft = parseFloat(canvas.style.left) || 0,
    currentTop = parseFloat(canvas.style.top) || 0,
    scaleRatio = scale / this.scale,
    newLeft = currentLeft + (pivotX - rect.left) * (1 - scaleRatio),
    newTop = currentTop + (pivotY - rect.top) * (1 - scaleRatio);
    this.scale = scale,
    canvas.style.transformOrigin = "0 0",
    canvas.style.transform = `scale(${scale})`,
    canvas.style.left = `${newLeft}px`,
    canvas.style.top = `${newTop}px`,
    this.elements.zoomValue.textContent = `${Math.round(100 * scale)}%`
  },

  applyZoom() {
    this.zoomTo(this.scale),
    this.centerImage()
  },

  setZoom(scale) {
    this.zoomTo(Math.max(.1, Math.min(scale, 5))),
    this.centerImage()
  },

  resetZoom() {
    this.originalImage && (this.scale = 1, this.applyZoom())
  },

  selectCanvasTool(tool) {
    this.activeTool = tool;
    const brushBtn = this.elements.canvasBrushTool,
    dragBtn = this.elements.canvasDragTool;
    brushBtn && brushBtn.classList.toggle("active", "brush" === tool),
    dragBtn && dragBtn.classList.toggle("active", "drag" === tool),
    this.elements.imageCanvas.style.cursor = "drag" === tool ? "grab" : "crosshair"
  },

  startCanvasDrag(e) {
    if (!this.originalImage) return;
    this.isDraggingCanvas = !0,
    this.dragStartX = e.clientX,
    this.dragStartY = e.clientY,
    this.dragStartLeft = parseFloat(this.elements.imageCanvas.style.left) || 0,
    this.dragStartTop = parseFloat(this.elements.imageCanvas.style.top) || 0,
    this.elements.imageCanvas.style.cursor = "grabbing"
  },

  dragCanvas(e) {
    this.isDraggingCanvas && (this.elements.imageCanvas.style.left = `${this.dragStartLeft + e.clientX - this.dragStartX}px`,
    this.elements.imageCanvas.style.top = `${this.dragStartTop + e.clientY - this.dragStartY}px`)
  },

  endCanvasDrag() {
    this.isDraggingCanvas && (this.isDraggingCanvas = !1,
    this.elements.imageCanvas.style.cursor = "drag" === this.activeTool ? "grab" : "crosshair")
  },

  fitImageToContainer() {
    const canvas = this.elements.imageCanvas,
    container = canvas.parentElement,
    fitScale = Math.min(container.clientWidth / canvas.offsetWidth, container.clientHeight / canvas.offsetHeight);
    this.zoomTo(Math.max(.1, Math.min(fitScale, 5))),
    this.centerImage()
  }
});


Object.assign(ImageGeneratorAppExtended.prototype, {

  startMaskDrawing(e) {
    if (!this.originalImage) return;
    this.stopAntLineAnimation(),
    this.antLinePath = null,
    this.isDrawingMask = !0,
    this.maskPoints = [];
    const rect = this.elements.imageCanvas.getBoundingClientRect(),
    scaleX = this.elements.imageCanvas.width / rect.width,
    scaleY = this.elements.imageCanvas.height / rect.height,
    x = (e.clientX - rect.left) * scaleX,
    y = (e.clientY - rect.top) * scaleY;
    this.maskPoints.push({
      x: x,
      y: y
    })
  },

  drawMask(e) {
    if (!this.isDrawingMask) return;
    const rect = this.elements.imageCanvas.getBoundingClientRect(),
    scaleX = this.elements.imageCanvas.width / rect.width,
    scaleY = this.elements.imageCanvas.height / rect.height,
    x = (e.clientX - rect.left) * scaleX,
    y = (e.clientY - rect.top) * scaleY;
    this.maskPoints.push({
      x: x,
      y: y
    }),
    this.redrawCanvas(),
    this.drawCurrentPath()
  },

  async finishMaskDrawing() {
    this.isDrawingMask && (this.isDrawingMask = !1, this.maskPoints.length < 3 ? this.redrawCanvas() : (this.antLinePath = [...this.maskPoints], this.startAntLineAnimation(), await new Promise(resolve => setTimeout(resolve, 500)), await this.generateMaskFromPath()))
  },

  redrawCanvas() {
    this.ctx.clearRect(0, 0, this.elements.imageCanvas.width, this.elements.imageCanvas.height),
    this.ctx.drawImage(this.originalImage, 0, 0),
    this.drawAntLine()
  },

  drawCurrentPath() {
    if (!(this.maskPoints.length < 2)) {
      const rect = this.elements.imageCanvas.getBoundingClientRect(),
      screenToCanvas = this.elements.imageCanvas.width / rect.width;
      this.ctx.strokeStyle = "#00ff00",
      this.ctx.lineWidth = 2 * screenToCanvas,
      this.ctx.setLineDash([5 * screenToCanvas, 5 * screenToCanvas]),
      this.ctx.beginPath(),
      this.ctx.moveTo(this.maskPoints[0].x, this.maskPoints[0].y);
      for (let i = 1; i < this.maskPoints.length; i++) this.ctx.lineTo(this.maskPoints[i].x, this.maskPoints[i].y);
      this.ctx.stroke(),
      this.ctx.setLineDash([])
    }
  },

  startAntLineAnimation() {
    this.stopAntLineAnimation(),
    this.antLineInterval = setInterval(() => {
      this.antLineOffset = (this.antLineOffset + 4) % 16,
      this.redrawCanvas()
    }, 100)
  },

  stopAntLineAnimation() {
    this.antLineInterval && (clearInterval(this.antLineInterval), this.antLineInterval = null)
  },

  drawAntLine() {
    if (this.antLinePath && !(this.antLinePath.length < 2)) {
      const rect = this.elements.imageCanvas.getBoundingClientRect(),
      screenToCanvas = this.elements.imageCanvas.width / rect.width;
      this.ctx.strokeStyle = "#ffffff",
      this.ctx.lineWidth = 1 * screenToCanvas,
      this.ctx.setLineDash([8 * screenToCanvas, 8 * screenToCanvas]),
      this.ctx.lineDashOffset = -this.antLineOffset * screenToCanvas,
      this.ctx.beginPath(),
      this.ctx.moveTo(this.antLinePath[0].x, this.antLinePath[0].y);
      for (let i = 1; i < this.antLinePath.length; i++) this.ctx.lineTo(this.antLinePath[i].x, this.antLinePath[i].y);
      this.ctx.closePath(),
      this.ctx.stroke(),
      this.ctx.setLineDash([])
    }
  },

  async generateMaskFromPath() {
    this.originalImage && (this.maskCanvas.width = this.originalImage.width, this.maskCanvas.height = this.originalImage.height),
    this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height),
    this.maskCtx.fillStyle = "black",
    this.maskCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height),
    this.maskCtx.fillStyle = "white",
    this.maskCtx.beginPath(),
    this.maskCtx.moveTo(this.maskPoints[0].x, this.maskPoints[0].y);
    for (let i = 1; i < this.maskPoints.length; i++) this.maskCtx.lineTo(this.maskPoints[i].x, this.maskPoints[i].y);
    this.maskCtx.closePath(),
    this.maskCtx.fill(),
    this.applyGaussianBlur(),
    this.redrawCanvas(),
    this.maskCanvas.toBlob(async blob => {
      this.maskFile = new File([blob], "mask.png", {
        type: "image/png"
      });
      try {
        await this.workflowManager.uploadImage(this.maskFile);
        this.checkFormValidity(),
        this.addMessage("遮罩已绘制完成，可以输入提示词生成图像", "ai")
      } catch (error) {
        this.addMessage("连接失败", "ai")
      }
    })
  },

  applyGaussianBlur() {
    const originalWidth = this.maskCanvas.width,
    originalHeight = this.maskCanvas.height,
    imageSize = Math.max(originalWidth, originalHeight);
    let scaleFactor = 1;
    imageSize > 1024 && (scaleFactor = 1024 / imageSize);
    const scaledSize = imageSize * scaleFactor;
    let blurRadius;
    blurRadius = scaledSize <= 512 ? 10 : scaledSize <= 768 ? 15 : 20;
    const tempCanvas = document.createElement("canvas"),
    tempCtx = tempCanvas.getContext("2d"),
    scaledWidth = Math.round(originalWidth * scaleFactor),
    scaledHeight = Math.round(originalHeight * scaleFactor);
    tempCanvas.width = scaledWidth,
    tempCanvas.height = scaledHeight,
    tempCtx.drawImage(this.maskCanvas, 0, 0, scaledWidth, scaledHeight);
    const scaledImageData = tempCtx.getImageData(0, 0, scaledWidth, scaledHeight),
    blurredScaledImageData = this.gaussianBlur(scaledImageData, blurRadius);
    tempCtx.putImageData(blurredScaledImageData, 0, 0),
    this.maskCtx.clearRect(0, 0, originalWidth, originalHeight),
    this.maskCtx.drawImage(tempCanvas, 0, 0, scaledWidth, scaledHeight, 0, 0, originalWidth, originalHeight)
  },

  gaussianBlur(imageData, radius) {
    const pixels = imageData.data,
    width = imageData.width,
    height = imageData.height,
    output = new Uint8ClampedArray(pixels),
    kernelSize = 2 * Math.ceil(3 * radius) + 1,
    kernel = [],
    sigma = radius / 3,
    twoSigmaSquare = 2 * sigma * sigma;
    let kernelSum = 0;
    for (let i = 0; i < kernelSize; i++) {
      const x = i - Math.floor(kernelSize / 2),
      weight = Math.exp(-x * x / twoSigmaSquare) / Math.sqrt(Math.PI * twoSigmaSquare);
      kernel[i] = weight,
      kernelSum += weight
    }
    for (let i = 0; i < kernelSize; i++) kernel[i] /= kernelSum;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let r = 0,
      g = 0,
      b = 0,
      a = 0;
      for (let i = 0; i < kernelSize; i++) {
        const idx = 4 * (y * width + Math.min(width - 1, Math.max(0, x + i - Math.floor(kernelSize / 2)))),
        weight = kernel[i];
        r += pixels[idx] * weight,
        g += pixels[idx + 1] * weight,
        b += pixels[idx + 2] * weight,
        a += pixels[idx + 3] * weight
      }
      const outputIdx = 4 * (y * width + x);
      output[outputIdx] = r,
      output[outputIdx + 1] = g,
      output[outputIdx + 2] = b,
      output[outputIdx + 3] = a
    }
    for (let i = 0; i < pixels.length; i++) pixels[i] = output[i];
    for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
      let r = 0,
      g = 0,
      b = 0,
      a = 0;
      for (let i = 0; i < kernelSize; i++) {
        const idx = 4 * (Math.min(height - 1, Math.max(0, y + i - Math.floor(kernelSize / 2))) * width + x),
        weight = kernel[i];
        r += pixels[idx] * weight,
        g += pixels[idx + 1] * weight,
        b += pixels[idx + 2] * weight,
        a += pixels[idx + 3] * weight
      }
      const outputIdx = 4 * (y * width + x);
      output[outputIdx] = r,
      output[outputIdx + 1] = g,
      output[outputIdx + 2] = b,
      output[outputIdx + 3] = a
    }
    return new ImageData(output, width, height)
  }
});


Object.assign(ImageGeneratorAppExtended.prototype, {

  handleImageSelect(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader;
    reader.onload = e => {
      const img = new Image;
      img.onload = () => {
        this.imageFile = file;
        const imageUploadBtn = event.target.closest(".upload-btn");
        imageUploadBtn && imageUploadBtn.classList.add("selected"),
        this.originalImage = img,
        this.maskCanvas.width = img.width,
        this.maskCanvas.height = img.height,
        this.layers = [],
        this.addLayer(img, "原始图像"),
        this.fitImageToContainer(),
        this.maskFile = null,
        this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height),
        this.checkFormValidity()
      },
      img.src = e.target.result
    },
    reader.readAsDataURL(file)
  },

  loadOriginalImage(file) {
    const reader = new FileReader;
    reader.onload = e => {
      const img = new Image;
      img.onload = () => {
        this.originalImage = img,
        this.displayImage(img),
        this.resetZoom()
      },
      img.src = e.target.result
    },
    reader.readAsDataURL(file)
  },

  displayMaskPreview(file) {
    const reader = new FileReader;
    reader.onload = e => {
      this.elements.maskPreview && (this.elements.maskPreview.innerHTML = `<img src="${e.target.result}" alt="遮罩预览">`)
    },
    reader.readAsDataURL(file)
  },

  displayImage(img) {
    if (!img) return;
    const canvas = this.elements.imageCanvas,
    ctx = this.ctx;
    canvas.width = img.width,
    canvas.height = img.height,
    this.maskCanvas.width = img.width,
    this.maskCanvas.height = img.height,
    ctx.clearRect(0, 0, canvas.width, canvas.height),
    ctx.drawImage(img, 0, 0),
    canvas.style.display = "block",
    this.centerImage(),
    this.applyZoom()
  },

  _displayImageDirectly(img) {
    if (!img) return;
    const canvas = this.elements.imageCanvas,
    ctx = this.ctx;
    canvas.width = img.width,
    canvas.height = img.height,
    ctx.clearRect(0, 0, canvas.width, canvas.height),
    ctx.drawImage(img, 0, 0),
    canvas.style.display = "block",
    this.centerImage(),
    this.applyZoom()
  },

  async compressImage(file, maxSize = 1500) {
    return new Promise(resolve => {
      const reader = new FileReader;
      reader.onload = e => {
        const img = new Image;
        img.onload = () => {
          const maxDimension = Math.max(img.width, img.height);
          if (maxDimension <= maxSize) return void resolve(file);
          const scale = maxSize / maxDimension,
          newWidth = Math.floor(img.width * scale),
          newHeight = Math.floor(img.height * scale),
          canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d");
          canvas.width = newWidth,
          canvas.height = newHeight,
          ctx.imageSmoothingEnabled = !0,
          ctx.imageSmoothingQuality = "high",
          ctx.drawImage(img, 0, 0, newWidth, newHeight),
          canvas.toBlob(blob => {
            const compressedFile = new File([blob], file.name, {
              type: file.type
            });
            resolve(compressedFile)
          }, file.type)
        },
        img.src = e.target.result
      },
      reader.readAsDataURL(file)
    })
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader;
      reader.onload = () => resolve(reader.result),
      reader.onerror = () => reject(new Error("读取图片失败")),
      reader.readAsDataURL(file)
    })
  },

  getMaskBase64() {
    return this.maskCanvas.toDataURL()
  },

  applyMaskToGeneratedImage(generatedImage) {
    const maskImg = new Image;
    maskImg.onload = () => {
      const maskCanvas = document.createElement("canvas"),
      maskCtx = maskCanvas.getContext("2d");
      maskCanvas.width = generatedImage.width,
      maskCanvas.height = generatedImage.height,
      maskCtx.drawImage(maskImg, 0, 0, generatedImage.width, generatedImage.height);
      const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height),
      maskPixels = maskData.data;
      let hasColor = !1;
      for (let i = 0; i < Math.min(100, maskPixels.length); i += 4) if (maskPixels[i] !== maskPixels[i + 1] || maskPixels[i] !== maskPixels[i + 2]) {
        hasColor = !0;
        break
      }
      for (let i = 0; i < maskPixels.length; i += 4) {
        const gray = (maskPixels[i] + maskPixels[i + 1] + maskPixels[i + 2]) / 3;
        maskPixels[i] = gray,
        maskPixels[i + 1] = gray,
        maskPixels[i + 2] = gray,
        maskPixels[i + 3] = gray
      }
      maskCtx.putImageData(maskData, 0, 0);
      const finalMaskImg = new Image;
      finalMaskImg.onload = () => {
        const layerNumber = this.layers.length;
        this.addLayer(generatedImage, `生成图像 ${layerNumber}`, !0, finalMaskImg)
      },
      finalMaskImg.src = maskCanvas.toDataURL()
    };
    const reader = new FileReader;
    reader.onload = e => {
      maskImg.src = e.target.result
    },
    reader.readAsDataURL(this.maskFile)
  }
});


Object.assign(ImageGeneratorAppExtended.prototype, {

  
  _logMode(msg) {
    const text = `[FULL/ROI] ${msg}`;
    ;
  },

  
  _getMaskBounds() {
    if (!this.maskCanvas || !this.maskCanvas.width || !this.maskCanvas.height) return null;
    const w = this.maskCanvas.width,
    h = this.maskCanvas.height,
    data = this.maskCtx.getImageData(0, 0, w, h).data;
    let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = (row + x) * 4,
        v = Math.max(data[i], data[i + 1], data[i + 2]);
        if (v > 16) {
          x < minX && (minX = x),
          x > maxX && (maxX = x),
          y < minY && (minY = y),
          y > maxY && (maxY = y)
        }
      }
    }
    if (maxX < 0) return null;
    return { left: minX, top: minY, right: maxX + 1, bottom: maxY + 1, width: maxX - minX + 1, height: maxY - minY + 1 }
  },

  
  _buildROICropBounds(docW, docH, bounds) {
    const userW = Math.max(1, bounds.width || (bounds.right - bounds.left)),
    userH = Math.max(1, bounds.height || (bounds.bottom - bounds.top)),
    docLong = Math.max(docW, docH),
    docShort = Math.min(docW, docH),
    selLong = Math.max(userW, userH),
    selShort = Math.min(userW, userH),
    useCrop = (docLong > selLong * 3) || (docShort > selShort * 3),
    crop = { left: 0, top: 0, right: docW, bottom: docH, width: docW, height: docH, cropped: false };
    if (!useCrop) return crop;
    const targetLong = Math.min(docLong, docLong > selLong * 3 ? selLong * 3 : docLong),
    targetShort = Math.min(docShort, docShort > selShort * 3 ? selShort * 3 : docShort);
    crop.width = docW >= docH ? targetLong : targetShort,
    crop.height = docW >= docH ? targetShort : targetLong,
    crop.width = Math.min(docW, Math.max(crop.width, userW, 2500)),
    crop.height = Math.min(docH, Math.max(crop.height, userH, 2500));
    const cx = (bounds.left + bounds.right) / 2,
    cy = (bounds.top + bounds.bottom) / 2;
    crop.left = Math.round(Math.max(0, Math.min(docW - crop.width, cx - crop.width / 2))),
    crop.top = Math.round(Math.max(0, Math.min(docH - crop.height, cy - crop.height / 2))),
    crop.right = Math.round(crop.left + crop.width),
    crop.bottom = Math.round(crop.top + crop.height),
    crop.width = Math.max(1, crop.right - crop.left),
    crop.height = Math.max(1, crop.bottom - crop.top),
    crop.cropped = true;
    return crop
  },

  
  _computeGenerationCrop() {
    this._activeCrop = null;
    if (!this.originalImage) return null;
    if ("roi" !== this.generationMode) {
      this._logMode(`当前模式=${this.generationMode}：不裁剪，整图送推理（原图 ${this.originalImage.width}x${this.originalImage.height}）`);
      return null
    }
    const bounds = this._getMaskBounds();
    if (!bounds) {
      this._logMode("ROI模式：未扫描到有效选区（mask 全黑）→ 自动退化为整图 FULL");
      return null
    }
    this._logMode(`ROI模式：选区外接矩形=左${bounds.left} 上${bounds.top} 右${bounds.right} 下${bounds.bottom}（${bounds.width}x${bounds.height}）`);
    const crop = this._buildROICropBounds(this.originalImage.width, this.originalImage.height, bounds);
    if (!crop.cropped) {
      this._logMode(`ROI模式：选区(${bounds.width}x${bounds.height})相对画布不够小（长/短边未达 3 倍）→ 自动退化为整图 FULL`);
      return null
    }
    this._activeCrop = crop;
    this._logMode(`ROI模式：裁剪框=(${crop.left},${crop.top}) 宽${crop.width} 高${crop.height}（约选区 3 倍上下文）`);
    return crop
  }
});


Object.assign(ImageGeneratorAppExtended.prototype, {

  checkFormValidity() {
    const isValid = this.imageFile && this.maskFile && this.elements.prompt.value.trim();
    this.elements.generateBtn.disabled = !isValid
  },

  updateCharCount() {
    if (!this.elements.charCount) return;
    const length = this.elements.prompt.value.trim().length;
    this.elements.charCount.textContent = `${length}/500`,
    0 === length || length > 500 ? this.elements.generateBtn.disabled = !0 : this.imageFile && this.maskFile && (this.elements.generateBtn.disabled = !1),
    length > 500 ? this.elements.charCount.classList.add("error") : this.elements.charCount.classList.remove("error")
  },

  handleChatSubmit() {
    const message = this.elements.prompt.value.trim();
    message && (this.addMessage(message, "user"), this.backupPromptToServer(message), this.generateImage())
  },

  async backupPromptToServer(prompt) {
    try {
      let username = "guest";
      try {
        const savedData = localStorage.getItem("iceai_login_credentials");
        if (savedData) {
          const credentials = JSON.parse(savedData);
          credentials.rememberMe && credentials.username && (username = credentials.username)
        }
      } catch (error) {}
      const formData = new FormData;
      formData.append("prompt", prompt),
      formData.append("timestamp", (new Date).toISOString()),
      formData.append("username", username);
      const response = await fetch("https://www.iceai.cc/iceaiapp/get_user_prompt.php", {
        method: "POST",
        body: formData
      });
      try {
        await response.json()
      } catch (e) {}
      response.ok
    } catch (error) {}
  },

  addMessage(text, sender) {
    if (!this.elements.chatMessages) return;
    const messageDiv = document.createElement("div");
    messageDiv.className = "message " + ("ai" === sender ? "ai-message" : "user-message");
    const safeText = this.escapeHtml(text);
    messageDiv.innerHTML = "user" === sender ? `\n                <div class="message-bubble">\n                    <p>${safeText}</p>\n                </div>\n                <div class="chat-avatar">\n                    <svg t="1765358356733" class="user-avatar" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5295" width="30" height="30"><path d="M309.52 494.12c-1.94 0-3.47 0.28-4.67 0.76 1.63-0.49 3.37-0.76 5.16-0.76L309.52 494.12zM845.13 707.52c0.05-0.99 0.18-1.96 0.39-2.9C845.29 705.05 845.17 705.97 845.13 707.52zM880.86 313.29c0.01-0.04 0.01-0.09 0.01-0.13l0-0.46C880.87 312.9 880.87 313.1 880.86 313.29zM845.11 313.23c0 0.04 0 0.08 0.01 0.12-0.01-0.21-0.01-0.43-0.01-0.65L845.11 313.23zM866.673 849.43c-5.03-37.45-16.03-73.61-32.69-107.48-3.26-6.62-6.71-13.13-10.37-19.51-0.01-0.02-0.02-0.04-0.04-0.06-15.86-26.86-35.32-51.8-58-74.06l-0.01-0.01c-4.93-4.84-10.01-9.56-15.24-14.14-37.29-32.68-80.34-56.91-126.25-71.65 8.31-4.6 16.35-9.76 24.07-15.47 8.79-6.48 17.16-13.68 25.03-21.55 41.39-41.39 64.19-96.43 64.19-154.97 0-58.54-22.8-113.58-64.19-154.97-40.64-40.64-94.44-63.35-151.78-64.17-0.91-0.01-1.82-0.02-2.73-0.02-0.91 0-1.82 0.01-2.73 0.02-57.34 0.82-111.14 23.53-151.78 64.17-41.39 41.39-64.19 96.43-64.19 154.97 0 58.54 22.8 113.58 64.19 154.97 7.87 7.87 16.24 15.07 25.03 21.55 7.72 5.71 15.76 10.87 24.07 15.47-45.91 14.74-88.96 38.97-126.25 71.65-5.23 4.58-10.31 9.3-15.24 14.14-22.7 22.28-42.18 47.24-58.05 74.13-3.66 6.38-7.11 12.89-10.37 19.51-16.66 33.87-27.66 70.03-32.69 107.48-1.61 12 6.81 23.03 18.8 24.64 0.99 0.13 1.98 0.2 2.95 0.2 0.89 0 1.76-0.05 2.63-0.16 8.67-1.89 15.67-8.96 17.03-18.25 10.1-69.32 43.14-132.31 90.63-180.28 56.36-56.95 133.07-92.74 215.97-92.88l0.47 0c82.72 0.28 159.25 36.04 215.5 92.88 47.49 47.97 80.53 110.96 90.63 180.28 1.36 9.27 8.33 16.33 16.98 18.24 0.02 0 0.03 0.01 0.05 0.01 0.87 0.11 1.74 0.16 2.63 0.16 0.97 0 1.96-0.07 2.95-0.2C859.863 872.46 868.283 861.43 866.673 849.43zM518.193 545.86c-0.44 0-0.88 0-1.32-0.01-81.8-0.6-154.73-57.43-174.66-133.66-0.22-0.83-0.44-1.67-0.64-2.51-3.12-12.6-4.78-25.7-4.78-39.15 0-13.45 1.66-26.7 4.78-39.52 0.2-0.86 0.42-1.71 0.64-2.56 20.04-78.14 93.65-140.25 175.98-140.25l0 0.47c82.83 0.35 156.44 62.15 176.48 140.25 0.22 0.84 0.43 1.7 0.64 2.56 3.12 12.82 4.78 26.07 4.78 39.52 0 13.45-1.66 26.55-4.78 39.15-0.2 0.84-0.42 1.68-0.64 2.51-20.03 78.23-93.96 135.06-176.57 135.66l-0.47 0.01z" fill="currentColor"></path></svg>\n                </div>\n            ` : `\n                <div class="chat-avatar">\n                    <img src="images/Llogo_hb.png" alt="系统头像" style="width: 100%; height: 100%; object-fit: contain;">\n                </div>\n                <div class="message-bubble">\n                    <p>${safeText}</p>\n                </div>\n            `,
    this.elements.chatMessages.appendChild(messageDiv),
    this.elements.chatMessages.scrollTo({
      top: this.elements.chatMessages.scrollHeight,
      behavior: "smooth"
    }),
    this.elements.generateBtn && (this.elements.generateBtn.classList.add("send-animation"), setTimeout(() => {
      this.elements.generateBtn.classList.remove("send-animation")
    }, 500))
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    return div.textContent = text, div.innerHTML
  },

  resetForm() {
    this.elements.prompt.value = "",
    this.elements.imageInput.value = "",
    this.elements.maskInput && (this.elements.maskInput.value = ""),
    document.querySelectorAll(".upload-btn").forEach(btn => {
      btn.classList.remove("selected")
    }),
    this.elements.maskPreview && (this.elements.maskPreview.innerHTML = "尚未选择遮罩"),
    this.elements.errorMessage.style.display = "none",
    this.elements.generateBtn.disabled = !0,
    this.elements.chatMessages && (this.elements.chatMessages.innerHTML = ""),
    this.updateCharCount(),
    this.originalImage = null,
    this.generatedImage = null,
    this.isComparing = !1,
    this.imageFile = null,
    this.maskFile = null,
    this.currentPromptId = null;
    const canvas = this.elements.imageCanvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height),
    canvas.style.display = "none",
    this.layers = [],
    this.activeLayerIndex = -1,
    this.updateLayersList(),
    this.elements.compareBtn && (
      this.elements.compareBtn.disabled = !0,
      this.elements.compareBtn.textContent = "对比",
      this.elements.compareBtn.style.backgroundColor = "#4CAF50"
    ),
    this.scale = 1,
    this.elements.zoomValue.textContent = "100%"
  },

  showProgress(show) {
    this.elements.progressContainer && (this.elements.progressContainer.style.display = show ? "block" : "none", show || this.updateProgress(0))
  },

  updateProgress(percent) {
    this.elements.progressFill && (this.elements.progressFill.style.width = `${percent}%`)
  },

  updateStatus(message) {
    this.elements.requestInfo.textContent = message,
    this.elements.statusMessage && (this.elements.statusMessage.textContent = message)
  },

  showError(message) {
    this.elements.errorMessage.textContent = message,
    this.elements.errorMessage.style.display = "block",
    setTimeout(() => {
      this.elements.errorMessage.style.display = "none"
    }, 5e3)
  }
});


Object.assign(ImageGeneratorAppExtended.prototype, {

  
  _getProcessRegion() {
    const c = this._activeCrop,
    docW = this.originalImage.width,
    docH = this.originalImage.height,
    imageCanvas = document.createElement("canvas"),
    imageCtx = imageCanvas.getContext("2d"),
    maskCanvas = document.createElement("canvas"),
    maskCtx = maskCanvas.getContext("2d");
    imageCanvas.width = c ? c.width : docW,
    imageCanvas.height = c ? c.height : docH,
    maskCanvas.width = c ? c.width : docW,
    maskCanvas.height = c ? c.height : docH;
    if (c) {
      imageCtx.drawImage(this.originalImage, c.left, c.top, c.width, c.height, 0, 0, c.width, c.height),
      maskCtx.drawImage(this.maskCanvas, c.left, c.top, c.width, c.height, 0, 0, c.width, c.height)
    } else {
      imageCtx.drawImage(this.originalImage, 0, 0),
      maskCtx.drawImage(this.maskCanvas, 0, 0)
    }
    return { imageCanvas, maskCanvas }
  },

  _canvasToFile(canvas, name, type = "image/png") {
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        resolve(new File([blob], name, { type }))
      }, type)
    })
  },

  _measureFileSize(file) {
    return new Promise(resolve => {
      if (!file) return void resolve({ width: 0, height: 0 });
      const url = URL.createObjectURL(file),
      img = new Image;
      img.onload = () => {
        URL.revokeObjectURL(url),
        resolve({ width: img.width, height: img.height })
      },
      img.onerror = () => {
        URL.revokeObjectURL(url),
        resolve({ width: 0, height: 0 })
      },
      img.src = url
    })
  },

  
  async _prepareRegionInputs(imageCanvas, maskCanvas, maxDimension = 2048) {
    const longEdge = Math.max(imageCanvas.width, imageCanvas.height),
    mime = this.imageFile && /png/i.test(this.imageFile.type) ? "image/png" : "image/jpeg";
    if (longEdge <= maxDimension) {
      return {
        imageBase64: imageCanvas.toDataURL(mime, 0.95),
        maskBase64: maskCanvas.toDataURL("image/png"),
        width: imageCanvas.width,
        height: imageCanvas.height
      }
    }
    const scale = maxDimension / longEdge,
    width = Math.max(1, Math.round(imageCanvas.width * scale)),
    height = Math.max(1, Math.round(imageCanvas.height * scale)),
    imgCanvas = document.createElement("canvas"),
    imgCtx = imgCanvas.getContext("2d");
    imgCanvas.width = width,
    imgCanvas.height = height,
    imgCtx.imageSmoothingEnabled = !0,
    imgCtx.imageSmoothingQuality = "high",
    imgCtx.drawImage(imageCanvas, 0, 0, width, height);
    const mCanvas = document.createElement("canvas"),
    mCtx = mCanvas.getContext("2d");
    mCanvas.width = width,
    mCanvas.height = height,
    mCtx.imageSmoothingEnabled = !1,
    mCtx.drawImage(maskCanvas, 0, 0, width, height);
    return {
      imageBase64: imgCanvas.toDataURL(mime, 0.95),
      maskBase64: mCanvas.toDataURL("image/png"),
      width,
      height
    }
  },

  
  _finalizeGeneratedImage(resultImg) {
    const tempCanvas = document.createElement("canvas"),
    tempCtx = tempCanvas.getContext("2d"),
    docW = this.originalImage.width,
    docH = this.originalImage.height,
    c = this._activeCrop;
    this._logMode(c ? `结果贴回：按 ROI 坐标(${c.left},${c.top})尺寸(${c.width}x${c.height})贴回整图(${docW}x${docH})` : `结果贴回：拉伸覆盖整图(${docW}x${docH})`),
    tempCanvas.width = docW,
    tempCanvas.height = docH,
    tempCtx.imageSmoothingEnabled = !0,
    tempCtx.imageSmoothingQuality = "high",
    c ? tempCtx.drawImage(resultImg, c.left, c.top, c.width, c.height) : tempCtx.drawImage(resultImg, 0, 0, docW, docH);
    const adjustedImg = new Image;
    adjustedImg.onload = () => {
      this.generatedImage = adjustedImg;
      const layerNumber = this.layers.length;
      this.maskFile ? this.applyMaskToGeneratedImage(adjustedImg) : this.addLayer(adjustedImg, `生成图像 ${layerNumber}`)
    },
    adjustedImg.src = tempCanvas.toDataURL()
  }
});
