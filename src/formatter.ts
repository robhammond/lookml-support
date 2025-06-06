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
        let inSqlBlock = false;
        let sqlBlockIndent = 0;
        let hasEncounteredFieldInView = false;
        
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
                    currentField.content.push(this.indentString.repeat(currentField.indent + 1) + trimmedLine);
                } else if (inView) {
                    // Comment inside view but not in a field
                    if (!hasEncounteredFieldInView) {
                        // This is a view-level comment (before any fields)
                        currentView!.nonFieldBlocks.push(trimmedLine);
                    } else {
                        // This is a field-level comment (after we've seen fields)  
                        pendingComments.push(trimmedLine);
                    }
                }
                // Comments outside views are handled automatically
                continue;
            }
            
            // Check for block starts
            if (trimmedLine.match(/:\s*\{\s*$/) || trimmedLine.endsWith('{')) {
                // Extract block type and name
                const blockMatchWithName = trimmedLine.match(/^([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)/);
                const blockMatchNoName = trimmedLine.match(/^([a-zA-Z0-9_]+)\s*:\s*\{/);
                
                let blockType = '';
                let blockName = '';
                
                if (blockMatchWithName) {
                    blockType = blockMatchWithName[1];
                    blockName = blockMatchWithName[2];
                } else if (blockMatchNoName) {
                    blockType = blockMatchNoName[1];
                    blockName = '';
                }
                
                // Add to block stack
                blockStack.push({ type: blockType, indent: indentLevel, name: blockName });
                
                // Check if this is a view start
                if (blockType === 'view' && !inView) {
                    inView = true;
                    hasEncounteredFieldInView = false; // Reset for new view
                    currentView = {
                        name: blockName,
                        startLine: i,
                        endLine: -1,
                        header: [line],
                        footer: [],
                        fields: [],
                        nonFieldBlocks: []
                    };
                    
                    // Don't add pending comments to the header - they should be view-level
                    if (pendingComments.length > 0) {
                        for (const comment of pendingComments) {
                            currentView.nonFieldBlocks.push(comment);
                        }
                        pendingComments = [];
                    }
                } else if (inView && this.isFieldType(blockType)) {
                    // This is a field block within a view
                    hasEncounteredFieldInView = true; // Mark that we've seen a field
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
                    
                    // Check for SQL block start
                    if (!inSqlBlock && 
                        (trimmedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value|html)\s*:\s*$/) || 
                         (trimmedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value|html)\s*:/) && 
                          !trimmedLine.match(/\{/) && !inSqlBlock))) {
                        // Format the SQL property with proper spacing
                        const formattedProperty = this.formatLookMLProperty(trimmedLine);
                        currentView!.nonFieldBlocks.push(this.indentString.repeat(indentLevel) + formattedProperty);
                        inSqlBlock = true;
                        sqlBlockIndent = indentLevel;
                    }
                    // Check for SQL block end
                    else if (inSqlBlock && trimmedLine.endsWith(';;')) {
                        // Format SQL terminator with proper spacing
                        const parts = trimmedLine.split(';;');
                        if (parts.length > 1 && parts[0].trim().length > 0) {
                            // SQL content followed by terminator on same line
                            const sqlContent = parts[0].trim();
                            const formattedSql = this.formatSqlKeywords(sqlContent);
                            
                            // Check if we're in a derived table
                            const isDerivedTable = blockStack.some(block => block.type === 'derived_table');
                            let effectiveIndent = sqlBlockIndent + 1;
                            
                            if (isDerivedTable) {
                                const isMainSqlKeyword = /^\s*(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|JOIN|UNION)/i.test(formattedSql);
                                effectiveIndent = isMainSqlKeyword ? 3 : 4;
                            }
                            
                            currentView!.nonFieldBlocks.push(this.indentString.repeat(effectiveIndent) + formattedSql + ' ;;');
                        } else {
                            currentView!.nonFieldBlocks.push(this.indentString.repeat(sqlBlockIndent) + ';;');
                        }
                        inSqlBlock = false;
                    }
                    // Handle SQL content
                    else if (inSqlBlock) {
                        let formattedLine = this.formatSqlKeywords(trimmedLine);
                        
                        // Check if we're in a derived table
                        const isDerivedTable = blockStack.some(block => block.type === 'derived_table');
                        
                        // Check if this is a main SQL keyword
                        const isMainSqlKeyword = /^\s*(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|JOIN|UNION)/i.test(formattedLine);
                        
                        // Calculate SQL indentation
                        let effectiveIndent = sqlBlockIndent + 1; // Default: one level deeper than the sql property
                        
                        // For derived tables, use special indentation rules
                        if (isDerivedTable) {
                            if (isMainSqlKeyword) {
                                // Main SQL keywords: view(1) + derived_table(1) + sql(1) = 3 levels
                                effectiveIndent = 3;
                            } else {
                                // Non-main SQL lines: view(1) + derived_table(1) + sql(1) + content(1) = 4 levels  
                                effectiveIndent = 4;
                            }
                        } else {
                            // For regular SQL blocks, add extra indentation for non-main keywords
                            if (!isMainSqlKeyword) {
                                effectiveIndent = sqlBlockIndent + 2;
                            }
                        }
                        
                        formattedLine = formattedLine.trimStart();
                        currentView!.nonFieldBlocks.push(this.indentString.repeat(effectiveIndent) + formattedLine);
                    }
                    // Regular property lines
                    else if (trimmedLine.includes(':') && !trimmedLine.endsWith('{')) {
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
     * Check if a comment is a formatter-generated comment separator
     */
    private isFormatterGeneratedComment(comment: string): boolean {
        // Match patterns like "# ----- Dimensions -----" or "# ----- End of Dimensions -----"
        return /^#\s*-----\s*.*\s*-----\s*$/.test(comment);
    }
    
    /**
     * Format a view with its fields
     */
    private formatView(view: LookMLView, output: string[]): void {
        // Add view header
        for (const line of view.header) {
            output.push(line);
        }
        
        // Handle view-level comments and properties (non-field blocks) BEFORE organizing fields
        let nonEmptyNonFieldBlocks = view.nonFieldBlocks.filter(line => {
            const trimmed = line.trim();
            // Filter out formatter-generated comment separators to prevent duplication
            return trimmed.length > 0 && !this.isFormatterGeneratedComment(trimmed);
        });
        if (nonEmptyNonFieldBlocks.length > 0) {
            // Add view-level content with proper indentation
            for (const line of nonEmptyNonFieldBlocks) {
                let trimmedLine = line.trim();
                
                // Check if this is a comment
                if (trimmedLine.startsWith('#')) {
                    // View-level comment - preserve original position
                    output.push(this.indentString.repeat(1) + trimmedLine);
                } else if (trimmedLine.includes(':') && !trimmedLine.includes('{')) {
                    // It's a top-level property in the view, indent by one level
                    output.push(this.indentString.repeat(1) + trimmedLine);
                } else {
                    // Preserve existing indentation for other content
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
        
        // Add a blank line before any sections if there are fields to organize
        let hasAddedFirstSection = false;
        
        // Add filters section
        if (filters.length > 0) {
            if (!hasAddedFirstSection) {
                output.push('');
                hasAddedFirstSection = true;
            }
            this.addFieldSection(output, filters, "Filters", fieldIndent);
        }
        
        // Add parameters section
        if (parameters.length > 0) {
            if (!hasAddedFirstSection) {
                output.push('');
                hasAddedFirstSection = true;
            }
            this.addFieldSection(output, parameters, "Parameters", fieldIndent);
        }
        
        // Add dimensions section
        if (dimensions.length > 0 || dimensionGroups.length > 0) {
            if (!hasAddedFirstSection) {
                output.push('');
                hasAddedFirstSection = true;
            }
            this.addFieldSection(output, [...dimensions, ...dimensionGroups], "Dimensions", fieldIndent);
        }
        
        // Add measures section
        if (measures.length > 0) {
            if (!hasAddedFirstSection) {
                output.push('');
                hasAddedFirstSection = true;
            }
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
        
        // Check if the section header already exists in the output to avoid duplicates
        const sectionHeader = `# ----- ${sectionName} -----`;
        const indentedSectionHeader = this.indentString.repeat(indentLevel) + sectionHeader;
        
        const isHeaderAlreadyPresent = output.some(line => line.trim() === sectionHeader);
        
        // Add section header if grouping is enabled and not already present
        if (this.groupFieldsByType && !isHeaderAlreadyPresent) {
            output.push(indentedSectionHeader);
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
        
        // Add section footer if grouping is enabled and not already present
        if (this.groupFieldsByType) {
            const sectionFooter = `# ----- End of ${sectionName} -----`;
            const indentedSectionFooter = this.indentString.repeat(indentLevel) + sectionFooter;
            
            const isFooterAlreadyPresent = output.some(line => line.trim() === sectionFooter);
            if (!isFooterAlreadyPresent) {
                output.push(indentedSectionFooter);
            }
        }
    }
    
    /**
     * Helper to get the last non-empty line from output array
     */
    private getLastNonEmptyLine(output: string[]): string {
        for (let i = output.length - 1; i >= 0; i--) {
            if (output[i].trim() !== '') {
                return output[i];
            }
        }
        return '';
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
            
            // Check for SQL or HTML block start
            if (!inSqlBlock && 
                (trimmedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value|html)\s*:\s*$/) || 
                 (trimmedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value|html)\s*:/) && 
                  !trimmedLine.match(/\{/) && !inSqlBlock))) {
                // Format the SQL/HTML property with proper spacing
                const formattedProperty = this.formatLookMLProperty(trimmedLine);
                output.push(this.indentString.repeat(nestedIndentLevel) + formattedProperty);
                inSqlBlock = true;
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
            
            // Handle SQL/HTML content
            if (inSqlBlock) {
                // For HTML content, preserve liquid tags and apply minimal formatting
                let formattedLine = trimmedLine;
                
                // Check if this is HTML content vs SQL content
                const isHtmlContent = field.rawContent.some(line => 
                    line.trim().match(/\bhtml\s*:\s*$/)
                );
                
                if (isHtmlContent) {
                    // For HTML blocks, apply minimal formatting - just preserve structure
                    // Don't format SQL keywords in HTML content
                    if (trimmedLine.includes("color:")) {
                        // Fix CSS formatting - add space after colon
                        formattedLine = trimmedLine.replace(/color:(\w+)/g, "color: $1");
                    }
                } else {
                    // Format SQL keywords if it's not a special template line
                    if (!trimmedLine.includes("{%") && 
                        !trimmedLine.includes("{{") && 
                        !trimmedLine.includes("${")) {
                        formattedLine = this.formatSqlKeywords(trimmedLine);
                    } else if (trimmedLine.includes("${")) {
                        // Special handling for SQL with LookML variables
                        formattedLine = this.formatSqlWithLookMLVars(trimmedLine);
                    }
                }
                
                // Check if this is inside a derived_table
                const isDerivedTable = field.parentBlocks && field.parentBlocks.some(block => block.type === 'derived_table');
                
                // Check if this is a main SQL keyword
                const isMainSqlKeyword = /^\s*(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|JOIN|UNION|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|OUTER JOIN)/i.test(formattedLine);
                
                // Calculate proper SQL indentation
                let sqlIndent = nestedIndentLevel + 1; // Default: one level deeper than the sql property
                
                // For derived tables, use special indentation rules
                if (isDerivedTable) {
                    if (isMainSqlKeyword) {
                        // Main SQL keywords: view(1) + derived_table(1) + sql(1) = 3 levels
                        sqlIndent = 3;
                    } else {
                        // Non-main SQL lines: view(1) + derived_table(1) + sql(1) + content(1) = 4 levels
                        sqlIndent = 4;
                    }
                } else {
                    // For regular SQL blocks, add extra indentation for non-main keywords
                    if (!isMainSqlKeyword) {
                        sqlIndent = nestedIndentLevel + 2;
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
                let propValue = line.substring(colonIndex + 1).trim();
                
                // Handle SQL terminators - ensure space before ;;
                if (propValue.endsWith(';;')) {
                    if (!propValue.endsWith(' ;;')) {
                        propValue = propValue.slice(0, -2).trim() + ' ;;';
                    }
                }
                
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
            
            // Check for SQL or HTML block start
            if (!inSqlBlock && 
                (trimmedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value|html)\s*:\s*$/) || 
                 (trimmedLine.match(/\b(sql|sql_on|sql_where|sql_always_where|sql_trigger_value|html)\s*:/) && 
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
                    formattedLines.push(this.indentString.repeat(sqlBlockIndent) + formattedSql + ' ;;');
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
                
                // Check if this is a main SQL keyword
                const isMainSqlKeyword = /^\s*(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|JOIN|UNION|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|OUTER JOIN)/i.test(trimmedLine);
                
                // Check if we're in a derived_table context
                const isDerivedTable = blockStack.length > 0 && blockStack.some(block => block.type === 'derived_table');
                
                // Calculate SQL indentation
                let effectiveIndent = sqlBlockIndent + 1; // Base SQL indent is one level deeper than the sql property
                
                // For derived tables, use special indentation rules
                if (isDerivedTable) {
                    if (isMainSqlKeyword) {
                        // Main SQL keywords: view(1) + derived_table(1) + sql(1) = 3 levels
                        effectiveIndent = 3;
                    } else {
                        // Non-main SQL lines: view(1) + derived_table(1) + sql(1) + content(1) = 4 levels
                        effectiveIndent = 4;
                    }
                } else {
                    // For regular SQL blocks, add extra indentation for non-main keywords
                    if (!isMainSqlKeyword) {
                        effectiveIndent = sqlBlockIndent + 2;
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
                    if (!formattedLine.endsWith(' ;;')) {
                        const parts = formattedLine.split(';;');
                        const propContent = parts[0].trim();
                        formattedLine = propContent + ' ;;';
                    }
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