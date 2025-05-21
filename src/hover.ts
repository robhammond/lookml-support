import * as vscode from 'vscode';
import { formatDocumentation, LOOKML_DOCS } from './documentation';

/**
 * Creates and registers a hover provider for LookML files
 */
export function createLookMLHoverProvider(): vscode.HoverProvider {
    return {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            if (!range) return null;
            
            const word = document.getText(range).trim();
            
            // Check if the word is a LookML element with documentation
            if (LOOKML_DOCS[word]) {
                return new vscode.Hover(formatDocumentation(word) as vscode.MarkdownString);
            }
            
            // For property values like "type: string", provide hover info for "string"
            const line = document.lineAt(position.line).text;
            const typeMatch = line.match(/type\s*:\s*(\w+)/);
            if (typeMatch && typeMatch[1] === word && LOOKML_DOCS[word]) {
                return new vscode.Hover(formatDocumentation(word) as vscode.MarkdownString);
            }
            
            // Provide hover info for property names (e.g., "type: string" -> hover on "type")
            const propertyMatch = line.match(/(\w+)\s*:/);
            if (propertyMatch && propertyMatch[1] === word && LOOKML_DOCS[word]) {
                return new vscode.Hover(formatDocumentation(word) as vscode.MarkdownString);
            }
            
            // For block definitions like "dimension: id {", provide hover for "dimension"
            const blockMatch = line.match(/(\w+)\s*:\s*\w+\s*\{/);
            if (blockMatch && blockMatch[1] === word && LOOKML_DOCS[word]) {
                return new vscode.Hover(formatDocumentation(word) as vscode.MarkdownString);
            }
            
            return null;
        }
    };
}

/**
 * Registers the LookML hover provider with VS Code
 */
export function registerLookMLHoverProvider(context: vscode.ExtensionContext): void {
    const hoverProvider = vscode.languages.registerHoverProvider(
        'lookml',
        createLookMLHoverProvider()
    );
    
    context.subscriptions.push(hoverProvider);
}