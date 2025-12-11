export type WizardStepId =
  | 'race'
  | 'archetype'
  | 'profession_preview'
  | 'name'
  | 'summary';

export const wizardSteps: WizardStepId[] = [
  'race',
  'archetype',
  'profession_preview',
  'name',
  'summary'
];

export const firstStepId: WizardStepId = wizardSteps[0];

export function nextStepId(stepId: WizardStepId): WizardStepId | null {
  const idx = wizardSteps.indexOf(stepId);
  if (idx === -1 || idx === wizardSteps.length - 1) return null;
  return wizardSteps[idx + 1];
}

export function stepNumber(stepId: WizardStepId): number {
  const idx = wizardSteps.indexOf(stepId);
  return idx === -1 ? 1 : idx + 1;
}
