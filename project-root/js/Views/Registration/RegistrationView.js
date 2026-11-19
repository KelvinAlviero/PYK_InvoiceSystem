import { registrationSteps } from './registrationSteps.js';

export function RegistrationView(registerStep = 1, registrationData = {}) {
    const currentStep = registrationSteps[registerStep - 1] ?? registrationSteps[0];
    const fields = typeof currentStep.fields === 'function'
        ? currentStep.fields(registrationData)
        : currentStep.fields;

    return `
        <section class="login-page" aria-label="Create account">
            <form class="login-card" data-auth-mode="register" data-register-step="${registerStep}">
                <div class="login-card-fields">
                    <h1>${currentStep.title}</h1>
                    ${fields}
                    <p class="login-error" role="alert" hidden></p>
                </div>

                <div class="login-card-actions">
                    ${registerStep > 1
                        ? '<button class="login-back-button" type="button">Back</button>'
                        : '<a class="login-register-link" href="#login">Already have an account</a>'
                    }
                    <span class="login-step-count">Step ${registerStep} of ${registrationSteps.length}</span>
                    <button type="submit">${registerStep < registrationSteps.length ? 'Next' : 'Create'}</button>
                </div>
            </form>
        </section>
    `;
}
