import * as fs from 'fs';
import * as path from 'path';
import { LookMLFormatter } from '../formatter';

// Create a document class for testing
class MockDocument {
    private filePath: string;
    
    constructor(filePath: string) {
        this.filePath = filePath;
    }
    
    getText(): string {
        return fs.readFileSync(this.filePath, 'utf8');
    }
    
    positionAt(offset: number): any {
        const content = this.getText();
        const lines = content.substring(0, offset).split('\n');
        return {
            line: lines.length - 1,
            character: lines[lines.length - 1].length
        };
    }
}

// Mock TextEdit
class MockTextEdit {
    static replace(range: any, newText: string) {
        return { range, newText };
    }
}

// Mock Range
class MockRange {
    constructor(start: any, end: any) {
        this.start = start;
        this.end = end;
    }
    start: any;
    end: any;
}

// Mock VS Code workspace
const mockWorkspace = {
    getConfiguration: () => ({
        get: (key: string, defaultValue: any) => {
            if (key === 'formatter.groupFieldsByType') return false;
            if (key === 'formatter.sortFields') return false;
            return defaultValue;
        }
    })
};

// Set up global vscode mock
(global as any).vscode = {
    TextEdit: MockTextEdit,
    Range: MockRange,
    workspace: mockWorkspace
};

async function runTest() {
    // Get paths
    const examplePath = path.join(__dirname, './fixtures/test_derived_table.view.lkml');
    const outputPath = path.join(__dirname, './fixtures/formatted_derived_table.view.lkml');
    
    // Create a document
    const document = new MockDocument(examplePath);
    
    // Format the document
    const formatter = new LookMLFormatter({ tabSize: 2, insertSpaces: true });
    const edits = formatter.format(document as any);
    
    if (edits && edits.length > 0) {
        // Extract the formatted text
        const formattedText = edits[0].newText;
        
        // Save the formatted output
        fs.writeFileSync(outputPath, formattedText);
        
        // Print results
        console.log('Formatted output saved to:', outputPath);
        
        // Check SQL formatting
        const lines = formattedText.split('\n');
        let inSqlBlock = false;
        let sqlLines: string[] = [];
        
        for (const line of lines) {
            if (line.trim() === 'sql:') {
                inSqlBlock = true;
                continue;
            }
            
            if (inSqlBlock && line.trim() === ';;') {
                inSqlBlock = false;
                continue;
            }
            
            if (inSqlBlock) {
                sqlLines.push(line);
            }
        }
        
        // Print the formatted SQL block
        console.log('\nFormatted SQL block:');
        console.log(sqlLines.join('\n'));
        
        // Check indentation patterns
        const selectLineIndent = sqlLines[0].search(/\S/);
        const columnLineIndent = sqlLines[1].search(/\S/);
        
        console.log('\nSQL indentation check:');
        console.log(`SELECT line indent: ${selectLineIndent} spaces`);
        console.log(`Column line indent: ${columnLineIndent} spaces`);
        console.log(`Difference: ${columnLineIndent - selectLineIndent} spaces (should be ${formatter.indentSize})`);
        
        if (columnLineIndent - selectLineIndent === formatter.indentSize) {
            console.log('\nPASS: Columns are indented correctly relative to SQL keywords');
        } else {
            console.log('\nFAIL: Column indentation is incorrect');
        }
    } else {
        console.log('No formatting changes needed or error occurred.');
    }
}

// Run the test
runTest();