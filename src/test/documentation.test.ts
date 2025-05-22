import { LOOKML_DOCS, formatDocumentation } from '../documentation';

describe('LookML Documentation', () => {
  describe('LOOKML_DOCS data structure', () => {
    it('should have documentation for top-level elements', () => {
      expect(LOOKML_DOCS.view).toBeDefined();
      expect(LOOKML_DOCS.explore).toBeDefined();
      expect(LOOKML_DOCS.model).toBeDefined();
      expect(LOOKML_DOCS.include).toBeDefined();
    });

    it('should have documentation for view properties', () => {
      expect(LOOKML_DOCS.sql_table_name).toBeDefined();
      expect(LOOKML_DOCS.derived_table).toBeDefined();
      expect(LOOKML_DOCS.dimension).toBeDefined();
      expect(LOOKML_DOCS.measure).toBeDefined();
    });

    it('should have documentation for field properties', () => {
      expect(LOOKML_DOCS.type).toBeDefined();
      expect(LOOKML_DOCS.sql).toBeDefined();
      expect(LOOKML_DOCS.label).toBeDefined();
      expect(LOOKML_DOCS.primary_key).toBeDefined();
    });

    it('should have documentation for type values', () => {
      expect(LOOKML_DOCS.string).toBeDefined();
      expect(LOOKML_DOCS.number).toBeDefined();
      expect(LOOKML_DOCS.count).toBeDefined();
      expect(LOOKML_DOCS.sum).toBeDefined();
    });

    it('should have proper structure for each documentation entry', () => {
      Object.entries(LOOKML_DOCS).forEach(([key, doc]) => {
        expect(doc).toHaveProperty('description');
        expect(typeof doc.description).toBe('string');
        expect(doc.description.length).toBeGreaterThan(0);
        
        // Example and URL are optional
        if (doc.example) {
          expect(typeof doc.example).toBe('string');
        }
        if (doc.url) {
          expect(typeof doc.url).toBe('string');
          expect(doc.url).toMatch(/^https?:\/\//);
        }
      });
    });
  });

  describe('formatDocumentation function', () => {
    it('should return undefined for unknown elements', () => {
      const result = formatDocumentation('unknown_element');
      expect(result).toBeUndefined();
    });

    it('should format basic documentation', () => {
      const result = formatDocumentation('view');
      expect(result).toBeDefined();
      expect(result?.value).toContain('### view');
      expect(result?.value).toContain(LOOKML_DOCS.view.description);
    });

    it('should include examples when available', () => {
      const result = formatDocumentation('view');
      expect(result?.value).toContain('**Example:**');
      expect(result?.value).toContain('```lookml');
      expect(result?.value).toContain(LOOKML_DOCS.view.example);
    });

    it('should include documentation links when available', () => {
      const result = formatDocumentation('view');
      expect(result?.value).toContain('[Documentation]');
      expect(result?.value).toContain(LOOKML_DOCS.view.url);
    });

    it('should handle elements without examples', () => {
      const result = formatDocumentation('string');
      expect(result).toBeDefined();
      expect(result?.value).toContain('### string');
      expect(result?.value).toContain(LOOKML_DOCS.string.description);
      // Should not contain example section since string type has no example
      expect(result?.value).not.toContain('**Example:**');
    });

    it('should handle elements without URLs', () => {
      // Find an element without URL (if any) or test with string type
      const elementWithoutUrl = Object.entries(LOOKML_DOCS).find(([_, doc]) => !doc.url);
      
      if (elementWithoutUrl) {
        const [elementName] = elementWithoutUrl;
        const result = formatDocumentation(elementName);
        expect(result).toBeDefined();
        expect(result?.value).not.toContain('[Documentation]');
      }
    });

    it('should set isTrusted to true', () => {
      const result = formatDocumentation('view');
      expect(result?.isTrusted).toBe(true);
    });

    it('should format all documented elements without errors', () => {
      Object.keys(LOOKML_DOCS).forEach(element => {
        expect(() => {
          const result = formatDocumentation(element);
          expect(result).toBeDefined();
        }).not.toThrow();
      });
    });
  });

  describe('documentation content quality', () => {
    it('should have meaningful descriptions', () => {
      const minDescriptionLength = 10;
      
      Object.entries(LOOKML_DOCS).forEach(([key, doc]) => {
        expect(doc.description.length).toBeGreaterThan(minDescriptionLength);
        expect(doc.description).not.toMatch(/^TODO/i);
        expect(doc.description).not.toMatch(/^FIX/i);
      });
    });

    it('should have valid LookML syntax in examples', () => {
      Object.entries(LOOKML_DOCS).forEach(([key, doc]) => {
        if (doc.example) {
          // Basic validation that examples contain LookML-like syntax
          const hasLookMLSyntax = 
            doc.example.includes(':') ||  // Properties
            doc.example.includes('{') ||  // Blocks
            doc.example.includes(';;');   // SQL terminators
          
          expect(hasLookMLSyntax).toBe(true);
        }
      });
    });

    it('should have valid URLs', () => {
      Object.entries(LOOKML_DOCS).forEach(([key, doc]) => {
        if (doc.url) {
          expect(doc.url).toMatch(/^https:\/\/docs\.looker\.com/);
        }
      });
    });

    it('should not have duplicate descriptions', () => {
      const descriptions = Object.values(LOOKML_DOCS).map(doc => doc.description);
      const uniqueDescriptions = [...new Set(descriptions)];
      
      expect(descriptions.length).toBe(uniqueDescriptions.length);
    });
  });

  describe('specific element documentation', () => {
    it('should properly document view element', () => {
      const viewDoc = LOOKML_DOCS.view;
      expect(viewDoc.description).toContain('view');
      expect(viewDoc.description).toContain('table');
      expect(viewDoc.example).toContain('view:');
      expect(viewDoc.url).toContain('view-params/view');
    });

    it('should properly document dimension element', () => {
      const dimDoc = LOOKML_DOCS.dimension;
      expect(dimDoc.description).toContain('field');
      expect(dimDoc.example).toContain('dimension:');
      expect(dimDoc.url).toContain('field-params/dimension');
    });

    it('should properly document measure element', () => {
      const measureDoc = LOOKML_DOCS.measure;
      expect(measureDoc.description).toContain('aggregate');
      expect(measureDoc.example).toContain('measure:');
      expect(measureDoc.url).toContain('field-params/measure');
    });

    it('should properly document type property', () => {
      const typeDoc = LOOKML_DOCS.type;
      expect(typeDoc.description).toContain('data type');
      expect(typeDoc.example).toContain('type:');
      expect(typeDoc.url).toContain('field-params/type');
    });
  });
});