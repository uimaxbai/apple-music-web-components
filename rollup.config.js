import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import babel from '@rollup/plugin-babel'

const PACKAGE_ROOT_PATH = process.cwd()

const commonPlugins = [
  resolve(),
  typescript({
    tsconfig: `./tsconfig.json`
  }),
  babel({
    exclude: 'node_modules/**',
    rootMode: 'upward',
    babelHelpers: 'runtime'
  })
];

export default [
  // Build for vanilla JS
  {
    input: `${PACKAGE_ROOT_PATH}/src/am-lyrics.ts`,
    external: [/@babel\/runtime/],
    output: [
      {
        file: 'dist/src/am-lyrics.js',
        format: 'esm',
        sourcemap: true,
      }
    ],
    plugins: commonPlugins
  },
  // Build for React
  {
    input: `${PACKAGE_ROOT_PATH}/src/react.ts`,
    external: [/@babel\/runtime/, 'react', '@lit/react'],
    output: [
      {
        file: 'dist/src/react.js',
        format: 'esm',
        sourcemap: true,
      }
    ],
    plugins: commonPlugins
  }
]