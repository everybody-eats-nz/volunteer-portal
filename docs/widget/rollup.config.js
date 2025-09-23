import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/star-support.ts',
  output: [
    {
      file: '../public/star-support.js',
      format: 'iife',
      name: 'StarSupport'
    },
    {
      file: '../public/star-support.min.js',
      format: 'iife',
      name: 'StarSupport',
      plugins: [terser()]
    }
  ],
  plugins: [
    nodeResolve({
      browser: true
    }),
    typescript({
      tsconfig: './tsconfig.json'
    })
  ]
};