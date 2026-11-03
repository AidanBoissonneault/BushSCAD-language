import { describe, expect, it } from 'vitest';
import { profileStatusText } from '../../src/sketch-preview/sketch-preview-profile-status.js';

describe('profileStatusText', () => {
  it('formats open and closed profiles without constraint state', () => {
    expect(profileStatusText(true, undefined)).toBe('closed profile');
    expect(profileStatusText(false, undefined)).toBe('open profile');
  });

  it('reports each solver state with the profile state', () => {
    expect(profileStatusText(true, { status: 'fully-constrained' })).toBe(
      'closed profile · fully constrained',
    );
    expect(
      profileStatusText(false, { status: 'underconstrained', dof: 3 }),
    ).toBe('open profile · under (3 DOF free)');
    expect(profileStatusText(true, { status: 'no-convergence' })).toBe(
      'closed profile · constraint error',
    );
  });
});
