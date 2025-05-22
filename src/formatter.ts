import * as vscode from 'vscode';

/**
 * Represents a LookML block with its type, name, original text and position information
 */
interface LookMLBlock {
    type: string;          // 'dimension', 'measure', etc.
    name: string;          // The name after the type
    startLine: number;     // Start line in the original text
    endLine: number;       // End line in the original text
    content: string[];     // Array of content lines (including comments)
    rawContent: string[];  // Original raw content lines
    indent: number;        // Indentation level
    comments: string[];    // Associated comments for this block
    parentBlocks?: { type: string, indent: number, name: string }[]; // Parent blocks to track context
}

/**
 * Represents a view in LookML with metadata and all its fields
 */
interface LookMLView {
    name: string;               // The name of the view
    startLine: number;          // Start line of the view
    endLine: number;            // End line of the view
    header: string[];           // Header lines (including view declaration and initial properties)
    footer: string[];           // Footer lines (closing braces and any end comments)
    fields: LookMLBlock[];      // All fields (dimensions, measures, etc.) in the view
    nonFieldBlocks: string[];   // Content that doesn't fit into the field categories
}

/**
 * LookML Document Parser and Formatter
 * Provides more robust formatting for LookML files
 */
export class LookMLFormatter {
    public indentSize: number;
    private useSpaces: boolean;
    private indentString: string;
    private groupFieldsByType: boolean;
    private sortFields: boolean;
    
    constructor(options: vscode.FormattingOptions, testConfig?: {groupFieldsByType?: boolean, sortFields?: boolean}) {
        this.indentSize = options.tabSize;
        this.useSpaces = options.insertSpaces;
        this.indentString = this.useSpaces ? ' '.repeat(this.indentSize) : '\t';
        
        if (testConfig) {
            // Use test configuration values if provided
            this.groupFieldsByType = testConfig.groupFieldsByType !== undefined ? testConfig.groupFieldsByType : true;
            this.sortFields = testConfig.sortFields !== undefined ? testConfig.sortFields : true;
        } else {
            // Read extension settings from VS Code
            const config = vscode.workspace.getConfiguration('lookml');
            this.groupFieldsByType = config.get('formatter.groupFieldsByType', true);
            this.sortFields = config.get('formatter.sortFields', true);
        }
    }
    
    /**
     * Format a LookML document
     */
    public format(document: vscode.TextDocument): vscode.TextEdit[] {
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        
        // If we don't need to group or sort, use the simple formatter
        if (!this.groupFieldsByType && !this.sortFields) {
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
        
        // Use the advanced formatter with grouping and sorting
        const formattedLines = this.formatWithAdvancedOptions(lines);
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
     * Format with advanced options (grouping and sorting)
     */
    private formatWithAdvancedOptions(lines: string[]): string[] {
        const formattedLines: string[] = [];
        const views: LookMLView[] = this.parseViews(lines);
        
        // If we have no views (e.g., it's a model or manifest file),
        // use the simple formatting approach for the entire file
        if (views.length === 0) {
            return this.formatLines(lines);
        }
        
        // Format non-view content
        let currentLine = 0;
        for (const view of views) {
            // Add any content before this view
            while (currentLine < view.startLine) {
                const line = lines[currentLine];
                formattedLines.push(line);
                currentLine++;
            }
            
            // Skip the view lines as we'll format them separately
            currentLine = view.endLine + 1;
            
            // Process the view
            this.formatView(view, formattedLines);
        }
        
        // Add any remaining content after all views
        while (currentLine < lines.length) {
            formattedLines.push(lines[currentLine]);
            currentLine++;
        }
        
        return formattedLines;
    }
    
    /**
     * Parse LookML file and extract views
     */
    private parseViews(lines: string[]): LookMLView[] {
        const views: LookMLView[] = [];
        let inView = false;
        let currentView: LookMLView | null = null;
        let blockStack: { type: string, indent: number, name: string }[] = [];
        let indentLevel = 0;
        let currentField: LookMLBlock | null = null;
        let pendingComments: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Skip empty lines
            if (trimmedLine.length === 0) {
                if (inView && !currentField) {
                    // Empty line inside view but not inside a field
                    currentView!.nonFieldBlocks.push(line);
                }
                continue;
            }
            
            // Handle comments
            if (trimmedLine.startsWith('#')) {
                if (currentField) {
                    // Comment inside field, add to current field
                    currentField.comments.push(trimmedLine);
                    currentField.content.push(this.indentString.repeat(currentField.indent) + trimmedLine);
                } else if (inView) {
                    // Comment inside view but not in a field, could be for next field
                    pendingComments.push(trimmedLine);
                }
                // Comments outside views are handled automatically
                continue;
            }
            
            // Check for block starts
            if (trimmedLine.match(/:\s*\{\s*$/) || trimmedLine.endsWith('{')) {
                // Extract block type and name
                const blockMatch = trimmedLine.match(/^([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)/);
                const blockType = blockMatch ? blockMatch[1] : '';
                const blockName = blockMatch ? blockMatch[2] : '';
                
                // Add to block stack
                blockStack.push({ type: blockType, indent: indentLevel, name: blockName });
                
                // Check if this is a view start
                if (blockType === 'view' && !inView) {
                    inView = true;
                    currentView = {
                        name: blockName,
                        startLine: i,
                        endLine: -1,
                        header: [line],
                        footer: [],
                        fields: [],
                        nonFieldBlocks: []
                    };
                    
                    // Add any pending comments to the view header
                    if (pendingComments.length > 0) {
                        for (const comment of pendingComments) {
                            currentView.header.push(this.indentString.repeat(indentLevel + 1) + comment);
                        }
                        pendingComments = [];
                    }
                } else if (inView && this.isFieldType(blockType)) {
                    // This is a field block within a view
                    const fieldContent: string[] = [];
                    const rawContent: string[] = [];
                    
                    // Format field line
                    let formattedFieldLine = this.formatBlockOpener(trimmedLine);
                    fieldContent.push(this.indentString.repeat(indentLevel) + formattedFieldLine);
                    rawContent.push(trimmedLine);
                    
                    // Create field block with associated comments
                    currentField = {
                        type: blockType,
                        name: blockName,
                        startLine: i,
                        endLine: -1,
                        content: fieldContent,
                        rawContent: rawContent,
                        indent: indentLevel,
                        comments: [...pendingComments], // Copy pending comments
                        parentBlocks: [...blockStack] // Track parent blocks for context
                    };
                    
                    // Add to the current view
                    currentView!.fields.push(currentField);
                    pendingComments = []; // Clear pending comments
                } else if (inView) {
                    // Non-field block within a view
                    if (currentField) {
                        // This is a nested block within a field
                        const formattedLine = this.formatBlockOpener(trimmedLine);
                        currentField.content.push(this.indentString.repeat(indentLevel) + formattedLine);
                        currentField.rawContent.push(trimmedLine);
                    } else {
                        // This is a non-field block directly in the view
                        // Format the line properly with consistent indentation
                        const formattedLine = this.formatBlockOpener(trimmedLine);
                        const formattedBlockLine = this.indentString.repeat(indentLevel) + formattedLine;
                        currentView!.nonFieldBlocks.push(formattedBlockLine);
                    }
                }
                
                indentLevel++;
                continue;
            }
            
            // Check for block ends
            if (trimmedLine === '}' || trimmedLine === '} ;;') {
                indentLevel = Math.max(0, indentLevel - 1);
                
                // Pop from block stack
                if (blockStack.length > 0) {
                    const lastBlock = blockStack.pop();
                    
                    // Check if we're ending a field block
                    if (currentField && lastBlock?.type && this.isFieldType(lastBlock.type)) {
                        currentField.content.push(this.indentString.repeat(indentLevel) + trimmedLine);
                        currentField.rawContent.push(trimmedLine);
                        currentField.endLine = i;
                        currentField = null;
                    } else if (inView && lastBlock?.type === 'view') {
                        // Ending a view block
                        inView = false;
                        currentView!.footer.push(line);
                        currentView!.endLine = i;
                        views.push(currentView!);
                        currentView = null;
                    } else if (inView && currentField) {
                        // Ending a nested block within a field
                        currentField.content.push(this.indentString.repeat(indentLevel) + trimmedLine);
                        currentField.rawContent.push(trimmedLine);
                    } else if (inView) {
                        // Ending a non-field block in the view
                        currentView!.nonFieldBlocks.push(line);
                    }
                }
                
                continue;
            }
            
            // Handle regular content lines
            if (inView) {
                if (currentField) {
                    // Regular content inside a field
                    let formattedLine = trimmedLine;
                    
                    // Format property lines
                    if (trimmedLine.includes(':') && !trimmedLine.endsWith('{')) {
                        formattedLine = this.formatLookMLProperty(trimmedLine);
                    }
                    
                    currentField.content.push(this.indentString.repeat(indentLevel) + formattedLine);
                    currentField.rawContent.push(trimmedLine);
                } else {
                    // Regular content inside view but not in a field
                    // Format property lines with consistent indentation
                    if (trimmedLine.includes(':') && !trimmedLine.endsWith('{')) {
                        const formattedProperty = this.formatLookMLProperty(trimmedLine);
                        currentView!.nonFieldBlocks.push(this.indentString.repeat(indentLevel) + formattedProperty);
                    } else {
                        currentView!.nonFieldBlocks.push(line);
                    }
                }
            }
        }
        
        return views;
    }
    
    /**
     * Format a block opener line (like "dimension: foo {")
     */
    private formatBlockOpener(line: string): string {
        if (line.includes(':')) {
            const colonIndex = line.indexOf(':');
            const blockType = line.substring(0, colonIndex).trim();
            let blockDef = line.substring(colonIndex + 1).trim();
            
            // Ensure proper spacing after the colon
            return `${blockType}: ${blockDef}`;
        }
        return line;
    }
    
    /**
     * Check if a block type is a field type
     */
    private isFieldType(type: string): boolean {
        return type === 'dimension' || 
               type === 'dimension_group' || 
               type === 'measure' || 
               type === 'parameter' || 
               type === 'filter';
    }
    
    /**
     * Format a view with its fields
     */
    private formatView(view: LookMLView, output: string[]): void {
        // Add view header
        for (const line of view.header) {
            output.push(line);
        }
        
        // Add non-field blocks - filter out unnecessary blank lines
        let nonEmptyNonFieldBlocks = view.nonFieldBlocks.filter(line => line.trim().length > 0);
        if (nonEmptyNonFieldBlocks.length > 0) {
            // Add at most one blank line after the header
            output.push('');
            
            // Add the actual content with correct indentation
            for (const line of nonEmptyNonFieldBlocks) {
                let trimmedLine = line.trim();
                
                // Check if this is a property line
                if (trimmedLine.includes(':') && !trimmedLine.includes('{')) {
                    // It's a top-level property in the view, indent by 2 spaces
                    output.push(this.indentString.repeat(1) + trimmedLine);
                } else {
                    // Preserve existing indentation
                    output.push(line);
                }
            }
        }
        
        // Organize fields
        if (this.groupFieldsByType || this.sortFields) {
            this.organizeViewFields(view, output);
        } else {
            // Just add fields in their original order
            for (const field of view.fields) {
                for (const line of field.content) {
                    output.push(line);
                }
                
                // Add empty line after each field for readability
                output.push('');
            }
        }
        
        // Add view footer
        for (const line of view.footer) {
            output.push(line);
        }
    }
    
    /**
     * Organize fields in a view by type and/or sort them
     */
    private organizeViewFields(view: LookMLView, output: string[]): void {
        // Group fields by type
        const filters: LookMLBlock[] = [];
        const parameters: LookMLBlock[] = [];
        const dimensions: LookMLBlock[] = [];
        const dimensionGroups: LookMLBlock[] = [];
        const measures: LookMLBlock[] = [];
        const others: LookMLBlock[] = [];
        
        for (const field of view.fields) {
            switch (field.type) {
                case 'filter':
                    filters.push(field);
                    break;
                case 'parameter':
                    parameters.push(field);
                    break;
                case 'dimension':
                    dimensions.push(field);
                    break;
                case 'dimension_group':
                    dimensionGroups.push(field);
                    break;
                case 'measure':
                    measures.push(field);
                    break;
                default:
                    others.push(field);
            }
        }
        
        // Sort fields if needed
        if (this.sortFields) {
            filters.sort((a, b) => a.name.localeCompare(b.name));
            parameters.sort((a, b) => a.name.localeCompare(b.name));
            dimensions.sort((a, b) => a.name.localeCompare(b.name));
            dimensionGroups.sort((a, b) => a.name.localeCompare(b.name));
            measures.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        // Find the indentation level for fields in this view
        const fieldIndent = view.fields.length > 0 ? view.fields[0].indent : 1;
        
        // Add filters section
        if (filters.length > 0) {
            this.addFieldSection(output, filters, "Filters", fieldIndent);
        }
        
        // Add parameters section
        if (parameters.length > 0) {
            this.addFieldSection(output, parameters, "Parameters", fieldIndent);
        }
        
        // Add dimensions section
        if (dimensions.length > 0 || dimensionGroups.length > 0) {
            // Start dimensions section
            if (this.groupFieldsByType) {
                output.push('');
                output.push(this.indentString.repeat(fieldIndent) + '# ----- Dimensions -----');
            }
            
            // Add dimensions
            for (const field of dimensions) {
                output.push('');
                
                // Add associated comments
                if (field.comments.length > 0) {
                    for (const comment of field.comments) {
                        output.push(this.indentString.repeat(fieldIndent) + comment);
                    }
                }
                
                // Add the field content with proper indentation
                this.addFormattedFieldContent(output, field);
            }
            
            // Add dimension_groups
            for (const field of dimensionGroups) {
                output.push('');
                
                // Add associated comments
                if (field.comments.length > 0) {
                    for (const comment of field.comments) {
                        output.push(this.indentString.repeat(fieldIndent) + comment);
                    }
                }
                
                // Add the field content with proper indentation
                this.addFormattedFieldContent(output, field);
            }
            
            // End dimensions section
            if (this.groupFieldsByType) {
                output.push(this.indentString.repeat(fieldIndent) + '# ----- End of Dimensions -----');
            }
        }
        
        // Add measures section
        if (measures.length > 0) {
            this.addFieldSection(output, measures, "Measures", fieldIndent);
        }
        
        // Add other fields that don't fit into standard categories
        for (const field of others) {
            output.push('');
            
            // Add associated comments
            if (field.comments.length > 0) {
                for (const comment of field.comments) {
                    output.push(this.indentString.repeat(fieldIndent) + comment);
                }
            }
            
            // Add the field content with proper indentation
            this.addFormattedFieldContent(output, field);
        }
    }
    
    /**
     * Add a field section with header and footer
     */
    private addFieldSection(output: string[], fields: LookMLBlock[], sectionName: string, indentLevel: number): void {
        if (fields.length === 0) {
            return;
        }
        
        // Add section header if grouping is enabled and a section header doesn't already exist
        if (this.groupFieldsByType) {
            const headerPattern = `# ----- ${sectionName} -----`;
            const footerPattern = `# ----- End of ${sectionName} -----`;
            
            // Check if we already have a section header (to avoid duplicating when formatting multiple times)
            const hasHeader = output.some(line => line.trim() === headerPattern);
            
            if (!hasHeader) {
                output.push('');
                output.push(this.indentString.repeat(indentLevel) + headerPattern);
            }
        }
        
        // Add fields
        for (const field of fields) {
            output.push('');
            
            // Add associated comments
            if (field.comments.length > 0) {
                for (const comment of field.comments) {
                    output.push(this.indentString.repeat(indentLevel) + comment);
                }
            }
            
            // Add the field content with proper indentation
            this.addFormattedFieldContent(output, field);
        }
        
        // Add section footer if grouping is enabled and a footer doesn't already exist
        if (this.groupFieldsByType) {
            const footerPattern = `# ----- End of ${sectionName} -----`;
            
            // Check if we already have a section footer (to avoid duplicating when formatting multiple times)
            const hasFooter = output.some(line => line.trim() === footerPattern);
            
            if (!hasFooter) {
                output.push(this.indentString.repeat(indentLevel) + footerPattern);
            }
        }
    }
    
    /**
     * Add a formatted field content with proper indentation
     */
    private addFormattedFieldContent(output: string[], field: LookMLBlock): void {
        // Get block start line and ensure consistent indentation for field blocks
        let blockStart = field.content[0];
        
        // If we're grouping fields, we need to ensure consistent indentation
        if (this.groupFieldsByType) {
            // Extract the content of the line, preserving the original indentation pattern
            const trimmedStart = blockStart.trimStart();
            // Apply a consistent indentation of 2 spaces (1 indentSize) for the field declaration
            blockStart = this.indentString.repeat(1) + trimmedStart;
        }
        
        output.push(blockStart);
        
        // Handle field body (contents inside the block)
        const blockIndent = field.indent + 1;
        
        // Process each line in the raw content starting from the second line
        // (the first line is the block start line which we've already added)
        let nestedIndentLevel = blockIndent;
        let inSqlBlock = false;
        let sqlPropertyLine = -1;
        
        for (let i = 1; i < field.rawContent.length; i++) {
            const line = field.rawContent[i];
            const trimmedLine = line.trim();
            
            // Track nesting level for proper indentation of nested blocks
            if (trimmedLine.match(/:\s*\{\s*$/) || trimmedLine.endsWith('{')) {
                // Start of a nested block
                const formattedBlockStart = this.formatBlockOpener(trimmedLine);
                output.push(this.indentString.repeat(nestedIndentLevel) + formattedBlockStart);
                nestedIndentLevel++;
                continue;
            } else if (trimmedLine === '}' || trimmedLine === '} ;;') {
                // First decrease the indent level as we're closing a block
                nestedIndentLevel--;
                inSqlBlock = false; // Exit SQL block if we were in one
                
                // Use appropriate indentation based on nesting level
                if (nestedIndentLevel < blockIndent) {
                    // This is the closing brace for the main field block
                    output.push(this.indentString.repeat(field.indent) + trimmedLine);
                    // Reset to block indent after closing the main field
                    nestedIndentLevel = blockIndent;
                } else {
                    // This is a nested block closing brace - match the opening level
                    output.push(this.indentString.repeat(nestedIndentLevel) + trimmedLine);
                }
                continue;
            }
            
            // Check for SQL block start
            if (!inSqlBlock && 
                (trimmedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value)\s*:\s*$/) || 
                 (trimmedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value)\s*:/) && 
                  !trimmedLine.match(/\{/) && !inSqlBlock))) {
                // Format the SQL property with proper spacing
                const formattedProperty = this.formatLookMLProperty(trimmedLine);
                output.push(this.indentString.repeat(nestedIndentLevel) + formattedProperty);
                inSqlBlock = true;
                sqlPropertyLine = i;
                continue;
            }
            
            // Check for SQL block end
            if (inSqlBlock && (trimmedLine === ";;" || trimmedLine.endsWith(";;"))) {
                // If it's just a ";;" line, indent it at the property level
                if (trimmedLine === ";;" || trimmedLine === "; ;") {
                    output.push(this.indentString.repeat(nestedIndentLevel) + ";;");
                } else {
                    // There's content before the ;;
                    const parts = trimmedLine.split(';;');
                    const sqlContent = parts[0].trim();
                    // Format the SQL content
                    const formattedSql = this.formatSqlKeywords(sqlContent);
                    output.push(this.indentString.repeat(nestedIndentLevel) + formattedSql + ";;");
                }
                inSqlBlock = false;
                continue;
            }
            
            // Handle SQL content
            if (inSqlBlock) {
                // Format SQL keywords if it's not a special template line
                let formattedLine = trimmedLine;
                if (!trimmedLine.includes("{%") && 
                    !trimmedLine.includes("{{") && 
                    !trimmedLine.includes("${")) {
                    formattedLine = this.formatSqlKeywords(trimmedLine);
                } else if (trimmedLine.includes("${")) {
                    // Special handling for SQL with LookML variables
                    formattedLine = this.formatSqlWithLookMLVars(trimmedLine);
                }
                
                // Use a consistent indentation strategy for SQL
                let sqlIndent = nestedIndentLevel + this.indentSize; // Base SQL indent
                
                // Check if this is a main SQL keyword
                const isMainSqlKeyword = /^\s*(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|JOIN|UNION|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|OUTER JOIN)/i.test(formattedLine);
                
                // Check if this is inside a derived_table
                const isDerivedTable = field.parentBlocks && field.parentBlocks.some(block => block.type === 'derived_table');
                
                // If it's not a main SQL keyword, add one more indent level
                if (!isMainSqlKeyword) {
                    // Add one more level for columns, conditions, etc.
                    sqlIndent += this.indentSize; // Additional indent for nested content
                }
                
                // Special hard-coded handling for derived tables - enforce the pattern that users expect
                if (isDerivedTable || formattedLine.match(/^\s*SELECT\b/i)) {
                    // SQL content in a derived table has standardized indentation patterns
                    if (isMainSqlKeyword) {
                        // Main SQL keywords (SELECT, FROM, etc.) go at base indentation + base indent
                        sqlIndent = 1;
                    } else {
                        // Non-main keywords (columns, conditions) get one more level
                        sqlIndent = 2;
                    }
                }
                
                // Make sure we're actually adding the indentation to the formatted line
                formattedLine = formattedLine.trimStart();
                
                output.push(this.indentString.repeat(sqlIndent) + formattedLine);
                continue;
            }
            
            if (trimmedLine.length === 0) {
                // Empty line
                output.push('');
            } else if (trimmedLine.startsWith('#')) {
                // Comment line
                output.push(this.indentString.repeat(nestedIndentLevel) + trimmedLine);
            } else if (trimmedLine.includes(':') && !trimmedLine.endsWith('{')) {
                // Property line
                const formattedProperty = this.formatLookMLProperty(trimmedLine);
                output.push(this.indentString.repeat(nestedIndentLevel) + formattedProperty);
            } else {
                // Other content
                output.push(this.indentString.repeat(nestedIndentLevel) + trimmedLine);
            }
        }
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
    
    /**
     * Original formatter - used when grouping and sorting are disabled
     */
    private formatLines(lines: string[]): string[] {
        const formattedLines: string[] = [];
        let indentLevel = 0;
        let inSqlBlock = false;
        let sqlBlockIndent = 0;
        let blockStack: { type: string, indent: number }[] = [];
        
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
                sqlBlockIndent = indentLevel;
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
                
                // Give SQL statements proper indentation - indent SQL by one additional level
                // If it's a SELECT, FROM, WHERE, GROUP BY, etc. line, use standard indentation
                // If it's a column or condition line, add an extra indent level
                // Use a consistent indentation strategy for SQL
                let effectiveIndent = sqlBlockIndent + this.indentSize; // Base SQL indent
                
                // Check if this is a main SQL keyword
                const isMainSqlKeyword = /^\s*(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|JOIN|UNION|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|OUTER JOIN)/i.test(trimmedLine);
                
                // Check if we're in a derived_table context
                const isDerivedTable = blockStack.length > 0 && blockStack.some(block => block.type === 'derived_table');
                
                // If it's not a main SQL keyword, add one more indent level
                if (!isMainSqlKeyword) {
                    // Add one more level for columns, conditions, etc.
                    effectiveIndent += this.indentSize; // Additional indent for nested content
                }
                
                // Special hard-coded handling for derived tables - enforce the pattern that users expect
                if (isDerivedTable || trimmedLine.match(/^\s*SELECT\b/i)) {
                    // SQL content in a derived table has standardized indentation patterns
                    if (isMainSqlKeyword) {
                        // Main SQL keywords (SELECT, FROM, etc.) go at base view indentation + 3
                        effectiveIndent = 1;
                    } else {
                        // Non-main keywords (columns, conditions) get one more level
                        effectiveIndent = 2;
                    }
                }
                
                // Make sure we're actually adding the indentation to the formatted line
                trimmedLine = trimmedLine.trimStart();
                
                formattedLines.push(this.indentString.repeat(effectiveIndent) + trimmedLine);
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
                
                // Special handling for SQL properties that don't have content on the same line
                if (formattedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value)\s*:\s*$/)) {
                    inSqlBlock = true;
                    sqlBlockIndent = indentLevel;
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