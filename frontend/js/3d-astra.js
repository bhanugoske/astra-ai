/**
 * Astra 3D Module - 3D Model Loading, Animation, and Visual Effects
 * Handles THREE.js 3D model rendering with animations and interactive features
 */

class Astra3D {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.mixer = null;
        this.clock = null;
        this.animationId = null;
        this.container = null;
        this.loader = null;
        this.lights = [];
        this.particles = null;
        this.isInitialized = false;
        this.isDestroyed = false;
        this.isAnimating = false;
        this.modelPath = '/models/astra.glb';
        this.backgroundImage = 'images/astra.png';
        
        // Animation states
        this.animationStates = {
            idle: null,
            speaking: null,
            listening: null,
            thinking: null,
            processing: null
        };
        
        this.currentState = 'idle';
        this.glowEffects = [];
        this.particleSystem = null;
        
        // Settings
        this.settings = {
            enableAnimations: true,
            enableParticles: true,
            enableGlow: true,
            autoRotate: false,
            modelScale: 1.6,
            cameraDistance: 3,
            animationSpeed: 1.0
        };
    }

    async init() {
        if (this.isInitialized || this.isDestroyed) {
            return;
        }

        try {
            this.container = document.querySelector('.astra-3d-container');
            if (!this.container) {
                console.error('3D container not found');
                return;
            }

            await this.initializeThreeJS();
            await this.setupLighting();
            await this.setupCamera();
            await this.setupRenderer();
            await this.setupControls();
            await this.loadModel();
            await this.createParticleSystem();
            await this.startAnimation();
            
            this.setupEventListeners();
            this.isInitialized = true;
            
            console.log('Astra3D initialized successfully');
        } catch (error) {
            console.error('Error initializing Astra3D:', error);
            this.handleInitializationError(error);
        }
    }

    async initializeThreeJS() {
        // Initialize scene
        this.scene = new THREE.Scene();
        this.scene.background = null; // Transparent background
        
        // Initialize clock for animations
        this.clock = new THREE.Clock();
        
        // Initialize loader
        this.loader = new THREE.GLTFLoader();
        
        // Set up background
        this.setupBackground();
    }

    setupBackground() {
        // Create background plane with the astra.png image
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            this.backgroundImage,
            (texture) => {
                const geometry = new THREE.PlaneGeometry(10, 10);
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 0.3
                });
                const backgroundPlane = new THREE.Mesh(geometry, material);
                backgroundPlane.position.z = -5;
                this.scene.add(backgroundPlane);
            },
            undefined,
            (error) => {
                console.warn('Could not load background image:', error);
            }
        );
    }

    async setupLighting() {
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        this.lights.push(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        this.lights.push(directionalLight);

        // Fill light from the opposite side
        const fillLight = new THREE.DirectionalLight(0x8bb7ff, 0.4);
        fillLight.position.set(-5, 0, -5);
        this.scene.add(fillLight);
        this.lights.push(fillLight);

        // Point light for highlights
        const pointLight = new THREE.PointLight(0x00aaff, 0.8, 10);
        pointLight.position.set(0, 2, 2);
        this.scene.add(pointLight);
        this.lights.push(pointLight);

        // Rim light for silhouette
        const rimLight = new THREE.DirectionalLight(0x0066cc, 0.6);
        rimLight.position.set(0, 0, -5);
        this.scene.add(rimLight);
        this.lights.push(rimLight);
    }

    async setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(0, 0.5, this.settings.cameraDistance);
        this.camera.lookAt(0, 0, 0);
    }

    async setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        // Clear existing content and add renderer
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);
    }

    async setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.enablePan = false;
        this.controls.enableZoom = true;
        this.controls.autoRotate = this.settings.autoRotate;
        this.controls.autoRotateSpeed = 0.5;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 8;
        this.controls.minPolarAngle = Math.PI / 4;
        this.controls.maxPolarAngle = Math.PI / 1.5;
    }

    async loadModel() {
        return new Promise((resolve, reject) => {
            this.showLoader();
            
            this.loader.load(
                this.modelPath,
                (gltf) => {
                    this.hideLoader();
                    this.onModelLoaded(gltf);
                    resolve(gltf);
                },
                (progress) => {
                    this.updateLoadingProgress(progress);
                },
                (error) => {
                    this.hideLoader();
                    console.error('Error loading 3D model:', error);
                    this.handleModelLoadError(error);
                    reject(error);
                }
            );
        });
    }

    onModelLoaded(gltf) {
        this.model = gltf.scene;
        
        // Scale and position the model
        this.model.scale.set(
            this.settings.modelScale,
            this.settings.modelScale,
            this.settings.modelScale
        );
        
        // Center the model
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        this.model.position.sub(center);
        
        // Set up materials
        this.setupModelMaterials();
        
        // Set up animations
        this.setupAnimations(gltf);
        
        // Add to scene
        this.scene.add(this.model);
        
        this.setStatus('Ready to listen');
        this.playAnimation('idle');
    }

    setupModelMaterials() {
        if (!this.model) return;
        
        this.model.traverse((child) => {
            if (child.isMesh) {
                // Enable shadows
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Enhance materials
                if (child.material) {
                    child.material.envMapIntensity = 1.0;
                    child.material.metalness = 0.1;
                    child.material.roughness = 0.8;
                    
                    // Add glow effect for certain materials
                    if (child.material.name && child.material.name.includes('glow')) {
                        this.addGlowEffect(child);
                    }
                }
            }
        });
    }

    setupAnimations(gltf) {
        if (!gltf.animations || gltf.animations.length === 0) {
            console.log('No animations found in model');
            return;
        }
        
        this.mixer = new THREE.AnimationMixer(this.model);
        
        // Store animation actions
        gltf.animations.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            
            // Map animation names to states
            const clipName = clip.name.toLowerCase();
            if (clipName.includes('idle')) {
                this.animationStates.idle = action;
            } else if (clipName.includes('speak') || clipName.includes('talk')) {
                this.animationStates.speaking = action;
            } else if (clipName.includes('listen')) {
                this.animationStates.listening = action;
            } else if (clipName.includes('think')) {
                this.animationStates.thinking = action;
            } else if (clipName.includes('process')) {
                this.animationStates.processing = action;
            }
        });
        
        console.log('Animations loaded:', Object.keys(this.animationStates));
    }

    async createParticleSystem() {
        if (!this.settings.enableParticles) return;
        
        const particleCount = 1000;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Position
            positions[i3] = (Math.random() - 0.5) * 10;
            positions[i3 + 1] = (Math.random() - 0.5) * 10;
            positions[i3 + 2] = (Math.random() - 0.5) * 10;
            
            // Color (blue tones)
            colors[i3] = 0.2 + Math.random() * 0.3;
            colors[i3 + 1] = 0.5 + Math.random() * 0.3;
            colors[i3 + 2] = 0.8 + Math.random() * 0.2;
            
            // Size
            sizes[i] = Math.random() * 2 + 0.5;
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        this.particleSystem = new THREE.Points(particles, particleMaterial);
        this.scene.add(this.particleSystem);
    }

    startAnimation() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        this.animate();
    }

    animate() {
        if (this.isDestroyed) return;
        
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        
        // Update controls
        if (this.controls) {
            this.controls.update();
        }
        
        // Update animations
        if (this.mixer) {
            this.mixer.update(delta * this.settings.animationSpeed);
        }
        
        // Update particle system
        if (this.particleSystem && this.settings.enableParticles) {
            this.particleSystem.rotation.y += 0.001;
            this.particleSystem.rotation.x += 0.0005;
        }
        
        // Update glow effects
        this.updateGlowEffects();
        
        // Render scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    // Animation Control Methods
    playAnimation(state) {
        if (!this.mixer || !this.animationStates[state]) {
            console.warn(`Animation state '${state}' not found`);
            return;
        }
        
        // Stop current animation
        if (this.animationStates[this.currentState]) {
            this.animationStates[this.currentState].fadeOut(0.3);
        }
        
        // Start new animation
        const action = this.animationStates[state];
        action.reset();
        action.fadeIn(0.3);
        action.play();
        
        this.currentState = state;
        
        console.log(`Playing animation: ${state}`);
    }

    setAnimationState(state) {
        if (this.currentState === state) return;
        
        this.playAnimation(state);
        
        // Add visual effects based on state
        switch (state) {
            case 'listening':
                this.startListeningEffects();
                break;
            case 'speaking':
                this.startSpeakingEffects();
                break;
            case 'thinking':
                this.startThinkingEffects();
                break;
            case 'processing':
                this.startProcessingEffects();
                break;
            default:
                this.stopAllEffects();
        }
    }

    // Visual Effects
    startListeningEffects() {
        if (!this.settings.enableGlow) return;
        
        // Add pulsing blue glow
        this.addPulseEffect(0x00aaff, 0.02);
        
        // Animate particles faster
        if (this.particleSystem) {
            this.particleSystem.material.opacity = 0.8;
        }
    }

    startSpeakingEffects() {
        if (!this.settings.enableGlow) return;
        
        // Add rhythmic glow
        this.addRhythmicGlow(0x00ff88, 0.1);
        
        // Animate model slightly
        this.addSpeakingBob();
    }

    startThinkingEffects() {
        if (!this.settings.enableGlow) return;
        
        // Add slow pulse
        this.addPulseEffect(0x8800ff, 0.005);
    }

    startProcessingEffects() {
        if (!this.settings.enableGlow) return;
        
        // Add spinning glow
        this.addSpinningGlow(0xff8800, 0.05);
    }

    stopAllEffects() {
        this.glowEffects.forEach(effect => {
            if (effect.remove) effect.remove();
        });
        this.glowEffects = [];
        
        if (this.particleSystem) {
            this.particleSystem.material.opacity = 0.6;
        }
    }

    addGlowEffect(mesh) {
        if (!this.settings.enableGlow) return;
        
        const glowGeometry = mesh.geometry.clone();
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.scale.multiplyScalar(1.1);
        mesh.add(glowMesh);
        
        this.glowEffects.push({
            mesh: glowMesh,
            remove: () => mesh.remove(glowMesh)
        });
    }

    addPulseEffect(color, speed) {
        const pulseEffect = {
            color: color,
            speed: speed,
            phase: 0,
            update: () => {
                pulseEffect.phase += pulseEffect.speed;
                const intensity = (Math.sin(pulseEffect.phase) + 1) / 2;
                
                this.lights.forEach(light => {
                    if (light.isPointLight) {
                        light.intensity = 0.5 + intensity * 0.5;
                    }
                });
            },
            remove: () => {
                // Reset light intensity
                this.lights.forEach(light => {
                    if (light.isPointLight) {
                        light.intensity = 0.8;
                    }
                });
            }
        };
        
        this.glowEffects.push(pulseEffect);
    }

    addRhythmicGlow(color, speed) {
        const rhythmEffect = {
            color: color,
            speed: speed,
            phase: 0,
            update: () => {
                rhythmEffect.phase += rhythmEffect.speed;
                const intensity = Math.abs(Math.sin(rhythmEffect.phase));
                
                if (this.model) {
                    this.model.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.emissive.setHex(rhythmEffect.color);
                            child.material.emissiveIntensity = intensity * 0.2;
                        }
                    });
                }
            },
            remove: () => {
                if (this.model) {
                    this.model.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.emissive.setHex(0x000000);
                            child.material.emissiveIntensity = 0;
                        }
                    });
                }
            }
        };
        
        this.glowEffects.push(rhythmEffect);
    }

    addSpeakingBob() {
        const bobEffect = {
            phase: 0,
            speed: 0.05,
            originalY: this.model ? this.model.position.y : 0,
            update: () => {
                bobEffect.phase += bobEffect.speed;
                if (this.model) {
                    this.model.position.y = bobEffect.originalY + Math.sin(bobEffect.phase) * 0.02;
                }
            },
            remove: () => {
                if (this.model) {
                    this.model.position.y = bobEffect.originalY;
                }
            }
        };
        
        this.glowEffects.push(bobEffect);
    }

    addSpinningGlow(color, speed) {
        const spinEffect = {
            color: color,
            speed: speed,
            phase: 0,
            update: () => {
                spinEffect.phase += spinEffect.speed;
                
                this.lights.forEach(light => {
                    if (light.isPointLight) {
                        light.position.x = Math.cos(spinEffect.phase) * 2;
                        light.position.z = Math.sin(spinEffect.phase) * 2;
                        light.color.setHex(spinEffect.color);
                    }
                });
            },
            remove: () => {
                this.lights.forEach(light => {
                    if (light.isPointLight) {
                        light.position.set(0, 2, 2);
                        light.color.setHex(0x00aaff);
                    }
                });
            }
        };
        
        this.glowEffects.push(spinEffect);
    }

    updateGlowEffects() {
        this.glowEffects.forEach(effect => {
            if (effect.update) {
                effect.update();
            }
        });
    }

    // UI Methods
    showLoader() {
        let loader = document.getElementById('astra-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'astra-loader';
            loader.className = 'loader';
            loader.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10;
            `;
            this.container.appendChild(loader);
        }
        loader.classList.remove('hidden');
    }

    hideLoader() {
        const loader = document.getElementById('astra-loader');
        if (loader) {
            loader.classList.add('hidden');
        }
    }

    updateLoadingProgress(progress) {
        // No status update here
    }

    setStatus(message) {
        const statusElement = document.querySelector('.astra-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    handleModelLoadError(error) {
        console.error('3D model loading failed:', error);
        this.createFallbackModel();
    }

    createFallbackModel() {
        // Create a simple geometric shape as fallback
        const geometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
        const material = new THREE.MeshPhongMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.8
        });
        
        this.model = new THREE.Mesh(geometry, material);
        this.model.castShadow = true;
        this.model.receiveShadow = true;
        this.scene.add(this.model);
        
        this.setStatus('Ready to listen');
    }

    handleInitializationError(error) {
        console.error('3D initialization failed:', error);
        this.setStatus('Error: Could not initialize 3D graphics');
        
        // Show error message in container
        this.container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8; text-align: center;">
                <div>
                    <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
                    <div>3D graphics not available</div>
                    <div style="font-size: 0.8rem; margin-top: 0.5rem;">Please check your browser compatibility</div>
                </div>
            </div>
        `;
    }

    // Event Handlers
    setupEventListeners() {
        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Voice state integration
        if (window.AstraVoice) {
            // Listen for voice state changes
            document.addEventListener('astraVoiceStateChanged', (event) => {
                this.handleVoiceStateChange(event.detail);
            });
        }

        // Mic button status logic
        const micBtn = document.querySelector('.astra-voice-btn');
        if (micBtn) {
            let listening = false;
            micBtn.addEventListener('click', () => {
                listening = !listening;
                if (listening) {
                    this.setStatus('Astra is listening...');
                } else {
                    this.setStatus('Ready to listen');
                }
            });
        }
    }

    handleResize() {
        if (!this.camera || !this.renderer || !this.container) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }

    handleVoiceStateChange(state) {
        switch (state) {
            case 'listening':
                this.setAnimationState('listening');
                break;
            case 'speaking':
                this.setAnimationState('speaking');
                break;
            case 'processing':
                this.setAnimationState('processing');
                break;
            default:
                this.setAnimationState('idle');
        }
    }

    // Public Methods
    destroy() {
        this.isDestroyed = true;
        this.isAnimating = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Stop all effects
        this.stopAllEffects();
        
        // Clean up Three.js objects
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }
        
        if (this.scene) {
            this.scene.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.scene.clear();
            this.scene = null;
        }
        
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
        
        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        this.isInitialized = false;
        
        console.log('Astra3D destroyed');
    }

    // Settings
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
        
        // Apply settings
        if (this.controls) {
            this.controls.autoRotate = this.settings.autoRotate;
        }
        
        if (this.model) {
            this.model.scale.set(
                this.settings.modelScale,
                this.settings.modelScale,
                this.settings.modelScale
            );
        }
        
        if (this.particleSystem) {
            this.particleSystem.visible = this.settings.enableParticles;
        }
    }

    // Getters
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isAnimating: this.isAnimating,
            currentState: this.currentState,
            modelLoaded: !!this.model,
            hasAnimations: !!this.mixer
        };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for workspace to be available
    setTimeout(() => {
        if (document.querySelector('.astra-3d-container')) {
            window.Astra3D = new Astra3D();
        }
    }, 100);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Astra3D;
} 