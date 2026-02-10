/**
 * Tests for US-001: Research available 3D turntable models
 * 
 * Acceptance Criteria:
 * 1. Research document exists at portfolio-site/docs/research/3d-models.md
 * 2. Document includes minimum 3 model options from different sources
 * 3. Each option specifies: source URL, price, polygon count, file format, license type
 * 4. Clear recommendation section with justified choice
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const RESEARCH_DOC_PATH = path.join(process.cwd(), 'docs', 'research', '3d-models.md');

describe('US-001: 3D Turntable Models Research', () => {
  test('Research document exists at docs/research/3d-models.md', () => {
    assert.ok(fs.existsSync(RESEARCH_DOC_PATH), 
      'Research document should exist at docs/research/3d-models.md');
  });

  test('Document contains content', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    assert.ok(content.length > 0, 'Document should not be empty');
    assert.ok(content.length > 1000, 'Document should have substantial content');
  });

  test('Document includes at least 3 model options', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    
    // Check for option headers (Option 1, Option 2, Option 3, etc.)
    const optionMatches = content.match(/## Option \d+:/g);
    assert.ok(optionMatches, 'Document should contain option sections');
    assert.ok(optionMatches.length >= 3, 
      `Document should have at least 3 options, found ${optionMatches?.length || 0}`);
  });

  test('Each option specifies required fields: source URL', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    const optionSections = content.split(/## Option \d+:/).slice(1);
    
    assert.ok(optionSections.length >= 3, 'Should have at least 3 option sections');
    
    for (const section of optionSections) {
      assert.ok(
        section.includes('URL') || section.includes('https://'),
        'Each option should include a source URL'
      );
    }
  });

  test('Each option specifies required fields: price', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    const optionSections = content.split(/## Option \d+:/).slice(1);
    
    for (const section of optionSections) {
      assert.ok(
        section.includes('Price') || section.includes('$') || section.includes('Free'),
        'Each option should include price information'
      );
    }
  });

  test('Each option specifies required fields: polygon count', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    const optionSections = content.split(/## Option \d+:/).slice(1);
    
    for (const section of optionSections) {
      assert.ok(
        section.includes('Polygon') || section.includes('poly') || section.includes('triangles'),
        'Each option should include polygon count'
      );
    }
  });

  test('Each option specifies required fields: file format', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    const optionSections = content.split(/## Option \d+:/).slice(1);
    
    for (const section of optionSections) {
      assert.ok(
        section.includes('Format') || section.includes('GLB') || section.includes('GLTF'),
        'Each option should include file format information'
      );
    }
  });

  test('Each option specifies required fields: license', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    const optionSections = content.split(/## Option \d+:/).slice(1);
    
    for (const section of optionSections) {
      assert.ok(
        section.includes('License') || section.includes('license'),
        'Each option should include license information'
      );
    }
  });

  test('Document includes pros and cons for options', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    
    assert.ok(content.includes('Pros'), 'Document should include Pros sections');
    assert.ok(content.includes('Cons'), 'Document should include Cons sections');
  });

  test('Document includes recommendation section', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    
    assert.ok(
      content.includes('Recommendation') || content.includes('## Recommendation'),
      'Document should have a recommendation section'
    );
  });

  test('Recommendation includes justification', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    
    // Look for justification indicators
    const hasJustification = 
      content.includes('Justification') ||
      content.includes('justified') ||
      content.includes('Recommended') ||
      (content.includes('Primary Recommendation') && content.includes('Justification'));
    
    assert.ok(hasJustification, 'Recommendation should include justification');
  });

  test('Document references TURNTABLE_LOADING_SPEC.md', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    
    assert.ok(
      content.includes('TURNTABLE_LOADING_SPEC') || content.includes('turntable-loading'),
      'Document should reference the turntable loading spec'
    );
  });

  test('Document includes technical implementation notes', () => {
    const content = fs.readFileSync(RESEARCH_DOC_PATH, 'utf-8');
    
    assert.ok(
      content.includes('Technical') || content.includes('Implementation'),
      'Document should include technical implementation notes'
    );
  });
});
