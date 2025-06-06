// Mock implementation of the vscode API for testing

export class Position {
    constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
    constructor(public readonly start: Position, public readonly end: Position) {}
}

export class TextEdit {
    constructor(public readonly range: Range, public readonly newText: string) {}

    static replace(range: Range, newText: string): TextEdit {
        return new TextEdit(range, newText);
    }
}

export class TextLine {
    constructor(
        public readonly text: string,
        public readonly lineNumber: number,
        public readonly firstNonWhitespaceCharacterIndex: number,
    ) {}
}

export class TextDocument {
    private _content: string;
    private _lines: string[];

    constructor(content: string, public readonly uri: string = "file:///test.lkml") {
        this._content = content;
        this._lines = content.split(/\r?\n/);
    }

    getText(): string {
        return this._content;
    }

    lineAt(line: number): TextLine {
        const text = this._lines[line];
        const firstNonWhitespace = text.search(/\S|$/);
        return new TextLine(text, line, firstNonWhitespace);
    }

    positionAt(offset: number): Position {
        let line = 0;
        let char = 0;
        let currentOffset = 0;

        while (line < this._lines.length) {
            const lineLength = this._lines[line].length;

            if (currentOffset + lineLength >= offset) {
                // Found the line
                char = offset - currentOffset;
                break;
            }

            // Move to next line (add 1 for the newline character)
            currentOffset += lineLength + 1;
            line++;
        }

        return new Position(line, char);
    }

    offsetAt(position: Position): number {
        let offset = 0;
        for (let i = 0; i < position.line; i++) {
            offset += this._lines[i].length + 1; // +1 for newline
        }
        return offset + position.character;
    }

    get lineCount(): number {
        return this._lines.length;
    }
}

export interface FormattingOptions {
    tabSize: number;
    insertSpaces: boolean;
    [key: string]: any; // Add index signature for compatibility with vscode.FormattingOptions
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3,
}

export class WorkspaceConfiguration {
    private config: Record<string, any>;

    constructor(config: Record<string, any> = {}) {
        this.config = config;
    }

    get<T>(section: string, defaultValue?: T): T {
        const parts = section.split(".");
        let current = this.config;

        for (let i = 0; i < parts.length; i++) {
            if (current[parts[i]] === undefined) {
                return defaultValue as T;
            }
            current = current[parts[i]];
        }

        return current as T;
    }

    update(section: string, value: any, configTarget?: ConfigurationTarget): Promise<void> {
        const parts = section.split(".");
        let current = this.config;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
        return Promise.resolve();
    }
}

export const workspace = {
    getConfiguration(section?: string): WorkspaceConfiguration {
        const defaultConfig = {
            lookml: {
                formatter: {
                    groupFieldsByType: true,
                    sortFields: true,
                },
            },
        };

        return new WorkspaceConfiguration(defaultConfig);
    },
};

export type CancellationToken = {
    isCancellationRequested: boolean;
    onCancellationRequested: (callback: () => void) => void;
};

export const SnippetString = class {
    constructor(public readonly value: string) {}
};

export const CompletionItem = class {
    constructor(public readonly label: string, public readonly kind: number) {}
};

export const CompletionItemKind = {
    Text: 0,
    Method: 1,
    Function: 2,
    Constructor: 3,
    Field: 4,
    Variable: 5,
    Class: 6,
    Interface: 7,
    Module: 8,
    Property: 9,
    Unit: 10,
    Value: 11,
    Enum: 12,
    Keyword: 13,
    Snippet: 14,
    Color: 15,
    File: 16,
    Reference: 17,
    Folder: 18,
    EnumMember: 19,
    Constant: 20,
    Struct: 21,
    Event: 22,
    Operator: 23,
    TypeParameter: 24,
};

export class MarkdownString {
    value: string = '';
    isTrusted: boolean = false;

    constructor(value?: string) {
        if (value) {
            this.value = value;
        }
    }

    appendMarkdown(value: string): MarkdownString {
        this.value += value;
        return this;
    }

    appendText(value: string): MarkdownString {
        // Escape markdown special characters
        const escaped = value.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
        this.value += escaped;
        return this;
    }

    appendCodeblock(value: string, language?: string): MarkdownString {
        this.value += '```' + (language || '') + '\n' + value + '\n```';
        return this;
    }
}
