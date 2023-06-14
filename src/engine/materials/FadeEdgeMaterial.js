import * as THREE from "three";

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

/**
 * 根据topLet, bottomRight设置材质的边缘虚化效果
 * 一般用于场景中的底图(plane)对掉硬硬的边缘
 * 使用 THREE.ShaderLib.lambert 修改
 */
/**
 * @example
 * // init mode, 矩形
 * new FadeEdgeMaterial({
 * 	map:,
 * 	fadeMap,            // 可选
 * 	fadeLength: 1000,
 * 	topLeft: Vector3,
 * 	bottomRight: Vector3,
 * })
 * 
 * // function mode
 * var mat = new FadeEdgeMaterial()
 * // from a exist material
 * mat.fromMaterial(material)
 * mat.setFadeMap(fadeMapTexture)
 */
export class FadeEdgeMaterial extends THREE.MeshStandardMaterial {
    /**
     * @extends THREE.ShaderMaterial
     * @param {{
     *  isCircle?: boolean,
     *  fadeMap?: THREE.Texture,
     *  fadeLength?: Number,
     *  topLeft?: THREE.Vector3,
     *  bottomLeft?: THREE.Vector3,
     *  radius1?: Number,
     *  radius2?: Number,
     *  decay?: Number,
     *  center?: THREE.Vector3
     * } & THREE.MeshStandardMaterialParameters} config 
     */
    constructor(config) {

        super(config)

        this.uniforms = {}

		this.config = Object.assign({
			fadeLength: 1000,
			topLeft: new THREE.Vector3(-1749, 1871),
			bottomRight: new THREE.Vector3(1749, -1732),
            decay: 2.0,
		}, config)

        Object.keys(config).forEach(k => {
            this.uniforms[k] = {
                value: config[k]
            }
        })
    }

    /**
     * @param {THREE.Shader} shader 
     */
    onBeforeCompile(shader) {

        // uniforms
        Object.assign(shader.uniforms, this.uniforms)

        // vertexShader
        shader.vertexShader = shader.vertexShader.replace('void main() {', vs_replace)

        // fragmentShader
        shader.fragmentShader = shader.fragmentShader.replace('void main() {', fs_replace)
        shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
                /*glsl*/`
                    #include <dithering_fragment>
                    if (_alpha < gl_FragColor.a) {
                        gl_FragColor.a = _alpha;
                    }
                `
        )
    }
}