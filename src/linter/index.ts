import * as vscode from 'vscode';
import { getLookMLDiagnostics } from './diagnostics';

/**
 * Manages LookML linting capabilities based on the Look At Me Sideways (LAMS) rules
 */
export class LookMLLinter implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private documentListener: vscode.Disposable;
  private configChangeListener: vscode.Disposable;
  private saveListener: vscode.Disposable;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lookml');
    
    // Listen for document changes
    this.documentListener = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.languageId === 'lookml') {
        this.lintDocument(e.document);
      }
    });
    
    // Listen for document saves
    this.saveListener = vscode.workspace.onDidSaveTextDocument(document => {
      if (document.languageId === 'lookml') {
        this.lintDocument(document);
      }
    });
    
    // Listen for configuration changes
    this.configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('lookml.linter')) {
        this.lintAllDocuments();
      }
    });
  }

  /**
   * Lint all open LookML documents
   */
  public lintAllDocuments(): void {
    vscode.workspace.textDocuments.forEach(document => {
      if (document.languageId === 'lookml') {
        this.lintDocument(document);
      }
    });
  }

  /**
   * Lint a specific LookML document
   */
  public async lintDocument(document: vscode.TextDocument): Promise<void> {
    // Check if linting is enabled in settings
    const config = vscode.workspace.getConfiguration('lookml');
    const lintingEnabled = config.get<boolean>('linter.enabled', true);
    
    if (!lintingEnabled) {
      this.diagnosticCollection.delete(document.uri);
      return;
    }

    try {
      // Get diagnostics from the LAMS-based linter
      const diagnostics = await getLookMLDiagnostics(document);
      
      // Update the diagnostics for this document
      this.diagnosticCollection.set(document.uri, diagnostics);
    } catch (error) {
      console.error('Error during LookML linting:', error);
      // If linting fails, clear diagnostics to prevent stale data
      this.diagnosticCollection.delete(document.uri);
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.diagnosticCollection.dispose();
    this.documentListener.dispose();
    this.configChangeListener.dispose();
    this.saveListener.dispose();
  }
}