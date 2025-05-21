import * as vscode from 'vscode';
import { RuleViolation } from './types';

/**
 * Register code action providers for LookML linting violations
 */
export function registerLookMLCodeActionProvider(context: vscode.ExtensionContext): void {
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    'lookml',
    new LookMLCodeActionProvider(),
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }
  );
  
  context.subscriptions.push(codeActionProvider);
}

/**
 * Code action provider for LookML linting violations
 */
class LookMLCodeActionProvider implements vscode.CodeActionProvider {
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    // Get all diagnostics at the current position
    const diagnostics = context.diagnostics.filter(
      diagnostic => diagnostic.source === 'LookML Linter'
    );
    
    if (diagnostics.length === 0) {
      return undefined;
    }
    
    const actions: vscode.CodeAction[] = [];
    
    // Process each diagnostic
    for (const diagnostic of diagnostics) {
      const ruleId = diagnostic.code?.toString() || '';
      
      // Generate fixes based on rule ID
      switch (ruleId) {
        case 'k1':
          actions.push(...this.createK1Actions(document, diagnostic, range));
          break;
        case 'e1':
          actions.push(...this.createE1Actions(document, diagnostic, range));
          break;
        case 'f1':
          actions.push(...this.createF1Actions(document, diagnostic));
          break;
      }
      
      // Always add a "disable this rule" action
      actions.push(this.createDisableRuleAction(document, diagnostic, ruleId));
    }
    
    return actions;
  }
  
  /**
   * Create actions for K1 rule violations (primary keys)
   */
  private createK1Actions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const text = document.getText(diagnostic.range);
    
    // If the diagnostic is about a missing primary key
    if (diagnostic.message.includes('missing a primary key')) {
      const action = new vscode.CodeAction(
        'Add primary key dimension',
        vscode.CodeActionKind.QuickFix
      );
      
      // Find the closing bracket of the view
      const viewMatch = /view:\s+([a-zA-Z0-9_]+)\s*\{/.exec(text);
      if (viewMatch) {
        const viewName = viewMatch[1];
        const viewText = document.getText();
        const viewEndIndex = viewText.lastIndexOf('}');
        
        if (viewEndIndex !== -1) {
          const position = document.positionAt(viewEndIndex);
          
          // Create an edit to add a primary key dimension
          action.edit = new vscode.WorkspaceEdit();
          action.edit.insert(
            document.uri,
            new vscode.Position(position.line, 0),
            `\n  dimension: pk {\n    primary_key: yes\n    type: string\n    sql: \${TABLE}.id ;;\n  }\n`
          );
          
          action.diagnostics = [diagnostic];
          actions.push(action);
        }
      }
    }
    
    // If the diagnostic is about a primary key naming convention
    if (diagnostic.message.includes('naming convention')) {
      const dimNameMatch = /dimension "([^"]+)"/.exec(diagnostic.message);
      if (dimNameMatch) {
        const dimName = dimNameMatch[1];
        
        const action = new vscode.CodeAction(
          `Rename dimension to "pk"`,
          vscode.CodeActionKind.QuickFix
        );
        
        // Find the dimension declaration
        const dimMatch = new RegExp(`dimension:\\s*${dimName}\\s*\\{`).exec(document.getText());
        if (dimMatch) {
          const matchStart = document.positionAt(dimMatch.index);
          const matchEnd = document.positionAt(dimMatch.index + dimMatch[0].length);
          
          // Create an edit to rename the dimension
          action.edit = new vscode.WorkspaceEdit();
          action.edit.replace(
            document.uri,
            new vscode.Range(matchStart, matchEnd),
            `dimension: pk {`
          );
          
          action.diagnostics = [diagnostic];
          actions.push(action);
        }
      }
    }
    
    return actions;
  }
  
  /**
   * Create actions for E1 rule violations (join references)
   */
  private createE1Actions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    
    // Extract the direct table reference from the diagnostic message
    const refMatch = /direct table reference "([^"]+)"/.exec(diagnostic.message);
    if (!refMatch) {
      return actions;
    }
    
    const tableRef = refMatch[1];
    const [tableName, columnName] = tableRef.split('.');
    
    // Create a quick fix to replace the direct reference with a substitution
    const action = new vscode.CodeAction(
      `Replace "${tableRef}" with \${${tableName}.${columnName}}`,
      vscode.CodeActionKind.QuickFix
    );
    
    // Find the exact location of the reference in the document
    const text = document.getText(diagnostic.range);
    const refIndex = text.indexOf(tableRef);
    
    if (refIndex !== -1) {
      // Calculate the position within the range
      const startPos = document.positionAt(document.offsetAt(diagnostic.range.start) + refIndex);
      const endPos = document.positionAt(document.offsetAt(startPos) + tableRef.length);
      
      // Create an edit to replace the direct reference
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(
        document.uri,
        new vscode.Range(startPos, endPos),
        `\${${tableName}.${columnName}}`
      );
      
      action.diagnostics = [diagnostic];
      actions.push(action);
    }
    
    return actions;
  }
  
  /**
   * Create actions for F1 rule violations (cross-view references)
   */
  private createF1Actions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    
    // For F1 violations, we add an action to create a proper join
    // but implementing this would require more context than we have here
    const action = new vscode.CodeAction(
      'Create a proper join for this reference',
      vscode.CodeActionKind.QuickFix
    );
    
    // This is a complex action that would require more context,
    // so we mark it as not implemented
    action.isPreferred = false;
    action.diagnostics = [diagnostic];
    
    // This is just a placeholder - a real implementation would need to know
    // the current view, the explore it's in, and create a proper join
    // Additionally, it would need to consider existing joins
    
    actions.push(action);
    
    return actions;
  }
  
  /**
   * Create an action to disable a rule in the workspace settings
   */
  private createDisableRuleAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    ruleId: string
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Disable ${ruleId} rule`,
      vscode.CodeActionKind.QuickFix
    );
    
    action.command = {
      title: `Disable ${ruleId} rule`,
      command: 'lookml.disableRule',
      arguments: [ruleId]
    };
    
    action.diagnostics = [diagnostic];
    
    return action;
  }
}