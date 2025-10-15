/**
 * AIAnalyzer - AI-powered prototype analysis for ticket generation
 * Uses Claude Sonnet 4.5 to analyze code and extract features, complexity, and technical details
 */

import { executeInference } from '../../agents/inferutils/infer';
import { createUserMessage } from '../../agents/inferutils/common';
import { InferenceContext } from '../../agents/inferutils/config.types';
import { z } from 'zod';
import { StructuredLogger } from '../../logger';

// ========================================
// SCHEMAS
// ========================================

const FeatureSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    complexity: z.number().min(1).max(10),
    files: z.array(z.string()),
    isUserFacing: z.boolean(),
    estimatedHours: z.number(),
});

const FeaturesAnalysisSchema = z.object({
    features: z.array(FeatureSchema),
    techStack: z.object({
        framework: z.string(),
        languages: z.array(z.string()),
        libraries: z.array(z.string()),
        tools: z.array(z.string()),
    }),
    overallComplexity: z.number().min(1).max(10),
});

const ComplexityEstimateSchema = z.object({
    complexity: z.number().min(1).max(10),
    factors: z.object({
        linesOfCode: z.number(),
        dependencies: z.number(),
        stateManagement: z.number(),
        apiIntegration: z.number(),
    }),
    estimatedHours: z.number(),
});

const TicketDescriptionSchema = z.object({
    title: z.string(),
    description: z.string(),
    acceptanceCriteria: z.array(z.string()),
    technicalNotes: z.string(),
});

// ========================================
// TYPES
// ========================================

export type Feature = z.infer<typeof FeatureSchema>;
export type FeaturesAnalysis = z.infer<typeof FeaturesAnalysisSchema>;
export type ComplexityEstimate = z.infer<typeof ComplexityEstimateSchema>;
export type TicketDescription = z.infer<typeof TicketDescriptionSchema>;

export interface FileInfo {
    path: string;
    content: string;
    language: string;
    size: number;
}

// ========================================
// AI ANALYZER SERVICE
// ========================================

export class AIAnalyzer {
    constructor(
        private env: Env,
        private context: InferenceContext,
        private logger: StructuredLogger
    ) {}

    /**
     * Main analysis function - analyzes prototype and identifies features
     */
    async analyzePrototype(
        files: FileInfo[],
        appDescription: string
    ): Promise<FeaturesAnalysis | null> {
        this.logger.info('Starting prototype analysis', { fileCount: files.length });

        // Create file manifest summary
        const filesSummary = files.map(f => 
            `- ${f.path} (${f.language}, ${f.size} bytes)`
        ).join('\n');

        // Sample key files for analysis (limit to prevent token overflow)
        const keyFiles = this.selectKeyFiles(files);
        const filesContent = keyFiles.map(f =>
            `### File: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``
        ).join('\n\n');

        const prompt = `You are analyzing a prototype application to break it down into development tickets.

**Application Description:**
${appDescription}

**File Structure (${files.length} total files):**
${filesSummary}

**Key Files Content:**
${filesContent}

**Your Task:**
Analyze this prototype and identify all distinct features that should be implemented. For each feature:
1. Give it a clear, action-oriented name
2. Provide a detailed description of what it does
3. Estimate complexity on a scale of 1-10 (consider file dependencies, state management, API calls)
4. List all files that would be modified/created for this feature
5. Indicate if it's user-facing or internal/backend
6. Estimate implementation hours (be realistic)

Also identify:
- The tech stack (framework, languages, libraries, tools)
- Overall project complexity (1-10 scale)

Be thorough but concise. Focus on logical feature boundaries that make sense for development tickets.`;

        const result = await executeInference({
            env: this.env,
            context: this.context,
            messages: [createUserMessage(prompt)],
            schema: FeaturesAnalysisSchema,
            agentActionName: 'blueprint', // Use blueprint config for analysis
            maxTokens: 32000,
            temperature: 0.3, // Low temperature for consistency
        });

        if (!result || !result.object) {
            this.logger.error('Failed to analyze prototype', { result });
            return null;
        }

        this.logger.info('Prototype analysis completed', {
            featureCount: result.object.features.length,
            techStack: result.object.techStack.framework,
        });

        return result.object;
    }

    /**
     * Estimate complexity for a specific ticket
     */
    async estimateComplexity(
        ticketTitle: string,
        files: string[],
        allFiles: FileInfo[]
    ): Promise<ComplexityEstimate | null> {
        const relevantFiles = allFiles.filter(f => files.includes(f.path));
        const totalLines = relevantFiles.reduce((sum, f) => 
            sum + f.content.split('\n').length, 0
        );

        const filesContent = relevantFiles.slice(0, 5).map(f =>
            `### ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``
        ).join('\n\n');

        const prompt = `Estimate the complexity of implementing this ticket:

**Ticket:** ${ticketTitle}

**Files to modify (${files.length} total, ${totalLines} lines):**
${filesContent}

Analyze:
1. Code complexity and structure
2. Number of dependencies
3. State management complexity
4. API integration requirements

Provide a complexity score (1-10) and estimated hours for an experienced developer.`;

        const result = await executeInference({
            env: this.env,
            context: this.context,
            messages: [createUserMessage(prompt)],
            schema: ComplexityEstimateSchema,
            agentActionName: 'codeReview',
            maxTokens: 4000,
        });

        return result?.object || null;
    }

    /**
     * Generate detailed ticket description
     */
    async generateDescription(
        feature: Feature,
        files: FileInfo[]
    ): Promise<TicketDescription | null> {
        const relevantFiles = files.filter(f => feature.files.includes(f.path));
        const filesPreview = relevantFiles.slice(0, 3).map(f =>
            `### ${f.path}\n\`\`\`${f.language}\n${f.content.substring(0, 1000)}...\n\`\`\``
        ).join('\n\n');

        const prompt = `Create a detailed ticket description for this feature:

**Feature:** ${feature.name}
**Description:** ${feature.description}
**Complexity:** ${feature.complexity}/10
**Files:** ${feature.files.join(', ')}

**File Previews:**
${filesPreview}

Generate:
1. A clear, actionable ticket title (max 80 chars)
2. A detailed description with context and requirements
3. 3-5 specific acceptance criteria (testable conditions)
4. Technical notes for the developer (implementation tips, gotchas, etc.)

Focus on clarity and actionability.`;

        const result = await executeInference({
            env: this.env,
            context: this.context,
            messages: [createUserMessage(prompt)],
            schema: TicketDescriptionSchema,
            agentActionName: 'conversationalResponse',
            maxTokens: 4000,
        });

        return result?.object || null;
    }

    /**
     * Extract tech stack information from files
     */
    async extractTechStack(files: FileInfo[]): Promise<{
        framework: string;
        languages: string[];
        libraries: string[];
        tools: string[];
    }> {
        // Look for package.json for Node projects
        const packageJson = files.find(f => f.path.includes('package.json'));
        if (packageJson) {
            try {
                const pkg = JSON.parse(packageJson.content);
                const dependencies = {
                    ...pkg.dependencies,
                    ...pkg.devDependencies,
                };
                
                // Detect framework
                let framework = 'Unknown';
                if (dependencies['react']) framework = 'React';
                else if (dependencies['vue']) framework = 'Vue';
                else if (dependencies['svelte']) framework = 'Svelte';
                else if (dependencies['next']) framework = 'Next.js';
                else if (dependencies['@angular/core']) framework = 'Angular';

                // Extract libraries
                const libraries = Object.keys(dependencies).filter(dep => 
                    !dep.startsWith('@types/') && 
                    !dep.includes('eslint') &&
                    !dep.includes('prettier')
                );

                return {
                    framework,
                    languages: this.detectLanguages(files),
                    libraries: libraries.slice(0, 20), // Limit to top 20
                    tools: this.detectTools(files),
                };
            } catch (error) {
                this.logger.warn('Failed to parse package.json', { error });
            }
        }

        return {
            framework: 'Unknown',
            languages: this.detectLanguages(files),
            libraries: [],
            tools: this.detectTools(files),
        };
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    /**
     * Select most important files for analysis (to avoid token limits)
     */
    private selectKeyFiles(files: FileInfo[]): FileInfo[] {
        const keyPatterns = [
            /^src\/.*\.(tsx?|jsx?|vue|svelte)$/,
            /^app\/.*\.(tsx?|jsx?)$/,
            /package\.json$/,
            /tsconfig\.json$/,
            /vite\.config\./,
            /next\.config\./,
        ];

        const keyFiles = files.filter(f =>
            keyPatterns.some(pattern => pattern.test(f.path))
        );

        // Sort by importance and size, take top 15
        return keyFiles
            .sort((a, b) => {
                const aScore = this.getFileImportanceScore(a);
                const bScore = this.getFileImportanceScore(b);
                return bScore - aScore;
            })
            .slice(0, 15);
    }

    /**
     * Score file importance for analysis
     */
    private getFileImportanceScore(file: FileInfo): number {
        let score = 0;
        
        // Entry points are critical
        if (file.path.includes('App.') || file.path.includes('main.') || 
            file.path.includes('index.') && !file.path.includes('index.html')) {
            score += 10;
        }
        
        // Config files are important
        if (file.path.includes('config') || file.path.includes('package.json')) {
            score += 8;
        }
        
        // Source files are valuable
        if (file.path.startsWith('src/')) {
            score += 5;
        }
        
        // Route/page files are important
        if (file.path.includes('route') || file.path.includes('page')) {
            score += 6;
        }
        
        // Penalize very large files (harder to analyze)
        if (file.size > 10000) {
            score -= 2;
        }
        
        return score;
    }

    /**
     * Detect programming languages used
     */
    private detectLanguages(files: FileInfo[]): string[] {
        const languages = new Set<string>();
        
        files.forEach(f => {
            if (f.path.endsWith('.ts') || f.path.endsWith('.tsx')) {
                languages.add('TypeScript');
            } else if (f.path.endsWith('.js') || f.path.endsWith('.jsx')) {
                languages.add('JavaScript');
            } else if (f.path.endsWith('.vue')) {
                languages.add('Vue');
            } else if (f.path.endsWith('.svelte')) {
                languages.add('Svelte');
            } else if (f.path.endsWith('.css') || f.path.endsWith('.scss')) {
                languages.add('CSS');
            } else if (f.path.endsWith('.html')) {
                languages.add('HTML');
            }
        });
        
        return Array.from(languages);
    }

    /**
     * Detect build tools and frameworks
     */
    private detectTools(files: FileInfo[]): string[] {
        const tools = new Set<string>();
        
        files.forEach(f => {
            if (f.path.includes('vite.config')) tools.add('Vite');
            if (f.path.includes('webpack.config')) tools.add('Webpack');
            if (f.path.includes('next.config')) tools.add('Next.js');
            if (f.path.includes('tailwind.config')) tools.add('Tailwind CSS');
            if (f.path.includes('tsconfig')) tools.add('TypeScript');
            if (f.path.includes('eslint')) tools.add('ESLint');
            if (f.path.includes('prettier')) tools.add('Prettier');
        });
        
        return Array.from(tools);
    }
}