/**
 * 这个是使用 3d-tiles-renderer 加载的方式
 * https://github.com/NASA-AMMOS/3DTilesRendererJS
 */

import { TilesRenderer } from "3d-tiles-renderer";
import * as THREE from "three";
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export class ThreeTilesRenderer {

    /**
     * @param {import('../Game').Game} game 
     * @param {{
     *  url: string,
     *  altitude: number,
     *  teamLength: 50,
     * }} options 
     */
    constructor(game, options) {
        this.game = game
        this.options = Object.assign({}, options)

        this.group = new THREE.Group()
        this.group.name = 'TilesetGroup'
        this.game.scene.add(this.group)

        this.needsUpdateTiles = true

        // 每10个 tileset 用头一个的 cache 
        this.teamLength = this.options.teamLength || 50

        // altitude 海拔高度
        if (this.options.altitude) {
            this.group.position.y -= this.options.altitude
        }

        /** @type {TilesRenderer[]} */
        this.tilesRenderers = []

        ////////////////// Draco ////////////////// 
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('https://ooomap.com/lib/draco/gltf/');
        
        this.gltfLoader = new GLTFLoader();
        this.gltfLoader.setDRACOLoader(this.dracoLoader);
        ////////////////// Draco ////////////////// 

        if (options.url) {
            this.loadTiles(options.url)
        }

        this.off = this.game.on('update', () => {
            if (this.needsUpdateTiles) {
                this.game.camera.updateMatrixWorld()
                this.tilesRenderers.forEach(renderer => {
                    this.needsUpdateTiles = false
                    renderer.update()
                })
            }
        })

        this.off2 = this.game.on('viewChanged', () => {
            this.needsUpdateTiles = true
        })
    }

    /**
     * 用于加载, json 与 b3dm 不在同一级, 是在文件夹中的数据结构
     * @param {om.Map} map 
     * @param {THREE.Scene} scene 
     * @param {string} tileJsonPath 
     */
    async loadTiles(tileJsonPath) {
        var rep = await fetch(tileJsonPath)
        var json = await rep.json()

        json.root?.children?.forEach(child => {
            var renderer = this.createTilesRenderer(`${child.content?.uri}`)
        })
    }

    /**
     * create tilesRenderer
     * @param {string} tileset 
     * @returns {TilesRenderer}
     */
    createTilesRenderer(tileset) {
        const tilesRenderer = new TilesRenderer(tileset);
        tilesRenderer.setCamera(this.game.camera);
        tilesRenderer.setResolutionFromRenderer(this.game.camera, this.game.renderer);

        // rotation.x = -90
        tilesRenderer.group.rotation.x = -Math.PI / 2

        // set draco
        tilesRenderer.manager.addHandler(/\.gltf$/, this.gltfLoader);

        // 加入集合
        this.tilesRenderers.push(tilesRenderer)

        /////////////////// 重用 cache //////////////////
        if (this.tilesRenderers.length) {
            let leaderIndex = Math.floor((this.tilesRenderers.length - 1) / this.teamLength) * this.teamLength

            tilesRenderer.lruCache = this.tilesRenderers[leaderIndex].lruCache;
            tilesRenderer.downloadQueue = this.tilesRenderers[leaderIndex].downloadQueue;
            tilesRenderer.parseQueue = this.tilesRenderers[leaderIndex].parseQueue;
        }
        /////////////////// 重用 cache //////////////////

        tilesRenderer.onLoadModel = (scene) => {
            this.needsUpdateTiles = true
        };
        
        tilesRenderer.onLoadTileSet = () => {
            this.needsUpdateTiles = true
        }

        tilesRenderer.onDisposeModel = (scene) => {
            scene.traverse(c => {
                if (c.material) {
                    c.material.dispose();
                }
            });
        };

        // add to group
        this.group.add(tilesRenderer.group)

        return tilesRenderer
    }

    dispose() {
        this.tilesRenderers.forEach(renderer => {
            renderer.dispose()
        })
        this.tilesRenderers.length = 0
        this.off()
        this.off2()
    }
}