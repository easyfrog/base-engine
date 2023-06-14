// original implementation is from https://github.com/pmndrs/drei

// https://gist.github.com/0beqz/e69378b278e5c336afe0c7ae9b4ed86c

/**
 
    Usage:

    object.material = new MeshReflectorMaterial(renderer, camera, scene, object, options);
    For the options see MeshReflectorMaterial's constructor.

    You need to update the material to get updated reflections so call the update() function like this in the render loop:

    function render() {
        object.material.update();
        renderer.render(scene, camera);
    }

    // 在 game 中使用
    land.material = new MeshReflectorMaterial(game.renderer, game.camera, game.scene, land, {
        resolution: 64,     // 返射的分辨率
        mixStrength: 1,     // 此值可以控制反射强度
        mixContrast: 1,     // 此值也可以控制反射强度, 并可以控制对比度
    }, {
        map: land.material.map,
        color: land.material.color,
        isCircle: true,
        radius1: 20,
        radius2: 380,
        decay: 2,
        transparent: true,
        center: land.position,
    })

 */

// Fade Edge Replace
var vs_replace = /*glsl*/`
    varying vec3 worldPos;

    void main() {
        worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
`

var fs_replace = /*glsl*/`
    // 默认为矩形
    uniform vec3 topLeft;
    uniform vec3 bottomRight;
    uniform float fadeLength;

    // 是否为圆形
    uniform bool isCircle;
    uniform float radius1;
    uniform float radius2;

    // 衰减 pow 值
    uniform float decay;

    // TODO: 描光
    uniform float time;
    uniform float period;
    uniform float lightSpeed;
    uniform float lightWidth;
    uniform float strength;
    // 1: 下-上 2: 上-下 3: 左-右 4: 右-左 5: circle-out 6: circle-in
    uniform int direction;

	#ifdef USE_FADEMAP
	uniform sampler2D fadeMap;
	#endif

    varying vec3 worldPos;
    
    void main() {

        float _alpha = 1.0;

        #ifdef USE_FADEMAP
        float width = bottomRight.x - topLeft.x;
        float height = bottomRight.y - topLeft.y;

        float uv_x = (worldPos.x - topLeft.x) / width;
        float uv_y = (worldPos.y - topLeft.y) / height;

        _alpha = texture2D(fadeMap, vec2(uv_x, uv_y)).a;
        #endif

        #ifndef USE_FADEMAP
        float dis = length(worldPos);
        bool isOutRange = false;

        if (isCircle) {
            isOutRange = dis > radius2;
        } else {
            isOutRange = worldPos.x < topLeft.x ||
                        worldPos.x > bottomRight.x ||
                        worldPos.y > topLeft.y ||
                        worldPos.y < bottomRight.y;
        }

        if ( isOutRange ) {
            _alpha = 0.0;
        } else {
			
            if (isCircle) {
                if (dis < radius1) {
                    _alpha = 1.0;
                } else {
                    float len = radius2 - radius1;
                    _alpha = pow((len - dis + radius1) / len, decay);
                }
            } else {
                float cha_x1 = abs(worldPos.x - topLeft.x);
                float cha_x2 = abs(worldPos.x - bottomRight.x);
                float cha_x = min(cha_x1, cha_x2);
                float cha_y1 = abs(worldPos.y - topLeft.y);
                float cha_y2 = abs(worldPos.y - bottomRight.y);
                float cha_y = min(cha_y1, cha_y2);
                float cha = min(cha_x, cha_y);

                if (cha < fadeLength) {
                    _alpha = pow(cha / fadeLength, decay);
                    // _alpha = cha / fadeLength;
                } else {
                    _alpha = 1.0;
                }
            }
        }
        #endif
`

import {
    DepthFormat, DepthTexture, LinearFilter, Matrix4, MeshStandardMaterial,
    PerspectiveCamera, Plane, UnsignedShortType, Vector3, Vector4, WebGLRenderTarget
} from "three"

import * as POSTPROCESSING from "postprocessing";

export class MeshReflectorMaterial extends MeshStandardMaterial {
    constructor(renderer, camera, scene, object, {
        mixBlur = 0,
        mixStrength = 1,
        resolution = 256,
        blur = [0, 0],
        minDepthThreshold = 0.9,
        maxDepthThreshold = 1,
        depthScale = 0,
        depthToBlurRatioBias = 0.25,
        mirror = 0,
        distortion = 1,
        mixContrast = 1,
        distortionMap,
        reflectorOffset = 0,
        bufferSamples = 8,
        planeNormal = new Vector3(0, 0, 1)
    } = {}, materialPropertes={}) {
        super(materialPropertes);

        this.materialPropertes = materialPropertes

        this.gl = renderer
        this.camera = camera
        this.scene = scene
        this.parent = object

        this.hasBlur = blur[0] + blur[1] > 0
        this.reflectorPlane = new Plane()
        this.normal = new Vector3()
        this.reflectorWorldPosition = new Vector3()
        this.cameraWorldPosition = new Vector3()
        this.rotationMatrix = new Matrix4()
        this.lookAtPosition = new Vector3(0, -1, 0)
        this.clipPlane = new Vector4()
        this.view = new Vector3()
        this.target = new Vector3()
        this.q = new Vector4()
        this.textureMatrix = new Matrix4()
        this.virtualCamera = new PerspectiveCamera()
        this.reflectorOffset = reflectorOffset;
        this.planeNormal = planeNormal

        this.setupBuffers(resolution, blur, bufferSamples);

        this.reflectorProps = {
            mirror,
            textureMatrix: this.textureMatrix,
            mixBlur,
            tDiffuse: this.fbo1.texture,
            tDepth: this.fbo1.depthTexture,
            tDiffuseBlur: this.fbo2.texture,
            hasBlur: this.hasBlur,
            mixStrength,
            minDepthThreshold,
            maxDepthThreshold,
            depthScale,
            depthToBlurRatioBias,
            distortion,
            distortionMap,
            mixContrast,
            'defines-USE_BLUR': this.hasBlur ? '' : undefined,
            'defines-USE_DEPTH': depthScale > 0 ? '' : undefined,
            'defines-USE_DISTORTION': distortionMap ? '' : undefined,
        }
    }

    setupBuffers(resolution, blur, bufferSamples) {
        const parameters = {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            encoding: this.gl.outputEncoding,
        }

        const fbo1 = new WebGLRenderTarget(resolution, resolution, parameters)
        fbo1.depthBuffer = true
        fbo1.depthTexture = new DepthTexture(resolution, resolution)
        fbo1.depthTexture.format = DepthFormat
        fbo1.depthTexture.type = UnsignedShortType

        const fbo2 = new WebGLRenderTarget(resolution, resolution, parameters)

        if (this.gl.capabilities.isWebGL2) {
            fbo1.samples = bufferSamples
        }

        this.fbo1 = fbo1;
        this.fbo2 = fbo2;

        this.kawaseBlurPass = new POSTPROCESSING.KawaseBlurPass()
        this.kawaseBlurPass.setSize(blur[0], blur[1])
    }

    beforeRender() {
        if (!this.parent) return

        this.reflectorWorldPosition.setFromMatrixPosition(this.parent.matrixWorld)
        this.cameraWorldPosition.setFromMatrixPosition(this.camera.matrixWorld)
        this.rotationMatrix.extractRotation(this.parent.matrixWorld)

        // was changed from this.normal.set(0, 0, 1)
        this.normal.copy(this.planeNormal)
        this.normal.applyMatrix4(this.rotationMatrix)
        this.reflectorWorldPosition.addScaledVector(this.normal, this.reflectorOffset)
        this.view.subVectors(this.reflectorWorldPosition, this.cameraWorldPosition)
        // Avoid rendering when reflector is facing away
        if (this.view.dot(this.normal) > 0) return
        this.view.reflect(this.normal).negate()
        this.view.add(this.reflectorWorldPosition)
        this.rotationMatrix.extractRotation(this.camera.matrixWorld)
        this.lookAtPosition.set(0, 0, -1)
        this.lookAtPosition.applyMatrix4(this.rotationMatrix)
        this.lookAtPosition.add(this.cameraWorldPosition)
        this.target.subVectors(this.reflectorWorldPosition, this.lookAtPosition)
        this.target.reflect(this.normal).negate()
        this.target.add(this.reflectorWorldPosition)
        this.virtualCamera.position.copy(this.view)
        this.virtualCamera.up.set(0, 1, 0)
        this.virtualCamera.up.applyMatrix4(this.rotationMatrix)
        this.virtualCamera.up.reflect(this.normal)
        this.virtualCamera.lookAt(this.target)
        this.virtualCamera.far = this.camera.far // Used in WebGLBackground
        this.virtualCamera.updateMatrixWorld()
        this.virtualCamera.projectionMatrix.copy(this.camera.projectionMatrix)

        // Update the texture matrix
        this.textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0)
        this.textureMatrix.multiply(this.virtualCamera.projectionMatrix)
        this.textureMatrix.multiply(this.virtualCamera.matrixWorldInverse)
        this.textureMatrix.multiply(this.parent.matrixWorld)

        // Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
        // Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
        this.reflectorPlane.setFromNormalAndCoplanarPoint(this.normal, this.reflectorWorldPosition)
        this.reflectorPlane.applyMatrix4(this.virtualCamera.matrixWorldInverse)
        this.clipPlane.set(this.reflectorPlane.normal.x, this.reflectorPlane.normal.y, this.reflectorPlane.normal.z, this.reflectorPlane.constant)
        const projectionMatrix = this.virtualCamera.projectionMatrix
        this.q.x = (Math.sign(this.clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0]
        this.q.y = (Math.sign(this.clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5]
        this.q.z = -1.0
        this.q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14]
        // Calculate the scaled plane vector
        this.clipPlane.multiplyScalar(2.0 / this.clipPlane.dot(this.q))

        // Replacing the third row of the projection matrix
        projectionMatrix.elements[2] = this.clipPlane.x
        projectionMatrix.elements[6] = this.clipPlane.y
        projectionMatrix.elements[10] = this.clipPlane.z + 1.0
        projectionMatrix.elements[14] = this.clipPlane.w
    }

    update() {
        if (this.parent.material !== this) return;

        this.parent.visible = false
        const currentXrEnabled = this.gl.xr.enabled
        const currentShadowAutoUpdate = this.gl.shadowMap.autoUpdate

        this.beforeRender()
        this.gl.xr.enabled = false
        this.gl.shadowMap.autoUpdate = false
        this.gl.setRenderTarget(this.fbo1)
        this.gl.state.buffers.depth.setMask(true)
        if (!this.gl.autoClear) this.gl.clear()

        this.gl.render(this.scene, this.virtualCamera)

        if (this.hasBlur) {
            this.kawaseBlurPass.render(this.gl, this.fbo1, this.fbo2);
        }

        this.gl.xr.enabled = currentXrEnabled
        this.gl.shadowMap.autoUpdate = currentShadowAutoUpdate
        this.parent.visible = true
        this.gl.setRenderTarget(null)
    }

    onBeforeCompile(shader, ...args) {
        super.onBeforeCompile(shader, ...args);

        if (this.defines === undefined) this.defines = {}

        if (!this.defines.USE_UV) {
            this.defines.USE_UV = ''
        }

        if (this.reflectorProps["defines-USE_BLUR"] !== undefined) this.defines.USE_BLUR = ""
        if (this.reflectorProps["defines-USE_DEPTH"] !== undefined) this.defines.USE_DEPTH = ""
        if (this.reflectorProps["defines-USE_DISTORTION"] !== undefined) this.defines.USE_DISTORTION = ""

        let props = this.reflectorProps;

        for (let prop in props) {
            shader.uniforms[prop] = {
                get value() {
                    return props[prop]
                }
            }
        }

        // Fade edge
        Object.assign(shader.uniforms, {
            isCircle: {
                value: this.materialPropertes.isCircle
            },
            radius1: {
                value: this.materialPropertes.radius1 || 20
            },
            radius2: {
                value: this.materialPropertes.radius2 || 380
            },
            center: {
                value: this.materialPropertes.center || new Vector3()
            },
            decay: {
                value: this.materialPropertes.decay || 2
            }
        })

        shader.vertexShader = `
            uniform mat4 textureMatrix;
            varying vec4 my_vUv;   
              
          ${shader.vertexShader}`

        // Fade Edge 
        shader.vertexShader = shader.vertexShader.replace('void main() {', vs_replace)

        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
          /* glsl */`
          #include <project_vertex>
          my_vUv = textureMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          `
        )

        shader.fragmentShader = /* glsl */`
            uniform sampler2D tDiffuse;
            uniform sampler2D tDiffuseBlur;
            uniform sampler2D tDepth;
            uniform sampler2D distortionMap;
            uniform float distortion;
            uniform float cameraNear;
            uniform float cameraFar;
            uniform bool hasBlur;
            uniform float mixBlur;
            uniform float mirror;
            uniform float mixStrength;
            uniform float minDepthThreshold;
            uniform float maxDepthThreshold;
            uniform float mixContrast;
            uniform float depthScale;
            uniform float depthToBlurRatioBias;
            varying vec4 my_vUv;        
            ${shader.fragmentShader}`

        // Fade Edge
        shader.fragmentShader = shader.fragmentShader.replace('void main() {', fs_replace)
        shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
            /*glsl*/`
                #include <dithering_fragment>
                if (_alpha < gl_FragColor.a) {
                    gl_FragColor.a = _alpha;
                }
            `
        )

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
          /* glsl */`
          #include <emissivemap_fragment>
        
          float distortionFactor = 0.0;
          #ifdef USE_DISTORTION
            distortionFactor = texture2D(distortionMap, vUv).r * distortion;
          #endif
    
          vec4 new_vUv = my_vUv;
          new_vUv.x += distortionFactor;
          new_vUv.y += distortionFactor;
    
          vec4 base = texture2DProj(tDiffuse, new_vUv);
          vec4 blur = texture2DProj(tDiffuseBlur, new_vUv);
          
          vec4 merge = base;
          
          #ifdef USE_NORMALMAP
            vec2 normal_uv = vec2(0.0);
            vec4 normalColor = texture2D(normalMap, vUv);
            vec3 my_normal = normalize( vec3( normalColor.r * 2.0 - 1.0, normalColor.b,  normalColor.g * 2.0 - 1.0 ) );
            vec3 coord = new_vUv.xyz / new_vUv.w;
            normal_uv = coord.xy + coord.z * my_normal.xz * 0.05 * normalScale;
            vec4 base_normal = texture2D(tDiffuse, normal_uv);
            vec4 blur_normal = texture2D(tDiffuseBlur, normal_uv);
            merge = base_normal;
            blur = blur_normal;
          #endif
    
          float depthFactor = 0.0001;
          float blurFactor = 0.0;
    
          #ifdef USE_DEPTH
            vec4 depth = texture2DProj(tDepth, new_vUv);
            depthFactor = smoothstep(minDepthThreshold, maxDepthThreshold, 1.0-(depth.r * depth.a));
            depthFactor *= depthScale;
            depthFactor = max(0.0001, min(1.0, depthFactor));
    
            #ifdef USE_BLUR
              blur = blur * min(1.0, depthFactor + depthToBlurRatioBias);
              merge = merge * min(1.0, depthFactor + 0.5);
            #else
              merge = merge * depthFactor;
            #endif
      
          #endif
    
          float reflectorRoughnessFactor = roughness;
          #ifdef USE_ROUGHNESSMAP
            vec4 reflectorTexelRoughness = texture2D( roughnessMap, vUv );
            
            reflectorRoughnessFactor *= reflectorTexelRoughness.g;
          #endif
          
          #ifdef USE_BLUR
            blurFactor = min(1.0, mixBlur * reflectorRoughnessFactor);
            merge = mix(merge, blur, blurFactor);
          #endif
    
          vec4 newMerge = vec4(0.0, 0.0, 0.0, 1.0);
          newMerge.r = (merge.r - 0.5) * mixContrast + 0.5;
          newMerge.g = (merge.g - 0.5) * mixContrast + 0.5;
          newMerge.b = (merge.b - 0.5) * mixContrast + 0.5;
          
          diffuseColor.rgb = diffuseColor.rgb * ((1.0 - min(1.0, mirror)) + newMerge.rgb * mixStrength);
          `
        );
    }
}