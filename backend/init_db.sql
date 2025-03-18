-- Initialize the vulnerabilities database

-- Drop tables if they exist
DROP TABLE IF EXISTS vulnerability_patterns;
DROP TABLE IF EXISTS cwe_references;

-- Create table for vulnerability patterns
CREATE TABLE vulnerability_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL,
    pattern_type TEXT NOT NULL,
    pattern TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    cwe_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for CWE references
CREATE TABLE cwe_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cwe_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_vulnerability_patterns_language ON vulnerability_patterns(language);
CREATE INDEX idx_vulnerability_patterns_cwe_id ON vulnerability_patterns(cwe_id);
CREATE INDEX idx_cwe_references_cwe_id ON cwe_references(cwe_id);

-- Insert common vulnerability patterns for Python
INSERT INTO vulnerability_patterns (language, pattern_type, pattern, name, description, severity, cwe_id)
VALUES
    ('python', 'regex', 'eval\\s*\\(', 'Use of eval()', 'Use of eval() can lead to code injection', 'high', 'CWE-95'),
    ('python', 'regex', 'exec\\s*\\(', 'Use of exec()', 'Use of exec() can lead to code injection', 'high', 'CWE-95'),
    ('python', 'regex', 'os\\.system\\s*\\(', 'Unsafe shell execution', 'Command injection vulnerability', 'high', 'CWE-78'),
    ('python', 'regex', 'subprocess\\.call\\(.*shell\\s*=\\s*True', 'Unsafe subprocess', 'Command injection vulnerability', 'high', 'CWE-78');

-- Insert common vulnerability patterns for JavaScript
INSERT INTO vulnerability_patterns (language, pattern_type, pattern, name, description, severity, cwe_id)
VALUES
    ('javascript', 'regex', 'eval\\s*\\(', 'Use of eval()', 'Code injection vulnerability', 'high', 'CWE-95'),
    ('javascript', 'regex', 'new\\s+Function\\s*\\(', 'Use of Function constructor', 'Code injection vulnerability', 'high', 'CWE-95'),
    ('javascript', 'regex', 'document\\.write\\s*\\(', 'Use of document.write()', 'Potential XSS vulnerability', 'medium', 'CWE-79');
