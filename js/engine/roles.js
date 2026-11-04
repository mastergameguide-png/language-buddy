// Hybrid role switching: CORE PERSONALITY (fixed) + ACTIVE ROLE (changes with the situation).
// Priority, highest first: a scenario the user started > a role the user picked > a role the
// model detected from the conversation > the character's default role.
import { ROLES } from './characters.js';

export const SESSION_IDLE_MS = 6 * 60 * 60 * 1000;   // a chat untouched this long starts fresh

export function newSession(char, now = Date.now()) {
  return { role: char.defaultRole, roleSource: 'default', scenario: null, emotion: null, topic: '', summary: '', t: now, turns: 0 };
}

// Returns the session to use now: a stale one goes back to the default role and mood, unless a
// scenario is still running (the user started it, so only the user ends it).
export function freshSession(session, char, now = Date.now()) {
  if (!session || typeof session !== 'object') return newSession(char, now);
  const s = { ...newSession(char, now), ...session };
  if (!s.scenario && now - (s.t || 0) > SESSION_IDLE_MS) return { ...newSession(char, now), topic: '', summary: s.summary || '' };
  if (!ROLES[s.role] || (!s.scenario && !char.roles.includes(s.role))) { s.role = char.defaultRole; s.roleSource = 'default'; }
  return s;
}

const RANK = { default: 0, auto: 1, manual: 2, scenario: 3 };

// source: 'scenario' | 'manual' | 'auto' | 'default'. Returns the updated session.
export function applyRole(session, char, roleId, source) {
  const s = { ...session };
  if (source === 'default') { // back to the character's usual self
    return { ...s, role: char.defaultRole, roleSource: 'default', scenario: null };
  }
  if (!ROLES[roleId]) return s;
  // Outside a scenario a character only plays its own roles.
  if (source !== 'scenario' && !char.roles.includes(roleId)) return s;
  if (source === 'auto') {
    // The model may suggest a role, but it never overrides what the user chose.
    if (RANK[s.roleSource] > RANK.auto) return s;
    if (roleId === char.defaultRole) return { ...s, role: roleId, roleSource: 'default' };
  }
  return { ...s, role: roleId, roleSource: source };
}

// The role a scenario asks for, preferring one the character really has.
export function roleForScenario(scenario, char) {
  const match = (scenario.aiRoles || []).find((r) => char.roles.includes(r));
  return match || (scenario.aiRoles || [])[0] || 'scene';
}
