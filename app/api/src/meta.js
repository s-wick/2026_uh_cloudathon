// Task id and Availability Zone from the ECS task metadata endpoint (v4).
// Outside ECS both fall back to "local".
async function loadMeta(env = process.env) {
  const meta = { taskId: 'local', az: 'local', startedAt: new Date().toISOString() };
  const base = env.ECS_CONTAINER_METADATA_URI_V4;
  if (!base) return meta;
  try {
    const res = await fetch(`${base}/task`, { signal: AbortSignal.timeout(2000) });
    const task = await res.json();
    meta.taskId = task.TaskARN.split('/').pop();
    meta.az = task.AvailabilityZone ?? 'unknown';
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'task metadata lookup failed', error: err.message }));
  }
  return meta;
}

module.exports = { loadMeta };
