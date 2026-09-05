import * as THREE from "three";

const PARTICLE_COUNT = 36000;

const Phase = {
    ToShape: 0,
    HoldShape: 1,
    ToCloud: 2,
    HoldCloud: 3
};

export default class ParticleMorph
{
    constructor(scene)
    {
        this.scene = scene;

        this.transitionDuration = 3.5;
        this.shapeHoldDuration = 1.5;
        this.cloudHoldDuration = 0.5;

        this.phase = Phase.ToShape;
        this.phaseTime = 0;

        this.currentMorphIndex = 0;

        this.createParticles();
    }

    createParticles()
    {
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const morphA = new Float32Array(PARTICLE_COUNT * 3);
        const morphB = new Float32Array(PARTICLE_COUNT * 3);
        const sizes = new Float32Array(PARTICLE_COUNT);
        const brightness = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++)
        {
            const index = i * 3;

            const cloudPoint = this.randomCloudPoint();
            const spherePoint = this.randomSpherePoint();
            const torusPoint = this.randomTorusPoint();

            positions[index] = cloudPoint.x;
            positions[index + 1] = cloudPoint.y;
            positions[index + 2] = cloudPoint.z;

            morphA[index] = spherePoint.x;
            morphA[index + 1] = spherePoint.y;
            morphA[index + 2] = spherePoint.z;

            morphB[index] = torusPoint.x;
            morphB[index + 1] = torusPoint.y;
            morphB[index + 2] = torusPoint.z

            sizes[i] = 0.65 + Math.random() * 1.85;
            brightness[i] = 0.55 + Math.random() * 0.65;
        }

        this.geometry = new THREE.BufferGeometry();

        this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute("morphA", new THREE.BufferAttribute(morphA, 3));
        this.geometry.setAttribute("morphB", new THREE.BufferAttribute(morphB, 3));
        this.geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                transitionK: {
                    value: 0
                },

                morphIndex: {
                    value: 0
                },

                pointSize: {
                    value: 22.0
                },

                cloudColor: {
                    value: new THREE.Color(0x406080)
                },

                shapeAColor: {
                    value: new THREE.Color(0x00d9ff)
                },

                shapeBColor: {
                    value: new THREE.Color(0xff508f)
                }
            },

            vertexShader: `
                uniform float transitionK;
                uniform float morphIndex;
                uniform float pointSize;

                uniform vec3 cloudColor;
                uniform vec3 shapeAColor;
                uniform vec3 shapeBColor;

                attribute vec3 morphA;
                attribute vec3 morphB;

                attribute float aSize;
                attribute float aBrightness;

                varying vec3 vColor;
                varying float vAlpha;

                void main()
                {
                    vec3 targetPosition;
                    vec3 targetColor;

                    if (morphIndex < 0.5)
                    {
                        targetPosition = morphA;
                        targetColor = shapeAColor;
                    }
                    else
                    {
                        targetPosition = morphB;
                        targetColor = shapeBColor;
                    }
                
                    vec3 morphedPosition = mix(position, targetPosition, transitionK);
                
                    vColor = mix(cloudColor, targetColor, transitionK);
                    vColor *= aBrightness;

                    vec4 viewPosition = modelViewMatrix * vec4(morphedPosition, 1.0);
                
                    gl_Position = projectionMatrix * viewPosition;
               
                    float distanceFromCamera = max(1.0, -viewPosition.z);
                
                    gl_PointSize = pointSize * aSize / distanceFromCamera;

                    // Prevent giant pixels when orbiting very close.
                    gl_PointSize = clamp(gl_PointSize, 1.0, 7.0);
                
                    // Subtle depth attenuation.
                    //
                    // Nearby particles are more visible,
                    // distant particles recede slightly.
                    vAlpha = clamp(1.35 - distanceFromCamera * 0.045, 0.25, 1.0);
                }
            `,

            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;

                void main()
                {
                    vec2 uv =
                        gl_PointCoord -
                        vec2(0.5);
                
                    float dist =
                        length(uv);
                
                
                    // Soft luminous core.
                    float core =
                        1.0 -
                        smoothstep(
                            0.0,
                            0.18,
                            dist
                        );
                
                
                    // Larger soft halo.
                    float halo =
                        1.0 -
                        smoothstep(
                            0.05,
                            0.5,
                            dist
                        );
                
                
                    float alpha =
                        halo *
                        vAlpha;
                
                
                    // Slightly hotter center.
                    vec3 finalColor =
                        vColor *
                        (1.0 + core * 0.75);
                
                
                    if (alpha < 0.01)
                        discard;
                
                
                    gl_FragColor =
                        vec4(
                            finalColor,
                            alpha
                        );
                }
            `,

            transparent: true,
            depthTest: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;

        this.scene.add(this.points);
    }

    randomCloudPoint()
    {
        const theta = Math.random() * Math.PI * 2;

        const z = Math.random() * 2 - 1;

        const radial = Math.sqrt(1 - z * z);

        // particles distributed over spherical shells at different radii.
        const random = Math.pow(Math.random(), 1.6);
        const radius = 1.5 + random * 2.5;

        return new THREE.Vector3(
            Math.cos(theta) * radial * radius,
            Math.sin(theta) * radial * radius,
            z * radius
        );
    }

    randomSpherePoint()
    {
        const theta = Math.random() * Math.PI * 2;

        const z = Math.random() * 2 - 1;

        const radial = Math.sqrt(1 - z * z);

        const radius = 2.5;

        return new THREE.Vector3(
            Math.cos(theta) * radial * radius,
            Math.sin(theta) * radial * radius,
            z * radius
        );
    }

    randomTorusPoint()
    {
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;

        const majorRadius = 2.4;
        const minorRadius = 0.8;

        const ring = majorRadius + minorRadius * Math.cos(v);

        return new THREE.Vector3(
            ring * Math.cos(u),
            minorRadius * Math.sin(v),
            ring * Math.sin(u)
        );
    }

    update(deltaTime)
    {
        this.phaseTime += deltaTime;

        switch (this.phase)
        {
            case Phase.ToShape:
                this.updateToShape();
                break;

            case Phase.HoldShape:
                this.updateHoldShape();
                break;

            case Phase.ToCloud:
                this.updateToCloud();
                break;

            case Phase.HoldCloud:
                this.updateHoldCloud();
                break;
        }

        // Very slow presentation rotation.
        this.points.rotation.y += deltaTime * 0.08;
        //this.points.rotation.x += deltaTime * 0.015;
    }

    updateToShape()
    {
        const t = Math.min(this.phaseTime / this.transitionDuration, 1);

        this.material.uniforms.transitionK.value = this.easeInOutQuartic(t);

        if (t >= 1)
        {
            this.phase = Phase.HoldShape;
            this.phaseTime = 0;
        }
    }

    updateHoldShape()
    {
        if (this.phaseTime < this.shapeHoldDuration)
            return;

        this.phase = Phase.ToCloud;
        this.phaseTime = 0;
    }

    updateToCloud()
    {
        const t = Math.min(this.phaseTime / this.transitionDuration, 1);

        this.material.uniforms.transitionK.value = 1 - this.easeInOutQuartic(t);

        if (t >= 1)
        {
            this.phase = Phase.HoldCloud;
            this.phaseTime = 0;
        }
    }

    updateHoldCloud()
    {
        if (this.phaseTime < this.cloudHoldDuration)
            return;

        this.currentMorphIndex = this.currentMorphIndex === 0 ? 1 : 0;

        this.material.uniforms.morphIndex.value = this.currentMorphIndex;

        this.phase = Phase.ToShape;
        this.phaseTime = 0;
    }

    easeInOutQuartic(t)
    {
        if (t < 0.5)
            return 8 * t * t * t * t;

        const f = -2 * t + 2;

        return 1 - (f * f * f * f) / 2;
    }

    // --------------------------------------------------
    // Getter
    // --------------------------------------------------

    get particleCount()
    {
        return PARTICLE_COUNT;
    }

    get transition()
    {
        return this.material.uniforms.transitionK.value;
    }

    get currentShapeName()
    {
        return this.currentMorphIndex === 0
            ? "Sphere"
            : "Torus";
    }

    get phaseName()
    {
        switch (this.phase)
        {
            case Phase.ToShape:
                return "To Shape";

            case Phase.HoldShape:
                return "Hold Shape";

            case Phase.ToCloud:
                return "To Cloud";

            case Phase.HoldCloud:
                return "Hold Cloud";

            default:
                return "Unknown";
        }
    }
}