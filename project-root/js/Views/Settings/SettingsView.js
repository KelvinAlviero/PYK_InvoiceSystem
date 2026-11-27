import { getLanguage, LANGUAGES, setLanguage, t } from '../../i18n.js';

// Settings page (opened from the sidebar). For now: the display language.

export function SettingsView(notice = '') {
    const current = getLanguage();

    const html = `
        <section class="profile-page-box settings-page" aria-label="${t('settings.title')}">
            <header class="profile-page-header">
                <span>${t('settings.title')}</span>
                <button class="back-home-button" type="button">${t('common.backHome')}</button>
            </header>
            <div class="settings-content">
                <fieldset class="settings-group">
                    <!-- Always bilingual, so it can be found whichever language is active. -->
                    <legend>Bahasa / Language</legend>
                    <p class="settings-help">${t('settings.languageHelp')}</p>
                    <div class="settings-options">
                        ${LANGUAGES.map((language) => `
                            <label class="settings-option">
                                <input type="radio" name="language" value="${language}" ${language === current ? 'checked' : ''}>
                                <span class="settings-option-label">${t(`settings.lang.${language}`)}</span>
                                <span class="settings-option-code" aria-hidden="true">${language.toUpperCase()}</span>
                            </label>
                        `).join('')}
                    </div>
                    <p class="settings-notice" role="status" ${notice ? '' : 'hidden'}>${notice}</p>
                </fieldset>
            </div>
        </section>
    `;

    // onChange(): re-render the app so every visible text switches language.
    function attachListeners(onChange) {
        document.querySelectorAll('.settings-option input[name="language"]').forEach((radio) => {
            radio.addEventListener('change', () => {
                setLanguage(radio.value);
                onChange?.();
            });
        });
    }

    return { html, attachListeners };
}
