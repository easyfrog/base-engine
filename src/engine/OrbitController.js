import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Tween, Easing } from "@tweenjs/tween.js";

export class OrbitController extends OrbitControls {
    /**
     * @param {import('./Game').Game} game 
     * @param {THREE.Camera} object 
     * @param {HTMLElement} [domElement] 
     */
    constructor(game, object, domElement) {
        super(object, domElement)

        this.game = game

        this.dampingFactor = .1
        this.enableDamping = true

        this._camerato_tween = null
    }

    /**
     * to camera with target
     * @param {{position: THREE.Vector3, target: THREE.Object3D|THREE.Vector3}} camera 
     * @param {{
     *  duration?: number,
     *  delay?: number,
     *  easing?: string,
     *  inout?: string,
     *  onComplete: Function,
     *  onUpdate: Function
     * }} options 
     * @param {boolean} onlyTween only get tween instance, not start immidiatly
     * @return {Tween}
     */
    cameraTo(camera, options, onlyTween) {
        options = Object.assign({
            duration: 1000,
            delay: 0,
            easing: 'Cubic',
            inout: 'Out'
        }, options)

        this.enabled = false

        if (this._camerato_tween) {
            this._camerato_tween.stop()
        }

        var tween = new Tween({
                position: this.game.camera.position,
                target: this.target
            })
            .to({
                position: camera.position,
                target: camera.target.position
            }, options.duration)
            .delay(options.delay)
            .easing(Easing[options.easing][options.inout])
            .onUpdate(values => {
                this.update()
                if (options.onUpdate) {
                    options.onUpdate(time)
                }
            })
            .onComplete(() => {
                this.enabled = true
                if (options.onComplete) {
                    options.onComplete()
                }
            })

        if (!onlyTween) {
            tween.start()
        }

        this._camerato_tween = tween

        return tween
    }
}