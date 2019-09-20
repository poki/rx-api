const ignoreDirs = [
	'.cache',
	'lib',
	'es',
	'node_modules',
];

module.exports = {
	testPathIgnorePatterns: ignoreDirs.map(dir => `<rootDir>/${dir}/`),
	modulePaths: ['src/'],
	moduleFileExtensions: ['js'],
	collectCoverageFrom: ['src/**/*.{js}', '!**/node_modules/**'],
	moduleNameMapper: {
		'^/(.*)': '<rootDir>/src/$1',
	},
};
