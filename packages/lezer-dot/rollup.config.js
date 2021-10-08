import {nodeResolve} from "@rollup/plugin-node-resolve"

export default {
  input: "./src/parser.js",
  output: [{
    format: "es",
    file: "./dist/index.es.js"
  }],
  external(id) { return !/^[\.\/]/.test(id) },
  plugins: [
    nodeResolve()
  ]
}
