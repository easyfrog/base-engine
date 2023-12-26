import * as THREE from 'three';
import { Evento } from "./EventoClass";
import { update } from "@tweenjs/tween.js";
import { OrbitController } from "./OrbitController";

/**
 * Game Class
 */
export class Game extends Evento {

    /** private fields */
    #frameDelta;
    #frameCount = 0;
    #resolution = 1;

    /**
     * @param {object} config 
     * @param { HTMLCanvasElement } canvas use to 微信小游戏
     * @param {HTMLElement} config.container
     * @param {boolean} [config.alpha=true]
     * @param {number} [config.frameRate=30]
     * @param {number} width
     * @param {number} height
     */
    constructor(config={}) {
        super()

        this.config = config

        if (!config.container && !config.canvas) {
            console.warn('Game config needs container property');
            return
        }

        // for debug
        if (globalThis) {
            globalThis.ga = this
        }

        // renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: config.canvas,
            alpha: config.alpha,
            antialias: true,
        })

        // frame rate
        this.frameRate = config.frameRate || 30
        this.#frameDelta = Math.ceil(60 / this.frameRate)
        this.#frameCount = 0

        // renderer
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(config.width || this.width, config.height || this.height);

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;

        if (config.container) {
            config.container.appendChild(this.renderer.domElement)
        }

        // animationMixer
        this.clock = new THREE.Clock()
        this.mixer = new THREE.AnimationMixer()

        // camera & controller
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1, 10000)
        this.camera.position.set(0, 40, -100)
        this.controller = new OrbitController(this, this.camera, this.renderer.domElement)
        
        this.controller.addEventListener('change', () => {
            this.emit('viewChanged')
        })

        // scene
        this.scene = new THREE.Scene()

        // start render looping
        this.updateFunc = this.update.bind(this)
        this.updateFunc()

    }

    get width() {
        return this.config.container ? this.config.container.offsetWidth : this.config.canvas ? this.config.canvas.width : 300
    }
    
    get height() {
        return this.config.container ? this.config.container.offsetHeight : this.config.canvas ? this.config.canvas.height : 500
    }

    get resolution() {
        if (!this.#resolution) {
            this.#resolution = window.devicePixelRatio
        }
        return this.#resolution
    }

    set resolution(value) {
        this.renderer.setPixelRatio(value)
        this.#resolution = value
    }

    /**
     * @param {number} w 
     * @param {number} h 
     */
    resize(w, h) {
        let _width = w || this.width
        let _height = h || this.height

        this.renderer.setSize(_width, _height);

        this.camera.aspect = _width / _height;
        this.camera.updateProjectionMatrix();

        this.emit('viewSizeChanged', { width: _width, height: _height });
    }

    /**
     * 快捷的播放clipAction, 可正/反播放
     * @param {THREE.AnimationClip} action 
     * @param {boolean} [reverse=false] 
     * @param {number} [timeScale=1] 
     */
    playAction(action, reverse = false, timeScale = 1) {
        action.loop = THREE.LoopOnce
        action.clampWhenFinished = true
        action.timeScale = reverse ? timeScale * -1 : timeScale
        action.paused = false
        action.play()
    }

    update() {

        this.#frameCount ++
        if (this.#frameCount >= this.#frameDelta) {
            this.#frameCount = 0

            if (this.controller.enabled) {
                this.controller.update()
            }

            // got delta Time 
            var deltaTime = this.clock.getDelta();

            if (deltaTime > 1) {
                deltaTime = 1;
            }
            
            // tween update
            update()
            this.mixer.update(deltaTime)

            this.emit('pre-render', deltaTime)
            this.renderer.render(this.scene, this.camera)
            this.emit('update', deltaTime)
        }

        requestAnimationFrame(this.updateFunc)
    }

    dispose() {
        if (window) {
            window.removeEventListener('resize', this.resizeFunc)
        }

        // clear events handlers
        this.clearHandlers()

        // remove scene
        this.scene.children.forEach(obj => {
            this.scene.remove(obj)
        })
        this.scene.children.length = 0
    }

}

export default Game

