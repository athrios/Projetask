import { createClient } from 'npm:@supabase/supabase-js@2'

const SITE_NAME = 'Athrios Tarefas'
const SENDER_DOMAIN = 'task.athrioscontabil.com.br'
const FROM_DOMAIN = 'task.athrioscontabil.com.br'

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function fmtPtBR(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
  } catch {
    return iso
  }
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const token = authHeader.slice('Bearer '.length).trim()
  const claims = parseJwtClaims(token)
  if (claims?.role !== 'service_role') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const now = new Date().toISOString()

  const { data: dueReminders, error: readErr } = await supabase
    .from('task_reminders')
    .select('id, workspace_id, task_id, user_id, reminder_at, notify_in_app, notify_email, email_sent_at, in_app_created_at')
    .eq('status', 'pending')
    .lte('reminder_at', now)
    .limit(100)

  if (readErr) {
    console.error('Failed to read reminders', readErr)
    return new Response(JSON.stringify({ error: 'read_failed' }), { status: 500 })
  }

  let processed = 0
  for (const r of dueReminders ?? []) {
    try {
      // Load the task
      const { data: task } = await supabase
        .from('tasks')
        .select('id, title, status, done, due_date, due_time, workspace_id')
        .eq('id', r.task_id)
        .maybeSingle()
      if (!task || task.status === 'feita' || task.status === 'cancelado' || task.done) {
        await supabase.from('task_reminders').update({ status: 'cancelled' }).eq('id', r.id)
        continue
      }

      // Load workspace name
      const { data: ws } = await supabase.from('workspaces').select('name').eq('id', r.workspace_id).maybeSingle()
      const workspaceName = ws?.name ?? ''

      const dueLabel = task.due_date
        ? (task.due_time
            ? fmtPtBR(`${task.due_date}T${task.due_time}-03:00`)
            : new Date(task.due_date + 'T00:00:00-03:00').toLocaleDateString('pt-BR', { dateStyle: 'long' }))
        : 'sem prazo'

      const patch: Record<string, unknown> = { status: 'sent' }

      // In-app notification
      if (r.notify_in_app && !r.in_app_created_at) {
        const message = `Lembrete: a tarefa "${task.title}" tem prazo ${dueLabel}.`
        await supabase.from('notifications').insert({
          workspace_id: r.workspace_id,
          user_id: r.user_id,
          task_id: task.id,
          title: 'Lembrete de tarefa',
          message,
        })
        patch.in_app_created_at = new Date().toISOString()
      }

      // Email notification
      if (r.notify_email && !r.email_sent_at) {
        // Get user email
        const { data: userRes } = await supabase.auth.admin.getUserById(r.user_id)
        const email = userRes?.user?.email
        if (email) {
          const messageId = crypto.randomUUID()
          const subject = `Lembrete de tarefa: ${task.title}`
          const titleEsc = escapeHtml(task.title)
          const wsEsc = escapeHtml(workspaceName)
          const dueEsc = escapeHtml(dueLabel)
          const html = `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
<h2 style="font-size: 18px; margin: 0 0 16px;">Lembrete de tarefa</h2>
<p>Olá,</p>
<p>Você tem uma tarefa próxima do prazo:</p>
<table style="border-collapse: collapse; margin: 16px 0;">
<tr><td style="padding: 4px 12px 4px 0; color: #666;">Tarefa</td><td style="padding: 4px 0;"><strong>${titleEsc}</strong></td></tr>
<tr><td style="padding: 4px 12px 4px 0; color: #666;">Prazo</td><td style="padding: 4px 0;">${dueEsc}</td></tr>
${wsEsc ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;">Ambiente</td><td style="padding: 4px 0;">${wsEsc}</td></tr>` : ''}
</table>
<p style="color: #666; font-size: 13px;">Acesse o sistema para visualizar os detalhes.</p>
</body></html>`
          const text = `Lembrete de tarefa\n\nTarefa: ${task.title}\nPrazo: ${dueLabel}${workspaceName ? `\nAmbiente: ${workspaceName}` : ''}\n\nAcesse o sistema para visualizar os detalhes.`

          // log pending
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'task-reminder',
            recipient_email: email,
            status: 'pending',
          })

          const { error: enqErr } = await supabase.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              message_id: messageId,
              to: email,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject,
              html,
              text,
              purpose: 'transactional',
              label: 'task-reminder',
              idempotency_key: `task-reminder-${r.id}`,
              queued_at: new Date().toISOString(),
            },
          })
          if (enqErr) {
            console.error('enqueue failed', enqErr)
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: 'task-reminder',
              recipient_email: email,
              status: 'failed',
              error_message: 'enqueue failed',
            })
          } else {
            patch.email_sent_at = new Date().toISOString()
          }
        } else {
          console.warn('No email for user', r.user_id)
        }
      }

      await supabase.from('task_reminders').update(patch).eq('id', r.id)
      processed++
    } catch (e) {
      console.error('Reminder failed', r.id, e)
    }
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
