export const DATAFORSEO_API_BASE = 'https://api.dataforseo.com/v3';

export interface DataForSeoTask<T = unknown> {
  id?: string;
  status_code?: number;
  status_message?: string;
  cost?: number;
  data?: Record<string, unknown>;
  result?: T[] | null;
}

export interface DataForSeoEnvelope<T = unknown> {
  status_code?: number;
  status_message?: string;
  tasks_error?: number;
  tasks?: Array<DataForSeoTask<T>>;
}

export class DataForSeoError extends Error {
  readonly statusCode?: number;
  readonly httpStatus?: number;

  constructor(message: string, options: { statusCode?: number; httpStatus?: number } = {}) {
    super(message);
    this.name = 'DataForSeoError';
    this.statusCode = options.statusCode;
    this.httpStatus = options.httpStatus;
  }
}

export function dataForSeoAuthHeader(login: string, password: string): string {
  if (!login || !password) throw new DataForSeoError('DataForSEO credentials are not configured');
  return `Basic ${btoa(`${login}:${password}`)}`;
}

export function validateDataForSeoEnvelope<T>(
  envelope: DataForSeoEnvelope<T>,
  acceptedTaskCodes: number[] = [20000],
): Array<DataForSeoTask<T>> {
  if (!envelope || typeof envelope !== 'object') {
    throw new DataForSeoError('DataForSEO returned an invalid response body');
  }
  if (envelope.status_code !== 20000) {
    throw new DataForSeoError(
      `DataForSEO request failed (${envelope.status_code ?? 'missing'}): ${envelope.status_message || 'unknown error'}`,
      { statusCode: envelope.status_code },
    );
  }
  const tasks = envelope.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new DataForSeoError('DataForSEO response did not contain any tasks');
  }
  for (const task of tasks) {
    if (!acceptedTaskCodes.includes(task.status_code ?? -1)) {
      throw new DataForSeoError(
        `DataForSEO task failed (${task.status_code ?? 'missing'}): ${task.status_message || 'unknown error'}`,
        { statusCode: task.status_code },
      );
    }
  }
  return tasks;
}

async function parseResponse<T>(response: Response): Promise<DataForSeoEnvelope<T>> {
  let body: DataForSeoEnvelope<T>;
  try {
    body = await response.json() as DataForSeoEnvelope<T>;
  } catch {
    throw new DataForSeoError(`DataForSEO returned non-JSON HTTP ${response.status}`, { httpStatus: response.status });
  }
  if (!response.ok) {
    throw new DataForSeoError(
      `DataForSEO HTTP ${response.status}: ${body.status_message || 'request failed'}`,
      { statusCode: body.status_code, httpStatus: response.status },
    );
  }
  return body;
}

export async function dataForSeoPost<T>(
  path: string,
  tasks: Array<Record<string, unknown>>,
  credentials: { login: string; password: string },
  options: { acceptedTaskCodes?: number[]; fetchImpl?: typeof fetch } = {},
): Promise<Array<DataForSeoTask<T>>> {
  const fetchImpl = options.fetchImpl || fetch;
  // Paid POSTs are intentionally attempted once. An ambiguous response must be
  // reconciled using the caller's idempotency ledger before any resubmission.
  const response = await fetchImpl(`${DATAFORSEO_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: dataForSeoAuthHeader(credentials.login, credentials.password),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tasks),
  });
  return validateDataForSeoEnvelope(await parseResponse<T>(response), options.acceptedTaskCodes || [20000]);
}

export async function dataForSeoGet<T>(
  path: string,
  credentials: { login: string; password: string },
  options: { fetchImpl?: typeof fetch } = {},
): Promise<Array<DataForSeoTask<T>>> {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`${DATAFORSEO_API_BASE}${path}`, {
    headers: { Authorization: dataForSeoAuthHeader(credentials.login, credentials.password) },
  });
  return validateDataForSeoEnvelope(await parseResponse<T>(response));
}

export function requireTaskResult<T>(task: DataForSeoTask<T>): T[] {
  if (!Array.isArray(task.result)) throw new DataForSeoError('DataForSEO task result is missing or delayed');
  return task.result;
}

function numericValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function parseTrendsSeries(task: DataForSeoTask<Record<string, unknown>>): number[][] {
  const result = requireTaskResult(task);
  const items = result.flatMap((entry) => Array.isArray(entry.items) ? entry.items as Array<Record<string, unknown>> : []);
  const graph = items.find((item) => item.type === 'google_trends_graph');
  const points = Array.isArray(graph?.data) ? graph.data as Array<Record<string, unknown>> : [];
  return points.map((point) => {
    const values = Array.isArray(point.values) ? point.values : [];
    return values.map((value) => {
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return numericValue(record.value ?? record.extracted_value);
      }
      return numericValue(value);
    });
  });
}

export function parseRelatedQueries(task: DataForSeoTask<Record<string, unknown>>): Array<{ query: string; value: number }> {
  const result = requireTaskResult(task);
  const items = result.flatMap((entry) => Array.isArray(entry.items) ? entry.items as Array<Record<string, unknown>> : []);
  const lists = items.filter((item) => item.type === 'google_trends_queries_list');
  const output: Array<{ query: string; value: number }> = [];
  for (const list of lists) {
    const containers = [list, ...(Array.isArray(list.data) ? list.data as Array<Record<string, unknown>> : [])];
    for (const container of containers) {
      for (const group of ['top', 'rising']) {
        const rows = Array.isArray(container[group]) ? container[group] as Array<Record<string, unknown>> : [];
        for (const row of rows) {
          const query = [row.query, row.keyword, row.topic_title].find((value) => typeof value === 'string') as string | undefined;
          if (query) output.push({ query, value: numericValue(row.value) });
        }
      }
    }
  }
  return output;
}

export function parseOrganicCount(task: DataForSeoTask<Record<string, unknown>>): number {
  const result = requireTaskResult(task);
  return result.reduce((total, entry) => total + numericValue(entry.se_results_count), 0);
}

export function parsePeopleAlsoAsk(task: DataForSeoTask<Record<string, unknown>>): Array<{ question: string; url?: string }> {
  const result = requireTaskResult(task);
  const items = result.flatMap((entry) => Array.isArray(entry.items) ? entry.items as Array<Record<string, unknown>> : []);
  const questions: Array<{ question: string; url?: string }> = [];
  for (const item of items.filter((candidate) => candidate.type === 'people_also_ask')) {
    const candidates = [
      item,
      ...(Array.isArray(item.items) ? item.items as Array<Record<string, unknown>> : []),
      ...(Array.isArray(item.expanded_element) ? item.expanded_element as Array<Record<string, unknown>> : []),
    ];
    for (const candidate of candidates) {
      const question = [candidate.title, candidate.question].find((value) => typeof value === 'string') as string | undefined;
      if (!question) continue;
      const url = [candidate.url, candidate.link].find((value) => typeof value === 'string') as string | undefined;
      questions.push({ question, url });
    }
  }
  return questions;
}

export function parseGoogleJobs(task: DataForSeoTask<Record<string, unknown>>): Array<Record<string, unknown>> {
  const result = requireTaskResult(task);
  return result.flatMap((entry) => Array.isArray(entry.items) ? entry.items as Array<Record<string, unknown>> : []);
}
