import { LookMLRule, ParsedLookML, RuleViolation } from './types';

// Collection of all available rules
const ALL_RULES: Record<string, LookMLRule> = {
  'k1': {
    id: 'k1',
    description: 'Primary keys should be explicitly defined and follow naming conventions',
    check: checkPrimaryKeys
  },
  'e1': {
    id: 'e1',
    description: 'Explore joins should use substitution operators instead of direct table references',
    check: checkJoinReferences
  },
  'f1': {
    id: 'f1',
    description: 'Fields should not reference other views directly',
    check: checkCrossViewReferences
  }
};

/**
 * Apply the specified rules to LookML content
 */
export function applyRules(lookml: ParsedLookML, enabledRuleIds: string[]): RuleViolation[] {
  const violations: RuleViolation[] = [];
  
  // Only apply enabled rules
  const rulesToApply = enabledRuleIds
    .filter(id => ALL_RULES[id])
    .map(id => ALL_RULES[id]);
  
  // Run each rule
  for (const rule of rulesToApply) {
    try {
      const ruleViolations = rule.check(lookml);
      violations.push(...ruleViolations);
    } catch (error) {
      console.error(`Error applying rule ${rule.id}:`, error);
    }
  }
  
  return violations;
}

/**
 * Rule K1: Check primary key naming and definition
 */
function checkPrimaryKeys(lookml: ParsedLookML): RuleViolation[] {
  const violations: RuleViolation[] = [];
  
  // Skip if no views
  if (!lookml.views) {
    return violations;
  }
  
  // Check each view
  for (const viewName in lookml.views) {
    const view = lookml.views[viewName];
    
    // Skip views without a derived table or SQL table name
    if (!view.derived_table && !view.sql_table_name) {
      continue;
    }
    
    // Find primary key dimensions
    const pkDimensions = Object.entries(view.dimensions || {})
      .filter(([_, dim]) => dim.primary_key === true);
    
    // If no primary keys found, add a violation
    if (pkDimensions.length === 0) {
      violations.push({
        ruleId: 'k1',
        message: `View "${viewName}" is missing a primary key dimension`,
        severity: 'warning',
        path: ['views', viewName]
      });
      continue;
    }
    
    // Check PK naming convention
    for (const [dimName, dim] of pkDimensions) {
      if (!dimName.match(/^pk\d*$/i)) {
        violations.push({
          ruleId: 'k1',
          message: `Primary key dimension "${dimName}" in view "${viewName}" should follow naming convention (pk)`,
          severity: 'warning',
          path: ['views', viewName, 'dimensions', dimName]
        });
      }
    }
  }
  
  return violations;
}

/**
 * Rule E1: Check explore join references
 */
function checkJoinReferences(lookml: ParsedLookML): RuleViolation[] {
  const violations: RuleViolation[] = [];
  
  // Skip if no explores
  if (!lookml.explores) {
    return violations;
  }
  
  // Check each explore
  for (const exploreName in lookml.explores) {
    const explore = lookml.explores[exploreName];
    
    // Skip explores without joins
    if (!explore.joins) {
      continue;
    }
    
    // Check each join
    for (const joinName in explore.joins) {
      const join = explore.joins[joinName];
      
      // Skip joins without sql_on
      if (!join.sql_on) {
        continue;
      }
      
      // Remove LookML specific syntax
      const cleanedSql = join.sql_on
        .replace(/\${[^}]+}/g, '') // Remove ${} references
        .replace(/\{\{[^}]+\}\}/g, '') // Remove {{}} liquid tags
        .replace(/\{%[^%]+%\}/g, ''); // Remove {% %} liquid tags
      
      // Check for direct table references
      const directTablePattern = /[a-zA-Z0-9._]+\.[a-zA-Z0-9 ._]+/g;
      let match;
      
      while ((match = directTablePattern.exec(cleanedSql)) !== null) {
        const reference = match[0];
        
        // Skip references starting with 'safe.' (BigQuery)
        if (reference.startsWith('safe.')) {
          continue;
        }
        
        violations.push({
          ruleId: 'e1',
          message: `Join "${joinName}" in explore "${exploreName}" uses direct table reference "${reference}" - use \${} substitution instead`,
          severity: 'warning',
          path: ['explores', exploreName, 'joins', joinName, 'sql_on']
        });
      }
    }
  }
  
  return violations;
}

/**
 * Rule F1: Check cross-view references in fields
 */
function checkCrossViewReferences(lookml: ParsedLookML): RuleViolation[] {
  const violations: RuleViolation[] = [];
  
  // Skip if no views
  if (!lookml.views) {
    return violations;
  }
  
  // Check each view
  for (const viewName in lookml.views) {
    const view = lookml.views[viewName];
    
    // Skip views without a derived table or SQL table name
    if (!view.derived_table && !view.sql_table_name) {
      continue;
    }
    
    // Check dimensions
    checkFieldsForCrossReferences(view.dimensions || {}, viewName, 'dimension', violations);
    
    // Check dimension groups
    checkFieldsForCrossReferences(view.dimension_groups || {}, viewName, 'dimension_group', violations);
    
    // Check measures
    checkFieldsForCrossReferences(view.measures || {}, viewName, 'measure', violations);
    
    // Check filters
    checkFieldsForCrossReferences(view.filters || {}, viewName, 'filter', violations);
  }
  
  return violations;
}

/**
 * Helper to check fields for cross-view references
 */
function checkFieldsForCrossReferences(
  fields: Record<string, any>,
  viewName: string,
  fieldType: string,
  violations: RuleViolation[]
): void {
  for (const fieldName in fields) {
    const field = fields[fieldName];
    
    // Check SQL field
    if (field.sql) {
      const crossRefs = extractCrossViewReferences(field.sql, viewName);
      
      for (const ref of crossRefs) {
        violations.push({
          ruleId: 'f1',
          message: `${fieldType} "${fieldName}" in view "${viewName}" references another view via "${ref}"`,
          severity: 'warning',
          path: ['views', viewName, fieldType + 's', fieldName, 'sql']
        });
      }
    }
    
    // Check HTML field
    if (field.html) {
      const crossRefs = extractCrossViewReferences(field.html, viewName);
      
      for (const ref of crossRefs) {
        violations.push({
          ruleId: 'f1',
          message: `${fieldType} "${fieldName}" in view "${viewName}" references another view in HTML via "${ref}"`,
          severity: 'warning',
          path: ['views', viewName, fieldType + 's', fieldName, 'html']
        });
      }
    }
  }
}

/**
 * Extract cross-view references from a string
 */
function extractCrossViewReferences(text: string, currentViewName: string): string[] {
  const references: string[] = [];
  
  // Match ${view_name.field_name} pattern
  const pattern = /\${([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)}/g;
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const [, refViewName, refFieldName] = match;
    
    // Skip references to the current view
    if (refViewName === currentViewName) {
      continue;
    }
    
    // Skip references to 'TABLE'
    if (refViewName === 'TABLE') {
      continue;
    }
    
    references.push(`${refViewName}.${refFieldName}`);
  }
  
  return references;
}