import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WhoopClient } from '../services/client.js';
import {
  getStatsInput,
  getRecoveryInput,
  getStrainInput,
  getWorkoutInput,
  getHeartRateInput,
  getSleepInput,
  getSleepNeedInput,
} from '../schemas/inputs.js';
import { msToHoursMinutes, recoveryEmoji, strainLevel } from './format.js';

export function registerBiometricTools(server: McpServer, client: WhoopClient): void {
  // ── whoop_get_stats ────────────────────────────
  server.tool(
    'whoop_get_stats',
    'Full biometric snapshot: recovery, strain, HR, HRV, SpO2, skin temp, sleep, latest workout',
    getStatsInput.shape,
    async ({ response_format }) => {
      const stats = await client.getStats();

      if (response_format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      const lines = [
        `# WHOOP Stats`,
        `**Status:** ${stats.connected ? 'Connected' : 'Disconnected'}`,
        `**Last Updated:** ${stats.lastUpdated || 'N/A'}`,
        '',
        '## Recovery',
        stats.recovery !== null
          ? `- **Score:** ${stats.recovery}/100 (${recoveryEmoji(stats.recovery)})`
          : '- **Score:** N/A',
        `- **Resting HR:** ${stats.restingHeartRate ?? 'N/A'} bpm`,
        `- **HRV:** ${stats.hrv ?? 'N/A'} ms`,
        `- **SpO2:** ${stats.spo2 ?? 'N/A'}%`,
        `- **Skin Temp:** ${stats.skinTemp ?? 'N/A'}°C`,
        '',
        '## Daily Strain',
        stats.strain !== null
          ? `- **Strain:** ${stats.strain.toFixed(1)}/21 (${strainLevel(stats.strain)})`
          : '- **Strain:** N/A',
        `- **Calories:** ${stats.calories ?? 'N/A'} kcal`,
        `- **Avg HR:** ${stats.averageHeartRate ?? 'N/A'} bpm`,
        `- **Max HR:** ${stats.maxHeartRate ?? 'N/A'} bpm`,
        '',
        '## Sleep',
        `- **Performance:** ${stats.sleepPerformance ?? 'N/A'}%`,
        `- **Duration:** ${stats.sleepDuration ? `${Math.floor(stats.sleepDuration / 60)}h ${stats.sleepDuration % 60}m` : 'N/A'}`,
        `- **Efficiency:** ${stats.sleepEfficiency ?? 'N/A'}%`,
        `- **Consistency:** ${stats.sleepConsistency ?? 'N/A'}%`,
        `- **Respiratory Rate:** ${stats.respiratoryRate ?? 'N/A'} rpm`,
        '',
        '## Heart Rate',
        `- **Current:** ${stats.currentHeartRate} bpm (${stats.heartRateSource})`,
      ];

      if (stats.lastWorkout) {
        const w = stats.lastWorkout;
        lines.push(
          '',
          '## Last Workout',
          `- **Sport:** ${w.sport}`,
          `- **Strain:** ${w.strain.toFixed(1)}`,
          `- **Duration:** ${w.duration} min`,
          `- **Avg HR:** ${w.averageHeartRate ?? 'N/A'} bpm`,
          `- **Max HR:** ${w.maxHeartRate ?? 'N/A'} bpm`,
          `- **Calories:** ${w.calories} kcal`,
          `- **Completed:** ${w.completedAt}`,
        );
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── whoop_get_recovery ─────────────────────────
  server.tool(
    'whoop_get_recovery',
    'Recovery score and details: score (0-100), resting HR, HRV, SpO2, skin temp',
    getRecoveryInput.shape,
    async ({ response_format }) => {
      const recovery = await client.getRecovery();

      if (!recovery || !recovery.score) {
        return { content: [{ type: 'text', text: 'No recovery data available. Score may be pending.' }] };
      }

      if (response_format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(recovery, null, 2) }] };
      }

      const s = recovery.score;
      const lines = [
        `# Recovery`,
        `- **Score:** ${s.recovery_score}/100 (${recoveryEmoji(s.recovery_score)})`,
        `- **Resting HR:** ${s.resting_heart_rate} bpm`,
        `- **HRV (RMSSD):** ${s.hrv_rmssd_milli.toFixed(1)} ms`,
        `- **SpO2:** ${s.spo2_percentage}%`,
        `- **Skin Temp:** ${s.skin_temp_celsius.toFixed(1)}°C`,
        s.user_calibrating ? '\n*WHOOP is still calibrating for this user.*' : '',
      ];

      return { content: [{ type: 'text', text: lines.filter(Boolean).join('\n') }] };
    },
  );

  // ── whoop_get_strain ───────────────────────────
  server.tool(
    'whoop_get_strain',
    'Daily strain: strain score (0-21), kilojoules, average and max heart rate',
    getStrainInput.shape,
    async ({ response_format }) => {
      const cycle = await client.getStrain();

      if (!cycle || !cycle.score) {
        return { content: [{ type: 'text', text: 'No strain data available. Day may still be in progress.' }] };
      }

      if (response_format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(cycle, null, 2) }] };
      }

      const s = cycle.score;
      const calories = Math.round(s.kilojoule * 0.239);
      const lines = [
        `# Daily Strain`,
        `- **Strain:** ${s.strain.toFixed(1)}/21 (${strainLevel(s.strain)})`,
        `- **Calories:** ${calories} kcal (${s.kilojoule.toFixed(0)} kJ)`,
        `- **Avg HR:** ${s.average_heart_rate} bpm`,
        `- **Max HR:** ${s.max_heart_rate} bpm`,
        `- **Period:** ${cycle.start} → ${cycle.end || 'ongoing'}`,
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── whoop_get_workout ──────────────────────────
  server.tool(
    'whoop_get_workout',
    'Latest workout: sport, duration, strain, distance, heart rate zones, altitude',
    getWorkoutInput.shape,
    async ({ response_format, include_zones }) => {
      const workout = await client.getWorkout();

      if (!workout) {
        return { content: [{ type: 'text', text: 'No recent workout found.' }] };
      }

      if (response_format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(workout, null, 2) }] };
      }

      const durationMs = new Date(workout.end).getTime() - new Date(workout.start).getTime();
      const durationMin = Math.round(durationMs / 60_000);
      const calories = workout.score?.kilojoule ? Math.round(workout.score.kilojoule * 0.239) : null;

      const lines = [
        `# Workout: ${workout.sport_name}`,
        `- **Duration:** ${durationMin} min`,
        `- **Strain:** ${workout.score?.strain?.toFixed(1) ?? 'N/A'}`,
        `- **Avg HR:** ${workout.score?.average_heart_rate ?? 'N/A'} bpm`,
        `- **Max HR:** ${workout.score?.max_heart_rate ?? 'N/A'} bpm`,
        `- **Calories:** ${calories ?? 'N/A'} kcal`,
      ];

      if (workout.score?.distance_meter) {
        lines.push(`- **Distance:** ${(workout.score.distance_meter / 1000).toFixed(2)} km`);
      }
      if (workout.score?.altitude_gain_meter) {
        lines.push(`- **Elevation Gain:** ${workout.score.altitude_gain_meter.toFixed(0)} m`);
      }

      lines.push(`- **Completed:** ${workout.end}`);

      if (include_zones && workout.score?.zone_durations) {
        const z = workout.score.zone_durations;
        lines.push(
          '',
          '## HR Zones',
          `- **Zone 0 (rest):** ${msToHoursMinutes(z.zone_zero_milli)}`,
          `- **Zone 1 (easy):** ${msToHoursMinutes(z.zone_one_milli)}`,
          `- **Zone 2 (moderate):** ${msToHoursMinutes(z.zone_two_milli)}`,
          `- **Zone 3 (hard):** ${msToHoursMinutes(z.zone_three_milli)}`,
          `- **Zone 4 (very hard):** ${msToHoursMinutes(z.zone_four_milli)}`,
          `- **Zone 5 (max):** ${msToHoursMinutes(z.zone_five_milli)}`,
        );
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── whoop_get_heart_rate ───────────────────────
  server.tool(
    'whoop_get_heart_rate',
    'Current heart rate with context: HR value, source (live/decay/resting), resting HR baseline',
    getHeartRateInput.shape,
    async ({ response_format }) => {
      const hr = await client.getHeartRate();

      if (response_format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(hr, null, 2) }] };
      }

      const sourceLabel: Record<string, string> = {
        resting: 'At rest (using resting HR)',
        workout: 'Recently active (workout HR)',
        decay: 'Post-workout (decaying to resting)',
      };

      const lines = [
        `# Heart Rate`,
        `- **Current:** ${hr.currentHeartRate} bpm`,
        `- **Source:** ${sourceLabel[hr.heartRateSource] || hr.heartRateSource}`,
        `- **Resting HR:** ${hr.restingHeartRate ?? 'N/A'} bpm`,
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── whoop_get_sleep ────────────────────────────
  server.tool(
    'whoop_get_sleep',
    'Latest sleep data: performance %, stages, efficiency, respiratory rate, disturbances, nap flag',
    getSleepInput.shape,
    async ({ response_format, include_stages }) => {
      const sleep = await client.getSleep();

      if (!sleep || !sleep.score) {
        return {
          content: [{ type: 'text', text: 'No sleep data available. Sleep may not be scored yet, or the read:sleep scope may not be enabled.' }],
        };
      }

      if (response_format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(sleep, null, 2) }] };
      }

      const s = sleep.score;
      const lines = [
        `# Sleep${sleep.nap ? ' (Nap)' : ''}`,
        `- **Performance:** ${s.sleep_performance_percentage}%`,
        `- **Efficiency:** ${s.sleep_efficiency_percentage}%`,
        `- **Consistency:** ${s.sleep_consistency_percentage}%`,
        `- **Respiratory Rate:** ${s.respiratory_rate.toFixed(1)} rpm`,
        `- **Time in Bed:** ${msToHoursMinutes(s.stage_summary.total_in_bed_time_milli)}`,
        `- **Disturbances:** ${s.stage_summary.disturbance_count}`,
        `- **Sleep Cycles:** ${s.stage_summary.sleep_cycle_count}`,
      ];

      if (include_stages) {
        const st = s.stage_summary;
        lines.push(
          '',
          '## Sleep Stages',
          `- **Light:** ${msToHoursMinutes(st.total_light_sleep_time_milli)}`,
          `- **Deep (SWS):** ${msToHoursMinutes(st.total_slow_wave_sleep_time_milli)}`,
          `- **REM:** ${msToHoursMinutes(st.total_rem_sleep_time_milli)}`,
          `- **Awake:** ${msToHoursMinutes(st.total_awake_time_milli)}`,
        );
      }

      if (sleep.start && sleep.end) {
        lines.push('', `**Period:** ${sleep.start} → ${sleep.end}`);
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── whoop_get_sleep_need ───────────────────────
  server.tool(
    'whoop_get_sleep_need',
    'Sleep need analysis: baseline need, sleep debt, strain-based need, nap offsets',
    getSleepNeedInput.shape,
    async ({ response_format }) => {
      const need = await client.getSleepNeed();

      if (!need) {
        return {
          content: [{ type: 'text', text: 'No sleep need data available. The read:sleep scope may not be enabled, or sleep data is not yet scored.' }],
        };
      }

      if (response_format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(need, null, 2) }] };
      }

      const totalNeedMs =
        need.baseline_milli +
        need.need_from_sleep_debt_milli +
        need.need_from_recent_strain_milli +
        need.need_from_recent_nap_milli;

      const lines = [
        `# Sleep Need`,
        `- **Total Need:** ${msToHoursMinutes(totalNeedMs)}`,
        `- **Baseline:** ${msToHoursMinutes(need.baseline_milli)}`,
        `- **From Sleep Debt:** +${msToHoursMinutes(need.need_from_sleep_debt_milli)}`,
        `- **From Strain:** +${msToHoursMinutes(need.need_from_recent_strain_milli)}`,
        `- **Nap Offset:** ${msToHoursMinutes(need.need_from_recent_nap_milli)}`,
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );
}
