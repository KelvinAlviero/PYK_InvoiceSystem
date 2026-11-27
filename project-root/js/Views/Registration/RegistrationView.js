import { t } from '../../i18n.js';
import { registrationSteps } from './registrationSteps.js';

export function RegistrationView(registerStep = 1, registrationData = {}) {
    const currentStep = registrationSteps[registerStep - 1] ?? registrationSteps[0];
    const fields = typeof currentStep.fields === 'function'
        ? currentStep.fields(registrationData)
        : currentStep.fields;

    return `
        <section class="login-page" aria-label="${t('register.ariaLabel')}">
            <form class="login-card" data-auth-mode="register" data-register-step="${registerStep}">
                <div class="login-card-fields">
                    <h1>${t(currentStep.titleKey)}</h1>
                    ${fields}
                    <p class="login-error" role="alert" hidden></p>
                </div>

                <div class="login-card-actions">
                    ${registerStep > 1
                        ? `<button class="login-back-button" type="button">${t('register.back')}</button>`
                        : `<a class="login-register-link" href="#login">${t('register.haveAccount')}</a>`
                    }
                    <span class="login-step-count">${t('register.step', { step: registerStep, total: registrationSteps.length })}</span>
                    <button type="submit">${registerStep < registrationSteps.length ? t('register.next') : t('register.create')}</button>
                </div>
            </form>
        </section>
    `;
}
