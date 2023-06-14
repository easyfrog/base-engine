import { defineConfig } from 'vite';
import glsl from "vite-plugin-glsl";
import path from "path";
import fs from "fs";

////////////////// How to use ////////////////// 
// npm run dev
// npm run build
//
// project: config: {outDir: ""}
// npm run p project-name
////////////////// How to use ////////////////// 

// analyze process.argv
var index = process.argv.indexOf('--')  
var args = []
if (index > -1) {
    args = process.argv.slice(process.argv.indexOf('--') + 1)
}

// project name
var project = ''
var minify = true

if (args.length > 1) {
    switch (args[0]) {
        case 'project':
            var arr = args[1].split(',')
            project = arr[0]
            minify = arr[1] ? true : false
            break;
        default:
            break;
    }
}

var outDir = project ? `./dist/${project}/js` : './dist/sdk'
var projectConfig = {}

if (project) {
    var url = `./src/projects/${project}/config.json`
    if (fs.existsSync(url)) {
        projectConfig = JSON.parse(fs.readFileSync(url))
        if (projectConfig.outDir) {
            outDir = projectConfig.outDir
        }
    }
}

var lib = project ? {
    entry: `./src/projects/${project}/${project}.js`,
    formats: ['umd'],
    name: 'omp',
    fileName: format => `${project}.js`
} : {
    entry: './src/index.js',
    formats: ['es', 'umd'],
    name: 'om',
    fileName: format => `base-engine.${format}.js`
}

export default defineConfig({
    publicDir: project ? false : false,
    resolve: {
        alias: {
            "@engine": path.resolve(__dirname, './src/engine'),
            "@utils": path.resolve(__dirname, './src/utils'),
            "@jsm": path.resolve(__dirname, './node_modules/three/examples/jsm')
        }
    },
    build: {
        minify,
        outDir,
        lib,
        emptyOutDir: false,
    },
    plugins: [
        glsl()
    ]
})



