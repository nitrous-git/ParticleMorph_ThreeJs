import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

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
    }

    async initialize()
    {
        const dragonTarget =  await this.loadModelTarget("./models/DragonAttenuation.glb", "Dragon");
        const knightTarget =  await this.loadModelTarget("./models/Knight.glb");
        const castleTarget =  await this.loadModelTarget("./models/hyrule_castle.glb");
        this.createParticles(knightTarget, dragonTarget, castleTarget);
    }

    createParticles(knightTarget, dragonTarget, castleTarget)
    {
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const morphA = knightTarget.positions;
        const morphB = dragonTarget.positions;
        const morphC = castleTarget.positions;
        const normalA = knightTarget.normals;
        const normalB = dragonTarget.normals;
        const normalC = castleTarget.normals;
        const sizes = new Float32Array(PARTICLE_COUNT);
        const brightness = new Float32Array(PARTICLE_COUNT);
        const random = new Float32Array(PARTICLE_COUNT);


        for (let i = 0; i < PARTICLE_COUNT; i++)
        {
            const index = i * 3;

            const cloudPoint = this.randomCloudPoint();
            const spherePoint = this.randomSpherePoint();
            const torusPoint = this.randomTorusPoint();

            positions[index] = cloudPoint.x;
            positions[index + 1] = cloudPoint.y;
            positions[index + 2] = cloudPoint.z;

            // morphA[index] = carTarget.x;
            // morphA[index + 1] = carTarget.y;
            // morphA[index + 2] = carTarget.z;

            // morphB[index] = torusPoint.x;
            // morphB[index + 1] = torusPoint.y;
            // morphB[index + 2] = torusPoint.z

            sizes[i] = 0.65 + Math.random() * 1.85;
            brightness[i] = 0.55 + Math.random() * 0.65;
            random[i] = Math.random();
        }

        this.geometry = new THREE.BufferGeometry();

        this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute("morphA", new THREE.BufferAttribute(morphA, 3));
        this.geometry.setAttribute("morphB", new THREE.BufferAttribute(morphB, 3));
        this.geometry.setAttribute("morphC", new THREE.BufferAttribute(morphC, 3));
        this.geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
        this.geometry.setAttribute("normalA", new THREE.BufferAttribute(normalA, 3));
        this.geometry.setAttribute("normalB", new THREE.BufferAttribute(normalB, 3));
        this.geometry.setAttribute("normalC", new THREE.BufferAttribute(normalC, 3));
        this.geometry.setAttribute("aRandom", new THREE.BufferAttribute(random, 1));


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
                },

                shapeCColor: {
                    value: new THREE.Color(0x50ff7a)
                },

                time: {
                    value: 0
                },

                turbulenceStrength: {
                    value: 0.8
                },

                swirlStrength: {
                    value: 1.2
                },
            },

            vertexShader: `
                uniform float transitionK;
                uniform float morphIndex;
                uniform float pointSize;
                
                uniform float time;
                
                uniform float turbulenceStrength;
                uniform float swirlStrength;

                uniform vec3 cloudColor;
                uniform vec3 shapeAColor;
                uniform vec3 shapeBColor;
                uniform vec3 shapeCColor;

                attribute vec3 morphA;
                attribute vec3 morphB;
                attribute vec3 morphC;
                
                attribute vec3 normalA;
                attribute vec3 normalB;
                attribute vec3 normalC;

                attribute float aSize;
                attribute float aBrightness;
                attribute float aRandom;

                varying vec3 vColor;
                varying float vAlpha;


                // --------------------------------------------------
                // Procedural vector field
                // --------------------------------------------------
                vec3 turbulenceField(vec3 p, float t)
                {
                    vec3 field;
                    field.x = sin(p.y * 2.1 + t * 1.2) + cos(p.z * 1.7 - t * 0.7);
                    field.y = sin(p.z * 2.3 + t * 0.9) + cos(p.x * 1.9 + t * 0.6);
                    field.z = sin(p.x * 2.0 - t * 1.0) + cos(p.y * 1.8 + t * 0.8);
                    return field * 0.5;
                }
                
                void main()
                {
                    vec3 targetPosition;
                    vec3 targetNormal;
                    vec3 targetColor;

                    // --------------------------------------------------
                    // Select morph target
                    // --------------------------------------------------
                    
                    if (morphIndex < 0.5)
                    {
                        targetPosition = morphA;
                        targetNormal = normalA;
                        targetColor = shapeAColor;
                    }
                    else if (morphIndex < 1.5)
                    {
                        targetPosition = morphB;
                        targetNormal = normalB;
                        targetColor = shapeBColor;
                    }
                    else
                    {
                        targetPosition = morphC;
                        targetNormal = normalC;
                        targetColor = shapeCColor;
                    }
                
                    // --------------------------------------------------
                    // Base morph
                    // --------------------------------------------------
                
                    vec3 morphedPosition = mix(position, targetPosition, transitionK);
                
                    // --------------------------------------------------
                    // Transition envelope
                    //
                    // 0 at cloud
                    // 1 halfway
                    // 0 at completed model
                    // --------------------------------------------------
                
                    float t = clamp(transitionK, 0.0, 1.0);
                    float transitionEnvelope =4.0 * t * (1.0 - t);
                    transitionEnvelope = pow(transitionEnvelope, 1.25);
      
                    // --------------------------------------------------
                    // Swirl around Y axis
                    // --------------------------------------------------
                
                    float radiusXZ = length(morphedPosition.xz);
                
                    vec3 swirlDirection = vec3(-morphedPosition.z, 0.0, morphedPosition.x);
                
                    if (length(swirlDirection) > 0.0001)
                    {
                        swirlDirection = normalize(swirlDirection);
                    }
                
                    float swirlWave = sin(radiusXZ * 2.2 + time * 1.6 + aRandom * 6.2831853);

                    morphedPosition += swirlDirection * swirlWave * swirlStrength * transitionEnvelope;
      
                    // --------------------------------------------------
                    // Turbulence
                    // --------------------------------------------------
                
                    vec3 turbulence = turbulenceField(morphedPosition + aRandom * 3.0, time);
                
                    morphedPosition += turbulence * turbulenceStrength * transitionEnvelope;
      
                    // --------------------------------------------------
                    // View-space position
                    // --------------------------------------------------
                
                    vec4 viewPosition = modelViewMatrix * vec4(morphedPosition, 1.0);
                    gl_Position = projectionMatrix * viewPosition;
      
                    // --------------------------------------------------
                    // Surface lighting
                    // --------------------------------------------------
      
                    vec3 viewNormal = normalize(normalMatrix * targetNormal);
                    
                    vec3 viewDirection = normalize(-viewPosition.xyz);
                    
                    vec3 lightDirection = normalize(vec3(-0.45, 0.75, 0.55));
                    
                    // Basic directional lighting.
                    float diffuse = 0.35 + 0.65 * max(dot(viewNormal, lightDirection), 0.0);
                    
                    // Fresnel/rim lighting.
                    float rim = pow(1.0 - abs(dot(viewNormal, viewDirection)), 2.2);
                    
                    // Small specular highlight.
                    vec3 halfDirection = normalize(lightDirection + viewDirection);
                    
                    float specular = pow(max(dot(viewNormal, halfDirection), 0.0), 28.0);
                    
                    float sculptureLighting = diffuse + rim * 0.65 + specular * 1.1;
      
                    // --------------------------------------------------
                    // Color
                    // --------------------------------------------------
      
                    vColor = mix(cloudColor, targetColor, transitionK);
                    vColor *= mix(1.0, sculptureLighting, transitionK);
                    vColor *= aBrightness;

                    // --------------------------------------------------
                    // Point size
                    // --------------------------------------------------
                    
                    float distanceFromCamera = max(1.0, -viewPosition.z);
                    gl_PointSize = pointSize * aSize / distanceFromCamera;

                    // Prevent giant pixels when orbiting very close.
                    gl_PointSize = clamp(gl_PointSize, 1.0, 7.0);
                
                    // --------------------------------------------------
                    // Depth alpha
                    // --------------------------------------------------
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
        this.material.uniforms.time.value += deltaTime;

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

        this.currentMorphIndex = (this.currentMorphIndex + 1) % 3;

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
        switch (
            this.currentMorphIndex
            )
        {
            case 0:
                return "Knight";

            case 1:
                return "Dragon";

            case 2:
                return "Castle";

            default:
                return "Unknown";
        }
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

    // --------------------------------------------------
    // Models
    // --------------------------------------------------

    normalizeModelPositions(positions)
    {
        const count = positions.length / 3;

        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;

        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;


        for (let i = 0; i < count; i++)
        {
            const index = i * 3;

            const x = positions[index];
            const y = positions[index + 1];
            const z = positions[index + 2];

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);

            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
        }


        const centerX = (minX + maxX) * 0.5;
        const centerY = (minY + maxY) * 0.5;
        const centerZ = (minZ + maxZ) * 0.5;

        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;

        const maxSize =
            Math.max(
                sizeX,
                sizeY,
                sizeZ
            );


        const targetSize = 5.0;

        const scale = targetSize / maxSize;

        for (let i = 0; i < count; i++)
        {
            const index =  i * 3;
            positions[index] = (positions[index] - centerX) * scale;
            positions[index + 1] = (positions[index + 1] - centerY) * scale;
            positions[index + 2] = (positions[index + 2] - centerZ) * scale;
        }

        return positions;
    }

    async loadModelTarget(
        url,
        meshName = null
    )
    {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);

        gltf.scene.updateMatrixWorld(true);

        const surfaces = [];

        gltf.scene.traverse(
            object =>
            {
                if (!object.isMesh)
                    return;


                const positionAttribute =
                    object.geometry.getAttribute(
                        "position"
                    );

                if (!positionAttribute)
                    return;


                if (
                    meshName !== null &&
                    object.name !== meshName
                )
                {
                    return;
                }


                console.log(
                    `Mesh: "${object.name}"`,
                    `Vertices: ${positionAttribute.count}`
                );


                // Create a position-only geometry.
                //
                // This avoids copying materials, UVs,
                // normals, etc. that we don't need.

                const geometry = new THREE.BufferGeometry();


                geometry.setAttribute("position", positionAttribute.clone());

                if (object.geometry.index)
                {
                    geometry.setIndex(object.geometry.index.clone());
                }

                const normalAttribute = object.geometry.getAttribute("normal");

                if (normalAttribute)
                {
                    geometry.setAttribute("normal", normalAttribute.clone());
                }
                else
                {
                    geometry.computeVertexNormals();
                }


                // Bake GLTF node transforms into
                // the geometry before sampling.

                geometry.applyMatrix4(object.matrixWorld);

                const surfaceMesh = new THREE.Mesh(geometry);

                const sampler =
                    new MeshSurfaceSampler(
                        surfaceMesh
                    ).build();


                const area =
                    this.computeSurfaceArea(
                        geometry
                    );


                surfaces.push({
                    sampler,
                    geometry,
                    area,
                    name: object.name
                });
            }
        );


        if (surfaces.length === 0)
        {
            throw new Error(
                meshName
                    ? `Mesh "${meshName}" not found in ${url}`
                    : `No mesh found in ${url}`
            );
        }


        let totalArea = 0;

        for (const surface of surfaces)
        {
            totalArea +=
                surface.area;
        }


        const cumulativeAreas = [];

        let cumulativeArea = 0;

        for (const surface of surfaces)
        {
            cumulativeArea +=
                surface.area;

            cumulativeAreas.push(
                cumulativeArea
            );
        }


        const targetPositions = new Float32Array(PARTICLE_COUNT * 3);
        const point = new THREE.Vector3();

        const targetNormals = new Float32Array(PARTICLE_COUNT * 3);
        const normal = new THREE.Vector3();

        for (let i = 0; i < PARTICLE_COUNT; i++
        )
        {
            const randomArea = Math.random() * totalArea;

            let surfaceIndex = 0;

            while (randomArea > cumulativeAreas[surfaceIndex])
            {
                surfaceIndex++;
            }


            surfaces[surfaceIndex].sampler.sample(point, normal);

            const index = i * 3;
            targetPositions[index] = point.x;
            targetPositions[index + 1] = point.y;
            targetPositions[index + 2] = point.z;

            normal.normalize();

            targetNormals[index] = normal.x;
            targetNormals[index + 1] = normal.y;
            targetNormals[index + 2] = normal.z;
        }


        // We've copied everything we need
        // into target now.

        for (const surface of surfaces)
        {
            surface.geometry.dispose();
        }

        return {
            positions: this.normalizeModelPositions(targetPositions),
            normals: targetNormals
        };
    }

    computeSurfaceArea(geometry)
    {
        const position =
            geometry.getAttribute(
                "position"
            );

        const index =
            geometry.index;


        const a =
            new THREE.Vector3();

        const b =
            new THREE.Vector3();

        const c =
            new THREE.Vector3();

        const triangle =
            new THREE.Triangle();


        const triangleCount =
            index
                ? index.count / 3
                : position.count / 3;


        let totalArea = 0;


        for (let i = 0; i < triangleCount; i++)
        {
            let ia;
            let ib;
            let ic;


            if (index)
            {
                ia =
                    index.getX(i * 3);

                ib =
                    index.getX(i * 3 + 1);

                ic =
                    index.getX(i * 3 + 2);
            }
            else
            {
                ia = i * 3;
                ib = i * 3 + 1;
                ic = i * 3 + 2;
            }


            a.fromBufferAttribute(
                position,
                ia
            );

            b.fromBufferAttribute(
                position,
                ib
            );

            c.fromBufferAttribute(position, ic);

            triangle.set(a, b, c);

            totalArea += triangle.getArea();
        }

        return totalArea;
    }
}