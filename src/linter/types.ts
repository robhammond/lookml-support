/**
 * Interface for LookML parsed content
 * This matches the structure provided by lookml-parser
 */
export interface ParsedLookML {
  views?: Record<string, LookMLView>;
  explores?: Record<string, LookMLExplore>;
  models?: Record<string, LookMLModel>;
  [key: string]: any;
}

/**
 * Interface for LookML view
 */
export interface LookMLView {
  name?: string;
  sql_table_name?: string;
  derived_table?: {
    sql?: string;
    [key: string]: any;
  };
  dimensions?: Record<string, LookMLField>;
  dimension_groups?: Record<string, LookMLField>;
  measures?: Record<string, LookMLField>;
  filters?: Record<string, LookMLField>;
  [key: string]: any;
}

/**
 * Interface for LookML explore
 */
export interface LookMLExplore {
  name?: string;
  view_name?: string;
  joins?: Record<string, LookMLJoin>;
  [key: string]: any;
}

/**
 * Interface for LookML join
 */
export interface LookMLJoin {
  sql_on?: string;
  relationship?: string;
  view_label?: string;
  [key: string]: any;
}

/**
 * Interface for LookML model
 */
export interface LookMLModel {
  name?: string;
  connection?: string;
  includes?: string[];
  [key: string]: any;
}

/**
 * Interface for LookML field (dimension, measure, etc.)
 */
export interface LookMLField {
  name?: string;
  type?: string;
  sql?: string;
  primary_key?: boolean;
  html?: string;
  label?: string;
  [key: string]: any;
}

/**
 * Interface for a LookML linting rule
 */
export interface LookMLRule {
  id: string;
  description: string;
  check: (lookml: ParsedLookML) => RuleViolation[];
}

/**
 * Interface for a rule violation
 */
export interface RuleViolation {
  ruleId: string;
  message: string;
  path?: string[];
  line?: number;
  severity: string;
  data?: any;
}