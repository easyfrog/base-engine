import { Game } from "@engine/Game";
import { Tween, Easing } from "@tweenjs/tween.js";

export var utils = {
    /**
     * @param {Game} game 
     * @param {THREE.Vector3} position 
     */
    sceneToScreen(game, position) {
        var p = position.clone();
        var vector = p.project(game.camera);

        vector.x = (vector.x + 1) / 2 * game.width
        vector.y = -(vector.y - 1) / 2 * game.height

        return vector;
    },

    /**
     * 
     * @param {Game} game
     * @param {THREE.Vector3} position 
     * @returns 
     */
    screenToScene(game, position) {
        var clone = position.clone()
        clone.unproject(game.camera)
        clone.z = 0
        return clone
    },

    moveCamera(game, toCamera, duration=1000) {

    }

}