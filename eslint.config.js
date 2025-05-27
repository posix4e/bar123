export default [
    {
        ignores: [
            "dist/**",
            "temp-chrome-profile-*/**",
            "node_modules/**",
            "**/*.min.js",
            "chrome-extension/peerjs.min.js",
            "bar123 Extension/Resources/peerjs.min.js",
            "test-results/**"
        ]
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                clearTimeout: "readonly",
                clearInterval: "readonly",
                fetch: "readonly",
                crypto: "readonly",
                URL: "readonly",
                
                // Extension APIs
                chrome: "readonly",
                browser: "readonly",
                
                // Node.js globals (for scripts and tests)
                process: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                require: "readonly",
                module: "readonly",
                exports: "readonly",
                global: "readonly",
                
                // Test globals
                describe: "readonly",
                it: "readonly",
                expect: "readonly",
                test: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
                
                // Project-specific globals
                Trystero: "readonly",
                trystero: "readonly"
            }
        },
        rules: {
            // Error Prevention
            "no-console": "warn",
            "no-debugger": "error",
            "no-alert": "error",
            "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
            "no-undef": "error",
            "no-redeclare": "error",
            "no-duplicate-imports": "error",
            
            // Code Quality
            "prefer-const": "error",
            "no-var": "error",
            "eqeqeq": ["error", "always"],
            "curly": ["error", "all"],
            
            // Style (minimal for now)
            "indent": ["error", 2],
            "quotes": ["error", "single", { "avoidEscape": true }],
            "semi": ["error", "always"],
            "comma-dangle": ["error", "never"]
        }
    },
    {
        files: ["scripts/**/*.js", "test/**/*.js"],
        languageOptions: {
            sourceType: "script"
        },
        rules: {
            "no-console": "off"
        }
    }
];