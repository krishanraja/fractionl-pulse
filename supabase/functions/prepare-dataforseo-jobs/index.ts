import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dataForSeoPost } from '../_shared/dataforseo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN') || '';
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const FRACTIONAL_ROLES = [
  { phrase: 'fractional CFO', category: 'cfo' },
  { phrase: 'fractional CMO', category: 'cmo' },
  { phrase: 'fractional CTO', category: 'cto' },
  { phrase: 'fractional COO', category: 'coo' },
  { phrase: 'fractional CRO', category: 'cro' },
  { phrase: 'interim CEO', category: 'ceo' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const targetDate = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const retryRejectedAuth = url.searchParams.get('retry_rejected_auth') === 'true';

  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    return new Response(JSON.stringify({ error: 'DataForSEO credentials are not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: existing, error: existingError } = await supabase
    .from('pipeline_runs')
    .select('id,status,error,metadata,started_at')
    .eq('source', 'prepare-dataforseo-jobs')
    .contains('metadata', { target_date: targetDate })
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return new Response(JSON.stringify({ error: existingError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let run: { id: string } | null = null;
  if (existing) {
    const metadata = existing.metadata as Record<string, unknown> | null;
    const tasks = Array.isArray(metadata?.tasks) ? metadata?.tasks : [];
    if (existing.status === 'success' && tasks.length === FRACTIONAL_ROLES.length) {
      return new Response(JSON.stringify({ success: true, idempotent: true, date: targetDate, tasks }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const isDefinitiveAuthRejection = existing.status === 'error'
      && tasks.length === 0
      && typeof existing.error === 'string'
      && existing.error.startsWith('DataForSEO HTTP 401:');
    if (!retryRejectedAuth || !isDefinitiveAuthRejection) {
      return new Response(JSON.stringify({
        error: 'A submission ledger already exists for this date. Reconcile it before any paid resubmission.',
        run_id: existing.id,
        status: existing.status,
        date: targetDate,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const retriedAt = new Date().toISOString();
    const { error: reconcileError } = await supabase.from('pipeline_runs').update({
      started_at: retriedAt,
      completed_at: null,
      status: 'running',
      error: null,
      metadata: {
        target_date: targetDate,
        provider: 'dataforseo',
        submission_state: 'starting',
        manual_retry: true,
        prior_rejection: 'http_401_zero_task_ids',
      },
    }).eq('id', existing.id);
    if (reconcileError) {
      return new Response(JSON.stringify({ error: `Could not reconcile rejected-auth ledger: ${reconcileError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    run = { id: existing.id };
  }

  if (!run) {
    const startedAt = new Date().toISOString();
    const { data: insertedRun, error: insertError } = await supabase
      .from('pipeline_runs')
      .insert({
        source: 'prepare-dataforseo-jobs',
        started_at: startedAt,
        status: 'running',
        metadata: { target_date: targetDate, provider: 'dataforseo', submission_state: 'starting' },
      })
      .select('id')
      .single();

    if (insertError || !insertedRun?.id) {
      return new Response(JSON.stringify({ error: insertError?.message || 'Could not create submission ledger' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    run = insertedRun;
  }

  let acceptedTasks: Array<{ id?: string; category: string; phrase: string }> = [];
  try {
    const requestTasks = FRACTIONAL_ROLES.map((role) => ({
      keyword: role.phrase,
      location_code: 2840,
      language_code: 'en',
      depth: 10,
      tag: `pulse:${targetDate}:${role.category}`,
    }));
    const submitted = await dataForSeoPost<Record<string, unknown>>(
      '/serp/google/jobs/task_post',
      requestTasks,
      { login: DATAFORSEO_LOGIN, password: DATAFORSEO_PASSWORD },
      { acceptedTaskCodes: [20000, 20100] },
    );

    acceptedTasks = submitted.map((task, index) => ({
      id: task.id,
      category: FRACTIONAL_ROLES[index].category,
      phrase: FRACTIONAL_ROLES[index].phrase,
    }));
    if (acceptedTasks.some((task) => !task.id)) throw new Error('DataForSEO accepted a task without returning its ID');

    const totalCost = submitted.reduce((sum, task) => sum + (Number(task.cost) || 0), 0);
    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase.from('pipeline_runs').update({
      completed_at: completedAt,
      status: 'success',
      records_inserted: 0,
      metadata: {
        target_date: targetDate,
        provider: 'dataforseo',
        submission_state: 'accepted',
        tasks: acceptedTasks,
        request_count: acceptedTasks.length,
        reported_cost: totalCost,
      },
    }).eq('id', run.id);
    if (updateError) throw new Error(`Tasks were accepted but the ledger update failed: ${updateError.message}`);

    return new Response(JSON.stringify({ success: true, idempotent: false, date: targetDate, tasks: acceptedTasks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = (error as Error).message;
    await supabase.from('pipeline_runs').update({
      completed_at: new Date().toISOString(),
      status: 'error',
      error: message,
      metadata: {
        target_date: targetDate,
        provider: 'dataforseo',
        submission_state: acceptedTasks.length > 0 ? 'accepted_ledger_update_failed' : 'ambiguous_or_rejected',
        tasks: acceptedTasks,
        retry_policy: 'manual_reconciliation_required',
      },
    }).eq('id', run.id);
    console.error('[DataForSEO Jobs Prepare] submission failed; automatic retry suppressed:', message);
    return new Response(JSON.stringify({
      error: message,
      run_id: run.id,
      retry_suppressed: true,
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
