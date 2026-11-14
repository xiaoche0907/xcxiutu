
const MediaPipeManager = (() => {
    let isInitialized = false;
    let vision = null;
    let faceLandmarker = null;
    let poseLandmarker = null;
    let imageSegmenter = null;
    let filesetResolver = null;
    let faceDetection = null;

    
    let models = {
        face: "",
        pose: "",
        segment: ""
    };

    
    const config = {
        maxInferenceSize: 512,
        delegate: "GPU"
    };

    
    const decodeBase64 = (base64String) => {
        if (!base64String) return null;
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    };

    
    const resizeImage = (img, maxSize) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let scale = 1;

        if (img.width > maxSize || img.height > maxSize) {
            scale = Math.min(maxSize / img.width, maxSize / img.height);
        }

        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        return { canvas, scale };
    };

    const b64ToBlobUrl = (b64, mime) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: mime }));
    };

    const isSimdSupported = () => {
        try {
            if (typeof WebAssembly === 'undefined' || typeof WebAssembly.validate !== 'function') return false;
            const simdTestModule = new Uint8Array([
                0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
                0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
                0x03, 0x02, 0x01, 0x00,
                0x0a, 0x0a, 0x01, 0x08, 0x00,
                0x41, 0x00, 0xfd, 0x0c, 0x00, 0x00, 0x0b, 0x0b
            ]);
            return WebAssembly.validate(simdTestModule);
        } catch (e) {
            return false;
        }
    };

    const buildLocalFilesetResolver = async () => {
        const isSimd = await isSimdSupported();
        if (isSimd) {
            if (typeof VISION_WASM_LOADER_B64 === 'undefined' || typeof VISION_WASM_INTERNAL_B64 === 'undefined') {
                throw new Error('Vision WASM SIMD 数据未加载');
            }
            return {
                wasmLoaderPath: b64ToBlobUrl(VISION_WASM_LOADER_B64, 'text/javascript'),
                wasmBinaryPath: b64ToBlobUrl(VISION_WASM_INTERNAL_B64, 'application/wasm')
            };
        }
        if (typeof VISION_WASM_NOSIMD_LOADER_B64 === 'undefined' || typeof VISION_WASM_NOSIMD_INTERNAL_B64 === 'undefined') {
            throw new Error('Vision WASM NOSIMD 数据未加载');
        }
        return {
            wasmLoaderPath: b64ToBlobUrl(VISION_WASM_NOSIMD_LOADER_B64, 'text/javascript'),
            wasmBinaryPath: b64ToBlobUrl(VISION_WASM_NOSIMD_INTERNAL_B64, 'application/wasm')
        };
    };

    
    const initialize = async () => {
        if (isInitialized) return true;

        try {
            vision = await import('http://iceai.cc/iceaiapp/MD_iceai_0.1.2@xingxing/iceai_icecream_md@xingxing2026/vision_bundle.mjs');
            filesetResolver = await buildLocalFilesetResolver();

            
            await Promise.all([
                
                (async () => {
                    if (models.face) {
                        const modelBuffer = decodeBase64(models.face);
                        if (modelBuffer) {
                            faceLandmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
                                baseOptions: {
                                    modelAssetBuffer: modelBuffer,
                                    delegate: config.delegate
                                },
                                runningMode: "IMAGE",
                                numFaces: 5
                            });
                        }
                    }
                })(),
                
                (async () => {
                    if (models.pose) {
                        const modelBuffer = decodeBase64(models.pose);
                        if (modelBuffer) {
                            poseLandmarker = await vision.PoseLandmarker.createFromOptions(filesetResolver, {
                                baseOptions: {
                                    modelAssetBuffer: modelBuffer,
                                    delegate: config.delegate
                                },
                                runningMode: "IMAGE",
                                numPoses: 1
                            });
                        }
                    }
                })(),
                
                (async () => {
                    if (models.segment) {
                        const modelBuffer = decodeBase64(models.segment);
                        if (modelBuffer) {
                            imageSegmenter = await vision.ImageSegmenter.createFromOptions(filesetResolver, {
                                baseOptions: {
                                    modelAssetBuffer: modelBuffer,
                                    delegate: config.delegate
                                },
                                runningMode: "IMAGE",
                                outputCategoryMask: true
                            });
                        }
                    }
                })(),
                
                (async () => {
                    await window.FaceDetectionManager.initialize();
                })()
            ]);

            isInitialized = true;
            return true;
        } catch (error) {
            console.error("初始化失败:", error);
            return false;
        }
    };

    
    const processImage = async (img) => {
        if (!isInitialized) await initialize();

        const { canvas: scaledCanvas, scale } = resizeImage(img, config.maxInferenceSize);

        
        const tasks = [];
        if (faceLandmarker) tasks.push(faceLandmarker.detect(scaledCanvas));
        if (poseLandmarker) tasks.push(poseLandmarker.detect(scaledCanvas));
        if (imageSegmenter) tasks.push(imageSegmenter.segment(scaledCanvas));
        
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        
        tasks.push(window.FaceDetectionManager.detectFaces(canvas));

        const results = await Promise.all(tasks);

        return {
            face: results[0],
            pose: results[1],
            segment: results[2],
            faceDetection: results[3],
            scale
        };
    };

    
    const detectLandmarks = async (imageFile) => {
        if (!isInitialized) await initialize();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
            reader.onload = async (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error('图片解码失败'));
                img.onload = async () => {
                    try {
                        const { canvas: scaledCanvas, scale } = resizeImage(img, config.maxInferenceSize);
                        
                        
                        let faceLandmarks468 = null;
                        if (faceLandmarker) {
                            const faceResult = await faceLandmarker.detect(scaledCanvas);
                            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
                                
                                
                                
                                faceLandmarks468 = faceResult.faceLandmarks[0].map(point => ({
                                    x: point.x * img.width,
                                    y: point.y * img.height,
                                    z: point.z
                                }));
                            }
                        }

                        
                        let poseLandmarks = null;
                        if (poseLandmarker) {
                            const poseResult = await poseLandmarker.detect(scaledCanvas);
                            if (poseResult.landmarks && poseResult.landmarks.length > 0) {
                                
                                poseLandmarks = poseResult.landmarks[0].map(point => ({
                                    x: point.x * img.width,
                                    y: point.y * img.height,
                                    z: point.z,
                                    visibility: point.visibility
                                }));
                            }
                        }

                        
                        let faceDetectionResults = null;
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        
                        
                        faceDetectionResults = await window.FaceDetectionManager.detectFaces(canvas);

                        resolve({
                            faceLandmarks468,
                            poseLandmarks,
                            faceDetectionResults
                        });
                    } catch (error) {
                        reject(error);
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(imageFile);
        });
    };

    
    const detectFaceDetection = async (imageFile) => {
        if (!isInitialized) await initialize();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const img = new Image();
                img.onload = async () => {
                    try {
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        
                        
                        const results = await window.FaceDetectionManager.detectFaces(canvas);
                        resolve(results);
                    } catch (error) {
                        console.error("Face Detection检测失败:", error);
                        reject(error);
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(imageFile);
        });
    };

    
    const resizeImageBitmap = (imageBitmap, maxSize) => {
        let scale = 1;
        if (imageBitmap.width > maxSize || imageBitmap.height > maxSize) {
            scale = Math.min(maxSize / imageBitmap.width, maxSize / imageBitmap.height);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(imageBitmap.width * scale);
        canvas.height = Math.round(imageBitmap.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
        
        return { canvas, scale };
    };

    
    const maskToBase64 = (maskData, width, height) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(width, height);
        for (let i = 0; i < maskData.length; i++) {
            const value = maskData[i];
            imageData.data[i * 4] = value;     
            imageData.data[i * 4 + 1] = value; 
            imageData.data[i * 4 + 2] = value; 
            imageData.data[i * 4 + 3] = 255;   
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png');
    };

    
    let ortSessionPromise = null;
    const MODNET_INPUT_SIZE = 512;

    const b64ToUint8Array = (b64) => {
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return u8;
    };

    
    const ensureOrtSession = async () => {
        if (ortSessionPromise) return ortSessionPromise;
        ortSessionPromise = (async () => {
            if (typeof ort === 'undefined') throw new Error('onnxruntime-web 未加载');
            if (typeof MODEL_B64 === 'undefined' || typeof WASM_B64 === 'undefined') throw new Error('MODNet 模型数据未加载');
            ort.env.wasm.wasmPaths = {
                'ort-wasm-simd.wasm': URL.createObjectURL(new Blob([b64ToUint8Array(WASM_B64)], { type: 'application/wasm' }))
            };
            return await ort.InferenceSession.create(b64ToUint8Array(MODEL_B64), {
                executionProviders: ["wasm"],
                graphOptimizationLevel: "all"
            });
        })().catch((error) => {
            ortSessionPromise = null;
            console.error('MODNet 模型加载失败:', error);
            return null;
        });
        return ortSessionPromise;
    };

    
    const detectIdphotoMask = async (img) => {
        try {
            const session = await ensureOrtSession();
            if (!session) return null;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = MODNET_INPUT_SIZE;
            tempCanvas.height = MODNET_INPUT_SIZE;
            const tctx = tempCanvas.getContext('2d');
            tctx.drawImage(img, 0, 0, MODNET_INPUT_SIZE, MODNET_INPUT_SIZE);
            const imgData = tctx.getImageData(0, 0, MODNET_INPUT_SIZE, MODNET_INPUT_SIZE);

            const float32 = new Float32Array(3 * MODNET_INPUT_SIZE * MODNET_INPUT_SIZE);
            for (let i = 0; i < MODNET_INPUT_SIZE * MODNET_INPUT_SIZE; i++) {
                float32[i] = imgData.data[i * 4 + 0] / 255.0;
                float32[i + MODNET_INPUT_SIZE * MODNET_INPUT_SIZE] = imgData.data[i * 4 + 1] / 255.0;
                float32[i + 2 * MODNET_INPUT_SIZE * MODNET_INPUT_SIZE] = imgData.data[i * 4 + 2] / 255.0;
            }
            const inputTensor = new ort.Tensor('float32', float32, [1, 3, MODNET_INPUT_SIZE, MODNET_INPUT_SIZE]);

            const outputs = await session.run({ input: inputTensor });
            const alphaData = outputs.output.data;

            
            
            const maskArray = new Uint8Array(MODNET_INPUT_SIZE * MODNET_INPUT_SIZE);
            for (let i = 0; i < maskArray.length; i++) {
                maskArray[i] = Math.max(0, Math.min(255, alphaData[i] * 255));
            }
            return maskToBase64(maskArray, MODNET_INPUT_SIZE, MODNET_INPUT_SIZE);
        } catch (error) {
            console.error('MODNet 证件照分割推理失败:', error);
            return null;
        }
    };

    
    const detectIdphoto = async (imageFile) => {
        if (!imageFile) return null;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
            reader.onload = async (e) => {
                const img = new Image();
                img.onload = async () => {
                    try {
                        const mask = await detectIdphotoMask(img);
                        resolve(mask);
                    } catch (error) {
                        reject(error);
                    }
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
        });
    };

    
    const detectMasks = async (imageFile, faceLandmarks468, faceWidthPx, faceNeckAnchors) => {
        if (!isInitialized) await initialize();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
            reader.onload = async (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error('图片解码失败'));
                img.onload = async () => {
                    try {
                        const { canvas: scaledCanvas, scale } = resizeImage(img, config.maxInferenceSize);
                        
                        
                        let categoryMask = null;
                        if (imageSegmenter) {
                            const segmentResult = await imageSegmenter.segment(scaledCanvas);
                            categoryMask = segmentResult.categoryMask;
                        }

                        if (!categoryMask) {
                            resolve(null);
                            return;
                        }

                        
                        const maskData = categoryMask.getAsUint8Array();
                        const maskWidth = categoryMask.width;
                        const maskHeight = categoryMask.height;

                        
                        const NORMALIZED_SIZE = 512;
                        
                        
                        
                        const faceBlurRatio = 0.0125;
                        const bodyBlurRatio = 0.025;
                        const bodyErodeRatio = 0.0125; 
                        const faceErodeRatio = 0.00625; 
                        const minBlur = 0;
                        const maxBlur = 50;
                        
                        
                        const normalizedFaceWidth = faceWidthPx * NORMALIZED_SIZE / img.width;
                        const faceBlur = Math.max(minBlur, Math.min(maxBlur, normalizedFaceWidth * faceBlurRatio));
                        const bodyBlur = Math.max(minBlur, Math.min(maxBlur, normalizedFaceWidth * bodyBlurRatio));
                        const bodyErodeRadius = Math.max(0, Math.min(50, normalizedFaceWidth * bodyErodeRatio));
                        const faceErodeRadius = Math.max(0, Math.min(50, normalizedFaceWidth * faceErodeRatio));

                        
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = NORMALIZED_SIZE;
                        tempCanvas.height = NORMALIZED_SIZE;
                        const tempCtx = tempCanvas.getContext('2d');
                        
                        const srcCanvas = document.createElement('canvas');
                        srcCanvas.width = NORMALIZED_SIZE;
                        srcCanvas.height = NORMALIZED_SIZE;
                        const srcCtx = srcCanvas.getContext('2d');
                        const blurCanvas = (blurRadius) => {
                            srcCtx.drawImage(tempCanvas, 0, 0);
                            tempCtx.fillStyle = '#000000';
                            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            tempCtx.filter = `blur(${blurRadius}px)`;
                            tempCtx.drawImage(srcCanvas, 0, 0);
                            tempCtx.filter = 'none';
                        };
                        
                        
                        const erodeCanvas = (erodeRadius) => {
                            if (erodeRadius <= 0) return;
                            const radius = Math.ceil(erodeRadius);
                            const imageData = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            const data = imageData.data;
                            const originalData = new Uint8ClampedArray(data);
                            
                            for (let y = 0; y < NORMALIZED_SIZE; y++) {
                                for (let x = 0; x < NORMALIZED_SIZE; x++) {
                                    const idx = (y * NORMALIZED_SIZE + x) * 4;
                                    
                                    if (originalData[idx] > 0) {
                                        let shouldErode = false;
                                        for (let dy = -radius; dy <= radius && !shouldErode; dy++) {
                                            for (let dx = -radius; dx <= radius && !shouldErode; dx++) {
                                                const nx = x + dx;
                                                const ny = y + dy;
                                                if (nx >= 0 && nx < NORMALIZED_SIZE && ny >= 0 && ny < NORMALIZED_SIZE) {
                                                    const nIdx = (ny * NORMALIZED_SIZE + nx) * 4;
                                                    if (originalData[nIdx] === 0) {
                                                        shouldErode = true;
                                                    }
                                                }
                                            }
                                        }
                                        if (shouldErode) {
                                            data[idx] = 0;     
                                            data[idx+1] = 0;   
                                            data[idx+2] = 0;   
                                        }
                                    }
                                }
                            }
                            tempCtx.putImageData(imageData, 0, 0);
                        };

                        
                        let faceSkinMask = null;
                        let faceColorSkinMask = null;
                        let rawFaceSkinDataForColorV1 = null;
                        let eyesMaskArrayV1 = null;
                        let lipsMaskArrayV1 = null;
                        if (faceLandmarks468 && faceLandmarks468.length > 0) {
                            const imgW = img.width;
                            const imgH = img.height;
                            
                            
                            const facePartsCanvas = document.createElement('canvas');
                            facePartsCanvas.width = imgW;
                            facePartsCanvas.height = imgH;
                            const facePartsCtx = facePartsCanvas.getContext('2d');
                            facePartsCtx.fillStyle = '#000000';
                            facePartsCtx.fillRect(0, 0, imgW, imgH);
                            
                            
                            const getCenter = (points) => {
                                let sumX = 0, sumY = 0;
                                points.forEach(idx => {
                                    sumX += faceLandmarks468[idx].x;
                                    sumY += faceLandmarks468[idx].y;
                                });
                                return { x: sumX / points.length, y: sumY / points.length };
                            };
                            
                            
                            
                            const expandAndDraw = (points, scale) => {
                                const center = getCenter(points);
                                facePartsCtx.fillStyle = '#FFFFFF';
                                facePartsCtx.beginPath();
                                for (let i = 0; i < points.length; i++) {
                                    const idx = points[i];
                                    const x = faceLandmarks468[idx].x;
                                    const y = faceLandmarks468[idx].y;
                                    const dx = x - center.x;
                                    const dy = y - center.y;
                                    const fx = center.x + dx * scale;
                                    const fy = center.y + dy * scale;
                                    
                                    if (i === 0) facePartsCtx.moveTo(fx, fy);
                                    else facePartsCtx.lineTo(fx, fy);
                                }
                                facePartsCtx.closePath();
                                facePartsCtx.fill();
                            };
                            
                            
                            expandAndDraw([33, 246, 161, 160, 159, 158, 469, 154, 153, 145, 144, 163, 7], 2.0); 
                            expandAndDraw([476, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381], 2.0); 
                            expandAndDraw([0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 62, 185, 40, 39, 37], 1.2); 
                            expandAndDraw([209, 129, 64, 98, 97, 2, 326, 327, 294, 331, 429, 438, 457, 274, 19, 44, 237, 218], 1.2); 
                            expandAndDraw([70, 63, 105, 66, 107, 55, 221, 222, 223, 224, 46], 1.3); 
                            expandAndDraw([285, 336, 296, 334, 293, 300, 276, 444, 443, 442], 1.3); 
                            
                            
                            const facePartsData = facePartsCtx.getImageData(0, 0, imgW, imgH).data;
                            
                            
                            const smallCanvas = document.createElement('canvas');
                            smallCanvas.width = maskWidth;
                            smallCanvas.height = maskHeight;
                            const smallCtx = smallCanvas.getContext('2d');
                            
                            smallCtx.fillStyle = '#000000';
                            smallCtx.fillRect(0, 0, maskWidth, maskHeight);

                            
                            const rawFaceCanvasV1 = document.createElement('canvas');
                            rawFaceCanvasV1.width = maskWidth;
                            rawFaceCanvasV1.height = maskHeight;
                            const rawFaceCtxV1 = rawFaceCanvasV1.getContext('2d');
                            rawFaceCtxV1.fillStyle = '#000000';
                            rawFaceCtxV1.fillRect(0, 0, maskWidth, maskHeight);
                            
                            
                            const tempFaceCanvas = document.createElement('canvas');
                            tempFaceCanvas.width = maskWidth;
                            tempFaceCanvas.height = maskHeight;
                            const tempFaceCtx = tempFaceCanvas.getContext('2d');
                            tempFaceCtx.fillStyle = '#000000';
                            tempFaceCtx.fillRect(0, 0, maskWidth, maskHeight);
                            
                            for (let y = 0; y < maskHeight; y++) {
                                for (let x = 0; x < maskWidth; x++) {
                                    const idx = y * maskWidth + x;
                                    const category = maskData[idx];
                                    
                                    
                                    if (category === 3) {
                                        tempFaceCtx.fillStyle = '#FFFFFF';
                                        tempFaceCtx.fillRect(x, y, 1, 1);
                                    }
                                }
                            }
                            
                            
                            if (faceErodeRadius > 0) {
                                const erodeRadiusInMask = Math.max(1, Math.round(faceErodeRadius * maskWidth / NORMALIZED_SIZE));
                                const imageData = tempFaceCtx.getImageData(0, 0, maskWidth, maskHeight);
                                const data = imageData.data;
                                const originalData = new Uint8ClampedArray(data);
                                
                                for (let y = 0; y < maskHeight; y++) {
                                    for (let x = 0; x < maskWidth; x++) {
                                        const idx = (y * maskWidth + x) * 4;
                                        if (originalData[idx] > 0) {
                                            let shouldErode = false;
                                            for (let dy = -erodeRadiusInMask; dy <= erodeRadiusInMask && !shouldErode; dy++) {
                                                for (let dx = -erodeRadiusInMask; dx <= erodeRadiusInMask && !shouldErode; dx++) {
                                                    const nx = x + dx;
                                                    const ny = y + dy;
                                                    if (nx >= 0 && nx < maskWidth && ny >= 0 && ny < maskHeight) {
                                                        const nIdx = (ny * maskWidth + nx) * 4;
                                                        if (originalData[nIdx] === 0) {
                                                            shouldErode = true;
                                                        }
                                                    }
                                                }
                                            }
                                            if (shouldErode) {
                                                data[idx] = 0;
                                                data[idx+1] = 0;
                                                data[idx+2] = 0;
                                            }
                                        }
                                    }
                                }
                                tempFaceCtx.putImageData(imageData, 0, 0);
                            }
                            
                            
                            const erodedFaceData = tempFaceCtx.getImageData(0, 0, maskWidth, maskHeight).data;
                            
                            for (let y = 0; y < maskHeight; y++) {
                                for (let x = 0; x < maskWidth; x++) {
                                    const idx = y * maskWidth + x;
                                    const erodedValue = erodedFaceData[idx * 4];
                                    
                                    
                                    if (erodedValue > 0) {
                                        
                                        const origX = Math.round(x / scale);
                                        const origY = Math.round(y / scale);
                                        
                                        
                                        if (origX >= 0 && origX < imgW && origY >= 0 && origY < imgH) {
                                            const partsIdx = (origY * imgW + origX) * 4;
                                            
                                            
                                            rawFaceCtxV1.fillStyle = '#FFFFFF';
                                            rawFaceCtxV1.fillRect(x, y, 1, 1);

                                            
                                            const isFacePart = facePartsData[partsIdx] === 255;
                                            
                                            
                                            if (!isFacePart) {
                                                smallCtx.fillStyle = '#FFFFFF';
                                                smallCtx.fillRect(x, y, 1, 1);
                                            }
                                        }
                                    }
                                }
                            }
                            
                            
                            tempCtx.fillStyle = '#000000';
                            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            tempCtx.drawImage(smallCanvas, 0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            
                            
                            blurCanvas(faceBlur);
                            
                            
                            const blurredData = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data;
                            const maskArray = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
                            for (let i = 0; i < maskArray.length; i++) {
                                maskArray[i] = blurredData[i * 4];
                            }
                            
                            faceSkinMask = maskToBase64(maskArray, NORMALIZED_SIZE, NORMALIZED_SIZE);

                            
                            tempCtx.fillStyle = '#000000';
                            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            tempCtx.drawImage(rawFaceCanvasV1, 0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            blurCanvas(faceBlur);

                            const rawBlurredDataV1 = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data;
                            rawFaceSkinDataForColorV1 = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
                            for (let i = 0; i < rawFaceSkinDataForColorV1.length; i++) {
                                rawFaceSkinDataForColorV1[i] = rawBlurredDataV1[i * 4];
                            }
                        }

                        
                        const regions = [
                            { name: 'bodySkin', category: 2, color: [255, 255, 0] },  
                            { name: 'hair', category: 1, color: [255, 0, 0] },        
                            { name: 'clothes', category: 4, color: [0, 0, 255] },     
                            { name: 'others', category: 0, color: [128, 0, 128] }     
                        ];

                        
                        let eyesMask = null;
                        if (faceLandmarks468 && faceLandmarks468.length > 0) {
                            const imgW = img.width;
                            const imgH = img.height;
                            
                            const eyesCanvas = document.createElement('canvas');
                            eyesCanvas.width = imgW;
                            eyesCanvas.height = imgH;
                            const eyesCtx = eyesCanvas.getContext('2d');
                            eyesCtx.fillStyle = '#000000';
                            eyesCtx.fillRect(0, 0, imgW, imgH);
                            
                            const drawEyesShape = (points) => {
                                eyesCtx.fillStyle = '#FFFFFF';
                                eyesCtx.beginPath();
                                for (let i = 0; i < points.length; i++) {
                                    const idx = points[i];
                                    const x = faceLandmarks468[idx].x;
                                    const y = faceLandmarks468[idx].y;
                                    if (i === 0) eyesCtx.moveTo(x, y);
                                    else eyesCtx.lineTo(x, y);
                                }
                                eyesCtx.closePath();
                                eyesCtx.fill();
                            };
                            
                            drawEyesShape([33, 246, 161, 160, 159, 158, 469, 154, 153, 145, 144, 163, 7]);
                            drawEyesShape([476, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381]);
                            
                            tempCtx.fillStyle = '#000000';
                            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            tempCtx.drawImage(eyesCanvas, 0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            blurCanvas(faceBlur);
                            
                            const eyesBlurredData = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data;
                            eyesMaskArrayV1 = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
                            for (let i = 0; i < eyesMaskArrayV1.length; i++) {
                                eyesMaskArrayV1[i] = eyesBlurredData[i * 4];
                            }
                            
                            eyesMask = maskToBase64(eyesMaskArrayV1, NORMALIZED_SIZE, NORMALIZED_SIZE);
                        }
                        
                        
                        let lipsMask = null;
                        if (faceLandmarks468 && faceLandmarks468.length > 0) {
                            const imgW = img.width;
                            const imgH = img.height;
                            
                            const lipsCanvas = document.createElement('canvas');
                            lipsCanvas.width = imgW;
                            lipsCanvas.height = imgH;
                            const lipsCtx = lipsCanvas.getContext('2d');
                            lipsCtx.fillStyle = '#000000';
                            lipsCtx.fillRect(0, 0, imgW, imgH);
                            
                            const drawLipsShape = (points) => {
                                lipsCtx.fillStyle = '#FFFFFF';
                                lipsCtx.beginPath();
                                for (let i = 0; i < points.length; i++) {
                                    const idx = points[i];
                                    const x = faceLandmarks468[idx].x;
                                    const y = faceLandmarks468[idx].y;
                                    if (i === 0) lipsCtx.moveTo(x, y);
                                    else lipsCtx.lineTo(x, y);
                                }
                                lipsCtx.closePath();
                                lipsCtx.fill();
                            };
                            
                            drawLipsShape([61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 306, 292, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78, 62, 76]);
                            drawLipsShape([291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61, 76, 62, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 292, 306]);
                            
                           
                            
                            tempCtx.fillStyle = '#000000';
                            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            tempCtx.drawImage(lipsCanvas, 0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            blurCanvas(faceBlur);
                            
                            const lipsBlurredData = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data;
                            lipsMaskArrayV1 = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
                            for (let i = 0; i < lipsMaskArrayV1.length; i++) {
                                lipsMaskArrayV1[i] = lipsBlurredData[i * 4];
                            }
                            
                            lipsMask = maskToBase64(lipsMaskArrayV1, NORMALIZED_SIZE, NORMALIZED_SIZE);
                        }
                        
                        
                        if (rawFaceSkinDataForColorV1 && eyesMaskArrayV1 && lipsMaskArrayV1) {
                            const colorSkinArray = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
                            for (let i = 0; i < colorSkinArray.length; i++) {
                                colorSkinArray[i] = Math.max(0, Math.min(255, rawFaceSkinDataForColorV1[i] - eyesMaskArrayV1[i] - lipsMaskArrayV1[i]));
                            }
                            faceColorSkinMask = maskToBase64(colorSkinArray, NORMALIZED_SIZE, NORMALIZED_SIZE);
                        }
                        
                        const masks = {
                            faceSkin: faceSkinMask,
                            faceColorSkin: faceColorSkinMask,
                            bodySkin: null,
                            hair: null,
                            clothes: null,
                            others: null,
                            eyes: eyesMask,
                            lips: lipsMask
                        };

                        for (const region of regions) {
                            
                            const smallCanvas = document.createElement('canvas');
                            smallCanvas.width = maskWidth;
                            smallCanvas.height = maskHeight;
                            const smallCtx = smallCanvas.getContext('2d');
                            
                            smallCtx.fillStyle = '#000000';
                            smallCtx.fillRect(0, 0, maskWidth, maskHeight);
                            
                            for (let y = 0; y < maskHeight; y++) {
                                for (let x = 0; x < maskWidth; x++) {
                                    const idx = y * maskWidth + x;
                                    const category = maskData[idx];
                                    
                                    if (category === region.category) {
                                        smallCtx.fillStyle = '#FFFFFF';
                                        smallCtx.fillRect(x, y, 1, 1);
                                    }
                                }
                            }
                            
                            tempCtx.fillStyle = '#000000';
                            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            tempCtx.drawImage(smallCanvas, 0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                            
                            
                            if (region.name === 'bodySkin') {
                                erodeCanvas(bodyErodeRadius);
                            }
                            
                            
                            blurCanvas(bodyBlur);
                            
                            const blurredData = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data;
                            const maskArray = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
                            for (let i = 0; i < maskArray.length; i++) {
                                maskArray[i] = blurredData[i * 4];
                            }
                            
                            masks[region.name] = maskToBase64(maskArray, NORMALIZED_SIZE, NORMALIZED_SIZE);
                        }

                        
                        
                        
                        
                        let perFaceBodySkins = null;
                        if (faceNeckAnchors && faceNeckAnchors.length > 1 && faceNeckAnchors.length <= 10 && masks.bodySkin) {
                            const anchorPx = faceNeckAnchors.map(a => ({
                                x: Math.round(a.x * maskWidth),
                                y: Math.round(a.y * maskHeight)
                            }));
                            const personCtxs = faceNeckAnchors.map(() => {
                                const c = document.createElement('canvas');
                                c.width = maskWidth;
                                c.height = maskHeight;
                                const ctx = c.getContext('2d');
                                ctx.fillStyle = '#000000';
                                ctx.fillRect(0, 0, maskWidth, maskHeight);
                                return ctx;
                            });
                            for (let y = 0; y < maskHeight; y++) {
                                for (let x = 0; x < maskWidth; x++) {
                                    if (maskData[y * maskWidth + x] !== 2) continue;
                                    let best = 0;
                                    let bestD = Infinity;
                                    for (let p = 0; p < anchorPx.length; p++) {
                                        const dx = x - anchorPx[p].x;
                                        const dy = y - anchorPx[p].y;
                                        const d = dx * dx + dy * dy;
                                        if (d < bestD) { bestD = d; best = p; }
                                    }
                                    personCtxs[best].fillStyle = '#FFFFFF';
                                    personCtxs[best].fillRect(x, y, 1, 1);
                                }
                            }
                            perFaceBodySkins = [];
                            for (let p = 0; p < personCtxs.length; p++) {
                                tempCtx.fillStyle = '#000000';
                                tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                                tempCtx.drawImage(personCtxs[p].canvas, 0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
                                erodeCanvas(bodyErodeRadius);
                                blurCanvas(bodyBlur);
                                const bd = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data;
                                const arr = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
                                for (let i = 0; i < arr.length; i++) arr[i] = bd[i * 4];
                                perFaceBodySkins.push(maskToBase64(arr, NORMALIZED_SIZE, NORMALIZED_SIZE));
                            }
                        }
                        masks.perFaceBodySkins = perFaceBodySkins;

                        resolve(masks);
                    } catch (error) {
                        reject(error);
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(imageFile);
        });
    };

    
    const cropFaceRegion = (img, faceDetectionResults, faceIndex = 0) => {
        if (!faceDetectionResults || !faceDetectionResults.detections || faceDetectionResults.detections.length === 0) {
            return null;
        }
        if (faceIndex < 0 || faceIndex >= faceDetectionResults.detections.length) {
            return null;
        }

        const detection = faceDetectionResults.detections[faceIndex];
        const box = detection.boundingBox;

        let x = box.xCenter * img.width - box.width * img.width / 2;
        let y = box.yCenter * img.height - box.height * img.height / 2;
        let width = box.width * img.width;
        let height = box.height * img.height;

        const expandScale = 1.5;
        const newWidth = width * expandScale;
        const newHeight = height * expandScale;
        const newX = x - (newWidth - width) / 2;
        const newY = y - (newHeight - height) / 2;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const cropX = Math.max(0, Math.floor(newX));
        const cropY = Math.max(0, Math.floor(newY));
        const cropWidth = Math.min(img.width - cropX, Math.floor(newWidth));
        const cropHeight = Math.min(img.height - cropY, Math.floor(newHeight));

        canvas.width = cropWidth;
        canvas.height = cropHeight;

        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        return {
            canvas,
            offsetX: cropX,
            offsetY: cropY,
            width: cropWidth,
            height: cropHeight
        };
    };

    
    const detectCropRegion = async (cropData, originalImg) => {
        if (!cropData) return null;

        const tempImg = new Image();
        tempImg.src = cropData.canvas.toDataURL();

        await new Promise((resolve, reject) => {
            tempImg.onload = resolve;
            tempImg.onerror = () => reject(new Error('裁切图解码失败'));
        });

        const { canvas: scaledCanvas, scale } = resizeImage(tempImg, config.maxInferenceSize);

        let faceLandmarks468 = null;
        if (faceLandmarker) {
            const faceResult = await faceLandmarker.detect(scaledCanvas);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
                
                const cropCenterX = cropData.width / 2;
                const cropCenterY = cropData.height / 2;
                let bestIdx = 0;
                let bestDist = Infinity;
                for (let fi = 0; fi < faceResult.faceLandmarks.length; fi++) {
                    const pts = faceResult.faceLandmarks[fi];
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (let pi = 0; pi < pts.length; pi++) {
                        const px = pts[pi].x * tempImg.width;
                        const py = pts[pi].y * tempImg.height;
                        if (px < minX) minX = px; else if (px > maxX) maxX = px;
                        if (py < minY) minY = py; else if (py > maxY) maxY = py;
                    }
                    const cx = (minX + maxX) / 2;
                    const cy = (minY + maxY) / 2;
                    const dist = Math.hypot(cx - cropCenterX, cy - cropCenterY);
                    if (dist < bestDist) { bestDist = dist; bestIdx = fi; }
                }
                if (faceResult.faceLandmarks.length > 1) {
                    ;
                }
                faceLandmarks468 = faceResult.faceLandmarks[bestIdx].map(point => ({
                    x: point.x * tempImg.width + cropData.offsetX,
                    y: point.y * tempImg.height + cropData.offsetY,
                    z: point.z
                }));
            }
        }

        let categoryMask = null;
        if (imageSegmenter) {
            const segmentResult = await imageSegmenter.segment(scaledCanvas);
            categoryMask = segmentResult.categoryMask;
        }

        return {
            faceLandmarks468,
            categoryMask,
            cropData,
            scale,
            tempImg
        };
    };

    
    const generateMasksFromCrop = async (cropResult, originalImg, faceWidthPx) => {
        if (!cropResult || !cropResult.categoryMask) {
            return null;
        }

        const { categoryMask, cropData, scale, tempImg, faceLandmarks468 } = cropResult;
        const maskData = categoryMask.getAsUint8Array();
        const maskWidth = categoryMask.width;
        const maskHeight = categoryMask.height;

        const NORMALIZED_SIZE = 512;
        
        
        
        const faceBlurRatio = 0.0125;
        const bodyBlurRatio = 0.025;
        const faceErodeRatio = 0.00625; 
        const minBlur = 0;
        const maxBlur = 50;
        
        
        const normalizedFaceWidth = faceWidthPx * NORMALIZED_SIZE / originalImg.width;
        const faceBlur = Math.max(minBlur, Math.min(maxBlur, normalizedFaceWidth * faceBlurRatio));
        const bodyBlur = Math.max(minBlur, Math.min(maxBlur, normalizedFaceWidth * bodyBlurRatio));
        const faceErodeRadius = Math.max(0, Math.min(50, normalizedFaceWidth * faceErodeRatio));
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = NORMALIZED_SIZE;
        tempCanvas.height = NORMALIZED_SIZE;
        const tempCtx = tempCanvas.getContext('2d');
        
        const srcCanvas2 = document.createElement('canvas');
        srcCanvas2.width = NORMALIZED_SIZE;
        srcCanvas2.height = NORMALIZED_SIZE;
        const srcCtx2 = srcCanvas2.getContext('2d');
        const blurCanvas2 = (blurRadius) => {
            srcCtx2.drawImage(tempCanvas, 0, 0);
            tempCtx.fillStyle = '#000000';
            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
            tempCtx.filter = `blur(${blurRadius}px)`;
            tempCtx.drawImage(srcCanvas2, 0, 0);
            tempCtx.filter = 'none';
        };
        
        
        const normX = cropData.offsetX * NORMALIZED_SIZE / originalImg.width;
        const normY = cropData.offsetY * NORMALIZED_SIZE / originalImg.height;
        const normW = cropData.width * NORMALIZED_SIZE / originalImg.width;
        const normH = cropData.height * NORMALIZED_SIZE / originalImg.height;

        let faceSkinMask = null;
        let faceColorSkinMask = null;
        let rawFaceSkinDataForColor = null;
        let eyesMaskArray = null;
        let lipsMaskArray = null;
        if (faceLandmarks468 && faceLandmarks468.length > 0) {
            const imgW = originalImg.width;
            const imgH = originalImg.height;

            const facePartsCanvas = document.createElement('canvas');
            facePartsCanvas.width = cropData.width;
            facePartsCanvas.height = cropData.height;
            const facePartsCtx = facePartsCanvas.getContext('2d');
            facePartsCtx.fillStyle = '#000000';
            facePartsCtx.fillRect(0, 0, cropData.width, cropData.height);

            const getCenter = (points) => {
                let sumX = 0, sumY = 0;
                points.forEach(idx => {
                    sumX += faceLandmarks468[idx].x - cropData.offsetX;
                    sumY += faceLandmarks468[idx].y - cropData.offsetY;
                });
                return { x: sumX / points.length, y: sumY / points.length };
            };

            const expandAndDraw = (points, scaleFactor) => {
                const center = getCenter(points);
                facePartsCtx.fillStyle = '#FFFFFF';
                facePartsCtx.beginPath();
                for (let i = 0; i < points.length; i++) {
                    const idx = points[i];
                    const x = faceLandmarks468[idx].x - cropData.offsetX;
                    const y = faceLandmarks468[idx].y - cropData.offsetY;
                    const dx = x - center.x;
                    const dy = y - center.y;
                    const fx = center.x + dx * scaleFactor;
                    const fy = center.y + dy * scaleFactor;
                    if (i === 0) facePartsCtx.moveTo(fx, fy);
                    else facePartsCtx.lineTo(fx, fy);
                }
                facePartsCtx.closePath();
                facePartsCtx.fill();
            };

            expandAndDraw([33, 246, 161, 160, 159, 158, 469, 154, 153, 145, 144, 163, 7], 2.0);
            expandAndDraw([476, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381], 2.0);
            expandAndDraw([0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 62, 185, 40, 39, 37], 1.2);
            expandAndDraw([209, 129, 64, 98, 97, 2, 326, 327, 294, 331, 429, 438, 457, 274, 19, 44, 237, 218], 1.2);
            expandAndDraw([70, 63, 105, 66, 107, 55, 221, 222, 223, 224, 46], 1.3);
            expandAndDraw([285, 336, 296, 334, 293, 300, 276, 444, 443, 442], 1.3);

            const facePartsData = facePartsCtx.getImageData(0, 0, cropData.width, cropData.height).data;

            
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = maskWidth;
            smallCanvas.height = maskHeight;
            const smallCtx = smallCanvas.getContext('2d');
            
            smallCtx.fillStyle = '#000000';
            smallCtx.fillRect(0, 0, maskWidth, maskHeight);

            
            const rawFaceCanvas = document.createElement('canvas');
            rawFaceCanvas.width = maskWidth;
            rawFaceCanvas.height = maskHeight;
            const rawFaceCtx = rawFaceCanvas.getContext('2d');
            rawFaceCtx.fillStyle = '#000000';
            rawFaceCtx.fillRect(0, 0, maskWidth, maskHeight);

            
            const tempFaceCanvas = document.createElement('canvas');
            tempFaceCanvas.width = maskWidth;
            tempFaceCanvas.height = maskHeight;
            const tempFaceCtx = tempFaceCanvas.getContext('2d');
            tempFaceCtx.fillStyle = '#000000';
            tempFaceCtx.fillRect(0, 0, maskWidth, maskHeight);
            
            for (let y = 0; y < maskHeight; y++) {
                for (let x = 0; x < maskWidth; x++) {
                    const idx = y * maskWidth + x;
                    const category = maskData[idx];
                    if (category === 3) {
                        tempFaceCtx.fillStyle = '#FFFFFF';
                        tempFaceCtx.fillRect(x, y, 1, 1);
                    }
                }
            }
            
            
            if (faceErodeRadius > 0) {
                const erodeRadiusInMask = Math.max(1, Math.round(faceErodeRadius * maskWidth / NORMALIZED_SIZE));
                const imageData = tempFaceCtx.getImageData(0, 0, maskWidth, maskHeight);
                const data = imageData.data;
                const originalData = new Uint8ClampedArray(data);
                
                for (let y = 0; y < maskHeight; y++) {
                    for (let x = 0; x < maskWidth; x++) {
                        const idx = (y * maskWidth + x) * 4;
                        if (originalData[idx] > 0) {
                            let shouldErode = false;
                            for (let dy = -erodeRadiusInMask; dy <= erodeRadiusInMask && !shouldErode; dy++) {
                                for (let dx = -erodeRadiusInMask; dx <= erodeRadiusInMask && !shouldErode; dx++) {
                                    const nx = x + dx;
                                    const ny = y + dy;
                                    if (nx >= 0 && nx < maskWidth && ny >= 0 && ny < maskHeight) {
                                        const nIdx = (ny * maskWidth + nx) * 4;
                                        if (originalData[nIdx] === 0) {
                                            shouldErode = true;
                                        }
                                    }
                                }
                            }
                            if (shouldErode) {
                                data[idx] = 0;
                                data[idx+1] = 0;
                                data[idx+2] = 0;
                            }
                        }
                    }
                }
                tempFaceCtx.putImageData(imageData, 0, 0);
            }
            
            
            const erodedFaceData = tempFaceCtx.getImageData(0, 0, maskWidth, maskHeight).data;

            for (let y = 0; y < maskHeight; y++) {
                for (let x = 0; x < maskWidth; x++) {
                    const idx = y * maskWidth + x;
                    const erodedValue = erodedFaceData[idx * 4];

                    if (erodedValue > 0) {
                        const origX = Math.round(x / scale);
                        const origY = Math.round(y / scale);

                        if (origX >= 0 && origX < cropData.width && origY >= 0 && origY < cropData.height) {
                            const partsIdx = (origY * cropData.width + origX) * 4;
                            const isFacePart = facePartsData[partsIdx] === 255;

                            
                            rawFaceCtx.fillStyle = '#FFFFFF';
                            rawFaceCtx.fillRect(x, y, 1, 1);

                            
                            if (!isFacePart) {
                                smallCtx.fillStyle = '#FFFFFF';
                                smallCtx.fillRect(x, y, 1, 1);
                            }
                        }
                    }
                }
            }

            
            const cropMaskCanvas = document.createElement('canvas');
            cropMaskCanvas.width = cropData.width;
            cropMaskCanvas.height = cropData.height;
            const cropMaskCtx = cropMaskCanvas.getContext('2d');
            cropMaskCtx.fillStyle = '#000000';
            cropMaskCtx.fillRect(0, 0, cropData.width, cropData.height);
            cropMaskCtx.drawImage(smallCanvas, 0, 0, cropData.width, cropData.height);

            
            tempCtx.fillStyle = '#000000';
            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
            tempCtx.drawImage(cropMaskCanvas, normX, normY, normW, normH);

            blurCanvas2(faceBlur);

            const blurredData = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data;
            const maskArray = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
            for (let i = 0; i < maskArray.length; i++) {
                maskArray[i] = blurredData[i * 4];
            }

            faceSkinMask = maskToBase64(maskArray, NORMALIZED_SIZE, NORMALIZED_SIZE);

            
            const rawCropMaskCanvas = document.createElement('canvas');
            rawCropMaskCanvas.width = cropData.width;
            rawCropMaskCanvas.height = cropData.height;
            const rawCropMaskCtx = rawCropMaskCanvas.getContext('2d');
            rawCropMaskCtx.fillStyle = '#000000';
            rawCropMaskCtx.fillRect(0, 0, cropData.width, cropData.height);
            rawCropMaskCtx.drawImage(rawFaceCanvas, 0, 0, cropData.width, cropData.height);

            tempCtx.fillStyle = '#000000';
            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
            tempCtx.drawImage(rawCropMaskCanvas, normX, normY, normW, normH);
            blurCanvas2(faceBlur);

            const rawBlurredData = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data;
            rawFaceSkinDataForColor = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
            for (let i = 0; i < rawFaceSkinDataForColor.length; i++) {
                rawFaceSkinDataForColor[i] = rawBlurredData[i * 4];
            }
        }

        
        
        let eyesMask = null;
        if (faceLandmarks468 && faceLandmarks468.length > 0) {
            const eyesCanvas = document.createElement('canvas');
            eyesCanvas.width = cropData.width;
            eyesCanvas.height = cropData.height;
            const eyesCtx = eyesCanvas.getContext('2d');
            eyesCtx.fillStyle = '#000000';
            eyesCtx.fillRect(0, 0, cropData.width, cropData.height);

            const drawEyesShape = (points) => {
                eyesCtx.fillStyle = '#FFFFFF';
                eyesCtx.beginPath();
                for (let i = 0; i < points.length; i++) {
                    const idx = points[i];
                    const x = faceLandmarks468[idx].x - cropData.offsetX;
                    const y = faceLandmarks468[idx].y - cropData.offsetY;
                    if (i === 0) eyesCtx.moveTo(x, y);
                    else eyesCtx.lineTo(x, y);
                }
                eyesCtx.closePath();
                eyesCtx.fill();
            };

            drawEyesShape([33, 246, 161, 160, 159, 158, 469, 154, 153, 145, 144, 163, 7]);
            drawEyesShape([476, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381]);

            tempCtx.fillStyle = '#000000';
            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
            
            tempCtx.drawImage(eyesCanvas, normX, normY, normW, normH);
            blurCanvas2(faceBlur);

            const eyesBlurredData = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data;
            eyesMaskArray = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
            for (let i = 0; i < eyesMaskArray.length; i++) {
                eyesMaskArray[i] = eyesBlurredData[i * 4];
            }

            eyesMask = maskToBase64(eyesMaskArray, NORMALIZED_SIZE, NORMALIZED_SIZE);
        }

        let lipsMask = null;
        if (faceLandmarks468 && faceLandmarks468.length > 0) {
            const lipsCanvas = document.createElement('canvas');
            lipsCanvas.width = cropData.width;
            lipsCanvas.height = cropData.height;
            const lipsCtx = lipsCanvas.getContext('2d');
            lipsCtx.fillStyle = '#000000';
            lipsCtx.fillRect(0, 0, cropData.width, cropData.height);

            const drawLipsShape = (points) => {
                lipsCtx.fillStyle = '#FFFFFF';
                lipsCtx.beginPath();
                for (let i = 0; i < points.length; i++) {
                    const idx = points[i];
                    const x = faceLandmarks468[idx].x - cropData.offsetX;
                    const y = faceLandmarks468[idx].y - cropData.offsetY;
                    if (i === 0) lipsCtx.moveTo(x, y);
                    else lipsCtx.lineTo(x, y);
                }
                lipsCtx.closePath();
                lipsCtx.fill();
            };

            drawLipsShape([61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 306, 292, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78, 62, 76]);
            drawLipsShape([291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61, 76, 62, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 292, 306]);

            tempCtx.fillStyle = '#000000';
            tempCtx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
            
            tempCtx.drawImage(lipsCanvas, normX, normY, normW, normH);
            blurCanvas2(faceBlur);

            const lipsBlurredData = tempCtx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data;
            lipsMaskArray = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
            for (let i = 0; i < lipsMaskArray.length; i++) {
                lipsMaskArray[i] = lipsBlurredData[i * 4];
            }

            lipsMask = maskToBase64(lipsMaskArray, NORMALIZED_SIZE, NORMALIZED_SIZE);
        }

        
        if (rawFaceSkinDataForColor && eyesMaskArray && lipsMaskArray) {
            const colorSkinArray = new Uint8Array(NORMALIZED_SIZE * NORMALIZED_SIZE);
            for (let i = 0; i < colorSkinArray.length; i++) {
                colorSkinArray[i] = Math.max(0, Math.min(255, rawFaceSkinDataForColor[i] - eyesMaskArray[i] - lipsMaskArray[i]));
            }
            faceColorSkinMask = maskToBase64(colorSkinArray, NORMALIZED_SIZE, NORMALIZED_SIZE);
        }

        
        const masks = {
            faceSkin: faceSkinMask,
            faceColorSkin: faceColorSkinMask,
            bodySkin: null,  
            hair: null,      
            clothes: null,   
            others: null,    
            eyes: eyesMask,
            lips: lipsMask
        };

        return masks;
    };

    
    const detectAll = async (imageFile) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const img = new Image();
                img.onload = async () => {
                    try {
                        const fullCanvas = document.createElement('canvas');
                        fullCanvas.width = img.width;
                        fullCanvas.height = img.height;
                        const fullCtx = fullCanvas.getContext('2d');
                        fullCtx.drawImage(img, 0, 0);
                        const faceDetectionResults = await window.FaceDetectionManager.detectFaces(fullCanvas);
                        const detections = (faceDetectionResults && faceDetectionResults.detections) ? faceDetectionResults.detections : [];
                        
                        fullCanvas.width = 0;
                        fullCanvas.height = 0;

                        
                        const faces = [];
                        for (let fi = 0; fi < detections.length; fi++) {
                            const box = detections[fi].boundingBox;
                            const faceWidthPx = box.width * img.width;
                            const cropData = cropFaceRegion(img, faceDetectionResults, fi);
                            if (!cropData) continue;
                            const cropResult = await detectCropRegion(cropData, img);
                            if (!cropResult) continue;
                            const cropMasks = await generateMasksFromCrop(cropResult, img, faceWidthPx);
                            faces.push({
                                index: fi,
                                bbox: { xCenter: box.xCenter, yCenter: box.yCenter, width: box.width, height: box.height },
                                landmarks468: cropResult.faceLandmarks468,
                                widthPx: faceWidthPx,
                                masks: cropMasks
                            });
                        }
                        ;
                        faces.forEach((f, i) => void 0);

                        
                        const finalFaceLandmarks = faces.length > 0 ? faces[0].landmarks468 : null;
                        const mainFaceWidthPx = faces.length > 0 ? faces[0].widthPx : 0;

                        let finalMasks = {
                            faceSkin: null,
                            faceColorSkin: null,
                            bodySkin: null,
                            hair: null,
                            clothes: null,
                            others: null,
                            eyes: null,
                            lips: null
                        };

                        
                        if (faces.length > 0 && faces[0].masks) {
                            finalMasks.faceSkin = faces[0].masks.faceSkin;
                            finalMasks.faceColorSkin = faces[0].masks.faceColorSkin;
                            finalMasks.eyes = faces[0].masks.eyes;
                            finalMasks.lips = faces[0].masks.lips;
                        }

                        
                        const landmarkResultsForPose = await detectLandmarks(imageFile);

                        
                        ;
                        
                        const neckAnchors = faces.map(f => f && f.bbox ? {
                            x: Math.min(0.999, Math.max(0.001, f.bbox.xCenter)),
                            y: Math.min(0.999, f.bbox.yCenter + f.bbox.height * 0.5 + f.bbox.height * 0.12)
                        } : null).filter(Boolean);
                        const maskResults = await detectMasks(imageFile, finalFaceLandmarks, mainFaceWidthPx, neckAnchors);

                        if (maskResults) {
                            finalMasks.bodySkin = maskResults.bodySkin;
                            finalMasks.hair = maskResults.hair;
                            finalMasks.clothes = maskResults.clothes;
                            finalMasks.others = maskResults.others;

                            if (!finalMasks.faceSkin && maskResults.faceSkin) finalMasks.faceSkin = maskResults.faceSkin;
                            if (!finalMasks.faceColorSkin && maskResults.faceColorSkin) finalMasks.faceColorSkin = maskResults.faceColorSkin;
                            if (!finalMasks.eyes && maskResults.eyes) finalMasks.eyes = maskResults.eyes;
                            if (!finalMasks.lips && maskResults.lips) finalMasks.lips = maskResults.lips;

                            
                            const perBodies = maskResults.perFaceBodySkins;
                            if (perBodies && Array.isArray(perBodies)) {
                                for (let i = 0; i < faces.length; i++) {
                                    if (faces[i] && faces[i].masks && perBodies[i]) {
                                        faces[i].masks.bodySkin = perBodies[i];
                                    }
                                }
                            }
                        }

                        resolve({
                            faceLandmarks468: finalFaceLandmarks,
                            poseLandmarks: landmarkResultsForPose.poseLandmarks,
                            masks: finalMasks,
                            faces: faces,
                            faceBboxes: faces.map(f => f.bbox)
                        });
                    } catch (error) {
                        reject(error);
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(imageFile);
        });
    };

    
    const close = () => {
        faceLandmarker?.close();
        poseLandmarker?.close();
        imageSegmenter?.close();
        isInitialized = false;
    };

    return {
        setModels: (face, pose, segment) => {
            models = { face, pose, segment };
        },
        initialize,
        processImage,
        detectLandmarks,
        detectMasks,
        detectIdphoto,
        detectAll,
        detectFaceDetection,
        cropFaceRegion,
        detectCropRegion,
        generateMasksFromCrop,
        close
    };
})();


window.MediaPipeManager = MediaPipeManager;


const FaceDetectionManager = (() => {
    let faceDetection = null;
    let isInitialized = false;
    let wasmUrl = null;

    
    function decodeBase64(base64String) {
        if (!base64String) return null;
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    
    const initialize = async () => {
        if (isInitialized) return true;

        try {
            
            if (window.WASM_BASE64 && window.WASM_BASE64.wasm) {
                const wasmBuffer = decodeBase64(window.WASM_BASE64.wasm);
                if (wasmBuffer) {
                    const blob = new Blob([wasmBuffer], { type: 'application/wasm' });
                    wasmUrl = URL.createObjectURL(blob);
                    ;
                }
            }

            faceDetection = new window.FaceDetection({
                locateFile: (file) => {
                    
                    if (file.includes('face_detection_solution_simd_wasm_bin.wasm')) {
                        if (wasmUrl) {
                            return wasmUrl;
                        }
                    }
                    
                    return `http://iceai.cc/iceaiapp/MD_iceai_0.1.2@xingxing/iceai_icecream_md@xingxing2026/full_face/${file}`;
                }
            });

            faceDetection.setOptions({
                model: 'full',
                minDetectionConfidence: 0.5
            });

            
            await faceDetection.initialize();
            isInitialized = true;
            ;
            
            
            await faceDetection.ready;
            ;
            
            return true;
        } catch (error) {
            console.error("Face Detection初始化失败:", error);
            return false;
        }
    };

    
    const detectFaces = async (image) => {
        if (!isInitialized) await initialize();

        try {
            ;
            
            
            return new Promise((resolve, reject) => {
                
                const onResults = (results) => {
                    ;
                    resolve(results);
                };
                
                
                faceDetection.onResults(onResults);
                
                
                faceDetection.send({ image: image }).catch(reject);
            });
        } catch (error) {
            console.error("Face Detection检测失败:", error);
            return null;
        }
    };

    return {
        initialize,
        detectFaces
    };
})();

window.FaceDetectionManager = FaceDetectionManager;