import * as vscode from "vscode";
import { createLookMLFormattingProvider } from "./formatter";
import { LookMLLinter } from "./linter";
import { registerLookMLCodeActionProvider } from "./linter/actions";
import { registerLookMLHoverProvider } from "./hover";

// Define LookML completion items by context
const LOOKML_TOP_LEVEL = [
    "view", "explore", "model", "include", "datagroup", "access_grant"
];

const LOOKML_VIEW_PROPERTIES = [
    "derived_table", "sql_table_name", "extends", "extension", "required_access_grants", 
    "dimension", "dimension_group", "measure", "filter", "parameter", "set"
];

const LOOKML_DIMENSION_PROPERTIES = [
    "type", "sql", "label", "group_label", "description", "hidden", "value_format", 
    "value_format_name", "html", "drill_fields", "primary_key", "alpha_sort"
];

const LOOKML_MEASURE_PROPERTIES = [
    "type", "sql", "label", "group_label", "description", "hidden", "value_format", 
    "value_format_name", "html", "drill_fields", "filters"
];

const LOOKML_EXPLORE_PROPERTIES = [
    "view_name", "label", "description", "join", "always_filter", "conditionally_filter",
    "fields", "from", "view_label", "group_label", "extends", "sql_always_where", "required_access_grants"
];

const LOOKML_DERIVED_TABLE_PROPERTIES = [
    "sql", "sql_trigger_value", "persist_for", "cluster_keys", "indexes", 
    "distribution", "partition_keys", "datagroup_trigger", "create_process"
];

const LOOKML_TYPE_VALUES = [
    "string", "number", "count", "sum", "average", "date", "time", "datetime", 
    "tier", "duration", "zipcode", "yesno", "list", "percent_rank", "percentile"
];

export function activate(context: vscode.ExtensionContext) {
    console.log('LookML Support extension is now active!');

    // Register the advanced formatting provider
    const lookmlFormattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
        "lookml", 
        createLookMLFormattingProvider()
    );

    context.subscriptions.push(lookmlFormattingProvider);

    // Initialize and register the LookML linter
    const linter = new LookMLLinter();
    context.subscriptions.push(linter);
    
    // Register code actions for the linter
    registerLookMLCodeActionProvider(context);
    
    // Register command to disable a rule
    const disableRuleCommand = vscode.commands.registerCommand('lookml.disableRule', async (ruleId: string) => {
        const config = vscode.workspace.getConfiguration('lookml');
        const disabledRules = config.get<string[]>('linter.disabledRules', []);
        
        if (!disabledRules.includes(ruleId)) {
            disabledRules.push(ruleId);
            await config.update('linter.disabledRules', disabledRules, vscode.ConfigurationTarget.Workspace);
            
            // Show confirmation message
            vscode.window.showInformationMessage(`Disabled LookML linting rule: ${ruleId}`);
        }
    });
    
    context.subscriptions.push(disableRuleCommand);
    
    // Run the linter on startup for all open documents
    linter.lintAllDocuments();

    // Register completion provider
    const lookmlCompletionProvider = vscode.languages.registerCompletionItemProvider(
        "lookml",
        {
            provideCompletionItems(document, position, token, context) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                const completionItems: vscode.CompletionItem[] = [];
                
                // Determine context for providing completions
                if (isTopLevel(document, position)) {
                    // Top level completions
                    addCompletions(completionItems, LOOKML_TOP_LEVEL, vscode.CompletionItemKind.Class);
                }
                
                // Check if we're in a view block
                if (isInBlock(document, position, "view:")) {
                    if (!linePrefix.trim().includes(":")) {
                        // Completions for view properties when no colon exists on line
                        addCompletions(completionItems, LOOKML_VIEW_PROPERTIES, vscode.CompletionItemKind.Property);
                    }
                }
                
                // Check if we're in a dimension block
                if (isInBlock(document, position, "dimension:") || isInBlock(document, position, "dimension_group:")) {
                    if (!linePrefix.trim().includes(":")) {
                        // Completions for dimension properties when no colon exists on line
                        addCompletions(completionItems, LOOKML_DIMENSION_PROPERTIES, vscode.CompletionItemKind.Property);
                    }
                }
                
                // Check if we're in a measure block
                if (isInBlock(document, position, "measure:")) {
                    if (!linePrefix.trim().includes(":")) {
                        // Completions for measure properties when no colon exists on line
                        addCompletions(completionItems, LOOKML_MEASURE_PROPERTIES, vscode.CompletionItemKind.Property);
                    }
                }
                
                // Check if we're in an explore block
                if (isInBlock(document, position, "explore:")) {
                    if (!linePrefix.trim().includes(":")) {
                        // Completions for explore properties when no colon exists on line
                        addCompletions(completionItems, LOOKML_EXPLORE_PROPERTIES, vscode.CompletionItemKind.Property);
                    }
                }
                
                // Check if we're in a derived_table block
                if (isInBlock(document, position, "derived_table:")) {
                    if (!linePrefix.trim().includes(":")) {
                        // Completions for derived_table properties when no colon exists on line
                        addCompletions(completionItems, LOOKML_DERIVED_TABLE_PROPERTIES, vscode.CompletionItemKind.Property);
                    }
                }
                
                // Completions after "type:" for dimension types
                if (linePrefix.match(/\btype\s*:\s*$/) && 
                   (isInBlock(document, position, "dimension:") || 
                    isInBlock(document, position, "dimension_group:") || 
                    isInBlock(document, position, "measure:"))) {
                    addCompletions(completionItems, LOOKML_TYPE_VALUES, vscode.CompletionItemKind.Enum);
                }
                
                // Field references (${field_name})
                if (linePrefix.match(/\$\{\w*$/)) {
                    // Extract view fields from the document
                    const dimensionFields = extractFields(document, "dimension:");
                    const measureFields = extractFields(document, "measure:");
                    const allFields = [...dimensionFields, ...measureFields];
                    
                    addCompletions(completionItems, allFields, vscode.CompletionItemKind.Field, "${$1}");
                }
                
                return completionItems;
            }
        },
        // Trigger characters
        ".", ":", "{", "$"
    );
    
    context.subscriptions.push(lookmlCompletionProvider);
    
    // Register the hover provider
    registerLookMLHoverProvider(context);
}

// Helper functions for completion provider

/**
 * Checks if the cursor is at the top level of a LookML file
 */
function isTopLevel(document: vscode.TextDocument, position: vscode.Position): boolean {
    // Simple implementation - check if the line is not indented
    const line = document.lineAt(position).text;
    return line.trimLeft() === line;
}

/**
 * Determines if cursor is within a specific block type
 */
function isInBlock(document: vscode.TextDocument, position: vscode.Position, blockType: string): boolean {
    let currentLine = position.line;
    let currentIndent = document.lineAt(currentLine).firstNonWhitespaceCharacterIndex;
    let foundBlockStart = false;
    
    // Search backwards until we find the block start or reach the top of the file
    while (currentLine >= 0) {
        const line = document.lineAt(currentLine).text;
        const lineIndent = line.search(/\S|$/);
        
        // If we find a line with less indentation, we've exited the current block
        if (lineIndent < currentIndent && foundBlockStart) {
            return false;
        }
        
        // Check if this line starts the block we're looking for
        if (line.trim().startsWith(blockType) && line.includes("{")) {
            return true;
        }
        
        // If we find a different block start at the same indentation, this isn't our block
        if (lineIndent === currentIndent && line.includes("{") && !foundBlockStart) {
            foundBlockStart = true;
        }
        
        currentLine--;
    }
    
    return false;
}

/**
 * Adds a list of items to the completion items array
 */
function addCompletions(
    items: vscode.CompletionItem[], 
    completions: string[], 
    kind: vscode.CompletionItemKind,
    insertTextFormat?: string
) {
    for (const completion of completions) {
        const item = new vscode.CompletionItem(completion, kind);
        
        if (insertTextFormat) {
            item.insertText = new vscode.SnippetString(insertTextFormat.replace('$1', completion));
        }
        
        // Add documentation for common items
        if (kind === vscode.CompletionItemKind.Property) {
            item.detail = `${completion}: ...`;
            
            // Add documentation for well-known properties
            if (completion === "type") {
                item.documentation = "Specifies the data type for this field.";
            } else if (completion === "sql") {
                item.documentation = "SQL expression that defines this field.";
            } else if (completion === "label") {
                item.documentation = "User-facing name for this field in the Looker UI.";
            } else if (completion === "primary_key") {
                item.documentation = "Marks this dimension as a primary key for the view.";
            }
        }
        
        items.push(item);
    }
}

/**
 * Extract field names from the document based on a given field type
 */
function extractFields(document: vscode.TextDocument, fieldType: string): string[] {
    const fields: string[] = [];
    const text = document.getText();
    const regex = new RegExp(`${fieldType.replace(":", "\\:\\s*")}([a-zA-Z0-9_]+)\\s*\\{`, "g");
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
            fields.push(match[1]);
        }
    }
    
    return fields;
}

export function deactivate() {}