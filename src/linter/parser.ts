import * as lookmlParser from 'lookml-parser';
import { ParsedLookML } from './types';

/**
 * Parse LookML content using the lookml-parser npm package
 * 
 * @param lookmlContent The LookML content to parse
 * @returns The parsed LookML object or null if parsing failed
 */
export function parseLookML(lookmlContent: string): Promise<ParsedLookML | null> {
  try {
    // Create a virtual filename for the parser
    const virtualFilename = 'virtual_file.view.lkml';
    
    // Parse the content using lookml-parser
    // Note: lookml-parser expects a map of file content by filename
    const fileContent: Record<string, string> = {
      [virtualFilename]: lookmlContent
    };
    
    // Parse the content - this returns a promise
    return lookmlParser.parseFiles(fileContent, {})
      .then((result: any) => {
        return result as ParsedLookML;
      })
      .catch((error: any) => {
        console.error('LookML parser error:', error);
        return null;
      });
  } catch (error) {
    console.error('Error parsing LookML:', error);
    return Promise.resolve(null);
  }
}

/**
 * Parse LookML content synchronously for immediate use
 * This is a simplified approach for use in VS Code extensions
 * 
 * @param lookmlContent The LookML content to parse
 * @returns The parsed LookML object or a simplified fallback structure
 */
export function parseLookMLSync(lookmlContent: string): ParsedLookML {
  // For synchronous use, we'll use a simplified parser as fallback
  // This ensures the linter can always provide some level of functionality
  
  // Initialize result structure
  const result: ParsedLookML = {
    views: {},
    explores: {},
    models: {}
  };
  
  try {
    // Extract views
    extractViews(lookmlContent, result);
    
    // Extract explores
    extractExplores(lookmlContent, result);
    
    // Extract models
    extractModels(lookmlContent, result);
    
    return result;
  } catch (error) {
    console.error('Error in simplified LookML parser:', error);
    return result;
  }
}

interface SimpleView {
  name: string;
  sql_table_name?: string;
  derived_table?: {
    sql?: string;
    [key: string]: any;
  };
  dimensions?: Record<string, SimpleField>;
  dimension_groups?: Record<string, SimpleField>;
  measures?: Record<string, SimpleField>;
  filters?: Record<string, SimpleField>;
  [key: string]: any;
}

interface SimpleField {
  name: string;
  type?: string;
  sql?: string;
  primary_key?: boolean;
  html?: string;
  label?: string;
  description?: string;
  [key: string]: any;
}

interface SimpleExplore {
  name: string;
  view_name?: string;
  joins?: Record<string, SimpleJoin>;
  [key: string]: any;
}

interface SimpleJoin {
  name: string;
  sql_on?: string;
  relationship?: string;
  view_label?: string;
  [key: string]: any;
}

interface SimpleModel {
  name: string;
  connection?: string;
  includes?: string[];
  [key: string]: any;
}

/**
 * Extract views from LookML content
 */
function extractViews(content: string, result: ParsedLookML): void {
  // Simple regex-based view extraction
  const viewRegex = /view:\s+([a-zA-Z0-9_]+)\s*\{([\s\S]*?)(?=\n\s*view:|\n\s*explore:|\n\s*model:|\s*$)/g;
  let match;
  
  while ((match = viewRegex.exec(content)) !== null) {
    const viewName = match[1];
    const viewContent = match[2];
    
    const view: SimpleView = {
      name: viewName
    };
    
    // Extract sql_table_name
    const sqlTableMatch = viewContent.match(/sql_table_name:\s*([^\n]+)/);
    if (sqlTableMatch) {
      view.sql_table_name = sqlTableMatch[1].trim();
    }
    
    // Extract derived_table
    const derivedTableMatch = viewContent.match(/derived_table:\s*\{([\s\S]*?)(?=\n\s*\})/);
    if (derivedTableMatch) {
      view.derived_table = { sql: '' }; // Initialize with empty SQL
      
      // Extract SQL from derived table
      const sqlMatch = derivedTableMatch[1].match(/sql:\s*([\s\S]*?)(?=\n\s*;;\s*|$)/);
      if (sqlMatch) {
        view.derived_table.sql = sqlMatch[1].trim();
      }
    }
    
    // Extract dimensions
    view.dimensions = extractFields(viewContent, 'dimension');
    
    // Extract dimension groups
    view.dimension_groups = extractFields(viewContent, 'dimension_group');
    
    // Extract measures
    view.measures = extractFields(viewContent, 'measure');
    
    // Extract filters
    view.filters = extractFields(viewContent, 'filter');
    
    if (result.views) {
      result.views[viewName] = view;
    }
  }
}

/**
 * Extract explores from LookML content
 */
function extractExplores(content: string, result: ParsedLookML): void {
  // Simple regex-based explore extraction
  const exploreRegex = /explore:\s+([a-zA-Z0-9_]+)\s*\{([\s\S]*?)(?=\n\s*view:|\n\s*explore:|\n\s*model:|\s*$)/g;
  let match;
  
  while ((match = exploreRegex.exec(content)) !== null) {
    const exploreName = match[1];
    const exploreContent = match[2];
    
    const explore: SimpleExplore = {
      name: exploreName
    };
    
    // Extract view_name
    const viewNameMatch = exploreContent.match(/view_name:\s*([^\n]+)/);
    if (viewNameMatch) {
      explore.view_name = viewNameMatch[1].trim();
    }
    
    // Extract joins
    explore.joins = extractJoins(exploreContent);
    
    if (result.explores) {
      result.explores[exploreName] = explore;
    }
  }
}

/**
 * Extract joins from explore content
 */
function extractJoins(content: string): Record<string, SimpleJoin> {
  const joins: Record<string, SimpleJoin> = {};
  const joinRegex = /join:\s+([a-zA-Z0-9_]+)\s*\{([\s\S]*?)(?=\n\s*join:|\n\s*\})/g;
  let match;
  
  while ((match = joinRegex.exec(content)) !== null) {
    const joinName = match[1];
    const joinContent = match[2];
    
    const join: SimpleJoin = {
      name: joinName
    };
    
    // Extract sql_on
    const sqlOnMatch = joinContent.match(/sql_on:\s*([\s\S]*?)(?=\n\s*[a-zA-Z_]+:|$)/);
    if (sqlOnMatch) {
      join.sql_on = sqlOnMatch[1].trim();
    }
    
    // Extract relationship
    const relationshipMatch = joinContent.match(/relationship:\s*([^\n]+)/);
    if (relationshipMatch) {
      join.relationship = relationshipMatch[1].trim();
    }
    
    joins[joinName] = join;
  }
  
  return joins;
}

/**
 * Extract models from LookML content
 */
function extractModels(content: string, result: ParsedLookML): void {
  // Simple regex-based model extraction
  const modelRegex = /model:\s+([a-zA-Z0-9_]+)\s*\{([\s\S]*?)(?=\n\s*view:|\n\s*explore:|\n\s*model:|\s*$)/g;
  let match;
  
  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const modelContent = match[2];
    
    const model: SimpleModel = {
      name: modelName
    };
    
    // Extract connection
    const connectionMatch = modelContent.match(/connection:\s*([^\n]+)/);
    if (connectionMatch) {
      model.connection = connectionMatch[1].trim();
    }
    
    // Extract includes
    const includesMatch = modelContent.match(/include:\s*"([^"]+)"/g);
    if (includesMatch) {
      model.includes = includesMatch.map(include => {
        const match = include.match(/include:\s*"([^"]+)"/);
        return match ? match[1] : '';
      });
    }
    
    if (result.models) {
      result.models[modelName] = model;
    }
  }
}

/**
 * Extract fields (dimensions, measures, etc.) from view content
 */
function extractFields(content: string, fieldType: string): Record<string, SimpleField> {
  const fields: Record<string, SimpleField> = {};
  const fieldRegex = new RegExp(`${fieldType}:\\s+([a-zA-Z0-9_]+)\\s*\\{([\\s\\S]*?)(?=\\n\\s*${fieldType}:|\\n\\s*dimension:|\\n\\s*dimension_group:|\\n\\s*measure:|\\n\\s*filter:|\\n\\s*\\})`, 'g');
  let match;
  
  while ((match = fieldRegex.exec(content)) !== null) {
    const fieldName = match[1];
    const fieldContent = match[2];
    
    const field: SimpleField = {
      name: fieldName
    };
    
    // Extract type
    const typeMatch = fieldContent.match(/type:\s*([^\n]+)/);
    if (typeMatch) {
      field.type = typeMatch[1].trim();
    }
    
    // Extract SQL
    const sqlMatch = fieldContent.match(/sql:\s*([\s\S]*?)(?=\n\s*[a-zA-Z_]+:|$)/);
    if (sqlMatch) {
      field.sql = sqlMatch[1].trim();
    }
    
    // Extract primary_key
    const pkMatch = fieldContent.match(/primary_key:\s*(yes|true|no|false)/i);
    if (pkMatch) {
      field.primary_key = pkMatch[1].toLowerCase() === 'yes' || pkMatch[1].toLowerCase() === 'true';
    }
    
    // Extract label
    const labelMatch = fieldContent.match(/label:\s*"([^"]+)"/);
    if (labelMatch) {
      field.label = labelMatch[1];
    }
    
    // Extract description
    const descriptionMatch = fieldContent.match(/description:\s*"([^"]+)"/);
    if (descriptionMatch) {
      field.description = descriptionMatch[1];
    }
    
    // Extract html
    const htmlMatch = fieldContent.match(/html:\s*([\s\S]*?)(?=\n\s*[a-zA-Z_]+:|$)/);
    if (htmlMatch) {
      field.html = htmlMatch[1].trim();
    }
    
    fields[fieldName] = field;
  }
  
  return fields;
}