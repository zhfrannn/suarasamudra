// Internationalization (i18n) System for Suara Samudra
class I18nManager {
    constructor() {
        this.currentLanguage = this.getStoredLanguage() || 'id';
        this.translations = {};
        this.loadTranslations();
    }

    // Get stored language from localStorage
    getStoredLanguage() {
        return localStorage.getItem('suara_samudra_language');
    }

    // Store language preference
    setStoredLanguage(language) {
        localStorage.setItem('suara_samudra_language', language);
    }

    // Load all translation files
    async loadTranslations() {
        try {
            const languages = ['ace', 'id', 'en'];
            const promises = languages.map(async (lang) => {
                const response = await fetch(`assets/i18n/${lang}.json`);
                if (response.ok) {
                    this.translations[lang] = await response.json();
                }
            });
            
            await Promise.all(promises);
            this.applyTranslations();
        } catch (error) {
            console.error('Error loading translations:', error);
            // Fallback to Indonesian if translations fail to load
            this.currentLanguage = 'id';
        }
    }

    // Change language
    async changeLanguage(language) {
        if (this.translations[language]) {
            this.currentLanguage = language;
            this.setStoredLanguage(language);
            this.applyTranslations();
            this.updateLanguageSelector();
            
            // Track language change event
            if (window.trackEvent) {
                window.trackEvent('language_changed', { language });
            }
        }
    }

    // Get translation for a key
    t(key, fallback = key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return fallback;
            }
        }
        
        return typeof value === 'string' ? value : fallback;
    }

    // Apply translations to the current page
    applyTranslations() {
        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'email')) {
                element.placeholder = translation;
            } else if (element.tagName === 'INPUT' && element.type === 'submit') {
                element.value = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Update elements with data-i18n-html attribute (for HTML content)
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            const translation = this.t(key);
            element.innerHTML = translation;
        });

        // Update page title
        const titleKey = document.querySelector('meta[name="i18n-title"]');
        if (titleKey) {
            document.title = this.t(titleKey.content);
        }

        // Update meta description
        const descKey = document.querySelector('meta[name="i18n-description"]');
        if (descKey) {
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                metaDesc.content = this.t(descKey.content);
            }
        }

        // Update document language attribute
        document.documentElement.lang = this.getLanguageCode();
    }

    // Get proper language code for HTML lang attribute
    getLanguageCode() {
        const langCodes = {
            'ace': 'ace',
            'id': 'id',
            'en': 'en'
        };
        return langCodes[this.currentLanguage] || 'id';
    }

    // Update language selector UI
    updateLanguageSelector() {
        const currentLangDisplay = document.querySelector('.current-language');
        const langNames = {
            'ace': 'ACE',
            'id': 'ID',
            'en': 'EN'
        };
        
        if (currentLangDisplay) {
            currentLangDisplay.textContent = langNames[this.currentLanguage];
        }

        // Update active state in dropdown
        document.querySelectorAll('.language-option').forEach(option => {
            const lang = option.getAttribute('data-lang');
            option.classList.toggle('active', lang === this.currentLanguage);
        });
    }

    // Initialize language selector events
    initializeLanguageSelector() {
        document.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const language = option.getAttribute('data-lang');
                this.changeLanguage(language);
            });
        });

        this.updateLanguageSelector();
    }

    // Format numbers according to locale
    formatNumber(number) {
        const locales = {
            'ace': 'id-ID',
            'id': 'id-ID',
            'en': 'en-US'
        };
        
        return new Intl.NumberFormat(locales[this.currentLanguage]).format(number);
    }

    // Format dates according to locale
    formatDate(date, options = {}) {
        const locales = {
            'ace': 'id-ID',
            'id': 'id-ID',
            'en': 'en-US'
        };
        
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        return new Intl.DateTimeFormat(locales[this.currentLanguage], { ...defaultOptions, ...options }).format(date);
    }
}

// Initialize i18n system
const i18n = new I18nManager();

// Make i18n available globally
window.i18n = i18n;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    i18n.initializeLanguageSelector();
});