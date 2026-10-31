export function enableCamelRunReadOnly(profile, { isVictoriosas, agent }) {
  if (!isVictoriosas || agent !== 'operaciones') throw new Error('--camelrun requires the Victoriosas repository and operaciones agent');
  if (!profile.mcp?.camelrun || !profile.agent?.operaciones) throw new Error('Reviewed camelRun profile missing');
  profile.mcp.camelrun.enabled = true;
  profile.permission['camelrun_*'] = 'deny';
  delete profile.permission.camelrun_list_agents;
  profile.permission.camelrun_list_agents = 'allow';
  profile.agent.operaciones.tools['camelrun_*'] = false;
  profile.agent.operaciones.tools.camelrun_list_agents = true;
  return profile;
}
