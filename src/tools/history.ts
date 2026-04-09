import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WhoopClient } from '../services/client.js';
import {
  getRecoveryHistoryInput,
  getStrainHistoryInput,
  getWorkoutHistoryInput,
  getSleepHistoryInput,
} from '../schemas/inputs.js';
import { msToHoursMinutes, recoveryEmoji, strainLevel } from './format.js';

export function registerHistoryTools(server: McpServer, client: WhoopClient): void {
  // ── whoop_get_recovery_history ─────────────────
  server.tool(
    'whoop_get_recovery_history',
    'Recent recovery scores: daily recovery, resting HR, HRV, SpO2 trends over multiple days',
    getRecoveryHistoryInput.shape,
    async ({ response_format, limit }) => {
      try {
        const records = await client.getRecoveryHistory(limit);

        if (!records.length) {
          return { content: [{ type: 'text', text: 'No recovery history available.' }] };
        }

        if (response_format === 'json') {
          return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
        }

        const lines = [`# Recovery History (${records.length} days)`, ''];
        for (const r of records) {
          const date = r.created_at.split('T')[0];
          if (!r.score) {
            lines.push(`### ${date} — ${r.score_state}`);
            continue;
          }
          const s = r.score;
          lines.push(
            `### ${date} — ${s.recovery_score}/100 (${recoveryEmoji(s.recovery_score)})`,
            `- RHR: ${s.resting_heart_rate} bpm | HRV: ${s.hrv_rmssd_milli.toFixed(1)} ms | SpO2: ${s.spo2_percentage}%`,
            '',
          );
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: any) {
        return { content: [{ type: 'text', text: e.message }] };
      }
    },
  );

  // ── whoop_get_strain_history ───────────────────
  server.tool(
    'whoop_get_strain_history',
    'Recent daily strain: strain scores, calories, heart rate trends over multiple days',
    getStrainHistoryInput.shape,
    async ({ response_format, limit }) => {
      try {
        const records = await client.getStrainHistory(limit);

        if (!records.length) {
          return { content: [{ type: 'text', text: 'No strain history available.' }] };
        }

        if (response_format === 'json') {
          return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
        }

        const lines = [`# Strain History (${records.length} days)`, ''];
        for (const c of records) {
          const date = c.start.split('T')[0];
          if (!c.score) {
            lines.push(`### ${date} — ${c.score_state}`);
            continue;
          }
          const s = c.score;
          const cals = Math.round(s.kilojoule * 0.239);
          lines.push(
            `### ${date} — ${s.strain.toFixed(1)}/21 (${strainLevel(s.strain)})`,
            `- Calories: ${cals} kcal | Avg HR: ${s.average_heart_rate} bpm | Max HR: ${s.max_heart_rate} bpm`,
            '',
          );
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: any) {
        return { content: [{ type: 'text', text: e.message }] };
      }
    },
  );

  // ── whoop_get_workout_history ──────────────────
  server.tool(
    'whoop_get_workout_history',
    'Recent workouts: sport, duration, strain, calories for multiple past workouts',
    getWorkoutHistoryInput.shape,
    async ({ response_format, limit }) => {
      try {
        const records = await client.getWorkoutHistory(limit);

        if (!records.length) {
          return { content: [{ type: 'text', text: 'No workout history available.' }] };
        }

        if (response_format === 'json') {
          return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
        }

        const lines = [`# Workout History (${records.length} workouts)`, ''];
        for (const w of records) {
          const date = w.end.split('T')[0];
          const durationMs = new Date(w.end).getTime() - new Date(w.start).getTime();
          const durationMin = Math.round(durationMs / 60_000);
          const cals = w.score?.kilojoule ? Math.round(w.score.kilojoule * 0.239) : null;

          lines.push(
            `### ${date} — ${w.sport_name} (${durationMin} min)`,
          );

          if (w.score) {
            const parts = [
              `Strain: ${w.score.strain.toFixed(1)}`,
              `Avg HR: ${w.score.average_heart_rate} bpm`,
              `Max HR: ${w.score.max_heart_rate} bpm`,
            ];
            if (cals) parts.push(`${cals} kcal`);
            if (w.score.distance_meter) parts.push(`${(w.score.distance_meter / 1000).toFixed(2)} km`);
            lines.push(`- ${parts.join(' | ')}`, '');
          } else {
            lines.push(`- ${w.score_state}`, '');
          }
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: any) {
        return { content: [{ type: 'text', text: e.message }] };
      }
    },
  );

  // ── whoop_get_sleep_history ────────────────────
  server.tool(
    'whoop_get_sleep_history',
    'Recent sleep data: performance, duration, efficiency, stages over multiple nights',
    getSleepHistoryInput.shape,
    async ({ response_format, limit }) => {
      try {
        const records = await client.getSleepHistory(limit);

        if (!records.length) {
          return {
            content: [{ type: 'text', text: 'No sleep history available. The read:sleep scope may not be enabled.' }],
          };
        }

        if (response_format === 'json') {
          return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
        }

        const lines = [`# Sleep History (${records.length} nights)`, ''];
        for (const sl of records) {
          const date = sl.end.split('T')[0];
          const napLabel = sl.nap ? ' (Nap)' : '';

          if (!sl.score) {
            lines.push(`### ${date}${napLabel} — ${sl.score_state}`);
            continue;
          }

          const s = sl.score;
          const totalSleepMs =
            s.stage_summary.total_light_sleep_time_milli +
            s.stage_summary.total_slow_wave_sleep_time_milli +
            s.stage_summary.total_rem_sleep_time_milli;

          lines.push(
            `### ${date}${napLabel} — ${s.sleep_performance_percentage}% performance`,
            `- Duration: ${msToHoursMinutes(totalSleepMs)} | Efficiency: ${s.sleep_efficiency_percentage}% | RR: ${s.respiratory_rate.toFixed(1)} rpm`,
            `- Stages: Light ${msToHoursMinutes(s.stage_summary.total_light_sleep_time_milli)} | Deep ${msToHoursMinutes(s.stage_summary.total_slow_wave_sleep_time_milli)} | REM ${msToHoursMinutes(s.stage_summary.total_rem_sleep_time_milli)}`,
            '',
          );
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: any) {
        return { content: [{ type: 'text', text: e.message }] };
      }
    },
  );
}
