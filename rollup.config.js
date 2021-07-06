import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default {
	input: './src/index.js',
	output: [{
		file: './es/rx-api.min.js',
		format: 'es',
	},{
		file: './lib/rx-api.min.js',
		format: 'cjs',
	}],
	plugins: [
		babel({
			exclude: 'node_modules/**'
		}),
		resolve(),
		commonjs(),
		terser(),
	]
}
