/**
 * ASTRA AI DASHBOARD - 3D VISUALIZATION SYSTEM
 * Advanced 3D model loader and scene management for Astra workspace
 */

const Astra3D = {
    // State management
    isInitialized: false,
    isLoading: false,
    destroyed: false,
    
    // Core Three.js objects
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    mixer: null,
    model: null,
    clock: null,
    animationId: null,
    animationFrame: null, // For 2D fallback animation
    
    // Configuration
    config: {
        modelPath: '/models/astra.glb',
        fallbackModelPath: '/models/astra.glb',
        backgroundImage: '/images/astra.png',
        cameraPosition: { x: 0, y: 1.5, z: 4 },
        backgroundColor: 0x0f172a,
        enableShadows: true,
        enablePostProcessing: false,
        autoRotate: true,
        rotationSpeed: 0.005
    },

    // Initialize 3D scene
    init(containerId = 'astra-3d-canvas') {
        try {
            console.log('🎮 Initializing Astra 3D System...');
            console.log('📂 Model path:', this.config.modelPath);
            console.log('🖼️ Background path:', this.config.backgroundImage);
            
            // Reset destroyed flag
            this.destroyed = false;
            
            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`Container element with ID "${containerId}" not found`);
                return;
            }

            console.log('✅ Container found:', container);
            
            // Only cleanup if already initialized
            if (this.isInitialized) {
                console.log('🧹 Cleaning up existing Astra3D instance...');
                this.cleanup(container);
            } else {
                // Just clear the container for fresh start
                container.innerHTML = '';
            }
            
            this.isLoading = true;
            this.showLoader();

            // Check THREE.js availability
            if (!window.THREE) {
                console.error('❌ THREE.js not available at initialization');
                this.hideLoader();
                this.createFallbackVisualization();
                return;
            }
            
            console.log('✅ THREE.js available, version:', THREE.REVISION);

            // Initialize Three.js components
            this.initScene();
            this.initCamera(container);
            this.initRenderer(container);
            this.initLights();
            this.initControls();
            
            // Load background image
            this.loadBackgroundImage();
            
            // Load the 3D model immediately
            this.loadModel();

            // Start animation loop
            this.animate();

            // Handle window resize
            this.handleResize();

            this.isInitialized = true;
            console.log('✅ Astra3D initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing Astra3D:', error);
            this.hideLoader();
            this.showError('Failed to initialize 3D visualization');
        }
    },

    // Initialize scene
    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.backgroundColor);
        this.scene.fog = new THREE.Fog(this.config.backgroundColor, 5, 20);
        
        this.clock = new THREE.Clock();
        
        // Add ambient particle system
        this.createAmbientParticles();
    },

    // Initialize camera
    initCamera(container) {
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.camera.position.set(
            this.config.cameraPosition.x,
            this.config.cameraPosition.y,
            this.config.cameraPosition.z
        );
        this.camera.lookAt(0, 0, 0);
    },

    // Initialize renderer
    initRenderer(container) {
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: container, 
            antialias: true, 
            alpha: true 
        });
        
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(this.config.backgroundColor, 1.0);
        
        if (this.config.enableShadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        
        // Enable gamma correction
        this.renderer.gammaFactor = 2.2;
        this.renderer.gammaOutput = true;
    },

    // Initialize lights
    initLights() {
        // Hemisphere light for general illumination
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemisphereLight.position.set(0, 20, 0);
        this.scene.add(hemisphereLight);

        // Directional light for shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = this.config.enableShadows;
        
        if (this.config.enableShadows) {
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 500;
            directionalLight.shadow.camera.left = -10;
            directionalLight.shadow.camera.right = 10;
            directionalLight.shadow.camera.top = 10;
            directionalLight.shadow.camera.bottom = -10;
        }
        
        this.scene.add(directionalLight);

        // Key light (blue)
        const keyLight = new THREE.PointLight(0x3b82f6, 1.0, 50);
        keyLight.position.set(8, 8, 8);
        this.scene.add(keyLight);

        // Fill light (purple)
        const fillLight = new THREE.PointLight(0x8b5cf6, 0.8, 30);
        fillLight.position.set(-8, 4, -8);
        this.scene.add(fillLight);

        // Rim light (cyan)
        const rimLight = new THREE.PointLight(0x06b6d4, 0.6, 40);
        rimLight.position.set(0, 8, -10);
        this.scene.add(rimLight);
    },

    // Initialize controls
    initControls() {
        this.autoRotate = this.config.autoRotate;
        this.rotationSpeed = this.config.rotationSpeed;
    },

    // Create ambient particles
    createAmbientParticles() {
        const particleCount = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Position
            positions[i3] = (Math.random() - 0.5) * 20;
            positions[i3 + 1] = (Math.random() - 0.5) * 20;
            positions[i3 + 2] = (Math.random() - 0.5) * 20;
            
            // Color (blue to purple gradient)
            const hue = 0.6 + Math.random() * 0.2; // Blue to purple
            const saturation = 0.8;
            const lightness = 0.5 + Math.random() * 0.3;
            
            const color = new THREE.Color().setHSL(hue, saturation, lightness);
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    },

    // Create fallback visualization
    createFallbackVisualization() {
        console.log('🎨 Creating fallback 2D visualization...');
        
        try {
            this.hideLoader();
            this.isLoading = false;
            
            const container = document.getElementById('astra-3d-canvas');
            if (!container) {
                console.error('❌ Container not found for fallback');
                return;
            }

            // Clear any existing content
            this.cleanup(container);

            // Create canvas for 2D fallback
            const canvas = document.createElement('canvas');
            canvas.width = container.offsetWidth || 800;
            canvas.height = container.offsetHeight || 600;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            
            // Animation state
            let animationFrame;
            let time = 0;
            
            const animate = () => {
                // Check if destroyed
                if (this.destroyed) {
                    console.log('🛑 2D fallback animation stopped - destroyed');
                    return;
                }
                
                time += 0.05;
                
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw background gradient
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, '#0f172a');
                gradient.addColorStop(1, '#1e293b');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw animated robot
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const scale = Math.min(canvas.width, canvas.height) / 400;
                
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.scale(scale, scale);
                
                // Robot body animation
                const bobOffset = Math.sin(time * 2) * 5;
                const glowIntensity = (Math.sin(time * 3) + 1) * 0.5;
                
                ctx.translate(0, bobOffset);
                
                // Draw robot with glow effect
                this.drawAnimatedRobot(ctx, glowIntensity, time);
                
                ctx.restore();
                
                // Draw status text
                ctx.fillStyle = '#06b6d4';
                ctx.font = `${20 * scale}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText('ASTRA CORE ACTIVE', centerX, centerY + 180 * scale);
                
                // Draw model loading status
                ctx.fillStyle = '#64748b';
                ctx.font = `${14 * scale}px Arial`;
                ctx.fillText('3D Model: Fallback Mode', centerX, centerY + 220 * scale);
                
                // Continue animation if not destroyed
                if (!this.destroyed) {
                    this.animationFrame = requestAnimationFrame(animate);
                }
            };
            
            animate();
            
            // Store animation frame for cleanup
            this.animationFrame = animationFrame;
            
            console.log('✅ Fallback visualization created successfully');
            
        } catch (error) {
            console.error('❌ Error creating fallback visualization:', error);
            this.showError('Failed to create visualization');
        }
    },

    // Load background image
    loadBackgroundImage() {
        console.log('🖼️ Starting background image load:', this.config.backgroundImage);
        
        const loader = new THREE.TextureLoader();
        loader.load(
            this.config.backgroundImage,
            (texture) => {
                console.log('✅ Background image loaded successfully');
                console.log('📐 Background texture size:', texture.image.width, 'x', texture.image.height);
                
                // Check if scene still exists (might be destroyed during loading)
                if (!this.scene || this.destroyed) {
                    console.warn('⚠️ Scene no longer exists, skipping background');
                    return;
                }
                
                // Create background plane
                const geometry = new THREE.PlaneGeometry(20, 20);
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 0.3
                });
                
                const background = new THREE.Mesh(geometry, material);
                background.position.z = -5;
                background.name = 'background';
                
                this.scene.add(background);
                console.log('✅ Background plane added to scene');
            },
            (progress) => {
                console.log('📊 Background loading progress:', progress);
            },
            (error) => {
                console.warn('⚠️ Failed to load background image:', error);
                console.log('🔍 Attempted path:', this.config.backgroundImage);
            }
        );
    },

    // Load 3D model
    loadModel() {
        console.log('🎯 Starting 3D model load process...');
        if (!window.THREE) {
            console.error('❌ THREE.js not available');
            this.createFallbackVisualization();
            return;
        }
        let attempts = 0;
        const maxAttempts = 5;
        const tryLoad = () => {
            if (window.THREE.GLTFLoader) {
                const loader = new window.THREE.GLTFLoader();
                loader.load(
                    this.config.modelPath,
                    (gltf) => {
                        this.onModelLoaded(gltf);
                    },
                    undefined,
                    (error) => {
                        attempts++;
                        if (attempts < maxAttempts) {
                            setTimeout(tryLoad, 1000);
                        } else {
                            this.createFallbackVisualization();
                        }
                    }
                );
            } else {
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(tryLoad, 1000);
                } else {
                    this.createFallbackVisualization();
                }
            }
        };
        tryLoad();
    },

    // Load model with provided loader
    loadModelWithLoader(loader) {
        console.log('🔄 Loading 3D model from:', this.config.modelPath);
        console.log('🔄 Fallback path:', this.config.fallbackModelPath);
        this.updateSubtitle('Loading Astra 3D Model...');
        
        // Try primary model path first
        loader.load(
            this.config.modelPath,
            (gltf) => {
                console.log('✅ Model loaded successfully!');
                this.onModelLoaded(gltf);
            },
            (progress) => {
                console.log('📊 Model loading progress:', progress);
                if (progress.lengthComputable) {
                    const percentComplete = (progress.loaded / progress.total) * 100;
                    console.log(`📊 Loading progress: ${Math.round(percentComplete)}%`);
                    this.updateSubtitle(`Loading: ${Math.round(percentComplete)}%`);
                }
            },
            (error) => {
                console.warn('⚠️ Primary model path failed:', error);
                console.log('🔍 Attempted path:', this.config.modelPath);
                this.updateSubtitle('Trying alternative path...');
                
                // Try fallback path
                loader.load(
                    this.config.fallbackModelPath,
                    (gltf) => {
                        console.log('✅ Fallback model loaded successfully!');
                        this.onModelLoaded(gltf);
                    },
                    (progress) => {
                        console.log('📊 Fallback loading progress:', progress);
                        if (progress.lengthComputable) {
                            const percentComplete = (progress.loaded / progress.total) * 100;
                            this.updateSubtitle(`Loading: ${Math.round(percentComplete)}%`);
                        }
                    },
                    (error) => {
                        console.error('❌ Both model paths failed:', error);
                        console.log('🔍 Primary path attempted:', this.config.modelPath);
                        console.log('🔍 Fallback path attempted:', this.config.fallbackModelPath);
                        this.createFallbackVisualization();
                    }
                );
            }
        );
    },

    // Handle successful model loading
    onModelLoaded(gltf) {
        try {
            console.log('🎯 Processing loaded 3D model...');
            
            // Check if scene still exists (might be destroyed during loading)
            if (!this.scene || this.destroyed) {
                console.warn('⚠️ Scene no longer exists, skipping model');
                return;
            }
            
            this.model = gltf.scene;
            
            // Center and scale the model
            const box = new THREE.Box3().setFromObject(this.model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            console.log('📐 Model dimensions:', size);
            
            // Center the model
            this.model.position.sub(center);
            
            // Scale to appropriate size (adjust as needed)
            const maxDimension = Math.max(size.x, size.y, size.z);
            const scale = 3 / maxDimension; // Increased scale for better visibility
            this.model.scale.setScalar(scale);
            
            // Position the model
            this.model.position.y = -1;
            
            // Enable shadows and enhance materials
            if (this.config.enableShadows) {
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Enhance materials for better appearance
                        if (child.material) {
                            if (child.material.isMeshStandardMaterial) {
                                child.material.metalness = 0.3;
                                child.material.roughness = 0.4;
                            }
                        }
                    }
                });
            }
            
            // Setup animations if available
            if (gltf.animations && gltf.animations.length > 0) {
                console.log(`🎬 Found ${gltf.animations.length} animations`);
                this.mixer = new THREE.AnimationMixer(this.model);
                
                gltf.animations.forEach((clip, index) => {
                    console.log(`🎭 Starting animation ${index + 1}: ${clip.name}`);
                    const action = this.mixer.clipAction(clip);
                    action.play();
                });
            }
            
            this.scene.add(this.model);
            this.hideLoader();
            this.isLoading = false;
            
            console.log('🎉 3D Model integrated successfully!');
            
        } catch (error) {
            console.error('❌ Error processing loaded model:', error);
            this.createFallbackVisualization();
        }
    },

    // Animation loop
    animate() {
        // Safety check - stop animation if components are not initialized
        if (!this.renderer || !this.scene || !this.camera) {
            console.warn('⚠️ Animation stopped - missing components:', {
                renderer: !!this.renderer,
                scene: !!this.scene,
                camera: !!this.camera
            });
            return;
        }

        // Stop animation if explicitly destroyed
        if (this.destroyed) {
            console.log('🛑 Animation stopped - Astra3D destroyed');
            return;
        }

        try {
            // Update animation mixer if available
            if (this.mixer) {
                this.mixer.update(0.016); // ~60fps
            }

            // Update controls if available
            if (this.controls) {
                this.controls.update();
            }

            // Auto-rotate model if enabled
            if (this.config.autoRotate && this.model) {
                this.model.rotation.y += this.config.rotationSpeed;
            }

            // Render the scene
            this.renderer.render(this.scene, this.camera);

            // Continue animation loop
            this.animationId = requestAnimationFrame(() => this.animate());
            
        } catch (error) {
            console.error('❌ Animation error:', error);
            console.log('🛑 Stopping animation due to error');
            this.stopAnimation();
        }
    },

    // Stop animation loop
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            console.log('🛑 3D Animation loop stopped');
        }
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
            console.log('🛑 2D Fallback animation stopped');
        }
    },

    // Handle window resize
    handleResize() {
        const resizeHandler = () => {
            const container = document.getElementById('astra-3d-canvas');
            if (!container || !this.camera || !this.renderer) return;
            
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        };
        
        window.addEventListener('resize', resizeHandler);
        
        // Initial call
        setTimeout(resizeHandler, 100);
    },

    // Show loading indicator
    showLoader() {
        const container = document.getElementById('astra-3d-canvas');
        if (!container) return;
        
        const loader = document.createElement('div');
        loader.id = 'astra-3d-loader';
        loader.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">Initializing Astra 3D...</div>
                <div class="loading-subtitle">Loading your 3D model...</div>
            </div>
        `;
        loader.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(10px);
        `;
        
        container.appendChild(loader);
        
        // Add loading styles
        const style = document.createElement('style');
        style.textContent = `
            .loading-container {
                text-align: center;
                color: #06b6d4;
            }
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(6, 182, 212, 0.3);
                border-top: 3px solid #06b6d4;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 16px;
            }
            .loading-text {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 8px;
            }
            .loading-subtitle {
                font-size: 14px;
                opacity: 0.8;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    },

    // Hide loading indicator
    hideLoader() {
        const loader = document.getElementById('astra-3d-loader');
        if (loader) {
            loader.remove();
        }
    },

    // Update loading subtitle
    updateSubtitle(text) {
        const subtitle = document.querySelector('.loading-subtitle');
        if (subtitle) {
            subtitle.textContent = text;
        }
    },

    // Show error message
    showError(message) {
        const container = document.getElementById('astra-3d-canvas');
        if (!container) return;
        
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #ef4444;
                font-size: 16px;
                padding: 20px;
                background: rgba(239, 68, 68, 0.1);
                border: 1px solid #ef4444;
                border-radius: 8px;
                backdrop-filter: blur(10px);
            ">
                <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                <div>${message}</div>
            </div>
        `;
        
        container.appendChild(errorDiv);
    },

    // Cleanup function
    cleanup(container) {
        console.log('🧹 Cleaning up Astra3D...');
        
        // Stop animation loop
        this.stopAnimation();
        
        // Mark as destroyed
        this.destroyed = true;
        
        // Clean up Three.js objects
        if (this.scene) {
            // Remove all objects from scene
            while (this.scene.children.length > 0) {
                const child = this.scene.children[0];
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
                this.scene.remove(child);
            }
        }
        
        // Clean up renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        
        // Clean up other objects
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.mixer = null;
        this.model = null;
        this.clock = null;
        
        // Clean up container
        if (container) {
            container.innerHTML = '';
        }
        
        // Reset flags
        this.isInitialized = false;
        this.isLoading = false;
        
        console.log('✅ Astra3D cleanup complete');
    },

    // Destroy Astra3D
    destroy() {
        console.log('🧹 Destroying Astra3D...');
        
        const container = document.getElementById('astra-3d-canvas');
        this.cleanup(container);
        
        // Mark as destroyed
        this.destroyed = true;
        
        console.log('🧹 Astra3D destroyed');
    },

    // Utility methods
    setAutoRotate(enabled) {
        this.autoRotate = enabled;
    },

    setRotationSpeed(speed) {
        this.rotationSpeed = speed;
    },

    resetCamera() {
        if (this.camera) {
            this.camera.position.set(
                this.config.cameraPosition.x,
                this.config.cameraPosition.y,
                this.config.cameraPosition.z
            );
            this.camera.lookAt(0, 0, 0);
        }
    },

    // Get performance stats
    getStats() {
        return {
            isInitialized: this.isInitialized,
            isLoading: this.isLoading,
            hasModel: !!this.model,
            hasAnimations: !!this.mixer,
            triangles: this.renderer ? this.renderer.info.render.triangles : 0,
            calls: this.renderer ? this.renderer.info.render.calls : 0
        };
    },

    // Draw animated robot for 2D fallback
    drawAnimatedRobot(ctx, glowIntensity, time) {
        // Robot head
        ctx.beginPath();
        ctx.arc(0, -80, 40, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        
        // Glowing eyes
        const eyeGlow = Math.floor(255 * glowIntensity);
        ctx.fillStyle = `rgb(0, ${eyeGlow}, 255)`;
        ctx.beginPath();
        ctx.arc(-15, -85, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(15, -85, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye glow effect
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10 * glowIntensity;
        ctx.beginPath();
        ctx.arc(-15, -85, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(15, -85, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Robot body (hexagonal)
        ctx.beginPath();
        ctx.fillStyle = '#3b82f6';
        const sides = 6;
        const radius = 50;
        for (let i = 0; i < sides; i++) {
            const angle = (i * Math.PI * 2) / sides;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius + 20;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        // Robot arms (animated)
        const armSwing = Math.sin(time * 2) * 0.2;
        
        ctx.save();
        ctx.translate(-60, 0);
        ctx.rotate(armSwing);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(-10, -5, 20, 60);
        ctx.restore();
        
        ctx.save();
        ctx.translate(60, 0);
        ctx.rotate(-armSwing);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(-10, -5, 20, 60);
        ctx.restore();
        
        // Robot legs
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(-25, 70, 15, 50);
        ctx.fillRect(10, 70, 15, 50);
        
        // Energy rings (animated)
        for (let i = 0; i < 3; i++) {
            const ringRadius = 80 + i * 20;
            const opacity = (Math.sin(time * 2 + i) + 1) * 0.3;
            
            ctx.strokeStyle = `rgba(0, 182, 212, ${opacity})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Floating particles
        for (let i = 0; i < 5; i++) {
            const particleX = Math.cos(time + i * 1.2) * 100;
            const particleY = Math.sin(time * 0.8 + i * 0.8) * 80;
            const particleSize = 3 + Math.sin(time * 3 + i) * 2;
            
            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // Add helper to update .astra-status
    updateAstraStatus(status) {
        const statusEl = document.querySelector('.astra-status');
        if (statusEl) statusEl.textContent = status;
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Astra3D module loaded');
});