import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import babel from '@rollup/plugin-babel'

const PACKAGE_ROOT_PATH = process.cwd()

export default {
  input: `${PACKAGE_ROOT_PATH}/src/am-lyrics.ts`,
  external: [/@babel\/runtime/],
  output: [
    {
      file: 'dist/src/am-lyrics.js',
      format: 'esm',
      sourcemap: true,
    }
  ],
  plugins: [
    resolve(),
    typescript({
      tsconfig: `./tsconfig.json`
    }),
    babel({
      exclude: 'node_modules/**',
      rootMode: 'upward',
      babelHelpers: 'runtime'
    })
  ]
}