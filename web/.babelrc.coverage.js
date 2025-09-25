module.exports = {
  presets: ["next/babel"],
  plugins: [
    // Add Istanbul instrumentation for coverage when in test environment
    ...(process.env.NODE_ENV === "test" || process.env.COVERAGE === "true" 
      ? [["babel-plugin-istanbul", { exclude: ["**/*.spec.js", "**/*.test.js"] }]] 
      : [])
  ]
};