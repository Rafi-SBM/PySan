import { Fragment } from 'react';
import { Icon } from './Icon';

export type StepId = 'import' | 'profiles' | 'review' | 'cleanup';

export interface StepDefinition {
  id: StepId;
  label: string;
  /** False when the user has not supplied enough to open this step. */
  available: boolean;
  /** True once the step's input is satisfied. */
  complete: boolean;
}

interface StepperProps {
  steps: readonly StepDefinition[];
  current: StepId;
  onSelect: (step: StepId) => void;
}

export function Stepper({ steps, current, onSelect }: StepperProps) {
  return (
    <nav className="stepper" aria-label="Analysis steps">
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          {index > 0 && <span className="stepper__rule" aria-hidden="true" />}
          <button
            type="button"
            className="stepper__item"
            aria-current={step.id === current ? 'step' : undefined}
            data-complete={step.complete}
            disabled={!step.available}
            onClick={() => onSelect(step.id)}
          >
            <span className="stepper__index" aria-hidden="true">
              {step.complete ? <Icon name="check" size={11} /> : index + 1}
            </span>
            {step.label}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
