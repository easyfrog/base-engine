import { OGC3DTile } from "@jdultra/threedtiles";
import * as THREE from 'three';

window.THREE = THREE

/**
 * 这个是使用 OGC3DTile 加载的方式
 */

/**
 * https://github.com/ebeaufay/threedtiles#readme
 */
export class ThreeTiles {
    /**
     * @param {import('../Game').Game} game 
     * @param {{
     *  url: string
     * }} options 
     */
    constructor(game, options) {
        this.game = game
        this.options = Object.assign({}, options)

        /** @type {THREE.Object3D} */
        this.ogc3DTile = null

        if (this.options.url) {
            this.setTileset(this.options.url)
        }
    }

    setTileset(url) {
        this.ogc3DTile = new OGC3DTile({
            // url: "https://storage.googleapis.com/ogc-3d-tiles/ayutthaya/tiledWithSkirts/tileset.json",
            yUp: true,    // for google 3dtiles
            url,
            renderer: this.game.renderer,
            geometricErrorMultiplier: .1,
            centerModel: true,
            static: true,
            onLoadCallback: tile => {

                tile.json?.children.forEach(child => {
                    var uri = child.content.uri
                    child.content.uri = location.href + uri.slice(2)

                    // to center
                    // child.boundingVolume.box[0] -= origin[0]
                    // child.boundingVolume.box[1] -= origin[1]
                    // child.boundingVolume.box[2] -= origin[2]
                })

            },
            meshCallback: (/** @type {THREE.Mesh} */mesh) => {
                mesh.material.side = THREE.DoubleSide
            }
        })

        this.game.scene.add(this.ogc3DTile)

        this.game.on('update', () => this.ogc3DTile.update(this.game.camera))
    }
}