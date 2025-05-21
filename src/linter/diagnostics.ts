import * as vscode from 'vscode';
import { applyRules } from './rules';
import { parseLookML, parseLookMLSync } from './parser';
import { LookMLRule, RuleViolation, ParsedLookML } from './types';

/**
 * Generate VS Code diagnostics based on LookML rule violations
 */
export async function getLookMLDiagnostics(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
  const content = document.getText();
  
  // Get enabled rules from configuration
  const config = vscode.workspace.getConfiguration('lookml');
  const enabledRules = config.get<string[]>('linter.rules', [
    'k1', // Primary key naming
    'e1', // Join references
    'f1'  // Cross-view references
  ]);
  
  // Get disabled rules
  const disabledRules = config.get<string[]>('linter.disabledRules', []);
  
  // Filter out explicitly disabled rules
  const activeRules = enabledRules.filter(rule => !disabledRules.includes(rule));
  
  // Try to parse with lookml-parser first (async)
  try {
    const lookmlData = await parseLookML(content);
    
    if (lookmlData) {
      // We got a successful parse from lookml-parser
      return processRulesAndCreateDiagnostics(document, lookmlData, activeRules);
    }
  } catch (error) {
    console.error('Error using lookml-parser:', error);
    // Continue to fallback parser
  }
  
  // Fallback to synchronous parser if lookml-parser failed
  const fallbackData = parseLookMLSync(content);
  return processRulesAndCreateDiagnostics(document, fallbackData, activeRules);
}

/**
 * Process rules and create diagnostics from violations
 */
function processRulesAndCreateDiagnostics(
  document: vscode.TextDocument,
  parsedLookML: ParsedLookML,
  enabledRules: string[]
): vscode.Diagnostic[] {
  // Apply the rules to the parsed LookML
  const violations = applyRules(parsedLookML, enabledRules);
  
  // Convert rule violations to VS Code diagnostics
  return violations.map(violation => createDiagnosticFromViolation(document, violation));
}

/**
 * Convert a rule violation to a VS Code diagnostic
 */
function createDiagnosticFromViolation(
  document: vscode.TextDocument,
  violation: RuleViolation
): vscode.Diagnostic {
  // Try to find the line number for the violation
  let line = violation.line || 0;
  
  // If no line is provided but we have a path, try to locate it in the document
  if (!violation.line && violation.path && violation.path.length > 0) {
    line = findLineByPath(document, violation.path);
  }
  
  // Create a range for the diagnostic
  const range = new vscode.Range(
    new vscode.Position(line, 0),
    new vscode.Position(line, document.lineAt(Math.min(line, document.lineCount - 1)).text.length)
  );
  
  // Create the diagnostic
  const diagnostic = new vscode.Diagnostic(
    range,
    violation.message,
    mapSeverity(violation.severity)
  );
  
  // Add additional metadata
  diagnostic.code = violation.ruleId;
  diagnostic.source = 'LookML Linter';
  
  return diagnostic;
}

/**
 * Try to find a line number based on a path array
 * e.g. ['views', 'my_view', 'dimensions', 'my_dimension']
 */
function findLineByPath(document: vscode.TextDocument, path: string[]): number {
  try {
    const text = document.getText();
    const lines = text.split('\n');
    
    // Build up patterns to search for
    let patterns: RegExp[] = [];
    
    // Handle basic patterns
    if (path[0] === 'views' && path.length >= 2) {
      // Looking for a view
      patterns.push(new RegExp(`view:\\s+${path[1]}\\s*\\{`));
      
      if (path.length >= 4 && path[2] === 'dimensions') {
        // Looking for a dimension within a view
        patterns.push(new RegExp(`dimension:\\s+${path[3]}\\s*\\{`));
      } else if (path.length >= 4 && path[2] === 'measures') {
        // Looking for a measure within a view
        patterns.push(new RegExp(`measure:\\s+${path[3]}\\s*\\{`));
      } else if (path.length >= 4 && path[2] === 'filters') {
        // Looking for a filter within a view
        patterns.push(new RegExp(`filter:\\s+${path[3]}\\s*\\{`));
      }
    } else if (path[0] === 'explores' && path.length >= 2) {
      // Looking for an explore
      patterns.push(new RegExp(`explore:\\s+${path[1]}\\s*\\{`));
      
      if (path.length >= 4 && path[2] === 'joins') {
        // Looking for a join within an explore
        patterns.push(new RegExp(`join:\\s+${path[3]}\\s*\\{`));
      }
    }
    
    // If we have patterns, try to find them in the document
    if (patterns.length > 0) {
      let currentDepth = 0;
      let matches: number[] = [];
      
      // Find all matches for the current pattern
      for (let i = 0; i < lines.length; i++) {
        if (patterns[currentDepth].test(lines[i])) {
          matches.push(i);
          currentDepth++;
          
          // If we've matched all patterns, return the last match
          if (currentDepth >= patterns.length) {
            return matches[matches.length - 1];
          }
          
          // If we have more patterns, reset the search but start from the current match
          if (currentDepth < patterns.length) {
            i = matches[matches.length - 1];
          }
        }
      }
      
      // If we found at least one match, return it
      if (matches.length > 0) {
        return matches[0];
      }
    }
  } catch (error) {
    console.error('Error finding line by path:', error);
  }
  
  // Default to line 0 if we couldn't find a match
  return 0;
}

/**
 * Map rule severity to VS Code diagnostic severity
 */
function mapSeverity(severity: string): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    case 'hint':
      return vscode.DiagnosticSeverity.Hint;
    default:
      return vscode.DiagnosticSeverity.Warning;
  }
}