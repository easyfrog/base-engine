import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Tween, Easing } from "@tweenjs/tween.js";

/**
 * @typedef {{position: THREE.Vector3, target: THREE.Object3D|THREE.Vector3}} CameraLike
 */

/**
 * @typedef {{
 *  duration?: number,
 *  delay?: number,
 *  easing?: string,
 *  inout?: string,
 *  onUpdate?: Function
 *  onComplete?: Function,
 *  spherical?: boolean,
 * }} CameraAnimation
 */

/**
 * @typedef {CameraLike & {
 *  radius?: number,
 *  phi?: number,
 *  theta?: number
 * }} ViewState
 */

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
     * get camera state
     * @param {boolean} toString 
     * @returns {ViewState | string}
     */
    getViewState(toString) {
        var res = {
            position: this.object.position,
            target: this.target,
            radius: this.getDistance(),
            phi: this.getPolarAngle(),
            theta: this.getAzimuthalAngle()
        }

        return toString ? JSON.stringify(res) : res
    }

    /**
     * set camera state
     * @param {ViewState} state 
     * @param {CameraAnimation} options 
     * @returns {Tween}
     */
    setViewState(state, options) {
        return this.cameraTo(state, options)
    }

    /**
     * to camera with target
     * @param {ViewState} camera 
     * @param {CameraAnimation} options 
     * @param {boolean} onlyTween only get tween instance, not start immidiatly
     * @return {Tween}
     */
    cameraTo(camera, options, onlyTween) {
        options = Object.assign({      
            duration: 1000,
            delay: 0,
            easing: 'Cubic',
            inout: 'Out',
            // 是否启用球形差值
            spherical: undefined
        }, options)

        // 如果没有指定spherical, 但camera(viewState)中包含phi, theta
        if (options.spherical === undefined &&
            'phi' in options &&
            'theta' in options) {
            options.spherical = true
        }

        this._lastEnabled = this.enabled
        this.enabled = false

        if (this._camerato_tween) {
            this._camerato_tween.stop()
        }

        var _target = camera.target instanceof THREE.Object3D ? 
                        camera.target.position : 
                        camera.target;
    
        var from, to, delta, _theta, sign = 1
        var fromTheta

        // 球面插值
        if (options.spherical) {
            fromTheta = this.getAzimuthalAngle()
            from = {
                target: this.target,
                radius: this.getDistance(),
                phi: this.getPolarAngle(),
                theta: fromTheta,
                t: 0
            }
            to = {
                target: _target,
                radius: camera.radius,
                phi: camera.phi,
                theta: camera.theta,
                t: 1
            }

            // 分析 azimuthal angle, 得到最近角度
            delta = to.theta - from.theta
            sign = Math.sign(delta)
            delta = Math.abs(delta)
            if (delta > Math.PI) {
                delta = 2 * Math.PI - delta
                sign = sign * -1
            }

            // azimuthalAngle [-Math.PI, Math.PI]
            // console.log('from', from.azimuthalAngle, 'to', to.azimuthalAngle, 'cha', to.azimuthalAngle - from.azimuthalAngle,
                    // 'delta', delta, 'sign', sign)

        } else {
            // 线性插值
            from = {
                position: this.game.camera.position,
                target: this.target
            }
            to = {
                position: camera.position,
                target: _target
            }
        }

        var tween = new Tween(from)
            .to(to, options.duration)
            .delay(options.delay)
            .easing(Easing[options.easing][options.inout])
            .onUpdate(values => {

                // 如果是球面插值
                if (options.spherical) {
                    _theta = fromTheta + delta * values.t * sign

                    if (_theta > Math.PI) {
                        _theta = _theta - Math.PI * 2
                    } else if (_theta < -Math.PI) {
                        _theta = 2 * Math.PI + _theta
                    }

                    this.object.position.setFromSpherical({
                        radius: values.radius,
                        phi: values.phi,
                        theta: _theta
                    }).add(values.target)                    
                }

                // 因为我们在动画开始之前将enabled设置为了false
                // 所以我们需要手动update
                this.update()

                if (options.onUpdate) {
                    options.onUpdate(time)
                }
            })
            .onComplete(() => {
                this.enabled = this._lastEnabled
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