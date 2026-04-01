import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestLogService } from '@/api/services/request-log.service';
import { Request } from 'express';

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  constructor(private readonly requestLogService: RequestLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    // Get user info from request (set by ApiKeyGuard)
    const userId = request['userId'];
    const apiKeyId = request['apiKeyId'];

    // Skip logging if no user info (shouldn't happen with ApiKeyGuard)
    if (!userId || !apiKeyId) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        const duration = Date.now() - startTime;
        
        // Extract model from request/response
        const requestBody = request.body || {};
        const model = response?.model || requestBody?.model || null;
        
        // Extract token usage from response
        const usage = response?.usage || {};
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (promptTokens + completionTokens);
        
        // Calculate estimated cost
        const estimatedCost = this.calculateEstimatedCost(model, promptTokens, completionTokens);

        // Sanitize request/response bodies (remove sensitive data)
        const sanitizedRequestBody = this.sanitizeBody(requestBody);
        const sanitizedResponseBody = this.sanitizeBody(response);

        // Create log entry
        await this.requestLogService.create({
          endpoint: request.path,
          method: request.method,
          requestBody: sanitizedRequestBody,
          responseBody: sanitizedResponseBody,
          statusCode: 200, // If we got here, it was successful
          model,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCost,
          duration,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          userId,
          apiKeyId,
        });
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    
    // Create a deep copy
    const sanitized = JSON.parse(JSON.stringify(body));
    
    // Remove sensitive fields
    const sensitiveFields = ['authorization', 'api_key', 'x-api-key', 'password', 'token'];
    
    const sanitizeObject = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.includes(lowerKey)) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }

  private calculateEstimatedCost(model: string, promptTokens: number, completionTokens: number): number {
    // Cost per 1M tokens (in USD)
    const modelPricing: Record<string, { input: number; output: number }> = {
      'moonshotai/kimi-k2.5': { input: 2.0, output: 8.0 },
      'moonshotai/kimi-k2': { input: 2.0, output: 8.0 },
      'openai/gpt-4o': { input: 5.0, output: 15.0 },
      'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
      'anthropic/claude-opus-4.6': { input: 15.0, output: 75.0 },
      'anthropic/claude-sonnet-4.6': { input: 3.0, output: 15.0 },
      'anthropic/claude-haiku-4.5': { input: 0.25, output: 1.25 },
      'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },
      'google/gemini-3-pro-preview': { input: 3.5, output: 10.5 },
      'google/gemini-3-flash-preview': { input: 0.35, output: 1.05 },
    };

    const pricing = modelPricing[model] || { input: 2.0, output: 8.0 }; // Default pricing

    const inputCost = (promptTokens / 1000000) * pricing.input;
    const outputCost = (completionTokens / 1000000) * pricing.output;

    return Number((inputCost + outputCost).toFixed(6));
  }
}