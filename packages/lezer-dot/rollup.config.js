import {nodeResolve} from "@rollup/plugin-node-resolve"

export default {
  input: "./gen/parser.js",
  output: [{
    format: "es",
    file: "./dist/index.es.js"
  }],
  external(id) { return !/^[\.\/]/.test(id) },
  plugins: [
    nodeResolve()
  ]
}
