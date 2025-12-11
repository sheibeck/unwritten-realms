export const wizardSteps = [
    'race',
    'archetype',
    'profession_preview',
    'name',
    'summary'
];
export const firstStepId = wizardSteps[0];
export function nextStepId(stepId) {
    const idx = wizardSteps.indexOf(stepId);
    if (idx === -1 || idx === wizardSteps.length - 1) return null;
    return wizardSteps[idx + 1];
}
export function stepNumber(stepId) {
    const idx = wizardSteps.indexOf(stepId);
    return idx === -1 ? 1 : idx + 1;
}
