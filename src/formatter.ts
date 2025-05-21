import * as vscode from 'vscode';

/**
 * LookML Document Parser and Formatter
 * Provides more robust formatting for LookML files
 */
export class LookMLFormatter {
    private indentSize: number;
    private useSpaces: boolean;
    private indentString: string;
    
    constructor(options: vscode.FormattingOptions) {
        this.indentSize = options.tabSize;
        this.useSpaces = options.insertSpaces;
        this.indentString = this.useSpaces ? ' '.repeat(this.indentSize) : '\t';
    }
    
    /**
     * Format a LookML document
     */
    public format(document: vscode.TextDocument): vscode.TextEdit[] {
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        const formattedLines = this.formatLines(lines);
        const formattedText = formattedLines.join('\n');
        
        if (formattedText !== text) {
            return [
                vscode.TextEdit.replace(
                    new vscode.Range(
                        document.positionAt(0),
                        document.positionAt(text.length)
                    ),
                    formattedText
                )
            ];
        }
        
        return [];
    }
    
    /**
     * Format an array of lines
     */
    private formatLines(lines: string[]): string[] {
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inSqlBlock = false;
        let sqlBlockIndent = 0;
        let blockStack: { type: string, indent: number }[] = [];
        let lastPropertyIndent = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let trimmedLine = line.trim();
            
            // Skip empty lines but preserve them
            if (trimmedLine.length === 0) {
                formattedLines.push('');
                continue;
            }
            
            // Handle block starts (increase indentation after this line)
            if (trimmedLine.match(/:\s*\{\s*$/) || trimmedLine.endsWith('{')) {
                // Extract block type for the stack
                const blockMatch = trimmedLine.match(/^([a-zA-Z0-9_]+)\s*:/);
                const blockType = blockMatch ? blockMatch[1] : 'unknown';
                
                // Format the block opener with proper spacing after colon
                if (trimmedLine.includes(':')) {
                    const colonIndex = trimmedLine.indexOf(':');
                    const blockName = trimmedLine.substring(0, colonIndex).trim();
                    let restOfLine = trimmedLine.substring(colonIndex + 1).trim();
                    
                    // Ensure proper spacing for block definitions
                    trimmedLine = `${blockName}: ${restOfLine}`;
                }
                
                // Add the block to the stack with its indent level
                blockStack.push({ type: blockType, indent: indentLevel });
                
                formattedLines.push(this.indentString.repeat(indentLevel) + trimmedLine);
                indentLevel++;
                lastPropertyIndent = indentLevel;
                continue;
            }
            
            // Handle block ends (decrease indentation for this line)
            if (trimmedLine === '}' || trimmedLine === '} ;;') {
                indentLevel = Math.max(0, indentLevel - 1);
                if (blockStack.length > 0) {
                    blockStack.pop();
                }
                formattedLines.push(this.indentString.repeat(indentLevel) + trimmedLine);
                continue;
            }
            
            // Check for SQL block start
            if (!inSqlBlock && 
                (trimmedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value)\s*:\s*$/) || 
                 (trimmedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value)\s*:/) && 
                  !trimmedLine.match(/\{/) && !inSqlBlock))) {
                
                // Format the SQL property with proper spacing
                trimmedLine = this.formatLookMLProperty(trimmedLine);
                
                formattedLines.push(this.indentString.repeat(indentLevel) + trimmedLine);
                inSqlBlock = true;
                sqlBlockIndent = indentLevel + 1;
                lastPropertyIndent = indentLevel;
                continue;
            }
            
            // Check for SQL block end
            if (inSqlBlock && (trimmedLine === ";;" || trimmedLine.endsWith(";;"))) {
                // If it's just a ";;" line, indent it at the property level
                if (trimmedLine === ";;" || trimmedLine === "; ;") {
                    formattedLines.push(this.indentString.repeat(indentLevel) + ";;");
                } else {
                    // There's content before the ;;
                    const parts = trimmedLine.split(';;');
                    const sqlContent = parts[0].trim();
                    // Format the SQL content
                    const formattedSql = this.formatSqlKeywords(sqlContent);
                    formattedLines.push(this.indentString.repeat(sqlBlockIndent) + formattedSql + ";;");
                }
                inSqlBlock = false;
                continue;
            }
            
            // Handle SQL content within blocks
            if (inSqlBlock) {
                // Format SQL keywords if it's not a special template line
                if (!trimmedLine.includes("{%") && 
                    !trimmedLine.includes("{{") && 
                    !trimmedLine.includes("${")) {
                    trimmedLine = this.formatSqlKeywords(trimmedLine);
                } else if (trimmedLine.includes("${")) {
                    // Special handling for SQL with LookML variables
                    trimmedLine = this.formatSqlWithLookMLVars(trimmedLine);
                }
                
                formattedLines.push(this.indentString.repeat(sqlBlockIndent) + trimmedLine);
                continue;
            }
            
            // Handle property lines - ensure consistent indentation within blocks
            if (trimmedLine.includes(':') && !trimmedLine.endsWith('{')) {
                // Format the property
                let formattedLine = this.formatLookMLProperty(trimmedLine);
                
                // Handle SQL terminators on property lines
                if (formattedLine.endsWith(';;')) {
                    const parts = formattedLine.split(';;');
                    const propContent = parts[0].trim();
                    formattedLine = propContent + ";;";
                }
                
                // Use the current indent level for regular properties
                formattedLines.push(this.indentString.repeat(indentLevel) + formattedLine);
                continue;
            }
            
            // Any other content - preserve it with proper indentation
            formattedLines.push(this.indentString.repeat(indentLevel) + trimmedLine);
        }
        
        return formattedLines;
    }
    
    /**
     * Format a single LookML property
     */
    private formatLookMLProperty(line: string): string {
        if (line.includes(':')) {
            // For all properties, ensure proper spacing after colon
            const colonIndex = line.indexOf(':');
            if (colonIndex >= 0) {
                const propName = line.substring(0, colonIndex).trim();
                const propValue = line.substring(colonIndex + 1).trim();
                return `${propName}: ${propValue}`;
            }
        }
        
        return line;
    }
    
    /**
     * Format SQL keywords in a line
     */
    private formatSqlKeywords(line: string): string {
        // List of SQL keywords to capitalize
        const sqlKeywords = [
            'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 
            'HAVING', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 
            'FULL JOIN', 'OUTER JOIN', 'ON', 'AND', 'OR', 'AS', 'WITH', 'UNION', 'EXCEPT',
            'INTERSECT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'LIMIT', 
            'OFFSET', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'BETWEEN', 'IN',
            'EXISTS', 'DISTINCT', 'ALL'
        ];
        
        let formattedLine = line;
        
        // Capitalize SQL keywords
        sqlKeywords.forEach(keyword => {
            // Handle multi-word keywords like "GROUP BY"
            const parts = keyword.split(' ');
            if (parts.length > 1) {
                // For multi-word keywords, use a more flexible regex
                const regex = new RegExp(`\\b${parts[0]}\\s+${parts[1]}\\b`, "i");
                if (formattedLine.match(regex)) {
                    formattedLine = formattedLine.replace(regex, keyword);
                }
            } else {
                // Single word keywords
                const regex = new RegExp(`\\b${keyword}\\b`, "i");
                if (formattedLine.match(regex)) {
                    formattedLine = formattedLine.replace(regex, keyword);
                }
            }
        });
        
        // Ensure spaces around operators
        formattedLine = formattedLine
            .replace(/([<>=!])([^=<>\s])/g, "$1 $2")     // Add space after operators
            .replace(/([^\s<>=!])([<>=!])/g, "$1 $2")     // Add space before operators
            .replace(/\s{2,}/g, ' ');                  // Remove extra spaces
        
        return formattedLine;
    }
    
    /**
     * Format SQL that contains LookML variables like ${TABLE}
     */
    private formatSqlWithLookMLVars(line: string): string {
        // Apply special formatting to lines with LookML variables
        let formattedLine = line;
        
        // Handle common SQL keywords that might be lowercase
        const sqlKeywords = ['where', 'and', 'or', 'from', 'join', 'group by', 'order by', 'having'];
        
        sqlKeywords.forEach(keyword => {
            // Create a regex that handles spaces in keywords (like "group by")
            let pattern = keyword;
            if (keyword.includes(' ')) {
                const [first, second] = keyword.split(' ');
                pattern = `${first}\\s+${second}`;
            }
            
            const regex = new RegExp(`\\b${pattern}\\b`, "i");
            if (formattedLine.match(regex)) {
                formattedLine = formattedLine.replace(
                    regex, 
                    keyword.toUpperCase()
                );
            }
        });
        
        return formattedLine;
    }
}

/**
 * Create a document formatting edit provider for LookML
 */
export function createLookMLFormattingProvider(): vscode.DocumentFormattingEditProvider {
    return {
        provideDocumentFormattingEdits(
            document: vscode.TextDocument,
            options: vscode.FormattingOptions,
            token: vscode.CancellationToken
        ): vscode.ProviderResult<vscode.TextEdit[]> {
            const formatter = new LookMLFormatter(options);
            return formatter.format(document);
        }
    };
}