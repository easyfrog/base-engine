import * as THREE from "three";
// import { getCubeMap } from "../../comps/objects/cubeMaps";

//
// 预处理 GLTF 场景
// 支持 camera, lights, helpers
// 
// sets:
// 	materials
// 	textures
// 	meshes
// 	helpers
// 	animations
// 	cameras
// 	lights
// 	
// methods:
// 	getNode
//  getCamera
//  getMesh
//  getDummy
//  getMaterial
//  getLight
// 

export function processGLTF (game, gltf) {

	// get gltf's boundingBox
	gltf.boundingBox = new THREE.Box3().setFromObject(gltf.scene)

	// collect materials
	if (!gltf.materials) {
		gltf.materials = []
	}

	// collect textures
	if (!gltf.textures) {
		gltf.textures = []
	}

	// collect meshes
	if (!gltf.meshes) {
		gltf.meshes = []
	}

	// collect helpers
	if (!gltf.helpers) {
		gltf.helpers = []
	}

	// collect lights
	if (!gltf.lights) {
		gltf.lights = []
	}

	decorateGltf(gltf)

	var maps = [
		'map',
		'alphaMap',
		'aoMap',
		'bumpMap',
		'metalnessMap',
		'roughnessMap',
		'normalMap',
		'ligthMap',
		'envMap',
		'displacementMap',
	]

	function getMap(m) {
		maps.forEach(map => {
			var tex = m[map]
			if (tex) {
				if (gltf.textures.indexOf(tex) < 0) {
					gltf.textures.push(tex)
				}
			}
		})
	}

	gltf.scene.traverse(m => {

		// meshes
		if (m.type === 'Mesh') {
			gltf.meshes.push(m)
		}

		// helpers
		if (m.userData && m.userData.tags === 'helper') {
			gltf.helpers.push(m)
		}

		// lights
		if (m.type.indexOf('ight') > -1) {
			gltf.lights.push(m)
		}

		if (m.material) {
			// emissive to 0
			// if (m.material.emissive) {
			// 	m.material.emissive.setScalar(0)
			// }

			var ms = [].concat(m.material)

			ms.forEach(_m => {
				if (gltf.materials.indexOf(_m) < 0) {
					gltf.materials.push(_m)

					getMap(_m)

				}
			})

		}
	})

	//
	// materials needs cubeMap
	//
	// var needs = ['glass', 'lake']

	// gltf.materials.forEach(m => {
	// 	if (needs.indexOf(m.name) > -1) {
	// 		if (!cubeMap) {
	// 			cubeMap = getCubeMap()
	// 		}

	// 		m.envMap = cubeMap

	// 		// glass
	// 		if (m.name === 'glass') {
	// 			m.opacity = .8
	// 			m.metalness = .8
	// 			m.roughness = .1
	// 			m.transparent = true
	// 		}
	// 	}
	// })

	// 
	// 将 texture 的 encoding 改为 LinearEncoding(3000), 默认是 sRGBEncoding(3001)
	// 解决贴图过暗的问题
	// 
	// gltf.textures.forEach(t => t.encoding = 3000)
	
	// camera target
	// 如果使用 draco 就不会导出 target
	gltf.cameras.forEach( c => {
		if (c.type === "PerspectiveCamera") {
			// c.target = gltf.scene.children.find(o => o.name === c.name + 'Target');
            c.target = gltf.getNode(c.name + 'Target')
		}

		// 默认的主相机
		// mainCamera NEEDS has a Target
		if (c.name === 'mainCamera' || c.name === 'main_cam') {
			gltf.mainCamera = c

			// !flyIn
			if (!game.config.flyIn) {
				game.camera.position.copy(c.position)
				game.controller.target.copy(c.target.position)

				return
			}

			// flyIn
			var radius = gltf.boundingBox.getBoundingSphere().radius * 10

			game.camera.position.set(0, radius, 0)

			// store old distance
			var min = game.controller.minDistance
			var max = game.controller.maxDistance

			game.controller.minDistance = 0
			game.controller.maxDistance = radius

			game.controller.cameraTo(gltf.mainCamera, () => {

				game.controller.minDistance = min
				game.controller.maxDistance = max

				emit('flyIn')

			}, game.config.flyIn_duration || 1000)

		}
	})

	// 如果gltf中包含灯光, 就关闭默认的主光
	// if (gltf.lights.length) {
	// 	gltf.mainLight = gltf.getLight('mainLight')

	// 	if (game) {
	// 		game.lights.directionalLight.intensity = 0
	// 		game.lights.directionalLight2.intensity = 0

	// 		if (gltf.mainLight) {
	// 			game.lights.directionalLight = gltf.mainLight
	// 		}
	// 	}
	// }

} 

var cubeMap = null 

function find(gltf, fn) {
	var res = []
	gltf.scene.traverse(o => {
		if (fn(o)) {
			res.push(o)
		}
	})

	if (!res.length) {
		return 
	} else if (res.length === 1) {
		return res[0]
	} else {
		return res
	}
}


// 将sea3d格式中的一些常规方法, 放到gltf上. 
// 因这之前是使用的sea3d格式, 方法上有很多它的自有方法
function decorateGltf(gltf) {

	// 通过名称获得对象
	gltf.getNode = name => {
		return find(gltf, o => o.name === name)
	}

	// gltf.getMaterial = name => find(gltf, o => o.material && o.material.name === name)
	gltf.getMaterial = name => gltf.materials.find(m => m.name === name)

	gltf.getMesh = name => gltf.meshes.find(m => m.name === name)
	gltf.getCamera = name => gltf.cameras.find(m => m.name === name)
	gltf.getDummy = name => gltf.helpers.find(m => m.name === name)
	gltf.getLight = name => gltf.lights.find(m => m.name === name)

}



