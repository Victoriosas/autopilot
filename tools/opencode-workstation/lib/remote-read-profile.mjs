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

export function enableResendReadOnly(profile, { isVictoriosas, agent }) {
  if (!isVictoriosas || agent !== 'operaciones') throw new Error('--resend requires the Victoriosas repository and operaciones agent');
  if (!profile.mcp?.resend || !profile.agent?.operaciones) throw new Error('Reviewed Resend profile missing');
  profile.mcp.resend.enabled = true;
  profile.permission['resend_*'] = 'deny';
  delete profile.permission['resend_list-domains'];
  profile.permission['resend_list-domains'] = 'allow';
  profile.agent.operaciones.tools['resend_*'] = false;
  profile.agent.operaciones.tools['resend_list-domains'] = true;
  return profile;
}
