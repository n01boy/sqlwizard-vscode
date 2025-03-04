import * as https from 'https';
import { DatabaseSchema, QueryGenerationRequest, QueryGenerationResponse } from '../models/interfaces';
import { StorageService } from './StorageService';
import { I18nService } from './I18nService';

export class AIService {
    private static instance: AIService;
    private apiKey: string;
    private baseUrl = 'https://api.anthropic.com/v1/messages';

    private constructor() {
        this.apiKey = StorageService.getInstance().getAIConfig().apiKey;
    }

    static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    async generateSQL(request: QueryGenerationRequest): Promise<QueryGenerationResponse> {
        const i18n = I18nService.getInstance();
        const model = StorageService.getInstance().getAIConfig().model;

        try {
            const systemPrompt = this.createSystemPrompt(request.schema);
            const userPrompt = this.createUserPrompt(request);

            const response = await this.makeRequest({
                model,
                max_tokens: 1024,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userPrompt }
                ]
            });

            const content = response.content[0].text;
            const sqlMatch = content.match(/```sql\n([\s\S]*?)```/);
            
            if (!sqlMatch) {
                throw new Error(i18n.t('messages.error.generation'));
            }

            return {
                sql: sqlMatch[1].trim(),
                explanation: content.replace(sqlMatch[0], '').trim()
            };
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`${i18n.t('messages.error.generation')}: ${error.message}`);
            }
            throw new Error(i18n.t('messages.error.generation'));
        }
    }

    private makeRequest(data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            };

            const req = https.request(this.baseUrl, options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(responseData);
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsedData);
                        } else {
                            reject(new Error(parsedData.error?.message || 'API request failed'));
                        }
                    } catch (error) {
                        reject(new Error('Failed to parse API response'));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(JSON.stringify(data));
            req.end();
        });
    }

    private createSystemPrompt(schema: DatabaseSchema): string {
        const tableDescriptions = schema.tables.map(table => {
            const columns = table.columns
                .map(col => `${col.name} ${col.type}${col.nullable ? ' NULL' : ' NOT NULL'}${col.key ? ` (${col.key})` : ''}`)
                .join('\n    ');

            const indexes = table.indexes
                .map(idx => `${idx.type} INDEX ${idx.name} (${idx.columns.join(', ')})${idx.method ? ` USING ${idx.method}` : ''}`)
                .join('\n    ');

            const foreignKeys = table.foreignKeys
                .map(fk => `FOREIGN KEY ${fk.columnName} REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`)
                .join('\n    ');

            return [
                `Table: ${table.tableName}`,
                `  Columns:\n    ${columns}`,
                `  Indexes:\n    ${indexes}`,
                `  Foreign Keys:\n    ${foreignKeys}`
            ].join('\n');
        }).join('\n\n');

        const relationships = schema.relationships
            .map(rel => `${rel.fromTable}.${rel.fromColumn} -> ${rel.toTable}.${rel.toColumn} (${rel.type})`)
            .join('\n');

        return [
            'You are a SQL expert. Generate MySQL queries based on the following database schema:',
            '',
            tableDescriptions,
            '',
            'Relationships:',
            relationships,
            '',
            'Generate SQL queries that:',
            '1. Are optimized for performance',
            '2. Use appropriate indexes',
            '3. Follow MySQL best practices',
            '4. Include comments explaining key parts of the query',
            '5. Consider table relationships and join conditions',
            '',
            'Respond with the SQL query in a code block (```sql) followed by a brief explanation.'
        ].join('\n');
    }

    private createUserPrompt(request: QueryGenerationRequest): string {
        return `Generate a MySQL query for the following request:\n${request.prompt}`;
    }
}