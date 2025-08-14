/**
 * Performance Script Loader - LFG Ventures Gold Standard
 * 
 * Based on the production optimization that achieved:
 * - Optimal page load performance
 * - Lazy loading for non-critical scripts
 * - Priority loading for conversion tracking
 * - Zero blocking resources
 */

window.PerformanceLoader = {
    // Configuration
    initialized: false,
    loadedScripts: new Set(),
    criticalScripts: [
        'js/config.js',
        'js/meta-pixel-direct.js'
    ],
    deferredScripts: [
        'js/analytics-enhanced.js',
        'js/gtm-enhanced.js'
    ],
    
    /**
     * Initialize performance loader
     */
    init: function() {
        if (this.initialized) return;
        
        console.log('🚀 Performance Loader initializing...');
        
        // Load critical scripts immediately
        this.loadCriticalScripts();
        
        // Set up lazy loading for deferred scripts
        this.setupDeferredLoading();
        
        // Set up intersection observer for images
        this.setupImageLazyLoading();
        
        // Set up service worker if supported
        this.setupServiceWorker();
        
        this.initialized = true;
        console.log('✅ Performance Loader initialized');
    },
    
    /**
     * Load critical scripts immediately
     */
    loadCriticalScripts: function() {
        console.log('⚡ Loading critical scripts...');
        
        this.criticalScripts.forEach(script => {
            this.loadScript(script, true);
        });
    },
    
    /**
     * Set up deferred loading for non-critical scripts
     */
    setupDeferredLoading: function() {
        // Load deferred scripts after page load
        if (document.readyState === 'complete') {
            this.loadDeferredScripts();
        } else {
            window.addEventListener('load', () => {
                setTimeout(() => this.loadDeferredScripts(), 1000);
            });
        }
        
        // Also load on user interaction
        this.setupInteractionLoading();
    },
    
    /**
     * Load deferred scripts
     */
    loadDeferredScripts: function() {
        console.log('📦 Loading deferred scripts...');
        
        this.deferredScripts.forEach((script, index) => {
            setTimeout(() => {
                this.loadScript(script, false);
            }, index * 200); // Stagger loading
        });
    },
    
    /**
     * Set up loading on user interaction
     */
    setupInteractionLoading: function() {
        const events = ['click', 'scroll', 'touchstart'];
        const self = this;
        
        function loadOnInteraction() {
            self.loadDeferredScripts();
            events.forEach(event => {
                document.removeEventListener(event, loadOnInteraction);
            });
        }
        
        events.forEach(event => {
            document.addEventListener(event, loadOnInteraction, { once: true, passive: true });
        });
    },
    
    /**
     * Load a script dynamically
     */
    loadScript: function(src, critical = false) {
        if (this.loadedScripts.has(src)) {
            console.log(`Script already loaded: ${src}`);
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            
            if (critical) {
                script.setAttribute('data-critical', 'true');
            }
            
            script.onload = () => {
                this.loadedScripts.add(src);
                console.log(`✅ Script loaded: ${src}`);
                resolve();
            };
            
            script.onerror = () => {
                console.error(`❌ Failed to load script: ${src}`);
                reject(new Error(`Failed to load ${src}`));
            };
            
            document.head.appendChild(script);
        });
    },
    
    /**
     * Set up image lazy loading
     */
    setupImageLazyLoading: function() {
        if (!('IntersectionObserver' in window)) {
            console.log('IntersectionObserver not supported, loading all images');
            this.loadAllImages();
            return;
        }
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    this.loadImage(img);
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.01
        });
        
        // Observe all images with data-src
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
        
        console.log('🖼️ Image lazy loading initialized');
    },
    
    /**
     * Load a single image
     */
    loadImage: function(img) {
        const src = img.getAttribute('data-src');
        if (!src) return;
        
        const actualImg = new Image();
        actualImg.onload = () => {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
        };
        actualImg.onerror = () => {
            console.error(`Failed to load image: ${src}`);
        };
        actualImg.src = src;
    },
    
    /**
     * Load all images (fallback)
     */
    loadAllImages: function() {
        document.querySelectorAll('img[data-src]').forEach(img => {
            this.loadImage(img);
        });
    },
    
    /**
     * Set up service worker for caching
     */
    setupServiceWorker: function() {
        if (!('serviceWorker' in navigator)) {
            console.log('Service Worker not supported');
            return;
        }
        
        // Register service worker if it exists
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ Service Worker registered:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    },
    
    /**
     * Preload critical resources
     */
    preloadCriticalResources: function() {
        const criticalResources = [
            { href: '/css/sprint3-styles.css', as: 'style' },
            { href: '/js/config.js', as: 'script' },
            { href: '/js/meta-pixel-direct.js', as: 'script' }
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            document.head.appendChild(link);
        });
        
        console.log('🎯 Critical resources preloaded');
    },
    
    /**
     * Monitor performance
     */
    monitorPerformance: function() {
        // Monitor Core Web Vitals
        if ('web-vital' in window) {
            // This would integrate with Web Vitals library
            console.log('📊 Performance monitoring enabled');
        }
        
        // Monitor script loading times
        performance.addEventListener('navigation', () => {
            setTimeout(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                console.log('📈 Performance metrics:', {
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                    firstByte: navigation.responseStart - navigation.requestStart
                });
            }, 1000);
        });
    },
    
    /**
     * Add script loading with retry logic
     */
    loadScriptWithRetry: function(src, retries = 3) {
        return new Promise((resolve, reject) => {
            const attemptLoad = (attemptsLeft) => {
                this.loadScript(src)
                    .then(resolve)
                    .catch(error => {
                        if (attemptsLeft > 0) {
                            console.log(`Retrying script load: ${src} (${attemptsLeft} attempts left)`);
                            setTimeout(() => attemptLoad(attemptsLeft - 1), 1000);
                        } else {
                            reject(error);
                        }
                    });
            };
            
            attemptLoad(retries);
        });
    }
};

// Auto-initialize performance loader
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.PerformanceLoader.init();
    });
} else {
    window.PerformanceLoader.init();
}

// Expose for manual control
window.loadScript = function(src, critical = false) {
    return window.PerformanceLoader.loadScript(src, critical);
};

console.log('⚡ Performance Loader ready - LFG Ventures Gold Standard');