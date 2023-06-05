import * as THREE from 'three';
import { Evento } from "./EventoClass";
import { update } from "@tweenjs/tween.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * Game Class
 */
export class Game extends Evento {
    /**
     * @param {object} config 
     * @param {HTMLElement} config.container
     * @param {boolean} [config.alpha=true]
     * @param {number} [config.frameRate=30]
     */
    constructor(config={}) {
        super()

        this.config = config

        if (!config.container) {
            console.warn('Game config needs container property');
            return
        }

        // renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: config.alpha
        })

        // frame rate
        this.frameRate = config.frameRate || 30
        this._frameDelta = Math.ceil(60 / this.frameRate)
        this._frameCount = 0
        this._delta = 0

        // renderer
        this.width = config.container.offsetWidth
        this.height = config.container.offsetHeight

        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.width, this.height);

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;

        config.container.appendChild(this.renderer.domElement)

        // animationMixer
        this.clock = new THREE.Clock()
        this.mixer = new THREE.AnimationMixer()

        // camera & controller
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1, 10000)
        this.camera.position.set(0, 40, -100)
        this.controller = new OrbitControls(this.camera, this.renderer.domElement)

        this.controller.dampingFactor = .1
        this.controller.enableDamping = true

        // scene
        this.scene = new THREE.Scene()

        // start render looping
        this.updateFunc = this.update.bind(this)
        this.updateFunc()

    }

    /**
     * @param {number} w 
     * @param {number} h 
     */
    resize(w, h) {
        this.width = w || this.config.container.offsetWidth
        this.height = h || this.config.container.offsetHeight

        this.renderer.setSize(this.width, this.height);

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();

        this.emit('viewSizeChanged', { width: this.width, height: this.height });
    }

    setMixerRoot(root) {
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

        this._frameCount ++
        if (this._frameCount >= this._frameDelta) {
            this._frameCount = 0
            this.controller.update()

            // got delta Time 
            var deltaTime = this.clock.getDelta();

            if (deltaTime > 1) {
                deltaTime = 1;
            }

            // tween update
            update()
            this.mixer.update(deltaTime)

            this.renderer.render(this.scene, this.camera)
            this.emit('update', deltaTime)
        }

        requestAnimationFrame(this.updateFunc)
    }

}

