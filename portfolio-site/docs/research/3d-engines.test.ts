/**
 * Tests for 3D Engines Research Document
 * Validates document structure, required sections, and content quality
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DOC_PATH = join(process.cwd(), 'docs', 'research', '3d-engines.md');

describe('US-002: 3D Engines Research Document', () => {
  it('should exist at docs/research/3d-engines.md', () => {
    assert.ok(existsSync(DOC_PATH), 'Document should exist');
  });

  describe('Document Structure', () => {
    let content;
    
    it('should load document content', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.length > 0, 'Document should not be empty');
      assert.ok(content.length > 5000, 'Document should have substantial content');
    });

    it('should have Executive Summary section', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('## Executive Summary'), 'Should have Executive Summary');
    });

    it('should have Comparison Matrix section', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('## Comparison Matrix'), 'Should have Comparison Matrix');
    });

    it('should have Final Recommendation section', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('## Final Recommendation'), 'Should have Final Recommendation');
    });

    it('should have Risk Assessment sections', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('### Risk Assessment'), 'Should have Risk Assessment');
    });
  });

  describe('Three.js Coverage', () => {
    let content;
    
    it('should document Three.js as an option', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(
        content.includes('Option 1: Three.js') || content.includes('## Option 1: Three.js'),
        'Should document Three.js'
      );
    });

    it('should include Three.js bundle size information', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('Bundle Size'), 'Should mention Bundle Size');
      assert.ok(content.includes('600KB'), 'Should include 600KB figure');
    });

    it('should include Three.js code example', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      const threeJsSection = content.split('## Option 1: Three.js')[1]?.split('## Option')[0];
      assert.ok(threeJsSection && threeJsSection.includes('```'), 'Should have code example');
    });

    it('should include Three.js pros and cons', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      const threeJsSection = content.split('## Option 1: Three.js')[1]?.split('## Option')[0];
      assert.ok(threeJsSection && threeJsSection.includes('### Pros'), 'Should have Pros');
      assert.ok(threeJsSection && threeJsSection.includes('### Cons'), 'Should have Cons');
    });
  });

  describe('React Three Fiber Coverage', () => {
    let content;
    
    it('should document React Three Fiber as an option', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(
        content.includes('Option 2: React Three Fiber') || content.includes('## Option 2: React Three Fiber'),
        'Should document React Three Fiber'
      );
    });

    it('should mention @react-three/fiber package', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('@react-three/fiber'), 'Should mention @react-three/fiber');
    });

    it('should mention @react-three/drei', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('@react-three/drei'), 'Should mention @react-three/drei');
    });

    it('should include R3F bundle size', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('150KB'), 'Should include 150KB figure');
    });

    it('should include R3F code example with Canvas and useFrame', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      const r3fSection = content.split('## Option 2: React Three Fiber')[1]?.split('## Option')[0];
      assert.ok(r3fSection && r3fSection.includes('Canvas'), 'Should have Canvas');
      assert.ok(r3fSection && r3fSection.includes('useFrame'), 'Should have useFrame');
    });
  });

  describe('Spline Coverage', () => {
    let content;
    
    it('should document Spline as an option', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(
        content.includes('Option 3: Spline') || content.includes('## Option 3: Spline'),
        'Should document Spline'
      );
    });

    it('should mention @splinetool/react-spline', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('@splinetool/react-spline'), 'Should mention @splinetool/react-spline');
    });

    it('should include Spline bundle size', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('280KB'), 'Should include 280KB figure');
    });

    it('should mention sketch aesthetic support', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.toLowerCase().includes('sketch'), 'Should mention sketch');
    });

    it('should include Spline code example with onLoad', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      // Find the Spline code example section - it's after the Spline header
      const splineParts = content.split('## Option 3: Spline');
      const splineSection = splineParts.length > 1 ? splineParts[1] : '';
      // Look for onLoad in the Spline section
      assert.ok(
        splineSection.includes('onLoad') || splineSection.includes('onLoad={'),
        'Should have onLoad in Spline code example'
      );
    });
  });

  describe('Comparison Criteria', () => {
    let content;
    
    it('should compare bundle sizes', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('Bundle Size'), 'Should compare bundle sizes');
    });

    it('should compare Next.js compatibility', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('Next.js'), 'Should mention Next.js');
      assert.ok(content.includes('App Router') || content.includes('SSR'), 'Should mention App Router or SSR');
    });

    it('should compare animation support', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.toLowerCase().includes('animation'), 'Should mention animation');
    });

    it('should compare mobile performance', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('Mobile') || content.includes('mobile'), 'Should mention mobile');
    });

    it('should compare developer experience', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      const hasDX = content.includes('DX') || content.includes('Developer Experience') || content.includes('Learning Curve');
      assert.ok(hasDX, 'Should compare developer experience');
    });
  });

  describe('Code Examples', () => {
    let content;
    
    it('should have TypeScript code examples', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('typescript') || content.includes('.tsx'), 'Should have TypeScript examples');
    });

    it('should include tonearm interaction example', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.toLowerCase().includes('tonearm'), 'Should mention tonearm');
      assert.ok(content.includes('onNeedleDrop'), 'Should have onNeedleDrop');
    });

    it('should have code blocks for all three options', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      const codeBlockCount = (content.match(/```/g) || []).length / 2;
      assert.ok(codeBlockCount >= 3, `Should have at least 3 code blocks, found ${codeBlockCount}`);
    });
  });

  describe('Recommendation', () => {
    let content;
    
    it('should provide a primary recommendation', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(
        content.includes('Primary Recommendation') || content.includes('### Primary Recommendation'),
        'Should have primary recommendation'
      );
    });

    it('should provide a fallback recommendation', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(
        content.includes('Fallback Recommendation') || content.includes('### Fallback Recommendation'),
        'Should have fallback recommendation'
      );
    });

    it('should include migration path', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('## Migration Path'), 'Should have migration path');
    });
  });

  describe('Next.js Specifics', () => {
    let content;
    
    it('should mention App Router', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('App Router'), 'Should mention App Router');
    });

    it('should discuss SSR/SSG handling', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('SSR') || content.includes('SSG'), 'Should discuss SSR/SSG');
    });

    it('should mention use client directive', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes("'use client'") || content.includes('use client'), 'Should mention use client');
    });
  });

  describe('Performance Considerations', () => {
    let content;
    
    it('should mention 60fps target', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('60fps') || content.includes('60 fps'), 'Should mention 60fps');
    });

    it('should mention bundle budget', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('500KB'), 'Should mention 500KB budget');
    });

    it('should discuss code splitting', () => {
      content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('code-split') || content.includes('dynamic'), 'Should discuss code splitting');
    });
  });

  describe('Accessibility', () => {
    it('should mention prefers-reduced-motion', () => {
      const content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('prefers-reduced-motion'), 'Should mention prefers-reduced-motion');
    });
  });

  describe('Document Metadata', () => {
    it('should have document date', () => {
      const content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('Date:'), 'Should have document date');
    });

    it('should have version or author', () => {
      const content = readFileSync(DOC_PATH, 'utf-8');
      assert.ok(content.includes('Version:') || content.includes('Author:'), 'Should have version or author');
    });
  });
});
