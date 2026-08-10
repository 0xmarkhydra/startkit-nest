import { Controller, Get, Header } from '@nestjs/common';
import { SkipRateLimit } from '@/shared/decorators/skip-rate-limit.decorator';
import { SkipResponseFormat } from '@/shared/decorators/skip-response-format.decorator';

@SkipRateLimit()
@Controller('metrics')
export class MetricsController {
  private readonly instanceId =
    process.env.INSTANCE_ID || process.env.HOSTNAME || 'local';

  @Get()
  @SkipResponseFormat()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metrics(): string {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const labels = `instance_id="${this.escapeLabel(this.instanceId)}"`;

    return [
      '# HELP startkit_process_uptime_seconds Process uptime in seconds.',
      '# TYPE startkit_process_uptime_seconds gauge',
      `startkit_process_uptime_seconds{${labels}} ${process.uptime()}`,
      '# HELP startkit_process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE startkit_process_resident_memory_bytes gauge',
      `startkit_process_resident_memory_bytes{${labels}} ${memory.rss}`,
      '# HELP startkit_node_heap_used_bytes Node.js heap memory currently used in bytes.',
      '# TYPE startkit_node_heap_used_bytes gauge',
      `startkit_node_heap_used_bytes{${labels}} ${memory.heapUsed}`,
      '# HELP startkit_node_heap_total_bytes Total Node.js heap memory in bytes.',
      '# TYPE startkit_node_heap_total_bytes gauge',
      `startkit_node_heap_total_bytes{${labels}} ${memory.heapTotal}`,
      '# HELP startkit_process_cpu_user_seconds_total User CPU time consumed by the process.',
      '# TYPE startkit_process_cpu_user_seconds_total counter',
      `startkit_process_cpu_user_seconds_total{${labels}} ${cpu.user / 1_000_000}`,
      '# HELP startkit_process_cpu_system_seconds_total System CPU time consumed by the process.',
      '# TYPE startkit_process_cpu_system_seconds_total counter',
      `startkit_process_cpu_system_seconds_total{${labels}} ${cpu.system / 1_000_000}`,
      '',
    ].join('\n');
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}
