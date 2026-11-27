import { t } from '../../i18n.js';

function getSubmissionDate() {
    return new Date().toISOString().slice(0, 10);
}

const BANKS = ['BCA', 'BRI', 'BNI', 'Mandiri'];

// Option values are what the server stores/validates; only the labels are translated.
function businessTypeOptions() {
    return `
        <option value="" selected disabled>${t('register.chooseBusinessType')}</option>
        <option value="Usaha Berbadan Hukum">${t('register.bt.legal')}</option>
        <option value="Usaha Perseorangan">${t('register.bt.sole')}</option>
    `;
}

function bankFieldset(n, prefix) {
    return `
        <fieldset class="login-fieldset">
            <legend>${t('register.bank', { n })}</legend>
            <div class="login-field">
                <label for="bank-${prefix}-name">${t('register.bankName')}</label>
                <select id="bank-${prefix}-name" name="bank${prefix === 'one' ? 'One' : 'Two'}Name" required>
                    <option value="" selected disabled>${t('register.chooseBank')}</option>
                    ${BANKS.map((bank) => `<option value="${bank}">${bank}</option>`).join('')}
                </select>
            </div>
            <div class="login-field">
                <label for="bank-${prefix}-number">${t('register.bankNumber')}</label>
                <input id="bank-${prefix}-number" name="bank${prefix === 'one' ? 'One' : 'Two'}Number" type="text" required>
            </div>
            <div class="login-field">
                <label for="bank-${prefix}-owner">${t('register.bankOwner')}</label>
                <input id="bank-${prefix}-owner" name="bank${prefix === 'one' ? 'One' : 'Two'}Owner" type="text" required>
            </div>
        </fieldset>
    `;
}

function fileField(id, name, labelKey) {
    return `
        <div class="login-field">
            <label for="${id}">${t(labelKey)}</label>
            <input id="${id}" name="${name}" type="file" accept=".pdf,application/pdf" required>
        </div>
    `;
}

function textField(id, name, labelKey, type = 'text') {
    return `
        <div class="login-field">
            <label for="${id}">${t(labelKey)}</label>
            <input id="${id}" name="${name}" type="${type}" required>
        </div>
    `;
}

// Each step's fields are built when the step is shown, so they follow the chosen language.
export const registrationSteps = [
    {
        titleKey: 'register.step1',
        fields: () => `
            <div class="login-field">
                <label for="register-email">${t('login.email')}</label>
                <input id="register-email" name="email" type="email" autocomplete="username" required>
            </div>
            <div class="login-field">
                <label for="register-password">${t('login.password')}</label>
                <input id="register-password" name="password" type="password" autocomplete="new-password" minlength="8" required>
            </div>
            ${fileField('terms-document', 'termsDocument', 'register.termsDocument')}
            <label class="login-checkbox">
                <input name="termsAccepted" type="checkbox" required>
                ${t('register.termsAccepted')}
            </label>
        `
    },
    {
        titleKey: 'register.step2',
        fields: () => `
            ${textField('company-entity', 'entity', 'register.entity')}
            <div class="login-field">
                <label for="submission-date">${t('register.submissionDate')}</label>
                <input id="submission-date" type="date" value="${getSubmissionDate()}" readonly>
            </div>
            ${textField('vendor-name', 'vendorName', 'register.vendorName')}
            ${textField('company-street', 'street', 'register.street')}
            ${textField('company-block', 'block', 'register.block')}
            <div class="login-field">
                <label for="company-province">${t('register.province')}</label>
                <select id="company-province" name="province" required disabled>
                    <option value="" selected disabled>${t('common.loading')}</option>
                </select>
            </div>
            <div class="login-field">
                <label for="company-city">${t('register.city')}</label>
                <select id="company-city" name="cityRegency" required disabled>
                    <option value="" selected disabled>${t('region.chooseCity')}</option>
                </select>
            </div>
            <div class="login-field">
                <label for="company-village">${t('register.village')}</label>
                <select id="company-village" name="village" required disabled>
                    <option value="" selected disabled>${t('region.chooseVillage')}</option>
                </select>
            </div>
            ${textField('company-phone', 'phone', 'register.phone', 'tel')}
            ${textField('company-npwp', 'companyNpwp', 'register.companyNpwp')}
            ${textField('company-email', 'companyEmail', 'register.companyEmail', 'email')}
            ${fileField('company-document', 'companyDocument', 'register.companyDocument')}
        `
    },
    {
        titleKey: 'register.step3',
        fields: () => `
            ${bankFieldset(1, 'one')}
            ${bankFieldset(2, 'two')}
            ${fileField('bank-document', 'bankDocument', 'register.bankDocument')}
        `
    },
    {
        titleKey: 'register.step4',
        fields: () => `
            ${textField('owner-name', 'ownerName', 'register.ownerName')}
            ${textField('owner-contact', 'ownerContact', 'register.ownerContact', 'tel')}
            ${textField('sales-person', 'salesPerson', 'register.salesPerson')}
            ${textField('sales-contact', 'salesContact', 'register.salesContact', 'tel')}
            <div class="login-field">
                <label for="business-type">${t('register.businessType')}</label>
                <select id="business-type" name="businessType" required>
                    ${businessTypeOptions()}
                </select>
            </div>
            ${fileField('extras-document', 'extrasDocument', 'register.extrasDocument')}
        `
    },
    {
        titleKey: 'register.step5',
        fields: (registrationData) => registrationData.businessType === 'Usaha Perseorangan'
            ? `
                ${fileField('sole-nib', 'businessLicenseDocument', 'register.nib')}
                ${fileField('sole-npwp', 'taxDocument', 'register.npwp')}
                ${fileField('sole-ktp', 'identityDocument', 'register.ktpOwner')}
            `
            : `
                ${fileField('legal-nib', 'businessLicenseDocument', 'register.nib')}
                ${fileField('legal-npwp', 'taxDocument', 'register.npwp')}
                ${fileField('legal-ktp', 'identityDocument', 'register.ktpDirector')}
                ${fileField('deed-document', 'establishmentDeedDocument', 'register.deed')}
                ${fileField('ministry-document', 'ministryApprovalDocument', 'register.ministry')}
            `
    }
];
